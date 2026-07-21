// queriesAdminJourney.ts
// Trip Dossier query layer - reads travel_bookings, travel_journey,
// travel_partners, travel_accom_hotels for the HouseTab Trip Dossier surface.
// Also owns travel_journey_briefs + travel_booking_rooms + travel_journey_days CRUD.
//
// All column names verified against information_schema S44/S45/S46 pre-flight.
//
// Join path (S45 fix): travel_bookings.houseId -> a_houses (direct FK).
//
// S52 - All read and write paths routed through Edge Functions.
//   travel-read-journey-admin: all 7 read paths.
//   travel-write-journey: journey mutation paths (public_view retired to travel-write-engagement/set_visibility, S53P).
//   No direct supabase table reads or writes remain in this file.
//   supabase (session client) used for all EF calls - JWT attached automatically.
//
// Last updated: S53P - set_public_view retired: setEngagementPublicView now routes to
//   travel-write-engagement/set_visibility (duplicate write eliminated).
//   File pending rename to queriesAdminJourney (Step 2, engagement/journey split).
// 
// Prior: S50 - EngagementBrief gains show_advisor_email. Mirrors migration
//   s50_add_show_advisor_email. Gates advisor_email visibility on public
//   Contacts tab, alongside the existing show_advisor_phone toggle.
// Prior: S48 - EngagementBrief gains 5 new columns: programme_show_images,
//   welcome_letter, show_tab_confirmation, show_tab_programme, show_tab_brief,
//   show_tab_contacts. Mirrors migration s48_trip_page_controls.
// Prior: S48 - url_id added to DossierJourney. Engagement join in fetchJourneyDossierForHouse.
// Prior: S48 - booked_by text added to AdminEngagementElement. AdminEngagementElementPatch added.
// Prior: S47 - booked_by_label text added to BookingRoom (migration S47).
// Prior: S46 - _hotel_image_src added to EngagementBooking.
// Prior: S45 - BookingRoom type; rooms fetch; room CRUD.
// Prior: S44 - initial ship.

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import { computeEngagementStage, type EngagementStage, type EngagementStatusSlug, type BookingInvoice } from '../types/typesImmerse'
import type { ElementBase, ElementPassenger } from '../types/typesElements'
export type { ElementPassenger } from '../types/typesElements'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngagementPartner = {
  id:                string
  name:              string
  partner_type:      string
  defaultSharePct: number | null
  currency:          string | null
  isActive:         boolean
}

export type HouseProfile = {
  id:                 string
  displayName:       string
  salutationRule:    string | null
  travelStyleNotes: string | null
  avoidNotes:        string | null
  serviceNotes:      string | null
}

export type EngagementDestination = {
  id:             string
  destinationId: string
  sortOrder:     number
  slug:           string
  name:           string
  storagePath:   string | null
  heroImageSrc: string | null
}

export type JourneyStep = {
  icon:   string
  label:  string
  detail: string
}

export type EngagementBrief = {
  id:                    string
  journeyId:               string
  houseId:              string | null
  briefTitle:           string | null
  briefSubtitle:        string | null
  preparedFor:          string | null
  heroImageSrc:        string | null
  heroImageAlt:        string | null
  snapshotDestination:  string | null
  snapshotDates:        string | null
  snapshotGuests:       string | null
  snapshotStatus:       string | null
  journeySteps:         JourneyStep[]
  advisorName:          string | null
  advisorEmail:         string | null
  advisorPhone:         string | null
  hotelContactNote:    string | null
  importantNotes:       string[]
  footerTagline:        string | null
  logoVariant:          string | null
  programmeShowImages: boolean
  welcomeLetter:        string | null
  showTabConfirmation: boolean
  showTabProgramme:    boolean
  showTabBrief:        boolean
  showTabContacts:     boolean
  showTabWelcome:      boolean
  showAdvisorPhone:    boolean
  showAdvisorEmail:    boolean
  links:                 { label: string; url: string }[]
  programmeNotes:       string | null
  createdAt:            string
  updatedAt:            string
}

export type JourneyDay = {
  id:         string | null
  journeyId:    string
  entryDate: string
  show:       boolean
  dayLabel:  string | null
  dayNote:   string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type JourneyDayEntry = {
  id:                  string
  journeyId:             string
  entryDate:          string
  startTime:          string | null
  endTime:            string | null
  title:               string
  subtitle:            string | null
  category:            string | null
  bookedBy:           string
  confirmationNumber: string | null
  guestLabel:         string | null
  notes:               string | null
  briefShow:          boolean
  sortOrder:          number
  isAutoDerived:     boolean
  sourceBookingId:   string | null
  sourceAuxId:       string | null
  createdAt:          string
  updatedAt:          string
}

export type JourneyDayPatch      = Partial<Omit<JourneyDay,      'id' | 'journeyId' | 'createdAt' | 'updatedAt'>>
export type JourneyDayEntryPatch = Partial<Omit<JourneyDayEntry, 'id' | 'journeyId' | 'createdAt' | 'updatedAt'>>

export type AdminEngagementElement = ElementBase & {
  booking_type:    string | null                  // admin-only: canonical type slug
  driverDetails?: ElementDriverDetail[]          // admin driver type - includes `company`
}

export type AdminEngagementElementPatch = Partial<Omit<AdminEngagementElement, 'id' | 'journeyId' | 'createdAt' | 'updatedAt'>>

export type ElementDriverDetail = {
  id:            string
  auxBookingId: string
  driverName:   string | null
  driverPhone:  string | null
  carModel:     string | null
  plate:         string | null
  company:       string | null
  vehicleRole:  string | null
  sortOrder:    number
}
export type ElementDriverDetailPatch = Partial<Omit<ElementDriverDetail, 'id' | 'auxBookingId'>>

export type EngagementBriefPatch = Partial<Omit<EngagementBrief, 'id' | 'journeyId' | 'createdAt' | 'updatedAt'>>

export type BookingRoom = {
  id:                  string
  bookingId:          string
  roomName:           string | null
  confirmationNumber: string | null
  guestName:          string | null
  partyComposition:   string | null
  notes:               string | null
  nights:              number | null
  rate:                number | null
  taxPct:             number | null
  total:               number | null
  extraPersonFee:    number | null
  briefImageSrc:     string | null
  additionalGuests:   string[] | null
  personId:           string | null
  checkInTime:       string | null
  beddingType:        string | null
  sortOrder:          number
  createdAt:          string
  updatedAt:          string
  resolvedImageSrc?:         string | null
  resolvedImageAlt?:         string | null
  resolvedGuestName?:        string | null
  resolvedAdditionalGuests?: string[] | null
}

export type BookingRoomPatch = Partial<Omit<BookingRoom, 'id' | 'booking_id' | 'created_at' | 'updated_at'>>

export type EngagementBooking = {
  id:                        string
  journeyId:                   string
  houseId:                  string | null
  engagementId:             string | null
  name:                      string | null
  status:                    string | null
  statusNote:               string | null
  confirmationNumber:       string | null
  startDate:          string | null
  startTime:          string | null
  endDate:            string | null
  checkInDate:       string | null
  checkInNote:       string | null
  checkOutNote:      string | null
  nights:              number | null
  commissionableRate:       number | null
  totalRate:                number | null
  taxesAndFees:            number | null
  currency:                  string | null
  boardBasis:               { displayName: string } | null
  paymentTerms:             { displayName: string } | null
  pricingBasis:             { displayName: string } | null
  rateLabel:                { displayName: string; clientVisible: boolean } | null
  inclusions:                string | null
  inclusionsOverride:       unknown[] | null
  price:                     number | null
  depositAmount:            number | null
  depositDueDate:          string | null
  depositPaidAt:           string | null
  balanceAmount:            number | null
  balanceDueDate:          string | null
  balancePaidAt:           string | null
  commissionPct:            number | null
  commissionAmount:         number | null
  netRevenue:               number | null
  commissionPaidAt:        string | null
  invoiceNumber:            string | null
  iataPartnerId:           string | null
  iataSharePct:            number | null
  iataShareAmt:            number | null
  referralPartnerId:       string | null
  referralSharePct:        number | null
  referralShareAmt:        number | null
  individualId:             string | null
  individualSharePct:      number | null
  individualShareAmt:      number | null
  accomHotelId:            string | null
  supplierId:               string | null
  supplierNameOverride:    string | null
  partyComposition:         string | null
  primaryContactName:      string | null
  primaryContactRole:      string | null
  supplierContactName:     string | null
  supplierContactWhatsapp: string | null
  briefCategory:            string | null
  briefShow:                boolean
  briefImageSrc:           string | null
  bookedBy:                 string | null
  cancellationPolicy:       string | null
  bookingPolicy:            string | null
  notes:                     string | null
  sortOrder:                number | null
  createdAt:                string | null
  updatedAt:                string | null
  // Client-resolved
  _hotel_name:      string | null
  _hotel_image_src: string | null
  _rooms:           BookingRoom[]
  _invoices:        BookingInvoice[]
}

export type DossierJourney = {
  id:                   string
  journeyCode:            string
  stage:                EngagementStage | null   // S53G+ derived from winning engagement
  startDate:           string | null
  endDate:             string | null
  durationNights:      number | null
  tripType:            string | null
  destinations:         EngagementDestination[]
  guestCountAdults:   number | null
  guestCountChildren: number | null
  bookings:             EngagementBooking[]
  brief:                EngagementBrief | null
  urlId:               string | null
}

export type EngagementDossierData = {
  engagements: DossierJourney[]
  partners: Record<string, EngagementPartner>
  house:    HouseProfile | null
}

// ── EF response row types (raw DB shapes returned by the EF) ─────────────────

type TripRow     = { id: string; journeyCode: string; derivedStatusSlug: EngagementStatusSlug | null; startDate: string | null; endDate: string | null; durationNights: number | null; tripType: string | null; guestCountAdults: number | null; guestCountChildren: number | null }
type BookingRow  = Omit<EngagementBooking, '_hotel_name' | '_hotel_image_src' | '_rooms' | '_invoices'>
type HotelEntry  = { name: string; heroImageSrc: string | null }
type BriefRow    = EngagementBrief
type RoomRow     = BookingRoom
type TripDestRow = { id: string; journeyId: string; destinationId: string; sortOrder: number; globalDestinations: { slug: string; name: string; storagePath: string | null; heroImageSrc: string | null } | { slug: string; name: string; storagePath: string | null; heroImageSrc: string | null }[] }
type EngRow      = { journeyId: string; urlId: string }

// ── EF invoke helpers ─────────────────────────────────────────────────────────
// supabase (session client) attaches the JWT automatically on every call.
// Never use supabaseAnon here - these are admin-only operations.

async function invokeReadJourney<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', { body })
  if (error) throw new Error(`travel-read-journey-admin [${body.mode}]: ${error.message}`)
  return camelizeKeys<T>(data)
}

async function invokeWriteJourney<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-journey', { body })
  if (error) throw new Error(`travel-write-journey [${body.mode}]: ${error.message}`)
  return data as T
}

// ── Main dossier query ────────────────────────────────────────────────────────

export async function fetchJourneyDossierForHouse(houseId: string): Promise<EngagementDossierData> {
  const raw = await invokeReadJourney<{
    tripRows:    TripRow[]
    bookingRows: BookingRow[]
    hotelMap:    Record<string, HotelEntry>
    partners:    EngagementPartner[]
    house:       HouseProfile | null
    briefs:      BriefRow[]
    rooms:       RoomRow[]
    dests:       TripDestRow[]
    engagements: EngRow[]
  }>({ mode: 'dossier', houseId: houseId })

  const { tripRows, bookingRows, hotelMap, partners, house, briefs, rooms, dests, engagements } = raw

  if (!tripRows || tripRows.length === 0) return { engagements: [], partners: {}, house: null }

  const partnerMap: Record<string, EngagementPartner> = {}
  for (const p of partners) partnerMap[p.id] = p

  const briefMap = new Map<string, EngagementBrief>()
  for (const br of briefs) briefMap.set(br.journeyId, br)

  const roomsByBooking = new Map<string, BookingRoom[]>()
  for (const r of rooms) {
    if (!roomsByBooking.has(r.bookingId)) roomsByBooking.set(r.bookingId, [])
    roomsByBooking.get(r.bookingId)!.push(r)
  }

  const destsByTrip = new Map<string, EngagementDestination[]>()
  for (const row of dests) {
    if (!destsByTrip.has(row.journeyId)) destsByTrip.set(row.journeyId, [])
    const gdRaw = row.globalDestinations
    const gd = Array.isArray(gdRaw) ? gdRaw[0] : gdRaw
    if (!gd) continue
    destsByTrip.get(row.journeyId)!.push({
      id:             row.id,
      destinationId: row.destinationId,
      sortOrder:     row.sortOrder,
      slug:           gd.slug,
      name:           gd.name,
      storagePath:   gd.storagePath,
      heroImageSrc: gd.heroImageSrc,
    })
  }

  const bookingsByTrip = new Map<string, EngagementBooking[]>()
  for (const b of bookingRows) {
    if (!bookingsByTrip.has(b.journeyId)) bookingsByTrip.set(b.journeyId, [])
    const hotel = b.accomHotelId ? (hotelMap[b.accomHotelId] ?? null) : null
    bookingsByTrip.get(b.journeyId)!.push({
      ...b,
      _hotel_name:      hotel?.name ?? null,
      _hotel_image_src: hotel?.heroImageSrc ?? null,
      _rooms:           roomsByBooking.get(b.id) ?? [],
      _invoices:        [],
    })
  }

  const urlIdByTrip = new Map<string, string>()
  for (const row of engagements) {
    if (!urlIdByTrip.has(row.journeyId)) urlIdByTrip.set(row.journeyId, row.urlId)
  }

  const journeys: DossierJourney[] = tripRows.map(t => ({
    id:                   t.id,
    journeyCode:            t.journeyCode,
    stage:                t.derivedStatusSlug
                            ? computeEngagementStage({ statusSlug: t.derivedStatusSlug })
                            : null,
    startDate:           t.startDate,
    endDate:             t.endDate,
    durationNights:      t.durationNights,
    tripType:            t.tripType,
    destinations:         destsByTrip.get(t.id) ?? [],
    guestCountAdults:   t.guestCountAdults,
    guestCountChildren: t.guestCountChildren,
    bookings:             bookingsByTrip.get(t.id) ?? [],
    brief:                briefMap.get(t.id) ?? null,
    urlId:               urlIdByTrip.get(t.id) ?? null,
  }))

  return { engagements: journeys, partners: partnerMap, house }
}

// ── Brief read ────────────────────────────────────────────────────────────────

export async function fetchJourneyBrief(journeyId: string): Promise<EngagementBrief | null> {
  const { brief } = await invokeReadJourney<{ brief: EngagementBrief | null }>({
    mode: 'brief', journeyId: journeyId,
  })
  return brief
}

// ── Rooms read ────────────────────────────────────────────────────────────────

export async function fetchBookingRooms(bookingId: string): Promise<BookingRoom[]> {
  const { rooms } = await invokeReadJourney<{ rooms: BookingRoom[] }>({
    mode: 'rooms', bookingId: bookingId,
  })
  return rooms
}

// ── Days read ─────────────────────────────────────────────────────────────────

export async function fetchJourneyDays(journeyId: string): Promise<JourneyDay[]> {
  const { days } = await invokeReadJourney<{ days: JourneyDay[] }>({
    mode: 'days', journeyId: journeyId,
  })
  return days
}

// ── Day entries read ──────────────────────────────────────────────────────────

export async function fetchJourneyDayEntries(journeyId: string): Promise<JourneyDayEntry[]> {
  const { dayEntries } = await invokeReadJourney<{ dayEntries: JourneyDayEntry[] }>({
    mode: 'day_entries', journeyId: journeyId,
  })
  return dayEntries
}

// ── Aux bookings read ─────────────────────────────────────────────────────────

export async function fetchAdminEngagementElements(journeyId: string): Promise<AdminEngagementElement[]> {
  const { elements } = await invokeReadJourney<{ elements: AdminEngagementElement[] }>({
    mode: 'aux_bookings', journeyId: journeyId,
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

export async function resolveHouseIdForJourney(journeyId: string): Promise<string | null> {
  const { houseId } = await invokeReadJourney<{ houseId: string | null }>({
    mode: 'house_id_for_journey', journey_id: journeyId,
  })
  return houseId ?? null
}

// ── Brief write ───────────────────────────────────────────────────────────────

export async function upsertEngagementBrief(journeyId: string, houseId: string, patch: EngagementBriefPatch): Promise<EngagementBrief> {
  const { brief } = await invokeWriteJourney<{ brief: EngagementBrief }>({
    mode: 'upsert_brief', journeyId: journeyId, houseId: houseId, patch,
  })
  return brief
}

export async function updateBookingBriefFields(
  bookingId: string,
  patch: { briefCategory?: string | null; briefShow?: boolean; briefImageSrc?: string | null; bookedBy?: string | null },
): Promise<void> {
  await invokeWriteJourney({ mode: 'update_booking_brief', bookingId: bookingId, patch })
}

// Generic booking-field update - update_booking_brief is generic-patch server-side,
// so this writes any travel_bookings column. Returns nothing (EF returns {success}).
export async function updateBookingFields(bookingId: string, patch: Partial<EngagementBooking>): Promise<void> {
  await invokeWriteJourney({ mode: 'update_booking_brief', bookingId: bookingId, patch })
}

// Create a new travel_bookings row on a trip. patch may set any column;
// journey_id is supplied separately (NOT NULL). Returns the raw inserted row
// (without the client-resolved _hotel_name/_hotel_image_src/_rooms fields).
export async function createBooking(
  journeyId: string,
  patch: Partial<Omit<EngagementBooking, 'id' | 'journey_id' | '_hotel_name' | '_hotel_image_src' | '_rooms'>>,
): Promise<Omit<EngagementBooking, '_hotel_name' | '_hotel_image_src' | '_rooms'>> {
  const { booking } = await invokeWriteJourney<{ booking: Omit<EngagementBooking, '_hotel_name' | '_hotel_image_src' | '_rooms'> }>({
    mode: 'create_booking', journeyId: journeyId, patch,
  })
  return booking
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export async function createBookingRoom(bookingId: string, patch: BookingRoomPatch): Promise<BookingRoom> {
  const { room } = await invokeWriteJourney<{ room: BookingRoom }>({
    mode: 'create_room', bookingId: bookingId, patch,
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

export async function createAdminEngagementElement(journeyId: string, patch: AdminEngagementElementPatch): Promise<AdminEngagementElement> {
  const { auxBooking } = await invokeWriteJourney<{ auxBooking: AdminEngagementElement }>({
    mode: 'create_aux_booking', journeyId: journeyId, patch,
  })
  return auxBooking
}

export async function updateAdminEngagementElement(id: string, patch: AdminEngagementElementPatch): Promise<AdminEngagementElement> {
  const { auxBooking } = await invokeWriteJourney<{ auxBooking: AdminEngagementElement }>({
    mode: 'update_aux_booking', id, patch,
  })
  return auxBooking
}

export async function deleteAdminEngagementElement(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_aux_booking', id })
}

// ── Aux passenger write ───────────────────────────────────────────────────────

export type ElementPassengerPatch = Partial<Omit<ElementPassenger, 'id' | 'aux_booking_id'>>

export async function createAuxPassenger(nodeId: string, patch: ElementPassengerPatch): Promise<ElementPassenger> {
  const { auxPassenger } = await invokeWriteJourney<{ auxPassenger: ElementPassenger }>({
    mode: 'create_aux_passenger', node_id: nodeId, patch,
  })
  return auxPassenger
}

export async function updateAuxPassenger(id: string, patch: ElementPassengerPatch): Promise<ElementPassenger> {
  const { auxPassenger } = await invokeWriteJourney<{ auxPassenger: ElementPassenger }>({
    mode: 'update_aux_passenger', id, patch,
  })
  return auxPassenger
}

export async function deleteAuxPassenger(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_aux_passenger', id })
}

// ── Aux driver details write (ground-car vehicles) ────────────────────────────

export async function fetchAuxDriverDetails(auxBookingId: string): Promise<ElementDriverDetail[]> {
  const { driverDetails } = await invokeReadJourney<{ driverDetails: ElementDriverDetail[] }>({
    mode: 'aux_driver_details', node_id: auxBookingId,
  })
  return driverDetails
}

export async function createAuxDriverDetail(auxBookingId: string, patch: ElementDriverDetailPatch): Promise<ElementDriverDetail> {
  const { driverDetail } = await invokeWriteJourney<{ driverDetail: ElementDriverDetail }>({
    mode: 'create_aux_driver_detail', node_id: auxBookingId, patch,
  })
  return driverDetail
}

export async function updateAuxDriverDetail(id: string, patch: ElementDriverDetailPatch): Promise<ElementDriverDetail> {
  const { driverDetail } = await invokeWriteJourney<{ driverDetail: ElementDriverDetail }>({
    mode: 'update_aux_driver_detail', id, patch,
  })
  return driverDetail
}

export async function deleteAuxDriverDetail(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_aux_driver_detail', id })
}

// ── Welcome letters (arrival) ─────────────────────────────────────────────────
// Per room-guest per accommodation. One PDF letter per row, for the hotel to print.

export type EngagementWelcomeLetter = {
  id:         string
  journeyId:    string
  bookingId: string
  roomId:    string | null
  guestName: string
  body:       string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type EngagementWelcomeLetterPatch = Partial<Omit<EngagementWelcomeLetter, 'journeyId' | 'createdAt' | 'updatedAt'>>

export async function fetchEngagementWelcomeLetters(journeyId: string): Promise<EngagementWelcomeLetter[]> {
  const { letters } = await invokeReadJourney<{ letters: EngagementWelcomeLetter[] }>({
    mode: 'welcome_letters', journeyId: journeyId,
  })
  return letters
}

export async function upsertEngagementWelcomeLetter(journeyId: string, letter: EngagementWelcomeLetterPatch): Promise<EngagementWelcomeLetter> {
  const { letter: row } = await invokeWriteJourney<{ letter: EngagementWelcomeLetter }>({
    mode: 'upsert_welcome_letter', journeyId: journeyId, letter,
  })
  return row
}

export async function deleteEngagementWelcomeLetter(id: string): Promise<void> {
  await invokeWriteJourney({ mode: 'delete_welcome_letter', id })
}

// ── Itinerary CRUD ────────────────────────────────────────────────────────────

export async function upsertJourneyDay(journeyId: string, date: string, patch: JourneyDayPatch): Promise<JourneyDay> {
  const { day } = await invokeWriteJourney<{ day: JourneyDay }>({
    mode: 'upsert_day', journeyId: journeyId, entry_date: date, patch,
  })
  return day
}

export async function createJourneyDayEntry(journeyId: string, entry: Omit<JourneyDayEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<JourneyDayEntry> {
  const { dayEntry } = await invokeWriteJourney<{ dayEntry: JourneyDayEntry }>({
    mode: 'create_day_entry', journeyId: journeyId, entry,
  })
  return dayEntry
}

export async function updateJourneyDayEntry(id: string, patch: JourneyDayEntryPatch): Promise<JourneyDayEntry> {
  const { dayEntry } = await invokeWriteJourney<{ dayEntry: JourneyDayEntry }>({
    mode: 'update_day_entry', id, patch,
  })
  return dayEntry
}

export async function deleteJourneyDayEntry(id: string): Promise<void> {
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
// travel_engagement_types - never hardcode the list in the frontend.
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

export type BoardBasisOption  = { id: string; slug: string; displayName: string }
export type PaymentTermOption = { id: string; slug: string; displayName: string }
export type PricingBasisOption = { id: string; slug: string; displayName: string }
export type RateLabelOption   = { id: string; slug: string; displayName: string; clientVisible: boolean }
export type RateReference = {
  boardBases:   BoardBasisOption[]
  paymentTerms: PaymentTermOption[]
  pricingBases: PricingBasisOption[]
  rateLabels:   RateLabelOption[]
}
export async function fetchRateReference(): Promise<RateReference> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', {
    body: { mode: 'rate_reference' },
  })
  if (error) throw new Error(error.message)
  return {
    boardBases:   data?.board_bases   ?? [],
    paymentTerms: data?.paymentTerms ?? [],
    pricingBases: data?.pricing_bases ?? [],
    rateLabels:   data?.rate_labels   ?? [],
  }
}
// ── House ID for trip ──────────────────────────────────────────────────────────
// Resolves house_id from the first booking on a trip. Used by BriefEditorPage
// to bootstrap the dossier load from a journey_id URL param.

export async function fetchHouseIdForTrip(journeyId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', {
    body: { mode: 'house_id_for_trip', journeyId: journeyId },
  })
  if (error) { console.error('[fetchHouseIdForTrip]', error.message); return null }
  return (data?.houseId as string | null) ?? null
}
