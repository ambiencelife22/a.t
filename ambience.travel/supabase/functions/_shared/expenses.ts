// supabase/functions/_shared/expenses.ts
// Shared constants and helpers for the Financial Module.
// Imported by travel-read-expenses and travel-write-expenses.
// Single source - no duplication across EFs.
// Last updated: S53G v3 - derived check-in time columns added.
//   transfer_minutes, early_checkin_approved_time, late_checkout_approved_time
//   added to BOOKING_FINANCIAL_SELECT. Hotel policy times joined from
//   travel_accom_hotels via accom_hotel_id FK.
// Prior: S53G v2 - rate_type_id, payment_platform, net_rate selling_price,
//   commission receipt columns added. computeNetRevenue rate-type-aware.

// ── Select strings ────────────────────────────────────────────────────────────

export const EXPENSE_SELECT = `
  id, engagement_id, booking_id, destination_id, team_member_id,
  expense_type, description, total_amount, total_amount_usd, currency, billing_status,
  paid_at, billed_at, reimbursed_at, linked_at, notes,
  created_by, created_at, updated_at,
  items:travel_expense_items(
    id, expense_id, item_type, description, amount,
    receipt_ref, deductibility, recipient_id, paid_by, paid_at, sort_order
  )
`

export const BOOKING_FINANCIAL_SELECT = `
  id, journey_id, engagement_id, name, status, confirmation_number,
  accom_hotel_id, supplier_id, supplier_name_override,
  start_date, end_date, nights, currency, price,
  cost,
  total_rate, total_rate_usd,
  commissionable_rate, commissionable_rate_usd, is_commissionable,
  commission_pct, commission_amount, commission_amount_usd, commission_paid_at,
  commission_received_amount, commission_payment_fee_pct, commission_payment_fee_amt,
  commission_net_received, commission_net_received_usd,
  commission_deductions_total, commission_deductions_total_usd,
  net_revenue, net_revenue_usd,
  taxes_and_fees, taxes_and_fees_usd,
  referral_partner_id, referral_share_pct, referral_share_amt,
  iata_partner_id, iata_share_pct, iata_share_amt,
  individual_id, individual_share_pct, individual_share_amt,
  deposit_amount, deposit_due_date, deposit_paid_at,
  balance_amount, balance_due_date, balance_paid_at,
  payment_exception_override,
  invoice_number, board_basis_id, payment_terms_id, pricing_basis_id, rate_label_id, sort_order,
  cancellation_policy, notes,
  selling_price, selling_price_usd,
  rate_type_id,
  commission_payment_platform_id,
  commission_transaction_ref,
  commission_remitting_partner_id,
  transfer_minutes,
  early_checkin_approved_time,
  late_checkout_approved_time,
  travel_rate_types!rate_type_id(slug, label),
  travel_board_bases!board_basis_id(display_name),
  travel_payment_terms!payment_terms_id(display_name),
  travel_pricing_bases!pricing_basis_id(display_name),
  travel_rate_labels!rate_label_id(display_name, client_visible),
  travel_payment_platforms!commission_payment_platform_id(slug, label, default_fee_pct),
  travel_partners!commission_remitting_partner_id(id, name, partner_type),
  travel_accom_hotels!accom_hotel_id(
    standard_checkin_time,
    standard_checkout_time
  )
`

// ROOM_SELECT - party_composition added for timeline room shape.
// check_in_time is the room-level override; when null the booking-level
// derived check-in time (from buildHotelItems in timeline.ts) applies.
export const ROOM_SELECT = `
  id, booking_id, room_name, confirmation_number, guest_name,
  person_id, second_person_id, original_person_id,
  party_composition, nights, rate, tax_pct, total,
  sort_order, check_in_time, brief_image_src
`

// ── Helpers ───────────────────────────────────────────────────────────────────

export function deriveSummary(expenses: Array<Record<string, unknown>>) {
  const _amt = (e: Record<string, unknown>) => (e.total_amount_usd ?? e.total_amount ?? 0) as number
  const absorbed    = expenses.filter(e => e.billing_status === 'absorbed' || e.billing_status === 'written_off').reduce((s, e) => s + _amt(e), 0)
  const billable    = expenses.filter(e => e.billing_status === 'billable').reduce((s, e) => s + _amt(e), 0)
  const outstanding = expenses.filter(e => e.billing_status === 'billed').reduce((s, e) => s + _amt(e), 0)
  const paid        = expenses.filter(e => e.billing_status === 'paid').reduce((s, e) => s + _amt(e), 0)
  return { total_absorbed: absorbed, total_billable: billable, total_outstanding: outstanding, total_paid: paid }
}

export function groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of arr) {
    const k = item[key] as string
    ;(out[k] ??= []).push(item)
  }
  return out
}

// Split node shape (travel_commission_splits). resolved_amount is the overlay
// (your override); estimated_amount is canon (the rule's suggestion). Overlay wins.
type CommissionSplit = {
  flow: string                       // 'upstream' | 'downstream'
  resolved_amount: number | null
  estimated_amount: number | null
}

// Amount to use for a split: overlay (resolved) wins, otherwise canon (estimated).
function splitAmount(s: CommissionSplit): number {
  return (s.resolved_amount ?? s.estimated_amount ?? 0)
}

// Sum of downstream payouts (ambience's own distributions). Upstream is NOT
// summed here - it's already deducted before ambience received the money
// (baked into commission_net_received); subtracting it again double-counts.
function sumDownstream(splits: CommissionSplit[]): number {
  return splits
    .filter(s => s.flow === 'downstream')
    .reduce((sum, s) => sum + splitAmount(s), 0)
}

// Net revenue - rate-type-aware single source.
// commissionable: net_received (after platform fee) minus partner shares.
//   Falls back to commission_amount_usd if not yet received.
// net_rate: selling_price_usd minus total_rate_usd (the spread).
// complimentary/staff/fam: zero revenue by definition.
// package: treated as commissionable unless selling_price set.
// Markup revenue: the margin ambience adds over supplier net (declared, not
// inferred). Lateral to commission - a booking can earn both. Returns the USD
// markup when has_markup is declared, else 0.
function markupRevenue(b: Record<string, unknown>): number {
  if (b.has_markup !== true) return 0
  const commAmt = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const commNat = (b.commission_amount ?? 0) as number
  const fx      = (commNat && b.commission_amount_usd) ? (commAmt / commNat) : 1
  const usd = b.markup_amount_usd as number | null
  const nat = b.markup_amount as number | null
  const markup = usd != null ? usd : nat != null ? (nat * fx) : 0
  return Math.round(markup * 100) / 100
}

// Net revenue = commission net + markup (both lateral revenue modes, coexist).
// Single add point for markup regardless of which commission branch fires.
export function computeNetRevenue(b: Record<string, unknown>): number {
  return Math.round((computeCommissionNet(b) + markupRevenue(b)) * 100) / 100
}

function computeCommissionNet(b: Record<string, unknown>): number {
  // Declared commissionability governs (single source). A non-commissionable
  // booking earns zero commission regardless of rate_type or received amounts.
  // total_rate still counts toward sales volume elsewhere. (Markup, if any, is
  // added by computeNetRevenue - a non-commissionable booking can still mark up.)
  if (b.is_commissionable === false) return 0
  const rateType = (b.travel_rate_types as { slug: string } | null)?.slug
    ?? 'commissionable'

  if (rateType === 'complimentary' || rateType === 'staff_rate' || rateType === 'fam_rate') {
    return 0
  }

  if (rateType === 'net_rate') {
    // Declared markup governs: if has_markup, the markup_amount IS the spread and
    // computeNetRevenue adds it - do NOT also infer selling - cost (double-count).
    if (b.has_markup === true) return 0
    const selling = (b.selling_price_usd ?? b.selling_price ?? 0) as number
    const cost    = (b.total_rate_usd ?? b.total_rate ?? 0) as number
    return Math.round((selling - cost) * 100) / 100
  }

// commissionable / package / fallback
  // All arithmetic in USD. Native-currency columns (commission_net_received,
  // flat share amounts) are converted via the booking's implied FX factor
  // (commission_amount_usd / commission_amount) before combining with USD.
  const commAmt = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const commNat = (b.commission_amount ?? 0) as number
  const fx      = (commNat && b.commission_amount_usd) ? (commAmt / commNat) : 1

  // ACTUAL governs once received: net revenue = received (USD) - fee (USD).
  // Makes the engagement rollup reflect real money in the bank.
  if (b.commission_paid_at != null && b.commission_received_amount != null) {
    // ACTUAL governs once received. Net = gross minus typed deductions, owned by
    // travel_commission_deductions and trigger-written to commission_net_received.
    // Prefer the derived net; fall back to gross - fee_amt only for legacy receipts
    // recorded before the deductions model (no deduction rows, net not yet derived).
    const netUsd = b.commission_net_received_usd as number | null
    const net    = b.commission_net_received as number | null
    const paidBase = netUsd != null ? netUsd
                   : net != null    ? (net * fx)
                   : ((b.commission_received_amount as number) - ((b.commission_payment_fee_amt ?? 0) as number))
    // DOWNSTREAM splits (ambience's own payouts, e.g. a referral partner's 90%)
    // must come out of the paid net too - the money passed through, was never ours.
    // Upstream is already baked into net_received; never re-subtract.
    const paidSplits = b._splits as CommissionSplit[] | undefined
    const paidDownstream = (paidSplits && paidSplits.length > 0) ? sumDownstream(paidSplits) : 0
    return Math.round((paidBase - paidDownstream) * 100) / 100
  }
  // EXPECTED until received. Prefer the stored USD twin (sticky override),
  // else expected-net native x fx, else gross (direct: no split).
  const netRecvUsd = b.commission_net_received_usd as number | null
  const netRecv = b.commission_net_received as number | null
  const base    = netRecvUsd != null ? netRecvUsd
                : netRecv != null    ? (netRecv * fx)
                : commAmt

  // Splits govern when present: subtract only DOWNSTREAM payouts (ambience's
  // own distributions). Upstream is already gone from base - never re-subtract.
  const splits = b._splits as CommissionSplit[] | undefined
  if (splits && splits.length > 0) {
    return Math.round((base - sumDownstream(splits)) * 100) / 100
  }

  // Legacy fallback (no splits yet): flat share columns (native → USD via fx).
  // If commission_net_received is set, partner cut is already baked in -
  // do NOT subtract flat share columns again (double-count).
  if (netRecv != null) {
    return Math.round((base) * 100) / 100
  }

  const referral = ((b.referral_share_amt   ?? 0) as number) * fx
  const iata     = ((b.iata_share_amt       ?? 0) as number) * fx
  const indiv    = ((b.individual_share_amt ?? 0) as number) * fx
  // Deductions (cost-of-collection) come out of expected net too. Pre-receipt they
  // are not yet in commission_net_received (that is receipt-derived), so subtract
  // the trigger-maintained total here. commission_deductions_total_usd is always
  // current (trigger writes it on any deduction change, received or not).
  const deductions = (b.commission_deductions_total_usd as number | null) ?? (((b.commission_deductions_total ?? 0) as number) * fx)
  return Math.round((base - referral - iata - indiv - deductions) * 100) / 100
}

// Net commission expected by ambience - gross minus upstream partner shares.
// When commission_net_received is set, that IS the expected net (partner already
// took their cut before remitting). When not set, subtract flat share columns
// from gross to derive what ambience expects to receive.
export function computeExpectedCommission(b: Record<string, unknown>): number {
  if (b.is_commissionable === false) return 0
  // All arithmetic in USD. Native share columns converted via implied FX.
  const commAmt = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const commNat = (b.commission_amount ?? 0) as number
  const fx      = (commNat && b.commission_amount_usd) ? (commAmt / commNat) : 1
  // EXPECTED net. Prefer the stored USD twin (sticky override), else native x fx.
  const netRecvUsd = b.commission_net_received_usd as number | null
  if (netRecvUsd != null) {
    return Math.round(netRecvUsd * 100) / 100
  }
  const netRecv = b.commission_net_received as number | null
  if (netRecv != null) {
    return Math.round((netRecv * fx) * 100) / 100
  }
  const referral = ((b.referral_share_amt   ?? 0) as number) * fx
  const iata     = ((b.iata_share_amt       ?? 0) as number) * fx
  const indiv    = ((b.individual_share_amt ?? 0) as number) * fx
  return Math.round((commAmt - referral - iata - indiv) * 100) / 100
}
// Commission truth for a booking, all USD. Single-source, three separate facts.
// Fees are a COST OF COLLECTION, never a shortfall against what we were owed, so
// they are NOT charged against variance. Variance measures REMITTANCE ACCURACY only:
// did the payer remit the commission we were owed?
//   expected_net_usd     = the claim (commission owed): commission_amount_usd
//   gross_received_usd    = what was remitted (before deductions)
//   variance_usd          = gross_received - expected  (0/+ healthy; - = underpaid)
//   deductions_usd        = SUM of typed travel_commission_deductions (cost of collection)
//   actual_net_usd        = what landed = gross - deductions (= commission_net_received)
// deductions never touch variance; they are their own itemized fact.
export function commissionTriad(b: Record<string, unknown>): {
  expected_net_usd:  number
  gross_received_usd: number | null
  deductions_usd:    number | null
  actual_net_usd:    number | null
  variance_usd:      number | null
  variance_pct:      number | null
} {
  // Non-commissionable: no claim, no receipt, no variance. Zero-triad.
  if (b.is_commissionable === false) {
    return { expected_net_usd: 0, gross_received_usd: null, deductions_usd: null,
             actual_net_usd: null, variance_usd: null, variance_pct: null }
  }
  const commAmt = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const commNat = (b.commission_amount ?? 0) as number
  const fx      = (commNat && b.commission_amount_usd) ? (commAmt / commNat) : 1
  // EXPECTED = the claim (commission owed).
  const expected_net_usd = commAmt
  const paid = b.commission_paid_at != null && b.commission_received_amount != null
  if (!paid) {
    return { expected_net_usd, gross_received_usd: null, deductions_usd: null,
             actual_net_usd: null, variance_usd: null, variance_pct: null }
  }
  // GROSS remitted, in USD. The receipt is a USD bank fact (ambience receives USD
  // into a USD account); it is NOT converted by the EUR/native fx. Using it directly
  // is the single source of received truth.
  const gross_received_usd = Math.round((b.commission_received_amount as number) * 100) / 100
  // NET landed = deductions-derived commission_net_received(_usd); legacy fallback
  // to gross - fee_amt for receipts predating the deductions model.
  const netRecvUsd = b.commission_net_received_usd as number | null
  const netRecv    = b.commission_net_received as number | null
  const actual_net_usd = netRecvUsd != null ? Math.round(netRecvUsd * 100) / 100
    : netRecv != null ? Math.round(netRecv * fx * 100) / 100
    : Math.round(((b.commission_received_amount as number) - ((b.commission_payment_fee_amt ?? 0) as number)) * 100) / 100
  // DEDUCTIONS = gross - net (cost of collection). Own fact, never in variance.
  const deductions_usd = Math.round((gross_received_usd - actual_net_usd) * 100) / 100
  // VARIANCE = remittance accuracy: gross vs owed. Fees excluded by construction.
  const variance_usd = Math.round((gross_received_usd - expected_net_usd) * 100) / 100
  const variance_pct = expected_net_usd !== 0
    ? Math.round((variance_usd / expected_net_usd) * 10000) / 100
    : null
  return { expected_net_usd, gross_received_usd, deductions_usd, actual_net_usd, variance_usd, variance_pct }
}

// Flattens the travel_accom_hotels join into _standard_checkin_time and
// _standard_checkout_time on the booking row - the shape timeline.ts expects.
// Call this after fetching bookings with BOOKING_FINANCIAL_SELECT before
// passing them to buildTimeline().

export function enrichBookingWithHotelPolicy(
  b: Record<string, unknown>
): Record<string, unknown> {
  const hotel = b.travel_accom_hotels as {
    standard_checkin_time:  string | null
    standard_checkout_time: string | null
  } | null

  return {
    ...b,
    _standard_checkin_time:  hotel?.standard_checkin_time  ?? null,
    _standard_checkout_time: hotel?.standard_checkout_time ?? null,
  }
}