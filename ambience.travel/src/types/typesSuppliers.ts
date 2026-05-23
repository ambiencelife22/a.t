// typesSuppliers.ts — Canonical supplier identity registry.
//
// What it owns:
//   - SUPPLIER_TYPES: ordered list of all supplier categories used across
//     travel_suppliers.supplier_type and supplier-related UI dropdowns.
//
// What it does not own:
//   - Aux booking types, flight enums, category accents (see typesAuxBookings.ts)
//   - Event lifecycle status (see typesEventStatus.ts)
//   - DB queries, UI rendering
//
// Source of truth for:
//   - travel_suppliers.supplier_type CHECK constraint
//   - All supplier type dropdowns across admin UI
//
// Last updated: S50 — slimmed to single responsibility. Aux booking,
//   flight, category accent, and event status concerns extracted to
//   typesAuxBookings.ts and typesEventStatus.ts respectively.
// Prior: S48 — Economy Extra + SEAT_TYPES added. Renamed from
//   supplierTypes.ts to typesSuppliers.ts per types* convention.
// Prior: S48 — initial ship.

// ── Supplier types ────────────────────────────────────────────────────────────
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