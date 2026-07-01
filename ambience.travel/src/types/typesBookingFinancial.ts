// typesBookingFinancial.ts — canonical booking-financial shape for the admin
// Financial/Operations surfaces.
//
// B1 of the Financial/Operations consolidation (see the S53I "One Source,
// Consumed Everywhere" plan, Collapse B). Today two near-identical types describe
// the same booking's financial truth from two surfaces:
//   - BookingRow  (inline in FinancialTab.tsx) — adds *_usd derived fields + rooms
//   - OpsBooking  (queriesAdminOperations.ts)  — adds partner splits + amenities +
//                                                 house/trip resolution + the
//                                                 payment_exception_override flag
// This is the parallel-ship disease at the type level. This file is the single
// canonical shape both surfaces re-type onto. It is the SUPERSET: every field
// either surface reads. Surface-specific *_usd derivations and _resolved fields
// are optional so a producer that does not compute them is honestly typed
// (absent, not fabricated) — same discipline as ImmerseTripBooking.payment_exception.
//
// Once B2 (one read EF) + B4 (one surface) land, BookingRow and OpsBooking are
// deleted and every consumer reads BookingFinancial directly.

// ── Nested: per-room financial source row ─────────────────────────────────────
// travel_booking_rooms is the single source of truth for booking totals (the
// tg_recompute_booking_totals trigger derives the header from these). Kept here
// so the unified surface can show the room breakdown FinancialTab already does.
export type BookingFinancialRoom = {
  id:                  string
  booking_id:          string
  room_name:           string | null
  confirmation_number: string | null
  guest_name:          string | null
  nights:              number | null
  rate:                number | null
  tax_pct:             number | null
  total:               number | null
  check_in_time:       string | null
  sort_order:          number
}

// ── The canonical booking-financial shape ─────────────────────────────────────
export type BookingFinancial = {
  // ── Identity ──────────────────────────────────────────────────────────────
  id:                     string
  trip_id:                string
  engagement_id:          string | null
  booking_type:           string | null
  name:                   string | null
  status:                 string | null
  confirmation_number:    string | null

  // ── Dates ─────────────────────────────────────────────────────────────────
  start_date:             string | null
  end_date:               string | null
  nights:                 number | null

  // ── Rate ──────────────────────────────────────────────────────────────────
  currency:               string | null
  commissionable_rate:    number | null
  total_rate:             number | null
  taxes_and_fees:         number | null
  rate_type:              string | null
  price:                  number | null
  // USD-normalised derivations (FinancialTab computes these; OperationsTab does
  // not). Optional: absent means "not computed by this producer", never zero.
  commissionable_rate_usd?: number | null
  total_rate_usd?:          number | null
  taxes_and_fees_usd?:      number | null

  // ── Amenities (absorbed cost — operator pays, never client-facing) ─────────
  cost:                   number | null

  // ── Commission ────────────────────────────────────────────────────────────
  commission_pct:         number | null
  commission_amount:      number | null
  commission_amount_usd?: number | null
  commission_paid_at:     string | null
  invoice_number:         string | null

  // ── Net revenue (rate-type-aware; _shared/expenses.ts computeNetRevenue) ───
  net_revenue:            number | null
  net_revenue_usd?:       number | null

  // ── Payment: deposit / balance ────────────────────────────────────────────
  deposit_amount:         number | null
  deposit_due_date:       string | null
  deposit_paid_at:        string | null
  balance_amount:         number | null
  balance_due_date:       string | null
  balance_paid_at:        string | null
  // Guest payment signal — admin force-flag for the "Payment Outstanding" line.
  // null = defer to date logic (overdue balance); true = force. Never false.
  payment_exception_override: boolean | null

  // ── Partner splits ────────────────────────────────────────────────────────
  iata_partner_id:        string | null
  iata_share_pct:         number | null
  iata_share_amt:         number | null
  referral_partner_id:    string | null
  referral_share_pct:     number | null
  referral_share_amt:     number | null
  individual_id:          string | null
  individual_share_pct:   number | null
  individual_share_amt:   number | null

  // ── Supplier ──────────────────────────────────────────────────────────────
  accom_hotel_id:         string | null
  supplier_id:            string | null
  supplier_name_override: string | null

  // ── Policy ────────────────────────────────────────────────────────────────
  cancellation_policy:    string | null
  notes:                  string | null
  sort_order:             number | null
  created_at:             string | null

  // ── Rooms (per-room financial source; FinancialTab nests these) ───────────
  rooms:                  BookingFinancialRoom[]

  // ── Resolved / display (client-side joins; optional per producer) ─────────
  // Canonical name is _hotel_name (the resolved-field convention used across
  // programme, confirmation, and OpsBooking). FinancialTab's BookingRow.hotel_name
  // is the odd one out and its adapter maps hotel_name -> _hotel_name. Reconciling
  // that naming divergence is part of this consolidation, not a bandaid around it.
  _hotel_name?:           string | null
  _trip_code?:            string | null
  _house_name?:           string | null
  _house_id?:             string | null
}