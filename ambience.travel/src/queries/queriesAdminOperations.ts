// adminOperationsQueries.ts
// Cross-client query layer for the Operations Console.
// Reads all trips, bookings, partners, hotels — no house_id filter.
//
// Join chain for house name resolution:
//   travel_bookings.trip_id -> travel_trips.id
//   travel_trips.id -> travel_immerse_engagements.trip_id
//   travel_immerse_engagements.person_id -> a_house_people.id
//   a_house_people.house_id -> a_houses.id
//
// House name resolved client-side from a lookup map to avoid complex joins.
// Partners resolved client-side from partner map (same pattern as adminTripQueries).
//
// All column names verified against information_schema S44 pre-flight.
//
// Prior: S44 — initial ship.

import { supabase } from '../lib/supabase'
import type { TripPartner } from '../queries/queriesAdminTrip'
import { computeEngagementStage, type EngagementStage } from '../types/typesImmerse'

async function invokeRead<T>(mode: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-ops-admin', {
    body: { mode, ...params },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpsBooking = {
  // Identity
  id:                     string
  trip_id:                string
  engagement_id:          string | null
  booking_type:           string | null
  name:                   string | null
  status:                 string | null
  confirmation_number:    string | null
  // Dates
  start_date:             string | null
  end_date:               string | null
  nights:                 number | null
  // Financials
  currency:               string | null
  commissionable_rate:    number | null
  total_rate:             number | null
  taxes_and_fees:         number | null
  rate_type:              string | null
  price:                  number | null
  // Commission
  commission_pct:         number | null
  commission_amount:      number | null
  net_revenue:            number | null
  commission_paid_at:     string | null
  invoice_number:         string | null
  // Payment
  deposit_amount:         number | null
  deposit_due_date:       string | null
  deposit_paid_at:        string | null
  balance_amount:         number | null
  balance_due_date:       string | null
  balance_paid_at:        string | null
  // Partners
  iata_partner_id:        string | null
  iata_share_pct:         number | null
  iata_share_amt:         number | null
  referral_partner_id:    string | null
  referral_share_pct:     number | null
  referral_share_amt:     number | null
  individual_id:          string | null
  individual_share_pct:   number | null
  individual_share_amt:   number | null
  // Supplier
  accom_hotel_id:         string | null
  supplier_id:            string | null
  supplier_name_override: string | null
  // Policy
  cancellation_policy:    string | null
  notes:                  string | null
  sort_order:             number | null
  created_at:             string | null
  // Client-resolved
  _hotel_name:            string | null
  _trip_code:             string | null
  _house_name:            string | null
  _house_id:              string | null
}

export type OpsTrip = {
  id:              string
  trip_code:       string
  stage:           EngagementStage | null   // S53G+ derived from winning engagement
  start_date:      string | null
  end_date:        string | null
  duration_nights: number | null
  trip_type:       string | null
  destinations:    string[] | null
  bookings:        OpsBooking[]
  // Client-resolved
  _house_name:     string | null
  _house_id:       string | null
}

export type OpsPortfolio = {
  trips:    OpsTrip[]
  partners: Record<string, TripPartner>
  // Aggregates
  summary:  OpsSummary
}

export type OpsSummary = {
  total_bookings:       number
  confirmed_bookings:   number
  total_commission:     number
  commission_paid:      number
  commission_unpaid:    number
  deposits_outstanding: number
  balances_outstanding: number
  total_gross:          number
}

// ── Raw row shapes ─────────────────────────────────────────────────────────────

type TripRow = {
  id:                      string
  trip_code:               string
  confirmed_engagement_id: string | null
  start_date:              string | null
  end_date:                string | null
  duration_nights:         number | null
  trip_type:               string | null
  destinations:            string[] | null
}

type BookingRow = Omit<OpsBooking, '_hotel_name' | '_trip_code' | '_house_name' | '_house_id'>

type HotelRow   = { id: string; name: string }
type PartnerRow = TripPartner
type EngRow     = { trip_id: string; person_id: string }
type PersonRow  = { id: string; house_id: string }
type HouseRow   = { id: string; display_name: string }

// ── Query ─────────────────────────────────────────────────────────────────────

export async function fetchOpsPortfolio(): Promise<OpsPortfolio> {
  return invokeRead<OpsPortfolio>('portfolio')
}

// ── Legacy direct-query implementation (retired S53G — moved to travel-read-ops-admin EF) ──
async function _fetchOpsPortfolioLegacy(): Promise<OpsPortfolio> {
  return invokeRead<OpsPortfolio>('portfolio')
}