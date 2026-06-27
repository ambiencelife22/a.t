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
// Check-in/out NOTES (e.g. an early-check-in half-rate arrangement) ride on the
// derived items so every surface — confirmation, programme, brief, all PDFs —
// shows the concierge's intention. The note is guest-facing context, never an
// internal artifact.

// ── Public item shape ─────────────────────────────────────────────────────────

export type TimelineRoom = {
  id:                  string
  guest:               string | null
  room_name:           string | null
  party_composition:   string | null
  confirmation_number: string | null
  notes:               string | null
  check_in_time:       string | null
}

export type TimelinePassenger = {
  id:                       string
  passenger_label:          string | null
  resolved_passenger_label: string | null
  confirmation_number:      string | null
  seat_numbers:             string | null
  sort_order:               number
}

export type TimelineItem = {
  id:                  string
  kind:                'hotel_checkin' | 'hotel_checkout' | 'aux' | 'entry'
  entry_date:          string
  start_time:          string | null
  end_time:            string | null
  category:            string | null
  categoryLabel:       string | null
  title:               string
  subtitle:            string | null
  notes:               string | null
  confirmation_number: string | null
  booked_by:           string | null
  image_src:           string | null
  guest_label:         string | null
  status:              string | null
  check_in_note:                string | null
  check_out_note:               string | null
  contact_name:                 string | null
  contact_phone:                string | null
  guest_name:                   string | null
  guest_count:                  number | null
  dining_status:                string | null
  cancellation_penalty_applied: boolean | null
  cancellation_note:            string | null
  show_cancellation:            boolean | null
  venue: {
    address:         string | null
    maps_url:        string | null
    phone:           string | null
    dress_code:      string | null
    children_policy: string | null
    table_hold_note: string | null
    booking_terms:   string | null
  } | null
  rooms:               TimelineRoom[]
  passengers:          TimelinePassenger[]
  source_booking_id:   string | null
  source_aux_id:       string | null
  brief_show:          boolean
}

// ── Input shapes (loose — these are already-fetched DB rows) ───────────────────

type BookingLike = {
  id?:               unknown
  booking_type?:     string | null
  name?:             string | null
  start_date?:       string | null
  check_in_date?:    string | null
  end_date?:         string | null
  brief_show?:       boolean
  booked_by?:        string | null
  status?:           string | null
  check_in_note?:    string | null
  check_out_note?:   string | null
  _hotel_name?:      string | null
  _hotel_image_src?: string | null
  brief_image_src?:  string | null
  _rooms?:           Record<string, unknown>[]
  [k: string]:       unknown
}

type AuxLike = {
  id?:                  unknown
  booking_type?:        string | null
  booking_type_label?:  string | null
  name?:                string | null
  start_date?:    string | null
  start_time?:    string | null
  end_time?:      string | null
  origin?:        string | null
  destination?:   string | null
  notes?:         string | null
  booked_by?:     string | null
  brief_show?:    boolean
  cabin_class?:   string | null
  aircraft_type?: string | null
  passengers?:    Record<string, unknown>[]
  [k: string]:    unknown
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

// ── Builders ───────────────────────────────────────────────────────────────────

// Hotel check-in (with rooms) + check-out (bare) from each shown booking.
// resolved_guest_name is set by the caller (names.ts) before this runs.
export function buildHotelItems(bookings: BookingLike[]): TimelineItem[] {
  const out: TimelineItem[] = []

  // Pre-pass: detect re-check-ins (split stays). Group by hotel identity + exact
  // date range; bookings sharing hotel AND start+end are concurrent rooms (one
  // check-in). A booking at the same hotel with a DIFFERENT range is a re-check-in.
  // Stay identity uses the FINANCIAL range (start_date/end_date) — that is the
  // true booking span; the guest-facing check-in day is derived separately below.
  const reCheckin = new Set<string>()
  const byHotelStay = new Map<string, BookingLike[]>()
  for (const b of bookings) {
    if (b.brief_show === false) continue
    const hasR = (b._rooms?.length ?? 0) > 0
    if (b.booking_type !== 'Hotel' && !hasR) continue
    if (!b.start_date) continue
    const hotelKey = (b.accom_hotel_id ?? b._hotel_name ?? b.name ?? 'Hotel') as string
    const stayKey  = `${hotelKey}::${b.start_date}::${b.end_date ?? ''}`
    const list = byHotelStay.get(stayKey) ?? []
    list.push(b)
    byHotelStay.set(stayKey, list)
  }
  const byHotel = new Map<string, string[]>()
  for (const stayKey of byHotelStay.keys()) {
    const hotelKey = stayKey.split('::')[0]
    const list = byHotel.get(hotelKey) ?? []
    list.push(stayKey)
    byHotel.set(hotelKey, list)
  }
  for (const stayKeys of byHotel.values()) {
    if (stayKeys.length < 2) continue
    stayKeys.sort()
    stayKeys.forEach((stayKey, i) => {
      if (i === 0) return
      for (const b of byHotelStay.get(stayKey) ?? []) {
        reCheckin.add(b.id as string)
      }
    })
  }

  for (const b of bookings) {
    if (b.brief_show === false) continue
    const hasRooms = (b._rooms?.length ?? 0) > 0
    if (b.booking_type !== 'Hotel' && !hasRooms) continue

    const hotelName = b._hotel_name ?? b.name ?? 'Hotel'
    const img = b.brief_image_src ?? b._hotel_image_src ?? null
    const checkinLabel = reCheckin.has(b.id as string) ? 'Re-Check-in' : 'Check-in'

    // Guest-facing check-in day: check_in_date overrides start_date when the
    // financial start precedes actual arrival (early-check-in half-rate night).
    const checkInDay = (b.check_in_date as string | null) ?? b.start_date
    if (checkInDay) {
      const rooms: TimelineRoom[] = (b._rooms ?? [])
        .slice()
        .sort((x, y) => ((x.sort_order as number) ?? 0) - ((y.sort_order as number) ?? 0))
        .map(r => ({
          id:                  r.id as string,
          guest:               (r.resolved_guest_name as string | null) ?? (r.guest_name as string | null) ?? null,
          room_name:           (r.room_name as string | null) ?? null,
          party_composition:   (r.party_composition as string | null) ?? null,
          confirmation_number: (r.confirmation_number as string | null) ?? null,
          notes:               (r.notes as string | null) ?? null,
          check_in_time:       (r.check_in_time as string | null) ?? null,
        }))
      out.push({
        id: `checkin-${b.id}`, kind: 'hotel_checkin', entry_date: checkInDay,
        start_time: (b.start_time as string | null) ?? null, end_time: null, category: 'stay', categoryLabel: 'Hotel',
        title: `${checkinLabel} \u00b7 ${hotelName}`, subtitle: null, notes: null,
        booked_by: b.booked_by ?? null, image_src: img,
        confirmation_number: (b.confirmation_number as string | null) ?? null,
        guest_label: null,
        status: (b.status as string | null) ?? null,
        check_in_note: (b.check_in_note as string | null) ?? null,
        check_out_note: null,
        contact_name: null, contact_phone: null,
        guest_name: null, guest_count: null, dining_status: null,
        cancellation_penalty_applied: null, cancellation_note: null,
        show_cancellation: null, venue: null,
        rooms, passengers: [], source_booking_id: b.id as string, source_aux_id: null,
        brief_show: true,
      })
    }

    if (b.end_date) {
      out.push({
        id: `checkout-${b.id}`, kind: 'hotel_checkout', entry_date: b.end_date,
        start_time: null, end_time: null, category: 'stay', categoryLabel: 'Hotel',
        title: `Check-out \u00b7 ${hotelName}`, subtitle: null, notes: null,
        booked_by: b.booked_by ?? null, image_src: img,
        confirmation_number: null, guest_label: null,
        status: (b.status as string | null) ?? null,
        check_in_note: null,
        check_out_note: (b.check_out_note as string | null) ?? null,
        contact_name: null, contact_phone: null,
        guest_name: null, guest_count: null, dining_status: null,
        cancellation_penalty_applied: null, cancellation_note: null,
        show_cancellation: null, venue: null,
        rooms: [], passengers: [], source_booking_id: b.id as string, source_aux_id: null,
        brief_show: true,
      })
    }
  }
  return out
}

// Flights/transfers from aux bookings, carrying resolved passengers.
export function buildAuxItems(aux: AuxLike[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const a of aux) {
    if (a.brief_show === false) continue
    if (!a.start_date) continue
    const isFlight = (a.booking_type ?? '') === 'flight' || (a.booking_type ?? '') === 'private_jet'
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

    out.push({
      id: a.id as string, kind: 'aux', entry_date: a.start_date as string,
      start_time: a.start_time ?? null, end_time: a.end_time ?? null,
      category: a.booking_type ?? 'arrangement', categoryLabel: a.booking_type_label ?? null,
      title: a.name ?? a.booking_type ?? 'Booking', subtitle, notes: a.notes ?? null,
      booked_by: a.booked_by ?? null, image_src: (a.image_src as string | null) ?? null,
      confirmation_number: null, guest_label: null, status: null,
      check_in_note: null, check_out_note: null,
      contact_name: (a.contact_name as string | null) ?? null,
      contact_phone: (a.contact_phone as string | null) ?? null,
      guest_name: (a.guest_name as string | null) ?? null,
      guest_count: (a.guest_count as number | null) ?? null,
      dining_status: (a.dining_status as string | null) ?? null,
      cancellation_penalty_applied: (a.cancellation_penalty_applied as boolean | null) ?? null,
      cancellation_note: (a.cancellation_note as string | null) ?? null,
      show_cancellation: (a.show_cancellation as boolean | null) ?? null,
      venue: (a.venue as TimelineItem['venue']) ?? null,
      rooms: [], passengers,
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
      start_time: (e.start_time as string | null) ?? null, end_time: (e.end_time as string | null) ?? null,
      category: (e.category as string | null) ?? null, categoryLabel: null, title: (e.title as string) ?? '', subtitle: (e.subtitle as string | null) ?? null,
      notes: (e.notes as string | null) ?? null, booked_by: (e.booked_by as string | null) ?? null,
      image_src: (e.image_src as string | null) ?? null,
      confirmation_number: (e.confirmation_number as string | null) ?? null,
      guest_label: (e.guest_label as string | null) ?? null, status: null,
      check_in_note: null, check_out_note: null,
      contact_name: null, contact_phone: null,
      guest_name: null, guest_count: null, dining_status: null,
      cancellation_penalty_applied: null, cancellation_note: null,
      show_cancellation: null, venue: null,
      rooms: [], passengers: [],
      source_booking_id: null, source_aux_id: (e.source_aux_id as string | null) ?? null,
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
// its time when one is set (a 09:00 check-in slots among the morning items); an
// untimed check-in falls to the bottom (afternoon arrival, the legacy default).
function dayPosition(item: TimelineItem): number {
  if (item.kind === 'hotel_checkout') return -1
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
  aux:      AuxLike[],
  entries:  EntryLike[],
): TimelineItem[] {
  return [
    ...buildHotelItems(bookings),
    ...buildAuxItems(aux),
    ...buildEntryItems(entries),
  ].sort(timelineComparator)
}