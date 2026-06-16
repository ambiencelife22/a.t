// supabase/functions/travel-get-trip-programme/index.ts
//
// Edge Function: get-trip-programme
// Reads daily programme data for client-facing programme pages.
//
// Security model:
//   - Public endpoint — no auth required
//   - url_id is the access token (11-char alphanumeric)
//   - All DB reads use the service role key to bypass RLS
//   - Returns only programme-relevant data — no financial or admin data
//
// Request body:
//   { url_id: string }
//
// Response:
//   { trip, brief, house, destinationName, auxBookings, urlId, days, entries }
//   entries include resolved image_src from source CRM record:
//     source_booking_id  → travel_booking_rooms.brief_image_src (per-room override)
//                          | travel_accom_rooms.room_image_src  (canon default, S43 Add 1)
//                          | travel_bookings.brief_image_src    (booking override)
//                          | travel_accom_hotels.hero_image_src (hotel hero fallback)
//     source_aux_id      → no image (flights/transfers)
//     source_dining_id   → travel_dining_venues.image_src
//     source_experience_id → travel_experiences.image_src
//
// Image resolution chain (canon-default, override-first) — parity with
// travel-get-trip-confirmation S53 Add 4:
//   1. travel_booking_rooms.brief_image_src  — explicit per-room override (rare)
//   2. travel_accom_rooms.room_image_src     — CANON DEFAULT (via room_id FK)
//   3. travel_bookings.brief_image_src       — booking-level override
//   4. travel_accom_hotels.hero_image_src    — hotel hero fallback
//   5. null                                  — content-only card
//
// Last updated: S43 Add 1 — canon room image resolution added (parity with
//   travel-get-trip-confirmation S53 Add 4). travel_booking_rooms.room_id
//   → travel_accom_rooms.room_image_src is now the default image source.
//   Closes the gap where hotel check-in entries had no image on programme tab.
// Prior: S50 — show_advisor_email + show_advisor_phone + advisor_phone
//   added to brief SELECT list.
// Prior: S48 — image resolution via all four source FK chains.
// Prior: S48 — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Service role client ────────────────────────────────────────────────
    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── 3. Resolve url_id → trip_id ───────────────────────────────────────────
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tripId = eng.trip_id as string

    // ── 4. Resolve trip_id → house_id ─────────────────────────────────────────
    const { data: booking, error: bookErr } = await db
      .from('travel_bookings')
      .select('house_id')
      .eq('trip_id', tripId)
      .not('house_id', 'is', null)
      .limit(1)
      .single()

    if (bookErr || !booking?.house_id) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const houseId = booking.house_id as string

    // ── 5. Parallel fetch ─────────────────────────────────────────────────────
    const [
      tripResult,
      briefResult,
      houseResult,
      destResult,
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

      db.from('travel_trip_aux_bookings')
        .select('id, trip_id, booking_type, name, confirmation_number, start_date, start_time, end_date, end_time, origin, destination, notes, guest_label, booked_by, brief_show, sort_order, created_at, updated_at, flight_number, airline_name, cabin_class, seat_numbers, seat_type, aircraft_type, depart_airport, arrive_airport')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      // Visible days only — already filtered server-side
      db.from('travel_trip_days')
        .select('id, trip_id, entry_date, show, day_label, day_note, sort_order, created_at, updated_at')
        .eq('trip_id', tripId)
        .eq('show', true)
        .order('sort_order', { ascending: true }),

      // Entries visible on brief — include all four source FK columns
      db.from('travel_trip_day_entries')
        .select('id, trip_id, entry_date, start_time, end_time, title, subtitle, category, booked_by, confirmation_number, guest_label, notes, brief_show, sort_order, is_auto_derived, source_booking_id, source_aux_id, source_dining_id, source_experience_id, created_at, updated_at')
        .eq('trip_id', tripId)
        .eq('brief_show', true)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true }),
    ])

    if (tripResult.error || !tripResult.data) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const entries = entriesResult.data ?? []

    // ── 6. Resolve images for all entries ─────────────────────────────────────
    // Collect distinct source IDs by type, then batch-fetch images.

    const bookingIds    = [...new Set(entries.map((e: any) => e.source_booking_id).filter(Boolean))] as string[]
    const diningIds     = [...new Set(entries.map((e: any) => e.source_dining_id).filter(Boolean))] as string[]
    const experienceIds = [...new Set(entries.map((e: any) => e.source_experience_id).filter(Boolean))] as string[]

    const [bookingImgResult, roomImgResult, diningImgResult, expImgResult, hotelImgResult] =
      await Promise.all([
        // Booking-level image
        bookingIds.length > 0
          ? db.from('travel_bookings')
              .select('id, brief_image_src, accom_hotel_id')
              .in('id', bookingIds)
          : Promise.resolve({ data: [], error: null }),

        // Room-level image (all rooms per booking, includes room_id for canon lookup)
        bookingIds.length > 0
          ? db.from('travel_booking_rooms')
              .select('booking_id, room_id, brief_image_src')
              .in('booking_id', bookingIds)
              .order('sort_order', { ascending: true })
          : Promise.resolve({ data: [], error: null }),

        // Dining venue image
        diningIds.length > 0
          ? db.from('travel_dining_venues')
              .select('id, image_src')
              .in('id', diningIds)
          : Promise.resolve({ data: [], error: null }),

        // Experience image
        experienceIds.length > 0
          ? db.from('travel_experiences')
              .select('id, image_src')
              .in('id', experienceIds)
          : Promise.resolve({ data: [], error: null }),

        // Hotel hero image (fallback for bookings with no brief_image_src)
        bookingIds.length > 0
          ? db.from('travel_bookings')
              .select('id, accom_hotel_id, travel_accom_hotels!travel_bookings_accom_hotel_id_fkey(hero_image_src)')
              .in('id', bookingIds)
              .not('accom_hotel_id', 'is', null)
          : Promise.resolve({ data: [], error: null }),
      ])

    // ── 6a. Canon room image resolution (S43 Add 1) ───────────────────────────
    // Collect distinct room_ids from booking_rooms, fetch canon images,
    // build a booking_id → canon_image_src map (first room per booking wins).
    const bookingRoomRows = (roomImgResult.data ?? []) as any[]
    const roomIds = [...new Set(
      bookingRoomRows.map((r: any) => r.room_id).filter(Boolean)
    )] as string[]

    const canonRoomById: Record<string, string | null> = {}
    if (roomIds.length > 0) {
      const { data: canonRooms } = await db
        .from('travel_accom_rooms')
        .select('id, room_image_src')
        .in('id', roomIds)
      for (const r of (canonRooms ?? []) as any[]) {
        canonRoomById[r.id] = r.room_image_src ?? null
      }
    }

    // Build lookup maps
    // Room image: first room per booking.
    // Resolution order per room: per-room override → canon room image.
    const roomImgByBooking: Record<string, string | null> = {}
    for (const r of bookingRoomRows) {
      if (roomImgByBooking[r.booking_id] !== undefined) continue // first room wins
      const resolved =
        r.brief_image_src                          // 1. per-room explicit override
        ?? (r.room_id ? canonRoomById[r.room_id] : null) // 2. canon room image
        ?? null
      roomImgByBooking[r.booking_id] = resolved
    }

    // Booking image map (booking override → hotel hero fallback)
    const bookingImgMap: Record<string, string | null> = {}
    for (const b of (hotelImgResult.data ?? []) as any[]) {
      const hotel = Array.isArray(b.travel_accom_hotels) ? b.travel_accom_hotels[0] : b.travel_accom_hotels
      const bookingRow = (bookingImgResult.data as any[])?.find((bi: any) => bi.id === b.id)
      bookingImgMap[b.id] = bookingRow?.brief_image_src ?? hotel?.hero_image_src ?? null
    }
    // Cover bookings without a hotel link
    for (const b of (bookingImgResult.data ?? []) as any[]) {
      if (!(b.id in bookingImgMap)) {
        bookingImgMap[b.id] = b.brief_image_src ?? null
      }
    }

    const diningImgMap: Record<string, string | null> = {}
    for (const d of (diningImgResult.data ?? []) as any[]) {
      diningImgMap[d.id] = d.image_src ?? null
    }

    const expImgMap: Record<string, string | null> = {}
    for (const e of (expImgResult.data ?? []) as any[]) {
      expImgMap[e.id] = e.image_src ?? null
    }

    // Attach resolved image_src to each entry
    // Full chain: room override → canon room → booking override → hotel hero
    const enrichedEntries = entries.map((entry: any) => {
      let image_src: string | null = null

      if (entry.source_booking_id) {
        image_src =
          roomImgByBooking[entry.source_booking_id]   // covers override + canon room
          ?? bookingImgMap[entry.source_booking_id]    // booking override + hotel hero
          ?? null
      } else if (entry.source_dining_id) {
        image_src = diningImgMap[entry.source_dining_id] ?? null
      } else if (entry.source_experience_id) {
        image_src = expImgMap[entry.source_experience_id] ?? null
      }
      // source_aux_id → no image

      return { ...entry, image_src }
    })

    // ── 7. Assemble destinations ──────────────────────────────────────────────
    const destinations = ((destResult.data ?? []) as any[]).map((row: any) => {
      const gd = Array.isArray(row.global_destinations) ? row.global_destinations[0] : row.global_destinations
      return {
        id:             row.id,
        destination_id: row.destination_id,
        sort_order:     row.sort_order,
        slug:           gd?.slug ?? '',
        name:           gd?.name ?? '',
        storage_path:   gd?.storage_path ?? null,
        hero_image_src: gd?.hero_image_src ?? null,
      }
    })

    // ── 8. Return ─────────────────────────────────────────────────────────────
    const payload = {
      trip: {
        ...tripResult.data,
        destinations,
        bookings: [],
        brief: briefResult.data ?? null,
      },
      brief:           briefResult.data ?? null,
      house:           houseResult.data ?? null,
      destinationName: destinations[0]?.name ?? '',
      auxBookings:     auxResult.data ?? [],
      urlId:           url_id,
      days:            daysResult.data ?? [],
      entries:         enrichedEntries,
    }

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('get-trip-programme unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})