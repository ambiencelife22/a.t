// queriesAdminTrip.ts
// Trip Dossier query layer — reads travel_bookings, travel_trips,
// travel_partners, travel_accom_hotels for the HouseTab Trip Dossier surface.
// Also owns travel_trip_briefs + travel_booking_rooms + travel_trip_days CRUD.
//
// All column names verified against information_schema S44/S45/S46 pre-flight.
//
// Join path (S45 fix): travel_bookings.house_id -> a_houses (direct FK).
//
// S52 — All read and write paths routed through Edge Functions.
//   travel-read-trip-admin: all 7 read paths.
//   travel-write-trip: all 11 mutation paths + derive_itinerary orchestration.
//   No direct supabase table reads or writes remain in this file.
//   supabase (session client) used for all EF calls — JWT attached automatically.
//   autoDeriveTripItinerary now fires a single EF call (derive_itinerary mode)
//   replacing the prior multi-round-trip client-side loop.
//
// Last updated: S50 — TripBrief gains show_advisor_email. Mirrors migration
//   s50_add_show_advisor_email. Gates advisor_email visibility on public
//   Contacts tab, alongside the existing show_advisor_phone toggle.
// Prior: S48 — TripBrief gains 5 new columns: programme_show_images,
//   welcome_letter, show_tab_confirmation, show_tab_programme, show_tab_brief,
//   show_tab_contacts. Mirrors migration s48_trip_page_controls.
// Prior: S48 — url_id added to DossierTrip. Engagement join in fetchTripDossierForHouse.
// Prior: S48 — booked_by text added to TripAuxBooking. TripAuxBookingPatch added.
// Prior: S47 — booked_by_label text added to BookingRoom (migration S47).
// Prior: S46 — _hotel_image_src added to TripBooking.
// Prior: S45 — BookingRoom type; rooms fetch; room CRUD.
// Prior: S44 — initial ship.

import { supabase } from '../lib/supabase'

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
  id:             string
  destination_id: string
  sort_order:     number
  slug:           string
  name:           string
  storage_path:   string | null
  hero_image_src: string | null
}

export type JourneyStep = {
  icon:   string
  label:  string
  detail: string
}

export type TripBrief = {
  id:                    string
  trip_id:               string
  house_id:              string | null
  brief_title:           string | null
  brief_subtitle:        string | null
  prepared_for:          string | null
  hero_image_src:        string | null
  hero_image_alt:        string | null
  snapshot_destination:  string | null
  snapshot_dates:        string | null
  snapshot_guests:       string | null
  snapshot_status:       string | null
  journey_steps:         JourneyStep[]
  advisor_name:          string | null
  advisor_email:         string | null
  advisor_phone:         string | null
  hotel_contact_note:    string | null
  important_notes:       string[]
  footer_tagline:        string | null
  logo_variant:          string | null
  programme_show_images: boolean
  welcome_letter:        string | null
  show_tab_confirmation: boolean
  show_tab_programme:    boolean
  show_tab_brief:        boolean
  show_tab_contacts:     boolean
  show_advisor_phone:    boolean
  show_advisor_email:    boolean
  links:                 { label: string; url: string }[]
  programme_notes:       string | null
  created_at:            string
  updated_at:            string
}

export type TripDay = {
  id:         string
  trip_id:    string
  entry_date: string
  show:       boolean
  day_label:  string | null
  day_note:   string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type TripDayEntry = {
  id:                  string
  trip_id:             string
  entry_date:          string
  start_time:          string | null
  end_time:            string | null
  title:               string
  subtitle:            string | null
  category:            string | null
  booked_by:           string
  confirmation_number: string | null
  guest_label:         string | null
  notes:               string | null
  brief_show:          boolean
  sort_order:          number
  is_auto_derived:     boolean
  source_booking_id:   string | null
  source_aux_id:       string | null
  created_at:          string
  updated_at:          string
}

export type TripDayPatch      = Partial<Omit<TripDay,      'id' | 'trip_id' | 'created_at' | 'updated_at'>>
export type TripDayEntryPatch = Partial<Omit<TripDayEntry, 'id' | 'trip_id' | 'created_at' | 'updated_at'>>

export type TripAuxBooking = {
  id:                  string
  trip_id:             string
  booking_type:        string | null
  name:                string | null
  confirmation_number: string | null
  start_date:          string | null
  start_time:          string | null
  end_date:            string | null
  end_time:            string | null
  origin:              string | null
  destination:         string | null
  notes:               string | null
  guest_label:         string | null
  booked_by:           string | null
  brief_show:          boolean
  sort_order:          number
  airline_supplier_id: string | null
  airline_name:        string | null
  flight_number:       string | null
  depart_airport:      string | null
  arrive_airport:      string | null
  cabin_class:         string | null
  seat_numbers:        string | null
  seat_type:           string | null
  aircraft_type:       string | null
  passengers?:         TripAuxPassenger[]
  created_at:          string
  updated_at:          string
}

export type TripAuxPassenger = {
  id:                  string
  aux_booking_id:      string
  person_id:           string | null
  passenger_label:     string | null
  confirmation_number: string | null
  seat_numbers:        string | null
  sort_order:          number
}

export type TripAuxBookingPatch = Partial<Omit<TripAuxBooking, 'id' | 'trip_id' | 'created_at' | 'updated_at'>>

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
  additional_guests:   string[] | null
  sort_order:          number
  created_at:          string
  updated_at:          string
  resolved_image_src?: string | null
  resolved_image_alt?: string | null
}

export type BookingRoomPatch = Partial<Omit<BookingRoom, 'id' | 'booking_id' | 'created_at' | 'updated_at'>>

export type TripBooking = {
  id:                        string
  trip_id:                   string
  house_id:                  string | null
  engagement_id:             string | null
  booking_type:              string | null
  name:                      string | null
  status:                    string | null
  confirmation_number:       string | null
  start_date:                string | null
  end_date:                  string | null
  nights:                    number | null
  commissionable_rate:       number | null
  total_rate:                number | null
  taxes_and_fees:            number | null
  currency:                  string | null
  rate_type:                 string | null
  inclusions:                string | null
  price:                     number | null
  deposit_amount:            number | null
  deposit_due_date:          string | null
  deposit_paid_at:           string | null
  balance_amount:            number | null
  balance_due_date:          string | null
  balance_paid_at:           string | null
  commission_pct:            number | null
  commission_amount:         number | null
  net_revenue:               number | null
  commission_paid_at:        string | null
  invoice_number:            string | null
  iata_partner_id:           string | null
  iata_share_pct:            number | null
  iata_share_amt:            number | null
  referral_partner_id:       string | null
  referral_share_pct:        number | null
  referral_share_amt:        number | null
  individual_id:             string | null
  individual_share_pct:      number | null
  individual_share_amt:      number | null
  accom_hotel_id:            string | null
  supplier_id:               string | null
  supplier_name_override:    string | null
  party_composition:         string | null
  primary_contact_name:      string | null
  primary_contact_role:      string | null
  supplier_contact_name:     string | null
  supplier_contact_whatsapp: string | null
  brief_category:            string | null
  brief_show:                boolean
  brief_image_src:           string | null
  booked_by:                 string | null
  cancellation_policy:       string | null
  booking_policy:            string | null
  notes:                     string | null
  sort_order:                number | null
  created_at:                string | null
  updated_at:                string | null
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
  url_id:               string | null
}

export type TripDossierData = {
  trips:    DossierTrip[]
  partners: Record<string, TripPartner>
  house:    HouseProfile | null
}

// ── EF response row types (raw DB shapes returned by the EF) ─────────────────

type TripRow     = { id: string; trip_code: string; status: string | null; start_date: string | null; end_date: string | null; duration_nights: number | null; trip_type: string | null; guest_count_adults: number | null; guest_count_children: number | null }
type BookingRow  = Omit<TripBooking, '_hotel_name' | '_hotel_image_src' | '_rooms'>
type HotelEntry  = { name: string; hero_image_src: string | null }
type BriefRow    = TripBrief
type RoomRow     = BookingRoom
type TripDestRow = { id: string; trip_id: string; destination_id: string; sort_order: number; global_destinations: { slug: string; name: string; storage_path: string | null; hero_image_src: string | null } | { slug: string; name: string; storage_path: string | null; hero_image_src: string | null }[] }
type EngRow      = { trip_id: string; url_id: string }

// ── EF invoke helpers ─────────────────────────────────────────────────────────
// supabase (session client) attaches the JWT automatically on every call.
// Never use supabaseAnon here — these are admin-only operations.

async function invokeReadTrip<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-trip-admin', { body })
  if (error) throw new Error(`travel-read-trip-admin [${body.mode}]: ${error.message}`)
  return data as T
}

async function invokeWriteTrip<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-trip', { body })
  if (error) throw new Error(`travel-write-trip [${body.mode}]: ${error.message}`)
  return data as T
}

// ── Main dossier query ────────────────────────────────────────────────────────

export async function fetchTripDossierForHouse(houseId: string): Promise<TripDossierData> {
  const raw = await invokeReadTrip<{
    tripRows:    TripRow[]
    bookingRows: BookingRow[]
    hotelMap:    Record<string, HotelEntry>
    partners:    TripPartner[]
    house:       HouseProfile | null
    briefs:      BriefRow[]
    rooms:       RoomRow[]
    dests:       TripDestRow[]
    engagements: EngRow[]
  }>({ mode: 'dossier', house_id: houseId })

  const { tripRows, bookingRows, hotelMap, partners, house, briefs, rooms, dests, engagements } = raw

  if (!tripRows || tripRows.length === 0) return { trips: [], partners: {}, house: null }

  const partnerMap: Record<string, TripPartner> = {}
  for (const p of partners) partnerMap[p.id] = p

  const briefMap = new Map<string, TripBrief>()
  for (const br of briefs) briefMap.set(br.trip_id, br)

  const roomsByBooking = new Map<string, BookingRoom[]>()
  for (const r of rooms) {
    if (!roomsByBooking.has(r.booking_id)) roomsByBooking.set(r.booking_id, [])
    roomsByBooking.get(r.booking_id)!.push(r)
  }

  const destsByTrip = new Map<string, TripDestination[]>()
  for (const row of dests) {
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

  const bookingsByTrip = new Map<string, TripBooking[]>()
  for (const b of bookingRows) {
    if (!bookingsByTrip.has(b.trip_id)) bookingsByTrip.set(b.trip_id, [])
    const hotel = b.accom_hotel_id ? (hotelMap[b.accom_hotel_id] ?? null) : null
    bookingsByTrip.get(b.trip_id)!.push({
      ...b,
      _hotel_name:      hotel?.name ?? null,
      _hotel_image_src: hotel?.hero_image_src ?? null,
      _rooms:           roomsByBooking.get(b.id) ?? [],
    })
  }

  const urlIdByTrip = new Map<string, string>()
  for (const row of engagements) {
    if (!urlIdByTrip.has(row.trip_id)) urlIdByTrip.set(row.trip_id, row.url_id)
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
    url_id:               urlIdByTrip.get(t.id) ?? null,
  }))

  return { trips, partners: partnerMap, house }
}

// ── Brief read ────────────────────────────────────────────────────────────────

export async function fetchTripBrief(tripId: string): Promise<TripBrief | null> {
  const { brief } = await invokeReadTrip<{ brief: TripBrief | null }>({
    mode: 'brief', trip_id: tripId,
  })
  return brief
}

// ── Rooms read ────────────────────────────────────────────────────────────────

export async function fetchBookingRooms(bookingId: string): Promise<BookingRoom[]> {
  const { rooms } = await invokeReadTrip<{ rooms: BookingRoom[] }>({
    mode: 'rooms', booking_id: bookingId,
  })
  return rooms
}

// ── Days read ─────────────────────────────────────────────────────────────────

export async function fetchTripDays(tripId: string): Promise<TripDay[]> {
  const { days } = await invokeReadTrip<{ days: TripDay[] }>({
    mode: 'days', trip_id: tripId,
  })
  return days
}

// ── Day entries read ──────────────────────────────────────────────────────────

export async function fetchTripDayEntries(tripId: string): Promise<TripDayEntry[]> {
  const { dayEntries } = await invokeReadTrip<{ dayEntries: TripDayEntry[] }>({
    mode: 'day_entries', trip_id: tripId,
  })
  return dayEntries
}

// ── Aux bookings read ─────────────────────────────────────────────────────────

export async function fetchTripAuxBookings(tripId: string): Promise<TripAuxBooking[]> {
  const { auxBookings } = await invokeReadTrip<{ auxBookings: TripAuxBooking[] }>({
    mode: 'aux_bookings', trip_id: tripId,
  })
  return auxBookings
}

// ── Public view read ──────────────────────────────────────────────────────────

export async function fetchEngagementPublicView(tripId: string): Promise<boolean> {
  const { publicView } = await invokeReadTrip<{ publicView: boolean }>({
    mode: 'public_view', trip_id: tripId,
  })
  return publicView
}

// ── Brief write ───────────────────────────────────────────────────────────────

export async function upsertTripBrief(tripId: string, houseId: string, patch: TripBriefPatch): Promise<TripBrief> {
  const { brief } = await invokeWriteTrip<{ brief: TripBrief }>({
    mode: 'upsert_brief', trip_id: tripId, house_id: houseId, patch,
  })
  return brief
}

export async function updateBookingBriefFields(
  bookingId: string,
  patch: { brief_category?: string | null; brief_show?: boolean; brief_image_src?: string | null; booked_by?: string | null },
): Promise<void> {
  await invokeWriteTrip({ mode: 'update_booking_brief', booking_id: bookingId, patch })
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export async function createBookingRoom(bookingId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { room } = await invokeWriteTrip<{ room: BookingRoom }>({
    mode: 'create_room', booking_id: bookingId, patch,
  })
  return room
}

export async function updateBookingRoom(roomId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { room } = await invokeWriteTrip<{ room: BookingRoom }>({
    mode: 'update_room', room_id: roomId, patch,
  })
  return room
}

export async function deleteBookingRoom(roomId: string): Promise<void> {
  await invokeWriteTrip({ mode: 'delete_room', room_id: roomId })
}

// ── Aux booking write ─────────────────────────────────────────────────────────

export async function createTripAuxBooking(tripId: string, patch: TripAuxBookingPatch): Promise<TripAuxBooking> {
  const { auxBooking } = await invokeWriteTrip<{ auxBooking: TripAuxBooking }>({
    mode: 'create_aux_booking', trip_id: tripId, patch,
  })
  return auxBooking
}

export async function updateTripAuxBooking(id: string, patch: TripAuxBookingPatch): Promise<TripAuxBooking> {
  const { auxBooking } = await invokeWriteTrip<{ auxBooking: TripAuxBooking }>({
    mode: 'update_aux_booking', id, patch,
  })
  return auxBooking
}

export async function deleteTripAuxBooking(id: string): Promise<void> {
  await invokeWriteTrip({ mode: 'delete_aux_booking', id })
}

// ── Itinerary CRUD ────────────────────────────────────────────────────────────

export async function upsertTripDay(tripId: string, date: string, patch: TripDayPatch): Promise<TripDay> {
  const { day } = await invokeWriteTrip<{ day: TripDay }>({
    mode: 'upsert_day', trip_id: tripId, entry_date: date, patch,
  })
  return day
}

export async function createTripDayEntry(tripId: string, entry: Omit<TripDayEntry, 'id' | 'created_at' | 'updated_at'>): Promise<TripDayEntry> {
  const { dayEntry } = await invokeWriteTrip<{ dayEntry: TripDayEntry }>({
    mode: 'create_day_entry', trip_id: tripId, entry,
  })
  return dayEntry
}

export async function updateTripDayEntry(id: string, patch: TripDayEntryPatch): Promise<TripDayEntry> {
  const { dayEntry } = await invokeWriteTrip<{ dayEntry: TripDayEntry }>({
    mode: 'update_day_entry', id, patch,
  })
  return dayEntry
}

export async function deleteTripDayEntry(id: string): Promise<void> {
  await invokeWriteTrip({ mode: 'delete_day_entry', id })
}

// ── autoDeriveTripItinerary — single EF call ──────────────────────────────────
// Server-side orchestration via derive_itinerary mode.
// Replaces the prior client-side loop — one network call regardless of trip
// length. Partial derives are no longer possible.

export async function autoDeriveTripItinerary(
  trip: DossierTrip,
  auxBookings: TripAuxBooking[],
): Promise<{ days: TripDay[]; entries: TripDayEntry[] }> {
  if (!trip.start_date || !trip.end_date) return { days: [], entries: [] }
  const { days, entries } = await invokeWriteTrip<{ days: TripDay[]; entries: TripDayEntry[] }>({
    mode: 'derive_itinerary', trip, aux_bookings: auxBookings,
  })
  return { days, entries }
}

// ── Engagement public_view toggle ─────────────────────────────────────────────

export async function setEngagementPublicView(tripId: string, publicView: boolean): Promise<void> {
  await invokeWriteTrip({ mode: 'set_public_view', trip_id: tripId, public_view: publicView })
}