// queriesAdminFinance.ts — Admin queries for the Financial Module v1.
//
// All reads + writes go through travel-read-expenses and travel-write-expenses
// EFs via supabase.functions.invoke. Zero direct supabase.from() calls.
//
// Last updated: S53G v2 — EngagementFull type + fetchEngagementFull added.

import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillingStatus = 'absorbed' | 'billable' | 'billed' | 'paid' | 'written_off'

export type ExpenseItem = {
  id:            string
  expense_id:    string
  item_type:     string
  description:   string
  amount:        number
  receipt_ref:   string | null
  deductibility: string | null
  recipient_id:  string | null
  paid_by:       string | null
  paid_at:       string | null
  sort_order:    number
}

export type Expense = {
  id:             string
  engagement_id:  string | null
  booking_id:     string | null
  destination_id: string | null
  team_member_id: string | null
  expense_type:   string
  description:    string
  total_amount:   number
  currency:       string
  billing_status: BillingStatus
  paid_at:        string | null
  billed_at:      string | null
  reimbursed_at:  string | null
  linked_at:      string | null
  notes:          string | null
  created_by:     string | null
  created_at:     string
  updated_at:     string
  items:          ExpenseItem[]
}

export type EngagementSummaryFull = {
  total_commission:        number
  commission_received:     number
  commission_outstanding:  number
  total_rate:              number
  total_amenities:         number
  total_net_revenue:       number
  total_referral:          number
  total_iata:              number
  total_individual:        number
  deposit_outstanding:     number
  balance_outstanding:     number
  total_absorbed:          number
  total_billable:          number
  total_outstanding:       number
  total_paid:              number
  net_margin:              number
}

export type EngagementFull = {
  engagement: {
    id:      string
    title:   string | null
    url_id:  string
    travel_trips: { trip_code: string | null; start_date: string | null; end_date: string | null } | null
  }
  bookings: Record<string, unknown>[]
  expenses: Expense[]
  summary:  EngagementSummaryFull
}

export type PipelineTrip = {
  engagement_id:           string
  url_id:                  string
  title:                   string | null
  status_slug:             string | null
  trip_code:               string | null
  start_date:              string | null
  end_date:                string | null
  primary_client_id:       string | null
  total_commission:        number
  commission_received:     number
  commission_outstanding:  number
  total_rate:              number | null
  total_amenities:         number
  total_absorbed:          number
  total_billable:          number
  total_outstanding:       number
  net_margin:              number
}

export type CreateExpensePayload = {
  expense_type:    string
  description:     string
  total_amount:    number
  engagement_id?:  string | null
  booking_id?:     string | null
  destination_id?: string | null
  team_member_id?: string | null
  currency?:       string
  billing_status?: BillingStatus
  notes?:          string | null
}

// ── Error helper ──────────────────────────────────────────────────────────────

async function extractError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  const fallback = error instanceof Error ? error.message : 'Unexpected error'
  if (!ctx || typeof ctx.json !== 'function') return fallback
  const body = await ctx.json().catch(() => null) as { error?: string; message?: string } | null
  return body?.message ?? body?.error ?? fallback
}

const READ_EF  = 'travel-read-expenses'
const WRITE_EF = 'travel-write-expenses'

// ── Read functions ─────────────────────────────────────────────────────────────

export async function fetchPipeline(): Promise<PipelineTrip[]> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'pipeline' },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.trips as PipelineTrip[]
}

export async function fetchEngagementFull(engagementId: string): Promise<EngagementFull> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode: 'by_engagement_full', engagement_id: engagementId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data as EngagementFull
}

// ── Write functions ────────────────────────────────────────────────────────────

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'create_expense', ...payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.message ?? data.error)
  return data.expense as Expense
}

export async function updateExpense(id: string, patch: Partial<CreateExpensePayload>): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_expense', id, patch },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.expense as Expense
}

export async function deleteExpense(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'delete_expense', id },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.message ?? data.error)
}

export async function markBilled(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'mark_billed', expense_id: expenseId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.expense as Expense
}

export async function markPaid(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'mark_paid', expense_id: expenseId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.expense as Expense
}

export async function writeOff(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'write_off', expense_id: expenseId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.expense as Expense
}

export async function linkEngagement(expenseId: string, engagementId: string): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'link_engagement', expense_id: expenseId, engagement_id: engagementId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.expense as Expense
}

// ── Payment platform + rate type registry ─────────────────────────────────────

export type PaymentPlatform = {
  id:              string
  slug:            string
  label:           string
  default_fee_pct: number
  sort_order:      number
  is_active:       boolean
}

export type RateType = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
  is_active:  boolean
}

export async function fetchPaymentPlatforms(): Promise<PaymentPlatform[]> {
  const { data, error } = await supabase
    .from('travel_payment_platforms')
    .select('id, slug, label, default_fee_pct, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data as PaymentPlatform[]
}

export async function fetchRateTypes(): Promise<RateType[]> {
  const { data, error } = await supabase
    .from('travel_rate_types')
    .select('id, slug, label, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return data as RateType[]
}

export async function markCommissionReceived(payload: {
  booking_id:      string
  platform_id?:    string
  received_amount: number
  fee_pct?:        number
  fee_amt?:        number
  received_at?:    string
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'mark_commission_received', ...payload },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function updateBookingFinancial(bookingId: string, patch: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_booking_financial', booking_id: bookingId, patch },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}

export async function setHotelPlatform(hotelId: string, platformId: string | null): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'set_hotel_platform', hotel_id: hotelId, platform_id: platformId },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
}