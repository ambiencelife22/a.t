// supabase/functions/travel-get-trip-confirmation/index.ts
//
// Edge Function: travel-get-trip-confirmation
// Resolves a trip confirmation brief for client-facing pages.
//
// Security model:
//   - Public endpoint — no auth required
//   - url_id is the access token (11-char alphanumeric, same regex as DB constraint)
//   - All DB reads use the service role key to bypass RLS
//   - Returns only the data needed to render the confirmation page —
//     no financial, commission, or internal admin data
//
// Request body:
//   { url_id: string }
//
// Response:
//   TripClientPayload — trip, brief, house, destinations, auxBookings, urlId
//   or { error: string } on failure
//
// Join path:
//   travel_immerse_engagements.url_id
//     → travel_immerse_engagements.trip_id
//     → travel_bookings.house_id (first non-null row)
//     → travel_trips (trip row)
//     → travel_trip_briefs (brief row, may be null)
//     → a_houses (house profile)
//     → travel_trip_destinations + global_destinations (destination names)
//     → travel_booking_rooms (room cards, via travel_bookings)
//     → travel_accom_rooms (canon room — resolved per booking_room.room_id) [S53 Add 4]
//     → travel_accom_hotels (canon hero image — resolved per booking.accom_hotel_id)
//     → travel_trip_aux_bookings (flights, transfers, car services)
//
// Image resolution chain (canon-default, override-first) — UPDATED S53 Addendum 4:
//   1. travel_booking_rooms.brief_image_src     — explicit per-room override (rare)
//   2. travel_accom_rooms.room_image_src        — CANON DEFAULT (via room_id FK)
//   3. travel_bookings.brief_image_src          — booking-level override
//   4. travel_accom_hotels.hero_image_src       — hotel hero fallback
//   5. null                                     — content-only card
//
// New response fields on each booking room:
//   - resolved_image_src — what to render (post-chain resolution)
//   - resolved_image_alt — corresponding alt text
// brief_image_src remains in the response as the truth of "is there an explicit
// override". Frontend should consume resolved_image_src for rendering.
//
// Guide availability flags:
//   hasDining      — travel_dining_guides row exists + is_active for destination
//   hasExperiences — travel_experiences_guides row exists + is_active for destination
//   Both checked server-side. Client never queries guide tables directly.
//
// Deployed at: /functions/v1/travel-get-trip-confirmation
// Last updated: S53 Addendum 4 — canon room link added. travel_booking_rooms.room_id
//   → travel_accom_rooms.room_image_src is now the default image source. Closes the
//   gap where booking-instance rooms fell back to hotel hero instead of canon room
//   images. brief_image_src preserved as explicit-override field.
// Prior: S50 — renamed from get-trip-confirmation to travel-get-trip-confirmation
//   per product-prefix convention. No functional changes.
// Prior: S50 — show_advisor_email added to brief SELECT list.
//   Matches migration s50_add_show_advisor_email.
// Prior: S49 — fetch travel_accom_hotels for canon image chain.
//   S49r2 — guide availability flags (hasDining, hasExperiences).
//   S49r3 — travel_experiences_guides (correct table name).
//   S50 — show_tab_itinerary renamed to show_tab_programme in SELECT list.
//          Matches migration s50_rename_show_tab_itinerary.
// Prior: S48 — explicit column list; show_advisor_phone gate.

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

    // ── 5. Pre-fetch primary destination UUID for guide availability checks ───
    const destResult2 = await db
      .from('travel_trip_destinations')
      .select('destination_id')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()

    const primaryDestId = destResult2.data?.destination_id ?? null

    // ── 6. Parallel fetch — all data needed for the confirmation page ─────────
    const [
      tripResult,
      briefResult,
      houseResult,
      bookingsResult,
      destResult,
      auxResult,
      diningGuideResult,
      experiencesGuideResult,
    ] = await Promise.all([
      // Trip
      db.from('travel_trips')
        .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, guest_count_adults, guest_count_children')
        .eq('id', tripId)
        .single(),

      // Brief
      db.from('travel_trip_briefs')
        .select(`
          id, trip_id, house_id, brief_title, brief_subtitle, prepared_for,
          hero_image_src, hero_image_alt, logo_variant,
          snapshot_destination, snapshot_dates, snapshot_guests, snapshot_status,
          journey_steps, advisor_name, advisor_email, advisor_phone,
          show_advisor_phone, show_advisor_email,
          hotel_contact_note, important_notes, footer_tagline,
          programme_show_images, welcome_letter,
          show_tab_confirmation, show_tab_programme, show_tab_brief, show_tab_contacts,
          created_at, updated_at
        `)
        .eq('trip_id', tripId)
        .maybeSingle(),

      // House profile
      db.from('a_houses')
        .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
        .eq('id', houseId)
        .single(),

      // Bookings
      db.from('travel_bookings')
        .select('id, trip_id, house_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, taxes_and_fees, inclusions, party_composition, brief_show, brief_image_src, booked_by, accom_hotel_id, sort_order, created_at, updated_at')
        .eq('house_id', houseId)
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      // Destinations
      db.from('travel_trip_destinations')
        .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      // Aux bookings (flights, transfers, car services)
      db.from('travel_trip_aux_bookings')
        .select('id, trip_id, booking_type, name, confirmation_number, start_date, start_time, end_date, end_time, origin, destination, notes, guest_label, booked_by, brief_show, sort_order, created_at, updated_at')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      // Dining guide availability
      primaryDestId
        ? db.from('travel_dining_guides')
            .select('id')
            .eq('global_destination_id', primaryDestId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      // Experiences guide availability
      primaryDestId
        ? db.from('travel_experiences_guides')
            .select('id')
            .eq('global_destination_id', primaryDestId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (tripResult.error || !tripResult.data) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bookings = bookingsResult.data ?? []

    // ── 7. Fetch rooms for all bookings ───────────────────────────────────────
    // S53 Add 4: room_id added to SELECT for canon image resolution
    const bookingIds = bookings.map((b: any) => b.id)
    const roomsResult = bookingIds.length > 0
      ? await db.from('travel_booking_rooms')
          .select('id, booking_id, room_id, room_name, confirmation_number, guest_name, party_composition, notes, nights, brief_image_src, additional_guests, booked_by_label, sort_order, created_at, updated_at')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }

    const rooms = roomsResult.data ?? []

    // ── 7a. Fetch canon room data via room_id FK (S53 Addendum 4) ─────────────
    // The new canon link. travel_booking_rooms.room_id → travel_accom_rooms.id.
    // Canon's room_image_src + room_image_alt become the default image source
    // when no per-room override (brief_image_src) is set.
    const roomIds = [...new Set(
      rooms.map((r: any) => r.room_id).filter(Boolean)
    )] as string[]

    const canonRoomsResult = roomIds.length > 0
      ? await db.from('travel_accom_rooms')
          .select('id, room_image_src, room_image_alt')
          .in('id', roomIds)
      : { data: [], error: null }

    const canonRoomById: Record<string, { image_src: string | null; image_alt: string | null }> = {}
    for (const r of (canonRoomsResult.data ?? [])) {
      canonRoomById[r.id] = {
        image_src: r.room_image_src ?? null,
        image_alt: r.room_image_alt ?? null,
      }
    }

    // ── 8. Fetch canon hotel data for image overlay chain ─────────────────────
    const hotelIds = [...new Set(
      bookings
        .map((b: any) => b.accom_hotel_id)
        .filter(Boolean)
    )] as string[]

    const hotelsResult = hotelIds.length > 0
      ? await db.from('travel_accom_hotels')
          .select('id, name, short_slug, hero_image_src')
          .in('id', hotelIds)
      : { data: [], error: null }

    const hotelById: Record<string, { name: string; hero_image_src: string | null }> = {}
    for (const h of (hotelsResult.data ?? [])) {
      hotelById[h.id] = { name: h.name, hero_image_src: h.hero_image_src ?? null }
    }

    // ── 9. Assemble response ──────────────────────────────────────────────────
    const trip        = tripResult.data
    const brief       = briefResult.data ?? null
    const house       = houseResult.data ?? null
    const auxBookings = auxResult.data ?? []

    // Group rooms by booking_id
    const roomsByBooking: Record<string, any[]> = {}
    for (const r of rooms) {
      if (!roomsByBooking[r.booking_id]) roomsByBooking[r.booking_id] = []
      roomsByBooking[r.booking_id].push(r)
    }

    // Resolve destinations
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

    // Attach rooms + canon image resolution + hotel data to bookings
    const fullBookings = bookings.map((b: any) => {
      const hotel = b.accom_hotel_id ? (hotelById[b.accom_hotel_id] ?? null) : null
      const bookingRooms = roomsByBooking[b.id] ?? []

      // S53 Add 4: Resolve image chain per room — canon-default, override-first
      const enrichedRooms = bookingRooms.map((r: any) => {
        const canon = r.room_id ? canonRoomById[r.room_id] : null
        return {
          ...r,
          // resolved_image_src = what to render (post-chain)
          resolved_image_src:
            r.brief_image_src             // 1. Per-room explicit override (rare)
            ?? canon?.image_src            // 2. Canon room hero (DEFAULT)
            ?? b.brief_image_src           // 3. Booking-level override
            ?? hotel?.hero_image_src       // 4. Hotel hero fallback
            ?? null,
          resolved_image_alt:
            canon?.image_alt
            ?? r.room_name
            ?? null,
        }
      })

      return {
        ...b,
        _hotel_name:      hotel?.name ?? null,
        _hotel_image_src: hotel?.hero_image_src ?? null,
        _rooms:           enrichedRooms,
        // Stub financial + internal fields — not needed on confirmation surface
        engagement_id: null, total_rate: null, currency: null, rate_type: null,
        price: null, deposit_amount: null, deposit_due_date: null, deposit_paid_at: null,
        balance_amount: null, balance_due_date: null, balance_paid_at: null,
        commission_pct: null, commission_amount: null, net_revenue: null,
        commission_paid_at: null, invoice_number: null,
        iata_partner_id: null, iata_share_pct: null, iata_share_amt: null,
        referral_partner_id: null, referral_share_pct: null, referral_share_amt: null,
        individual_id: null, individual_share_pct: null, individual_share_amt: null,
        supplier_id: null, supplier_name_override: null,
        primary_contact_name: null, primary_contact_role: null,
        supplier_contact_name: null, supplier_contact_whatsapp: null,
        cancellation_policy: null, booking_policy: null, notes: null,
        brief_category: null,
      }
    })

    const payload = {
      trip: {
        ...trip,
        destinations,
        bookings: fullBookings,
        brief,
      },
      brief,
      house,
      destinationName: destinations[0]?.name ?? trip.trip_code,
      auxBookings,
      urlId: url_id,
      guides: {
        hasDining:       !!diningGuideResult.data,
        hasExperiences:  !!experiencesGuideResult.data,
        destinationSlug: destinations[0]?.slug ?? null,
      },
    }

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('travel-get-trip-confirmation unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})