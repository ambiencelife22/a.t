// typesBookingFinancial.ts - canonical booking-financial shape for the admin
// Financial/Operations surfaces.
//
// B1 of the Financial/Operations consolidation (see the S53I "One Source,
// Consumed Everywhere" plan, Collapse B). Today two near-identical types describe
// the same booking's financial truth from two surfaces:
//   - BookingRow  (dissolved S53I - fields absorbed into this canonical type)
//   - OpsBooking  (dissolved S53I - fields absorbed into this canonical type)
//                                                 house/trip resolution + the
//                                                 paymentExceptionOverride flag
// This is the parallel-ship disease at the type level. This file is the single
// canonical shape both surfaces re-type onto. It is the SUPERSET: every field
// either surface reads. Surface-specific *_usd derivations and _resolved fields
// are optional so a producer that does not compute them is honestly typed
// (absent, not fabricated) - same discipline as ImmerseEngagementBooking.payment_exception.
//
// Once B2 (one read EF) + B4 (one surface) land, BookingRow and OpsBooking are
// deleted and every consumer reads BookingFinancial directly.

// ── Nested: per-room financial source row ─────────────────────────────────────
// travel_booking_rooms is the single source of truth for booking totals (the
// tg_recompute_booking_totals trigger derives the header from these). Kept here
// so the unified OutlookTab surface can show the full room breakdown.
export type BookingFinancialRoom = {
  id:                  string
  bookingId:          string
  roomName:           string | null
  confirmationNumber: string | null
  guestName:          string | null
  nights:              number | null
  rate:                number | null
  taxPct:             number | null
  total:               number | null
  checkInTime:       string | null
  beddingType:        string | null
  sortOrder:          number
}

// ── The canonical booking-financial shape ─────────────────────────────────────
export type BookingFinancial = {
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                     string
  journeyId:                string
  engagementId:          string | null
  name:                   string | null
  status:                 string | null
  confirmationNumber:    string | null

  // ── Dates ─────────────────────────────────────────────────────────────────
  startDate:             string | null
  endDate:               string | null
  nights:                 number | null

  // ── Rate ──────────────────────────────────────────────────────────────────
  currency:               string | null
  commissionableRate:    number | null
  totalRate:             number | null
  taxesAndFees:         number | null
  boardBasis:            { displayName: string } | null
  paymentTerms:          { displayName: string } | null
  pricingBasis:          { displayName: string } | null
  rateLabel:             { displayName: string; clientVisible: boolean } | null
  price:                  number | null
  // USD-normalised derivations (OutlookTab reads these; computed by travel-read-expenses)
  // not). Optional: absent means "not computed by this producer", never zero.
  commissionableRateUsd?: number | null
  totalRateUsd?:          number | null
  taxesAndFeesUsd?:      number | null

  // ── Amenities (absorbed cost - operator pays, never client-facing) ─────────
  cost:                   number | null

  // ── Commission ────────────────────────────────────────────────────────────
  commissionPct:         number | null
  commissionAmount:      number | null
  commissionAmountUsd?: number | null
  commissionPaidAt:     string | null
  invoiceNumber:         string | null
  // Receipt detail - recorded by mark_commission_received, selected by
  // BOOKING_FINANCIAL_SELECT. Present after a receipt is captured.
  commissionReceivedAmount?:     number | null
  commissionPaymentFeePct?:     number | null
  commissionPaymentFeeAmt?:     number | null
  commissionNetReceived?:          number | null
  commissionPaymentPlatformId?:   string | null
  commissionTransactionRef?:       string | null
  commissionRemittingPartnerId?:  string | null
  // Resolved joins
  travelPaymentPlatforms?: { slug: string; label: string; defaultFeePct: number } | null
  travelPartners?:          { id: string; name: string; partnerType: string } | null

  // ── Net revenue (rate-type-aware; _shared/expenses.ts computeNetRevenue) ───
  netRevenue:            number | null
  netRevenueUsd?:       number | null

  // ── Payment: deposit / balance ────────────────────────────────────────────
  depositAmount:         number | null
  depositDueDate:       string | null
  depositPaidAt:        string | null
  balanceAmount:         number | null
  balanceDueDate:       string | null
  balancePaidAt:        string | null
  // Guest payment signal - admin force-flag for the "Payment Outstanding" line.
  // null = defer to date logic (overdue balance); true = force. Never false.
  paymentExceptionOverride: boolean | null

  // ── Partner splits ────────────────────────────────────────────────────────
  iataPartnerId:        string | null
  iataSharePct:         number | null
  iataShareAmt:         number | null
  referralPartnerId:    string | null
  referralSharePct:     number | null
  referralShareAmt:     number | null
  individualId:          string | null
  individualSharePct:   number | null
  individualShareAmt:   number | null

  // ── Supplier ──────────────────────────────────────────────────────────────
  accomHotelId:         string | null
  supplierId:            string | null
  supplierNameOverride: string | null

  // ── Policy ────────────────────────────────────────────────────────────────
  cancellationPolicy:    string | null
  notes:                  string | null
  sortOrder:             number | null
  createdAt:             string | null

  // ── Rooms (per-room financial source; OutlookTab nests these) ────────────
  rooms:                  BookingFinancialRoom[]

  // ── Resolved / display (client-side joins; optional per producer) ─────────
  // Canonical name is _hotel_name (the resolved-field convention used across
  // programme, confirmation, and OutlookTab). _hotel_name
  // is the odd one out and its adapter maps hotelName -> _hotel_name. Reconciling
  // that naming divergence is part of this consolidation, not a bandaid around it.
  _hotel_name?:           string | null
  _journey_code?:            string | null
  _house_name?:           string | null
  _house_id?:             string | null
}