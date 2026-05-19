// auxBookingTypes.ts — Canonical aux booking type registry for ambience.TRAVEL
//
// What it owns:
//   - AuxBookingType: the canonical union of all valid booking_type values
//     for travel_trip_aux_bookings. These are the only values that should be
//     written to the DB. Never derive display strings from raw DB values.
//   - AUX_BOOKING_TYPE_META: display label, icon, and sort_order for each type.
//     Used by BriefEditorPage, confirmationBriefPdf, and any future surfaces
//     that render grouped aux booking sections.
//   - getAuxTypeMeta: resolver with graceful fallback for unknown types.
//   - AUX_BOOKING_TYPES: ordered array for dropdowns and selects.
//
// Consuming surfaces (current):
//   - BriefEditorPage.tsx — editor section headers + booking_type selector
//   - confirmationBriefPdf.ts — section grouping + card icons
//   - BriefFlightEditor (inline) — booking_type field options
//   - ItineraryEditorPage.tsx — CATEGORIES list (separate surface, not this file)
//
// Naming conventions:
//   - label: ALL CAPS, plural. Rendered as section headers on brief + PDF.
//   - icon: single emoji character. Rendered on cards.
//   - sort_order: controls section render order on brief/PDF. Lower = first.
//     Accommodation (travel_bookings) always renders before aux sections.
//
// To add a new type:
//   1. Add to AuxBookingType union
//   2. Add entry to AUX_BOOKING_TYPE_META with unique sort_order
//   3. No other file changes required — all consumers read from this registry
//
// Last updated: S48 — initial ship.

// ── Canonical type union ──────────────────────────────────────────────────────

export type AuxBookingType =
  | 'Flight'
  | 'Airport Transfer'
  | 'Car Service'

// ── Metadata registry ─────────────────────────────────────────────────────────

export interface AuxBookingTypeMeta {
  label:      string   // Section header label — ALL CAPS plural
  icon:       string   // Card icon — single emoji
  sort_order: number   // Section render order (lower = rendered first)
}

export const AUX_BOOKING_TYPE_META: Record<AuxBookingType, AuxBookingTypeMeta> = {
  'Flight':           { label: 'FLIGHTS',           icon: '✈',  sort_order: 10 },
  'Airport Transfer': { label: 'AIRPORT TRANSFERS', icon: '🚗', sort_order: 20 },
  'Car Service':      { label: 'CAR SERVICES',      icon: '🚘', sort_order: 30 },
}

// ── Fallback resolver ─────────────────────────────────────────────────────────

/**
 * Returns metadata for a given booking_type string.
 * Falls back gracefully for unknown types — never throws.
 * Unknown types render with a generic label and neutral icon.
 */
export function getAuxTypeMeta(bookingType: string | null | undefined): AuxBookingTypeMeta {
  if (!bookingType) return { label: 'OTHER', icon: '·', sort_order: 99 }
  const known = AUX_BOOKING_TYPE_META[bookingType as AuxBookingType]
  if (known) return known
  // Graceful fallback: pluralise the raw value
  const label = bookingType.toUpperCase() + (bookingType.endsWith('s') ? '' : 'S')
  return { label, icon: '·', sort_order: 99 }
}

// ── Ordered array for dropdowns ───────────────────────────────────────────────

/**
 * All canonical aux booking types in sort_order sequence.
 * Use as the options array for booking_type selects in admin UI.
 */
export const AUX_BOOKING_TYPES: AuxBookingType[] = (
  Object.entries(AUX_BOOKING_TYPE_META) as [AuxBookingType, AuxBookingTypeMeta][]
)
  .sort(([, a], [, b]) => a.sort_order - b.sort_order)
  .map(([type]) => type)