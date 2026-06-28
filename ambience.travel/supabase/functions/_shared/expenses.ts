// supabase/functions/_shared/expenses.ts
// Shared constants and helpers for the Financial Module.
// Imported by travel-read-expenses and travel-write-expenses.
// Single source — no duplication across EFs.
// Created: S53G

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
  id, name, booking_type, accom_hotel_id, start_date, end_date, nights, currency,
  cost,
  total_rate, total_rate_usd,
  commissionable_rate, commissionable_rate_usd,
  commission_pct, commission_amount, commission_amount_usd, commission_paid_at,
  net_revenue, net_revenue_usd,
  taxes_and_fees, taxes_and_fees_usd,
  referral_share_amt, iata_share_amt, individual_share_amt,
  deposit_amount, deposit_due_date, deposit_paid_at,
  balance_amount, balance_due_date, balance_paid_at,
  invoice_number, rate_type, sort_order
`

export const ROOM_SELECT = `
  id, booking_id, room_name, confirmation_number, guest_name,
  nights, rate, tax_pct, total, sort_order, check_in_time,
  deposit_amount, balance_amount, brief_image_src
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

// Net revenue = commission minus all partner shares
export function computeNetRevenue(b: Record<string, unknown>): number {
  const comm     = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const referral = (b.referral_share_amt    ?? 0) as number
  const iata     = (b.iata_share_amt        ?? 0) as number
  const indiv    = (b.individual_share_amt  ?? 0) as number
  return Math.round((comm - referral - iata - indiv) * 100) / 100
}