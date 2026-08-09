// queriesAdminFinance.ts - Admin queries for the Financial Module v1.
//
// All reads + writes go through travel-read-expenses and travel-write-expenses
// EFs via supabase.functions.invoke. Zero direct supabase.from() calls.
//
// Last updated: S53G v2 - EngagementFull type + fetchEngagementFull added.

import { supabase } from '../lib/supabase'
import { snakeizeKeys } from '@shared/camelize'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillingStatus = 'absorbed' | 'billable' | 'billed' | 'paid' | 'written_off'

export type ExpenseItem = {
  id:            string
  expenseId:    string
  itemType:     string
  description:   string
  amount:        number
  receipt_ref:   string | null
  deductibility: string | null
  recipient_id:  string | null
  paid_by:       string | null
  paid_at:       string | null
  sortOrder:    number
}

export type Expense = {
  id:             string
  engagementId:  string | null
  bookingId:     string | null
  destinationId: string | null
  team_member_id: string | null
  expenseType:   string
  description:    string
  totalAmount:   number
  totalAmountUsd: number | null
  currency:       string
  billingStatus: BillingStatus
  paid_at:        string | null
  billedAt:      string | null
  reimbursed_at:  string | null
  linkedAt:      string | null
  notes:          string | null
  created_by:     string | null
  createdAt:     string
  updatedAt:     string
  items:          ExpenseItem[]
}

export type EngagementSummaryFull = {
  totalCommission:          number
  netCommissionExpected:   number
  commissionReceived:       number
  commissionOutstanding:    number
  totalRate:              number
  totalAmenities:         number
  totalNetRevenue:       number
  totalReferral:          number
  totalIata:              number
  totalIndividual:        number
  depositOutstanding:     number
  balanceOutstanding:     number
  totalAbsorbed:          number
  totalBillable:          number
  totalOutstanding:       number
  totalPaid:              number
  netMargin:              number
}

export type EngagementFull = {
  engagement: {
    id:      string
    title:   string | null
    urlId:  string
    travelJourney: { journeyCode: string | null; startDate: string | null; endDate: string | null } | null
  }
  bookings: Record<string, unknown>[]
  expenses: Expense[]
  summary:  EngagementSummaryFull
}

export type PipelineTrip = {
  engagementId:           string
  urlId:                  string
  title:                   string | null
  statusSlug:             string | null
  journeyCode:               string | null
  startDate:              string | null
  endDate:                string | null
  primaryClientId:       string | null
  totalCommission:          number
  netCommissionExpected:   number
  commissionReceived:       number
  commissionOutstanding:    number
  totalRate:              number | null
  totalAmenities:         number
  totalAbsorbed:          number
  totalBillable:          number
  totalOutstanding:       number
  netMargin:              number
  totalCommissionNative: number
  currency:                string
}

export type CreateExpensePayload = {
  expenseType:    string
  description:     string
  totalAmount:    number
  totalAmountUsd?: number | null
  engagementId?:  string | null
  bookingId?:     string | null
  destinationId?: string | null
  teamMemberId?: string | null
  currency?:       string
  billingStatus?: BillingStatus
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
    body: { mode: 'create_expense', ...snakeizeKeys<Record<string, unknown>>(payload) },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.message ?? data.error)
  return data.expense as Expense
}

export async function updateExpense(id: string, patch: Partial<CreateExpensePayload>): Promise<Expense> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode: 'update_expense', id, patch: snakeizeKeys<Record<string, unknown>>(patch) },
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
  id:               string
  slug:             string
  label:            string
  defaultFeePct:  number
  defaultFeeFlat: number | null
  sortOrder:       number
  isActive:        boolean
}

export type RateType = {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
  isActive:  boolean
}

const SUPPLIERS_EF = 'travel-read-suppliers'

export async function fetchPaymentPlatforms(): Promise<PaymentPlatform[]> {
  const { data, error } = await supabase.functions.invoke(SUPPLIERS_EF, {
    body: { mode: 'payment_platforms' },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.platforms as PaymentPlatform[]
}

export async function fetchRateTypes(): Promise<RateType[]> {
  const { data, error } = await supabase.functions.invoke(SUPPLIERS_EF, {
    body: { mode: 'rate_types' },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.rateTypes as RateType[]
}

export async function markCommissionReceived(payload: {
  bookingId:          string
  platformId?:        string
  receivedAmount:     number
  feePct?:            number
  feeAmt?:            number
  receivedAt?:        string
  transactionRef?:    string
  remittingPartnerId?: string
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: {
      mode:                 'mark_commission_received',
      booking_id:           payload.bookingId,
      platform_id:          payload.platformId,
      received_amount:      payload.receivedAmount,
      fee_pct:              payload.feePct,
      fee_amt:              payload.feeAmt,
      received_at:          payload.receivedAt,
      transaction_ref:      payload.transactionRef,
      remitting_partner_id: payload.remittingPartnerId,
    },
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

export type SupplierPartner = {
  id:                string
  name:              string
  partner_type:      string
  defaultSharePct: number | null
  currency:          string | null
  isActive:         boolean
}

export async function fetchPartners(): Promise<SupplierPartner[]> {
  const { data, error } = await supabase.functions.invoke(SUPPLIERS_EF, {
    body: { mode: 'partners' },
  })
  if (error) throw new Error(await extractError(error))
  if (data?.error) throw new Error(data.error)
  return data.partners as SupplierPartner[]
}