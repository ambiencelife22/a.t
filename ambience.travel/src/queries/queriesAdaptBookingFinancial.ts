// queriesBookingFinancial.ts — thin adapters from each surface's raw booking row
// to the canonical BookingFinancial shape (B1 of the Financial/Operations
// consolidation). No computation, no drift: they normalize field NAMES only.
//
// FinancialTab's BookingRow calls its resolved hotel name `hotel_name`; every
// other surface (Ops, programme, confirmation) uses `_hotel_name`. The canonical
// type is `_hotel_name`; toBookingFinancialFromFinance remaps it. OperationsTab's
// OpsBooking is already canonical-shaped, so its adapter is a structural pass-through
// that only widens the type.
//
// Once B2 lands (one read EF returning BookingFinancial directly), both adapters
// and the two raw types disappear.

import type { BookingFinancial, BookingFinancialRoom } from '../types/typesBookingFinancial'

// The FinancialTab raw shape (from queriesAdminFinance / fetchEngagementFull).
// Mirrors the inline BookingRow in FinancialTab.tsx.
export type FinanceBookingRaw = {
  id: string; name?: string | null; hotel_name: string | null; booking_type: string | null
  start_date: string | null; end_date: string | null; nights: number | null; currency: string | null
  total_rate: number | null; total_rate_usd: number | null
  commissionable_rate: number | null; commissionable_rate_usd: number | null
  commission_pct: number | null; commission_amount: number | null; commission_amount_usd: number | null
  commission_paid_at: string | null
  net_revenue_usd: number
  taxes_and_fees: number | null; taxes_and_fees_usd: number | null
  referral_share_amt: number | null; iata_share_amt: number | null; individual_share_amt: number | null
  deposit_amount: number | null; deposit_due_date: string | null; deposit_paid_at: string | null
  balance_amount: number | null; balance_due_date: string | null; balance_paid_at: string | null
  payment_exception_override?: boolean | null
  invoice_number: string | null; rate_type: string | null; sort_order: number
  cost: number | null
  rooms: BookingFinancialRoom[]
}

// The OperationsTab raw shape is OpsBooking, already canonical-aligned.
// Imported structurally to avoid a hard dependency cycle; declared loose here.
export type OpsBookingRaw = Omit<BookingFinancial, 'rooms'> & { rooms?: BookingFinancialRoom[] }

export function toBookingFinancialFromFinance(b: FinanceBookingRaw): BookingFinancial {
  return {
    id:                     b.id,
    trip_id:                '',                 // finance surface is engagement-scoped; trip_id not read here
    engagement_id:          null,
    booking_type:           b.booking_type,
    name:                   b.name ?? null,
    status:                 null,
    confirmation_number:    null,
    start_date:             b.start_date,
    end_date:               b.end_date,
    nights:                 b.nights,
    currency:               b.currency,
    commissionable_rate:    b.commissionable_rate,
    total_rate:             b.total_rate,
    taxes_and_fees:         b.taxes_and_fees,
    rate_type:              b.rate_type,
    price:                  null,
    commissionable_rate_usd: b.commissionable_rate_usd,
    total_rate_usd:         b.total_rate_usd,
    taxes_and_fees_usd:     b.taxes_and_fees_usd,
    cost:                   b.cost,
    commission_pct:         b.commission_pct,
    commission_amount:      b.commission_amount,
    commission_amount_usd:  b.commission_amount_usd,
    commission_paid_at:     b.commission_paid_at,
    invoice_number:         b.invoice_number,
    net_revenue:            null,
    net_revenue_usd:        b.net_revenue_usd,
    deposit_amount:         b.deposit_amount,
    deposit_due_date:       b.deposit_due_date,
    deposit_paid_at:        b.deposit_paid_at,
    balance_amount:         b.balance_amount,
    balance_due_date:       b.balance_due_date,
    balance_paid_at:        b.balance_paid_at,
    payment_exception_override: b.payment_exception_override ?? null,
    // FinancialTab only carries share AMOUNTS, not ids/pcts. Ids/pcts null here.
    iata_partner_id:        null,
    iata_share_pct:         null,
    iata_share_amt:         b.iata_share_amt,
    referral_partner_id:    null,
    referral_share_pct:     null,
    referral_share_amt:     b.referral_share_amt,
    individual_id:          null,
    individual_share_pct:   null,
    individual_share_amt:   b.individual_share_amt,
    accom_hotel_id:         null,
    supplier_id:            null,
    supplier_name_override: null,
    cancellation_policy:    null,
    notes:                  null,
    sort_order:             b.sort_order,
    created_at:             null,
    rooms:                  b.rooms,
    _hotel_name:            b.hotel_name,       // the naming reconciliation
  }
}

export function toBookingFinancialFromOps(b: OpsBookingRaw): BookingFinancial {
  return { ...b, rooms: b.rooms ?? [] }
}