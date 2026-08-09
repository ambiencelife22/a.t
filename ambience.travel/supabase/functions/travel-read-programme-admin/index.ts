// supabase/functions/travel-read-programme-admin/index.ts
//
// Edge Function: travel-read-programme-admin
// Reads hosted-stay admin data across six tables.
//
// Security model:
//   - JWT REQUIRED - verify_jwt = true
//   - requireAdmin gate (_shared/auth.ts) - service role via createServiceClient
//   - Reads bypass RLS via service role.
//
// Modes:
//   programmes          - list all travel_hosted_stay rows + joined property
//   properties          - list all travel_hosted_property rows
//   listings            - list travel_hosted_property_listing by property_id
//   property_sections   - list travel_hosted_property_section by property_id
//   programme_sections  - list travel_hosted_stay_section by stay_id
//   programme_guests    - list travel_hosted_stay_guest by stay_id (name-resolved)
//   programme_guest_search - search global_people for guest linking
//
// Request body: { mode: string, ...modeParams }
// Response:     { data: Row[] }
//
// Last updated: hosted-stay migration - programme_* tables renamed to hosted_*.
//   Column renames: public_* to show_*, active to is_active, no_alarm to has_alarm,
//   alarm_code_provided to has_alarm_code, favourite to is_favourite. Guest identity
//   moved from profile_id (via global_profiles) to person_id (direct global_people).
//   programme_type column dropped. FK programme_id renamed to stay_id.

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
  | 'property_sections_meta'
  | 'programme_guests'
  | 'programme_guest_search'

async function handleProgrammeGuests(db: SupabaseClient, stayId: string): Promise<Response> {
  const { data: guests, error } = await db
    .from('travel_hosted_stay_guest')
    .select('id, stay_id, display_name, person_id, is_lead, sort_order')
    .eq('stay_id', stayId)
    .order('sort_order', { ascending: true })
  if (error) return json({ error: 'Failed to fetch stay guests' }, 500)
  const rows = (guests ?? []) as Array<Record<string, unknown>>
  const personIds = [...new Set(rows.map(r => r.person_id).filter(Boolean))] as string[]
  const nameByPerson: Record<string, string> = {}
  if (personIds.length > 0) {
    const { data: people } = await db
      .from('global_people')
      .select('id, first_name, last_name, nickname')
      .in('id', personIds)
    for (const g of (people ?? []) as Array<Record<string, unknown>>) {
      nameByPerson[g.id as string] = formatPersonName(g)
    }
  }
  const guestsOut = rows.map(r => ({
    id:            r.id,
    stay_id:       r.stay_id,
    display_name:  r.display_name,
    person_id:     r.person_id,
    is_lead:       r.is_lead,
    sort_order:    r.sort_order,
    resolved_name: r.person_id ? (nameByPerson[r.person_id as string] ?? null) : null,
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
  const results = peopleRows.map(p => ({
    person_id:    p.id as string,
    display_name: formatPersonName(p),
    nickname:     (p.nickname as string | null) ?? null,
    linkable:     true,
  }))
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
        .from('travel_hosted_stay')
        .select(`
          id, url_id, sub_path, status, is_active, is_public,
          show_wifi, show_alarm, show_owner_phone, show_manager_phone,
          has_alarm, show_arrival, guest_names, guest_count, check_in, check_out,
          welcome_letter, property_id, active_listing_ids, has_alarm_code,
          properties:travel_hosted_property(id, name, slug)
        `)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('travel_hosted_stay fetch error:', error)
        return json({ error: 'Failed to fetch programmes' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }
    // ── properties ─────────────────────────────────────────────────────────
    if (mode === 'properties') {
      const { data, error } = await db
        .from('travel_hosted_property')
        .select(`
          id, slug, name, tagline, city, country, hero_image, maps_url,
          maps_embed_url, owner_name, owner_phone, manager_name, manager_phone,
          emergency_contacts, is_active
        `)
        .order('name')
      if (error) {
        console.error('travel_hosted_property fetch error:', error)
        return json({ error: 'Failed to fetch properties' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }
    // ── listings ───────────────────────────────────────────────────────────
    if (mode === 'listings') {
      if (!property_id) return json({ error: 'property_id is required for listings mode' }, 400)
      const { data, error } = await db
        .from('travel_hosted_property_listing')
        .select('id, name, category, genre, address, website, hours, note, is_favourite, property_id')
        .eq('property_id', property_id)
        .order('category')
      if (error) {
        console.error('travel_hosted_property_listing fetch error:', error)
        return json({ error: 'Failed to fetch listings' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }
    // ── property_sections ──────────────────────────────────────────────────
    if (mode === 'property_sections') {
      if (!property_id) return json({ error: 'property_id is required for property_sections mode' }, 400)
      const { data, error } = await db
        .from('travel_hosted_property_section')
        .select('id, title, icon, sort_order, variant, content, property_id')
        .eq('property_id', property_id)
        .order('sort_order')
      if (error) {
        console.error('travel_hosted_property_section fetch error:', error)
        return json({ error: 'Failed to fetch property sections' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }
    // ── programme_sections ─────────────────────────────────────────────────
    if (mode === 'programme_sections') {
      if (!programme_id) return json({ error: 'programme_id is required for programme_sections mode' }, 400)
      const { data, error } = await db
        .from('travel_hosted_stay_section')
        .select('id, section_id, content')
        .eq('stay_id', programme_id)
      if (error) {
        console.error('travel_hosted_stay_section fetch error:', error)
        return json({ error: 'Failed to fetch programme sections' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }
    // ── property_sections_meta (title+icon only) ──
    if (mode === 'property_sections_meta') {
      if (!property_id) return json({ error: 'property_id is required for property_sections_meta mode' }, 400)
      const { data, error } = await db
        .from('travel_hosted_property_section')
        .select('id, title, icon')
        .eq('property_id', property_id)
        .eq('variant', 'default')
        .order('sort_order')
      if (error) {
        console.error('travel_hosted_property_section meta fetch error:', error)
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
