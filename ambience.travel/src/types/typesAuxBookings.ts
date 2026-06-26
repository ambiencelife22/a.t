// typesAuxBookings.ts — Canonical aux booking + day-entry display registry.
//
// What it owns:
//   - AUX_BOOKING_TYPES + AUX_BOOKING_TYPE_META + getAuxTypeMeta
//   - FLIGHT_BOOKING_TYPES + isFlightType
//   - CABIN_CLASSES + SEAT_TYPES (includes 'Mixed')
//   - AIRCRAFT_TYPES — curated registry (commercial + private aviation).
//     Dropdown-only, no free-text fallback. Anything missing gets added
//     to this file. Data integrity compounds; curated lists are how
//     enterprise platforms keep reference data clean over years.
//   - CATEGORY_ACCENT + getCategoryAccent
//
// What it does not own:
//   - Supplier identity / commission terms (see typesSuppliers.ts)
//   - Booking lifecycle status (see typesEventStatus.ts)
//   - DB queries, UI rendering
//
// Source of truth for:
//   - travel_trip_aux_bookings.booking_type values
//   - travel_trip_aux_bookings.cabin_class CHECK constraint
//   - travel_trip_aux_bookings.seat_type CHECK constraint
//   - travel_trip_aux_bookings.aircraft_type display values
//   - travel_trip_day_entries.category display tokens
//
// Last updated: S50 — AIRCRAFT_TYPES curated registry added (commercial +
//   private aviation, ~75 entries). SEAT_TYPES gains 'Mixed' for parties
//   with varied seat positions. Aircraft is dropdown-only.
// Prior: S50 — consolidated from legacy typesAuxBooking.ts (deleted)
//   plus aux/flight/category concerns extracted from typesSuppliers.ts.

// ── Canonical aux booking types ───────────────────────────────────────────────

// ── Metadata registry — keyed by DB slug ──────────────────────────────────────

export interface AuxBookingTypeMeta {
  label:      string
  icon:       string
  sort_order: number
}

const AUX_BOOKING_TYPE_META: Record<string, AuxBookingTypeMeta> = {
  Flight:          { label: 'FLIGHTS',                 icon: '\u2708',       sort_order: 10 },
  'Private Jet':   { label: 'PRIVATE AVIATION',        icon: '\u2708',       sort_order: 15 },
  Transfer:        { label: 'TRANSFERS',               icon: '\uD83D\uDE97', sort_order: 20 },
  'Airport Transfer': { label: 'AIRPORT TRANSFERS',    icon: '\uD83D\uDE97', sort_order: 22 },
  'Car Service':   { label: 'CHAUFFEUR & CAR SERVICE', icon: '\uD83D\uDE98', sort_order: 25 },
  Rail:            { label: 'RAIL',                    icon: '\uD83D\uDE86', sort_order: 30 },
  Cruise:          { label: 'CRUISE',                  icon: '\uD83D\uDEA2', sort_order: 35 },
  Yacht:           { label: 'YACHT & BOAT',            icon: '\u26F5',       sort_order: 40 },
  Dining:          { label: 'DINING',                  icon: '\uD83C\uDF7D', sort_order: 45 },
  'Tour Guide':    { label: 'TOUR GUIDES',             icon: '\uD83D\uDDFA', sort_order: 50 },
  Experience:      { label: 'EXPERIENCES',             icon: '\u2728',       sort_order: 55 },
  Shopping:        { label: 'PRIVATE SHOPPING',        icon: '\uD83D\uDED2', sort_order: 60 },
  Other:           { label: 'OTHER',                   icon: '\u00b7',       sort_order: 99 },
}

export function getAuxTypeMeta(bookingType: string | null | undefined): AuxBookingTypeMeta {
  if (!bookingType) return AUX_BOOKING_TYPE_META['other']
  const known = AUX_BOOKING_TYPE_META[bookingType.toLowerCase()]
  if (known) return known
  const label = bookingType.toUpperCase() + (bookingType.endsWith('s') ? '' : 'S')
  return { label, icon: '\u00b7', sort_order: 99 }
}

// ── Flight-specific gate ──────────────────────────────────────────────────────

export const FLIGHT_BOOKING_TYPES: ReadonlySet<string> = new Set([
  'Flight',
  'Private Jet / Charter',
])

export function isFlightType(bookingType: string | null | undefined): boolean {
  return FLIGHT_BOOKING_TYPES.has(bookingType ?? '')
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

export const CATEGORY_ACCENT: Record<string, string> = {
  'flight':           '#93C5FD',
  'private_jet':      '#93C5FD',
  'transfer':         '#A3E635',
  'airport_transfer': '#A3E635',
  'car_service':      '#A3E635',
  'rail':             '#A3E635',
  'stay':             '#C9A84C',
  'hotel':            '#C9A84C',
  'cruise':           '#67E8F9',
  'yacht':            '#67E8F9',
  'dining':           '#F9A8D4',
  'experience':       '#C4B5FD',
  'tour_guide':       '#C4B5FD',
  'shopping':         '#FDE68A',
  'leisure':          '#6EE7B7',
  'note':             '#B4AFA5',
  'other':            '#B4AFA5',
}

export function getCategoryAccent(category: string | null | undefined): string {
  return CATEGORY_ACCENT[(category ?? '').toLowerCase()] ?? CATEGORY_ACCENT['other']
}
// ── Booking type predicates — single source ───────────────────────────────────
// All booking_type checks across the codebase must use these. Never inline
// string comparisons or .includes() checks on booking_type values.

export function isFlightBooking(bookingType: string | null | undefined): boolean {
  const t = (bookingType ?? '').toLowerCase()
  return t === 'flight' || t === 'private jet / charter'
}

export function isTransferBooking(bookingType: string | null | undefined): boolean {
  const t = (bookingType ?? '').toLowerCase()
  return t === 'airport transfer' || t === 'chauffeur / car service' || t === 'transfer'
}

export function isHotelBooking(bookingType: string | null | undefined): boolean {
  return (bookingType ?? '') === 'Hotel'
}

export function isGroundTransportBooking(bookingType: string | null | undefined): boolean {
  const t = (bookingType ?? '').toLowerCase()
  return t === 'airport transfer' || t === 'chauffeur / car service' || t === 'transfer'
}

export function isDiningBooking(bookingType: string | null | undefined): boolean {
  return (bookingType ?? '').toLowerCase() === 'dining'
}
