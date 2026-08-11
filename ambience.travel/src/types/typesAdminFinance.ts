// typesAdminFinance.ts - Types for the admin Financial Module.
//
// Moved out of queriesAdminFinance.ts per naming convention (types live in
// types{Domain}.ts, not the query file). The EF (travel-read-expenses) camelizes
// its output; these are the camelCase wire shapes the frontend consumes.
//
// NOTE: some fields below are still snake_case (receipt_ref, team_member_id,
// paid_at, etc.) - a residual "no snake on frontend" debt to sweep separately,
// since renaming them ripples to every consumer. Structure move first; field
// rename is its own slice.

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
  commissionableValue:    number
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