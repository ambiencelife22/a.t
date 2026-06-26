// supabase/functions/global-write-people/index.ts
//
// Edge Function: global-write-people
// Creates / updates the canonical person registry (global_people).
//
// Canonical write layer for the cross-product person spine. Pairs with
// global-read-people. Admin-only. global_people is FK'd by passengers,
// house-people, grants, and team — this is the single write path.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - global_people written only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//   - Every write logged with actor + action + id.
//
// Request body:
//   { mode: string, ...fields }
//
// Modes:
//   create → { person }   mint a new global_people row. All fields optional
//                         (id/created_at/updated_at/is_public_display default).
//                         optional: first_name, last_name, nickname, email,
//                                   phone, notes, last_initial, is_public_display
//   update → { person }   patch an existing row. requires { id }; any subset
//                         of the editable fields above. Only provided fields
//                         are written (no clobber-with-undefined).
//
// Editable field allowlist (writes restricted to these — never id/timestamps):
//   first_name, last_name, nickname, email, phone, notes, last_initial,
//   is_public_display, over_18_confirmed_at
//
// Person shape returned: full row via PERSON_SELECT (matches global-read-people).
//
// Deployed at: /functions/v1/global-write-people
// Last updated: S54c — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSON_SELECT = 'id, first_name, middle_name, last_name, father_name, grandfather_name, patronymic_connector, pronouns, nickname, email, last_initial, is_public_display, over_18_confirmed_at'

// Editable columns — the only fields a write may touch. id + timestamps excluded.
const EDITABLE_FIELDS = [
  'first_name', 'middle_name', 'last_name', 'father_name', 'grandfather_name',
  'patronymic_connector', 'pronouns', 'nickname', 'email', 'phone', 'notes',
  'last_initial', 'is_public_display', 'over_18_confirmed_at',
] as const

// Pull only allowlisted fields that were actually provided (not undefined).
function pickEditable(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of EDITABLE_FIELDS) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out
}

function shapePerson(p: any) {
  const display =
    p.nickname ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    'Person'
  return {
    id:                   p.id,
    first_name:           p.first_name ?? null,
    middle_name:          p.middle_name ?? null,
    last_name:            p.last_name ?? null,
    father_name:          p.father_name ?? null,
    grandfather_name:     p.grandfather_name ?? null,
    patronymic_connector: p.patronymic_connector ?? null,
    pronouns:             p.pronouns ?? null,
    nickname:             p.nickname ?? null,
    email:                p.email ?? null,
    last_initial:         p.last_initial ?? null,
    is_public_display:    p.is_public_display ?? false,
    over_18_confirmed_at: p.over_18_confirmed_at ?? null,
    display_name:         display,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }

    if (!mode) {
      return json(400, { error: 'mode is required' })
    }

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
      // Mint a new global_people row. All fields optional (defaults cover NOT NULL).
      case 'create': {
        const insertRow = pickEditable(body as Record<string, unknown>)
        const { data, error } = await serviceClient
          .from('global_people')
          .insert(insertRow)
          .select(PERSON_SELECT)
          .single()
        if (error) {
          console.error('create error:', error)
          return json(500, { error: 'Failed to create person' })
        }
        console.info(`global-write-people actor=${user.id} action=create id=${data?.id ?? 'unknown'}`)
        return json(200, { person: shapePerson(data) })
      }

      // Patch an existing row. Only provided editable fields are written.
      case 'update': {
        const { id } = body as { id?: string }
        if (!id) return json(400, { error: 'id is required' })

        const patch = pickEditable(body as Record<string, unknown>)
        if (Object.keys(patch).length === 0) {
          return json(400, { error: 'no editable fields provided' })
        }

        const { data, error } = await serviceClient
          .from('global_people')
          .update(patch)
          .eq('id', id)
          .select(PERSON_SELECT)
          .maybeSingle()
        if (error) {
          console.error('update error:', error)
          return json(500, { error: 'Failed to update person' })
        }
        if (!data) return json(404, { error: 'Person not found' })

        console.info(`global-write-people actor=${user.id} action=update id=${id}`)
        return json(200, { person: shapePerson(data) })
      }

      default:
        return json(400, { error: `Unknown mode: ${mode}` })
    }

  } catch (err) {
    console.error('global-write-people unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}