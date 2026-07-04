// supabase/functions/a-write-house-labels/index.ts
//
// Edge Function: a-write-house-labels
// Creates / updates / deletes / reorders public guest labels for a house
// (a_house_public_labels), and sets which label is the house default.
//
// a_house_public_labels is the AUTHORED public-identity source for a house:
// the enum-keyed, designer-authored display names projected across the privacy
// wall by resolve_and_project_guest_label. It is NEVER raw global_people data.
// Per the client-data architecture rule, all writes go through an EF, never a
// direct table write. Sibling of a-write-house-people / -records / -contacts.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//     NOTE: inherits the is_admin -> admin_scopes retirement debt shared by all
//     five a-write-house-* EFs; migrate them together, not piecemeal.
//   - a_house_public_labels written only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//   - Every write logged with actor + action + id.
//
// Request body: { mode: string, ...fields }
//
// Modes:
//   create      → { label }        requires house_id + key + display_name.
//                                   is_default defaults false; sort_order 0.
//   update      → { id, ...patch }  patch key / display_name / sort_order.
//                                   (is_default is NOT set here — use set_default,
//                                   which enforces one-default-per-house.)
//   delete      → { id }            hard delete by id.
//   set_default → { id }            clears the house's current default, then sets
//                                   this row default — respects the one-default
//                                   partial unique index (S53L). Atomic-ish:
//                                   clear-then-set, both service-role.
//   reorder     → { ordered_ids }   sort_order = array index.
//
// key ∈ house_label_context enum: family | principal | delegation | couple | staff
//
// Deployed at: /functions/v1/a-write-house-labels
// Last updated: S53M — Step 11 Part A (House Label Manager).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, preflight } from '../_shared/http.ts'

const LABEL_SELECT = 'id, house_id, key, display_name, is_default, sort_order, created_at, updated_at'

// key + display_name + house_id required (all NOT NULL, no usable default).
const CREATE_FIELDS = ['house_id', 'key', 'display_name', 'sort_order'] as const
// Never id/house_id/is_default/timestamps. is_default flows only through set_default.
const UPDATE_FIELDS = ['key', 'display_name', 'sort_order'] as const

const VALID_KEYS = ['family', 'principal', 'delegation', 'couple', 'staff'] as const

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
        if (!row.house_id)     return json(400, { error: 'house_id is required' })
        if (!row.key)          return json(400, { error: 'key is required' })
        if (!row.display_name) return json(400, { error: 'display_name is required' })
        if (!VALID_KEYS.includes(row.key as typeof VALID_KEYS[number])) {
          return json(400, { error: `key must be one of: ${VALID_KEYS.join(', ')}` })
        }

        const { data, error } = await serviceClient
          .from('a_house_public_labels')
          .insert(row)
          .select(LABEL_SELECT)
          .single()
        if (error) {
          console.error('create error:', error)
          return json(500, { error: 'Failed to create house label' })
        }
        console.info(`a-write-house-labels actor=${user.id} action=create id=${data?.id ?? 'unknown'}`)
        return json(200, { label: data })
      }

      case 'update': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const patch = pick(body as Record<string, unknown>, UPDATE_FIELDS)
        if (Object.keys(patch).length === 0) {
          return json(400, { error: 'no editable fields provided' })
        }
        if (patch.key !== undefined &&
            !VALID_KEYS.includes(patch.key as typeof VALID_KEYS[number])) {
          return json(400, { error: `key must be one of: ${VALID_KEYS.join(', ')}` })
        }

        const { data, error } = await serviceClient
          .from('a_house_public_labels')
          .update(patch)
          .eq('id', id)
          .select(LABEL_SELECT)
          .maybeSingle()
        if (error) {
          console.error('update error:', error)
          return json(500, { error: 'Failed to update house label' })
        }
        if (!data) return json(404, { error: 'House label not found' })

        console.info(`a-write-house-labels actor=${user.id} action=update id=${id}`)
        return json(200, { label: data })
      }

      case 'delete': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })
        const { error } = await serviceClient
          .from('a_house_public_labels')
          .delete()
          .eq('id', id)
        if (error) {
          console.error('delete error:', error)
          return json(500, { error: 'Failed to delete house label' })
        }
        console.info(`a-write-house-labels actor=${user.id} action=delete id=${id}`)
        return json(200, { deleted: true, id })
      }

      case 'set_default': {
        // One default per house (enforced by a partial unique index, S53L).
        // A naive is_default=true would collide with the existing default, so
        // we clear the house's current default FIRST, then set the new one.
        // Look up the label's house to scope the clear.
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const { data: target, error: findErr } = await serviceClient
          .from('a_house_public_labels')
          .select('id, house_id')
          .eq('id', id)
          .maybeSingle()
        if (findErr) {
          console.error('set_default lookup error:', findErr)
          return json(500, { error: 'Failed to resolve label' })
        }
        if (!target) return json(404, { error: 'House label not found' })

        // Clear any current default on this house (except the target itself).
        const { error: clearErr } = await serviceClient
          .from('a_house_public_labels')
          .update({ is_default: false })
          .eq('house_id', target.house_id)
          .eq('is_default', true)
          .neq('id', id)
        if (clearErr) {
          console.error('set_default clear error:', clearErr)
          return json(500, { error: 'Failed to clear existing default' })
        }

        // Set the target as default.
        const { data, error: setErr } = await serviceClient
          .from('a_house_public_labels')
          .update({ is_default: true })
          .eq('id', id)
          .select(LABEL_SELECT)
          .maybeSingle()
        if (setErr) {
          console.error('set_default set error:', setErr)
          return json(500, { error: 'Failed to set default' })
        }
        console.info(`a-write-house-labels actor=${user.id} action=set_default id=${id} house=${target.house_id}`)
        return json(200, { label: data })
      }

      case 'reorder': {
        // Batch ordering within a house. sort_order = array index.
        const { ordered_ids } = body as { ordered_ids?: string[] }
        if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
          return json(400, { error: 'ordered_ids (non-empty array) is required' })
        }
        let i = 0
        for (const lid of ordered_ids) {
          const { error } = await serviceClient
            .from('a_house_public_labels')
            .update({ sort_order: i })
            .eq('id', lid)
          if (error) {
            console.error('reorder error:', error)
            return json(500, { error: 'Failed to reorder house labels' })
          }
          i += 1
        }
        console.info(`a-write-house-labels actor=${user.id} action=reorder count=${ordered_ids.length}`)
        return json(200, { reordered: ordered_ids.length })
      }

      default:
        return json(400, { error: `Unknown mode: ${mode}` })
    }

  } catch (err) {
    console.error('a-write-house-labels unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}