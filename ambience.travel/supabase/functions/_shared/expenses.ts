// supabase/functions/_shared/expenses.ts
// Shared constants and helpers for the Financial Module.
// Imported by travel-read-expenses and travel-write-expenses.
// Single source — no duplication across EFs.
// Last updated: S53G v2 — rate_type_id, payment_platform, net_rate selling_price,
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
  travel_rate_types!rate_type_id(slug, label),
  travel_payment_platforms!commission_payment_platform_id(slug, label, default_fee_pct)
`

export const ROOM_SELECT = `
  id, booking_id, room_name, confirmation_number, guest_name,
  nights, rate, tax_pct, total, sort_order, check_in_time,
  brief_image_src
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
  // Use net_received if commission has been received, else commission_amount
  const netReceived  = b.commission_net_received != null
    ? (b.commission_net_received as number)
    : null
  const commAmt      = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const base         = netReceived ?? commAmt

  const referral = (b.referral_share_amt   ?? 0) as number
  const iata     = (b.iata_share_amt       ?? 0) as number
  const indiv    = (b.individual_share_amt ?? 0) as number
  return Math.round((base - referral - iata - indiv) * 100) / 100
}