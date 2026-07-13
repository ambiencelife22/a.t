// queriesAdminJourney.ts
// Trip Dossier query layer — reads travel_bookings, travel_journey,
// travel_partners, travel_accom_hotels for the HouseTab Trip Dossier surface.
// Also owns travel_journey_briefs + travel_booking_rooms + travel_journey_days CRUD.
//
// All column names verified against information_schema S44/S45/S46 pre-flight.
//
// Join path (S45 fix): travel_bookings.house_id -> a_houses (direct FK).
//
// S52 — All read and write paths routed through Edge Functions.
//   travel-read-journey-admin: all 7 read paths.
//   travel-write-journey: journey mutation paths (public_view retired to travel-write-engagement/set_visibility, S53P).
//   No direct supabase table reads or writes remain in this file.
//   supabase (session client) used for all EF calls — JWT attached automatically.
//
// Last updated: S53P — set_public_view retired: setEngagementPublicView now routes to
//   travel-write-engagement/set_visibility (duplicate write eliminated).
//   File pending rename to queriesAdminJourney (Step 2, engagement/journey split).
// 
// Prior: S50 — TripBrief gains show_advisor_email. Mirrors migration
//   s50_add_show_advisor_email. Gates advisor_email visibility on public
//   Contacts tab, alongside the existing show_advisor_phone toggle.
// Prior: S48 — TripBrief gains 5 new columns: programme_show_images,
//   welcome_letter, show_tab_confirmation, show_tab_programme, show_tab_brief,
//   show_tab_contacts. Mirrors migration s48_trip_page_controls.
// Prior: S48 — url_id added to DossierTrip. Engagement join in fetchJourneyDossierForHouse.
// Prior: S48 — booked_by text added to TripAuxBooking. TripAuxBookingPatch added.
// Prior: S47 — booked_by_label text added to BookingRoom (migration S47).
// Prior: S46 — _hotel_image_src added to TripBooking.
// Prior: S45 — BookingRoom type; rooms fetch; room CRUD.
// Prior: S44 — initial ship.

import { supabase } from '../lib/supabase'
import { computeEngagementStage, type EngagementStage, type BookingInvoice } from '../types/typesImmerse'

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
  journey_id:               string
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
  show_tab_welcome:      boolean
  show_advisor_phone:    boolean
  show_advisor_email:    boolean
  links:                 { label: string; url: string }[]
  programme_notes:       string | null
  created_at:            string
  updated_at:            string
}

export type TripDay = {
  id:         string | null
  journey_id:    string
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
  journey_id:             string
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

export type TripDayPatch      = Partial<Omit<TripDay,      'id' | 'journey_id' | 'created_at' | 'updated_at'>>
export type TripDayEntryPatch = Partial<Omit<TripDayEntry, 'id' | 'journey_id' | 'created_at' | 'updated_at'>>

export type TripAuxBooking = {
  id:                  string
  journey_id:             string
  engagement_type_id:  string | null
  booking_type:        string | null  // slug from travel_engagement_types — canonical type field
  element_type:        string | null  // slug from travel_engagement_types — the honest name (booking_type retiring)
  element_type_label:  string | null  // display label from travel_engagement_types
  name:                string | null
  start_date:          string | null
  start_time:          string | null
  end_date:            string | null
  end_time:            string | null
  origin:              string | null
  destination:         string | null
  notes:               string | null
  confirmation_number: string | null
  booked_by:           string | null
  guest_name:          string | null   // S53F — reservation-holder name (free text)
  guest_count:         number | null   // S53F — party size / covers
  contact_name:        string | null   // S53F — service-contact (e.g. greeter)
  contact_phone:       string | null   // S53F — service-contact phone
  dining_status:                string | null   // S53F — active | cancelled
  cancellation_penalty_applied: boolean | null  // S53F — cancelled WITH penalty (red pill)
  cancellation_note:            string | null   // S53F — penalty/cancellation note
  show_cancellation:            boolean | null  // S53F — display toggle
  venue?: {                                     // S53F — EF-composed canonical venue facts
    address:         string | null
    maps_url:        string | null
    phone:           string | null
    dress_code:      string | null
    children_policy: string | null
    table_hold_note: string | null
    booking_terms:   string | null
  } | null
  brief_show:          boolean
  sort_order:          number
  airline_supplier_id: string | null
  airline_name:        string | null
  flight_number:       string | null
  depart_airport:      string | null
  arrive_airport:      string | null
  cabin_class:         string | null
  aircraft_type:       string | null
  dining_venue_id?:    string | null
  image_src?:          string | null
  passengers?:         TripAuxPassenger[]
  driver_details?:     TripAuxDriverDetail[]
  created_at:          string
  updated_at:          string
}

export type TripAuxPassenger = {
  id:                       string
  aux_booking_id:           string
  person_id:                string | null
  passenger_label:          string | null
  confirmation_number:      string | null
  seat_numbers:             string | null
  sort_order:               number
  // EF-resolved (S53G single-source): person → override → prepared_for
  resolved_passenger_label?: string | null
}

export type TripAuxBookingPatch = Partial<Omit<TripAuxBooking, 'id' | 'journey_id' | 'created_at' | 'updated_at'>>

export type TripAuxDriverDetail = {
  id:            string
  aux_booking_id: string
  driver_name:   string | null
  driver_phone:  string | null
  car_model:     string | null
  plate:         string | null
  company:       string | null
  vehicle_role:  string | null
  sort_order:    number
}
export type TripAuxDriverDetailPatch = Partial<Omit<TripAuxDriverDetail, 'id' | 'aux_booking_id'>>

export type TripBriefPatch = Partial<Omit<TripBrief, 'id' | 'journey_id' | 'created_at' | 'updated_at'>>

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
  extra_person_fee:    number | null
  brief_image_src:     string | null
  additional_guests:   string[] | null
  person_id:           string | null
  check_in_time:       string | null
  bedding_type:        string | null
  sort_order:          number
  created_at:          string
  updated_at:          string
  resolved_image_src?:         string | null
  resolved_image_alt?:         string | null
  resolved_guest_name?:        string | null
  resolved_additional_guests?: string[] | null
}

export type BookingRoomPatch = Partial<Omit<BookingRoom, 'id' | 'booking_id' | 'created_at' | 'updated_at'>>

export type TripBooking = {
  id:                        string
  journey_id:                   string
  house_id:                  string | null
  engagement_id:             string | null
  name:                      string | null
  status:                    string | null
  confirmation_number:       string | null
  start_date:          string | null
  start_time:          string | null
  end_date:            string | null
  check_in_date:       string | null
  check_in_note:       string | null
  check_out_note:      string | null
  nights:              number | null
  commissionable_rate:       number | null
  total_rate:                number | null
  taxes_and_fees:            number | null
  currency:                  string | null
  rate_type:                 string | null
  inclusions:                string | null
  inclusions_override:       unknown[] | null
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
  _invoices:        BookingInvoice[]
}

export type DossierTrip = {
  id:                   string
  trip_code:            string
  stage:                EngagementStage | null   // S53G+ derived from winning engagement
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

type TripRow     = { id: string; trip_code: string; derived_status_slug: string | null; start_date: string | null; end_date: string | null; duration_nights: number | null; trip_type: string | null; guest_count_adults: number | null; guest_count_children: number | null }
type BookingRow  = Omit<TripBooking, '_hotel_name' | '_hotel_image_src' | '_rooms' | '_invoices'>
type HotelEntry  = { name: string; hero_image_src: string | null }
type BriefRow    = TripBrief
type RoomRow     = BookingRoom
type TripDestRow = { id: string; journey_id: string; destination_id: string; sort_order: number; global_destinations: { slug: string; name: string; storage_path: string | null; hero_image_src: string | null } | { slug: string; name: string; storage_path: string | null; hero_image_src: string | null }[] }
type EngRow      = { journey_id: string; url_id: string }

// ── EF invoke helpers ─────────────────────────────────────────────────────────
// supabase (session client) attaches the JWT automatically on every call.
// Never use supabaseAnon here — these are admin-only operations.

async function invokeReadJourney<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', { body })
  if (error) throw new Error(`travel-read-journey-admin [${body.mode}]: ${error.message}`)
  return data as T
}

async function invokeWriteJourney<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-journey', { body })
  if (error) throw new Error(`travel-write-journey [${body.mode}]: ${error.message}`)
  return data as T
}

// ── Main dossier query ────────────────────────────────────────────────────────

export async function fetchJourneyDossierForHouse(houseId: string): Promise<TripDossierData> {
  const raw = await invokeReadJourney<{
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
  for (const br of briefs) briefMap.set(br.journey_id, br)

  const roomsByBooking = new Map<string, BookingRoom[]>()
  for (const r of rooms) {
    if (!roomsByBooking.has(r.booking_id)) roomsByBooking.set(r.booking_id, [])
    roomsByBooking.get(r.booking_id)!.push(r)
  }

  const destsByTrip = new Map<string, TripDestination[]>()
  for (const row of dests) {
    if (!destsByTrip.has(row.journey_id)) destsByTrip.set(row.journey_id, [])
    const gdRaw = row.global_destinations
    const gd = Array.isArray(gdRaw) ? gdRaw[0] : gdRaw
    if (!gd) continue
    destsByTrip.get(row.journey_id)!.push({
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
    if (!bookingsByTrip.has(b.journey_id)) bookingsByTrip.set(b.journey_id, [])
    const hotel = b.accom_hotel_id ? (hotelMap[b.accom_hotel_id] ?? null) : null
    bookingsByTrip.get(b.journey_id)!.push({
      ...b,
      _hotel_name:      hotel?.name ?? null,
      _hotel_image_src: hotel?.hero_image_src ?? null,
      _rooms:           roomsByBooking.get(b.id) ?? [],
      _invoices:        [],
    })
  }

  const urlIdByTrip = new Map<string, string>()
  for (const row of engagements) {
    if (!urlIdByTrip.has(row.journey_id)) urlIdByTrip.set(row.journey_id, row.url_id)
  }

  const trips: DossierTrip[] = tripRows.map(t => ({
    id:                   t.id,
    trip_code:            t.trip_code,
    stage:                t.derived_status_slug
                            ? computeEngagementStage({ statusSlug: t.derived_status_slug as any })
                            : null,
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

export async function fetchJourneyBrief(journeyId: string): Promise<TripBrief | null> {
  const { brief } = await invokeReadJourney<{ brief: TripBrief | null }>({
    mode: 'brief', journey_id: journeyId,
  })
  return brief
}

// ── Rooms read ────────────────────────────────────────────────────────────────

export async function fetchBookingRooms(bookingId: string): Promise<BookingRoom[]> {
  const { rooms } = await invokeReadJourney<{ rooms: BookingRoom[] }>({
    mode: 'rooms', booking_id: bookingId,
  })
  return rooms
}

// ── Days read ─────────────────────────────────────────────────────────────────

export async function fetchTripDays(journeyId: string): Promise<TripDay[]> {
  const { days } = await invokeReadJourney<{ days: TripDay[] }>({
    mode: 'days', journey_id: journeyId,
  })
  return days
}

// ── Day entries read ──────────────────────────────────────────────────────────

export async function fetchTripDayEntries(journeyId: string): Promise<TripDayEntry[]> {
  const { dayEntries } = await invokeReadJourney<{ dayEntries: TripDayEntry[] }>({
    mode: 'day_entries', journey_id: journeyId,
  })
  return dayEntries
}

// ── Aux bookings read ─────────────────────────────────────────────────────────

export async function fetchTripAuxBookings(journeyId: string): Promise<TripAuxBooking[]> {
  const { elements } = await invokeReadJourney<{ elements: TripAuxBooking[] }>({
    mode: 'aux_bookings', journey_id: journeyId,
  })
  return elements
}

// ── Public view read ──────────────────────────────────────────────────────────

export async function fetchEngagementPublicView(journeyId: string): Promise<boolean> {
  const { publicView } = await invokeReadJourney<{ publicView: boolean }>({
    mode: 'public_view', journey_id: journeyId,
  })
  return publicView
}

// ── Brief write ───────────────────────────────────────────────────────────────

export async function upsertTripBrief(journeyId: string, houseId: string, patch: TripBriefPatch): Promise<TripBrief> {
  const { brief } = await invokeWriteJourney<{ brief: TripBrief }>({
    mode: 'upsert_brief', journey_id: journeyId, house_id: houseId, patch,
  })
  return brief
}

export async function updateBookingBriefFields(
  bookingId: string,
  patch: { brief_category?: string | null; brief_show?: boolean; brief_image_src?: string | null; booked_by?: string | null },
): Promise<void> {
  await invokeWriteJourney({ mode: 'update_booking_brief', booking_id: bookingId, patch })
}

// Generic booking-field update — update_booking_brief is generic-patch server-side,
// so this writes any travel_bookings column. Returns nothing (EF returns {success}).
export async function updateBookingFields(bookingId: string, patch: Partial<TripBooking>): Promise<void> {
  await invokeWriteJourney({ mode: 'update_booking_brief', booking_id: bookingId, patch })
}

// Create a new travel_bookings row on a trip. patch may set any column;
// journey_id is supplied separately (NOT NULL). Returns the raw inserted row
// (without the client-resolved _hotel_name/_hotel_image_src/_rooms fields).
export async function createBooking(
  journeyId: string,
  patch: Partial<Omit<TripBooking, 'id' | 'journey_id' | '_hotel_name' | '_hotel_image_src' | '_rooms'>>,
): Promise<Omit<TripBooking, '_hotel_name' | '_hotel_image_src' | '_rooms'>> {
  const { booking } = await invokeWriteJourney<{ booking: Omit<TripBooking, '_hotel_name' | '_hotel_image_src' | '_rooms'> }>({
    mode: 'create_booking', journey_id: journeyId, patch,
  })
  return booking
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export async function createBookingRoom(bookingId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { room } = await invokeWriteJourney<{ room: BookingRoom }>({
    mode: 'create_room', booking_id: bookingId, patch,
  })
  return room
}

export async function updateBookingRoom(roomId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { room } = await invokeWriteJourney<{ room: BookingRoom }>({
    mode: 'update_room', room_id: roomId, patch,
  })
  return room
}

export async function deleteBookingRoom(roomId: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_room', room_id: roomId })
}

// ── Aux booking write ─────────────────────────────────────────────────────────

export async function createTripAuxBooking(journeyId: string, patch: TripAuxBookingPatch): Promise<TripAuxBooking> {
  const { auxBooking } = await invokeWriteJourney<{ auxBooking: TripAuxBooking }>({
    mode: 'create_aux_booking', journey_id: journeyId, patch,
  })
  return auxBooking
}

export async function updateTripAuxBooking(id: string, patch: TripAuxBookingPatch): Promise<TripAuxBooking> {
  const { auxBooking } = await invokeWriteJourney<{ auxBooking: TripAuxBooking }>({
    mode: 'update_aux_booking', id, patch,
  })
  return auxBooking
}

export async function deleteTripAuxBooking(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_aux_booking', id })
}

// ── Aux passenger write ───────────────────────────────────────────────────────

export type TripAuxPassengerPatch = Partial<Omit<TripAuxPassenger, 'id' | 'aux_booking_id'>>

export async function createAuxPassenger(nodeId: string, patch: TripAuxPassengerPatch): Promise<TripAuxPassenger> {
  const { auxPassenger } = await invokeWriteJourney<{ auxPassenger: TripAuxPassenger }>({
    mode: 'create_aux_passenger', node_id: nodeId, patch,
  })
  return auxPassenger
}

export async function updateAuxPassenger(id: string, patch: TripAuxPassengerPatch): Promise<TripAuxPassenger> {
  const { auxPassenger } = await invokeWriteJourney<{ auxPassenger: TripAuxPassenger }>({
    mode: 'update_aux_passenger', id, patch,
  })
  return auxPassenger
}

export async function deleteAuxPassenger(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_aux_passenger', id })
}

// ── Aux driver details write (ground-car vehicles) ────────────────────────────

export async function fetchAuxDriverDetails(auxBookingId: string): Promise<TripAuxDriverDetail[]> {
  const { driverDetails } = await invokeReadJourney<{ driverDetails: TripAuxDriverDetail[] }>({
    mode: 'aux_driver_details', node_id: auxBookingId,
  })
  return driverDetails
}

export async function createAuxDriverDetail(auxBookingId: string, patch: TripAuxDriverDetailPatch): Promise<TripAuxDriverDetail> {
  const { driverDetail } = await invokeWriteJourney<{ driverDetail: TripAuxDriverDetail }>({
    mode: 'create_aux_driver_detail', node_id: auxBookingId, patch,
  })
  return driverDetail
}

export async function updateAuxDriverDetail(id: string, patch: TripAuxDriverDetailPatch): Promise<TripAuxDriverDetail> {
  const { driverDetail } = await invokeWriteJourney<{ driverDetail: TripAuxDriverDetail }>({
    mode: 'update_aux_driver_detail', id, patch,
  })
  return driverDetail
}

export async function deleteAuxDriverDetail(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_aux_driver_detail', id })
}

// ── Welcome letters (arrival) ─────────────────────────────────────────────────
// Per room-guest per accommodation. One PDF letter per row, for the hotel to print.

export type TripWelcomeLetter = {
  id:         string
  journey_id:    string
  booking_id: string
  room_id:    string | null
  guest_name: string
  body:       string
  sort_order: number
  created_at: string
  updated_at: string
}

export type TripWelcomeLetterPatch = Partial<Omit<TripWelcomeLetter, 'journey_id' | 'created_at' | 'updated_at'>>

export async function fetchTripWelcomeLetters(journeyId: string): Promise<TripWelcomeLetter[]> {
  const { letters } = await invokeReadJourney<{ letters: TripWelcomeLetter[] }>({
    mode: 'welcome_letters', journey_id: journeyId,
  })
  return letters
}

export async function upsertTripWelcomeLetter(journeyId: string, letter: TripWelcomeLetterPatch): Promise<TripWelcomeLetter> {
  const { letter: row } = await invokeWriteJourney<{ letter: TripWelcomeLetter }>({
    mode: 'upsert_welcome_letter', journey_id: journeyId, letter,
  })
  return row
}

export async function deleteTripWelcomeLetter(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_welcome_letter', id })
}

// ── Itinerary CRUD ────────────────────────────────────────────────────────────

export async function upsertTripDay(journeyId: string, date: string, patch: TripDayPatch): Promise<TripDay> {
  const { day } = await invokeWriteJourney<{ day: TripDay }>({
    mode: 'upsert_day', journey_id: journeyId, entry_date: date, patch,
  })
  return day
}

export async function createTripDayEntry(journeyId: string, entry: Omit<TripDayEntry, 'id' | 'created_at' | 'updated_at'>): Promise<TripDayEntry> {
  const { dayEntry } = await invokeWriteJourney<{ dayEntry: TripDayEntry }>({
    mode: 'create_day_entry', journey_id: journeyId, entry,
  })
  return dayEntry
}

export async function updateTripDayEntry(id: string, patch: TripDayEntryPatch): Promise<TripDayEntry> {
  const { dayEntry } = await invokeWriteJourney<{ dayEntry: TripDayEntry }>({
    mode: 'update_day_entry', id, patch,
  })
  return dayEntry
}

export async function deleteTripDayEntry(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_day_entry', id })
}

// ── Engagement public_view toggle ─────────────────────────────────────────────

export async function setEngagementPublicView(engagementId: string, publicView: boolean): Promise<void> {
  const { error } = await supabase.functions.invoke('travel-write-engagement', {
    body: { mode: 'set_visibility', id: engagementId, public_view: publicView },
  })
  if (error) throw new Error(`travel-write-engagement [set_visibility]: ${error.message}`)
}
// ── Engagement types registry ─────────────────────────────────────────────────
// Single source for all aux booking type dropdowns. Runtime fetch from
// travel_engagement_types — never hardcode the list in the frontend.
// Excludes journey + stay (those are parent/hotel level, not aux bookings).

export type EngagementTypeOption = {
  id:    string
  slug:  string
  label: string
}

export async function fetchEngagementTypes(): Promise<EngagementTypeOption[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', {
    body: { mode: 'engagement_types' },
  })
  if (error) throw new Error(error.message)
  return ((data?.rows ?? []) as EngagementTypeOption[]).filter(
    t => t.slug !== 'journey' && t.slug !== 'stay'
  )
}

// ── House ID for trip ──────────────────────────────────────────────────────────
// Resolves house_id from the first booking on a trip. Used by BriefEditorPage
// to bootstrap the dossier load from a journey_id URL param.

export async function fetchHouseIdForTrip(journeyId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', {
    body: { mode: 'house_id_for_trip', journey_id: journeyId },
  })
  if (error) { console.error('[fetchHouseIdForTrip]', error.message); return null }
  return (data?.houseId as string | null) ?? null
}
