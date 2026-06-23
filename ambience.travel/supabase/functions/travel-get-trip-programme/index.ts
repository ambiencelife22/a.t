// supabase/functions/travel-get-trip-programme/index.ts
//
// Edge Function: travel-get-trip-programme
// Reads daily programme data for client-facing programme pages.
//
// Security model:
//   - Public endpoint — no auth required
//   - url_id is the access token (11-char alphanumeric)
//   - Service role key (canon SERVICE_ROLE_KEY) bypasses RLS
//   - Returns only programme-relevant data — no financial or admin data
//
// Request body: { url_id: string }
//
// Response: { trip, brief, house, destinationName, auxBookings, urlId, days, entries }
//   `entries` is the SINGLE-SOURCE ordered timeline (TimelineItem[]) built server-side
//   by _shared/timeline.ts from bookings + aux + standalone stored entries:
//     - hotel check-in/out DERIVED from travel_bookings (never stored); check-in carries
//       per-room guest/room/conf, resolved via _shared/names.ts
//     - aux (flights/transfers) with resolved passengers
//     - standalone stored entries (dining/experience/notes — no source_booking_id)
//   The programme tab + PDF render this stream as-is. No client-side derivation.
//
//   Image resolution (canon-default, override-first), applied per item:
//     hotel item → room override → canon room image → booking override → hotel hero
//     dining     → travel_dining_venues.image_src
//     experience → travel_experiences.image_src
//     aux        → none
//
// S53G+ : migrated to _shared/ (http + names + timeline). Hotel check-in/out moved
//   from stored entries to derived timeline items. Resolver drift fixed (was the
//   ''-returning inline copy; now _shared/names.ts returns string|null).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/http.ts'
import { attachPassengers, attachDriverDetails } from '../_shared/names.ts'
import { resolveTripIds, fetchTripCore, fetchTripBookings } from '../_shared/trip.ts'
import { buildTimeline } from '../_shared/timeline.ts'
import { buildDays } from '../_shared/days.ts'

const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse + validate url_id ────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { url_id } = body as { url_id?: string }

    if (!url_id || !URL_ID_REGEX.test(url_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid url_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Service role client ────────────────────────────────────────────────
    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── 3. url_id → trip_id → house_id (single-source) ─────────────────────────
    const ids = await resolveTripIds(db, url_id)
    if (!ids) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { tripId, houseId } = ids

    // ── 5. Parallel fetch — core (single-source) + programme-specific ──────────
    const [
      core,
      bookingsResult,
      auxResult,
      daysResult,
      entriesResult,
    ] = await Promise.all([
      fetchTripCore(db, tripId, houseId),

      // Bookings — programme's column set (no financial cols; derives hotel items)
      db.from('travel_bookings')
        .select('id, trip_id, house_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, party_composition, brief_show, brief_image_src, booked_by, accom_hotel_id, sort_order')
        .eq('house_id', houseId)
        .eq('trip_id', tripId),

      db.from('travel_trip_aux_bookings')
        .select('id, trip_id, booking_type, name, start_date, start_time, end_date, end_time, origin, destination, notes, booked_by, brief_show, sort_order, created_at, updated_at, flight_number, airline_name, cabin_class, seat_type, aircraft_type, depart_airport, arrive_airport, airline_supplier_id')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      // Overlay only — buildDays derives the day list from trip span and applies
      // these per-day overrides. No show filter; buildDays honors show.
      db.from('travel_trip_days')
        .select('id, trip_id, entry_date, show, day_label, day_note')
        .eq('trip_id', tripId),

      // Standalone stored entries (dining/experience/notes). Booking-sourced entries
      // are excluded downstream by timeline.ts (they are derived from bookings now).
      db.from('travel_trip_day_entries')
        .select('id, trip_id, entry_date, start_time, end_time, title, subtitle, category, booked_by, confirmation_number, guest_label, notes, brief_show, sort_order, source_booking_id, source_aux_id, source_dining_id, source_experience_id')
        .eq('trip_id', tripId)
        .eq('brief_show', true)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true }),
    ])

    if (!core.trip) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const brief      = core.brief
    const partyLabel = (brief?.prepared_for as string | null) ?? null
    const bookings   = (bookingsResult.data ?? []) as Record<string, unknown>[]
    const entries    = (entriesResult.data ?? []) as Record<string, unknown>[]

    // ── 6. Shared bookings enrich: rooms + resolved guest names + lookup maps ───
    const { roomsByBooking, canonRoomById, hotelById } = await fetchTripBookings(db, bookings, partyLabel)

    // ── 7. Programme image composition (canon-default, override-first) ─────────
    // First-room-per-booking image (room override → canon room image).
    const roomImgByBooking: Record<string, string | null> = {}
    for (const [bid, bRooms] of Object.entries(roomsByBooking)) {
      const r = bRooms[0]
      const canon = r.room_id ? canonRoomById[r.room_id as string] : undefined
      const roomOverride = (r.brief_image_src as string | null) ?? null
      const canonImg     = canon ? canon.image_src : null
      roomImgByBooking[bid] = roomOverride ?? canonImg
    }

    // ── 8. Enrich bookings: _hotel_name, _hotel_image_src, _rooms (resolved) ────
    const enrichedBookings = bookings.map(b => {
      const bid = b.id as string
      const hotelId = b.accom_hotel_id as string | null
      const hotel = hotelId ? (hotelById[hotelId] ?? null) : null

      // Per-booking display image: room override/canon → booking override → hotel hero
      const displayImg =
        roomImgByBooking[bid]
        ?? (b.brief_image_src as string | null)
        ?? (hotel?.hero_image_src ?? null)

      // rooms already carry resolved_guest_name from fetchTripBookings
      const enrichedRooms = roomsByBooking[bid] ?? []

      return {
        ...b,
        _hotel_name:      hotel?.name ?? null,
        _hotel_image_src: displayImg,
        _rooms:           enrichedRooms,
      }
    })

    // ── 9. Aux with resolved passengers + driver details ───────────────────────
    const auxBookings = await attachDriverDetails(
      db,
      await attachPassengers(db, (auxResult.data ?? []) as Record<string, unknown>[], partyLabel),
    )

    // ── 10. Dining / experience images for standalone entries ──────────────────
    const diningIds     = [...new Set(entries.map(e => e.source_dining_id).filter(Boolean))] as string[]
    const experienceIds = [...new Set(entries.map(e => e.source_experience_id).filter(Boolean))] as string[]

    const [diningImgResult, expImgResult] = await Promise.all([
      diningIds.length > 0
        ? db.from('travel_dining_venues').select('id, image_src').in('id', diningIds)
        : Promise.resolve({ data: [], error: null }),
      experienceIds.length > 0
        ? db.from('travel_experiences').select('id, image_src').in('id', experienceIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    const diningImgById: Record<string, string | null> = {}
    for (const d of (diningImgResult.data ?? []) as Record<string, unknown>[]) {
      diningImgById[d.id as string] = (d.image_src as string | null) ?? null
    }
    const expImgById: Record<string, string | null> = {}
    for (const e of (expImgResult.data ?? []) as Record<string, unknown>[]) {
      expImgById[e.id as string] = (e.image_src as string | null) ?? null
    }

    // Attach resolved image_src to standalone entries (non-booking sources).
    const entryImage = (e: Record<string, unknown>): string | null => {
      if (e.source_dining_id)     return diningImgById[e.source_dining_id as string] ?? null
      if (e.source_experience_id) return expImgById[e.source_experience_id as string] ?? null
      return null
    }
    const enrichedEntries = entries.map(e => ({ ...e, image_src: entryImage(e) }))

    // ── 11. Build the single-source timeline ───────────────────────────────────
    const timeline = buildTimeline(enrichedBookings, auxBookings, enrichedEntries)

    // ── 12. Destinations + return (core-sourced) ───────────────────────────────
    const destinations = core.destinations

    // ── 13. Return ─────────────────────────────────────────────────────────────
    const trip = core.trip as Record<string, unknown>
    const payload = {
      trip: {
        ...trip,
        destinations,
        bookings: enrichedBookings,
        brief,
      },
      brief,
      house:           core.house,
      destinationName: (destinations[0]?.name as string) ?? '',
      auxBookings,
      urlId:           url_id,
      days:            buildDays(
                         tripId,
                         trip.start_date as string | null,
                         trip.end_date as string | null,
                         (daysResult.data ?? []) as Record<string, unknown>[],
                       ).filter(d => d.show),
      entries:         timeline,
    }

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('travel-get-trip-programme unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})