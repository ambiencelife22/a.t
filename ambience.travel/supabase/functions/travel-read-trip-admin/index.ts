// supabase/functions/travel-read-trip-admin/index.ts
//
// Edge Function: travel-read-trip-admin
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
//   brief        { trip_id: string }
//   rooms        { booking_id: string }
//   days         { trip_id: string }
//   day_entries  { trip_id: string }
//   aux_bookings { trip_id: string }
//   public_view  { trip_id: string }
//
// Response (200):
//   mode-specific payload (see each handler)
//
// Response (400): { error: 'Invalid request' }
// Response (401): { error: 'Unauthorized' }
// Response (403): { error: 'Forbidden' }
// Response (500): { error: 'Internal server error' }
//
// Deployed at: /functions/v1/travel-read-trip-admin
// Created: S52

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildDays } from '../_shared/days.ts'
import { deriveConfirmation, roomConfirmationCount } from '../_shared/confirmation.ts'
import { resolveRoomGuestName, resolvePartyName } from '../_shared/names.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function verifyAdminCaller(
  req: Request,
  serviceClient: SupabaseClient,
): Promise<{ userId: string } | Response> {
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

  return { userId: user.id }
}

function ok(payload: unknown): Response {
  return new Response(
    JSON.stringify(payload),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function err(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ── Mode handlers ─────────────────────────────────────────────────────────────

async function handleDossier(db: SupabaseClient, houseId: string): Promise<Response> {
  // 1. Trip IDs via bookings
  const { data: bookTripData, error: bookTripErr } = await db
    .from('travel_bookings')
    .select('trip_id')
    .eq('house_id', houseId)
    .not('trip_id', 'is', null)

  if (bookTripErr) return err('Failed to fetch bookings', 500)
  const bookTripRows = (bookTripData ?? []) as { trip_id: string }[]
  if (bookTripRows.length === 0) return ok({ trips: [], partners: {}, house: null })

  const tripIds = [...new Set(bookTripRows.map(r => r.trip_id))]

  // 2. Trips
  const { data: tripData, error: tripErr } = await db
    .from('travel_trips')
    .select('id, trip_code, confirmed_engagement_id, start_date, end_date, duration_nights, trip_type, guest_count_adults, guest_count_children')
    .in('id', tripIds)
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
    .from('travel_immerse_engagements')
    .select('id, travel_engagement_statuses(slug)')
    .in('id', winnerEngIds)
  for (const e of (engStatusRows ?? []) as Array<{ id: string; travel_engagement_statuses: { slug: string } | { slug: string }[] | null }>) {
    const s = Array.isArray(e.travel_engagement_statuses) ? e.travel_engagement_statuses[0] : e.travel_engagement_statuses
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
    .select('id, trip_id, house_id, engagement_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, total_rate, taxes_and_fees, currency, rate_type, inclusions, price, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, party_composition, primary_contact_name, primary_contact_role, supplier_contact_name, supplier_contact_whatsapp, brief_category, brief_show, brief_image_src, booked_by, cancellation_policy, booking_policy, notes, sort_order, created_at, updated_at')
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
  const hotelMap: Record<string, { name: string; hero_image_src: string | null }> = {}
  if (hotelIds.length > 0) {
    const { data: hotelData } = await db
      .from('travel_accom_hotels')
      .select('id, name, hero_image_src')
      .in('id', hotelIds)
    for (const h of (hotelData ?? []) as { id: string; name: string; hero_image_src: string | null }[]) {
      hotelMap[h.id] = { name: h.name, hero_image_src: h.hero_image_src }
    }
  }

  const bookingIds = bookingRows.map(b => b.id as string)

  // 5. Parallel fetches
  const [partnerResult, houseResult, briefResult, roomResult, destResult, engResult] = await Promise.all([
    db.from('travel_partners')
      .select('id, name, partner_type, default_share_pct, currency, is_active'),
    db.from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),
    db.from('travel_trip_briefs')
      .select('*')
      .in('trip_id', tripIds),
    bookingIds.length > 0
      ? db.from('travel_booking_rooms')
          .select('*')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db.from('travel_trip_destinations')
      .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
      .in('trip_id', tripIds)
      .order('sort_order', { ascending: true }),
    db.from('travel_immerse_engagements')
      .select('trip_id, url_id')
      .in('trip_id', tripIds)
      .not('trip_id', 'is', null),
  ])

  if (partnerResult.error) return err('Failed to fetch partners', 500)

  return ok({
    bookingRows,
    hotelMap,
    tripRows,
    partners:  partnerResult.data ?? [],
    house:     houseResult.data ?? null,
    briefs:    briefResult.data ?? [],
    rooms:     roomResult.data  ?? [],
    dests:     destResult.data  ?? [],
    engagements: engResult.data ?? [],
  })
}

async function handleBrief(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_briefs')
    .select('*')
    .eq('trip_id', tripId)
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

async function handleAuxDriverDetails(db: SupabaseClient, auxBookingId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_aux_driver_details')
    .select('id, aux_booking_id, driver_name, driver_phone, car_model, plate, company, vehicle_role, sort_order')
    .eq('aux_booking_id', auxBookingId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch driver details', 500)
  return ok({ driverDetails: data ?? [] })
}

async function handleDays(db: SupabaseClient, tripId: string): Promise<Response> {
  // Days are DERIVED from trip span; travel_trip_days is overlay-only.
  const [{ data: trip, error: tripErr }, { data: overlay, error: ovErr }] = await Promise.all([
    db.from('travel_trips').select('start_date, end_date').eq('id', tripId).maybeSingle(),
    db.from('travel_trip_days').select('id, trip_id, entry_date, show, day_label, day_note').eq('trip_id', tripId),
  ])
  if (tripErr || ovErr) return err('Failed to fetch days', 500)
  const days = buildDays(
    tripId,
    (trip?.start_date as string | null) ?? null,
    (trip?.end_date as string | null) ?? null,
    (overlay ?? []) as Record<string, unknown>[],
  )
  return ok({ days })  // admin gets ALL days incl hidden (for show toggle)
}

async function handleWelcomeLetters(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_welcome_letters')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch welcome letters', 500)
  return ok({ letters: data ?? [] })
}

async function handleDayEntries(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_day_entries')
    .select('*')
    .eq('trip_id', tripId)
    .order('entry_date', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch day entries', 500)
  return ok({ dayEntries: data ?? [] })
}

async function handleAuxBookings(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_aux_bookings')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch aux bookings', 500)

  const aux = (data ?? []) as Record<string, unknown>[]
  if (aux.length === 0) return ok({ auxBookings: [] })

  const ids = aux.map(a => a.id as string)
  const { data: pax } = await db
    .from('travel_trip_aux_passengers')
    .select('id, aux_booking_id, person_id, passenger_label, confirmation_number, seat_numbers, sort_order')
    .in('aux_booking_id', ids)
    .order('sort_order', { ascending: true })

  const byAux: Record<string, unknown[]> = {}
  for (const p of (pax ?? []) as Record<string, unknown>[]) {
    const k = p.aux_booking_id as string
    ;(byAux[k] ??= []).push(p)
  }

  const withPax = aux.map(a => ({ ...a, passengers: byAux[a.id as string] ?? [] }))
  return ok({ auxBookings: withPax })
}

async function handlePublicView(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_immerse_engagements')
    .select('public_view')
    .eq('trip_id', tripId)
    .single()
  if (error || !data) return ok({ publicView: false })
  return ok({ publicView: !!(data as { public_view: boolean }).public_view })
}

// ── Calendar (fleet-wide; confirmed + upcoming) ───────────────────────────────
// Single source for the admin Calendar tab. Returns confirmed/upcoming trips
// with their per-hotel bookings (stays) + hotel names, derived from the same
// canonical tables the dossier uses — NOT a parallel store. The calendar owns
// no dates; it renders these.
//
// "Confirmed/upcoming" is DECLARED, not inferred:
//   - trip status is derived from confirmed_engagement_id's engagement status
//     slug (post-lifecycle-migration canon).
//   - included slugs: confirmed | paid | in_service (post-commitment, pre-terminal).
//   - excluded: requested/quoted/pending (pre-commitment), closed_won (concluded),
//     cancelled/closed_lost (dead). And end_date >= range_start (not past).
//
// Params: { range_start?: string (YYYY-MM-DD, default today), range_end?: string }
// Range filters trips whose [start_date, end_date] overlaps the window.

const CALENDAR_CONFIRMED_SLUGS = ['confirmed', 'paid', 'in_service'] as const

async function handleCalendar(
  db: SupabaseClient,
  rangeStart: string | null,
  rangeEnd: string | null,
): Promise<Response> {
  const start = rangeStart ?? new Date().toISOString().slice(0, 10)

  // 1. Trips with a confirmed engagement, ending on/after the range start.
  //    (A trip with no confirmed_engagement_id is pre-commitment — not shown.)
  let tripQ = db
    .from('travel_trips')
    .select('id, trip_code, public_title, start_date, end_date, confirmed_engagement_id, primary_client_id')
    .not('confirmed_engagement_id', 'is', null)
    .gte('end_date', start)
  if (rangeEnd) tripQ = tripQ.lte('start_date', rangeEnd)

  const { data: tripData, error: tripErr } = await tripQ.order('start_date', { ascending: true })
  if (tripErr) return err('Failed to fetch calendar trips', 500)

  const trips = (tripData ?? []) as Array<{
    id: string; trip_code: string; public_title: string | null
    start_date: string | null; end_date: string | null
    confirmed_engagement_id: string | null; primary_client_id: string | null
  }>
  if (trips.length === 0) return ok({ trips: [] })

  // 2. Resolve each winning engagement's status slug; keep only confirmed-stage.
  const engIds = [...new Set(trips.map(t => t.confirmed_engagement_id).filter((x): x is string => !!x))]
  const slugByEng = new Map<string, string>()
  if (engIds.length > 0) {
    const { data: engRows, error: engErr } = await db
      .from('travel_immerse_engagements')
      .select('id, travel_engagement_statuses(slug)')
      .in('id', engIds)
    if (engErr) return err('Failed to resolve engagement statuses', 500)
    for (const e of (engRows ?? []) as Array<{ id: string; travel_engagement_statuses: { slug: string } | { slug: string }[] | null }>) {
      const s = Array.isArray(e.travel_engagement_statuses) ? e.travel_engagement_statuses[0] : e.travel_engagement_statuses
      if (s?.slug) slugByEng.set(e.id, s.slug)
    }
  }

  const confirmedTrips = trips.filter(t => {
    const slug = t.confirmed_engagement_id ? slugByEng.get(t.confirmed_engagement_id) : null
    return !!slug && (CALENDAR_CONFIRMED_SLUGS as readonly string[]).includes(slug)
  })
  if (confirmedTrips.length === 0) return ok({ trips: [] })

  const tripIds = confirmedTrips.map(t => t.id)

  // 3. Bookings (stays) for those trips — start_date/end_date are check-in/out.
  const { data: bookData, error: bookErr } = await db
    .from('travel_bookings')
    .select('id, trip_id, name, status, booking_type, start_date, end_date, accom_hotel_id, confirmation_number')
    .in('trip_id', tripIds)
    .order('start_date', { ascending: true, nullsFirst: false })
  if (bookErr) return err('Failed to fetch calendar bookings', 500)
  const bookings = (bookData ?? []) as Array<{
    id: string; trip_id: string; name: string | null; status: string | null
    booking_type: string | null; start_date: string | null; end_date: string | null
    accom_hotel_id: string | null; confirmation_number: string | null
  }>

  // 3b. Room confirmation numbers per booking — the evidence the derivation reads.
  const calBookingIds = bookings.map(b => b.id)
  const roomsByBookingId = new Map<string, Array<{ confirmation_number: string | null }>>()
  if (calBookingIds.length > 0) {
    const { data: roomData, error: roomErr } = await db
      .from('travel_booking_rooms')
      .select('booking_id, confirmation_number')
      .in('booking_id', calBookingIds)
    if (roomErr) return err('Failed to fetch calendar rooms', 500)
    for (const r of (roomData ?? []) as Array<{ booking_id: string; confirmation_number: string | null }>) {
      ;(roomsByBookingId.get(r.booking_id) ?? roomsByBookingId.set(r.booking_id, []).get(r.booking_id)!).push({ confirmation_number: r.confirmation_number })
    }
  }

  // 4. Hotel names for accom bookings.
  const hotelIds = [...new Set(bookings.map(b => b.accom_hotel_id).filter((x): x is string => !!x))]
  const hotelName = new Map<string, string>()
  if (hotelIds.length > 0) {
    const { data: hotelData } = await db
      .from('travel_accom_hotels').select('id, name').in('id', hotelIds)
    for (const h of (hotelData ?? []) as Array<{ id: string; name: string }>) hotelName.set(h.id, h.name)
  }

  // 4b. Activities (typed child engagements) — the engagement-spine read. Stay +
  //     Transport children today; dining/experience/etc. flow through automatically
  //     as created (category = registry slug, never hardcoded). Fetched independently
  //     of trip span so out-of-span activities survive (e.g. a return flight the day
  //     after end_date).
  const journeyIds = [...new Set(confirmedTrips.map(t => t.confirmed_engagement_id).filter((x): x is string => !!x))]
  const activitiesByJourney = new Map<string, Array<Record<string, unknown>>>()
  if (journeyIds.length > 0) {
    const { data: actData, error: actErr } = await db
      .from('travel_immerse_engagements')
      .select('id, parent_engagement_id, title, activity_date, activity_end_date, activity_start_time, source_booking_id, source_aux_booking_id, travel_engagement_types!travel_immerse_engagements_engagement_type_id_fkey(slug, label)')
      .in('parent_engagement_id', journeyIds)
      .not('activity_date', 'is', null)
      .order('activity_date', { ascending: true })
    if (actErr) return err('Failed to fetch calendar activities', 500)
    for (const a of (actData ?? []) as Array<Record<string, unknown>>) {
      const parent = a.parent_engagement_id as string
      const typeRaw = a.travel_engagement_types
      const type = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw
      ;(activitiesByJourney.get(parent) ?? activitiesByJourney.set(parent, []).get(parent)!).push({
        id:         a.id,
        category:   (type as { slug: string } | null)?.slug ?? null,
        label:      (type as { label: string } | null)?.label ?? null,
        title:      a.title,
        date:       a.activity_date,
        end_date:   a.activity_end_date,
        time:       a.activity_start_time,
        source_booking_id:     a.source_booking_id,
        source_aux_booking_id: a.source_aux_booking_id,
      })
    }
  }

  // 5. Shape: trips each carrying their stays (booking + resolved hotel name + slug).
  const byTrip = new Map<string, typeof bookings>()
  for (const b of bookings) (byTrip.get(b.trip_id) ?? byTrip.set(b.trip_id, []).get(b.trip_id)!).push(b)

  const out = confirmedTrips.map(t => ({
    id:            t.id,
    trip_code:     t.trip_code,
    title:         t.public_title,
    start_date:    t.start_date,
    end_date:      t.end_date,
    status_slug:   t.confirmed_engagement_id ? (slugByEng.get(t.confirmed_engagement_id) ?? null) : null,
    primary_client_id: t.primary_client_id,
    stays: (byTrip.get(t.id) ?? []).map(b => {
      const stayRooms = roomsByBookingId.get(b.id) ?? []
      const confirmation = deriveConfirmation({
        rooms: stayRooms,
        bookingConfirmationNumber: b.confirmation_number,
        bookingStatus: b.status,
      })
      const roomCount = roomConfirmationCount(stayRooms)
      return {
        id:           b.id,
        name:         b.name,
        status:       b.status,
        booking_type: b.booking_type,
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

  return ok({ trips: out })
}

// ── Activity detail (6C drill-down) ───────────────────────────────────────────
// Fine-print for one itinerary item. Reuses the canonical resolvers in
// _shared/names.ts so "who's in this room / on this flight" is IDENTICAL to the
// client confirmation page — one resolution truth, never a parallel copy.
//   stay (booking_id)     → rooms with resolved guest names + per-room conf
//   transport (aux id)    → passengers with resolved names + seat + conf
// partyLabel (brief.prepared_for) is the trip's single client address, the last
// fallback in resolvePartyName.

async function partyLabelForTrip(db: SupabaseClient, tripId: string | null): Promise<string | null> {
  if (!tripId) return null
  const { data } = await db
    .from('travel_trip_briefs')
    .select('prepared_for')
    .eq('trip_id', tripId)
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
    // Trip (for party label) via the booking.
    const { data: bk } = await db
      .from('travel_bookings').select('trip_id').eq('id', bookingId).maybeSingle()
    const partyLabel = await partyLabelForTrip(db, (bk?.trip_id as string | null) ?? null)

    const { data: roomData, error: roomErr } = await db
      .from('travel_booking_rooms')
      .select('id, room_name, person_id, guest_name, confirmation_number, party_composition, sort_order')
      .eq('booking_id', bookingId)
      .order('sort_order', { ascending: true })
    if (roomErr) return err('Failed to fetch rooms', 500)
    const rooms = (roomData ?? []) as Array<Record<string, unknown>>

    const peopleById = await resolvePeopleByIds(
      db, [...new Set(rooms.map(r => r.person_id).filter(Boolean))] as string[],
    )
    const out = rooms.map(r => ({
      id:                  r.id,
      room_name:           r.room_name,
      guest_name:          resolveRoomGuestName(
                             r.person_id ? peopleById[r.person_id as string] : null,
                             r.guest_name as string | null,
                             partyLabel,
                           ),
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
        .select('id, driver_name, driver_phone, car_model, plate, company, vehicle_role, sort_order')
        .eq('aux_booking_id', auxBookingId)
        .order('sort_order', { ascending: true })
      if (vehErr) return err('Failed to fetch driver details', 500)
      const vehicles = (vehData ?? []) as Array<Record<string, unknown>>
      // Admin surface returns ALL fields incl company; the CLIENT EFs omit company.
      return ok({ kind: 'ground_transport', vehicles })
    }

    const { data: aux } = await db
      .from('travel_trip_aux_bookings').select('trip_id').eq('id', auxBookingId).maybeSingle()
    const partyLabel = await partyLabelForTrip(db, (aux?.trip_id as string | null) ?? null)
    const { data: paxData, error: paxErr } = await db
      .from('travel_trip_aux_passengers')
      .select('id, person_id, passenger_label, seat_numbers, confirmation_number, sort_order')
      .eq('aux_booking_id', auxBookingId)
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { mode, house_id, trip_id, booking_id, aux_booking_id, category, range_start, range_end } = body as {
      mode:           string | undefined
      house_id?:      string
      trip_id?:       string
      booking_id?:    string
      aux_booking_id?: string
      category?:      string
      range_start?:   string
      range_end?:     string
    }

    if (!mode) return err('mode is required', 400)

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authResult = await verifyAdminCaller(req, serviceClient)
    if (authResult instanceof Response) return authResult

    switch (mode as Mode) {
      case 'dossier':
        if (!house_id) return err('house_id is required for dossier mode', 400)
        return handleDossier(serviceClient, house_id)

      case 'brief':
        if (!trip_id) return err('trip_id is required for brief mode', 400)
        return handleBrief(serviceClient, trip_id)

      case 'rooms':
        if (!booking_id) return err('booking_id is required for rooms mode', 400)
        return handleRooms(serviceClient, booking_id)

      case 'aux_driver_details':
        if (!aux_booking_id) return err('aux_booking_id is required for aux_driver_details mode', 400)
        return handleAuxDriverDetails(serviceClient, aux_booking_id)

      case 'days':
        if (!trip_id) return err('trip_id is required for days mode', 400)
        return handleDays(serviceClient, trip_id)

      case 'welcome_letters':
        if (!trip_id) return err('trip_id is required for welcome_letters mode', 400)
        return handleWelcomeLetters(serviceClient, trip_id)

      case 'day_entries':
        if (!trip_id) return err('trip_id is required for day_entries mode', 400)
        return handleDayEntries(serviceClient, trip_id)

      case 'aux_bookings':
        if (!trip_id) return err('trip_id is required for aux_bookings mode', 400)
        return handleAuxBookings(serviceClient, trip_id)

      case 'public_view':
        if (!trip_id) return err('trip_id is required for public_view mode', 400)
        return handlePublicView(serviceClient, trip_id)

      case 'calendar':
        return handleCalendar(serviceClient, range_start ?? null, range_end ?? null)

      case 'activity_detail':
        return handleActivityDetail(serviceClient, booking_id ?? null, aux_booking_id ?? null, category ?? null)

      default:
        return err(`Unknown mode: ${mode}`, 400)
    }

  } catch (e) {
    console.error('travel-read-trip-admin unexpected error:', e)
    return err('Internal server error', 500)
  }
})