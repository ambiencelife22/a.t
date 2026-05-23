// typesAuxBookings.ts — Canonical aux booking + day-entry display registry.
//
// What it owns:
//   - AUX_BOOKING_TYPES: full taxonomy of bookable aux types for
//     travel_trip_aux_bookings.booking_type (11 types).
//   - AUX_BOOKING_TYPE_META: label, icon, sort_order per type. Used for
//     grouped section headers and card icons across all surfaces.
//   - getAuxTypeMeta: resolver with graceful fallback for unknown types.
//   - FLIGHT_BOOKING_TYPES + isFlightType: gate for flight-specific fields
//     (airline, flight #, cabin class, seat type, aircraft type).
//   - CABIN_CLASSES + SEAT_TYPES: flight detail enums. Mirror DB CHECK
//     constraints on travel_trip_aux_bookings.cabin_class / seat_type.
//   - CATEGORY_ACCENT + getCategoryAccent: accent colour registry for
//     travel_trip_day_entries.category — includes aux booking types
//     plus non-aux categories (Hotel, Dining, Leisure, Note).
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
//   - travel_trip_day_entries.category display tokens
//   - All aux booking type dropdowns + grouped sections across admin UI + PDF
//
// To add a new aux booking type:
//   1. Add to AUX_BOOKING_TYPES array (preserves dropdown order)
//   2. Add entry to AUX_BOOKING_TYPE_META with unique sort_order
//   3. Add CATEGORY_ACCENT entry if visually distinct from Other
//   4. If flight-like (airline + cabin class apply), add to FLIGHT_BOOKING_TYPES
//   5. No other file changes required — all consumers read from this registry
//
// Last updated: S50 — consolidated from legacy typesAuxBooking.ts (deleted)
//   plus aux/flight/category concerns extracted from typesSuppliers.ts.
//   Single registry for all 11 aux booking types with full metadata.
// Prior (legacy typesAuxBooking.ts): S48 — initial 3-type registry shipped.
// Prior (typesSuppliers.ts aux concerns): S48 — Economy Extra + SEAT_TYPES added.

// ── Canonical aux booking types ───────────────────────────────────────────────
// Ordered by logical travel workflow — transport first, then guides/experiences,
// shopping, then catch-all Other. Index in this array drives dropdown order.

export const AUX_BOOKING_TYPES = [
  'Flight',
  'Private Jet / Charter',
  'Airport Transfer',
  'Chauffeur / Car Service',
  'Rail / Train',
  'Cruise Line',
  'Yacht / Boat Charter',
  'Tour Guide',
  'Experience / Activity',
  'Private Shopping',
  'Other',
] as const

export type AuxBookingType = typeof AUX_BOOKING_TYPES[number]

// ── Metadata registry ─────────────────────────────────────────────────────────

export interface AuxBookingTypeMeta {
  label:      string   // Section header label — ALL CAPS plural
  icon:       string   // Card icon — single emoji
  sort_order: number   // Section render order (lower = rendered first)
}

export const AUX_BOOKING_TYPE_META: Record<AuxBookingType, AuxBookingTypeMeta> = {
  'Flight':                  { label: 'FLIGHTS',                 icon: '\u2708',  sort_order: 10 },
  'Private Jet / Charter':   { label: 'PRIVATE AVIATION',        icon: '\u2708',  sort_order: 15 },
  'Airport Transfer':        { label: 'AIRPORT TRANSFERS',       icon: '\uD83D\uDE97', sort_order: 20 },
  'Chauffeur / Car Service': { label: 'CHAUFFEUR & CAR SERVICE', icon: '\uD83D\uDE98', sort_order: 25 },
  'Rail / Train':            { label: 'RAIL',                    icon: '\uD83D\uDE86', sort_order: 30 },
  'Cruise Line':             { label: 'CRUISE',                  icon: '\uD83D\uDEA2', sort_order: 35 },
  'Yacht / Boat Charter':    { label: 'YACHT & BOAT',            icon: '\u26F5',  sort_order: 40 },
  'Tour Guide':              { label: 'TOUR GUIDES',             icon: '\uD83D\uDDFA', sort_order: 50 },
  'Experience / Activity':   { label: 'EXPERIENCES',             icon: '\u2728',  sort_order: 55 },
  'Private Shopping':        { label: 'PRIVATE SHOPPING',        icon: '\uD83D\uDED2', sort_order: 60 },
  'Other':                   { label: 'OTHER',                   icon: '\u00b7',  sort_order: 99 },
}

// ── Fallback resolver ─────────────────────────────────────────────────────────

/**
 * Returns metadata for a given booking_type string.
 * Falls back gracefully for unknown types — never throws.
 * Unknown types render with a generic label and neutral icon.
 */
export function getAuxTypeMeta(bookingType: string | null | undefined): AuxBookingTypeMeta {
  if (!bookingType) return AUX_BOOKING_TYPE_META['Other']
  const known = AUX_BOOKING_TYPE_META[bookingType as AuxBookingType]
  if (known) return known
  // Graceful fallback: pluralise the raw value, neutral icon, sort last
  const label = bookingType.toUpperCase() + (bookingType.endsWith('s') ? '' : 'S')
  return { label, icon: '\u00b7', sort_order: 99 }
}

// ── Flight-specific gate ──────────────────────────────────────────────────────
// Used to conditionally render flight-specific fields (airline, flight number,
// cabin class, seat type, seat numbers, aircraft type) in the UI.

export const FLIGHT_BOOKING_TYPES: ReadonlySet<string> = new Set([
  'Flight',
  'Private Jet / Charter',
])

export function isFlightType(bookingType: string | null | undefined): boolean {
  return FLIGHT_BOOKING_TYPES.has(bookingType ?? '')
}

// ── Cabin classes ─────────────────────────────────────────────────────────────
// Mirrors travel_trip_aux_bookings.cabin_class CHECK constraint.
// Update DB constraint when adding values here.

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
// Mirrors travel_trip_aux_bookings.seat_type CHECK constraint.
// Applies per booking — use seat_numbers for per-passenger detail.

export const SEAT_TYPES = [
  'Window',
  'Middle',
  'Aisle',
] as const

export type SeatType = typeof SEAT_TYPES[number]

// ── Category accent colours ───────────────────────────────────────────────────
// Single source of truth for travel_trip_day_entries.category display token.
// Keys are a superset of AUX_BOOKING_TYPES — covers non-aux categories too
// (Hotel, Dining, Leisure, Note) that appear in the day-entries surface.
// Never hardcode these in components or PDF renderers — import from here.

export const CATEGORY_ACCENT: Record<string, string> = {
  'Flight':                  '#93C5FD',
  'Private Jet / Charter':   '#93C5FD',
  'Airport Transfer':        '#A3E635',
  'Chauffeur / Car Service': '#A3E635',
  'Rail / Train':            '#A3E635',
  'Hotel':                   '#C9A84C',
  'Accommodation':           '#C9A84C',
  'Cruise Line':             '#67E8F9',
  'Yacht / Boat Charter':    '#67E8F9',
  'Dining':                  '#F9A8D4',
  'Experience / Activity':   '#C4B5FD',
  'Tour Guide':              '#C4B5FD',
  'Private Shopping':        '#FDE68A',
  'Leisure':                 '#6EE7B7',
  'Note':                    '#B4AFA5',
  'Other':                   '#B4AFA5',
}

export function getCategoryAccent(category: string | null | undefined): string {
  return CATEGORY_ACCENT[category ?? ''] ?? CATEGORY_ACCENT['Other']
}