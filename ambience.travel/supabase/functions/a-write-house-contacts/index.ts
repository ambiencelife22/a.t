// supabase/functions/a-write-house-contacts/index.ts
//
// Edge Function: a-write-house-contacts
// Creates / updates / deletes house-contact rows (a_house_contacts).
//
// a_house_contacts is client data (named staff for a private client house —
// PAs, drivers, security, medical, concierge). Per the client-data
// architecture rule, all writes go through an EF, never a direct table write.
// Table 2 of the queriesAdminHouse write migration (after a_house_people).
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - a_house_contacts written only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//   - Every write logged with actor + action + id.
//
// Request body:
//   { mode: string, ...fields }
//
// Modes:
//   create → { contact }  requires house_id + contact_type + name.
//                         is_primary defaults false. optional: person_id,
//                         role, company, notes. RETURNS the created row
//                         (the client uses contact.id to attach PPD records).
//   update → { contact }  requires id. patch any subset of editable fields.
//   delete → { id }       hard delete by id.
//
// Editable field allowlist:
//   create: house_id, person_id, contact_type, name, role, company, is_primary, notes
//   update: person_id, contact_type, name, role, company, is_primary, notes
//           (never id/house_id/timestamps)
//
// Deployed at: /functions/v1/a-write-house-contacts
// Last updated: S54c — initial ship (table 2 of the write migration).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONTACT_SELECT =
  'id, house_id, person_id, contact_type, name, role, company, is_primary, notes, created_at, updated_at'

// house_id + contact_type + name required (NOT NULL, no default).
// is_primary NOT NULL but defaults false at the DB level.
const CREATE_FIELDS = ['house_id', 'person_id', 'contact_type', 'name', 'role', 'company', 'is_primary', 'notes'] as const
const UPDATE_FIELDS = ['person_id', 'contact_type', 'name', 'role', 'company', 'is_primary', 'notes'] as const

function pick(src: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of fields) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
      case 'create': {
        const row = pick(body as Record<string, unknown>, CREATE_FIELDS)
        if (!row.house_id)     return json(400, { error: 'house_id is required' })
        if (!row.contact_type) return json(400, { error: 'contact_type is required' })
        if (!row.name)         return json(400, { error: 'name is required' })

        const { data, error } = await serviceClient
          .from('a_house_contacts')
          .insert(row)
          .select(CONTACT_SELECT)
          .single()
        if (error) {
          console.error('create error:', error)
          return json(500, { error: 'Failed to create contact' })
        }
        console.info(`a-write-house-contacts actor=${user.id} action=create id=${data?.id ?? 'unknown'}`)
        return json(200, { contact: data })
      }

      case 'update': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const patch = pick(body as Record<string, unknown>, UPDATE_FIELDS)
        if (Object.keys(patch).length === 0) {
          return json(400, { error: 'no editable fields provided' })
        }

        const { data, error } = await serviceClient
          .from('a_house_contacts')
          .update(patch)
          .eq('id', id)
          .select(CONTACT_SELECT)
          .maybeSingle()
        if (error) {
          console.error('update error:', error)
          return json(500, { error: 'Failed to update contact' })
        }
        if (!data) return json(404, { error: 'Contact not found' })

        console.info(`a-write-house-contacts actor=${user.id} action=update id=${id}`)
        return json(200, { contact: data })
      }

      case 'delete': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const { error } = await serviceClient
          .from('a_house_contacts')
          .delete()
          .eq('id', id)
        if (error) {
          console.error('delete error:', error)
          return json(500, { error: 'Failed to delete contact' })
        }
        console.info(`a-write-house-contacts actor=${user.id} action=delete id=${id}`)
        return json(200, { deleted: true, id })
      }

      default:
        return json(400, { error: `Unknown mode: ${mode}` })
    }

  } catch (err) {
    console.error('a-write-house-contacts unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}