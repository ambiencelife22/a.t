// supabase/functions/a-write-house-people/index.ts
//
// Edge Function: a-write-house-people
// Creates / updates / deletes house-person rows (a_house_people).
//
// a_house_people is client data (the household roster for a private client
// house). Per the client-data architecture rule, all writes go through an EF,
// never a direct table write. This pairs with the existing a-write-ppd /
// a-get-ppd pattern for the PPD tier and global-write-people for the registry.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - a_house_people written only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//   - Every write logged with actor + action + id.
//
// Request body:
//   { mode: string, ...fields }
//
// Modes:
//   create → { person }   requires house_id + member_ref. role defaults to
//                         'member' if omitted. optional: notes, person_id.
//   update → { person }   requires id. patch any subset of the editable
//                         fields below. Only provided fields are written.
//   delete → { id }       hard delete by id.
//
// Editable field allowlist (writes restricted to these):
//   create: house_id, member_ref, role, notes, person_id
//   update: member_ref, role, notes, person_id   (never id/house_id/timestamps)
//
// Row shape returned (create/update): full row via PERSON_SELECT.
//
// Deployed at: /functions/v1/a-write-house-people
// Last updated: S54c — initial ship (table 1 of the queriesAdminHouse write migration).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, preflight } from '../_shared/http.ts'


const PERSON_SELECT = 'id, house_id, member_ref, role, notes, person_id, created_at, updated_at'

// Fields a create may set. house_id + member_ref required (NOT NULL, no default).
const CREATE_FIELDS = ['house_id', 'member_ref', 'role', 'notes', 'person_id'] as const
// Fields an update may patch. Never id/house_id/timestamps.
const UPDATE_FIELDS = ['member_ref', 'role', 'notes', 'person_id'] as const

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
      case 'create': {
        const row = pick(body as Record<string, unknown>, CREATE_FIELDS)
        if (!row.house_id)   return json(400, { error: 'house_id is required' })
        if (!row.member_ref) return json(400, { error: 'member_ref is required' })
        // role defaults to 'member' at the DB level if omitted.

        const { data, error } = await serviceClient
          .from('a_house_people')
          .insert(row)
          .select(PERSON_SELECT)
          .single()
        if (error) {
          console.error('create error:', error)
          return json(500, { error: 'Failed to create house-person' })
        }
        console.info(`a-write-house-people actor=${user.id} action=create id=${data?.id ?? 'unknown'}`)
        return json(200, { person: data })
      }

      case 'update': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const patch = pick(body as Record<string, unknown>, UPDATE_FIELDS)
        if (Object.keys(patch).length === 0) {
          return json(400, { error: 'no editable fields provided' })
        }

        const { data, error } = await serviceClient
          .from('a_house_people')
          .update(patch)
          .eq('id', id)
          .select(PERSON_SELECT)
          .maybeSingle()
        if (error) {
          console.error('update error:', error)
          return json(500, { error: 'Failed to update house-person' })
        }
        if (!data) return json(404, { error: 'House-person not found' })

        console.info(`a-write-house-people actor=${user.id} action=update id=${id}`)
        return json(200, { person: data })
      }

      case 'delete': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const { error } = await serviceClient
          .from('a_house_people')
          .delete()
          .eq('id', id)
        if (error) {
          console.error('delete error:', error)
          return json(500, { error: 'Failed to delete house-person' })
        }
        console.info(`a-write-house-people actor=${user.id} action=delete id=${id}`)
        return json(200, { deleted: true, id })
      }

      default:
        return json(400, { error: `Unknown mode: ${mode}` })
    }

  } catch (err) {
    console.error('a-write-house-people unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}