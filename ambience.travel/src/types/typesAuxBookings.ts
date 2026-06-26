// typesAuxBookings.ts — Canonical aux booking + day-entry display registry.
//
// What it owns:
//   - AUX_BOOKING_TYPE_META + getAuxTypeMeta (icon + display meta, slug-keyed)
//   - FLIGHT_BOOKING_TYPES + isFlightType
//   - CABIN_CLASSES + SEAT_TYPES (includes 'Mixed')
//   - AIRCRAFT_TYPES — curated registry (commercial + private aviation).
//     Dropdown-only, no free-text fallback. Anything missing gets added
//     to this file. Data integrity compounds; curated lists are how
//     enterprise platforms keep reference data clean over years.
//   - CATEGORY_ACCENT + getCategoryAccent
//   - Booking type predicates (isFlightBooking, isHotelBooking, etc.)
//
// What it does not own:
//   - Supplier identity / commission terms (see typesSuppliers.ts)
//   - Booking lifecycle status (see typesEventStatus.ts)
//   - DB queries, UI rendering
//   - The canonical type list itself — that lives in travel_engagement_types
//     (DB registry). This file holds only DISPLAY meta (icons) the registry
//     does not carry. Type labels + sort_order come from the registry via the
//     EF (booking_type_label); META is keyed by registry SLUG.
//
// Source of truth for:
//   - travel_trip_aux_bookings.cabin_class CHECK constraint
//   - travel_trip_aux_bookings.seat_type CHECK constraint
//   - travel_trip_aux_bookings.aircraft_type display values
//   - travel_trip_day_entries.category accent tokens
//
// S53H: realigned to the 18-type slug registry (travel_engagement_types).
//   booking_type is a SLUG everywhere (S53G). META re-keyed Title-Case -> slug;
//   getAuxTypeMeta casing bug fixed (was lowercasing a Title-keyed map -> every
//   lookup fell through). Predicates rewritten to compare SLUGS (isHotelBooking
//   = 'stay', isFlightBooking = flight/private_jet, ground = transfer/
//   airport_transfer/car_service). Curated aircraft/cabin/seat lists untouched.
// Prior: S50 — AIRCRAFT_TYPES curated registry added (~75 entries). SEAT_TYPES
//   gains 'Mixed'. Aircraft is dropdown-only.
// Prior: S50 — consolidated from legacy typesAuxBooking.ts (deleted).

// ── Metadata registry — keyed by DB registry SLUG ─────────────────────────────
// The 18-type registry (travel_engagement_types) is the source of truth for
// labels + sort_order; this map adds the one thing the registry lacks: an icon.
// Keyed by slug so a slug-or-label input both resolve. journey/reservation/
// arrangement/acquisition are non-movement types but carry icons for any surface
// that renders them.

export interface AuxBookingTypeMeta {
  label:      string
  icon:       string
  sort_order: number
}

const AUX_BOOKING_TYPE_META: Record<string, AuxBookingTypeMeta> = {
  acquisition:      { label: 'ACQUISITION',       icon: '\uD83D\uDD11', sort_order: 1 },
  airport_transfer: { label: 'AIRPORT TRANSFERS', icon: '\uD83D\uDE97', sort_order: 2 },
  arrangement:      { label: 'ARRANGEMENTS',      icon: '\u00b7',       sort_order: 3 },
  car_rental:       { label: 'CAR RENTAL',        icon: '\uD83D\uDE99', sort_order: 4 },
  car_service:      { label: 'CHAUFFEUR & CAR SERVICE', icon: '\uD83D\uDE98', sort_order: 5 },
  cruise:           { label: 'CRUISE',            icon: '\uD83D\uDEA2', sort_order: 6 },
  dining:           { label: 'DINING',            icon: '\uD83C\uDF7D', sort_order: 7 },
  experience:       { label: 'EXPERIENCES',       icon: '\u2728',       sort_order: 8 },
  flight:           { label: 'FLIGHTS',           icon: '\u2708',       sort_order: 9 },
  heli_transfer:    { label: 'HELICOPTER',        icon: '\uD83D\uDE81', sort_order: 10 },
  journey:          { label: 'JOURNEY',           icon: '\uD83E\uDDED', sort_order: 11 },
  private_jet:      { label: 'PRIVATE AVIATION',  icon: '\u2708',       sort_order: 12 },
  public_transport: { label: 'RAIL & TRANSIT',    icon: '\uD83D\uDE86', sort_order: 13 },
  reservation:      { label: 'RESERVATION',       icon: '\uD83D\uDCC5', sort_order: 14 },
  stay:             { label: 'STAYS',             icon: '\uD83C\uDFE8', sort_order: 15 },
  tour:             { label: 'TOURS',             icon: '\uD83D\uDDFA', sort_order: 16 },
  transfer:         { label: 'TRANSFERS',         icon: '\uD83D\uDE97', sort_order: 17 },
  yacht_charter:    { label: 'YACHT CHARTER',     icon: '\u26F5',       sort_order: 18 },
  other:            { label: 'OTHER',             icon: '\u00b7',       sort_order: 99 },
}

// Normalize a slug OR a Title Case label to a registry slug. Accepts both so
// callers passing booking_type (slug) or booking_type_label (Title Case) both
// resolve. 'Airport Transfer' -> 'airport_transfer', 'flight' -> 'flight'.
function toSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/]+/g, '_')
}

export function getAuxTypeMeta(bookingType: string | null | undefined): AuxBookingTypeMeta {
  if (!bookingType) return AUX_BOOKING_TYPE_META.other
  const slug = toSlug(bookingType)
  const known = AUX_BOOKING_TYPE_META[slug]
  if (known) return known
  // Unknown type: derive a display label, no icon, sort last.
  const label = bookingType.toUpperCase() + (bookingType.endsWith('s') ? '' : 'S')
  return { label, icon: '\u00b7', sort_order: 99 }
}

// ── Section grouping — single source ──────────────────────────────────────────
// ConfirmationTab, BriefAuxEditor, and BriefPreview all render aux bookings as
// ordered, typed sections. This is the one implementation. Filters brief_show,
// sorts by registry sort_order then row sort_order, folds consecutive same-slug
// bookings into a single section. Keyed on the canonical slug (booking_type),
// never the display label. Generic over the row type so each surface can pass its
// own aux shape as long as it carries booking_type, brief_show, and sort_order.

export interface AuxSection<T> {
  type:  string   // registry slug
  label: string
  icon:  string
  items: T[]
}

export function groupAuxBySection<T extends { booking_type: string | null; brief_show?: boolean; sort_order: number }>(
  auxBookings: T[],
): AuxSection<T>[] {
  const sorted = auxBookings
    .filter(a => a.brief_show !== false)
    .sort((a, b) => {
      const ma = getAuxTypeMeta(a.booking_type)
      const mb = getAuxTypeMeta(b.booking_type)
      if (ma.sort_order !== mb.sort_order) return ma.sort_order - mb.sort_order
      return a.sort_order - b.sort_order
    })

  const sections: AuxSection<T>[] = []
  for (const aux of sorted) {
    const slug = aux.booking_type ?? 'other'
    const meta = getAuxTypeMeta(slug)
    const last = sections[sections.length - 1]
    if (last && last.type === slug) {
      last.items.push(aux)
      continue
    }
    sections.push({ type: slug, label: meta.label, icon: meta.icon, items: [aux] })
  }
  return sections
}

// ── Flight-specific gate ──────────────────────────────────────────────────────
// Slug-based. flight + private_jet are the aviation movement types.

export const FLIGHT_BOOKING_TYPES: ReadonlySet<string> = new Set([
  'flight',
  'private_jet',
])

export function isFlightType(bookingType: string | null | undefined): boolean {
  return FLIGHT_BOOKING_TYPES.has(toSlug(bookingType ?? ''))
}

// ── Cabin classes ─────────────────────────────────────────────────────────────

export const CABIN_CLASSES = [
  'Economy',
  'Economy Extra',
  'Premium Economy',
  'Business',
  'First',
  'Private / Charter',
] as const

export type CabinClass = typeof CABIN_CLASSES[number]

// ── Seat types ────────────────────────────────────────────────────────────────
// 'Mixed' covers parties where seats vary (e.g. 2 Window + 1 Aisle).

export const SEAT_TYPES = [
  'Window',
  'Middle',
  'Aisle',
  'Mixed',
] as const

export type SeatType = typeof SEAT_TYPES[number]

// ── Aircraft types — commercial ───────────────────────────────────────────────
// Grouped by manufacturer, alphabetical within group.

export const AIRCRAFT_TYPES_COMMERCIAL = [
  'Airbus A220-100',
  'Airbus A220-300',
  'Airbus A319',
  'Airbus A320',
  'Airbus A320neo',
  'Airbus A321',
  'Airbus A321neo',
  'Airbus A321LR',
  'Airbus A321XLR',
  'Airbus A330-200',
  'Airbus A330-300',
  'Airbus A330-900neo',
  'Airbus A340-300',
  'Airbus A340-600',
  'Airbus A350-900',
  'Airbus A350-1000',
  'Airbus A380-800',

  'Boeing 737-700',
  'Boeing 737-800',
  'Boeing 737 MAX 8',
  'Boeing 737 MAX 9',
  'Boeing 747-400',
  'Boeing 747-8',
  'Boeing 757-200',
  'Boeing 767-300',
  'Boeing 777-200',
  'Boeing 777-200LR',
  'Boeing 777-300',
  'Boeing 777-300ER',
  'Boeing 787-8',
  'Boeing 787-9',
  'Boeing 787-10',

  'Embraer E170',
  'Embraer E175',
  'Embraer E190',
  'Embraer E195',
  'Embraer E195-E2',
] as const

export type AircraftTypeCommercial = typeof AIRCRAFT_TYPES_COMMERCIAL[number]

// ── Aircraft types — private aviation ─────────────────────────────────────────
// Curated by class — Light, Midsize, Super-Midsize, Heavy, Ultra-Long-Range,
// VIP airliner. Covers the operators most commonly seen in HRH-grade design.

export const AIRCRAFT_TYPES_PRIVATE = [
  // Light Jet
  'Cessna Citation CJ3+',
  'Cessna Citation CJ4',
  'Embraer Phenom 100EV',
  'Embraer Phenom 300E',
  'Learjet 75 Liberty',
  'Pilatus PC-24',

  // Midsize Jet
  'Bombardier Challenger 350',
  'Cessna Citation Latitude',
  'Cessna Citation XLS+',
  'Embraer Praetor 500',
  'Hawker 800XP',
  'Hawker 900XP',

  // Super-Midsize Jet
  'Bombardier Challenger 3500',
  'Cessna Citation Longitude',
  'Cessna Citation Sovereign+',
  'Embraer Praetor 600',
  'Gulfstream G280',

  // Heavy Jet
  'Bombardier Challenger 605',
  'Bombardier Challenger 650',
  'Dassault Falcon 900LX',
  'Dassault Falcon 2000LXS',
  'Gulfstream G450',
  'Gulfstream G500',
  'Gulfstream G550',

  // Ultra-Long-Range
  'Bombardier Global 6000',
  'Bombardier Global 7500',
  'Bombardier Global 8000',
  'Dassault Falcon 7X',
  'Dassault Falcon 8X',
  'Dassault Falcon 10X',
  'Gulfstream G600',
  'Gulfstream G650',
  'Gulfstream G650ER',
  'Gulfstream G700',
  'Gulfstream G800',

  // VIP airliner / bizliner
  'Airbus ACJ319',
  'Airbus ACJ320neo',
  'Boeing BBJ 737',
  'Boeing BBJ 787',
] as const

export type AircraftTypePrivate = typeof AIRCRAFT_TYPES_PRIVATE[number]

// ── Combined registry ─────────────────────────────────────────────────────────

export interface AircraftGroup {
  label:   string
  options: readonly string[]
}

export const AIRCRAFT_TYPE_GROUPS: AircraftGroup[] = [
  { label: 'Commercial',         options: AIRCRAFT_TYPES_COMMERCIAL },
  { label: 'Private Aviation',   options: AIRCRAFT_TYPES_PRIVATE },
]

export const AIRCRAFT_TYPES: readonly string[] = [
  ...AIRCRAFT_TYPES_COMMERCIAL,
  ...AIRCRAFT_TYPES_PRIVATE,
]

export type AircraftType = AircraftTypeCommercial | AircraftTypePrivate

export function isKnownAircraftType(value: string | null | undefined): boolean {
  if (!value) return false
  return AIRCRAFT_TYPES.includes(value)
}

// ── Category accent colours ───────────────────────────────────────────────────
// Keyed by registry slug. getCategoryAccent normalizes input to a slug, so a
// label or a slug both resolve.

export const CATEGORY_ACCENT: Record<string, string> = {
  flight:           '#93C5FD',
  private_jet:      '#93C5FD',
  transfer:         '#A3E635',
  airport_transfer: '#A3E635',
  car_service:      '#A3E635',
  car_rental:       '#A3E635',
  heli_transfer:    '#93C5FD',
  public_transport: '#A3E635',
  stay:             '#C9A84C',
  cruise:           '#67E8F9',
  yacht_charter:    '#67E8F9',
  dining:           '#F9A8D4',
  experience:       '#C4B5FD',
  tour:             '#C4B5FD',
  acquisition:      '#FDE68A',
  reservation:      '#B4AFA5',
  arrangement:      '#B4AFA5',
  journey:          '#B4AFA5',
  note:             '#B4AFA5',
  other:            '#B4AFA5',
}

export function getCategoryAccent(category: string | null | undefined): string {
  if (!category) return CATEGORY_ACCENT.other
  return CATEGORY_ACCENT[toSlug(category)] ?? CATEGORY_ACCENT.other
}

// ── Booking type predicates — single source ───────────────────────────────────
// All booking_type checks across the codebase must use these. Never inline
// string comparisons or .includes() checks on booking_type values.
// Slug-based (S53G): booking_type is a registry slug. Accepts slug or label via
// toSlug normalization, so a stray Title Case value still resolves correctly.

export function isFlightBooking(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'flight' || t === 'private_jet'
}

export function isTransferBooking(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'transfer' || t === 'airport_transfer' || t === 'car_service'
}

export function isHotelBooking(bookingType: string | null | undefined): boolean {
  return toSlug(bookingType ?? '') === 'stay'
}

export function isGroundTransportBooking(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'transfer' || t === 'airport_transfer' || t === 'car_service'
}

export function isDiningBooking(bookingType: string | null | undefined): boolean {
  return toSlug(bookingType ?? '') === 'dining'
}