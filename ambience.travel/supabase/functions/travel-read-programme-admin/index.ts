// supabase/functions/travel-read-programme-admin/index.ts
//
// Edge Function: travel-read-programme-admin
// Reads programme admin data across five tables.
//
// Security model:
//   - JWT REQUIRED - verify_jwt = true
//   - requireAdmin gate (_shared/auth.ts) - service role via createServiceClient
//   - All five tables have no direct client read policy for admin surfaces;
//     reads bypass RLS via service role.
//
// Modes:
//   programmes          - list all travel_programme_master rows + joined property
//   properties          - list all travel_programme_properties rows
//   listings            - list travel_programme_property_listings by property_id
//   property_sections   - list travel_programme_property_sections by property_id
//   programme_sections  - list travel_programme_sections by programme_id
//
// Request body: { mode: string, ...modeParams }
// Response:     { data: Row[] }
//
// Last updated: S53G - initial build. Migrates 29 direct supabase.from() calls
//   out of ProgrammeAdmin.tsx.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'
import { formatPersonName } from '../_shared/names.ts'
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type ReadMode =
  | 'programmes'
  | 'properties'
  | 'listings'
  | 'property_sections'
  | 'programme_sections'
  | 'programme_guests'
  | 'programme_guest_search'

async function handleProgrammeGuests(db: SupabaseClient, programmeId: string): Promise<Response> {
  const { data: guests, error } = await db
    .from('travel_programme_guests')
    .select('id, programme_id, display_name, profile_id, is_lead, sort_order')
    .eq('programme_id', programmeId)
    .order('sort_order', { ascending: true })
  if (error) return json({ error: 'Failed to fetch programme guests' }, 500)
  const rows = (guests ?? []) as Array<Record<string, unknown>>
  const profileIds = [...new Set(rows.map(r => r.profile_id).filter(Boolean))] as string[]
  const personNameByProfileId: Record<string, string> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await db
      .from('global_profiles')
      .select('id, person_id')
      .in('id', profileIds)
    const profilePersonId: Record<string, string> = {}
    for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
      if (p.person_id) profilePersonId[p.id as string] = p.person_id as string
    }
    const personIds = [...new Set(Object.values(profilePersonId))]
    if (personIds.length > 0) {
      const { data: people } = await db
        .from('global_people')
        .select('id, first_name, last_name, nickname')
        .in('id', personIds)
      const nameByPerson: Record<string, string> = {}
      for (const g of (people ?? []) as Array<Record<string, unknown>>) {
        nameByPerson[g.id as string] = formatPersonName(g)
      }
      for (const [profileId, personId] of Object.entries(profilePersonId)) {
        const n = nameByPerson[personId]
        if (n) personNameByProfileId[profileId] = n
      }
    }
  }
  const guestsOut = rows.map(r => ({
    id:            r.id,
    programme_id:  r.programme_id,
    display_name:  r.display_name,
    profile_id:    r.profile_id,
    is_lead:       r.is_lead,
    sort_order:    r.sort_order,
    resolved_name: r.profile_id ? (personNameByProfileId[r.profile_id as string] ?? null) : null,
  }))
  return json({ guests: guestsOut }, 200)
}

async function handleProgrammeGuestSearch(db: SupabaseClient, query: string): Promise<Response> {
  const trimmed = (query ?? '').trim()
  if (trimmed.length < 2) return json({ results: [] }, 200)
  const { data: people, error } = await db
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%`)
    .order('first_name', { ascending: true })
    .limit(10)
  if (error) return json({ error: 'Failed to search people' }, 500)
  const peopleRows = (people ?? []) as Array<Record<string, unknown>>
  const personIds = peopleRows.map(p => p.id as string)
  const profileIdByPerson: Record<string, string> = {}
  if (personIds.length > 0) {
    const { data: profiles } = await db
      .from('global_profiles')
      .select('id, person_id')
      .in('person_id', personIds)
    for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
      const pid = p.person_id as string
      if (!profileIdByPerson[pid]) profileIdByPerson[pid] = p.id as string
    }
  }
  const results = peopleRows.map(p => {
    const personId  = p.id as string
    const profileId = profileIdByPerson[personId] ?? null
    return {
      person_id:    personId,
      profile_id:   profileId,
      display_name: formatPersonName(p),
      nickname:     (p.nickname as string | null) ?? null,
      linkable:     profileId != null,
    }
  })
  return json({ results }, 200)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode, property_id, programme_id, query } = body as {
      mode:          ReadMode
      property_id?:  string
      programme_id?: string
      query?:        string
    }

    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    // ── programmes ─────────────────────────────────────────────────────────
    if (mode === 'programmes') {
      const { data, error } = await db
        .from('travel_programme_master')
        .select(`
          id, url_id, programme_type, sub_path, status, active, is_public,
          public_wifi, public_alarm, public_owner_phone, public_manager_phone,
          no_alarm, public_arrival, guest_names, guest_count, check_in, check_out,
          welcome_letter, property_id, active_listing_ids, alarm_code_provided,
          properties:travel_programme_properties(id, name, slug)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('travel_programme_master fetch error:', error)
        return json({ error: 'Failed to fetch programmes' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── properties ─────────────────────────────────────────────────────────
    if (mode === 'properties') {
      const { data, error } = await db
        .from('travel_programme_properties')
        .select(`
          id, slug, name, tagline, city, country, hero_image, maps_url,
          maps_embed_url, owner_name, owner_phone, manager_name, manager_phone,
          emergency_contacts, active
        `)
        .order('name')

      if (error) {
        console.error('travel_programme_properties fetch error:', error)
        return json({ error: 'Failed to fetch properties' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── listings ───────────────────────────────────────────────────────────
    if (mode === 'listings') {
      if (!property_id) return json({ error: 'property_id is required for listings mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_property_listings')
        .select('id, name, category, genre, address, website, hours, note, favourite, property_id')
        .eq('property_id', property_id)
        .order('category')

      if (error) {
        console.error('travel_programme_property_listings fetch error:', error)
        return json({ error: 'Failed to fetch listings' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── property_sections ──────────────────────────────────────────────────
    if (mode === 'property_sections') {
      if (!property_id) return json({ error: 'property_id is required for property_sections mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_property_sections')
        .select('id, title, icon, sort_order, variant, content, property_id')
        .eq('property_id', property_id)
        .order('sort_order')

      if (error) {
        console.error('travel_programme_property_sections fetch error:', error)
        return json({ error: 'Failed to fetch property sections' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── programme_sections ─────────────────────────────────────────────────
    if (mode === 'programme_sections') {
      if (!programme_id) return json({ error: 'programme_id is required for programme_sections mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_sections')
        .select('id, section_id, content')
        .eq('programme_id', programme_id)

      if (error) {
        console.error('travel_programme_sections fetch error:', error)
        return json({ error: 'Failed to fetch programme sections' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── property_sections_admin (title+icon only - for ProgrammeSectionOverrides) ──
    // Separate mode to avoid over-fetching content in the override selector.
    if (mode === 'property_sections_meta') {
      if (!property_id) return json({ error: 'property_id is required for property_sections_meta mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_property_sections')
        .select('id, title, icon')
        .eq('property_id', property_id)
        .eq('variant', 'default')
        .order('sort_order')

      if (error) {
        console.error('travel_programme_property_sections meta fetch error:', error)
        return json({ error: 'Failed to fetch property sections meta' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── programme_guests ───────────────────────────────────────────────────
    if (mode === 'programme_guests') {
      if (!programme_id) return json({ error: 'programme_id is required for programme_guests mode' }, 400)
      return handleProgrammeGuests(db, programme_id)
    }
    // ── programme_guest_search ─────────────────────────────────────────────
    if (mode === 'programme_guest_search') {
      return handleProgrammeGuestSearch(db, query ?? '')
    }
    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-read-programme-admin unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})