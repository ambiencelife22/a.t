// supabase/functions/a-get-ppd/index.ts
//
// Edge Function: a-get-ppd
// Reads sensitive PPD data from a_ppd_people and a_ppd_contacts.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - a_ppd_* tables have no direct client read policy
//   - This function uses the service role key to bypass RLS
//   - Never called with the anon key
//
// Request body:
//   { house_id: string, person_id?: string, contact_id?: string }
//   person_id, when supplied, is a global_people.id. The live caller
//   (fetchPPDForHouse in queriesAdminHouse.ts) passes house_id only, so the
//   person filter is dormant; wired correctly for when scoping is needed.
//
// Response:
//   { people: HousePPDEntry[], contacts: ContactPPDEntry[] }
//   people[].person_id is a global_people id.
//
// Deployed at: /functions/v1/a-get-ppd
// Last updated: S53D POST-PHASE-4 — the reconcile is complete. a_ppd_people
//   now has a single person_id column that FKs to global_people (the old
//   a_house_people-linked column was dropped, global_person_id was renamed to
//   person_id in migration_s53d_01). This EF reads person_id directly. The
//   transitional COALESCE/normalise and the global_person_id references from
//   the pre-Phase-4 version are removed.
//   SERVICE_ROLE_KEY env var (S66F canon; was SUPABASE_SERVICE_ROLE_KEY drift).
//   a_ppd_contacts remains UNCHANGED — contacts re-key to the spine is still
//   scoped-out / not built. Do not re-point contacts without verifying the
//   table has a global-person column first.
// Prior: S53D (pre-Phase-4) — transitional global_person_id re-point.
// Prior: S50 — renamed get-ppd -> a-get-ppd. Prior: S64B — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, preflight } from '../_shared/http.ts'


Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { house_id, person_id, contact_id } = body as {
      house_id:   string | undefined
      person_id?: string | undefined  // global_people.id
      contact_id?: string | undefined
    }

    if (!house_id) {
      return new Response(
        JSON.stringify({ error: 'house_id is required' }),
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

    // ── 3. Verify caller is admin ─────────────────────────────────────────────
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

    // ── 4. Fetch PPD data via service role ────────────────────────────────────
    // a_ppd_people.person_id now FKs to global_people directly (Phase 4 done).
    let peopleQuery = serviceClient
      .from('a_ppd_people')
      .select('id, house_id, person_id, data_key, data_value, access_note, created_at, updated_at')
      .eq('house_id', house_id)
      .order('person_id', { ascending: true })
      .order('data_key', { ascending: true })

    if (person_id) {
      peopleQuery = peopleQuery.eq('person_id', person_id)
    }

    const { data: people, error: peopleError } = await peopleQuery

    if (peopleError) {
      console.error('a_ppd_people fetch error:', peopleError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch PPD people data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // a_ppd_contacts — UNCHANGED (contacts re-key to spine not yet built).
    let contactsQuery = serviceClient
      .from('a_ppd_contacts')
      .select('id, house_id, contact_id, data_key, data_value, access_note, created_at, updated_at')
      .eq('house_id', house_id)
      .order('contact_id', { ascending: true })
      .order('data_key', { ascending: true })

    if (contact_id) {
      contactsQuery = contactsQuery.eq('contact_id', contact_id)
    }

    const { data: contacts, error: contactsError } = await contactsQuery

    if (contactsError) {
      console.error('a_ppd_contacts fetch error:', contactsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch PPD contacts data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 5. Return ─────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ people: people ?? [], contacts: contacts ?? [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('a-get-ppd unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})