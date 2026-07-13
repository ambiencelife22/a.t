// supabase/functions/travel-read-journey-admin/index.ts
//
// Edge Function: travel-read-journey-admin
// Consolidates all admin read paths for trip data into a single
// mode-keyed dispatcher.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - All target tables have no direct anon/client read policy for this data
//   - This function uses the service role key to bypass RLS
//   - Never called with the anon key
//
// Request body:
//   { mode: Mode, ...modeParams }
//
// Modes:
//   dossier      { house_id: string }
//   brief        { journey_id: string }
//   rooms        { booking_id: string }
//   days         { journey_id: string }
//   day_entries  { journey_id: string }
//   aux_bookings { journey_id: string }
//   public_view  { journey_id: string }
//
// Response (200):
//   mode-specific payload (see each handler)
//
// Response (400): { error: 'Invalid request' }
// Response (401): { error: 'Unauthorized' }
// Response (403): { error: 'Forbidden' }
// Response (500): { error: 'Internal server error' }
//
// Deployed at: /functions/v1/travel-read-journey-admin
// Created: S52

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'
import { buildDays } from '../_shared/days.ts'
import { deriveElementStatus, type ChildStatus } from '../_shared/elementStatus.ts'
import { resolveRoomGuestName, resolvePartyName, formatPersonName } from '../_shared/names.ts'
import { fetchEngagementElements } from '../_shared/engagement.ts'
import { fetchHotelsByIds } from '../_shared/bookings.ts'


type Mode =
  | 'dossier'
  | 'brief'
  | 'rooms'
  | 'days'
  | 'welcome_letters'
  | 'day_entries'
  | 'aux_bookings'
  | 'public_view'
  | 'calendar'
  | 'activity_detail'
  | 'aux_driver_details'
  | 'requests'
  | 'house_id_for_trip'
  | 'programme_guests'
  | 'programme_guest_search'

// ── Response helpers (local sugar over the shared json) ───────────────────────
// ok/err keep their existing call signatures across all handlers; they now route
// through _shared/http.ts json() so the response shape + CORS headers are canonical.
// err synthesizes the { error } envelope and takes (message, status); json takes
// (body, status) — the envelope is the only difference, preserved here.

function ok(payload: unknown): Response {
  return json(payload, 200)
}

function err(message: string, status: number): Response {
  return json({ error: message }, status)
}

// ── Mode handlers ─────────────────────────────────────────────────────────────

async function handleDossier(db: SupabaseClient, houseId: string): Promise<Response> {
  // 1. Trip IDs via bookings
  const { data: bookTripData, error: bookTripErr } = await db
    .from('travel_bookings')
    .select('journey_id')
    .eq('house_id', houseId)
    .not('journey_id', 'is', null)

  if (bookTripErr) return err('Failed to fetch bookings', 500)
  const bookTripRows = (bookTripData ?? []) as { journey_id: string }[]
  if (bookTripRows.length === 0) return ok({ trips: [], partners: {}, house: null })

  const journeyIds = [...new Set(bookTripRows.map(r => r.journey_id))]

  // 2. Trips
  const { data: tripData, error: tripErr } = await db
    .from('travel_journey')
    .select('id, journey_code, confirmed_engagement_id, start_date, end_date, duration_nights, journey_type, guest_count_adults, guest_count_children')
    .in('id', journeyIds)
    .order('start_date', { ascending: false })

  if (tripErr) return err('Failed to fetch trips', 500)
  const tripRows = (tripData ?? []) as Record<string, unknown>[]
  if (tripRows.length === 0) return ok({ trips: [], partners: {}, house: null })

// Resolve each trip's winning-engagement status slug (S53G+: trip status is
// DERIVED from confirmed_engagement_id, not the dropped status column). EF
// returns the slug; the app computes stage via computeEngagementStage.
const winnerEngIds = [...new Set(
  tripRows
    .map(t => t.confirmed_engagement_id as string | null)
    .filter((id): id is string => !!id)
)]
const engStatusSlugByEngId = new Map<string, string>()
if (winnerEngIds.length > 0) {
  const { data: engStatusRows } = await db
    .from('travel_engagements')
    .select('id, travel_lifecycle_statuses(slug)')
    .in('id', winnerEngIds)
  for (const e of (engStatusRows ?? []) as Array<{ id: string; travel_lifecycle_statuses: { slug: string } | { slug: string }[] | null }>) {
    const s = Array.isArray(e.travel_lifecycle_statuses) ? e.travel_lifecycle_statuses[0] : e.travel_lifecycle_statuses
    if (s?.slug) engStatusSlugByEngId.set(e.id, s.slug)
  }
}
for (const t of tripRows) {
  const engId = t.confirmed_engagement_id as string | null
  ;(t as Record<string, unknown>).derived_status_slug =
    engId ? (engStatusSlugByEngId.get(engId) ?? null) : null
}

  // 3. Bookings
  const { data: bookData, error: bookErr } = await db
    .from('travel_bookings')
    .select('id, journey_id, house_id, engagement_id, name, status, confirmation_number, start_date, check_in_date, start_time, check_in_note, check_out_note, end_date, nights, commissionable_rate, total_rate, taxes_and_fees, currency, rate_type, inclusions, price, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, party_composition, primary_contact_name, primary_contact_role, supplier_contact_name, supplier_contact_whatsapp, brief_category, brief_show, brief_image_src, booked_by, cancellation_policy, booking_policy, notes, sort_order, created_at, updated_at')
    .eq('house_id', houseId)
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('end_date',   { ascending: true, nullsFirst: false })
    .order('id',         { ascending: true })

  if (bookErr) return err('Failed to fetch booking details', 500)
  const bookingRows = (bookData ?? []) as Record<string, unknown>[]

  // 4. Hotels
  const hotelIds = [...new Set(
    bookingRows
      .map(b => b.accom_hotel_id as string | null)
      .filter((id): id is string => !!id)
  )]
  const hotelMap = await fetchHotelsByIds(db, hotelIds)

  const bookingIds = bookingRows.map(b => b.id as string)

  // 5. Parallel fetches
  const [partnerResult, houseResult, briefResult, roomResult, destResult, engResult] = await Promise.all([
    db.from('travel_partners')
      .select('id, name, partner_type, default_share_pct, currency, is_active'),
    db.from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),
    db.from('travel_journey_briefs')
      .select('*')
      .in('journey_id', journeyIds),
    bookingIds.length > 0
      ? db.from('travel_booking_rooms')
          .select('*')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db.from('travel_journey_destinations')
      .select('id, engagement_id:journey_id, destination_id, sort_order, global_destinations!travel_journey_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
      .in('journey_id', journeyIds)
      .order('sort_order', { ascending: true }),
    db.from('travel_engagements')
      .select('journey_id, url_id, hero_image_src, title')
      .in('journey_id', journeyIds)
      .not('journey_id', 'is', null),
  ])

  if (partnerResult.error) return err('Failed to fetch partners', 500)

  // Resolve room occupants (lead person_id + additional_guests uuids) → names at
  // the source, so every dossier consumer (brief preview, brief PDF) shows real
  // names, never raw uuids. Same resolver shape as _shared/engagement.ts and
  // activity_detail — one resolution truth across all three read paths. Party
  // label is per-trip (brief.prepared_for); the dossier spans trips, so lead
  // resolution here is person → guest_name override (party-label fallback is
  // applied where trip context is singular). Additional guests are always people.
  const dossierRooms = (roomResult.data ?? []) as Array<Record<string, unknown>>
  const dossierPeopleById = await resolvePeopleByIds(
    db, [...new Set([
      ...dossierRooms.map(r => r.person_id).filter(Boolean),
      ...dossierRooms.flatMap(r => (r.additional_guests as string[] | null) ?? []),
    ])] as string[],
  )
  const resolvedRooms = dossierRooms.map(r => ({
    ...r,
    resolved_guest_name: resolvePartyName(
      r.person_id ? dossierPeopleById[r.person_id as string] : null,
      r.guest_name as string | null,
      null,
    ),
    resolved_additional_guests: ((r.additional_guests as string[] | null) ?? [])
      .map(id => formatPersonName(dossierPeopleById[id]))
      .filter(Boolean),
  }))

  // Engagement hero + title are canon. brief overlay only (null = fall through).
  const engByTrip = new Map<string, { hero_image_src: string | null; title: string | null }>()
  for (const e of (engResult.data ?? []) as Array<{ journey_id: string; hero_image_src: string | null; title: string | null }>) {
    if (!engByTrip.has(e.journey_id)) engByTrip.set(e.journey_id, { hero_image_src: e.hero_image_src, title: e.title })
  }
  const briefs = ((briefResult.data ?? []) as Array<Record<string, unknown>>).map(b => ({
    ...b,
    hero_image_src: (b.hero_image_src as string | null) ?? engByTrip.get(b.journey_id as string)?.hero_image_src ?? null,
    brief_title:    (b.brief_title    as string | null) ?? engByTrip.get(b.journey_id as string)?.title           ?? null,
  }))

  return ok({
    bookingRows,
    hotelMap,
    tripRows,
    partners:  partnerResult.data ?? [],
    house:     houseResult.data ?? null,
    briefs,
    rooms:     resolvedRooms,
    dests:     destResult.data  ?? [],
    engagements: engResult.data ?? [],
  })
}

async function handleBrief(db: SupabaseClient, journeyId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_journey_briefs')
    .select('*')
    .eq('journey_id', journeyId)
    .maybeSingle()
  if (error) return err('Failed to fetch brief', 500)
  return ok({ brief: data ?? null })
}

async function handleRooms(db: SupabaseClient, bookingId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_booking_rooms')
    .select('*')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch rooms', 500)
  return ok({ rooms: data ?? [] })
}

async function handleAuxDriverDetails(db: SupabaseClient, nodeId: string): Promise<Response> {
  // nodeId is the element node id (frontend sends it directly; Stage 7 Phase 2 retire).
  const { data, error } = await db
    .from('travel_aux_driver_details')
    .select('id, node_id, driver_name, driver_phone, car_model, plate, company, vehicle_role, sort_order')
    .eq('node_id', nodeId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch driver details', 500)
  return ok({ driverDetails: data ?? [] })
}

// ── Programme guests (admin link surface) ─────────────────────────────────────
// Lists guests linked to a programme. Guest identity is a global_people person
// reached via global_profiles: travel_programme_guests.profile_id holds the guest's
// global_profiles.id (the auth user id the guest-facing RLS compares to auth.uid()).
// Admin-side via service role, we resolve that profile back to its person for a
// canonical name, falling back to the stored display_name.
async function handleProgrammeGuests(db: SupabaseClient, programmeId: string): Promise<Response> {
  const { data: guests, error } = await db
    .from('travel_programme_guests')
    .select('id, programme_id, display_name, profile_id, is_lead, sort_order')
    .eq('programme_id', programmeId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch programme guests', 500)

  const rows = (guests ?? []) as Array<Record<string, unknown>>

  // Resolve each linked profile -> person -> canonical name. One batch.
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
    id:           r.id,
    programme_id: r.programme_id,
    display_name: r.display_name,
    profile_id:   r.profile_id,
    is_lead:      r.is_lead,
    sort_order:   r.sort_order,
    resolved_name: r.profile_id ? (personNameByProfileId[r.profile_id as string] ?? null) : null,
  }))

  return ok({ guests: guestsOut })
}

// Search people to link as a programme guest. Source is global_people (the one
// canonical picker — NOT the dropped travel_clients table). Each result carries the
// resolved global_profiles.id (or null) so the UI shows whether the person is linkable
// (has a login account) before the operator commits. A person with no profile is shown
// but not linkable — surfaced honestly, never written as a dead link.
async function handleProgrammeGuestSearch(db: SupabaseClient, query: string): Promise<Response> {
  const trimmed = (query ?? '').trim()
  if (trimmed.length < 2) return ok({ results: [] })

  const { data: people, error } = await db
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%`)
    .order('first_name', { ascending: true })
    .limit(10)
  if (error) return err('Failed to search people', 500)

  const peopleRows = (people ?? []) as Array<Record<string, unknown>>
  const personIds = peopleRows.map(p => p.id as string)

  // Resolve each person -> their single global_profiles.id (cardinality verified
  // one-person-one-profile). Person with no profile -> not linkable.
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

  return ok({ results })
}

async function handleDays(db: SupabaseClient, journeyId: string): Promise<Response> {
  // Days are DERIVED from trip span; travel_journey_days is overlay-only.
  const [{ data: trip, error: tripErr }, { data: overlay, error: ovErr }] = await Promise.all([
    db.from('travel_journey').select('start_date, end_date').eq('id', journeyId).maybeSingle(),
    db.from('travel_journey_days').select('id, engagement_id:journey_id, entry_date, show, day_label, day_note').eq('journey_id', journeyId),
  ])
  if (tripErr || ovErr) return err('Failed to fetch days', 500)
  const days = buildDays(
    journeyId,
    (trip?.start_date as string | null) ?? null,
    (trip?.end_date as string | null) ?? null,
    (overlay ?? []) as Record<string, unknown>[],
  )
  return ok({ days })  // admin gets ALL days incl hidden (for show toggle)
}

async function handleWelcomeLetters(db: SupabaseClient, journeyId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_journey_welcome_letters')
    .select('*')
    .eq('journey_id', journeyId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch welcome letters', 500)
  return ok({ letters: data ?? [] })
}

async function handleDayEntries(db: SupabaseClient, journeyId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_journey_day_entries')
    .select('*')
    .eq('journey_id', journeyId)
    .order('entry_date', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch day entries', 500)
  return ok({ dayEntries: data ?? [] })
}

async function handleAuxBookings(db: SupabaseClient, journeyId: string): Promise<Response> {
  // Stage 7 Phase 2: read elements from the tree (node+detail) via fetchEngagementElements,
  // flattened to the legacy aux shape. Parent = journey.confirmed_engagement_id.
  const { data: j, error: jErr } = await db
    .from('travel_journey')
    .select('confirmed_engagement_id')
    .eq('id', journeyId)
    .maybeSingle()
  if (jErr) return err('Failed to resolve journey', 500)
  const aux = await fetchEngagementElements(db, (j?.confirmed_engagement_id as string | null) ?? null)
  if (aux.length === 0) return ok({ elements: [] })
  // Passengers key on node_id; flat rows carry id = node id (Stage 7 Phase 2 retire).
  const nodeIds = aux.map(a => a.id as string).filter(Boolean)
  const { data: pax } = await db
    .from('travel_engagement_aux_passengers')
    .select('id, node_id, person_id, passenger_label, confirmation_number, seat_numbers, sort_order')
    .in('node_id', nodeIds)
    .order('sort_order', { ascending: true })
  const byNode: Record<string, unknown[]> = {}
  for (const p of (pax ?? []) as Record<string, unknown>[]) {
    const k = p.node_id as string
    ;(byNode[k] ??= []).push(p)
  }
  const withPax = aux.map(a => ({ ...a, passengers: byNode[a.id as string] ?? [] }))
  return ok({ elements: withPax })
}

async function handlePublicView(db: SupabaseClient, journeyId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_engagements')
    .select('public_view')
    .eq('id', journeyId)
    .single()
  if (error || !data) return ok({ publicView: false })
  return ok({ publicView: !!(data as { public_view: boolean }).public_view })
}

// ── Calendar (fleet-wide; full pipeline) ──────────────────────────────────────
// Single source for the admin Calendar tab. Returns all confirmed-stage trips +
// near-term pending trips, with their per-hotel bookings (stays) + hotel names,
// derived from the same canonical tables the dossier uses — NOT a parallel store.
// The calendar owns no dates; it renders these.
//
// Visibility is DECLARED, not inferred (see calendarTripState for the per-trip state):
//   - confirmed-band (confirmed | paid | in_service | closed_won): ALWAYS shown,
//     any date — past completed trips stay visible (a yesterday check-out must not
//     vanish). end_date<today derives the 'completed' state, it does NOT exclude.
//   - pending-band (requested | quoted | pending): shown only within a near-term
//     window (PENDING_LOOKAHEAD_DAYS) — far-future maybes are noise, not ops data.
//   - excluded: cancelled / closed_lost (dead). Archive-only removal is the eventual
//     model (archive state TBD — pairs with the booking-state arc).
//
// Params: { range_start?: string (YYYY-MM-DD), range_end?: string }
// When a range is passed (view paging), trips are filtered to those overlapping the
// window. With no range (default load), ALL qualifying trips return — nothing is
// floored out by date.

// Lifecycle slugs the calendar surfaces. Confirmed-band = always visible (any date,
// past completed trips included). Pending-band = securing stages, visible only within
// a near-term window (far-future maybes are noise, not ops data). closed_won counts as
// confirmed-band (a won deal is real). Derivation of the per-trip display state lives
// in calendarTripState().
const CALENDAR_CONFIRMED_SLUGS = ['confirmed', 'paid', 'in_service', 'closed_won'] as const
const CALENDAR_PENDING_SLUGS   = ['requested', 'quoted', 'pending'] as const
const PENDING_LOOKAHEAD_DAYS   = 120  // pending trips show if starting within ~4 months

// Per-trip display state for the calendar bar. Single source for the color axis.
//   completed — service is over (end_date < today; reads completed_at once that lands)
//   confirmed — secured (confirmed/paid/in_service/closed_won)
//   pending   — still securing (requested/quoted/pending), near-term only
// Returns null = don't show (pending too far out, or unknown slug).
function calendarTripState(
  slug: string | null,
  endDate: string | null,
  startDate: string | null,
  today: string,
  horizon: string,
): 'completed' | 'confirmed' | 'pending' | null {
  if (!slug) return null
  const confirmed = (CALENDAR_CONFIRMED_SLUGS as readonly string[]).includes(slug)
  const pending   = (CALENDAR_PENDING_SLUGS   as readonly string[]).includes(slug)
  if (confirmed) {
    if (endDate && endDate < today) return 'completed'
    return 'confirmed'
  }
  if (pending) {
    // Near-term only: starts before the horizon AND hasn't already fully ended.
    if (startDate && startDate > horizon) return null
    if (endDate && endDate < today) return null
    return 'pending'
  }
  return null
}

async function handleCalendar(
  db: SupabaseClient,
  rangeStart: string | null,
  rangeEnd: string | null,
): Promise<Response> {

  // 1. Trips with a confirmed engagement, ending on/after the range start.
  //    (A trip with no confirmed_engagement_id is pre-commitment — not shown.)
  // Show ALL confirmed-stage trips — past (completed) ones stay visible; only an
  // explicit archive removes a trip (archive state TBD — booking-state arc). When a
  // range is given (view window), filter to trips overlapping it: end >= range_start
  // AND start <= range_end. With no range (default load), return everything confirmed
  // so recently-completed trips like a yesterday check-out never silently vanish.
  let tripQ = db
    .from('travel_journey')
    .select('id, journey_code, public_title, start_date, end_date, confirmed_engagement_id, primary_client_id')
    .not('confirmed_engagement_id', 'is', null)
  if (rangeStart) tripQ = tripQ.gte('end_date', rangeStart)
  if (rangeEnd)   tripQ = tripQ.lte('start_date', rangeEnd)

  const { data: tripData, error: tripErr } = await tripQ.order('start_date', { ascending: true })
  if (tripErr) return err('Failed to fetch calendar trips', 500)

  const trips = (tripData ?? []) as Array<{
    id: string; journey_code: string; public_title: string | null
    start_date: string | null; end_date: string | null
    confirmed_engagement_id: string | null; primary_client_id: string | null
  }>
  if (trips.length === 0) return ok({ engagements: [] })

  // 2. Resolve each winning engagement's status slug; keep only confirmed-stage.
  const engIds = [...new Set(trips.map(t => t.confirmed_engagement_id).filter((x): x is string => !!x))]
  const slugByEng = new Map<string, string>()
  // The engagement title is the canonical display name (engagement = the universal
  // spine). public_title is an optional override; when null, the calendar reads the
  // engagement's title — never the bare journey_code if a real name exists upstream.
  const titleByEng = new Map<string, string>()
  if (engIds.length > 0) {
    const { data: engRows, error: engErr } = await db
      .from('travel_engagements')
      .select('id, title, travel_lifecycle_statuses(slug)')
      .in('id', engIds)
    if (engErr) return err('Failed to resolve engagement statuses', 500)
    for (const e of (engRows ?? []) as Array<{ id: string; title: string | null; travel_lifecycle_statuses: { slug: string } | { slug: string }[] | null }>) {
      const s = Array.isArray(e.travel_lifecycle_statuses) ? e.travel_lifecycle_statuses[0] : e.travel_lifecycle_statuses
      if (s?.slug) slugByEng.set(e.id, s.slug)
      if (e.title) titleByEng.set(e.id, e.title)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const horizon = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + PENDING_LOOKAHEAD_DAYS); return d.toISOString().slice(0, 10) })()
  // Attach the derived display state; keep only trips that earn a place on the board.
  const stateByTrip = new Map<string, 'completed' | 'confirmed' | 'pending'>()
  const confirmedTrips = trips.filter(t => {
    const slug = t.confirmed_engagement_id ? (slugByEng.get(t.confirmed_engagement_id) ?? null) : null
    const state = calendarTripState(slug, t.end_date, t.start_date, today, horizon)
    if (!state) return false
    stateByTrip.set(t.id, state)
    return true
  })
  if (confirmedTrips.length === 0) return ok({ engagements: [] })

  const journeyIds = confirmedTrips.map(t => t.id)

  // 3. Bookings (stays) for those trips — start_date/end_date are check-in/out.
  const { data: bookData, error: bookErr } = await db
    .from('travel_bookings')
    .select('id, journey_id, name, status, start_date, end_date, accom_hotel_id, confirmation_number')
    .in('journey_id', journeyIds)
    .order('start_date', { ascending: true, nullsFirst: false })
  if (bookErr) return err('Failed to fetch calendar bookings', 500)
  const bookings = (bookData ?? []) as Array<{
    id: string; journey_id: string; name: string | null; status: string | null
    booking_type: string | null; start_date: string | null; end_date: string | null
    accom_hotel_id: string | null; confirmation_number: string | null
  }>

  // 3a. Lifecycle status registry — resolve status_id -> {slug,label,sort_order}.
  // Fetched once; the single source for resolving any element's status in this EF.
  const statusById = new Map<string, ChildStatus>()
  {
    const { data: regData, error: regErr } = await db
      .from('travel_lifecycle_statuses')
      .select('id, slug, label, sort_order')
    if (regErr) return err('Failed to fetch lifecycle statuses', 500)
    for (const s of (regData ?? []) as Array<{ id: string; slug: string; label: string; sort_order: number }>) {
      statusById.set(s.id, { slug: s.slug, label: s.label, sort_order: s.sort_order })
    }
  }

  // 3b. Per-booking room statuses — the children the rollup derives from.
  const calBookingIds = bookings.map(b => b.id)
  const roomsByBookingId = new Map<string, ChildStatus[]>()
  if (calBookingIds.length > 0) {
    const { data: roomData, error: roomErr } = await db
      .from('travel_booking_rooms')
      .select('booking_id, status_id')
      .in('booking_id', calBookingIds)
    if (roomErr) return err('Failed to fetch calendar rooms', 500)
    for (const r of (roomData ?? []) as Array<{ booking_id: string; status_id: string | null }>) {
      const cs = r.status_id ? statusById.get(r.status_id) : undefined
      if (!cs) continue  // a room with no resolvable status contributes nothing to the rollup
      ;(roomsByBookingId.get(r.booking_id) ?? roomsByBookingId.set(r.booking_id, []).get(r.booking_id)!).push(cs)
    }
  }

  // 4. Hotel names for accom bookings.
  const hotelIds = [...new Set(bookings.map(b => b.accom_hotel_id).filter((x): x is string => !!x))]
  const hotelMapCal = await fetchHotelsByIds(db, hotelIds)
  const hotelName = new Map<string, string>()
  for (const [id, h] of Object.entries(hotelMapCal)) hotelName.set(id, h.name)

  // 4b. Activities (typed child engagements) — the engagement-spine read. Stay +
  //     Transport children today; dining/experience/etc. flow through automatically
  //     as created (category = registry slug, never hardcoded). Fetched independently
  //     of trip span so out-of-span activities survive (e.g. a return flight the day
  //     after end_date).
  const activitiesByJourney = new Map<string, Array<Record<string, unknown>>>()
  // Element nodes hang off the confirmed ENGAGEMENT id (parent_engagement_id),
  // not the journey id. Resolve journeyId -> confirmed_engagement_id to filter the
  // activity read, then map results back to journey id (the calendar's grouping key).
  const journeyByEngagement = new Map<string, string>()
  if (journeyIds.length > 0) {
    const { data: jrows } = await db
      .from('travel_journey')
      .select('id, confirmed_engagement_id')
      .in('id', journeyIds)
    for (const j of (jrows ?? []) as Array<Record<string, unknown>>) {
      if (j.confirmed_engagement_id) journeyByEngagement.set(j.confirmed_engagement_id as string, j.id as string)
    }
  }
  const engagementIds = [...journeyByEngagement.keys()]
  if (engagementIds.length > 0) {
    const { data: actData, error: actErr } = await db
      .from('travel_engagements')
      .select('id, parent_engagement_id, title, activity_date, activity_end_date, activity_start_time, activity_end_time, source_booking_id, travel_engagement_types!travel_engagements_engagement_type_id_fkey(slug, label)')
      .in('parent_engagement_id', engagementIds)
      .not('activity_date', 'is', null)
      .order('activity_date', { ascending: true })
    if (actErr) return err('Failed to fetch calendar activities', 500)

    // Enrich movement activities with their transport-detail flight fields + booked_by,
    // sourced from the engagement tree (Stage 7). The activity IS the element node;
    // its transport detail holds route/flight/airline/booked_by. depart/arrive airports
    // are registry FKs reversed to IATA. Keyed by NODE id (not aux). One batch join.
    const nodeIds = (actData ?? []).map(a => a.id as string)
    const auxById = new Map<string, Record<string, unknown>>()
    if (nodeIds.length > 0) {
      const [tRes, apRes] = await Promise.all([
        db.from('travel_engagement_transport_detail')
          .select('node_id, booked_by, origin, destination, depart_airport_id, arrive_airport_id, flight_number, airline_name')
          .in('node_id', nodeIds),
        db.from('travel_airports').select('id, iata'),
      ])
      const airportById = new Map(((apRes.data ?? []) as Array<Record<string, unknown>>).map(r => [r.id as string, r.iata as string]))
      for (const t of (tRes.data ?? []) as Array<Record<string, unknown>>) {
        auxById.set(t.node_id as string, {
          booked_by:      t.booked_by ?? null,
          origin:         t.origin ?? null,
          destination:    t.destination ?? null,
          depart_airport: t.depart_airport_id ? airportById.get(t.depart_airport_id as string) ?? null : null,
          arrive_airport: t.arrive_airport_id ? airportById.get(t.arrive_airport_id as string) ?? null : null,
          flight_number:  t.flight_number ?? null,
          airline_name:   t.airline_name ?? null,
        })
      }
    }

    for (const a of (actData ?? []) as Array<Record<string, unknown>>) {
      const parent = a.parent_engagement_id as string
      const typeRaw = a.travel_engagement_types
      const type = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw
      const aux = auxById.get(a.id as string) ?? null
      ;(activitiesByJourney.get(parent) ?? activitiesByJourney.set(parent, []).get(parent)!).push({
        id:         a.id,
        category:   (type as { slug: string } | null)?.slug ?? null,
        label:      (type as { label: string } | null)?.label ?? null,
        title:      a.title,
        date:       a.activity_date,
        end_date:   a.activity_end_date,
        // Departure time: the aux booking's start_time is the source of record for a
        // movement (the engagement's activity_start_time is null for derived flights).
        // Falls back to the activity's own time for non-aux activities.
        time:       a.activity_start_time,
        source_booking_id:     a.source_booking_id,
        is_element: !a.source_booking_id,
        // Flight detail (movement activities only; null for stays/others)
        booked_by:      (aux?.booked_by as string | null) ?? null,
        origin:         (aux?.origin as string | null) ?? null,
        destination:    (aux?.destination as string | null) ?? null,
        depart_airport: (aux?.depart_airport as string | null) ?? null,
        arrive_airport: (aux?.arrive_airport as string | null) ?? null,
        flight_number:  (aux?.flight_number as string | null) ?? null,
        airline_name:   (aux?.airline_name as string | null) ?? null,
        end_time:       (a.activity_end_time as string | null) ?? null,
      })
    }
  }

  // 5. Shape: trips each carrying their stays (booking + resolved hotel name + slug).
  const byTrip = new Map<string, typeof bookings>()
  for (const b of bookings) (byTrip.get(b.journey_id) ?? byTrip.set(b.journey_id, []).get(b.journey_id)!).push(b)

  const out = confirmedTrips.map(t => ({
    id:            t.id,
    journey_code:     t.journey_code,
    // Engagement title is the source; public_title overrides only when explicitly set.
    title:         t.public_title ?? (t.confirmed_engagement_id ? (titleByEng.get(t.confirmed_engagement_id) ?? null) : null),
    start_date:    t.start_date,
    end_date:      t.end_date,
    status_slug:   t.confirmed_engagement_id ? (slugByEng.get(t.confirmed_engagement_id) ?? null) : null,
    state:         stateByTrip.get(t.id) ?? 'confirmed',   // 'completed' | 'confirmed' | 'pending'
    primary_client_id: t.primary_client_id,
    stays: (byTrip.get(t.id) ?? []).map(b => {
      const stayRooms = roomsByBookingId.get(b.id) ?? []
      // Single canonical rollup over the rooms' statuses. Mapped to the calendar's
      // quiet three-state display contract (elegant-design: an overview shows the
      // coarse honest state; richer per-stage display belongs on detail surfaces).
      const rollup = deriveElementStatus(stayRooms)
      const confirmation =
        rollup.kind === 'confirmed' ? 'confirmed'
        : rollup.kind === 'partial' ? 'partially_confirmed'
        : 'designing'  // 'pending' or 'empty' -> not-yet-confirmed at calendar granularity
      const roomCount = { confirmed: rollup.confirmed, total: rollup.total }
      return {
        id:           b.id,
        name:         b.name,
        status:       b.status,
        check_in:     b.start_date,
        check_out:    b.end_date,
        hotel_id:     b.accom_hotel_id,
        hotel_name:   b.accom_hotel_id ? (hotelName.get(b.accom_hotel_id) ?? null) : null,
        confirmation,                          // 'confirmed' | 'partially_confirmed' | 'designing'
        rooms_confirmed: roomCount.confirmed,
        rooms_total:     roomCount.total,
      }
    }),
    activities: t.confirmed_engagement_id ? (activitiesByJourney.get(t.confirmed_engagement_id) ?? []) : [],
  }))

  return ok({ engagements: out })
}

// ── Activity detail (6C drill-down) ───────────────────────────────────────────
// Fine-print for one itinerary item. Reuses the canonical resolvers in
// _shared/names.ts so "who's in this room / on this flight" is IDENTICAL to the
// client confirmation page — one resolution truth, never a parallel copy.
//   stay (booking_id)     → rooms with resolved guest names + per-room conf
//   transport (aux id)    → passengers with resolved names + seat + conf
// partyLabel (brief.prepared_for) is the trip's single client address, the last
// fallback in resolvePartyName.

async function partyLabelForTrip(db: SupabaseClient, journeyId: string | null): Promise<string | null> {
  if (!journeyId) return null
  const { data } = await db
    .from('travel_journey_briefs')
    .select('prepared_for')
    .eq('journey_id', journeyId)
    .maybeSingle()
  return (data?.prepared_for as string | null) ?? null
}

async function resolvePeopleByIds(
  db: SupabaseClient,
  personIds: string[],
): Promise<Record<string, Record<string, unknown>>> {
  const byId: Record<string, Record<string, unknown>> = {}
  if (personIds.length === 0) return byId
  const { data } = await db
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .in('id', personIds)
  for (const g of (data ?? []) as Array<Record<string, unknown>>) byId[g.id as string] = g
  return byId
}

// Ground-car movement slugs (ENGAGEMENT_TAXONOMY ground-transport group). These
// carry driver vehicles; other aux movements (flight, private_jet) carry passengers.
const GROUND_CAR_SLUGS = new Set(['transfer', 'airport_transfer', 'car_service'])

async function handleActivityDetail(
  db: SupabaseClient,
  bookingId: string | null,
  auxBookingId: string | null,
  category: string | null,
): Promise<Response> {
  if (bookingId) {
    // A stay represents the HOTEL, not one booking. Resolve the anchor booking →
    // its hotel + trip, then gather ALL bookings at that hotel for that trip, and
    // return rooms across all of them. (The anchor is one incidental booking of
    // the hotel group; the stay spans the whole group — mirrors the hotel-keyed
    // child-activity derivation.) Falls back to the single booking if the anchor
    // has no accom_hotel_id (non-hotel stay).
    const { data: bk } = await db
      .from('travel_bookings').select('journey_id, accom_hotel_id').eq('id', bookingId).maybeSingle()
    const journeyId = (bk?.journey_id as string | null) ?? null
    const hotelId = (bk?.accom_hotel_id as string | null) ?? null
    const partyLabel = await partyLabelForTrip(db, journeyId)

    let bookingIdsForStay: string[] = [bookingId]
    if (journeyId && hotelId) {
      const { data: hotelBookings } = await db
        .from('travel_bookings')
        .select('id')
        .eq('engagement_id', journeyId)
        .eq('accom_hotel_id', hotelId)
      const ids = (hotelBookings ?? []).map(b => b.id as string)
      if (ids.length > 0) bookingIdsForStay = ids
    }

    const { data: roomData, error: roomErr } = await db
      .from('travel_booking_rooms')
      .select('id, booking_id, room_name, person_id, guest_name, additional_guests, confirmation_number, party_composition, sort_order')
      .in('booking_id', bookingIdsForStay)
      .order('sort_order', { ascending: true })
    if (roomErr) return err('Failed to fetch rooms', 500)
    const rooms = (roomData ?? []) as Array<Record<string, unknown>>

    const peopleById = await resolvePeopleByIds(
      db, [...new Set([
        ...rooms.map(r => r.person_id).filter(Boolean),
        ...rooms.flatMap(r => (r.additional_guests as string[] | null) ?? []),
      ])] as string[],
    )
    const out = rooms.map(r => ({
      id:                  r.id,
      room_name:           r.room_name,
      guest_name:          resolveRoomGuestName(
                             r.person_id ? peopleById[r.person_id as string] : null,
                             r.guest_name as string | null,
                             partyLabel,
                           ),
      resolved_additional_guests: ((r.additional_guests as string[] | null) ?? [])
                             .map(id => formatPersonName(peopleById[id]))
                             .filter(Boolean),
      confirmation_number: r.confirmation_number,
      party_composition:   r.party_composition,
    }))
    return ok({ kind: 'stay', rooms: out })
  }

  if (auxBookingId) {
    // An aux booking is EITHER a flight/jet (→ passengers) OR a ground-car service
    // (→ driver vehicles). The ENGAGEMENT TYPE SLUG discriminates — canonical, not the
    // fragile display string. category is the registry slug passed from the itinerary row.
    const isGroundCar = category != null && GROUND_CAR_SLUGS.has(category)

    if (isGroundCar) {
      const { data: vehData, error: vehErr } = await db
        .from('travel_aux_driver_details')
        .select('id, node_id, driver_name, driver_phone, car_model, plate, company, vehicle_role, sort_order')
        .eq('node_id', auxBookingId)
        .order('sort_order', { ascending: true })
      if (vehErr) return err('Failed to fetch driver details', 500)
      const vehicles = (vehData ?? []) as Array<Record<string, unknown>>
      // Admin surface returns ALL fields incl company; the CLIENT EFs omit company.
      return ok({ kind: 'ground_transport', vehicles })
    }

    // auxBookingId is now the element node id (frontend sends it directly). Look up
    // the node's parent engagement for the journey -> party label.
    const { data: node } = await db
      .from('travel_engagements').select('id, parent_engagement_id').eq('id', auxBookingId).maybeSingle()
    const { data: jrow } = node?.parent_engagement_id
      ? await db.from('travel_journey').select('id').eq('confirmed_engagement_id', node.parent_engagement_id as string).maybeSingle()
      : { data: null }
    const partyLabel = await partyLabelForTrip(db, (jrow?.id as string | null) ?? null)
    const { data: paxData, error: paxErr } = await db
      .from('travel_engagement_aux_passengers')
      .select('id, node_id, person_id, passenger_label, seat_numbers, confirmation_number, sort_order')
      .eq('node_id', auxBookingId)
      .order('sort_order', { ascending: true })
    if (paxErr) return err('Failed to fetch passengers', 500)
    const pax = (paxData ?? []) as Array<Record<string, unknown>>

    const peopleById = await resolvePeopleByIds(
      db, [...new Set(pax.map(p => p.person_id).filter(Boolean))] as string[],
    )
    const out = pax.map(p => ({
      id:                  p.id,
      passenger_name:      resolvePartyName(
                             p.person_id ? peopleById[p.person_id as string] : null,
                             p.passenger_label as string | null,
                             partyLabel,
                           ),
      seat_numbers:        p.seat_numbers,
      confirmation_number: p.confirmation_number,
    }))
    return ok({ kind: 'transport', passengers: out })
  }

  return err('booking_id or aux_booking_id is required', 400)
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json()
    const { mode, house_id, journey_id, booking_id, node_id, category, range_start, range_end, programme_id, query } = body as {
      mode:           string | undefined
      house_id?:      string
      journey_id?:       string
      booking_id?:    string
      node_id?:       string
      category?:      string
      range_start?:   string
      range_end?:     string
      programme_id?:  string
      query?:         string
    }

    if (!mode) return err('mode is required', 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient } = gate

    switch (mode as Mode) {
      case 'dossier':
        if (!house_id) return err('house_id is required for dossier mode', 400)
        return handleDossier(serviceClient, house_id)

      case 'brief':
        if (!journey_id) return err('journey_id is required for brief mode', 400)
        return handleBrief(serviceClient, journey_id)

      case 'rooms':
        if (!booking_id) return err('booking_id is required for rooms mode', 400)
        return handleRooms(serviceClient, booking_id)

      case 'aux_driver_details':
        if (!node_id) return err('node_id is required for aux_driver_details mode', 400)
        return handleAuxDriverDetails(serviceClient, node_id)

      case 'days':
        if (!journey_id) return err('journey_id is required for days mode', 400)
        return handleDays(serviceClient, journey_id)

      case 'welcome_letters':
        if (!journey_id) return err('journey_id is required for welcome_letters mode', 400)
        return handleWelcomeLetters(serviceClient, journey_id)

      case 'day_entries':
        if (!journey_id) return err('journey_id is required for day_entries mode', 400)
        return handleDayEntries(serviceClient, journey_id)

      case 'aux_bookings':
        if (!journey_id) return err('journey_id is required for aux_bookings mode', 400)
        return handleAuxBookings(serviceClient, journey_id)

      case 'public_view':
        if (!journey_id) return err('journey_id is required for public_view mode', 400)
        return handlePublicView(serviceClient, journey_id)

      case 'calendar':
        return handleCalendar(serviceClient, range_start ?? null, range_end ?? null)

      case 'activity_detail':
        return handleActivityDetail(serviceClient, booking_id ?? null, node_id ?? null, category ?? null)

      case 'house_id_for_trip': {
        if (!journey_id) return err('journey_id is required for house_id_for_trip mode', 400)
        const { data, error } = await serviceClient
          .from('travel_bookings')
          .select('house_id')
          .eq('journey_id', journey_id)
          .not('house_id', 'is', null)
          .limit(1)
          .maybeSingle()
        if (error) return err('Failed to resolve house_id for trip', 500)
        return ok({ houseId: (data as { house_id: string } | null)?.house_id ?? null })
      }

      case 'programme_guests': {
        if (!programme_id) return err('programme_id is required for programme_guests mode', 400)
        return handleProgrammeGuests(serviceClient, programme_id)
      }

      case 'programme_guest_search':
        return handleProgrammeGuestSearch(serviceClient, query ?? '')

      case 'requests': {
        if (!house_id) return err('house_id is required for requests mode', 400)
        const { data, error } = await serviceClient
          .from('travel_requests')
          .select('id, house_id, journey_id, engagement_id, channel, received_at, request_body, status, handled_by, notes, created_at, updated_at')
          .eq('house_id', house_id)
          .order('received_at', { ascending: false })
        if (error) return err('Failed to fetch requests', 500)
        return ok({ requests: data ?? [] })
      }

      default:
        return err(`Unknown mode: ${mode}`, 400)
    }

  } catch (e) {
    console.error('travel-read-journey-admin unexpected error:', e)
    return err('Internal server error', 500)
  }
})