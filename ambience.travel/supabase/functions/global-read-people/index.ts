// supabase/functions/global-read-people/index.ts
//
// Edge Function: global-read-people
// Reads the canonical person registry (global_people).
//
// global_people is a CROSS-PRODUCT entity — the canonical person spine that
// passengers (travel_trip_aux_passengers.person_id), house-people
// (a_house_people.person_id), grants, and team all FK to. This EF is its
// canonical client access layer. First consumers: the house-person link
// picker (PersonModal) and the passenger link picker (AuxPassengersEditor).
//
// NOTE: queriesAdminGuides.ts currently reads global_people DIRECTLY
// (fetchAllPeople + grant batch-fetches). Those are violations of the
// client-data architecture rule (sensitive data only through EF) and should
// be migrated onto this layer.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - global_people read only via service role here. Never anon.
//   - SERVICE_ROLE_KEY env var (S66F canon).
//
// Request body:
//   { mode: string, ...filters }
//
// Modes:
//   list       → { people }   all people, ordered by first_name.
//                              optional { search: string } filters
//                              first_name/last_name/nickname/email (ilike).
//   by_id      → { person }   single by global_people.id, requires { id }
//   by_ids     → { people }   batch by id list,           requires { ids: string[] }
//
// Person shape: { id, first_name, last_name, nickname, email,
//                 last_initial, display_name }
//   display_name resolved server-side: nickname || "first last" || "Person".
//
// Deployed at: /functions/v1/global-read-people
// Last updated: S54c — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSON_SELECT = 'id, first_name, middle_name, last_name, father_name, grandfather_name, patronymic_connector, pronouns, nickname, email, phone, last_initial'

// Flatten + resolve display_name. Mirrors the team EF's shapeMember pattern.
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
    phone:                p.phone ?? null,
    last_initial:         p.last_initial ?? null,
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
      return new Response(
        JSON.stringify({ error: 'mode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Dispatch by mode ───────────────────────────────────────────────────
    switch (mode) {
      // All people, ordered. Optional ilike search across name fields + email.
      case 'list': {
        const { search } = body as { search?: string }
        let q = serviceClient
          .from('global_people')
          .select(PERSON_SELECT)
          .order('first_name', { ascending: true })

        if (search && search.trim()) {
          const term = `%${search.trim()}%`
          q = q.or(
            `first_name.ilike.${term},middle_name.ilike.${term},last_name.ilike.${term},father_name.ilike.${term},grandfather_name.ilike.${term},nickname.ilike.${term},email.ilike.${term}`
          )
        }

        const { data, error } = await q
        if (error) {
          console.error('list fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch people' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ people: (data ?? []).map(shapePerson) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Single person by id.
      case 'by_id': {
        const { id } = body as { id?: string }
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await serviceClient
          .from('global_people')
          .select(PERSON_SELECT)
          .eq('id', id)
          .maybeSingle()
        if (error) {
          console.error('by_id fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch person' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ person: data ? shapePerson(data) : null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Batch by id list (for resolving multiple person_ids at once).
      case 'by_ids': {
        const { ids } = body as { ids?: string[] }
        if (!Array.isArray(ids) || ids.length === 0) {
          return new Response(
            JSON.stringify({ error: 'ids (non-empty array) is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await serviceClient
          .from('global_people')
          .select(PERSON_SELECT)
          .in('id', ids)
        if (error) {
          console.error('by_ids fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch people' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ people: (data ?? []).map(shapePerson) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (err) {
    console.error('global-read-people unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})