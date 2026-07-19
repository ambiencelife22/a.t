// supabase/functions/_shared/timeline.ts
// Single-source trip timeline. Builds the ordered day-stream ONCE, server-side,
// from already-fetched bookings + aux + standalone entries. The programme EF
// calls buildTimeline and returns the result as `entries`; the programme tab and
// PDF render the stream as-is (no client-side derivation).
//
// Hotel check-in/out are DERIVED from bookings (never stored). Standalone entries
// (dining, experiences, notes — anything without a booking source) pass through.
// Aux (flights/transfers) are derived from aux bookings, carrying passengers.
//
// Same-day ordering canon: check-out (morning, depart) → timed items (by
// start_time) → untimed check-in (afternoon, arrive). A check-in WITH a start_time
// sorts by that time among the day's items (e.g. a 09:00 check-in slots in the
// morning); an untimed check-in falls to the bottom.
//
// Check-in / arrival model (S53N, three distinct fields):
//   standard_checkin_time - hotel published policy (always shown).
//   approved_checkin_time - negotiated early check-in (shown if set).
//   expected_arrival_time - when the guest physically arrives (shown if set),
//     distinct from check-in. Set explicitly on the booking, not derived.
//
// Early check-in / late check-out approved times surface as check_in_note /
// check_out_note on the TimelineItem when set — guest-facing context, never
// used for sort ordering.
//
// Check-in/out NOTES (e.g. an early-check-in half-rate arrangement) ride on the
// derived items so every surface — confirmation, programme, brief, all PDFs —
// shows the concierge's intention. The note is guest-facing context, never an
// internal artifact.

// ── Public item shape ─────────────────────────────────────────────────────────

import type { TimelineRoom, TimelinePassenger, TimelineDriverDetail, TimelineItem } from './typesTimeline.ts'
export type { TimelineRoom, TimelinePassenger, TimelineDriverDetail, TimelineItem }

// ── Input shapes (loose — these are already-fetched DB rows) ───────────────────

type BookingLike = {
  id?:                            unknown
  booking_type?:                  string | null
  name?:                          string | null
  start_date?:                    string | null
  check_in_date?:                 string | null
  end_date?:                      string | null
  brief_show?:                    boolean
  booked_by?:                     string | null
  status?:                        string | null
  check_in_note?:                 string | null
  check_out_note?:                string | null
  _hotel_name?:                   string | null
  _hotel_image_src?:              string | null
  brief_image_src?:               string | null
  _rooms?:                        Record<string, unknown>[]
  // Derived check-in fields (S53G)
  transfer_minutes?:              number | null  // offset in minutes from preceding arrival
  early_checkin_approved_time?:   string | null  // HH:MM, approved early check-in (distinct field)
  late_checkout_approved_time?:   string | null  // HH:MM, approved late check-out
  expected_arrival_time?:         string | null  // HH:MM, when guest physically arrives (distinct from check-in)
  // Hotel policy (joined from travel_accom_hotels)
  _standard_checkin_time?:        string | null  // HH:MM, hotel's published check-in time
  _standard_checkout_time?:       string | null  // HH:MM, hotel's published check-out time
  [k: string]:                    unknown
}

type EngagementElementLike = {
  id?:                  unknown
  element_type?:        string | null
  element_type_label?:  string | null
  name?:                string | null
  start_date?:          string | null
  end_date?:            string | null   // arrival date — used for same-day match
  start_time?:          string | null
  end_time?:            string | null   // arrival time — used for derivation
  origin?:              string | null
  destination?:         string | null
  notes?:               string | null
  booked_by?:           string | null
  brief_show?:          boolean
  cabin_class?:         string | null
  aircraft_type?:       string | null
  passengers?:          Record<string, unknown>[]
  [k: string]:          unknown
}

type EntryLike = {
  id?:                  unknown
  entry_date?:          string
  start_time?:          string | null
  end_time?:            string | null
  title?:               string | null
  subtitle?:            string | null
  category?:            string | null
  booked_by?:           string | null
  confirmation_number?: string | null
  guest_label?:         string | null
  notes?:               string | null
  brief_show?:          boolean
  image_src?:           string | null
  source_booking_id?:   string | null
  source_aux_id?:       string | null
  [k: string]:          unknown
}

// ── Check-in / arrival model (three distinct fields) ──────────────────────────
//
// Each hotel_checkin item carries three separate, independently-nullable times.
// The render shows each on its own line and hides nulls; none is labeled the
// other's name:
//   standard_checkin_time  - hotel published policy (from _standard_checkin_time). Always.
//   approved_checkin_time  - negotiated early check-in (early_checkin_approved_time). If set.
//   expected_arrival_time  - when the guest physically arrives. If set. NOT a check-in.
//
// deriveCheckinTime() retired S53N: it derived an arrival time (flight + transfer)
// and mislabeled it "check-in". Arrival now lives in its own field
// (travel_bookings.expected_arrival_time); the three concepts are no longer conflated.
// (travel_bookings.expected_arrival_time), so the three concepts are distinct:
// standard check-in (hotel policy), approved early check-in, expected arrival.

// ── Builders ───────────────────────────────────────────────────────────────────

// Hotel check-in (with rooms) + check-out (bare) from each shown booking.
// resolved_guest_name is set by the caller (names.ts) before this runs.
export function buildHotelItems(bookings: BookingLike[]): TimelineItem[] {
  const out: TimelineItem[] = []

  // Pre-pass: detect re-check-ins (split stays). A re-check-in is the SAME PARTY
  // returning to a hotel they already stayed at earlier on this trip — not merely
  // any second booking at a shared hotel. Party identity = the occupant set (each
  // room's lead person_id + additional_guests uuids, unioned across the booking).
  // A booking is a re-check-in iff one of its occupants appears in an
  // earlier-STARTING stay at the same hotel. Disjoint parties sharing a hotel
  // (e.g. a guest booked into a property the principal's entourage also occupies)
  // are independent FIRST check-ins, each labelled "Check-in", not "Re-Check-in".
  // Ordered by start_date — the earliest stay for any given person is their
  // check-in; a later overlapping stay is their re-check-in.
  const reCheckin = new Set<string>()

  const occupantsOf = (b: BookingLike): Set<string> => {
    const s = new Set<string>()
    for (const r of (b._rooms ?? [])) {
      const pid = r.person_id as string | null
      if (pid) s.add(pid)
      for (const g of ((r.additional_guests as string[] | null) ?? [])) s.add(g)
    }
    return s
  }

  // Hotel-eligible bookings, ordered by start_date (stable). For each, if any
  // occupant already appeared at this hotel in an earlier stay, it's a re-check-in.
  const hotelBookings = bookings
    .filter(b => b.brief_show !== false)
    .filter(b => !!b.accom_hotel_id || (b._rooms?.length ?? 0) > 0)
    .filter(b => !!b.start_date)
    .slice()
    .sort((x, y) => (x.start_date as string).localeCompare(y.start_date as string))

  // Per hotel: the set of occupants seen in stays that STARTED strictly earlier.
  const seenByHotel = new Map<string, Set<string>>()
  // Group by hotel + exact range so concurrent rooms (same party, same dates,
  // split across booking rows) don't mark each other as re-check-ins.
  const stampedStay = new Set<string>()
  for (const b of hotelBookings) {
    const hotelKey = (b.accom_hotel_id ?? b._hotel_name ?? b.name ?? 'Hotel') as string
    const stayKey  = `${hotelKey}::${b.start_date}::${b.end_date ?? ''}`
    const occ      = occupantsOf(b)
    const seen     = seenByHotel.get(hotelKey) ?? new Set<string>()

    // Re-check-in iff an occupant was seen at this hotel in an earlier-starting
    // stay. Same-range concurrent rows share a stayKey and never flag each other.
    const isReturn = !stampedStay.has(stayKey)
      && [...occ].some(p => seen.has(p))
    if (isReturn) reCheckin.add(b.id as string)

    stampedStay.add(stayKey)
    for (const p of occ) seen.add(p)
    seenByHotel.set(hotelKey, seen)
  }

  for (const b of bookings) {
    if (b.brief_show === false) continue
    const hasRooms = (b._rooms?.length ?? 0) > 0
    const isHotelStay = !!b.accom_hotel_id || hasRooms
    if (!isHotelStay) continue

    const hotelName     = b._hotel_name ?? b.name ?? 'Hotel'
    const img           = b.brief_image_src ?? b._hotel_image_src ?? null
    const checkinLabel  = reCheckin.has(b.id as string) ? 'Re-Check-in' : 'Check-in'
    const checkInDay    = (b.check_in_date as string | null) ?? b.start_date

    if (checkInDay) {
      // ── Three distinct check-in concepts (no longer conflated) ──────────────
      // Standard: hotel published policy (always). Approved: negotiated early
      // check-in (if set). Expected arrival: when the guest physically arrives
      // (if set) — NOT a check-in. Each renders on its own line, nulls hidden.
      const standardCheckin = (b._standard_checkin_time as string | null) ?? null
      const approvedCheckin = (b.early_checkin_approved_time as string | null) ?? null
      const expectedArrival = (b.expected_arrival_time as string | null) ?? null
      const checkInNote = (b.check_in_note as string | null) ?? null

      const rooms: TimelineRoom[] = (b._rooms ?? [])
        .slice()
        .sort((x, y) => ((x.sort_order as number) ?? 0) - ((y.sort_order as number) ?? 0))
        .map(r => ({
          id:                  r.id as string,
          guest:               (r.resolved_guest_name as string | null) ?? (r.guest_name as string | null) ?? null,
          additional_guests:   (r.resolved_additional_guests as string[] | null) ?? [],
          room_name:           (r.room_name as string | null) ?? null,
          party_composition:   (r.party_composition as string | null) ?? null,
          confirmation_number: (r.confirmation_number as string | null) ?? null,
          notes:               (r.notes as string | null) ?? null,
          bedding_type:        (r.bedding_type as string | null) ?? null,
        }))
      // Timeline sort position: expected arrival if known (that's when they're
      // physically present), else standard check-in.
      const sortTime = expectedArrival ?? standardCheckin
      out.push({
        id: `checkin-${b.id}`, kind: 'hotel_checkin', entry_date: checkInDay,
        start_time: sortTime,
        end_time: null, category: 'stay', categoryLabel: 'Hotel',
        title: `${checkinLabel} \u00b7 ${hotelName}`, subtitle: null, notes: null,
        booked_by: b.booked_by ?? null, image_src: img,
        confirmation_number: (b.confirmation_number as string | null) ?? null,
        guest_label: null,
        status: (b.status as string | null) ?? null,
        check_in_note: checkInNote,
        check_out_note: null,
        standard_checkin_time: standardCheckin,
        approved_checkin_time: approvedCheckin,
        expected_arrival_time: expectedArrival,
        contact_name: null, contact_phone: null,
        guest_name: null, guest_count: null, dining_status: null,
        cancellation_penalty_applied: null, cancellation_note: null,
        show_cancellation: null, schedule_status: null, requested_checkout_time: null, late_checkout_approved_time: null, original_start_time: null, original_end_time: null, venue: null,
        rooms, passengers: [], driver_details: [], source_booking_id: b.id as string, source_aux_id: null,
        brief_show: true,
      })
    }

    if (b.end_date) {
      // ── Build check-out note ────────────────────────────────────────────────
      const checkOutNote = (b.check_out_note as string | null) ?? null

      // Checkout slots at the requested time when a late checkout is requested/
      // approved (so it sorts into that afternoon slot), else the standard time.
      const requestedCheckout = (b.requested_checkout_time as string | null) ?? null
      const checkoutTime = (b.late_checkout_approved_time as string | null)
        ?? requestedCheckout ?? (b._standard_checkout_time as string | null) ?? null

      out.push({
        id: `checkout-${b.id}`, kind: 'hotel_checkout', entry_date: b.end_date,
        start_time: checkoutTime,
        requested_checkout_time: requestedCheckout,
        late_checkout_approved_time: (b.late_checkout_approved_time as string | null) ?? null,
        end_time: null, category: 'stay', categoryLabel: 'Hotel',
        title: `Check-out \u00b7 ${hotelName}`, subtitle: null, notes: null,
        booked_by: b.booked_by ?? null, image_src: img,
        confirmation_number: null, guest_label: null,
        status: (b.status as string | null) ?? null,
        check_in_note: null,
        check_out_note: checkOutNote,
        standard_checkin_time: null,
        approved_checkin_time: null,
        expected_arrival_time: null,
        contact_name: null, contact_phone: null,
        guest_name: null, guest_count: null, dining_status: null,
        cancellation_penalty_applied: null, cancellation_note: null,
        show_cancellation: null, schedule_status: null, original_start_time: null, original_end_time: null, venue: null,
        rooms: [], passengers: [], driver_details: [], source_booking_id: b.id as string, source_aux_id: null,
        brief_show: true,
      })
    }
  }
  return out
}

// Flights/transfers from aux bookings, carrying resolved passengers.
export function buildElementItems(aux: EngagementElementLike[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const a of aux) {
    if (a.brief_show === false) continue
    if (!a.start_date) continue
    const isFlight = (a.element_type ?? '') === 'flight' || (a.element_type ?? '') === 'private_jet'
    const route = a.origin && a.destination ? `${a.origin} \u2192 ${a.destination}` : null
    const subtitle = isFlight
      ? ([route, a.cabin_class, a.aircraft_type].filter(Boolean).join('  \u00b7  ') || null)
      : route

    const passengers: TimelinePassenger[] = (a.passengers ?? [])
      .slice()
      .sort((x, y) => ((x.sort_order as number) ?? 0) - ((y.sort_order as number) ?? 0))
      .map(p => ({
        id:                       p.id as string,
        passenger_label:          (p.passenger_label as string | null) ?? null,
        resolved_passenger_label: (p.resolved_passenger_label as string | null) ?? null,
        confirmation_number:      (p.confirmation_number as string | null) ?? null,
        seat_numbers:             (p.seat_numbers as string | null) ?? null,
        sort_order:               (p.sort_order as number) ?? 0,
      }))

    const driver_details: TimelineDriverDetail[] = ((a.driver_details as Record<string, unknown>[] | undefined) ?? [])
      .slice()
      .sort((x, y) => ((x.sort_order as number) ?? 0) - ((y.sort_order as number) ?? 0))
      .map(d => ({
        id:           d.id as string,
        driver_name:  (d.driver_name as string | null) ?? null,
        driver_phone: (d.driver_phone as string | null) ?? null,
        car_model:    (d.car_model as string | null) ?? null,
        plate:        (d.plate as string | null) ?? null,
        vehicle_role: (d.vehicle_role as string | null) ?? null,
        sort_order:   (d.sort_order as number) ?? 0,
      }))
    out.push({
      id: a.id as string, kind: 'aux', entry_date: a.start_date as string,
      start_time: a.start_time ?? null, end_time: a.end_time ?? null,
      category: a.element_type ?? 'arrangement', categoryLabel: a.element_type_label ?? null,
      title: a.name ?? a.element_type ?? 'Booking', subtitle, notes: a.notes ?? null,
      booked_by: a.booked_by ?? null, image_src: (a.image_src as string | null) ?? null,
      confirmation_number: null, guest_label: null, status: null,
      check_in_note: null, check_out_note: null,
      standard_checkin_time: null,
      approved_checkin_time: null,
      expected_arrival_time: null,
      contact_name: (a.contact_name as string | null) ?? null,
      contact_phone: (a.contact_phone as string | null) ?? null,
      guest_name: (a.guest_name as string | null) ?? null,
      guest_count: (a.guest_count as number | null) ?? null,
      dining_status: (a.dining_status as string | null) ?? null,
      cancellation_penalty_applied: (a.cancellation_penalty_applied as boolean | null) ?? null,
      cancellation_note: (a.cancellation_note as string | null) ?? null,
      show_cancellation: (a.show_cancellation as boolean | null) ?? null,
      schedule_status: (a.schedule_status as string | null) ?? null,
      original_start_time: (a.original_start_time as string | null) ?? null,
      original_end_time: (a.original_end_time as string | null) ?? null,
      requested_checkout_time: null, late_checkout_approved_time: null,
      venue: (a.venue as TimelineItem['venue']) ?? null,
      rooms: [], passengers, driver_details,
      source_booking_id: null, source_aux_id: a.id as string, brief_show: true,
    })
  }
  return out
}

// Standalone stored entries — anything NOT sourced from a booking.
export function buildEntryItems(entries: EntryLike[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const e of entries) {
    if (e.brief_show === false) continue
    if (e.source_booking_id) continue
    out.push({
      id: e.id as string, kind: 'entry', entry_date: e.entry_date as string,
      start_time: (e.start_time as string | null) ?? null,
      end_time: (e.end_time as string | null) ?? null,
      category: (e.category as string | null) ?? null, categoryLabel: null,
      title: (e.title as string) ?? '', subtitle: (e.subtitle as string | null) ?? null,
      notes: (e.notes as string | null) ?? null,
      booked_by: (e.booked_by as string | null) ?? null,
      image_src: (e.image_src as string | null) ?? null,
      confirmation_number: (e.confirmation_number as string | null) ?? null,
      guest_label: (e.guest_label as string | null) ?? null, status: null,
      check_in_note: null, check_out_note: null,
      standard_checkin_time: null,
      approved_checkin_time: null,
      expected_arrival_time: null,
      contact_name: null, contact_phone: null,
      guest_name: null, guest_count: null, dining_status: null,
      cancellation_penalty_applied: null, cancellation_note: null,
      show_cancellation: null, schedule_status: null, requested_checkout_time: null, late_checkout_approved_time: null, original_start_time: null, original_end_time: null, venue: null,
      rooms: [], passengers: [], driver_details: [],
      source_booking_id: null,
      source_aux_id: (e.source_aux_id as string | null) ?? null,
      brief_show: true,
    })
  }
  return out
}

// ── Comparator + merge ─────────────────────────────────────────────────────────

function timeRank(t: string | null): number {
  if (!t) return 9999
  const [h, m] = t.split(':')
  return parseInt(h, 10) * 60 + parseInt(m ?? '0', 10)
}

// Position within a day. Lower sorts earlier.
// Hotel check-out floats to the top (morning departure). Hotel check-in sorts by
// its resolved time when one is set (derived or standard policy); an untimed
// check-in falls to the bottom (afternoon arrival, the legacy default).
function dayPosition(item: TimelineItem): number {
  if (item.kind === 'hotel_checkout') {
    return item.requested_checkout_time ? timeRank(item.requested_checkout_time) : -1
  }
  if (item.kind === 'hotel_checkin') {
    return item.start_time ? timeRank(item.start_time) : 100000
  }
  return timeRank(item.start_time)
}

export function timelineComparator(a: TimelineItem, b: TimelineItem): number {
  if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1
  const pa = dayPosition(a)
  const pb = dayPosition(b)
  if (pa !== pb) return pa - pb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// The single producer. Merge hotels + aux + standalone entries, ordered.
export function buildTimeline(
  bookings: BookingLike[],
  aux:      EngagementElementLike[],
  entries:  EntryLike[],
): TimelineItem[] {
  return [
    ...buildHotelItems(bookings),
    ...buildElementItems(aux),
    ...buildEntryItems(entries),
  ].sort(timelineComparator)
}