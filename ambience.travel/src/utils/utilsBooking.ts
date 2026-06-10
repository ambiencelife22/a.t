// utilsBooking.ts — Shared booking display helpers across ambience.TRAVEL.
//
// Canonical bookedByLabel — single source for all surfaces.
// Rules:
//   - null/undefined/'ambience' → 'Booked by ambience'
//   - 'self'                    → 'Own Arrangements'
//   - anything else             → 'Booked by {value}'
//
// Used by:
//   - ImmerseTripPage.tsx (TripBriefTab web surface)
//   - TripConfirmationPage.tsx (confirmation document body)
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