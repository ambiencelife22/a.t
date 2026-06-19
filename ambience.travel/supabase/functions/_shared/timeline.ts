// supabase/functions/_shared/timeline.ts
// Single-source trip timeline. Builds the ordered day-stream ONCE, server-side,
// from already-fetched bookings + aux + standalone entries. The programme EF
// calls buildTimeline and returns the result as `entries`; the programme tab and
// PDF render the stream as-is (no client-side derivation).
//
// Replaces three hand-aligned parallel derivations (S53G interim): the tab's
// cards builder, the PDF's mergeDayEntries hotel block, and any EF inline copy.
// One comparator, one merge, here.
//
// Hotel check-in/out are DERIVED from bookings (never stored). Standalone entries
// (dining, experiences, notes — anything without a booking source) pass through.
// Aux (flights/transfers) are derived from aux bookings, carrying passengers.
//
// Same-day ordering canon: a day flows check-out (morning, depart) → timed items
// (by start_time) → check-in (afternoon, arrive). Untimed checkout sorts to the
// top, untimed checkin to the bottom, timed items slot between by time.

// ── Public item shape ─────────────────────────────────────────────────────────

export type TimelineRoom = {
  id:                  string
  guest:               string | null
  room_name:           string | null
  confirmation_number: string | null
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
  title:               string
  subtitle:            string | null
  notes:               string | null
  booked_by:           string | null
  image_src:           string | null
  confirmation_number: string | null
  guest_label:         string | null
  status:              string | null
  rooms:               TimelineRoom[]
  passengers:          TimelinePassenger[]
  source_booking_id:   string | null
  source_aux_id:       string | null
  brief_show:          boolean
}

// ── Input shapes (loose — these are already-fetched DB rows) ───────────────────

type BookingLike = Record<string, unknown> & {
  id:               string
  booking_type?:    string | null
  name?:            string | null
  start_date?:      string | null
  end_date?:        string | null
  brief_show?:      boolean
  booked_by?:       string | null
  status?:          string | null
  _hotel_name?:     string | null
  _hotel_image_src?: string | null
  brief_image_src?: string | null
  _rooms?:          Record<string, unknown>[]
}

type AuxLike = Record<string, unknown> & {
  id:            string
  booking_type?: string | null
  name?:         string | null
  start_date?:   string | null
  start_time?:   string | null
  end_time?:     string | null
  origin?:       string | null
  destination?:  string | null
  notes?:        string | null
  booked_by?:    string | null
  brief_show?:   boolean
  cabin_class?:  string | null
  aircraft_type?: string | null
  passengers?:   Record<string, unknown>[]
}

type EntryLike = Record<string, unknown> & {
  id:                   string
  entry_date:           string
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
}

// ── Builders ───────────────────────────────────────────────────────────────────

// Hotel check-in (with rooms) + check-out (bare) from each shown booking.
// resolved_guest_name is set by the caller (names.ts) before this runs.
export function buildHotelItems(bookings: BookingLike[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const b of bookings) {
    if (b.brief_show === false) continue
    const hasRooms = (b._rooms?.length ?? 0) > 0
    if (b.booking_type !== 'Hotel' && !hasRooms) continue

    const hotelName = b._hotel_name ?? b.name ?? 'Hotel'
    const img = b.brief_image_src ?? b._hotel_image_src ?? null

    if (b.start_date) {
      const rooms: TimelineRoom[] = (b._rooms ?? [])
        .slice()
        .sort((x, y) => ((x.sort_order as number) ?? 0) - ((y.sort_order as number) ?? 0))
        .map(r => ({
          id:                  r.id as string,
          guest:               (r.resolved_guest_name as string | null) ?? (r.guest_name as string | null) ?? null,
          room_name:           (r.room_name as string | null) ?? null,
          confirmation_number: (r.confirmation_number as string | null) ?? null,
        }))
      out.push({
        id: `checkin-${b.id}`, kind: 'hotel_checkin', entry_date: b.start_date,
        start_time: null, end_time: null, category: 'Hotel',
        title: `Check-in \u00b7 ${hotelName}`, subtitle: null, notes: null,
        booked_by: b.booked_by ?? null, image_src: img,
        confirmation_number: null, guest_label: null, status: b.status ?? null,
        rooms, passengers: [], source_booking_id: b.id, source_aux_id: null,
        brief_show: true,
      })
    }

    if (b.end_date) {
      out.push({
        id: `checkout-${b.id}`, kind: 'hotel_checkout', entry_date: b.end_date,
        start_time: null, end_time: null, category: 'Hotel',
        title: `Check-out \u00b7 ${hotelName}`, subtitle: null, notes: null,
        booked_by: b.booked_by ?? null, image_src: img,
        confirmation_number: null, guest_label: null, status: b.status ?? null,
        rooms: [], passengers: [], source_booking_id: b.id, source_aux_id: null,
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
    const isFlight = (a.booking_type ?? '').toLowerCase().includes('flight')
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
      id: a.id, kind: 'aux', entry_date: a.start_date,
      start_time: a.start_time ?? null, end_time: a.end_time ?? null,
      category: a.booking_type ?? 'Other',
      title: a.name ?? a.booking_type ?? 'Booking', subtitle, notes: a.notes ?? null,
      booked_by: a.booked_by ?? null, image_src: null,
      confirmation_number: null, guest_label: null, status: null,
      rooms: [], passengers,
      source_booking_id: null, source_aux_id: a.id, brief_show: true,
    })
  }
  return out
}

// Standalone stored entries — anything NOT sourced from a booking. Hotel entries
// that still carry a source_booking_id are derived now and excluded here to avoid
// double-rendering; truly standalone items (dining, experiences, notes) pass through.
export function buildEntryItems(entries: EntryLike[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const e of entries) {
    if (e.brief_show === false) continue
    // A booking-sourced entry is a redundant copy of a derived hotel item — skip.
    if (e.source_booking_id) continue
    out.push({
      id: e.id, kind: 'entry', entry_date: e.entry_date,
      start_time: e.start_time ?? null, end_time: e.end_time ?? null,
      category: e.category ?? null, title: e.title ?? '', subtitle: e.subtitle ?? null,
      notes: e.notes ?? null, booked_by: e.booked_by ?? null,
      image_src: e.image_src ?? null,
      confirmation_number: e.confirmation_number ?? null,
      guest_label: e.guest_label ?? null, status: null,
      rooms: [], passengers: [],
      source_booking_id: null, source_aux_id: e.source_aux_id ?? null,
      brief_show: true,
    })
  }
  return out
}

// ── Comparator + merge ─────────────────────────────────────────────────────────

// Within a day: checkout (morning) → timed items by start_time → checkin (afternoon).
// Untimed non-hotel items sort with timed (treated as end-of-timed) but before checkin.
function timeRank(t: string | null): number {
  if (!t) return 9999
  const [h, m] = t.split(':')
  return parseInt(h, 10) * 60 + parseInt(m ?? '0', 10)
}

// Position within a day. Lower sorts earlier.
function dayPosition(item: TimelineItem): number {
  if (item.kind === 'hotel_checkout') return -1            // top of day
  if (item.kind === 'hotel_checkin')  return 100000        // bottom of day
  return timeRank(item.start_time)                         // timed items between
}

export function timelineComparator(a: TimelineItem, b: TimelineItem): number {
  if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1
  const pa = dayPosition(a)
  const pb = dayPosition(b)
  if (pa !== pb) return pa - pb
  // stable-ish final tiebreak by id
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