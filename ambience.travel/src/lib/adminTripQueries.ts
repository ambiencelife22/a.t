// adminTripQueries.ts
// Trip Dossier query layer — reads travel_bookings, travel_trips,
// travel_partners, travel_accom_hotels for the HouseTab Trip Dossier surface.
//
// All column names verified against information_schema S44/S45 pre-flight.
//
// Join path (S45 fix): travel_bookings.house_id -> a_houses (direct FK).
// Prior S44 path via travel_immerse_engagements.house_id was broken —
// that column does not exist on travel_immerse_engagements.
//
// Partner names resolved client-side from partner map to avoid extra joins.
// House profile pulled in parallel with partners for dossier pre-population.
//
// Last updated: S45 — fix Step 1 join (bookings.house_id, not engagements);
//   add new booking columns to TripBooking type + select string;
//   add HouseProfile type + fetchTripDossierForHouse house fetch;
//   add house to TripDossierData for dossier pre-population.

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TripPartner = {
  id:                string
  name:              string
  partner_type:      string
  default_share_pct: number | null
  currency:          string | null
  is_active:         boolean
}

export type HouseProfile = {
  id:                  string
  display_name:        string
  salutation_rule:     string | null
  travel_style_notes:  string | null
  avoid_notes:         string | null
  service_notes:       string | null
}

export type TripBooking = {
  // Core identity
  id:                     string
  trip_id:                string
  house_id:               string | null
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
  commissionable_rate:    number | null
  total_rate:             number | null
  taxes_and_fees:         number | null
  currency:               string | null
  rate_type:              string | null
  inclusions:             string | null
  price:                  number | null
  // Payment
  deposit_amount:         number | null
  deposit_due_date:       string | null
  deposit_paid_at:        string | null
  balance_amount:         number | null
  balance_due_date:       string | null
  balance_paid_at:        string | null
  // Commission
  commission_pct:         number | null
  commission_amount:      number | null
  net_revenue:            number | null
  commission_paid_at:     string | null
  invoice_number:         string | null
  // Partners (IDs — resolve display via partner map)
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
  // Dossier fields (S45)
  party_composition:      string | null
  primary_contact_name:   string | null
  primary_contact_role:   string | null
  supplier_contact_name:  string | null
  supplier_contact_whatsapp: string | null
  // Policy
  cancellation_policy:    string | null
  booking_policy:         string | null
  notes:                  string | null
  sort_order:             number | null
  created_at:             string | null
  updated_at:             string | null
  // Client-resolved hotel name
  _hotel_name:            string | null
}

export type DossierTrip = {
  id:                   string
  trip_code:            string
  status:               string | null
  start_date:           string | null
  end_date:             string | null
  duration_nights:      number | null
  trip_type:            string | null
  destinations:         string[] | null
  guest_count_adults:   number | null
  guest_count_children: number | null
  bookings:             TripBooking[]
}

export type TripDossierData = {
  trips:    DossierTrip[]
  partners: Record<string, TripPartner>
  house:    HouseProfile | null
}

// ── Raw row shapes ────────────────────────────────────────────────────────────

type BookingTripRow = { trip_id: string }
type TripRow        = { id: string; trip_code: string; status: string | null; start_date: string | null; end_date: string | null; duration_nights: number | null; trip_type: string | null; destinations: string[] | null; guest_count_adults: number | null; guest_count_children: number | null }
type BookingRow     = Omit<TripBooking, '_hotel_name'>
type HotelRow       = { id: string; name: string }
type PartnerRow     = TripPartner
type HouseRow       = HouseProfile

// ── Query ─────────────────────────────────────────────────────────────────────

export async function fetchTripDossierForHouse(houseId: string): Promise<TripDossierData> {
  // Step 1: bookings.house_id -> trip IDs
  // (travel_immerse_engagements has no house_id — confirmed S45)
  const { data: bookTripData, error: bookTripErr } = await supabase
    .from('travel_bookings')
    .select('trip_id')
    .eq('house_id', houseId)
    .not('trip_id', 'is', null)

  if (bookTripErr) throw new Error(bookTripErr.message)
  const bookTripRows = (bookTripData ?? []) as BookingTripRow[]
  if (bookTripRows.length === 0) return { trips: [], partners: {}, house: null }

  const tripIds = [...new Set(bookTripRows.map(r => r.trip_id))]

  // Step 2: trips
  const { data: tripData, error: tripErr } = await supabase
    .from('travel_trips')
    .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, destinations, guest_count_adults, guest_count_children')
    .in('id', tripIds)
    .order('start_date', { ascending: false })

  if (tripErr) throw new Error(tripErr.message)
  const tripRows = (tripData ?? []) as TripRow[]
  if (tripRows.length === 0) return { trips: [], partners: {}, house: null }

  // Step 3: bookings (all for this house — house_id filter avoids cross-house bleed)
  const { data: bookData, error: bookErr } = await supabase
    .from('travel_bookings')
    .select('id, trip_id, house_id, engagement_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, total_rate, taxes_and_fees, currency, rate_type, inclusions, price, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, party_composition, primary_contact_name, primary_contact_role, supplier_contact_name, supplier_contact_whatsapp, cancellation_policy, booking_policy, notes, sort_order, created_at, updated_at')
    .eq('house_id', houseId)
    .order('sort_order', { ascending: true })

  if (bookErr) throw new Error(bookErr.message)
  const bookingRows = (bookData ?? []) as BookingRow[]

  // Step 4: hotel names
  const hotelIds = [...new Set(bookingRows.map(b => b.accom_hotel_id).filter((id): id is string => !!id))]
  const hotelNameMap = new Map<string, string>()
  if (hotelIds.length > 0) {
    const { data: hotelData } = await supabase
      .from('travel_accom_hotels')
      .select('id, name')
      .in('id', hotelIds)
    for (const h of (hotelData ?? []) as HotelRow[]) hotelNameMap.set(h.id, h.name)
  }

  // Step 5: partners + house profile (parallel)
  const [partnerResult, houseResult] = await Promise.all([
    supabase
      .from('travel_partners')
      .select('id, name, partner_type, default_share_pct, currency, is_active'),
    supabase
      .from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),
  ])

  if (partnerResult.error) throw new Error(partnerResult.error.message)
  const partnerMap: Record<string, TripPartner> = {}
  for (const p of (partnerResult.data ?? []) as PartnerRow[]) partnerMap[p.id] = p

  const house = houseResult.data ? (houseResult.data as HouseRow) : null

  // Step 6: assemble
  const bookingsByTrip = new Map<string, TripBooking[]>()
  for (const b of bookingRows) {
    if (!bookingsByTrip.has(b.trip_id)) bookingsByTrip.set(b.trip_id, [])
    bookingsByTrip.get(b.trip_id)!.push({
      ...b,
      _hotel_name: b.accom_hotel_id ? (hotelNameMap.get(b.accom_hotel_id) ?? null) : null,
    })
  }

  const trips: DossierTrip[] = tripRows.map(t => ({
    id:                   t.id,
    trip_code:            t.trip_code,
    status:               t.status,
    start_date:           t.start_date,
    end_date:             t.end_date,
    duration_nights:      t.duration_nights,
    trip_type:            t.trip_type,
    destinations:         t.destinations,
    guest_count_adults:   t.guest_count_adults,
    guest_count_children: t.guest_count_children,
    bookings:             bookingsByTrip.get(t.id) ?? [],
  }))

  return { trips, partners: partnerMap, house }
}