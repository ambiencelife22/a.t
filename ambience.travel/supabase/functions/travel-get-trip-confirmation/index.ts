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
import { attachPassengers, attachDriverDetails } from '../_shared/names.ts'
import { resolveTripIds, fetchTripCore, fetchTripBookings } from '../_shared/trip.ts'
import { corsHeaders, preflight } from '../_shared/http.ts'

const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

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
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // url_id → trip_id → house_id (single-source)
    const ids = await resolveTripIds(db, url_id)
    if (!ids) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { tripId, houseId } = ids

    // primary destination for guide checks
    const destResult2 = await db
      .from('travel_trip_destinations')
      .select('destination_id')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()
    const primaryDestId = destResult2.data?.destination_id ?? null

    // core trip data (single-source) + confirmation-specific bookings/aux/guides
    const [
      core,
      bookingsResult,
      auxResult,
      diningGuideResult,
      experiencesGuideResult,
    ] = await Promise.all([
      fetchTripCore(db, tripId, houseId),

      // confirmation needs financial-adjacent columns (deposit/balance paid, taxes)
      db.from('travel_bookings')
        .select('id, trip_id, house_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, taxes_and_fees, inclusions, party_composition, brief_show, brief_image_src, booked_by, accom_hotel_id, sort_order, deposit_paid_at, balance_paid_at, created_at, updated_at')
        .eq('house_id', houseId)
        .eq('trip_id', tripId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('end_date',   { ascending: true, nullsFirst: false })
        .order('id',         { ascending: true }),

      db.from('travel_trip_aux_bookings')
        .select('id, trip_id, booking_type, name, start_date, start_time, end_date, end_time, origin, destination, notes, confirmation_number, booked_by, brief_show, sort_order, created_at, updated_at, flight_number, airline_name, cabin_class, seat_type, aircraft_type, depart_airport, arrive_airport, airline_supplier_id')
        .eq('trip_id', tripId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('start_time', { ascending: true, nullsFirst: false }),

      primaryDestId
        ? db.from('travel_dining_guides').select('id').eq('global_destination_id', primaryDestId).eq('is_active', true).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      primaryDestId
        ? db.from('travel_experiences_guides').select('id').eq('global_destination_id', primaryDestId).eq('is_active', true).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (!core.trip) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const trip         = core.trip
    const brief        = core.brief
    const house        = core.house
    const destinations = core.destinations
    const bookings     = bookingsResult.data ?? []
    const auxBookings  = auxResult.data ?? []
    if (auxResult.error) console.error('AUX ERROR:', JSON.stringify(auxResult.error))

    // shared bookings enrich (rooms + resolved guest names + canon/hotel maps)
    const partyLabel = (brief?.prepared_for as string | null) ?? null
    const { roomsByBooking, canonRoomById, hotelById } = await fetchTripBookings(db, bookings, partyLabel)

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

    const fullBookings = bookings.map((b: any) => {
      const hotel = b.accom_hotel_id ? (hotelById[b.accom_hotel_id] ?? null) : null
      const bookingRooms = roomsByBooking[b.id] ?? []
      const enrichedRooms = bookingRooms.map((r: any) => {
        const canon = r.room_id ? canonRoomById[r.room_id] : null
        return {
          ...r,
          // resolved_guest_name already set by fetchTripBookings (single-source)
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
      auxBookings: await attachDriverDetails(db, await attachPassengers(db, auxBookings, (brief?.prepared_for as string | null) ?? null)),
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