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
import { resolvePartyName, attachPassengers } from '../_shared/names.ts'
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

    // ── 3. url_id → trip_id ───────────────────────────────────────────────────
    const { data: eng, error: engErr } = await db
      .from('travel_immerse_engagements')
      .select('trip_id')
      .eq('url_id', url_id)
      .not('trip_id', 'is', null)
      .limit(1)
      .single()

    if (engErr || !eng?.trip_id) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const tripId = eng.trip_id as string

    // ── 4. trip_id → house_id ─────────────────────────────────────────────────
    const { data: bookingHouse, error: bookErr } = await db
      .from('travel_bookings')
      .select('house_id')
      .eq('trip_id', tripId)
      .not('house_id', 'is', null)
      .limit(1)
      .single()

    if (bookErr || !bookingHouse?.house_id) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const houseId = bookingHouse.house_id as string

    // ── 5. Parallel fetch ─────────────────────────────────────────────────────
    const [
      tripResult,
      briefResult,
      houseResult,
      destResult,
      bookingsResult,
      auxResult,
      daysResult,
      entriesResult,
    ] = await Promise.all([
      db.from('travel_trips')
        .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, guest_count_adults, guest_count_children')
        .eq('id', tripId)
        .single(),

      db.from('travel_trip_briefs')
        .select(`
          id, trip_id, house_id, brief_title, brief_subtitle, prepared_for,
          hero_image_src, hero_image_alt, logo_variant,
          snapshot_destination, snapshot_dates, snapshot_guests, snapshot_status,
          journey_steps, advisor_name, advisor_email, advisor_phone,
          show_advisor_phone, show_advisor_email,
          hotel_contact_note, important_notes, footer_tagline,
          programme_notes, programme_show_images,
          created_at, updated_at
        `)
        .eq('trip_id', tripId)
        .maybeSingle(),

      db.from('a_houses')
        .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
        .eq('id', houseId)
        .single(),

      db.from('travel_trip_destinations')
        .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      // Bookings — full set for this trip/house (programme now derives hotel items)
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

    if (tripResult.error || !tripResult.data) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const brief      = briefResult.data ?? null
    const partyLabel = (brief?.prepared_for as string | null) ?? null
    const bookings   = (bookingsResult.data ?? []) as Record<string, unknown>[]
    const entries    = (entriesResult.data ?? []) as Record<string, unknown>[]

    // ── 6. Rooms for bookings + resolve guest names (single-source) ────────────
    const bookingIds = bookings.map(b => b.id as string)
    const roomsResult = bookingIds.length > 0
      ? await db.from('travel_booking_rooms')
          .select('id, booking_id, room_id, person_id, room_name, confirmation_number, guest_name, party_composition, nights, brief_image_src, sort_order')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }
    const rooms = (roomsResult.data ?? []) as Record<string, unknown>[]

    // Resolve room guest people
    const roomPersonIds = [...new Set(rooms.map(r => r.person_id).filter(Boolean))] as string[]
    const roomPeopleById: Record<string, Record<string, unknown>> = {}
    if (roomPersonIds.length > 0) {
      const { data: rp } = await db
        .from('global_people')
        .select('id, first_name, last_name, nickname')
        .in('id', roomPersonIds)
      for (const g of (rp ?? []) as Record<string, unknown>[]) roomPeopleById[g.id as string] = g
    }

    // ── 7. Image resolution (canon-default, override-first) ────────────────────
    // Canon room image via room_id → travel_accom_rooms.
    const roomIds = [...new Set(rooms.map(r => r.room_id).filter(Boolean))] as string[]
    const canonRoomById: Record<string, string | null> = {}
    if (roomIds.length > 0) {
      const { data: canonRooms } = await db
        .from('travel_accom_rooms')
        .select('id, room_image_src')
        .in('id', roomIds)
      for (const r of (canonRooms ?? []) as Record<string, unknown>[]) {
        canonRoomById[r.id as string] = (r.room_image_src as string | null) ?? null
      }
    }

    // Hotel hero via accom_hotel_id.
    const hotelIds = [...new Set(bookings.map(b => b.accom_hotel_id).filter(Boolean))] as string[]
    const hotelHeroById: Record<string, string | null> = {}
    const hotelNameById: Record<string, string> = {}
    if (hotelIds.length > 0) {
      const { data: hotels } = await db
        .from('travel_accom_hotels')
        .select('id, name, hero_image_src')
        .in('id', hotelIds)
      for (const h of (hotels ?? []) as Record<string, unknown>[]) {
        hotelHeroById[h.id as string] = (h.hero_image_src as string | null) ?? null
        hotelNameById[h.id as string] = (h.name as string) ?? ''
      }
    }

    // First-room-per-booking image (override → canon room).
    const roomImgByBooking: Record<string, string | null> = {}
    const roomsByBooking: Record<string, Record<string, unknown>[]> = {}
    for (const r of rooms) {
      const bid = r.booking_id as string
      ;(roomsByBooking[bid] ??= []).push(r)
      if (roomImgByBooking[bid] !== undefined) continue
      roomImgByBooking[bid] =
        (r.brief_image_src as string | null)
        ?? (r.room_id ? canonRoomById[r.room_id as string] : null)
        ?? null
    }

    // ── 8. Enrich bookings: _hotel_name, _hotel_image_src, _rooms (resolved) ────
    const enrichedBookings = bookings.map(b => {
      const bid = b.id as string
      const hotelId = b.accom_hotel_id as string | null
      const hotelName = hotelId ? (hotelNameById[hotelId] ?? null) : null
      const hotelHero = hotelId ? (hotelHeroById[hotelId] ?? null) : null

      // Per-booking display image: room override/canon → booking override → hotel hero
      const displayImg =
        roomImgByBooking[bid]
        ?? (b.brief_image_src as string | null)
        ?? hotelHero
        ?? null

      const enrichedRooms = (roomsByBooking[bid] ?? []).map(r => ({
        ...r,
        resolved_guest_name: resolvePartyName(
          r.person_id ? roomPeopleById[r.person_id as string] : null,
          r.guest_name as string | null,
          partyLabel,
        ),
      }))

      return {
        ...b,
        _hotel_name:      hotelName,
        _hotel_image_src: displayImg,
        _rooms:           enrichedRooms,
      }
    })

    // ── 9. Aux with resolved passengers ────────────────────────────────────────
    const auxBookings = await attachPassengers(db, (auxResult.data ?? []) as Record<string, unknown>[], partyLabel)

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
    const enrichedEntries = entries.map(e => {
      let image_src: string | null = null
      if (e.source_dining_id)          image_src = diningImgById[e.source_dining_id as string] ?? null
      else if (e.source_experience_id) image_src = expImgById[e.source_experience_id as string] ?? null
      return { ...e, image_src }
    })

    // ── 11. Build the single-source timeline ───────────────────────────────────
    const timeline = buildTimeline(enrichedBookings, auxBookings, enrichedEntries)

    // ── 12. Destinations ───────────────────────────────────────────────────────
    const destinations = ((destResult.data ?? []) as Record<string, unknown>[]).map(row => {
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

    // ── 13. Return ─────────────────────────────────────────────────────────────
    const payload = {
      trip: {
        ...tripResult.data,
        destinations,
        bookings: enrichedBookings,
        brief,
      },
      brief,
      house:           houseResult.data ?? null,
      destinationName: destinations[0]?.name ?? '',
      auxBookings,
      urlId:           url_id,
      days:            buildDays(
                         tripId,
                         tripResult.data.start_date as string | null,
                         tripResult.data.end_date as string | null,
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