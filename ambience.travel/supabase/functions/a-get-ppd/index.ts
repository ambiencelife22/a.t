// supabase/functions/a-get-ppd/index.ts
//
// Edge Function: a-get-ppd
// Reads sensitive PPD data from a_ppd_people and a_ppd_contacts.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller authenticated + admin, enforced via the shared requireAdmin gate
//     (_shared/auth.ts). Service role via createServiceClient (_shared/client.ts).
//   - a_ppd_* tables have no direct client read policy; reads bypass RLS via service role.
//
// Request body:
//   { house_id: string, person_id?: string, contact_id?: string }
//   person_id, when supplied, is a global_people.id. The live caller
//   (fetchPPDForHouse in queriesAdminHouse.ts) passes house_id only, so the
//   person filter is dormant; wired correctly for when scoping is needed.
//
// Response:
//   { people: HousePPDEntry[], contacts: ContactPPDEntry[] }
//
// Deployed at: /functions/v1/a-get-ppd
// Last updated: S53H Phase 2 — onto requireAdmin + createServiceClient + shared json.
//   a_ppd_people.person_id FKs to global_people directly (Phase 4 done). Contacts
//   re-key to the spine remains scoped-out — do not re-point a_ppd_contacts without
//   verifying the table has a global-person column first.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

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

    if (!house_id) return json({ error: 'house_id is required' }, 400)

    // ── 2. Verify caller is an authenticated admin ───────────────────────────
    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient } = gate

    // ── 3. Fetch PPD data via service role ────────────────────────────────────
    // a_ppd_people.person_id FKs to global_people directly (Phase 4 done).
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
      return json({ error: 'Failed to fetch PPD people data' }, 500)
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
      return json({ error: 'Failed to fetch PPD contacts data' }, 500)
    }

    // ── 4. Return ─────────────────────────────────────────────────────────────
    return json({ people: people ?? [], contacts: contacts ?? [] }, 200)

  } catch (err) {
    console.error('a-get-ppd unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
