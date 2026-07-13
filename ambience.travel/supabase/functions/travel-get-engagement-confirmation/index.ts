// supabase/functions/travel-get-engagement-confirmation/index.ts
//
// Edge Function: travel-get-engagement-confirmation
// Resolves a trip confirmation brief for client-facing pages.
//
// Last updated: S43 Add 2 — deposit_paid_at + balance_paid_at added to
//   bookings select and passed through in fullBookings. Enables "Paid in Full"
//   badge on confirmation tab + brief tab + PDF. Previously both fields were
//   nulled out in the EF response, blocking the frontend from reading them.
// Prior: S54 — Contacts people. Brief now carries contact_person_ids
//   (uuid[] of a_house_people.person_id) + contact_name_format ('first'|'full').

import { createServiceClient } from '../_shared/client.ts'
import { resolvejourneyIds, fetchEngagementCore, fetchEngagementBookings, fetchElementsFlat, enrichElements } from '../_shared/engagement.ts'
import { derivePaymentException } from '../_shared/elementStatus.ts'
import { json, preflight } from '../_shared/http.ts'
import { checkPublicView } from '../_shared/visibility.ts'

const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { url_id } = body as { url_id?: string }

    if (!url_id || !URL_ID_REGEX.test(url_id)) {
      return json({ error: 'Invalid url_id' }, 400)
    }

    const db = createServiceClient()
    // url_id → trip_id → house_id (single-source)
    // Gate on public_view before serving any data.
    const visibilityGate = await checkPublicView(db, url_id)
    if (visibilityGate) return visibilityGate

    const ids = await resolvejourneyIds(db, url_id)
    if (!ids) {
      return json({ error: 'Not found' }, 404)
    }
    const { journeyId, houseId } = ids

    // core trip data (single-source) + confirmation-specific bookings/aux
    const [
      core,
      bookingsResult,
    ] = await Promise.all([
      fetchEngagementCore(db, journeyId, houseId),

      // confirmation needs financial-adjacent columns (deposit/balance paid, taxes)
      db.from('travel_bookings')
        .select('id, journey_id, house_id, name, status, confirmation_number, start_date, check_in_date, start_time, check_in_note, check_out_note, end_date, nights, commissionable_rate, taxes_and_fees, inclusions, inclusions_override, cancellation_policy, party_composition, brief_show, brief_image_src, booked_by, accom_hotel_id, sort_order, deposit_paid_at, balance_paid_at, balance_due_date, payment_exception_override, created_at, updated_at')
        .eq('house_id', houseId)
        .eq('journey_id', journeyId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('end_date',   { ascending: true, nullsFirst: false })
        .order('id',         { ascending: true }),
    ])

    if (!core.trip) {
      return json({ error: 'Trip not found' }, 404)
    }

    const trip         = core.trip
    const brief        = core.brief
    const house        = core.house
    // HPGL: canonical public guest label (projected, single-source via _shared/engagement.ts).
    // resolved_guest_label wins; prepared_for is the legacy fallback. Never ||.
    const guestDisplayName = core.resolved_guest_label ?? ((brief?.prepared_for as string | null) ?? null)
    const destinations = core.destinations
    const bookings     = bookingsResult.data ?? []

    // Fetch engagement links using confirmed_engagement_id from trip row.
    const confirmedEngagementId = (trip?.confirmed_engagement_id as string | null) ?? null
    const engagementLinksResult = confirmedEngagementId
      ? await db
          .from('travel_engagement_links')
          .select('id, link_type, label, url, sort_order, is_highlighted, travel_engagement_link_content(title, body, kicker, image_src, image_alt)')
          .eq('engagement_id', confirmedEngagementId)
          .eq('is_active', true)
          .eq('show_on_confirmation', true)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }
    const bookingIds = bookings.map((b: any) => b.id)
    const invoicesResult = bookingIds.length > 0
      ? await db
          .from('travel_booking_invoices')
          .select('id, booking_id, invoice_number, invoice_date, amount, currency, description, sort_order')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }
    const invoicesByBooking: Record<string, any[]> = {}
    for (const inv of invoicesResult.data ?? []) {
      const bid = inv.booking_id as string
      if (!invoicesByBooking[bid]) invoicesByBooking[bid] = []
      invoicesByBooking[bid].push(inv)
    }

    // shared bookings enrich (rooms + resolved guest names + canon/hotel maps)
    const partyLabel = (brief?.prepared_for as string | null) ?? null
    const { roomsByBooking, canonRoomById, hotelById } = await fetchEngagementBookings(db, bookings, partyLabel, houseId)

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

    const todayUTC = new Date().toISOString().slice(0, 10)

    const fullBookings = bookings.map((b: any) => {
      const hotel = b.accom_hotel_id ? (hotelById[b.accom_hotel_id] ?? null) : null
      const bookingRooms = roomsByBooking[b.id] ?? []
      const enrichedRooms = bookingRooms.map((r: any) => {
        const canon = r.room_id ? canonRoomById[r.room_id] : null
        return {
          ...r,
          // resolved_guest_name already set by fetchEngagementBookings (single-source)
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
        _invoices:        invoicesByBooking[b.id] ?? [],
        engagement_id:    null, total_rate: null, currency: null, rate_type: null,
        price:            null, deposit_amount: null, deposit_due_date: null,
        // S43 Add 2: deposit_paid_at + balance_paid_at passed through from DB (not nulled)
        balance_amount:   null, balance_due_date: null,
        // Only the derived boolean reaches the payload; the raw date + override
        // are read for the compute but never re-exposed to the guest.
        payment_exception: derivePaymentException(
          { balance_due_date: b.balance_due_date ?? null, balance_paid_at: b.balance_paid_at ?? null, payment_exception_override: b.payment_exception_override ?? null },
          todayUTC,
        ),
        commission_pct:   null, commission_amount: null, net_revenue: null,
        commission_paid_at: null, invoice_number: null,
        iata_partner_id:  null, iata_share_pct: null, iata_share_amt: null,
        referral_partner_id: null, referral_share_pct: null, referral_share_amt: null,
        individual_id:    null, individual_share_pct: null, individual_share_amt: null,
        supplier_id:      null, supplier_name_override: null,
        primary_contact_name: null, primary_contact_role: null,
        supplier_contact_name: null, supplier_contact_whatsapp: null,
        cancellation_policy: (b.cancellation_policy ?? null) as string | null,
        booking_policy: null, notes: null,
        brief_category:   null,
      }
    })

    const payload = {
      trip: { ...trip, destinations, bookings: fullBookings, brief },
      brief,
      house,
      contacts,
      guestDisplayName,
      destinationName: destinations[0]?.name ?? '',
      auxBookings: await enrichElements(
              db,
              await fetchElementsFlat(db, (core.trip?.confirmed_engagement_id as string | null) ?? null),
              (brief?.prepared_for as string | null) ?? null,
            ),
      urlId: url_id,
      links: (engagementLinksResult.data ?? [] as unknown[]).map((l: any) => ({
        id:         l.id,
        link_type:      l.link_type,
        label:          l.label,
        url:            l.url,
        sort_order:     l.sort_order,
        is_highlighted: l.is_highlighted ?? false,
        travel_engagement_link_content: Array.isArray(l.travel_engagement_link_content) && l.travel_engagement_link_content.length > 0
          ? l.travel_engagement_link_content[0]
          : null,
      })),
    }

    return json(payload, 200)

  } catch (err) {
    console.error('travel-get-engagement-confirmation unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})