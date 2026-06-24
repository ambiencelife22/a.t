// supabase/functions/a-write-house/index.ts
//
// Edge Function: a-write-house
// Updates the house record (a_houses).
//
// a_houses is client data (the private client household: name, designation,
// status, summary, service/travel/avoid notes, salutation + brief language).
// Per the client-data architecture rule, writes go through an EF, never a
// direct table write. Table 4 (final) of the queriesAdminHouse write migration.
//
// Update only: houses are seeded, never created or deleted from the client.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - a_houses written only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//   - Every write logged with actor + action + id.
//
// Request body:
//   { mode: 'update', id: string, ...fields }
//
// Editable field allowlist (never id/a_house_id/timestamps):
//   display_name, designation, status, summary, service_style_notes,
//   travel_style_notes, avoid_notes, service_notes, missing_info_notes,
//   salutation_rule, brief_language
//
// Deployed at: /functions/v1/a-write-house
// Last updated: S54c — initial ship (final table of the write migration).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, preflight } from '../_shared/http.ts'


const HOUSE_SELECT =
  'id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, created_at, updated_at'

// Editable columns. Never id/a_house_id/timestamps.
const UPDATE_FIELDS = [
  'display_name', 'designation', 'status', 'summary',
  'service_style_notes', 'travel_style_notes', 'avoid_notes',
  'service_notes', 'missing_info_notes', 'salutation_rule', 'brief_language',
] as const

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
    const { mode } = body as { mode?: string }
    if (!mode) return json(400, { error: 'mode is required' })

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
      case 'update': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const patch = pick(body as Record<string, unknown>, UPDATE_FIELDS)
        if (Object.keys(patch).length === 0) {
          return json(400, { error: 'no editable fields provided' })
        }

        const { data, error } = await serviceClient
          .from('a_houses')
          .update(patch)
          .eq('id', id)
          .select(HOUSE_SELECT)
          .maybeSingle()
        if (error) {
          console.error('update error:', error)
          return json(500, { error: 'Failed to update house' })
        }
        if (!data) return json(404, { error: 'House not found' })

        console.info(`a-write-house actor=${user.id} action=update id=${id}`)
        return json(200, { house: data })
      }

      default:
        return json(400, { error: `Unknown mode: ${mode}` })
    }

  } catch (err) {
    console.error('a-write-house unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}