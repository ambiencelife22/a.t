// supabase/functions/_shared/elementStatus.ts
//
// Arc B Phase 4 — the single canonical rollup over Universal Element Status.
// Replaces _shared/confirmation.ts. Per Dev Standards II (canonical helpers):
// this logic lives in ONE place; every surface imports it; no surface re-derives.
//
// confirmation.ts inferred "confirmed" from confirmation_number because, pre-Arc-B,
// that was the only per-element signal. Now every element carries a real status_id
// (the auto-promotion trigger stamps 'confirmed' when a conf number appears, or a
// human sets it). Deriving confirmed-ness a second way from conf-number would
// parallel-ship two implementations of one truth — exactly the drift the canonical-
// helper rule forbids. So the inference is retired; the ROLLUP + the per-child
// honesty rule survive, re-keyed onto status_id.
//
// A parent's display status is DERIVED from its children at read time, never stored
// (storing it would let parent and children disagree). The parent keeps its OWN
// status_id for its own concerns; this is a separate computed view over children.

// Off-ladder stages: guest-arranged, outside ambience's confirmation lifecycle.
// EXCLUDED from rollup math — a guest-managed child neither confirms nor un-confirms
// its parent (an Own-Arrangements transfer must not make a hotel show "Partial").
// sort_order > 90 is the structural signal; slugs listed for clarity.
const OFF_LADDER_SLUGS = new Set(['guest_managed', 'guest_managed_undetermined'])
const CONFIRMED_SORT = 40  // travel_lifecycle_statuses: confirmed

export interface ChildStatus {
  slug: string
  label: string
  sort_order: number
}

export type RollupKind = 'confirmed' | 'partial' | 'pending' | 'empty'

export interface ElementRollup {
  kind: RollupKind
  confirmed: number              // count of rollup-eligible children at >= confirmed
  total: number                  // rollup-eligible total (off-ladder excluded)
  displaySlug: string | null     // representative registry slug for the parent
  displayLabel: string | null
}

/**
 * Roll a parent's display status up from its children's statuses.
 *
 * Off-ladder children (guest_managed/undetermined) are removed BEFORE the math.
 * Precedence (per-child truth beats any parent label — honesty rule carried
 * forward from confirmation.ts):
 *   no eligible children            -> 'empty'
 *   ALL eligible >= confirmed (40)  -> 'confirmed' (lowest such slug as label)
 *   SOME eligible >= confirmed      -> 'partial' (confirmed/total exposed for n/m)
 *   NONE                            -> 'pending' (lowest eligible stage as label)
 */
export function deriveElementStatus(children: ChildStatus[]): ElementRollup {
  const eligible = (children ?? []).filter(c => !OFF_LADDER_SLUGS.has(c.slug))

  if (eligible.length === 0) {
    return { kind: 'empty', confirmed: 0, total: 0, displaySlug: null, displayLabel: null }
  }

  const confirmedChildren = eligible.filter(c => c.sort_order >= CONFIRMED_SORT)
  const confirmed = confirmedChildren.length
  const total = eligible.length

  if (confirmed === total) {
    const lowestConfirmed = [...confirmedChildren].sort((a, b) => a.sort_order - b.sort_order)[0]
    return { kind: 'confirmed', confirmed, total, displaySlug: lowestConfirmed.slug, displayLabel: lowestConfirmed.label }
  }
  if (confirmed > 0) {
    // Mixed reality shown honestly; render layer appends "· n/m" from confirmed/total.
    return { kind: 'partial', confirmed, total, displaySlug: null, displayLabel: null }
  }
  const lowest = [...eligible].sort((a, b) => a.sort_order - b.sort_order)[0]
  return { kind: 'pending', confirmed: 0, total, displaySlug: lowest.slug, displayLabel: lowest.label }
}

// ── Payment exception (Arc B Phase 6) ─────────────────────────────────────────
//
// Guest-surface payment signal, SEPARATE from the lifecycle rollup above. The
// rollup answers "what stage are the children at"; this answers "does this
// booking need the guest's payment attention". Two questions, two helpers — but
// both canonical here so no surface computes payment state inline.
//
// Exception fires when EITHER:
//   (1) an admin has forced it (payment_exception_override === true), OR
//   (2) the balance is overdue by fact: a due date in the past with no payment
//       recorded (balance_due_date < today AND balance_paid_at IS NULL).
//
// A not-yet-due balance is NOT an exception — it is simply future, and stays
// silent. Red is reserved for action-needed, never for future-due. A deposit is
// not considered here; "settled" on the guest surface means the BALANCE is paid.
//
// today: pass the comparison date as 'YYYY-MM-DD'. UTC date is the first cut;
// destination-aware comparison is the same debt logged for the programme "today"
// default (global_destinations.timezone + Intl). Both dates are plain calendar
// dates, so a lexical string compare is correct and avoids Date() UTC-parse traps.

export interface PaymentExceptionInput {
  balance_due_date:           string | null
  balance_paid_at:            string | null
  payment_exception_override: boolean | null
}

export function derivePaymentException(
  b: PaymentExceptionInput,
  today: string,
): boolean {
  if (b.payment_exception_override === true) return true
  if (b.balance_paid_at) return false
  if (!b.balance_due_date) return false
  return b.balance_due_date < today
}
