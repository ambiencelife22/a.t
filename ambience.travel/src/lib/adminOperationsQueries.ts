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

import { supabase } from './supabase'
import type { TripPartner } from './adminTripQueries'

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
  status:          string | null
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
  id:              string
  trip_code:       string
  status:          string | null
  start_date:      string | null
  end_date:        string | null
  duration_nights: number | null
  trip_type:       string | null
  destinations:    string[] | null
}

type BookingRow = Omit<OpsBooking, '_hotel_name' | '_trip_code' | '_house_name' | '_house_id'>

type HotelRow   = { id: string; name: string }
type PartnerRow = TripPartner
type EngRow     = { trip_id: string; person_id: string }
type PersonRow  = { id: string; house_id: string }
type HouseRow   = { id: string; display_name: string }

// ── Query ─────────────────────────────────────────────────────────────────────

export async function fetchOpsPortfolio(): Promise<OpsPortfolio> {
  // Step 1: all trips ordered by start_date desc
  const { data: tripData, error: tripErr } = await supabase
    .from('travel_trips')
    .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, destinations')
    .order('start_date', { ascending: false })

  if (tripErr) throw new Error(tripErr.message)
  const tripRows = (tripData ?? []) as TripRow[]
  if (tripRows.length === 0) {
    return { trips: [], partners: {}, summary: emptySummary() }
  }

  const tripIds = tripRows.map(t => t.id)

  // Step 2: all bookings for those trips
  const { data: bookData, error: bookErr } = await supabase
    .from('travel_bookings')
    .select('id, trip_id, engagement_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, currency, commissionable_rate, total_rate, taxes_and_fees, rate_type, price, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, cancellation_policy, notes, sort_order, created_at')
    .in('trip_id', tripIds)
    .order('sort_order', { ascending: true })

  if (bookErr) throw new Error(bookErr.message)
  const bookingRows = (bookData ?? []) as BookingRow[]

  // Step 3: hotel names
  const hotelIds = [...new Set(
    bookingRows.map(b => b.accom_hotel_id).filter((id): id is string => !!id)
  )]
  const hotelNameMap = new Map<string, string>()
  if (hotelIds.length > 0) {
    const { data: hotelData } = await supabase
      .from('travel_accom_hotels')
      .select('id, name')
      .in('id', hotelIds)
    for (const h of (hotelData ?? []) as HotelRow[]) hotelNameMap.set(h.id, h.name)
  }

  // Step 4: partners
  const { data: partnerData, error: partErr } = await supabase
    .from('travel_partners')
    .select('id, name, partner_type, default_share_pct, currency, is_active')
  if (partErr) throw new Error(partErr.message)
  const partnerMap: Record<string, TripPartner> = {}
  for (const p of (partnerData ?? []) as PartnerRow[]) partnerMap[p.id] = p

  // Step 5: resolve house names via engagements -> people -> houses
  const { data: engData } = await supabase
    .from('travel_immerse_engagements')
    .select('trip_id, person_id')
    .in('trip_id', tripIds)
    .not('person_id', 'is', null)

  const engRows = (engData ?? []) as EngRow[]

  // trip_id -> person_id (first engagement per trip)
  const tripPersonMap = new Map<string, string>()
  for (const e of engRows) {
    if (!tripPersonMap.has(e.trip_id)) tripPersonMap.set(e.trip_id, e.person_id)
  }

  const personIds = [...new Set(tripPersonMap.values())]
  const personHouseMap = new Map<string, string>() // person_id -> house_id

  if (personIds.length > 0) {
    const { data: personData } = await supabase
      .from('a_house_people')
      .select('id, house_id')
      .in('id', personIds)
    for (const p of (personData ?? []) as PersonRow[]) personHouseMap.set(p.id, p.house_id)
  }

  const houseIds = [...new Set(personHouseMap.values())]
  const houseNameMap = new Map<string, string>()  // house_id -> display_name
  const houseIdMap   = new Map<string, string>()  // house_id -> id (same, for reference)

  if (houseIds.length > 0) {
    const { data: houseData } = await supabase
      .from('a_houses')
      .select('id, display_name')
      .in('id', houseIds)
    for (const h of (houseData ?? []) as HouseRow[]) {
      houseNameMap.set(h.id, h.display_name)
      houseIdMap.set(h.id, h.id)
    }
  }

  // trip_id -> { house_name, house_id }
  const tripHouseMap = new Map<string, { name: string; id: string }>()
  for (const [tripId, personId] of tripPersonMap.entries()) {
    const houseId = personHouseMap.get(personId)
    if (houseId) {
      tripHouseMap.set(tripId, {
        name: houseNameMap.get(houseId) ?? 'Unknown',
        id:   houseId,
      })
    }
  }

  // Step 6: assemble
  const bookingsByTrip = new Map<string, OpsBooking[]>()
  for (const b of bookingRows) {
    if (!bookingsByTrip.has(b.trip_id)) bookingsByTrip.set(b.trip_id, [])
    const house = tripHouseMap.get(b.trip_id)
    bookingsByTrip.get(b.trip_id)!.push({
      ...b,
      _hotel_name: b.accom_hotel_id ? (hotelNameMap.get(b.accom_hotel_id) ?? null) : null,
      _trip_code:  null, // set below
      _house_name: house?.name ?? null,
      _house_id:   house?.id ?? null,
    })
  }

  const trips: OpsTrip[] = tripRows.map(t => {
    const house    = tripHouseMap.get(t.id)
    const bookings = (bookingsByTrip.get(t.id) ?? []).map(b => ({ ...b, _trip_code: t.trip_code }))
    return {
      id:              t.id,
      trip_code:       t.trip_code,
      status:          t.status,
      start_date:      t.start_date,
      end_date:        t.end_date,
      duration_nights: t.duration_nights,
      trip_type:       t.trip_type,
      destinations:    t.destinations,
      bookings,
      _house_name:     house?.name ?? null,
      _house_id:       house?.id ?? null,
    }
  })

  const summary = computeSummary(trips)

  return { trips, partners: partnerMap, summary }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

function emptySummary(): OpsSummary {
  return {
    total_bookings:       0,
    confirmed_bookings:   0,
    total_commission:     0,
    commission_paid:      0,
    commission_unpaid:    0,
    deposits_outstanding: 0,
    balances_outstanding: 0,
    total_gross:          0,
  }
}

function computeSummary(trips: OpsTrip[]): OpsSummary {
  const s = emptySummary()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const trip of trips) {
    for (const b of trip.bookings) {
      s.total_bookings++
      if (b.status === 'Confirmed') s.confirmed_bookings++

      const commission = b.commission_amount ?? 0
      s.total_commission += commission
      if (b.commission_paid_at) {
        s.commission_paid += commission
      }
      if (!b.commission_paid_at) {
        s.commission_unpaid += commission
      }

      const nights = b.nights ?? 1
      const rate   = b.commissionable_rate ?? b.price ?? 0
      s.total_gross += rate * nights

      if (b.deposit_amount && !b.deposit_paid_at) {
        s.deposits_outstanding += b.deposit_amount
      }
      if (b.balance_amount && !b.balance_paid_at) {
        s.balances_outstanding += b.balance_amount
      }
    }
  }

  return s
}