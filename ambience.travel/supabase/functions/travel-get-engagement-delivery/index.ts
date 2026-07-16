// supabase/functions/travel-get-engagement-delivery/index.ts
//
// Edge Function: travel-get-engagement-delivery
// THE single delivery source. Replaces travel-get-engagement-confirmation +
// travel-get-engagement-programme (both retired). Assembles the complete engagement
// ONCE — core, bookings, elements, contacts, links, days, timeline — and returns one
// bundle. The client fetches this once; the Confirmation / Programme / Brief / Contacts
// tabs are VIEWS over the one payload. No second EF, no client-side stitching, no
// parallel timeline build.
//
// Response bundle:
//   journey, brief, house, contacts, supplierContacts, guestDisplayName,
//   destinationName, elements, links, urlId, fullBookings, days, entries
//
//   - fullBookings : confirmation booking shape (rooms, invoices, payment_exception,
//                    financials nulled) — the Confirmation tab reads these.
//   - entries      : the single-source ordered timeline (TimelineItem[]) built by
//                    _shared/timeline.ts from the SAME enrichedBookings + elements +
//                    stored entries — the Programme tab + PDFs read this.
//   - elements     : the enriched element tree (enrichElements) — venue content
//                    (image + facts) resolved via supplier_id -> travel_venue_content.
//   - days         : buildDays over the journey span + overrides.
//
// One enrichElements call feeds BOTH the elements array and buildTimeline, so a
// reservation (e.g. a beach-club table) renders identically on Confirmation and
// Programme — the divergence that a two-EF split produced is structurally gone.
//
// Security: public endpoint; url_id is the access token; service role via
// createServiceClient; gated on public_view before any data is served.

import { createServiceClient } from '../_shared/client.ts'
import { json, preflight } from '../_shared/http.ts'
import { checkPublicView } from '../_shared/visibility.ts'
import { resolvejourneyIds, fetchEngagementCore, fetchEngagementBookings, fetchEngagementElements, enrichElements } from '../_shared/engagement.ts'
import { derivePaymentException } from '../_shared/elementStatus.ts'
import { buildTimeline } from '../_shared/timeline.ts'
import { buildDays } from '../_shared/days.ts'
import { enrichBookingWithHotelPolicy } from '../_shared/expenses.ts'

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

    // Gate on public_view before serving any data.
    const visibilityGate = await checkPublicView(db, url_id)
    if (visibilityGate) return visibilityGate

    const ids = await resolvejourneyIds(db, url_id)
    if (!ids) {
      return json({ error: 'Not found' }, 404)
    }
    const { journeyId, houseId } = ids

    // ── ONE parallel fetch: core + the full booking column set (superset of both
    // former EFs — financial-adjacent cols AND the hotel-policy join) + days + entries.
    const [
      core,
      bookingsResult,
      daysResult,
      entriesResult,
    ] = await Promise.all([
      fetchEngagementCore(db, journeyId, houseId),

      // Superset booking select: confirmation's financial-adjacent columns
      // (deposit/balance/taxes/payment_exception) + the programme's hotel-policy join.
      db.from('travel_bookings')
        .select(`
          id, journey_id, house_id, name, status, confirmation_number,
          start_date, check_in_date, start_time, check_in_note, check_out_note,
          early_checkin_approved_time, late_checkout_approved_time, expected_arrival_time,
          end_date, nights, commissionable_rate, taxes_and_fees, inclusions,
          inclusions_override, cancellation_policy, party_composition, brief_show,
          brief_image_src, booked_by, accom_hotel_id, sort_order,
          deposit_paid_at, balance_paid_at, balance_due_date, payment_exception_override,
          created_at, updated_at,
          travel_accom_hotels!accom_hotel_id(
            standard_checkin_time,
            standard_checkout_time
          )
        `)
        .eq('house_id', houseId)
        .eq('journey_id', journeyId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('end_date',   { ascending: true, nullsFirst: false })
        .order('id',         { ascending: true }),

      db.from('travel_journey_days')
        .select('id, engagement_id:journey_id, entry_date, show, day_label, day_note')
        .eq('journey_id', journeyId),

      db.from('travel_journey_day_entries')
        .select('id, engagement_id:journey_id, entry_date, start_time, end_time, title, subtitle, category, booked_by, confirmation_number, guest_label, notes, brief_show, sort_order, source_booking_id, source_aux_id, source_dining_id, source_experience_id')
        .eq('journey_id', journeyId)
        .eq('brief_show', true)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true }),
    ])

    if (!core.journey) {
      return json({ error: 'Engagement not found' }, 404)
    }

    const trip         = core.journey
    const brief        = core.brief
    const house        = core.house
    const guestDisplayName = core.resolved_guest_label ?? ((brief?.prepared_for as string | null) ?? null)
    const destinations = core.destinations
    const partyLabel   = (brief?.prepared_for as string | null) ?? null
    const bookings     = (bookingsResult.data ?? []) as Array<Record<string, unknown>>
    const entries      = (entriesResult.data ?? []) as Array<Record<string, unknown>>
    const confirmedEngagementId = (trip?.confirmed_engagement_id as string | null) ?? null

    // ── Links (confirmation) ──────────────────────────────────────────────────
    const engagementLinksResult = confirmedEngagementId
      ? await db
          .from('travel_engagement_links')
          .select('id, link_type, label, url, sort_order, is_highlighted, travel_engagement_link_content(title, body, kicker, image_src, image_alt)')
          .eq('engagement_id', confirmedEngagementId)
          .eq('is_active', true)
          .eq('show_on_confirmation', true)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }

    // ── Invoices (confirmation) ───────────────────────────────────────────────
    const bookingIds = bookings.map(b => b.id as string)
    const invoicesResult = bookingIds.length > 0
      ? await db
          .from('travel_booking_invoices')
          .select('id, booking_id, invoice_number, invoice_date, amount, currency, description, sort_order')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : { data: [], error: null }
    const invoicesByBooking: Record<string, Array<Record<string, unknown>>> = {}
    for (const inv of (invoicesResult.data ?? []) as Array<Record<string, unknown>>) {
      const bid = inv.booking_id as string
      ;(invoicesByBooking[bid] ??= []).push(inv)
    }

    // ── ONE bookings enrich (rooms + resolved guest names + canon/hotel maps) ──
    const { roomsByBooking, canonRoomById, hotelById } = await fetchEngagementBookings(db, bookings, partyLabel, houseId)

    // ── ONE elements enrich — feeds BOTH the elements array and buildTimeline.
    // Venue content (image + facts) resolves via supplier_id -> travel_venue_content.
    const elements = await enrichElements(
      db,
      await fetchEngagementElements(db, confirmedEngagementId),
      partyLabel,
    )

    // ── Contacts (confirmation) ───────────────────────────────────────────────
    const contacts: Array<Record<string, unknown>> = []
    const selectedIds = (brief?.contact_person_ids ?? []) as string[]
    const nameFormat  = (brief?.contact_name_format ?? 'first') as 'first' | 'full'
    if (selectedIds.length > 0) {
      const { data: gc } = await db.rpc('get_engagement_guest_contacts', {
        p_house_id:    houseId,
        p_person_ids:  selectedIds,
        p_name_format: nameFormat,
      })
      const byId: Record<string, Record<string, unknown>> = {}
      for (const c of (gc ?? []) as Array<Record<string, unknown>>) byId[c.id as string] = c
      for (const pid of selectedIds) {
        const c = byId[pid]
        if (!c) continue
        contacts.push({
          id: c.id, name: c.name ?? 'Guest', role: c.role ?? null,
          email: c.email ?? null, phone: c.phone ?? null, whatsapp: c.whatsapp ?? null,
        })
      }
    }

    const supplierContacts: Array<Record<string, unknown>> = []
    const supplierContactIds = (brief?.contact_supplier_contact_ids ?? []) as string[]
    if (supplierContactIds.length > 0) {
      const { data: sc } = await db.rpc('get_engagement_supplier_contacts', {
        p_contact_ids: supplierContactIds,
      })
      const sById: Record<string, Record<string, unknown>> = {}
      for (const c of (sc ?? []) as Array<Record<string, unknown>>) sById[c.id as string] = c
      for (const sid of supplierContactIds) {
        const c = sById[sid]
        if (!c) continue
        supplierContacts.push({
          id: c.id, name: c.name ?? 'Contact', role: c.role ?? null,
          email: c.email ?? null, phone: c.phone ?? null, whatsapp: c.whatsapp ?? null,
        })
      }
    }

    // ── Programme image composition (canon-default, override-first) per booking ─
    const roomImgByBooking: Record<string, string | null> = {}
    for (const [bid, bRooms] of Object.entries(roomsByBooking)) {
      const r = bRooms[0]
      const canon = r?.room_id ? canonRoomById[r.room_id as string] : undefined
      const roomOverride = (r?.brief_image_src as string | null) ?? null
      const canonImg     = canon ? canon.image_src : null
      roomImgByBooking[bid] = roomOverride ?? canonImg
    }

    // ── enrichedBookings — carries hotel policy (_standard_checkin/checkout_time)
    // for the timeline three-field model. This is the booking shape buildTimeline reads.
    const enrichedBookings = bookings.map(b => {
      const bid     = b.id as string
      const hotelId = b.accom_hotel_id as string | null
      const hotel   = hotelId ? (hotelById[hotelId] ?? null) : null
      const displayImg =
        roomImgByBooking[bid]
        ?? (b.brief_image_src as string | null)
        ?? (hotel?.hero_image_src ?? null)
      return enrichBookingWithHotelPolicy({
        ...b,
        _hotel_name:      hotel?.name ?? null,
        _hotel_image_src: displayImg,
        _rooms:           roomsByBooking[bid] ?? [],
      })
    })

    // ── Standalone-entry images — via the SAME venue-content resolver, by
    // source venue id -> its supplier -> travel_venue_content. One image path.
    const entryVenueIds = [...new Set(
      entries.flatMap(e => [e.source_dining_id, e.source_experience_id].filter(Boolean)),
    )] as string[]
    const entryImgByVenueId: Record<string, string | null> = {}
    if (entryVenueIds.length > 0) {
      // resolve venue -> supplier_id (dining + experiences), then supplier -> content
      const [dv, ex] = await Promise.all([
        db.from('travel_dining_venues').select('id, supplier_id').in('id', entryVenueIds),
        db.from('travel_experiences').select('id, supplier_id').in('id', entryVenueIds),
      ])
      const supplierByVenue: Record<string, string> = {}
      for (const row of [...((dv.data ?? []) as Array<Record<string, unknown>>), ...((ex.data ?? []) as Array<Record<string, unknown>>)]) {
        if (row.supplier_id) supplierByVenue[row.id as string] = row.supplier_id as string
      }
      const supIds = [...new Set(Object.values(supplierByVenue))]
      const imgBySupplier: Record<string, string | null> = {}
      if (supIds.length > 0) {
        const { data: vc } = await db.from('travel_venue_content')
          .select('supplier_id, image_src').in('supplier_id', supIds)
        for (const row of (vc ?? []) as Array<Record<string, unknown>>) {
          imgBySupplier[row.supplier_id as string] = (row.image_src as string | null) ?? null
        }
      }
      for (const [vid, sid] of Object.entries(supplierByVenue)) {
        entryImgByVenueId[vid] = imgBySupplier[sid] ?? null
      }
    }
    const enrichedEntries = entries.map(e => ({
      ...e,
      image_src:
        (e.source_dining_id     ? entryImgByVenueId[e.source_dining_id as string]     : null)
        ?? (e.source_experience_id ? entryImgByVenueId[e.source_experience_id as string] : null)
        ?? null,
    }))

    // ── ONE timeline build — same enrichedBookings + elements + entries ────────
    const timeline = buildTimeline(enrichedBookings, elements, enrichedEntries)

    // ── fullBookings — the confirmation booking shape (financials nulled) ──────
    const todayUTC = new Date().toISOString().slice(0, 10)
    const fullBookings = bookings.map(b => {
      const hotelId = b.accom_hotel_id as string | null
      const hotel   = hotelId ? (hotelById[hotelId] ?? null) : null
      const bookingRooms = roomsByBooking[b.id as string] ?? []
      const enrichedRooms = bookingRooms.map(r => {
        const canon = r.room_id ? canonRoomById[r.room_id as string] : null
        return {
          ...r,
          resolved_image_src:
            (r.brief_image_src as string | null) ?? canon?.image_src ?? (b.brief_image_src as string | null) ?? hotel?.hero_image_src ?? null,
          resolved_image_alt: canon?.image_alt ?? (r.room_name as string | null) ?? null,
        }
      })
      return {
        ...b,
        _hotel_name:      hotel?.name ?? null,
        _hotel_image_src: hotel?.hero_image_src ?? null,
        standard_checkin_time: hotel?.standard_checkin_time ?? null,
        approved_checkin_time: b.early_checkin_approved_time ?? null,
        expected_arrival_time: b.expected_arrival_time ?? null,
        _rooms:           enrichedRooms,
        _invoices:        invoicesByBooking[b.id as string] ?? [],
        engagement_id:    null, total_rate: null, currency: null,
        price:            null, deposit_amount: null, deposit_due_date: null,
        balance_amount:   null, balance_due_date: null,
        payment_exception: derivePaymentException(
          { balance_due_date: (b.balance_due_date as string | null) ?? null, balance_paid_at: (b.balance_paid_at as string | null) ?? null, payment_exception_override: (b.payment_exception_override as boolean | null) ?? null },
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
        cancellation_policy: (b.cancellation_policy as string | null) ?? null,
        booking_policy: null, notes: null, brief_category: null,
      }
    })

    // ── ONE bundle — tabs are views over this ─────────────────────────────────
    const payload = {
      journey:          { ...trip, destinations, bookings: fullBookings, brief },
      brief,
      house,
      contacts,
      supplierContacts,
      guestDisplayName,
      destinationName:  (destinations[0]?.name as string) ?? '',
      elements,
      links: ((engagementLinksResult.data ?? []) as Array<Record<string, unknown>>).map(l => ({
        id: l.id, link_type: l.link_type, label: l.label, url: l.url,
        sort_order: l.sort_order, is_highlighted: l.is_highlighted ?? false,
        travel_engagement_link_content: Array.isArray(l.travel_engagement_link_content) && l.travel_engagement_link_content.length > 0
          ? l.travel_engagement_link_content[0]
          : null,
      })),
      urlId:            url_id,
      fullBookings,
      days: buildDays(
        journeyId,
        trip.start_date as string | null,
        trip.end_date as string | null,
        (daysResult.data ?? []) as Array<Record<string, unknown>>,
      ).filter(d => d.show),
      entries: timeline,
    }

    return json(payload, 200)

  } catch (err) {
    console.error('travel-get-engagement-delivery unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})