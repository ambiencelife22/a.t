// typesSuppliers.ts - Canonical supplier identity registry.
//
// What it owns:
//   - SUPPLIER_TYPES: ordered list of all supplier categories used across
//     travel_suppliers.supplier_type and supplier-related UI dropdowns.
//
// What it does not own:
//   - Aux booking types, flight enums, category accents (see typesElements.ts)
//   - Event lifecycle status (see typesEventStatus.ts)
//   - DB queries, UI rendering
//
// MIRRORS (does not own): the supplier_category Postgres enum on
//   travel_suppliers.supplier_type. The DB enum is the single source; this
//   map exists so the UI can render labels + populate dropdowns. Keep in sync.
//
// Source of truth for:
//   - Display labels + dropdown ordering for supplier categories
//
// Last updated: S53N - reconciled to the supplier_category enum (15 slugs);
//   retired the text+CHECK taxonomy. supplier_type is now enum-backed.
// Prior: S50 - slimmed to single responsibility. Aux booking,
//   flight, category accent, and event status concerns extracted to
//   typesElements.ts and typesEventStatus.ts respectively.
// Prior: S48 - Economy Extra + SEAT_TYPES added. Renamed from
//   supplierTypes.ts to typesSuppliers.ts per types* convention.
// Prior: S48 - initial ship.

// ── Supplier categories ───────────────────────────────────────────────────────
// Keys = supplier_category enum slugs (stored in DB). Values = display labels.
// Order here drives dropdown order.
export const SUPPLIER_TYPE_LABELS = {
  accommodation:    'Accommodation',
  airline:          'Airline',
  aviation:         'Private Aviation',
  ground_transport: 'Ground Transport',
  marine:           'Marine',
  dmc:              'DMC',
  experience:       'Experience',
  event:            'Event',
  dining:           'Dining',
  wellness:         'Wellness',
  medical:          'Medical',
  retail:           'Retail',
  professional:     'Professional Services',
  lifestyle:        'Lifestyle',
  other:            'Other',
} as const

export type SupplierType = keyof typeof SUPPLIER_TYPE_LABELS
export const SUPPLIER_TYPES = Object.keys(SUPPLIER_TYPE_LABELS) as SupplierType[]