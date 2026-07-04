// utilsBooking.ts — Shared booking display helpers across ambience.TRAVEL.
//
// Canonical bookedByLabel — single source for all surfaces.
// Rules:
//   - null/undefined/'ambience' → 'Booked by ambience'
//   - 'self'                    → 'Own Arrangements'
//   - anything otherwise             → 'Booked by {value}'
//
// Used by:
//   - ImmerseTripPage.tsx (TripBriefTab web surface)
//   - ImmerseTripPage.tsx (confirmation + brief tabs)
//   - pdfImmerseBrief.ts (Trip Brief PDF)
//   - pdfImmerseProgramme.ts (Daily Programme PDF)

export function bookedByLabel(bookedBy: string | null | undefined): string {
  if (!bookedBy || bookedBy === 'ambience') return 'Booked by ambience'
  if (bookedBy === 'self')      return 'Own Arrangements'
  if (bookedBy === 'Requested') return 'Requested'
  if (bookedBy === 'Pending')   return 'Pending'
  if (bookedBy === 'TBA')       return 'To be advised'
  if (bookedBy === 'Deron')     return 'Booked by Deron'
  return `Booked by ${bookedBy}`
}

// The booked_by axis has one meaningful visual distinction: did WE arrange it
// (ambience, or a named designer like Deron) or did the CLIENT (self)? "self" =
// Own Arrangements — the only value that earns the distinct, subtle treatment.
// Everything otherwise is ambience-arranged, regardless of which designer is named.
// Single source — surfaces must not re-derive (booked_by ?? 'ambience').
export function isOwnArrangements(bookedBy: string | null | undefined): boolean {
  return bookedBy === 'self'
}
// ── Phone normaliser ──────────────────────────────────────────────────────────
// Single source for all tel: href construction. Strips whitespace and common
// formatting characters so the OS can dial correctly regardless of how the
// phone number was stored.
// ── Bedding type labels — single source ───────────────────────────────────────
const BEDDING_LABELS: Record<string, string> = {
  king:        'King',
  cal_king:    'California King',
  queen:       'Queen',
  double:      'Double',
  twin:        'Twin',
  two_kings:   '2x King',
  two_queens:  '2x Queen',
  two_twins:   '2x Twin',
  king_twin:   'King + Twin',
  double_twin: 'Double + Twin',
  three_twins: '3x Twin',
  bunk:        'Bunk Beds',
  sofa_bed:    'Sofa Bed',
}
export function beddingLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return BEDDING_LABELS[slug] ?? slug
}
export function beddingConfigurationsLabel(slugs: string[] | null | undefined): string | null {
  if (!slugs || slugs.length === 0) return null
  return slugs.map(s => BEDDING_LABELS[s] ?? s).join(' or ')
}
  export function toTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const normalised = phone.replace(/[\s\-().]/g, '')
  return `tel:${normalised}`
}

// ── Category accent colours — single source ───────────────────────────────────
// The mapping of timeline/programme category → accent colour lives here once.
// Two formats exported: hex (web surfaces) and RGB tuple (PDF/jsPDF surfaces).
// Add new categories here; never duplicate this map in a component or PDF file.

export type RGB = [number, number, number]

const CATEGORY_ACCENT_MAP: Record<string, { hex: string; rgb: RGB }> = {
  Flight:     { hex: '#93C5FD', rgb: [147, 197, 253] },
  Transfer:   { hex: '#A3E635', rgb: [163, 230,  53] },
  Hotel:      { hex: '#C9A84C', rgb: [201, 168,  76] },
  Dining:     { hex: '#F9A8D4', rgb: [249, 168, 212] },
  Experience: { hex: '#C4B5FD', rgb: [196, 181, 253] },
  Leisure:    { hex: '#6EE7B7', rgb: [110, 231, 183] },
  Note:       { hex: '#B4AFA5', rgb: [180, 175, 165] },
}

const CATEGORY_ACCENT_DEFAULT = { hex: '#B4AFA5', rgb: [180, 175, 165] as RGB }

// ── Flight detail composition — single source ─────────────────────────────────
// Composes route + times + flight number into one display string.
// Used by CalendarTab (web) and PDF surfaces. Never compose inline.
//
// Input shape is the minimal intersection of CalendarActivity and TripAuxBooking
// that all surfaces have in common. Pass what you have; missing fields are omitted.

export interface FlightDetailInput {
  origin?:         string | null
  destination?:    string | null
  depart_airport?: string | null
  arrive_airport?: string | null
  time?:           string | null   // departure time (CalendarActivity uses .time)
  start_time?:     string | null   // departure time (aux booking uses .start_time)
  end_time?:       string | null
  flight_number?:  string | null
  airline_name?:   string | null
}

export function flightDetail(a: FlightDetailInput, fmtTimeFn: (t: string | null | undefined) => string): string {
  const from  = a.depart_airport ?? a.origin ?? null
  const to    = a.arrive_airport ?? a.destination ?? null
  const route = [from, to].filter(Boolean).join(' \u2192 ')
  const depRaw = a.time ?? a.start_time ?? null
  const dep   = fmtTimeFn(depRaw)
  const arr   = fmtTimeFn(a.end_time)
  const times = dep && arr ? `${dep}\u2013${arr}` : dep || arr || ''
  const parts = [route, times, a.flight_number ?? null].filter(Boolean)
  return parts.join('  \u00b7  ')
}

export function categoryAccentHex(category: string | null | undefined): string {
  return (CATEGORY_ACCENT_MAP[category ?? ''] ?? CATEGORY_ACCENT_DEFAULT).hex
}

export function categoryAccentRgb(category: string | null | undefined): RGB {
  return (CATEGORY_ACCENT_MAP[category ?? ''] ?? CATEGORY_ACCENT_DEFAULT).rgb
}