// supabase/functions/global-read-team/index.ts
//
// Edge Function: global-read-team
// Reads ambience team members (global_team), resolved against global_people.
//
// global_team is a CROSS-PRODUCT entity (the ambience team), not a time-tracker
// appendage. This EF pair (global-read-team / global-write-team) is its canonical
// access layer. The time-tracker "Performed By" picker is the first consumer.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - global_team has admin-only RLS, no direct client read policy
//   - Uses the service role key to bypass RLS. Never called with the anon key.
//
// Request body:
//   { mode: string, ...filters }
//
// Modes:
//   members         → { members }   active team, resolved names + default rate.
//                                    optional { include_inactive: true }
//   member_by_id    → { member }    single by global_team.id,   requires { id }
//   member_by_person→ { member }    single by person_id,        requires { person_id }
//
// Member shape: { id, person_id, role, is_active, default_rate_id,
//                 display_name, first_name, last_name, nickname,
//                 rate_label, hourly_rate, currency }
//
// Deployed at: /functions/v1/global-read-team
// Last updated: S53C — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, preflight } from '../_shared/http.ts'


const MEMBER_SELECT = `
  id, person_id, role, is_active, default_rate_id, created_at, updated_at,
  global_people(first_name, last_name, nickname),
  travel_time_rates(role_label, hourly_rate, currency)
`

// Flatten a joined row into the flat member shape the client expects.
function shapeMember(m: any) {
  const gp = Array.isArray(m.global_people) ? m.global_people[0] : m.global_people
  const tr = Array.isArray(m.travel_time_rates) ? m.travel_time_rates[0] : m.travel_time_rates
  const display = gp
    ? (gp.nickname || [gp.first_name, gp.last_name].filter(Boolean).join(' ') || 'Team member')
    : 'Team member'
  return {
    id: m.id,
    person_id: m.person_id,
    role: m.role,
    is_active: m.is_active,
    default_rate_id: m.default_rate_id,
    display_name: display,
    first_name: gp?.first_name ?? null,
    last_name: gp?.last_name ?? null,
    nickname: gp?.nickname ?? null,
    rate_label: tr?.role_label ?? null,
    hourly_rate: tr?.hourly_rate ?? null,
    currency: tr?.currency ?? null,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return preflight()
  }

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }

    if (!mode) {
      return json({ error: 'mode is required' }, 400)
    }

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

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
      return json({ error: 'Forbidden' }, 403)
    }

    // ── 4. Dispatch by mode ───────────────────────────────────────────────────
    switch (mode) {
      // All team members (active by default), resolved + ordered.
      case 'members': {
        const { include_inactive } = body as { include_inactive?: boolean }
        let q = serviceClient
          .from('global_team')
          .select(MEMBER_SELECT)
          .order('role', { ascending: true })
        if (!include_inactive) q = q.eq('is_active', true)
        const { data, error } = await q
        if (error) {
          console.error('members fetch error:', error)
          return json({ error: 'Failed to fetch team members' }, 500)
        }
        return json({ members: (data ?? []).map(shapeMember) }, 200)
      }

      // Single member by global_team.id
      case 'member_by_id': {
        const { id } = body as { id?: string }
        if (!id) {
          return json({ error: 'id is required' }, 400)
        }
        const { data, error } = await serviceClient
          .from('global_team')
          .select(MEMBER_SELECT)
          .eq('id', id)
          .maybeSingle()
        if (error) {
          console.error('member_by_id fetch error:', error)
          return json({ error: 'Failed to fetch team member' }, 500)
        }
        return json({ member: data ? shapeMember(data) : null }, 200)
      }

      // Single member by person_id (used to default "Performed By" to the
      // logged-in admin's own team row).
      case 'member_by_person': {
        const { person_id } = body as { person_id?: string }
        if (!person_id) {
          return json({ error: 'person_id is required' }, 400)
        }
        const { data, error } = await serviceClient
          .from('global_team')
          .select(MEMBER_SELECT)
          .eq('person_id', person_id)
          .maybeSingle()
        if (error) {
          console.error('member_by_person fetch error:', error)
          return json({ error: 'Failed to fetch team member' }, 500)
        }
        return json({ member: data ? shapeMember(data) : null }, 200)
      }

      default:
        return json({ error: `Unknown mode: ${mode}` }, 400)
    }

  } catch (err) {
    console.error('global-read-team unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})