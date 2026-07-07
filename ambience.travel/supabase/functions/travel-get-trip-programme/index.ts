// supabase/functions/travel-get-trip-programme/index.ts
//
// Edge Function: travel-get-trip-programme
// Reads daily programme data for client-facing programme pages.
//
// Security model:
//   - Public endpoint — no auth required
//   - url_id is the access token (11-char alphanumeric)
//   - Service role via _shared/client.ts createServiceClient (bypasses RLS)
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
//   Check-in time resolution (S53G derived check-in feature):
//     1. Derived: same-day arrival aux item end_time + booking.transfer_minutes
//     2. Fallback: hotel standard_checkin_time (joined from travel_accom_hotels)
//     3. null
//   Early/late approved times surface as check_in_note/check_out_note.
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
// S53G v3: derived check-in time — bookings SELECT extended with transfer_minutes,
//   early_checkin_approved_time, late_checkout_approved_time, and hotel policy
//   join (standard_checkin_time, standard_checkout_time). enrichBookingWithHotelPolicy
//   applied before buildTimeline call.

import { createServiceClient } from '../_shared/client.ts'
import { json, preflight } from '../_shared/http.ts'
import { checkPublicView } from '../_shared/visibility.ts'
import { attachPassengers, attachDriverDetails } from '../_shared/names.ts'
import { resolveTripIds, fetchTripCore, fetchTripBookings, AUX_BOOKING_SELECT, flattenAuxType } from '../_shared/trip.ts'
import { buildTimeline } from '../_shared/timeline.ts'
import { buildDays } from '../_shared/days.ts'
import { enrichBookingWithHotelPolicy } from '../_shared/expenses.ts'

const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    // ── 1. Parse + validate url_id ────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { url_id } = body as { url_id?: string }

    if (!url_id || !URL_ID_REGEX.test(url_id)) {
      return json({ error: 'Invalid url_id' }, 400)
    }

    // ── 2. Service role client ────────────────────────────────────────────────
    const db = createServiceClient()

    // ── 3. url_id → trip_id → house_id (single-source) ───────────────────────
    const visibilityGate = await checkPublicView(db, url_id)
    if (visibilityGate) return visibilityGate

    const ids = await resolveTripIds(db, url_id)
    if (!ids) {
      return json({ error: 'Not found' }, 404)
    }
    const { tripId, houseId } = ids

    // ── 5. Parallel fetch — core (single-source) + programme-specific ─────────
    const [
      core,
      bookingsResult,
      auxResult,
      daysResult,
      entriesResult,
    ] = await Promise.all([
      fetchTripCore(db, tripId, houseId),

      // Bookings — programme column set + derived check-in columns (S53G v3).
      // travel_accom_hotels join brings standard_checkin/checkout_time for the
      // hotel policy fallback in deriveCheckinTime() inside timeline.ts.
      db.from('travel_bookings')
        .select(`
          id, trip_id, house_id, booking_type, name, status, confirmation_number,
          start_date, check_in_date, start_time, check_in_note, check_out_note,
          end_date, nights, party_composition, brief_show, brief_image_src,
          booked_by, accom_hotel_id, sort_order,
          transfer_minutes,
          early_checkin_approved_time,
          late_checkout_approved_time,
          checkin_time_is_estimate,
          travel_accom_hotels!accom_hotel_id(
            standard_checkin_time,
            standard_checkout_time
          )
        `)
        .eq('house_id', houseId)
        .eq('trip_id', tripId),

      db.from('travel_engagement_aux_bookings')
        .select(AUX_BOOKING_SELECT)
        .eq('engagement_id', tripId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('start_time', { ascending: true, nullsFirst: false }),

      // Overlay only — buildDays derives the day list from trip span and applies
      // these per-day overrides. No show filter; buildDays honors show.
      db.from('travel_journey_days')
        .select('id, engagement_id, entry_date, show, day_label, day_note')
        .eq('engagement_id', tripId),

      // Standalone stored entries (dining/experience/notes). Booking-sourced entries
      // are excluded downstream by timeline.ts (they are derived from bookings now).
      db.from('travel_journey_day_entries')
        .select('id, engagement_id, entry_date, start_time, end_time, title, subtitle, category, booked_by, confirmation_number, guest_label, notes, brief_show, sort_order, source_booking_id, source_aux_id, source_dining_id, source_experience_id')
        .eq('engagement_id', tripId)
        .eq('brief_show', true)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true }),
    ])

    if (!core.trip) {
      return json({ error: 'Trip not found' }, 404)
    }
    const brief      = core.brief
    const partyLabel = (brief?.prepared_for as string | null) ?? null
    const bookings   = (bookingsResult.data ?? []) as Record<string, unknown>[]
    const entries    = (entriesResult.data ?? []) as Record<string, unknown>[]

    // ── 6. Shared bookings enrich: rooms + resolved guest names + lookup maps ──
    const { roomsByBooking, canonRoomById, hotelById } = await fetchTripBookings(db, bookings, partyLabel, houseId)

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

    // ── 8. Enrich bookings: _hotel_name, _hotel_image_src, _rooms, hotel policy ─
    // enrichBookingWithHotelPolicy flattens the travel_accom_hotels join into
    // _standard_checkin_time / _standard_checkout_time — the shape timeline.ts
    // expects in BookingLike. All other enrichment is unchanged.
    const enrichedBookings = bookings.map(b => {
      const bid     = b.id as string
      const hotelId = b.accom_hotel_id as string | null
      const hotel   = hotelId ? (hotelById[hotelId] ?? null) : null

      const displayImg =
        roomImgByBooking[bid]
        ?? (b.brief_image_src as string | null)
        ?? (hotel?.hero_image_src ?? null)

      const enrichedRooms = roomsByBooking[bid] ?? []

      return enrichBookingWithHotelPolicy({
        ...b,
        _hotel_name:      hotel?.name ?? null,
        _hotel_image_src: displayImg,
        _rooms:           enrichedRooms,
      })
    })

    // ── 9. Aux with resolved passengers + driver details ──────────────────────
    const auxBookings = await attachDriverDetails(
      db,
      await attachPassengers(db, (auxResult.data ?? []) as unknown as Record<string, unknown>[], partyLabel),
    )

    // ── 10. Dining venue images for aux bookings (dining_venue_id FK) ─────────
    const auxDiningIds = [...new Set(
      (auxBookings as Record<string, unknown>[])
        .map(a => a.dining_venue_id)
        .filter(Boolean)
    )] as string[]
    const auxDiningVenueResult = auxDiningIds.length > 0
      ? await db.from('travel_dining_venues')
          .select('id, image_src, address, maps_url, phone, dress_code, children_policy, table_hold_note, booking_terms')
          .in('id', auxDiningIds)
      : { data: [], error: null }
    const auxVenueById: Record<string, Record<string, unknown>> = {}
    for (const d of (auxDiningVenueResult.data ?? []) as Record<string, unknown>[]) {
      auxVenueById[d.id as string] = d
    }
    const auxBookingsWithImg = (auxBookings as Record<string, unknown>[]).map(a => {
      const v = a.dining_venue_id ? auxVenueById[a.dining_venue_id as string] : null
      return {
        ...flattenAuxType(a),
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

    // ── 10b. Dining / experience images for standalone entries ─────────────────
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

    const entryImage = (e: Record<string, unknown>): string | null => {
      if (e.source_dining_id)     return diningImgById[e.source_dining_id as string] ?? null
      if (e.source_experience_id) return expImgById[e.source_experience_id as string] ?? null
      return null
    }
    const enrichedEntries = entries.map(e => ({ ...e, image_src: entryImage(e) }))

    // ── 11. Build the single-source timeline ──────────────────────────────────
    // enrichedBookings now carry _standard_checkin_time / _standard_checkout_time
    // (from enrichBookingWithHotelPolicy) and transfer_minutes / approved time
    // columns from the DB. buildTimeline passes aux through buildHotelItems so
    // deriveCheckinTime() can match same-day arrivals.
    const timeline = buildTimeline(enrichedBookings, auxBookingsWithImg, enrichedEntries)

    // ── 12. Destinations + return ─────────────────────────────────────────────
    const destinations = core.destinations

    // ── 13. Return ────────────────────────────────────────────────────────────
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

    return json(payload, 200)

  } catch (err) {
    console.error('travel-get-trip-programme unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})