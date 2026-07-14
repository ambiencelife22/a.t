// supabase/functions/a-write-house-records/index.ts
//
// Edge Function: a-write-house-records
// Single write dispatcher for the three "soft" house record tables:
//   - a_house_preferences
//   - a_house_dininghistory
//   - a_house_destinations
//
// All client data (household preferences, dining opinions, destination
// history). Per the client-data architecture rule, all writes go through an
// EF, never a direct table write. Table 3 of the queriesAdminHouse write
// migration. Mirrors the a-write-ppd dispatcher shape (table discriminator +
// action) rather than spawning three separate functions.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - Written only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//   - Every write logged with actor + action + table + id.
//
// Request body:
//   { mode: 'create'|'update'|'delete', table: 'preferences'|'dining'|'destinations', ...fields }
//
// Modes:
//   create → { record }  insert. required fields per table (below). RETURNS row.
//   update → { record }  requires id. patch any subset of editable fields.
//   delete → { id }      hard delete by id.
//
// Per-table config: db table name, create allowlist + required, update allowlist.
//
// Deployed at: /functions/v1/a-write-house-records
// Last updated: S54c — initial ship (table 3 of the write migration).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, preflight } from '../_shared/http.ts'


type TableKey = 'preferences' | 'dining' | 'destinations'

interface TableConfig {
  db:       string
  select:   string
  create:   readonly string[]   // fields a create may set
  required: readonly string[]   // subset of create that must be present
  update:   readonly string[]   // fields an update may patch (never id/house_id/timestamps)
}

const TABLES: Record<TableKey, TableConfig> = {
  preferences: {
    db:       'a_house_preferences',
    select:   'id, house_id, person_id, category, pref_key, pref_value, notes, source, confidence, created_at, updated_at',
    create:   ['house_id', 'person_id', 'category', 'pref_key', 'pref_value', 'notes', 'source', 'confidence'],
    required: ['house_id', 'category', 'pref_key', 'pref_value'],
    update:   ['person_id', 'category', 'pref_key', 'pref_value', 'notes', 'source', 'confidence'],
  },
  dining: {
    db:       'a_house_dininghistory',
    select:   'id, house_id, restaurant_name, city, country, status, visit_date, journey_id, venue_id, notes, created_at, updated_at',
    create:   ['house_id', 'restaurant_name', 'city', 'country', 'status', 'visit_date', 'journey_id', 'venue_id', 'notes'],
    required: ['house_id', 'restaurant_name'],
    update:   ['restaurant_name', 'city', 'country', 'status', 'visit_date', 'journey_id', 'venue_id', 'notes'],
  },
  destinations: {
    db:       'a_house_destinations',
    select:   'id, house_id, destination_name, country, city, trip_type, status, visit_date, journey_id, notes, created_at, updated_at',
    create:   ['house_id', 'destination_name', 'country', 'city', 'trip_type', 'status', 'visit_date', 'journey_id', 'notes'],
    required: ['house_id', 'destination_name', 'status'],
    update:   ['destination_name', 'country', 'city', 'trip_type', 'status', 'visit_date', 'journey_id', 'notes'],
  },
}

function pick(src: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of fields) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { mode, table } = body as { mode?: string; table?: string }
    if (!mode)  return json(400, { error: 'mode is required' })
    if (!table) return json(400, { error: 'table is required' })

    const cfg = TABLES[table as TableKey]
    if (!cfg) return json(400, { error: `Unknown table: ${table}` })

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Unauthorized' })

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) return json(401, { error: 'Unauthorized' })

    // ── 3. Verify caller is admin (SERVICE_ROLE_KEY per S66F canon) ────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await serviceClient
      .from('global_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile || profile.is_admin !== true) {
      return json(403, { error: 'Forbidden' })
    }

    // ── 4. Dispatch by mode ───────────────────────────────────────────────────
    switch (mode) {
      case 'create': {
        const row = pick(body as Record<string, unknown>, cfg.create)
        for (const r of cfg.required) {
          if (row[r] === undefined || row[r] === null || row[r] === '') {
            return json(400, { error: `${r} is required` })
          }
        }
        const { data, error } = await serviceClient
          .from(cfg.db)
          .insert(row)
          .select(cfg.select)
          .single()
        if (error) {
          console.error(`create error (${table}):`, error)
          return json(500, { error: `Failed to create ${table} record` })
        }
        const created = data as { id?: string } | null
        console.info(`a-write-house-records actor=${user.id} action=create table=${table} id=${created?.id ?? 'unknown'}`)
        return json(200, { record: data })
      }

      case 'update': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const patch = pick(body as Record<string, unknown>, cfg.update)
        if (Object.keys(patch).length === 0) {
          return json(400, { error: 'no editable fields provided' })
        }

        const { data, error } = await serviceClient
          .from(cfg.db)
          .update(patch)
          .eq('id', id)
          .select(cfg.select)
          .maybeSingle()
        if (error) {
          console.error(`update error (${table}):`, error)
          return json(500, { error: `Failed to update ${table} record` })
        }
        if (!data) return json(404, { error: `${table} record not found` })

        console.info(`a-write-house-records actor=${user.id} action=update table=${table} id=${id}`)
        return json(200, { record: data })
      }

      case 'delete': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const { error } = await serviceClient
          .from(cfg.db)
          .delete()
          .eq('id', id)
        if (error) {
          console.error(`delete error (${table}):`, error)
          return json(500, { error: `Failed to delete ${table} record` })
        }
        console.info(`a-write-house-records actor=${user.id} action=delete table=${table} id=${id}`)
        return json(200, { deleted: true, id })
      }

      default:
        return json(400, { error: `Unknown mode: ${mode}` })
    }

  } catch (err) {
    console.error('a-write-house-records unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}