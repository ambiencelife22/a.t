// queriesBookingFinancial.ts — adapters from each surface's raw EF row to the
// canonical BookingFinancial shape (B1/B2 of the Financial/Operations
// consolidation). No computation — field normalisation only.
//
// The only real work these do: remap hotel_name → _hotel_name (FinancialTab's
// BookingRow named it hotel_name; every other surface uses _hotel_name; the
// canonical type is _hotel_name). Everything else is a structural pass-through.
//
// Once B4 lands (one merged surface reading travel-read-expenses directly),
// both adapters and the two raw types are deleted — consumers read
// BookingFinancial from the EF response without adaptation.

import type { BookingFinancial, BookingFinancialRoom } from '../types/typesBookingFinancial'

// ── FinancialTab raw shape ────────────────────────────────────────────────────
// Mirrors the inline BookingRow in FinancialTab.tsx + enrichedBookings shape
// returned by travel-read-expenses by_engagement_full (post B2: full column set).
export type FinanceBookingRaw = {
  id:                      string
  trip_id:                 string | null
  engagement_id:           string | null
  name:                    string | null
  booking_type:            string | null
  status:                  string | null
  confirmation_number:     string | null
  accom_hotel_id:          string | null
  supplier_id:             string | null
  supplier_name_override:  string | null
  start_date:              string | null
  end_date:                string | null
  nights:                  number | null
  currency:                string | null
  price:                   number | null
  cost:                    number | null
  total_rate:              number | null
  total_rate_usd:          number | null
  commissionable_rate:     number | null
  commissionable_rate_usd: number | null
  commission_pct:          number | null
  commission_amount:       number | null
  commission_amount_usd:   number | null
  commission_paid_at:      string | null
  net_revenue:             number | null
  net_revenue_usd:         number             // computed by enrichment
  taxes_and_fees:          number | null
  taxes_and_fees_usd:      number | null
  referral_partner_id:     string | null
  referral_share_pct:      number | null
  referral_share_amt:      number | null
  iata_partner_id:         string | null
  iata_share_pct:          number | null
  iata_share_amt:          number | null
  individual_id:           string | null
  individual_share_pct:    number | null
  individual_share_amt:    number | null
  deposit_amount:          number | null
  deposit_due_date:        string | null
  deposit_paid_at:         string | null
  balance_amount:          number | null
  balance_due_date:        string | null
  balance_paid_at:         string | null
  payment_exception_override: boolean | null
  invoice_number:          string | null
  rate_type:               string | null
  sort_order:              number
  cancellation_policy:     string | null
  notes:                   string | null
  // Enriched by EF (post B2)
  _hotel_name:             string | null
  rooms:                   BookingFinancialRoom[]
}

// ── OpsBooking is already canonical-aligned ───────────────────────────────────
// Its adapter is a structural pass-through + rooms default.
export type OpsBookingRaw = Omit<BookingFinancial, 'rooms'> & {
  rooms?: BookingFinancialRoom[]
}

// ── Adapters ──────────────────────────────────────────────────────────────────

export function toBookingFinancialFromFinance(b: FinanceBookingRaw): BookingFinancial {
  return {
    id:                      b.id,
    trip_id:                 b.trip_id ?? '',
    engagement_id:           b.engagement_id,
    booking_type:            b.booking_type,
    name:                    b.name,
    status:                  b.status,
    confirmation_number:     b.confirmation_number,
    start_date:              b.start_date,
    end_date:                b.end_date,
    nights:                  b.nights,
    currency:                b.currency,
    price:                   b.price,
    cost:                    b.cost,
    total_rate:              b.total_rate,
    total_rate_usd:          b.total_rate_usd,
    commissionable_rate:     b.commissionable_rate,
    commissionable_rate_usd: b.commissionable_rate_usd,
    commission_pct:          b.commission_pct,
    commission_amount:       b.commission_amount,
    commission_amount_usd:   b.commission_amount_usd,
    commission_paid_at:      b.commission_paid_at,
    net_revenue:             b.net_revenue,
    net_revenue_usd:         b.net_revenue_usd,
    taxes_and_fees:          b.taxes_and_fees,
    taxes_and_fees_usd:      b.taxes_and_fees_usd,
    referral_partner_id:     b.referral_partner_id,
    referral_share_pct:      b.referral_share_pct,
    referral_share_amt:      b.referral_share_amt,
    iata_partner_id:         b.iata_partner_id,
    iata_share_pct:          b.iata_share_pct,
    iata_share_amt:          b.iata_share_amt,
    individual_id:           b.individual_id,
    individual_share_pct:    b.individual_share_pct,
    individual_share_amt:    b.individual_share_amt,
    deposit_amount:          b.deposit_amount,
    deposit_due_date:        b.deposit_due_date,
    deposit_paid_at:         b.deposit_paid_at,
    balance_amount:          b.balance_amount,
    balance_due_date:        b.balance_due_date,
    balance_paid_at:         b.balance_paid_at,
    payment_exception_override: b.payment_exception_override,
    invoice_number:          b.invoice_number,
    rate_type:               b.rate_type,
    sort_order:              b.sort_order,
    accom_hotel_id:          b.accom_hotel_id,
    supplier_id:             b.supplier_id,
    supplier_name_override:  b.supplier_name_override,
    cancellation_policy:     b.cancellation_policy,
    notes:                   b.notes,
    created_at:              null,
    rooms:                   b.rooms,
    _hotel_name:             b._hotel_name,   // EF now emits _hotel_name directly (B2)
  }
}

export function toBookingFinancialFromOps(b: OpsBookingRaw): BookingFinancial {
  return { ...b, rooms: b.rooms ?? [] }
}