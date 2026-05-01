// adminEngagementQueries.ts — Supabase reads/writes for AmbienceAdmin
// Engagement list (trip-grouped), detail, update, create, delete + status
// lookups + person/trip typeahead. Single source of truth for admin-side
// engagement data access. Components call these — never .from() inline.
//
// Last updated: S33 — Added iteration_label (s33_01). List query now joins
//   travel_trips + global_people for trip-group rendering. fetchEngagementList
//   returns engagements with embedded trip + client display fields; the
//   list-tab handles grouping in-memory.

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngagementListRow = {
  id:                   string
  url_id:               string | null
  title:                string | null
  audience:             'private' | 'public'
  is_public_template:   boolean | null
  engagement_status_id: string
  itinerary_status_id:  string
  sort_order:           number
  created_at:           string
  iteration_label:      string

  // Joined display fields (status lookups)
  engagement_status_slug:  string | null
  engagement_status_label: string | null
  itinerary_status_slug:   string | null
  itinerary_status_label:  string | null

  // Trip linkage (NULL when engagement isn't linked to a canonical trip)
  trip_id:           string | null
  trip_code:         string | null
  trip_public_title: string | null
  trip_start_date:   string | null

  // Primary client on the linked trip (NULL when no trip OR no primary client)
  client_first_name: string | null
  client_last_name:  string | null
  client_nickname:   string | null
}

export type EngagementDetailRow = {
  // Identity
  id:                  string
  url_id:              string | null
  title:               string | null
  slug:                string | null
  iteration_label:     string
  audience:            'private' | 'public'
  is_public:           boolean
  is_public_template:  boolean | null
  engagement_type:     string
  trip_format:         string
  journey_types:       string[]
  sort_order:          number

  // Linkage
  person_id:           string | null
  trip_id:             string | null

  // Status
  engagement_status_id: string
  itinerary_status_id:  string
  status_label:         string | null

  // Hero primary
  eyebrow:         string | null
  hero_tagline:    string | null
  subtitle:        string | null
  hero_image_src:  string | null
  hero_image_alt:  string | null
  hero_pills:      unknown // jsonb

  // Hero secondary
  hero_title_2:        string | null
  hero_subtitle_2:     string | null
  hero_image_src_2:    string | null
  hero_image_alt_2:    string | null

  // Route
  route_eyebrow: string | null
  route_heading: string | null
  route_body:    string | null

  // Destination
  destination_heading:  string | null
  destination_subtitle: string | null
  destination_body:     string | null

  // Pricing
  pricing_heading:        string | null
  pricing_title:          string | null
  pricing_body:           string | null
  pricing_total_label:    string | null
  pricing_total_value:    string | null
  pricing_notes_heading:  string | null
  pricing_notes_title:    string | null
  pricing_notes:          unknown // jsonb

  // Welcome overrides
  welcome_eyebrow_override:      string | null
  welcome_title_override:        string | null
  welcome_body_override:         string | null
  welcome_signoff_body_override: string | null
  welcome_signoff_name_override: string | null

  created_at: string
  updated_at: string
}

export type StatusLookup = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
}

export type PersonOption = {
  id:         string
  first_name: string | null
  last_name:  string | null
  nickname:   string | null
}

export type TripOption = {
  id:         string
  trip_code:  string
  start_date: string | null
}

export type ChildCounts = {
  destination_rows:        number
  pricing_rows:            number
  destination_hotels:      number
  region_hotels:           number
  route_stops:             number
  card_selections:         number
  card_overrides:          number
  rooms:                   number
}

// ── Trip-grouped list shape ───────────────────────────────────────────────────
// The list tab consumes this — trips at top level, engagements as children.
// Orphans (engagements with trip_id NULL) collected into a synthetic group.

export type TripGroup = {
  // null when this is the orphan group
  trip_id:           string | null
  trip_code:         string | null
  trip_public_title: string | null
  trip_start_date:   string | null
  client_display:    string | null   // "Yazeed" or "Yazeed Last" or null
  engagements:       EngagementListRow[]
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchEngagementList(): Promise<EngagementListRow[]> {
  const { data, error } = await supabase
    .from('travel_immerse_engagements')
    .select(`
      id, url_id, title, audience, is_public_template,
      engagement_status_id, itinerary_status_id, sort_order, created_at,
      iteration_label, trip_id,
      engagement_status:travel_engagement_statuses(slug, label),
      itinerary_status:travel_itinerary_statuses(slug, label),
      trip:travel_trips(
        trip_code, public_title, start_date,
        primary_client:global_people!travel_trips_primary_client_id_fkey(
          first_name, last_name, nickname
        )
      )
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((r: any) => ({
    id:                      r.id,
    url_id:                  r.url_id,
    title:                   r.title,
    audience:                r.audience,
    is_public_template:      r.is_public_template,
    engagement_status_id:    r.engagement_status_id,
    itinerary_status_id:     r.itinerary_status_id,
    sort_order:              r.sort_order,
    created_at:              r.created_at,
    iteration_label:         r.iteration_label ?? '',
    engagement_status_slug:  r.engagement_status?.slug  ?? null,
    engagement_status_label: r.engagement_status?.label ?? null,
    itinerary_status_slug:   r.itinerary_status?.slug   ?? null,
    itinerary_status_label:  r.itinerary_status?.label  ?? null,
    trip_id:                 r.trip_id,
    trip_code:               r.trip?.trip_code         ?? null,
    trip_public_title:       r.trip?.public_title      ?? null,
    trip_start_date:         r.trip?.start_date        ?? null,
    client_first_name:       r.trip?.primary_client?.first_name ?? null,
    client_last_name:        r.trip?.primary_client?.last_name  ?? null,
    client_nickname:         r.trip?.primary_client?.nickname   ?? null,
  }))
}

// Group engagements by trip_id. Orphans (NULL trip_id) into a synthetic
// group sorted to the bottom. Within each group, engagements ordered by
// created_at ASC so v1/v2/v3 reads chronologically top-to-bottom.
export function groupByTrip(rows: EngagementListRow[]): TripGroup[] {
  const groups = new Map<string, TripGroup>()
  const orphans: EngagementListRow[] = []

  for (const row of rows) {
    if (row.trip_id == null) {
      orphans.push(row)
      continue
    }
    const existing = groups.get(row.trip_id)
    if (existing) {
      existing.engagements.push(row)
      continue
    }
    const clientDisplay =
      row.client_nickname
      ?? ([row.client_first_name, row.client_last_name].filter(Boolean).join(' ') || null)

    groups.set(row.trip_id, {
      trip_id:           row.trip_id,
      trip_code:         row.trip_code,
      trip_public_title: row.trip_public_title,
      trip_start_date:   row.trip_start_date,
      client_display:    clientDisplay && clientDisplay.length > 0 ? clientDisplay : null,
      engagements:       [row],
    })
  }

  // Sort engagements within each trip by created_at ASC
  for (const group of groups.values()) {
    group.engagements.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  // Sort trips by start_date DESC (most recent first), nulls last
  const tripGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.trip_start_date && b.trip_start_date) {
      return b.trip_start_date.localeCompare(a.trip_start_date)
    }
    if (a.trip_start_date) return -1
    if (b.trip_start_date) return 1
    return 0
  })

  // Orphan group at the bottom
  if (orphans.length > 0) {
    orphans.sort((a, b) => a.created_at.localeCompare(b.created_at))
    tripGroups.push({
      trip_id:           null,
      trip_code:         null,
      trip_public_title: null,
      trip_start_date:   null,
      client_display:    null,
      engagements:       orphans,
    })
  }

  return tripGroups
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function fetchEngagementDetail(urlId: string): Promise<EngagementDetailRow | null> {
  const { data, error } = await supabase
    .from('travel_immerse_engagements')
    .select('*')
    .eq('url_id', urlId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as EngagementDetailRow | null
}

// ── Child counts (read-only summary for detail page) ──────────────────────────

export async function fetchChildCounts(engagementId: string): Promise<ChildCounts> {
  const tables = [
    'travel_immerse_trip_destination_rows',
    'travel_immerse_trip_pricing_rows',
    'travel_immerse_trip_destination_hotels',
    'travel_immerse_trip_region_hotels',
    'travel_immerse_route_stops',
    'travel_immerse_trip_content_card_selections',
    'travel_immerse_trip_content_card_overrides',
    'travel_immerse_rooms',
  ] as const

  const results = await Promise.all(
    tables.map(t =>
      supabase.from(t).select('id', { count: 'exact', head: true }).eq('trip_id', engagementId),
    ),
  )

  return {
    destination_rows:   results[0].count ?? 0,
    pricing_rows:       results[1].count ?? 0,
    destination_hotels: results[2].count ?? 0,
    region_hotels:      results[3].count ?? 0,
    route_stops:        results[4].count ?? 0,
    card_selections:    results[5].count ?? 0,
    card_overrides:     results[6].count ?? 0,
    rooms:              results[7].count ?? 0,
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEngagementStatus(
  id: string,
  field: 'engagement_status_id' | 'itinerary_status_id',
  value: string,
): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_engagements')
    .update({ [field]: value })
    .eq('id', id)
  if (error) throw error
}

export async function updateEngagement(
  id: string,
  payload: Partial<EngagementDetailRow>,
): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_engagements')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

// ── Create ────────────────────────────────────────────────────────────────────

export type EngagementCreatePayload = {
  url_id:               string
  title:                string
  audience:             'private' | 'public'
  is_public_template:   boolean
  engagement_type:      string
  trip_format:          string
  journey_types:        string[]
  engagement_status_id: string
  itinerary_status_id:  string
  sort_order:           number
  iteration_label:      string
}

export async function createEngagement(payload: EngagementCreatePayload): Promise<string> {
  const { data, error } = await supabase
    .from('travel_immerse_engagements')
    .insert(payload)
    .select('id, url_id')
    .single()
  if (error) throw error
  return data.url_id as string
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEngagement(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_engagements')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export async function fetchEngagementStatuses(): Promise<StatusLookup[]> {
  const { data, error } = await supabase
    .from('travel_engagement_statuses')
    .select('id, slug, label, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as StatusLookup[]
}

export async function fetchItineraryStatuses(): Promise<StatusLookup[]> {
  const { data, error } = await supabase
    .from('travel_itinerary_statuses')
    .select('id, slug, label, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as StatusLookup[]
}

export async function fetchPeople(query: string): Promise<PersonOption[]> {
  let q = supabase
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .order('first_name', { ascending: true })
    .limit(20)

  const trimmed = query.trim()
  if (trimmed) {
    q = q.or(
      `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%`,
    )
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as PersonOption[]
}

export async function fetchTrips(query: string): Promise<TripOption[]> {
  let q = supabase
    .from('travel_trips')
    .select('id, trip_code, start_date')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(20)

  const trimmed = query.trim()
  if (trimmed) {
    q = q.ilike('trip_code', `%${trimmed}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TripOption[]
}

export async function fetchPersonById(id: string): Promise<PersonOption | null> {
  const { data, error } = await supabase
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as PersonOption | null
}

export async function fetchTripById(id: string): Promise<TripOption | null> {
  const { data, error } = await supabase
    .from('travel_trips')
    .select('id, trip_code, start_date')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as TripOption | null
}

// ── Welcome letter canonical singleton (read-only for placeholder display) ────

export type WelcomeLetterCanonical = {
  eyebrow:       string | null
  title:         string | null
  body:          string | null
  signoff_body:  string | null
  signoff_name:  string | null
}

export async function fetchWelcomeLetterCanonical(): Promise<WelcomeLetterCanonical | null> {
  const { data, error } = await supabase
    .from('travel_immerse_welcome_letter')
    .select('eyebrow, title, body, signoff_body, signoff_name')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as WelcomeLetterCanonical | null
}

// ── Max sort_order (for create defaults) ──────────────────────────────────────

export async function fetchMaxSortOrder(): Promise<number> {
  const { data, error } = await supabase
    .from('travel_immerse_engagements')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.sort_order ?? -1) + 1
}