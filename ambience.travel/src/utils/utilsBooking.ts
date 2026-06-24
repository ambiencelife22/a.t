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