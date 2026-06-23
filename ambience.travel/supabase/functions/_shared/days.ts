// supabase/functions/_shared/days.ts
// Single-source trip days. The list of WHICH days exist is DERIVED from the trip
// span [start_date .. end_date] — never stored. travel_trip_days is an OVERLAY
// holding only per-day operator overrides (show / day_label / day_note), keyed by
// (trip_id, entry_date). buildDays merges: every date in span, with overlay applied.
//
// Replaces the stored-days model (travel_trip_days as source of existence) — the
// same store-the-derivation pattern retired for hotel/aux entries. Shift a trip
// date and the day list follows automatically; overrides keyed by date survive.
//
// Default when no overlay row exists for a date: show=true, no label, no note.

export type TripDayItem = {
  id:         string | null   // overlay row id if present, otherwise null (derived-only day)
  trip_id:    string
  entry_date: string
  show:       boolean
  day_label:  string | null
  day_note:   string | null
  sort_order: number          // index within span (0-based), authoritative ordering
}

type DayOverlayLike = {
  id?:         unknown
  entry_date?: unknown
  show?:       unknown
  day_label?:  unknown
  day_note?:   unknown
  [k: string]: unknown
}

// Enumerate every date string (YYYY-MM-DD) from start to end inclusive.
function datesInSpan(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const cursor = new Date(startDate + 'T00:00:00')
  const end    = new Date(endDate   + 'T00:00:00')
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

// Derive the ordered day list from span, applying the overlay per date.
// overlayRows are travel_trip_days rows (any that exist for this trip).
export function buildDays(
  tripId:     string,
  startDate:  string | null,
  endDate:    string | null,
  overlayRows: DayOverlayLike[],
): TripDayItem[] {
  if (!startDate || !endDate) return []

  const overlayByDate = new Map<string, DayOverlayLike>()
  for (const o of overlayRows) {
    const d = o.entry_date as string | undefined
    if (d) overlayByDate.set(d, o)
  }

  return datesInSpan(startDate, endDate).map((date, i) => {
    const o = overlayByDate.get(date)
    return {
      id:         o ? ((o.id as string | null) ?? null) : null,
      trip_id:    tripId,
      entry_date: date,
      // Default show=true; overlay can hide. Only an explicit false hides.
      show:       o ? (o.show as boolean | null) !== false : true,
      day_label:  o ? ((o.day_label as string | null) ?? null) : null,
      day_note:   o ? ((o.day_note  as string | null) ?? null) : null,
      sort_order: i,
    }
  })
}