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
// Everything else is ambience-arranged, regardless of which designer is named.
// Single source — surfaces must not re-derive (booked_by ?? 'ambience').
export function isOwnArrangements(bookedBy: string | null | undefined): boolean {
  return bookedBy === 'self'
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

export function categoryAccentHex(category: string | null | undefined): string {
  return (CATEGORY_ACCENT_MAP[category ?? ''] ?? CATEGORY_ACCENT_DEFAULT).hex
}

export function categoryAccentRgb(category: string | null | undefined): RGB {
  return (CATEGORY_ACCENT_MAP[category ?? ''] ?? CATEGORY_ACCENT_DEFAULT).rgb
}