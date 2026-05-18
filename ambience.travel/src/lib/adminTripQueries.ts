// adminTripQueries.ts
// Trip Dossier query layer — reads travel_bookings, travel_trips,
// travel_partners, travel_accom_hotels for the HouseTab Trip Dossier surface.
// Also owns travel_trip_briefs + travel_booking_rooms CRUD.
//
// All column names verified against information_schema S44/S45 pre-flight.
//
// Join path (S45 fix): travel_bookings.house_id -> a_houses (direct FK).
//
// Last updated: S46 — _hotel_image_src added to TripBooking; hotelMap replaces
//   hotelNameMap; travel_accom_hotels.hero_image_src fetched alongside name.
//   BookingRow type updated to exclude _hotel_image_src.
// Prior: S45 — add BookingRoom type; fetch rooms in Step 5 parallel;
//   attach rooms to TripBooking; add room CRUD functions.
// Prior: S45 — TripBrief type, fetchTripBrief, upsertTripBrief.
// Prior: S45 — fix Step 1 join; house profile; new booking columns.
// Prior: S44 — initial ship.

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
  id:                 string
  display_name:       string
  salutation_rule:    string | null
  travel_style_notes: string | null
  avoid_notes:        string | null
  service_notes:      string | null
}


export type TripDestination = {
  id:            string
  destination_id: string
  sort_order:    number
  // Resolved from global_destinations
  slug:          string
  name:          string
  storage_path:  string | null
  hero_image_src: string | null
}

export type JourneyStep = {
  icon:   string
  label:  string
  detail: string
}

export type TripBrief = {
  id:                   string
  trip_id:              string
  house_id:             string | null
  brief_title:          string | null
  brief_subtitle:       string | null
  prepared_for:         string | null
  hero_image_src:       string | null
  hero_image_alt:       string | null
  snapshot_destination: string | null
  snapshot_dates:       string | null
  snapshot_guests:      string | null
  snapshot_status:      string | null
  journey_steps:        JourneyStep[]
  advisor_name:         string | null
  advisor_email:        string | null
  advisor_phone:        string | null
  hotel_contact_note:   string | null
  important_notes:      string[]
  footer_tagline:       string | null
  created_at:           string
  updated_at:           string
}

export type TripBriefPatch = Partial<Omit<TripBrief, 'id' | 'trip_id' | 'created_at' | 'updated_at'>>

export type BookingRoom = {
  id:                  string
  booking_id:          string
  room_name:           string | null
  confirmation_number: string | null
  guest_name:          string | null
  party_composition:   string | null
  notes:               string | null
  nights:              number | null
  rate:                number | null
  tax_pct:             number | null
  total:               number | null
  brief_image_src:     string | null
  sort_order:          number
  created_at:          string
  updated_at:          string
}

export type BookingRoomPatch = Partial<Omit<BookingRoom, 'id' | 'booking_id' | 'created_at' | 'updated_at'>>

export type TripBooking = {
  id:                     string
  trip_id:                string
  house_id:               string | null
  engagement_id:          string | null
  booking_type:           string | null
  name:                   string | null
  status:                 string | null
  confirmation_number:    string | null
  start_date:             string | null
  end_date:               string | null
  nights:                 number | null
  commissionable_rate:    number | null
  total_rate:             number | null
  taxes_and_fees:         number | null
  currency:               string | null
  rate_type:              string | null
  inclusions:             string | null
  price:                  number | null
  deposit_amount:         number | null
  deposit_due_date:       string | null
  deposit_paid_at:        string | null
  balance_amount:         number | null
  balance_due_date:       string | null
  balance_paid_at:        string | null
  commission_pct:         number | null
  commission_amount:      number | null
  net_revenue:            number | null
  commission_paid_at:     string | null
  invoice_number:         string | null
  iata_partner_id:        string | null
  iata_share_pct:         number | null
  iata_share_amt:         number | null
  referral_partner_id:    string | null
  referral_share_pct:     number | null
  referral_share_amt:     number | null
  individual_id:          string | null
  individual_share_pct:   number | null
  individual_share_amt:   number | null
  accom_hotel_id:         string | null
  supplier_id:            string | null
  supplier_name_override: string | null
  party_composition:         string | null
  primary_contact_name:      string | null
  primary_contact_role:      string | null
  supplier_contact_name:     string | null
  supplier_contact_whatsapp: string | null
  brief_category:  string | null
  brief_show:      boolean
  brief_image_src: string | null
  booked_by:       string | null
  cancellation_policy:    string | null
  booking_policy:         string | null
  notes:                  string | null
  sort_order:             number | null
  created_at:             string | null
  updated_at:             string | null
  // Client-resolved
  _hotel_name:      string | null
  _hotel_image_src: string | null
  _rooms:           BookingRoom[]
}

export type DossierTrip = {
  id:                   string
  trip_code:            string
  status:               string | null
  start_date:           string | null
  end_date:             string | null
  duration_nights:      number | null
  trip_type:            string | null
  destinations:         TripDestination[]
  guest_count_adults:   number | null
  guest_count_children: number | null
  bookings:             TripBooking[]
  brief:                TripBrief | null
}

export type TripDossierData = {
  trips:    DossierTrip[]
  partners: Record<string, TripPartner>
  house:    HouseProfile | null
}

// ── Raw row shapes ────────────────────────────────────────────────────────────

type BookingTripRow = { trip_id: string }
type TripRow        = { id: string; trip_code: string; status: string | null; start_date: string | null; end_date: string | null; duration_nights: number | null; trip_type: string | null; guest_count_adults: number | null; guest_count_children: number | null }
type BookingRow     = Omit<TripBooking, '_hotel_name' | '_hotel_image_src' | '_rooms'>
type HotelRow       = { id: string; name: string; hero_image_src: string | null }
type PartnerRow     = TripPartner
type HouseRow       = HouseProfile
type BriefRow       = TripBrief
type RoomRow        = BookingRoom
type TripDestRow    = { id: string; trip_id: string; destination_id: string; sort_order: number; global_destinations: { slug: string; name: string; storage_path: string | null; hero_image_src: string | null } | { slug: string; name: string; storage_path: string | null; hero_image_src: string | null }[] }

// ── Main dossier query ────────────────────────────────────────────────────────

export async function fetchTripDossierForHouse(houseId: string): Promise<TripDossierData> {
  // Step 1: bookings.house_id -> trip IDs
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
    .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, guest_count_adults, guest_count_children')
    .in('id', tripIds)
    .order('start_date', { ascending: false })

  if (tripErr) throw new Error(tripErr.message)
  const tripRows = (tripData ?? []) as TripRow[]
  if (tripRows.length === 0) return { trips: [], partners: {}, house: null }

  // Step 3: bookings
  const { data: bookData, error: bookErr } = await supabase
    .from('travel_bookings')
    .select('id, trip_id, house_id, engagement_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, total_rate, taxes_and_fees, currency, rate_type, inclusions, price, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, party_composition, primary_contact_name, primary_contact_role, supplier_contact_name, supplier_contact_whatsapp, brief_category, brief_show, brief_image_src, booked_by, cancellation_policy, booking_policy, notes, sort_order, created_at, updated_at')
    .eq('house_id', houseId)
    .order('sort_order', { ascending: true })

  if (bookErr) throw new Error(bookErr.message)
  const bookingRows = (bookData ?? []) as BookingRow[]

  // Step 4: hotel name + hero image
  const hotelIds = [...new Set(bookingRows.map(b => b.accom_hotel_id).filter((id): id is string => !!id))]
  const hotelMap = new Map<string, { name: string; hero_image_src: string | null }>()
  if (hotelIds.length > 0) {
    const { data: hotelData } = await supabase
      .from('travel_accom_hotels')
      .select('id, name, hero_image_src')
      .in('id', hotelIds)
    for (const h of (hotelData ?? []) as HotelRow[]) {
      hotelMap.set(h.id, { name: h.name, hero_image_src: h.hero_image_src })
    }
  }

  // Step 5: partners + house + briefs + rooms (parallel)
  const bookingIds = bookingRows.map(b => b.id)

  const [partnerResult, houseResult, briefResult, roomResult, destResult] = await Promise.all([
    supabase
      .from('travel_partners')
      .select('id, name, partner_type, default_share_pct, currency, is_active'),
    supabase
      .from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),
    supabase
      .from('travel_trip_briefs')
      .select('*')
      .in('trip_id', tripIds),
    bookingIds.length > 0
      ? supabase
          .from('travel_booking_rooms')
          .select('*')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('travel_trip_destinations')
      .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
      .in('trip_id', tripIds)
      .order('sort_order', { ascending: true }),
  ])

  if (partnerResult.error) throw new Error(partnerResult.error.message)
  const partnerMap: Record<string, TripPartner> = {}
  for (const p of (partnerResult.data ?? []) as PartnerRow[]) partnerMap[p.id] = p

  const house = houseResult.data ? (houseResult.data as HouseRow) : null

  const briefMap = new Map<string, TripBrief>()
  for (const br of (briefResult.data ?? []) as BriefRow[]) briefMap.set(br.trip_id, br)

  const roomsByBooking = new Map<string, BookingRoom[]>()
  for (const r of (roomResult.data ?? []) as RoomRow[]) {
    if (!roomsByBooking.has(r.booking_id)) roomsByBooking.set(r.booking_id, [])
    roomsByBooking.get(r.booking_id)!.push(r)
  }

  const destsByTrip = new Map<string, TripDestination[]>()
  for (const row of ((destResult.data ?? []) as unknown as TripDestRow[])) {
    if (!destsByTrip.has(row.trip_id)) destsByTrip.set(row.trip_id, [])
    const gdRaw = row.global_destinations
    const gd = Array.isArray(gdRaw) ? gdRaw[0] : gdRaw
    if (!gd) continue
    destsByTrip.get(row.trip_id)!.push({
      id:             row.id,
      destination_id: row.destination_id,
      sort_order:     row.sort_order,
      slug:           gd.slug,
      name:           gd.name,
      storage_path:   gd.storage_path,
      hero_image_src: gd.hero_image_src,
    })
  }

  // Step 6: assemble
  const bookingsByTrip = new Map<string, TripBooking[]>()
  for (const b of bookingRows) {
    if (!bookingsByTrip.has(b.trip_id)) bookingsByTrip.set(b.trip_id, [])
    const hotel = b.accom_hotel_id ? (hotelMap.get(b.accom_hotel_id) ?? null) : null
    bookingsByTrip.get(b.trip_id)!.push({
      ...b,
      _hotel_name:      hotel?.name ?? null,
      _hotel_image_src: hotel?.hero_image_src ?? null,
      _rooms:           roomsByBooking.get(b.id) ?? [],
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
    destinations:         destsByTrip.get(t.id) ?? [],
    guest_count_adults:   t.guest_count_adults,
    guest_count_children: t.guest_count_children,
    bookings:             bookingsByTrip.get(t.id) ?? [],
    brief:                briefMap.get(t.id) ?? null,
  }))

  return { trips, partners: partnerMap, house }
}

// ── Brief CRUD ────────────────────────────────────────────────────────────────

export async function fetchTripBrief(tripId: string): Promise<TripBrief | null> {
  const { data, error } = await supabase
    .from('travel_trip_briefs')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? (data as TripBrief) : null
}

export async function upsertTripBrief(tripId: string, houseId: string, patch: TripBriefPatch): Promise<TripBrief> {
  const { data, error } = await supabase
    .from('travel_trip_briefs')
    .upsert({ trip_id: tripId, house_id: houseId, ...patch }, { onConflict: 'trip_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as TripBrief
}

export async function updateBookingBriefFields(
  bookingId: string,
  patch: { brief_category?: string | null; brief_show?: boolean; brief_image_src?: string | null; booked_by?: string | null }
): Promise<void> {
  const { error } = await supabase.from('travel_bookings').update(patch).eq('id', bookingId)
  if (error) throw new Error(error.message)
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export async function fetchBookingRooms(bookingId: string): Promise<BookingRoom[]> {
  const { data, error } = await supabase
    .from('travel_booking_rooms')
    .select('*')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as BookingRoom[]
}

export async function createBookingRoom(bookingId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { data, error } = await supabase
    .from('travel_booking_rooms')
    .insert({ booking_id: bookingId, ...patch })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as BookingRoom
}

export async function updateBookingRoom(roomId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { data, error } = await supabase
    .from('travel_booking_rooms')
    .update(patch)
    .eq('id', roomId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as BookingRoom
}

export async function deleteBookingRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('travel_booking_rooms').delete().eq('id', roomId)
  if (error) throw new Error(error.message)
}