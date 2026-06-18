// supabase/functions/travel-get-trip-confirmation/index.ts
//
// Edge Function: travel-get-trip-confirmation
// Resolves a trip confirmation brief for client-facing pages.
//
// Last updated: S43 Add 2 — deposit_paid_at + balance_paid_at added to
//   bookings select and passed through in fullBookings. Enables "Paid in Full"
//   badge on confirmation tab + brief tab + PDF. Previously both fields were
//   nulled out in the EF response, blocking the frontend from reading them.
// Prior: S54 — Contacts people. Brief now carries contact_person_ids
//   (uuid[] of a_house_people.person_id) + contact_name_format ('first'|'full').

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

async function attachPassengers(db: any, aux: any[]): Promise<any[]> {
  if (aux.length === 0) return aux
  const ids = aux.map(a => a.id)
  const { data: pax } = await db
    .from('travel_trip_aux_passengers')
    .select('id, aux_booking_id, person_id, passenger_label, confirmation_number, seat_numbers, sort_order')
    .in('aux_booking_id', ids)
    .order('sort_order', { ascending: true })
  const byAux: Record<string, any[]> = {}
  for (const p of (pax ?? [])) (byAux[p.aux_booking_id] ??= []).push(p)
  return aux.map(a => ({ ...a, passengers: byAux[a.id] ?? [] }))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { url_id } = body as { url_id?: string }

    if (!url_id || !URL_ID_REGEX.test(url_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid url_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // url_id → trip_id
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

    // trip_id → house_id
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

    // primary destination for guide checks
    const destResult2 = await db
      .from('travel_trip_destinations')
      .select('destination_id')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()
    const primaryDestId = destResult2.data?.destination_id ?? null

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
          programme_show_images, welcome_letter,
          show_tab_confirmation, show_tab_programme, show_tab_brief, show_tab_contacts,
          contact_person_ids, contact_name_format,
          created_at, updated_at
        `)
        .eq('trip_id', tripId)
        .maybeSingle(),

      db.from('a_houses')
        .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
        .eq('id', houseId)
        .single(),

      // S43 Add 2: deposit_paid_at + balance_paid_at added to select
      db.from('travel_bookings')
        .select('id, trip_id, house_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, taxes_and_fees, inclusions, party_composition, brief_show, brief_image_src, booked_by, accom_hotel_id, sort_order, deposit_paid_at, balance_paid_at, created_at, updated_at')
        .eq('house_id', houseId)
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      db.from('travel_trip_destinations')
        .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      db.from('travel_trip_aux_bookings')
        .select('id, trip_id, booking_type, name, start_date, start_time, end_date, end_time, origin, destination, notes, booked_by, brief_show, sort_order, created_at, updated_at, flight_number, airline_name, cabin_class, seat_type, aircraft_type, depart_airport, arrive_airport, airline_supplier_id')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),

      primaryDestId
        ? db.from('travel_dining_guides').select('id').eq('global_destination_id', primaryDestId).eq('is_active', true).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      primaryDestId
        ? db.from('travel_experiences_guides').select('id').eq('global_destination_id', primaryDestId).eq('is_active', true).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (tripResult.error || !tripResult.data) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bookings = bookingsResult.data ?? []

    // rooms for all bookings
    const bookingIds = bookings.map((b: any) => b.id)
    const roomsResult = bookingIds.length > 0
      ? await db.from('travel_booking_rooms')
          .select('id, booking_id, room_id, room_name, confirmation_number, guest_name, party_composition, notes, nights, brief_image_src, additional_guests, sort_order, created_at, updated_at')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }
    const rooms = roomsResult.data ?? []

    // canon rooms
    const roomIds = [...new Set(rooms.map((r: any) => r.room_id).filter(Boolean))] as string[]
    const canonRoomsResult = roomIds.length > 0
      ? await db.from('travel_accom_rooms').select('id, room_image_src, room_image_alt').in('id', roomIds)
      : { data: [], error: null }
    const canonRoomById: Record<string, { image_src: string | null; image_alt: string | null }> = {}
    for (const r of (canonRoomsResult.data ?? [])) {
      canonRoomById[r.id] = { image_src: r.room_image_src ?? null, image_alt: r.room_image_alt ?? null }
    }

    // canon hotels
    const hotelIds = [...new Set(bookings.map((b: any) => b.accom_hotel_id).filter(Boolean))] as string[]
    const hotelsResult = hotelIds.length > 0
      ? await db.from('travel_accom_hotels').select('id, name, short_slug, hero_image_src').in('id', hotelIds)
      : { data: [], error: null }
    const hotelById: Record<string, { name: string; hero_image_src: string | null }> = {}
    for (const h of (hotelsResult.data ?? [])) {
      hotelById[h.id] = { name: h.name, hero_image_src: h.hero_image_src ?? null }
    }

    const trip        = tripResult.data
    const brief       = briefResult.data ?? null
    const house       = houseResult.data ?? null
    const auxBookings = auxResult.data ?? []
    if (auxResult.error) console.error('AUX ERROR:', JSON.stringify(auxResult.error))
    if (destResult.error) console.error('DEST ERROR:', JSON.stringify(destResult.error))

    // ── Contacts: resolve brief.contact_person_ids → house people (S54) ───────
    const contacts: Array<{
      id: string; name: string; role: string | null
      email: string | null; phone: string | null
    }> = []

    const selectedIds = (brief?.contact_person_ids ?? []) as string[]
    const nameFormat  = (brief?.contact_name_format ?? 'first') as 'first' | 'full'

    if (selectedIds.length > 0) {
      const { data: hp } = await db
        .from('a_house_people')
        .select('person_id, role, member_ref, global_people(first_name, last_name, nickname, last_initial, email, phone, is_public_display)')
        .eq('house_id', houseId)
        .in('person_id', selectedIds)

      const byId: Record<string, any> = {}
      for (const row of (hp ?? [])) byId[row.person_id] = row

      for (const pid of selectedIds) {
        const row = byId[pid]
        if (!row) continue
        const gp = Array.isArray(row.global_people) ? row.global_people[0] : row.global_people
        const first = gp?.first_name ?? row.member_ref ?? ''
        const last  = gp?.last_name ?? ''
        const li    = gp?.last_initial ? `${gp.last_initial}.` : ''
        const name =
          nameFormat === 'full'
            ? [first, last].filter(Boolean).join(' ').trim()
            : (gp?.nickname?.trim() || [first, last ? li : ''].filter(Boolean).join(' ').trim() || first)
        contacts.push({
          id:    row.person_id,
          name:  name || 'Guest',
          role:  row.role ?? null,
          email: gp?.email ?? null,
          phone: gp?.phone ?? null,
        })
      }
    }

    const roomsByBooking: Record<string, any[]> = {}
    for (const r of rooms) {
      if (!roomsByBooking[r.booking_id]) roomsByBooking[r.booking_id] = []
      roomsByBooking[r.booking_id].push(r)
    }

    const destinations = ((destResult.data ?? []) as any[]).map((row: any) => {
      const gd = Array.isArray(row.global_destinations) ? row.global_destinations[0] : row.global_destinations
      return {
        id: row.id, destination_id: row.destination_id, sort_order: row.sort_order,
        slug: gd?.slug ?? '', name: gd?.name ?? '',
        storage_path: gd?.storage_path ?? null, hero_image_src: gd?.hero_image_src ?? null,
      }
    })

    const fullBookings = bookings.map((b: any) => {
      const hotel = b.accom_hotel_id ? (hotelById[b.accom_hotel_id] ?? null) : null
      const bookingRooms = roomsByBooking[b.id] ?? []
      const enrichedRooms = bookingRooms.map((r: any) => {
        const canon = r.room_id ? canonRoomById[r.room_id] : null
        return {
          ...r,
          resolved_image_src:
            r.brief_image_src ?? canon?.image_src ?? b.brief_image_src ?? hotel?.hero_image_src ?? null,
          resolved_image_alt: canon?.image_alt ?? r.room_name ?? null,
        }
      })
      return {
        ...b,
        _hotel_name:      hotel?.name ?? null,
        _hotel_image_src: hotel?.hero_image_src ?? null,
        _rooms:           enrichedRooms,
        engagement_id:    null, total_rate: null, currency: null, rate_type: null,
        price:            null, deposit_amount: null, deposit_due_date: null,
        // S43 Add 2: deposit_paid_at + balance_paid_at passed through from DB (not nulled)
        balance_amount:   null, balance_due_date: null,
        commission_pct:   null, commission_amount: null, net_revenue: null,
        commission_paid_at: null, invoice_number: null,
        iata_partner_id:  null, iata_share_pct: null, iata_share_amt: null,
        referral_partner_id: null, referral_share_pct: null, referral_share_amt: null,
        individual_id:    null, individual_share_pct: null, individual_share_amt: null,
        supplier_id:      null, supplier_name_override: null,
        primary_contact_name: null, primary_contact_role: null,
        supplier_contact_name: null, supplier_contact_whatsapp: null,
        cancellation_policy: null, booking_policy: null, notes: null,
        brief_category:   null,
      }
    })

    const payload = {
      trip: { ...trip, destinations, bookings: fullBookings, brief },
      brief,
      house,
      contacts,
      destinationName: destinations[0]?.name ?? '',
      auxBookings: await attachPassengers(db, auxBookings),
      urlId: url_id,
      guides: {
        hasDining:         !!diningGuideResult.data,
        hasExperiences:    !!experiencesGuideResult.data,
        destinationSlug:   destinations[0]?.slug ?? null,
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