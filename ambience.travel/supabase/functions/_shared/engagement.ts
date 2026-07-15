// supabase/functions/_shared/engagement.ts
//
// Single-source trip assembly for the client EFs (travel-get-engagement-confirmation
// and travel-get-engagement-programme). Both EFs previously duplicated, verbatim:
//   - url_id -> trip_id -> house_id resolution (incl 404 cases)
//   - trip / brief / house / destinations fetch
//   - bookings + rooms fetch, room guest-name resolution, hotel + canon-room
//     image lookups
// That duplication drifted (confirmation carried a stale inline resolvePartyName
// that returned '' instead of null). This module is the one home for the fetch
// and name-resolution; each EF still composes its own DISPLAY shape from the
// returned pieces (image-display rules legitimately differ per surface — same
// principle as roomDisplay living in pdfShared while layout stays per-PDF).
//
// What stays in each EF (genuinely EF-specific, not duplicated):
//   confirmation : contacts resolution, guides, fullBookings financial null-out
//   programme    : standalone entries + dining/exp images, buildTimeline, buildDays
//
// Created: S55 — _shared/trip.ts extraction (single-source quest #1).
// S53O — error guards added to the engagement + engagement_display fetches in
//   fetchEngagementCore (was silent; the class of bug that hid the bedding_type and
//   is_total phantom-column failures). Overlay rename (travel_immerse_* ->
//   travel_overlay_*) is IN PROGRESS: engagement_display is now renamed
//   (travel_overlay_engagement_display, line ~139). This file still reads the
//   un-renamed travel_engagements (line ~34, ~135) — the LAST table in
//   Phase A. When it renames, all three client EFs redeploy together (this module
//   is imported by confirmation + programme; the proposal EF reads engagements directly).

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolvePartyName, formatPersonName } from './names.ts'
import { NODE_FIELD_MAP } from './elementFields.ts'
import { fetchHotelsByIds } from './bookings.ts'

// ── url_id -> trip_id -> house_id ─────────────────────────────────────────────
// Returns the ids, or null when the trip cannot be resolved (caller returns 404).

export async function resolvejourneyIds(
  db: SupabaseClient,
  urlId: string,
): Promise<{ journeyId: string; houseId: string } | null> {
  const { data: eng, error: engErr } = await db
    .from('travel_engagements')
    .select('journey_id')
    .eq('url_id', urlId)
    .not('journey_id', 'is', null)
    .limit(1)
    .single()
  if (engErr || !eng?.journey_id) return null
  const journeyId = eng.journey_id as string

  const { data: booking, error: bookErr } = await db
    .from('travel_bookings')
    .select('house_id')
    .eq('journey_id', journeyId)
    .not('house_id', 'is', null)
    .limit(1)
    .single()
  if (bookErr || !booking?.house_id) return null

  return { journeyId, houseId: booking.house_id as string }
}

// ── Core fetch: trip + brief + house + destinations ───────────────────────────
// Brief select is the SUPERSET of both EFs' needs (confirmation: contacts/tabs/
// welcome; programme: programme_notes). Extra columns are harmless to either.
// Returns trip=null when the trip row is missing (caller returns 404).

export interface EngagementCore {
  journey:              Record<string, unknown> | null
  brief:                Record<string, unknown> | null
  house:                Record<string, unknown> | null
  destinations:         Array<Record<string, unknown>>
  resolved_guest_label: string | null
}

export async function fetchEngagementCore(
  db: SupabaseClient,
  journeyId: string,
  houseId: string,
): Promise<EngagementCore> {
  const [tripResult, briefResult, houseResult, destResult] = await Promise.all([
    db.from('travel_journey')
      .select('id, journey_code, start_date, end_date, duration_nights, journey_type, guest_count_adults, guest_count_children, confirmed_engagement_id')
      .eq('id', journeyId)
      .single(),

    db.from('travel_journey_briefs')
      .select(`
        id, engagement_id:journey_id, house_id, brief_title, brief_subtitle, prepared_for,
        hero_image_src, hero_image_alt, logo_variant,
        snapshot_destination, snapshot_dates, snapshot_guests, snapshot_status,
        journey_steps, advisor_name, advisor_email, advisor_phone,
        show_advisor_phone, show_advisor_email,
        hotel_contact_note, important_notes, footer_tagline,
        programme_notes, programme_show_images, welcome_letter,
        show_tab_confirmation, show_tab_programme, show_tab_brief,
        show_tab_contacts, show_tab_welcome,
        contact_person_ids, contact_name_format,
        created_at, updated_at
      `)
      .eq('journey_id', journeyId)
      .maybeSingle(),

    db.from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),

    db.from('travel_journey_destinations')
      .select('id, engagement_id:journey_id, destination_id, sort_order, global_destinations!travel_journey_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
      .eq('journey_id', journeyId)
      .order('sort_order', { ascending: true }),
  ])

  const destinations = ((destResult.data ?? []) as Array<Record<string, unknown>>).map(row => {
    const gdRaw = row.global_destinations
    const gd = Array.isArray(gdRaw) ? gdRaw[0] : gdRaw
    return {
      id:             row.id,
      destination_id: row.destination_id,
      sort_order:     row.sort_order,
      slug:           (gd?.slug as string) ?? '',
      name:           (gd?.name as string) ?? '',
      storage_path:   (gd?.storage_path as string | null) ?? null,
      hero_image_src: (gd?.hero_image_src as string | null) ?? null,
    }
  })

  // Engagement hero is canon. brief.hero_image_src is an overlay (only set when
  // operator deliberately wants a different hero on the confirmation surface).
  // Resolve: brief overlay → engagement canon → null.
  // Engagement-level guest label (HPGL). travel_overlay_engagement_display.house_display_name
  // is the projected, admin-authored public label (single source — set by the
  // projection trigger, never resolved here). Keyed by engagement_id in the
  // display table. Best-effort: null when no confirmed engagement
  // or no projected row — callers fall through to prepared_for with ?? (never ||).
  const confirmedEngId = (tripResult.data?.confirmed_engagement_id as string | null) ?? null
  let engHeroSrc: string | null = null
  let engTitle: string | null = null
  let resolvedGuestLabel: string | null = null
  if (confirmedEngId) {
    const [engRes, displayRes] = await Promise.all([
      db.from('travel_engagements')
        .select('hero_image_src, title')
        .eq('id', confirmedEngId)
        .maybeSingle(),
      db.from('travel_overlay_engagement_display')
        .select('house_display_name')
        .eq('engagement_id', confirmedEngId)
        .maybeSingle(),
    ])
    if (engRes.error) console.error('[fetchEngagementCore] engagement fetch error:', JSON.stringify(engRes.error))
    if (displayRes.error) console.error('[fetchEngagementCore] engagement_display fetch error:', JSON.stringify(displayRes.error))
    engHeroSrc         = (engRes.data?.hero_image_src as string | null) ?? null
    engTitle           = (engRes.data?.title          as string | null) ?? null
    resolvedGuestLabel = (displayRes.data?.house_display_name as string | null) ?? null
  }

  const brief = briefResult.data as Record<string, unknown> | null
  const resolvedBrief = brief
    ? {
        ...brief,
        hero_image_src: (brief.hero_image_src as string | null) ?? engHeroSrc,
        brief_title:    (brief.brief_title    as string | null) ?? engTitle,
      }
    : null

  return {
    journey:              tripResult.data ?? null,
    brief:                resolvedBrief,
    house:                houseResult.data ?? null,
    destinations,
    resolved_guest_label: resolvedGuestLabel,
  }
}

// ── Bookings fetch + enrich ───────────────────────────────────────────────────
// Fetches bookings (caller passes the column list it needs), their rooms, and
// the canon-room + hotel lookups. Resolves each room's guest name via the canon
// resolver. Returns the raw enriched pieces; each EF composes its own image /
// display shape from the maps (confirmation = per-room resolved_image_src +
// hotel hero; programme = per-booking displayImg chain).
//
// Rooms already carry resolved_guest_name. roomsByBooking groups them.

export interface EngagementBookingsData {
  bookings:       Array<Record<string, unknown>>
  roomsByBooking: Record<string, Array<Record<string, unknown>>>
  canonRoomById:  Record<string, { image_src: string | null; image_alt: string | null }>
  hotelById:      Record<string, { name: string; hero_image_src: string | null }>
}

// ── Aux booking select — single source ────────────────────────────────────────
// Every EF that reads travel_engagement_aux_bookings uses this exact string.
// engagement_type_id embeds the registry slug + label via FK join.
// booking_type (text) was dropped in S53G — slug is now the canonical type field.

export const AUX_BOOKING_SELECT = [
  'id', 'engagement_id', 'engagement_type_id',
  'travel_engagement_types!travel_engagement_aux_bookings_engagement_type_id_fkey(slug, label)',
  'name', 'start_date', 'start_time', 'end_date', 'end_time',
  'origin', 'destination', 'notes', 'confirmation_number', 'booked_by',
  'guest_name', 'guest_count',
  'contact_name', 'contact_phone',
  'dining_status', 'cancellation_penalty_applied', 'cancellation_note', 'show_cancellation',
  'brief_show', 'sort_order', 'created_at', 'updated_at',
  'flight_number', 'airline_name', 'cabin_class', 'aircraft_type',
  'depart_airport', 'arrive_airport', 'supplier_id', 'dining_venue_id',
].join(', ')

// Flatten the embedded travel_engagement_types join onto an aux booking row.
// Returns element_type (slug) + element_type_label for all consumers.
export function flattenAuxType(a: Record<string, unknown>): Record<string, unknown> {
  const et = a.travel_engagement_types as { slug: string; label: string } | { slug: string; label: string }[] | null
  const etObj = Array.isArray(et) ? et[0] : et
  return {
    ...a,
    element_type:       etObj?.slug  ?? null,
    element_type_label: etObj?.label ?? null,
  }
}

// ── Element read: node+detail -> flat aux shape ───────────────────────────────
// Stage 7 Phase 2. travel_engagement_aux_bookings was normalized into a typed tree
// (NODE on travel_engagements + 1:1 transport/dining detail). This produces the
// SAME flat shape AUX_BOOKING_SELECT + flattenAuxType did, read from the tree, so
// consumers are unchanged. Separate-fetch pattern (matches fetchEngagementBookings below).
// Registry FKs are reversed to free-text on read so the flat shape matches legacy aux.
// parentEngId = the journey's confirmed engagement (already resolved by fetchEngagementCore
// as confirmed_engagement_id — pass it in, do not re-fetch).

const NODE_COL_TO_FLAT: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_FIELD_MAP).map(([flat, col]) => [col, flat]),
)

export async function fetchEngagementElements(
  db: SupabaseClient,
  parentEngId: string | null,
): Promise<Array<Record<string, unknown>>> {
  if (!parentEngId) return []

  const { data: nodes } = await db
    .from('travel_engagements')
    .select('id, parent_engagement_id, engagement_type_id, title, activity_date, activity_end_date, activity_start_time, activity_end_time, confirmation_number, brief_show, cancellation_penalty_applied, show_cancellation, sort_order, created_at, updated_at, travel_engagement_types(slug, label)')
    .eq('parent_engagement_id', parentEngId)
    .eq('iteration_label', 'element')
    .order('activity_date', { ascending: true, nullsFirst: false })
    .order('activity_start_time', { ascending: true, nullsFirst: false })
  const nodeRows = (nodes ?? []) as Array<Record<string, unknown>>
  if (nodeRows.length === 0) return []

  const ids = nodeRows.map(n => n.id as string)
  const [tRes, dRes, cabinRes, acRes, apRes] = await Promise.all([
    db.from('travel_engagement_transport_detail')
      .select('node_id, depart_airport_id, arrive_airport_id, aircraft_type_id, cabin_class_id, supplier_id, airline_name, flight_number, origin, destination, notes, booked_by')
      .in('node_id', ids),
    db.from('travel_engagement_dining_detail')
      .select('node_id, dining_venue_id, guest_name, guest_count, dining_status, contact_name, contact_phone, cancellation_note, booking_terms_override, notes, booked_by')
      .in('node_id', ids),
    db.from('travel_cabin_classes').select('id, label'),
    db.from('travel_aircraft_types').select('id, label'),
    db.from('travel_airports').select('id, iata'),
  ])
  const tById = new Map(((tRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.node_id as string, r]))
  const dById = new Map(((dRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.node_id as string, r]))
  const cabinById    = new Map(((cabinRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.label as string]))
  const aircraftById = new Map(((acRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.label as string]))
  const airportById  = new Map(((apRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.iata as string]))

  return nodeRows.map(n => {
    const et = n.travel_engagement_types as { slug: string; label: string } | { slug: string; label: string }[] | null
    const etObj = Array.isArray(et) ? et[0] : et
    const t = tById.get(n.id as string)
    const d = dById.get(n.id as string)

    const flat: Record<string, unknown> = {
      id:                 n.id,
      engagement_id:      n.parent_engagement_id,
      element_type:       etObj?.slug  ?? null,
      element_type_label: etObj?.label ?? null,
      created_at:            n.created_at,
      updated_at:            n.updated_at,
    }
    for (const [col, flatName] of Object.entries(NODE_COL_TO_FLAT)) flat[flatName] = n[col] ?? null

    const detail = t ?? d ?? {}
    for (const [k, v] of Object.entries(detail)) { if (k !== 'node_id') flat[k] = v ?? null }

    flat.cabin_class    = null
    flat.aircraft_type  = null
    flat.depart_airport = null
    flat.arrive_airport = null
    if (t) {
      flat.cabin_class    = t.cabin_class_id    ? cabinById.get(t.cabin_class_id as string)      ?? null : null
      flat.aircraft_type  = t.aircraft_type_id  ? aircraftById.get(t.aircraft_type_id as string) ?? null : null
      flat.depart_airport = t.depart_airport_id ? airportById.get(t.depart_airport_id as string) ?? null : null
      flat.arrive_airport = t.arrive_airport_id ? airportById.get(t.arrive_airport_id as string) ?? null : null
    }
    return flat
  })
}

export async function fetchEngagementBookings(
  db: SupabaseClient,
  bookings: Array<Record<string, unknown>>,
  partyLabel: string | null,
  houseId: string,
): Promise<EngagementBookingsData> {
  const bookingIds = bookings.map(b => b.id as string)

  // Rooms for all bookings. Select the superset of columns both EFs read;
  // additional_guests is confirmation-only but harmless to programme.
  const roomsResult = bookingIds.length > 0
    ? await db.from('travel_booking_rooms')
        .select('id, booking_id, room_id, person_id, room_name, confirmation_number, guest_name, party_composition, notes, nights, brief_image_src, additional_guests, check_in_time, bedding_type, sort_order, created_at, updated_at')
        .in('booking_id', bookingIds)
        .order('sort_order', { ascending: true })
    : { data: [], error: null }
  if (roomsResult.error) console.error('[fetchEngagementBookings] rooms fetch error:', JSON.stringify(roomsResult.error))
  const rooms = (roomsResult.data ?? []) as Array<Record<string, unknown>>

  // Canon rooms (image_src + alt) via room_id.
  const roomIds = [...new Set(rooms.map(r => r.room_id).filter(Boolean))] as string[]
  const canonRoomById: Record<string, { image_src: string | null; image_alt: string | null }> = {}
  if (roomIds.length > 0) {
    const { data: canonRooms } = await db
      .from('travel_accom_rooms')
      .select('id, room_image_src, room_image_alt')
      .in('id', roomIds)
    for (const r of (canonRooms ?? []) as Array<Record<string, unknown>>) {
      canonRoomById[r.id as string] = {
        image_src: (r.room_image_src as string | null) ?? null,
        image_alt: (r.room_image_alt as string | null) ?? null,
      }
    }
  }

  // Canon hotels (name + hero) via accom_hotel_id — one source (_shared/bookings.ts).
  const hotelIds = [...new Set(bookings.map(b => b.accom_hotel_id).filter(Boolean))] as string[]
  const hotelById = await fetchHotelsByIds(db, hotelIds)

  // Resolve room guest people (batch) and group rooms by booking with
  // resolved_guest_name + resolved_additional_guests attached. The id set spans
  // BOTH the lead person_id and every additional_guests uuid, so one query
  // resolves all room occupants (lead + additional) — single source.
  const roomPersonIds = [...new Set([
    ...rooms.map(r => r.person_id).filter(Boolean),
    ...rooms.flatMap(r => (r.additional_guests as string[] | null) ?? []),
  ])] as string[]
  const roomPeopleById: Record<string, Record<string, unknown>> = {}
  if (roomPersonIds.length > 0) {
    const { data: rp } = await db
      .rpc('get_people_display_names', { p_person_ids: roomPersonIds })
    for (const g of (rp ?? []) as Array<Record<string, unknown>>) roomPeopleById[g.id as string] = g
  }

  // Room ORDER is DERIVED LIVE from each occupant's house-role rank (single-source:
  // a_house_roles.sort_order). a_house_people.role is FREE TEXT, so resolve in two
  // steps (registry slug->rank, then this house's person->role). Nothing stored on
  // the room; order always reflects the current hierarchy. A room ranks by its
  // HIGHEST occupant (min rank over lead person_id + additional_guests), so a room
  // holding the principal sorts to the top regardless of who shares it.
  const roleRankByPerson: Record<string, number> = {}
  if (roomPersonIds.length > 0) {
    const { data: hpRanks } = await db
      .rpc('get_house_people_role_ranks', { p_house_id: houseId, p_person_ids: roomPersonIds })
    for (const hp of (hpRanks ?? []) as Array<Record<string, unknown>>) {
      if (hp.role_rank != null) roleRankByPerson[hp.person_id as string] = hp.role_rank as number
    }
  }
  const roomRank = (r: Record<string, unknown>): number => {
    const ids = [
      r.person_id as string | null,
      ...((r.additional_guests as string[] | null) ?? []),
    ].filter(Boolean) as string[]
    const ranks = ids.map(id => roleRankByPerson[id]).filter(v => v != null) as number[]
    return ranks.length ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER
  }

  const roomsByBooking: Record<string, Array<Record<string, unknown>>> = {}
  for (const r of rooms) {
    const bid = r.booking_id as string
    const resolved_guest_name = resolvePartyName(
      r.person_id ? roomPeopleById[r.person_id as string] : null,
      r.guest_name as string | null,
      partyLabel,
    )
    const resolved_additional_guests = ((r.additional_guests as string[] | null) ?? [])
      .map(id => formatPersonName(roomPeopleById[id]))
      .filter(Boolean)
    ;(roomsByBooking[bid] ??= []).push({ ...r, resolved_guest_name, resolved_additional_guests })
  }

  // Order rooms within each booking by derived occupant hierarchy (rank asc =
  // highest standing first). Stable tiebreak on stored sort_order then room_name
  // so equal-rank occupants stay deterministic.
  for (const bid of Object.keys(roomsByBooking)) {
    roomsByBooking[bid].sort((a, b) => {
      const ra = roomRank(a), rb = roomRank(b)
      if (ra !== rb) return ra - rb
      const sa = (a.sort_order as number) ?? 0, sb = (b.sort_order as number) ?? 0
      if (sa !== sb) return sa - sb
      return ((a.room_name as string) ?? '').localeCompare((b.room_name as string) ?? '')
    })
  }

  return { bookings, roomsByBooking, canonRoomById, hotelById }
}

// ── Element enrichment — passengers + drivers + dining venue ──────────────────
// Shared by confirmation + programme (was inlined verbatim in both — same select,
// same output shape, a drift risk). Takes flat element rows from fetchEngagementElements,
// attaches passengers/drivers (keyed on the aux id, carried as source_aux_booking_id),
// resolves the dining venue into image_src + nested venue{} facts.
// fetchEngagementElements already produces the flat+typed shape, so no flattenAuxType here.

import { attachPassengers, attachDriverDetails } from './names.ts'

export async function enrichElements(
  db: SupabaseClient,
  elements: Array<Record<string, unknown>>,
  partyLabel: string | null,
): Promise<Array<Record<string, unknown>>> {
  if (elements.length === 0) return []

  // Passengers + drivers now key on node_id; flat rows carry id = node id, so pass
  // them through directly (no aliasing).
  const withPax = await attachDriverDetails(
    db,
    await attachPassengers(db, elements, partyLabel),
  ) as Array<Record<string, unknown>>

  const venueIds = [...new Set(
    withPax.map(a => a.dining_venue_id).filter(Boolean),
  )] as string[]

  const venueById: Record<string, Record<string, unknown>> = {}
  if (venueIds.length > 0) {
    const { data: venues } = await db.from('travel_dining_venues')
      .select('id, image_src, address, maps_url, phone, dress_code, children_policy, table_hold_note, booking_terms')
      .in('id', venueIds)
    for (const d of (venues ?? []) as Array<Record<string, unknown>>) venueById[d.id as string] = d
  }

  return withPax.map(a => {
    const v = a.dining_venue_id ? venueById[a.dining_venue_id as string] : null
    return {
      ...a,
      image_src: (v?.image_src as string | null) ?? null,
      venue: v ? {
        address:         (v.address as string | null) ?? null,
        maps_url:        (v.maps_url as string | null) ?? null,
        phone:           (v.phone as string | null) ?? null,
        dress_code:      (v.dress_code as string | null) ?? null,
        children_policy: (v.children_policy as string | null) ?? null,
        table_hold_note: (v.table_hold_note as string | null) ?? null,
        booking_terms:   (v.booking_terms as string | null) ?? null,
      } : null,
    }
  })
}

// ── Single element by node id, flat shape ─────────────────────────────────────
// Used by the write path (travel-write-journey) to return the created/updated
// element in the SAME flat shape the readers use — one source of truth for the
// shape (the flatten below), no duplication in the write RPC. Reuses the exact
// per-node flatten as fetchEngagementElements.
export async function fetchEngagementElement(
  db: SupabaseClient,
  nodeId: string,
): Promise<Record<string, unknown> | null> {
  const { data: nodes } = await db
    .from('travel_engagements')
    .select('id, parent_engagement_id, engagement_type_id, title, activity_date, activity_end_date, activity_start_time, activity_end_time, confirmation_number, brief_show, cancellation_penalty_applied, show_cancellation, sort_order, created_at, updated_at, travel_engagement_types(slug, label)')
    .eq('id', nodeId)
    .maybeSingle()
  if (!nodes) return null
  const n = nodes as Record<string, unknown>

  const [tRes, dRes, cabinRes, acRes, apRes] = await Promise.all([
    db.from('travel_engagement_transport_detail').select('node_id, depart_airport_id, arrive_airport_id, aircraft_type_id, cabin_class_id, supplier_id, airline_name, flight_number, origin, destination, notes, booked_by').eq('node_id', nodeId).maybeSingle(),
    db.from('travel_engagement_dining_detail').select('node_id, dining_venue_id, guest_name, guest_count, dining_status, contact_name, contact_phone, cancellation_note, booking_terms_override, notes, booked_by').eq('node_id', nodeId).maybeSingle(),
    db.from('travel_cabin_classes').select('id, label'),
    db.from('travel_aircraft_types').select('id, label'),
    db.from('travel_airports').select('id, iata'),
  ])
  const t = tRes.data as Record<string, unknown> | null
  const d = dRes.data as Record<string, unknown> | null
  const cabinById    = new Map(((cabinRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.label as string]))
  const aircraftById = new Map(((acRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.label as string]))
  const airportById  = new Map(((apRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.iata as string]))

  const et = n.travel_engagement_types as { slug: string; label: string } | { slug: string; label: string }[] | null
  const etObj = Array.isArray(et) ? et[0] : et

  const flat: Record<string, unknown> = {
    id:                 n.id,
    engagement_id:      n.parent_engagement_id,
    element_type:       etObj?.slug  ?? null,
    element_type_label: etObj?.label ?? null,
    created_at:         n.created_at,
    updated_at:         n.updated_at,
  }
  for (const [col, flatName] of Object.entries(NODE_COL_TO_FLAT)) flat[flatName] = n[col] ?? null

  const detail = t ?? d ?? {}
  for (const [k, v] of Object.entries(detail)) { if (k !== 'node_id') flat[k] = v ?? null }

  flat.cabin_class    = null
  flat.aircraft_type  = null
  flat.depart_airport = null
  flat.arrive_airport = null
  if (t) {
    flat.cabin_class    = t.cabin_class_id    ? cabinById.get(t.cabin_class_id as string)      ?? null : null
    flat.aircraft_type  = t.aircraft_type_id  ? aircraftById.get(t.aircraft_type_id as string) ?? null : null
    flat.depart_airport = t.depart_airport_id ? airportById.get(t.depart_airport_id as string) ?? null : null
    flat.arrive_airport = t.arrive_airport_id ? airportById.get(t.arrive_airport_id as string) ?? null : null
  }
  return flat
}