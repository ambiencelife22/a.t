// supabase/functions/_shared/confirmation.ts
//
// Single source for "is this booking confirmed" — DERIVED from confirmation-number
// evidence, never from a hand-set status field. One definition, imported by every
// surface (calendar EF, client EFs) so they can NEVER contradict each other.
//
// Why this exists (S55): "confirmed-ness" was smeared across travel_bookings.status
// (manual lifecycle text) and travel_booking_rooms.confirmation_number (per-room conf),
// which drifted independently — the calendar showed "quoted" while the confirmation
// page showed the conf number for the same stay. Confirmation is EARNED (the conf
// number IS the confirmation), not a flag someone maintains. The platform derives it.
//
// The booking lives in two phases:
//   DESIGN  — before any confirmation evidence: bookings.status is the designer's
//             narrative (recommended/quoted/pending). NOT this helper's concern.
//   CONFIRMED — the moment confirmation evidence exists, derived automatically here.
//
// Confirmation is a SEPARATE dimension from lifecycle status (same principle as the
// engagement model: declared lifecycle vs derived operational fact). This helper owns
// ONLY the derived confirmation dimension. It never reads or returns bookings.status.

export type ConfirmationState = 'confirmed' | 'partially_confirmed' | 'designing'

export interface ConfirmationInput {
  // Each room's confirmation number (null/empty = that room not yet confirmed).
  rooms: Array<{ confirmation_number: string | null }>
  // Booking-level confirmation number — some hotels issue one conf for the whole
  // booking with no per-room breakdown. null/empty = none at booking level.
  bookingConfirmationNumber: string | null
  // The designer's explicit lifecycle label (travel_bookings.status). When the
  // designer has explicitly marked a booking 'confirmed' or 'paid', that is their
  // authoritative assertion that it's real — honored even when the conf number was
  // never recorded (e.g. older bookings). This is what stops the platform from
  // wrongly showing a genuinely-confirmed booking as still "designing".
  bookingStatus: string | null
}

// Designer-set statuses that assert the booking is real (confirmed or beyond).
const STATUS_ASSERTS_CONFIRMED = new Set(['confirmed', 'paid'])

function hasValue(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0
}

/**
 * Derive the confirmation state. A booking is confirmed if EITHER signal says so —
 * confirmation-number evidence OR the designer's explicit assertion. It is only
 * 'designing' when neither exists. This never wrongly downgrades a real booking in
 * either drift direction (stale status with real confs; or explicit confirm with no
 * conf recorded).
 *
 * Precedence (evidence first, then designer assertion):
 *   ALL rooms have conf numbers                  -> 'confirmed'
 *   SOME rooms have conf numbers                 -> 'partially_confirmed'
 *   NO room confs, but booking-level conf exists -> 'confirmed'
 *   designer marked status confirmed/paid        -> 'confirmed'
 *   none of the above                            -> 'designing'
 *
 * partially_confirmed wins over status assertion: if some-but-not-all rooms are
 * confirmed, that mixed reality is shown honestly even if status says 'confirmed' —
 * the per-room truth is more specific than the booking-level label.
 */
export function deriveConfirmation(input: ConfirmationInput): ConfirmationState {
  const rooms = input.rooms ?? []
  const confirmedRooms = rooms.filter(r => hasValue(r.confirmation_number))

  if (rooms.length > 0 && confirmedRooms.length === rooms.length) return 'confirmed'
  if (confirmedRooms.length > 0) return 'partially_confirmed'
  if (hasValue(input.bookingConfirmationNumber)) return 'confirmed'
  if (input.bookingStatus && STATUS_ASSERTS_CONFIRMED.has(input.bookingStatus)) return 'confirmed'
  return 'designing'
}

/**
 * Count helper for surfaces that want to show "3 of 5 rooms confirmed" on a
 * partially_confirmed booking. Returns { confirmed, total }.
 */
export function roomConfirmationCount(
  rooms: Array<{ confirmation_number: string | null }>,
): { confirmed: number; total: number } {
  const total = rooms?.length ?? 0
  const confirmed = (rooms ?? []).filter(r => hasValue(r.confirmation_number)).length
  return { confirmed, total }
}