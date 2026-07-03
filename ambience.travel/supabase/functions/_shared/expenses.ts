// supabase/functions/_shared/expenses.ts
// Shared constants and helpers for the Financial Module.
// Imported by travel-read-expenses and travel-write-expenses.
// Single source — no duplication across EFs.
// Last updated: S53G v3 — derived check-in time columns added.
//   transfer_minutes, early_checkin_approved_time, late_checkout_approved_time
//   added to BOOKING_FINANCIAL_SELECT. Hotel policy times joined from
//   travel_accom_hotels via accom_hotel_id FK.
// Prior: S53G v2 — rate_type_id, payment_platform, net_rate selling_price,
//   commission receipt columns added. computeNetRevenue rate-type-aware.

// ── Select strings ────────────────────────────────────────────────────────────

export const EXPENSE_SELECT = `
  id, engagement_id, booking_id, destination_id, team_member_id,
  expense_type, description, total_amount, currency, billing_status,
  paid_at, billed_at, reimbursed_at, linked_at, notes,
  created_by, created_at, updated_at,
  items:travel_expense_items(
    id, expense_id, item_type, description, amount,
    receipt_ref, deductibility, recipient_id, paid_by, paid_at, sort_order
  )
`

export const BOOKING_FINANCIAL_SELECT = `
  id, trip_id, engagement_id, name, booking_type, status, confirmation_number,
  accom_hotel_id, supplier_id, supplier_name_override,
  start_date, end_date, nights, currency, price,
  cost,
  total_rate, total_rate_usd,
  commissionable_rate, commissionable_rate_usd,
  commission_pct, commission_amount, commission_amount_usd, commission_paid_at,
  commission_received_amount, commission_payment_fee_pct, commission_payment_fee_amt,
  commission_net_received,
  net_revenue, net_revenue_usd,
  taxes_and_fees, taxes_and_fees_usd,
  referral_partner_id, referral_share_pct, referral_share_amt,
  iata_partner_id, iata_share_pct, iata_share_amt,
  individual_id, individual_share_pct, individual_share_amt,
  deposit_amount, deposit_due_date, deposit_paid_at,
  balance_amount, balance_due_date, balance_paid_at,
  payment_exception_override,
  invoice_number, rate_type, sort_order,
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
  travel_payment_platforms!commission_payment_platform_id(slug, label, default_fee_pct),
  travel_partners!commission_remitting_partner_id(id, name, partner_type),
  travel_accom_hotels!accom_hotel_id(
    standard_checkin_time,
    standard_checkout_time
  )
`

// ROOM_SELECT — party_composition added for timeline room shape.
// check_in_time is the room-level override; when null the booking-level
// derived check-in time (from buildHotelItems in timeline.ts) applies.
export const ROOM_SELECT = `
  id, booking_id, room_name, confirmation_number, guest_name,
  party_composition, nights, rate, tax_pct, total,
  sort_order, check_in_time, brief_image_src
`

// ── Helpers ───────────────────────────────────────────────────────────────────

export function deriveSummary(expenses: Array<Record<string, unknown>>) {
  const absorbed    = expenses.filter(e => e.billing_status === 'absorbed' || e.billing_status === 'written_off').reduce((s, e) => s + (e.total_amount as number), 0)
  const billable    = expenses.filter(e => e.billing_status === 'billable').reduce((s, e) => s + (e.total_amount as number), 0)
  const outstanding = expenses.filter(e => e.billing_status === 'billed').reduce((s, e) => s + (e.total_amount as number), 0)
  const paid        = expenses.filter(e => e.billing_status === 'paid').reduce((s, e) => s + (e.total_amount as number), 0)
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
// summed here — it's already deducted before ambience received the money
// (baked into commission_net_received); subtracting it again double-counts.
function sumDownstream(splits: CommissionSplit[]): number {
  return splits
    .filter(s => s.flow === 'downstream')
    .reduce((sum, s) => sum + splitAmount(s), 0)
}

// Net revenue — rate-type-aware single source.
// commissionable: net_received (after platform fee) minus partner shares.
//   Falls back to commission_amount_usd if not yet received.
// net_rate: selling_price_usd minus total_rate_usd (the spread).
// complimentary/staff/fam: zero revenue by definition.
// package: treated as commissionable unless selling_price set.
export function computeNetRevenue(b: Record<string, unknown>): number {
  const rateType = (b.travel_rate_types as { slug: string } | null)?.slug
    ?? (b.rate_type as string | null)
    ?? 'commissionable'

  if (rateType === 'complimentary' || rateType === 'staff_rate' || rateType === 'fam_rate') {
    return 0
  }

  if (rateType === 'net_rate') {
    const selling = (b.selling_price_usd ?? b.selling_price ?? 0) as number
    const cost    = (b.total_rate_usd ?? b.total_rate ?? 0) as number
    return Math.round((selling - cost) * 100) / 100
  }

// commissionable / package / fallback
  // base = what reached ambience (net of any upstream partner cut, which is
  // already baked into commission_net_received).
  const commAmt = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const base    = (b.commission_net_received as number | null) ?? commAmt

  // Splits govern when present: subtract only DOWNSTREAM payouts (ambience's
  // own distributions). Upstream is already gone from base — never re-subtract.
  const splits = b._splits as CommissionSplit[] | undefined
  if (splits && splits.length > 0) {
    return Math.round((base - sumDownstream(splits)) * 100) / 100
  }

  // Legacy fallback (no splits yet): flat share columns. Retained so bookings
  // not yet migrated to the tree don't regress. Dropped when flat cols retire.
  // If commission_net_received is set, partner cut is already baked in —
  // do NOT subtract flat share columns again (double-count).
  if (b.commission_net_received != null) {
    return Math.round((base) * 100) / 100
  }
  const referral = (b.referral_share_amt   ?? 0) as number
  const iata     = (b.iata_share_amt       ?? 0) as number
  const indiv    = (b.individual_share_amt ?? 0) as number
  return Math.round((base - referral - iata - indiv) * 100) / 100
}

// Net commission expected by ambience — gross minus upstream partner shares.
// When commission_net_received is set, that IS the expected net (partner already
// took their cut before remitting). When not set, subtract flat share columns
// from gross to derive what ambience expects to receive.
export function computeExpectedCommission(b: Record<string, unknown>): number {
  const commAmt = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  if ((b.commission_net_received as number | null) != null) {
    return commAmt - ((b.iata_share_amt ?? 0) as number) - ((b.referral_share_amt ?? 0) as number) - ((b.individual_share_amt ?? 0) as number)
  }
  const referral = (b.referral_share_amt   ?? 0) as number
  const iata     = (b.iata_share_amt       ?? 0) as number
  const indiv    = (b.individual_share_amt ?? 0) as number
  return Math.round((commAmt - referral - iata - indiv) * 100) / 100
}

// ── Booking enrichment helper ─────────────────────────────────────────────────
// Flattens the travel_accom_hotels join into _standard_checkin_time and
// _standard_checkout_time on the booking row — the shape timeline.ts expects.
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