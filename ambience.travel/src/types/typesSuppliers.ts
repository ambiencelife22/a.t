// typesSuppliers.ts — Canonical supplier type + aux booking type registry.
//
// What it owns:
//   - SUPPLIER_TYPES: ordered list of all supplier categories used across
//     travel_suppliers.supplier_type and related UI dropdowns.
//   - AUX_BOOKING_TYPES: full taxonomy of aux booking types for
//     travel_trip_aux_bookings.booking_type — superset of the legacy
//     typesAuxBooking.ts registry (Flight, Airport Transfer, Car Service).
//   - CABIN_CLASSES: flight cabin class options.
//   - SEAT_TYPES: flight seat position options.
//   - CATEGORY_ACCENT: accent colours per booking/entry category.
//   - Helpers: isFlightType, getCategoryAccent.
//
// What it does not own:
//   - typesAuxBooking.ts — legacy registry (Flight / Airport Transfer /
//     Car Service only). Kept for backward compatibility with existing
//     BriefEditorPage + pdfImmerseConfirmation surfaces until migrated.
//   - DB queries — no Supabase imports.
//   - UI rendering — no React imports.
//
// Source of truth for:
//   - travel_suppliers.supplier_type values + CHECK constraint
//   - travel_trip_aux_bookings.booking_type values
//   - travel_trip_aux_bookings.cabin_class values + CHECK constraint
//   - travel_trip_aux_bookings.seat_type values + CHECK constraint
//   - travel_trip_day_entries.category values
//   - All supplier/booking type dropdowns across admin UI
//
// Last updated: S48 — Economy Extra + SEAT_TYPES added. Renamed from
//   supplierTypes.ts to typesSuppliers.ts per types* convention.
// Prior: S48 — initial ship.

// ── Supplier types ─────────────────────────────────────────────────────────────
// Ordered by logical travel workflow — transport first, experiences, then admin.

export const SUPPLIER_TYPES = [
  'Accommodation',
  'Commercial Airline',
  'Private Jet / Charter',
  'Chauffeur / Car Service',
  'Airport Transfer',
  'Rail / Train',
  'Cruise Line',
  'Yacht / Boat Charter',
  'Tour Operator',
  'Destination Management Company',
  'Tour Guide',
  'Experience / Activity',
  'Private Shopping',
  'Travel Insurance',
  "Gov't / Legal",
  'Other',
] as const

export type SupplierType = typeof SUPPLIER_TYPES[number]

// ── Aux booking types ──────────────────────────────────────────────────────────
// Subset of SUPPLIER_TYPES that apply to travel_trip_aux_bookings.booking_type.
// Excludes supplier-only categories (Tour Operator, Travel Insurance etc.)
// that represent supplier relationships rather than bookable trip elements.

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

// ── Flight-specific booking types ─────────────────────────────────────────────
// Used to conditionally render flight-specific fields (airline, flight number,
// cabin class, seat type, seat numbers, aircraft type) in the UI.

export const FLIGHT_BOOKING_TYPES: ReadonlySet<string> = new Set([
  'Flight',
  'Private Jet / Charter',
])

export function isFlightType(bookingType: string | null | undefined): boolean {
  return FLIGHT_BOOKING_TYPES.has(bookingType ?? '')
}

// ── Cabin classes ──────────────────────────────────────────────────────────────
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

// ── Seat types ─────────────────────────────────────────────────────────────────
// Mirrors travel_trip_aux_bookings.seat_type CHECK constraint.
// Applies per booking (not per passenger — use seat_numbers for per-pax detail).

export const SEAT_TYPES = [
  'Window',
  'Middle',
  'Aisle',
] as const

export type SeatType = typeof SEAT_TYPES[number]

// ── Category accent colours ────────────────────────────────────────────────────
// Single source of truth — import from here, never hardcode in components or
// PDF renderers. Mirrors pdfImmerseProgramme.ts and ItineraryEditorPage.tsx.

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