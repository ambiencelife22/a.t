// typesElements.ts - Canonical aux booking + day-entry display registry.
//
// What it owns:
//   - ELEMENT_TYPE_META + getElementTypeMeta (icon + display meta, slug-keyed)
//   - FLIGHT_BOOKING_TYPES + isFlightType
//   - CABIN_CLASSES + SEAT_TYPES (includes 'Mixed')
//   - AIRCRAFT_TYPES - curated registry (commercial + private aviation).
//     Dropdown-only, no free-text fallback. Anything missing gets added
//     to this file. Data integrity compounds; curated lists are how
//     enterprise platforms keep reference data clean over years.
//   - CATEGORY_ACCENT + getCategoryAccent
//   - Booking type predicates (isFlightElement, isHotelElement, etc.)
//
// What it does not own:
//   - Supplier identity / commission terms (see typesSuppliers.ts)
//   - Booking lifecycle status (see typesEventStatus.ts)
//   - DB queries, UI rendering
//   - The canonical type list itself - that lives in travel_engagement_types
//     (DB registry). This file holds only DISPLAY meta (icons) the registry
//     does not carry. Type labels + sortOrder come from the registry via the
//     EF (elementTypeLabel); META is keyed by registry SLUG.
//
// Source of truth for:
//   - travel_engagement_aux_bookings.cabinClass CHECK constraint
//   - travel_engagement_aux_bookings.seat_type CHECK constraint
//   - travel_engagement_aux_bookings.aircraftType display values
//   - travel_journey_day_entries.category accent tokens
//
// S53H: realigned to the 18-type slug registry (travel_engagement_types).
//   booking_type is a SLUG everywhere (S53G). META re-keyed Title-Case -> slug;
//   getElementTypeMeta casing bug fixed (was lowercasing a Title-keyed map -> every
//   lookup fell through). Predicates rewritten to compare SLUGS (isHotelElement
//   = 'stay', isFlightElement = flight/private_jet, ground = transfer/
//   airport_transfer/car_service). Curated aircraft/cabin/seat lists untouched.
// Prior: S50 - AIRCRAFT_TYPES curated registry added (~75 entries). SEAT_TYPES
//   gains 'Mixed'. Aircraft is dropdown-only.
// Prior: S50 - consolidated from legacy typesAuxBooking.ts (deleted).

// ── Metadata registry - keyed by DB registry SLUG ─────────────────────────────
// The 18-type registry (travel_engagement_types) is the source of truth for
// labels + sortOrder; this map adds the one thing the registry lacks: an icon.
// Keyed by slug so a slug-or-label input both resolve. journey/reservation/
// arrangement/acquisition are non-movement types but carry icons for any surface
// that renders them.

export interface ElementTypeMeta {
  label:      string
  icon:       string
  sortOrder: number
  section:    string   // guest-facing grouping key - slugs sharing a section fold together
}

// section: the guest-facing grouping. Slugs that are the same guest concept share
// a section so they render under ONE heading (a resort-to-resort chauffeured car
// is the same whether typed 'transfer' or 'car_service'). sortOrder drives BOTH
// within-section item order and section order (min sortOrder in a section wins).
const ELEMENT_TYPE_META: Record<string, ElementTypeMeta> = {
  acquisition:      { label: 'ACQUISITION',       icon: '\uD83D\uDD11', sortOrder: 55,  section: 'acquisition' },
  airport_transfer: { label: 'CAR SERVICES & TRANSFERS', icon: '\uD83D\uDE98', sortOrder: 7,  section: 'ground_car' },
  meet_greet:       { label: 'AIRPORT MEET & GREET', icon: '\uD83E\uDEAA', sortOrder: 5, section: 'airport' },
  arrangement:      { label: 'ARRANGEMENTS',      icon: '\u00b7',       sortOrder: 56,  section: 'arrangement' },
  car_rental:       { label: 'CAR RENTAL',        icon: '\uD83D\uDE99', sortOrder: 44,  section: 'car_rental' },
  car_service:      { label: 'CAR SERVICES & TRANSFERS', icon: '\uD83D\uDE98', sortOrder: 7, section: 'ground_car' },
  transfer:         { label: 'CAR SERVICES & TRANSFERS', icon: '\uD83D\uDE98', sortOrder: 7, section: 'ground_car' },
  cruise:           { label: 'CRUISE',            icon: '\uD83D\uDEA2', sortOrder: 66,  section: 'cruise' },
  dining:           { label: 'DINING',            icon: '\uD83C\uDF7D', sortOrder: 11,  section: 'dining' },
  experience:       { label: 'EXPERIENCES',       icon: '\u2728',       sortOrder: 15,  section: 'experience' },
  flight:           { label: 'FLIGHTS',           icon: '\u2708',       sortOrder: 0,  section: 'flight' },
  heli_transfer:    { label: 'HELICOPTER',        icon: '\uD83D\uDE81', sortOrder: 77, section: 'heli' },
  journey:          { label: 'JOURNEY',           icon: '\uD83E\uDDED', sortOrder: 88, section: 'journey' },
  private_jet:      { label: 'PRIVATE AVIATION',  icon: '\u2708',       sortOrder: 1, section: 'private_jet' },
  public_transport: { label: 'RAIL & TRANSIT',    icon: '\uD83D\uDE86', sortOrder: 99, section: 'rail' },
  reservation:      { label: 'RESERVATION',       icon: '\uD83D\uDCC5', sortOrder: 19, section: 'reservation' },
  spa_wellness:     { label: 'SPA & WELLNESS',    icon: '\uD83E\uDDD6', sortOrder: 20, section: 'spa_wellness' },
  stay:             { label: 'STAYS',             icon: '\uD83C\uDFE8', sortOrder: 10, section: 'stay' },
  tour:             { label: 'TOURS',             icon: '\uD83D\uDDFA', sortOrder: 48, section: 'tour' },
  yacht_charter:    { label: 'YACHT CHARTER',     icon: '\u26F5',       sortOrder: 22, section: 'yacht' },
  other:            { label: 'OTHER',             icon: '\u00b7',       sortOrder: 99, section: 'other' },
}

// Client-facing section grouping. Admin tracks every slug separately (a pre-booked
// transfer vs a daily chauffeur are different logistics). The GUEST sees a car
// point-to-point as one thing, so transfer + car_service collapse to one section
// client-side. Every other slug is its own section (falls through to its meta).
const CLIENT_SECTION_SLUG: Record<string, string> = {
  transfer:    'car_service',
  car_service: 'car_service',
}
export function clientSectionKey(slug: string | null | undefined): string {
  const s = slug ?? 'other'
  return CLIENT_SECTION_SLUG[s] ?? s
}

// Normalize a slug OR a Title Case label to a registry slug. Accepts both so
// callers passing booking_type (slug) or elementTypeLabel (Title Case) both
// resolve. 'Airport Transfer' -> 'airport_transfer', 'flight' -> 'flight'.
function toSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/]+/g, '_')
}

export function getElementTypeMeta(bookingType: string | null | undefined): ElementTypeMeta {
  if (!bookingType) return ELEMENT_TYPE_META.other
  const slug = toSlug(bookingType)
  const known = ELEMENT_TYPE_META[slug]
  if (known) return known
  // Unknown type: derive a display label, no icon, sort last.
  const label = bookingType.toUpperCase() + (bookingType.endsWith('s') ? '' : 'S')
  return { label, icon: '\u00b7', sortOrder: 99, section: 'other' }
}

// ── Section grouping - single source ──────────────────────────────────────────
// ConfirmationTab, BriefAuxEditor, and BriefPreview all render aux bookings as
// ordered, typed sections. This is the one implementation. Filters briefShow,
// sorts by registry sortOrder then row sortOrder, folds consecutive same-slug
// bookings into a single section. Keyed on the canonical slug (booking_type),
// never the display label. Generic over the row type so each surface can pass its
// own aux shape as long as it carries booking_type, briefShow, and sortOrder.

export interface ElementSection<T> {
  type:  string   // registry slug
  label: string
  icon:  string
  items: T[]
}

export function groupElementsBySection<T extends { elementType: string | null; briefShow?: boolean; sortOrder: number }>(
  elements: T[],
): ElementSection<T>[] {
  const sorted = elements
    .filter(a => a.briefShow !== false)
    .sort((a, b) => {
      const ma = getElementTypeMeta(a.elementType)
      const mb = getElementTypeMeta(b.elementType)
      if (ma.sortOrder !== mb.sortOrder) return ma.sortOrder - mb.sortOrder
      const aKey = `${(a as any).startDate ?? ''}${(a as any).startTime ?? ''}`
      const bKey = `${(b as any).startDate ?? ''}${(b as any).startTime ?? ''}`
      if (aKey !== bKey) return aKey < bKey ? -1 : 1
      return a.sortOrder - b.sortOrder
    })

  const sections: ElementSection<T>[] = []
  for (const aux of sorted) {
    const meta = getElementTypeMeta(aux.elementType ?? 'other')
    const last = sections[sections.length - 1]
    if (last && last.type === meta.section) {
      last.items.push(aux)
      continue
    }
    sections.push({ type: meta.section, label: meta.label, icon: meta.icon, items: [aux] })
  }
  return sections
}

// ── Flight-specific gate ──────────────────────────────────────────────────────
// Slug-based. flight + private_jet are the aviation movement types.

export const FLIGHT_BOOKING_TYPES: ReadonlySet<string> = new Set([
  'flight',
  'private_jet',
])

export function isFlightType(bookingType: string | null | undefined): boolean {
  return FLIGHT_BOOKING_TYPES.has(toSlug(bookingType ?? ''))
}

// ── Cabin classes ─────────────────────────────────────────────────────────────

export const CABIN_CLASSES = [
  'Economy',
  'Economy Extra',
  'Premium Economy',
  'Business',
  'First',
  'Private / Charter',
] as const

export type CabinClass = typeof CABIN_CLASSES[number]

// ── Seat types ────────────────────────────────────────────────────────────────
// 'Mixed' covers parties where seats vary (e.g. 2 Window + 1 Aisle).

export const SEAT_TYPES = [
  'Window',
  'Middle',
  'Aisle',
  'Mixed',
] as const

export type SeatType = typeof SEAT_TYPES[number]

// ── Aircraft types - commercial ───────────────────────────────────────────────
// Grouped by manufacturer, alphabetical within group.

export const AIRCRAFT_TYPES_COMMERCIAL = [
  'Airbus A220-100',
  'Airbus A220-300',
  'Airbus A319',
  'Airbus A320',
  'Airbus A320neo',
  'Airbus A321',
  'Airbus A321neo',
  'Airbus A321LR',
  'Airbus A321XLR',
  'Airbus A330-200',
  'Airbus A330-300',
  'Airbus A330-900neo',
  'Airbus A340-300',
  'Airbus A340-600',
  'Airbus A350-900',
  'Airbus A350-1000',
  'Airbus A380-800',

  'Boeing 737-700',
  'Boeing 737-800',
  'Boeing 737 MAX 8',
  'Boeing 737 MAX 9',
  'Boeing 747-400',
  'Boeing 747-8',
  'Boeing 757-200',
  'Boeing 767-300',
  'Boeing 777-200',
  'Boeing 777-200LR',
  'Boeing 777-300',
  'Boeing 777-300ER',
  'Boeing 787-8',
  'Boeing 787-9',
  'Boeing 787-10',

  'Embraer E170',
  'Embraer E175',
  'Embraer E190',
  'Embraer E195',
  'Embraer E195-E2',
] as const

export type AircraftTypeCommercial = typeof AIRCRAFT_TYPES_COMMERCIAL[number]

// ── Aircraft types - private aviation ─────────────────────────────────────────
// Curated by class - Light, Midsize, Super-Midsize, Heavy, Ultra-Long-Range,
// VIP airliner. Covers the operators most commonly seen in HRH-grade design.

export const AIRCRAFT_TYPES_PRIVATE = [
  // Light Jet
  'Cessna Citation CJ3+',
  'Cessna Citation CJ4',
  'Embraer Phenom 100EV',
  'Embraer Phenom 300E',
  'Learjet 75 Liberty',
  'Pilatus PC-24',

  // Midsize Jet
  'Bombardier Challenger 350',
  'Cessna Citation Latitude',
  'Cessna Citation XLS+',
  'Embraer Praetor 500',
  'Hawker 800XP',
  'Hawker 900XP',

  // Super-Midsize Jet
  'Bombardier Challenger 3500',
  'Cessna Citation Longitude',
  'Cessna Citation Sovereign+',
  'Embraer Praetor 600',
  'Gulfstream G280',

  // Heavy Jet
  'Bombardier Challenger 605',
  'Bombardier Challenger 650',
  'Dassault Falcon 900LX',
  'Dassault Falcon 2000LXS',
  'Gulfstream G450',
  'Gulfstream G500',
  'Gulfstream G550',

  // Ultra-Long-Range
  'Bombardier Global 6000',
  'Bombardier Global 7500',
  'Bombardier Global 8000',
  'Dassault Falcon 7X',
  'Dassault Falcon 8X',
  'Dassault Falcon 10X',
  'Gulfstream G600',
  'Gulfstream G650',
  'Gulfstream G650ER',
  'Gulfstream G700',
  'Gulfstream G800',

  // VIP airliner / bizliner
  'Airbus ACJ319',
  'Airbus ACJ320neo',
  'Boeing BBJ 737',
  'Boeing BBJ 787',
] as const

export type AircraftTypePrivate = typeof AIRCRAFT_TYPES_PRIVATE[number]

// ── Combined registry ─────────────────────────────────────────────────────────

export interface AircraftGroup {
  label:   string
  options: readonly string[]
}

export const AIRCRAFT_TYPE_GROUPS: AircraftGroup[] = [
  { label: 'Commercial',         options: AIRCRAFT_TYPES_COMMERCIAL },
  { label: 'Private Aviation',   options: AIRCRAFT_TYPES_PRIVATE },
]

export const AIRCRAFT_TYPES: readonly string[] = [
  ...AIRCRAFT_TYPES_COMMERCIAL,
  ...AIRCRAFT_TYPES_PRIVATE,
]

export type AircraftType = AircraftTypeCommercial | AircraftTypePrivate

export function isKnownAircraftType(value: string | null | undefined): boolean {
  if (!value) return false
  return AIRCRAFT_TYPES.includes(value)
}

// ── Category accent colours ───────────────────────────────────────────────────
// Keyed by registry slug. getCategoryAccent normalizes input to a slug, so a
// label or a slug both resolve.

export const CATEGORY_ACCENT: Record<string, string> = {
  flight:           '#93C5FD',
  private_jet:      '#93C5FD',
  transfer:         '#A3E635',
  airport_transfer: '#A3E635',
  car_service:      '#A3E635',
  car_rental:       '#A3E635',
  heli_transfer:    '#93C5FD',
  public_transport: '#A3E635',
  stay:             '#C9A84C',
  cruise:           '#67E8F9',
  yacht_charter:    '#67E8F9',
  dining:           '#F9A8D4',
  experience:       '#C4B5FD',
  tour:             '#C4B5FD',
  acquisition:      '#FDE68A',
  reservation:      '#B4AFA5',
  spa_wellness:     '#C4B5FD',
  arrangement:      '#B4AFA5',
  journey:          '#B4AFA5',
  meet_greet:       '#A3E635',
  note:             '#B4AFA5',
  other:            '#B4AFA5',
}

export function getCategoryAccent(category: string | null | undefined): string {
  if (!category) return CATEGORY_ACCENT.other
  return CATEGORY_ACCENT[toSlug(category)] ?? CATEGORY_ACCENT.other
}

// ── Booking type predicates - single source ───────────────────────────────────
// All booking_type checks across the codebase must use these. Never inline
// string comparisons or .includes() checks on booking_type values.
// Slug-based (S53G): booking_type is a registry slug. Accepts slug or label via
// toSlug normalization, so a stray Title Case value still resolves correctly.

export function isFlightElement(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'flight' || t === 'private_jet'
}

export function isTransferElement(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'transfer' || t === 'airport_transfer' || t === 'car_service'
}

export function isHotelElement(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'stay' || t === 'hotel' || t === 'accommodation'
}

export function isGroundTransportElement(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'transfer' || t === 'airport_transfer' || t === 'car_service'
}

// Venue reservations: dining and reservation share one detail shape
// (travel_engagement_reservation_detail) and one guest treatment. Both are a
// table held at a venue, so both belong to this family - matching only 'dining'
// silently dropped every reservation-typed booking from the brief.
export function isDiningElement(bookingType: string | null | undefined): boolean {
  const t = toSlug(bookingType ?? '')
  return t === 'dining' || t === 'reservation'
}

export function isMeetGreetElement(bookingType: string | null | undefined): boolean {
  return toSlug(bookingType ?? '') === 'meet_greet'
}

// ── Canonical element shape ───────────────────────────────────────────────────
// ONE source for the element field block shared by the client (EngagementElement)
// and admin (AdminEngagementElement) surfaces. Each composes this base and adds
// only what is genuinely surface-specific: admin adds booking_type + the with-
// `company` driver type; the client uses the no-`company` driver type (a deliberate
// boundary - operator-internal fields never reach the guest). Passenger is shared.
// scheduleStatus lives here so it is defined ONCE, not copied per surface.
export type ElementPassenger = {
  id:                        string
  auxBookingId:            string
  personId:                 string | null
  passengerLabel:           string | null
  confirmationNumber:       string | null
  seatNumbers:              string | null
  sortOrder:                number
  resolvedPassengerLabel?: string | null
}
export type ElementPassengerPatch = Partial<Omit<ElementPassenger, 'id' | 'auxBookingId'>>

export type ElementBase = {
  id:                  string
  journeyId:          string
  engagementTypeId:  string | null
  elementType:        string | null
  elementTypeLabel:  string | null
  name:                string | null
  startDate:          string | null
  startTime:          string | null
  endDate:            string | null
  endTime:            string | null
  origin:              string | null
  destination:         string | null
  departTerminal:      string | null
  arriveTerminal:      string | null
  notes:               string | null
  confirmationNumber: string | null
  bookedBy:           string | null
  guestName:          string | null
  resolvedGuestName:  string | null
  guestCount:         number | null
  contactName:        string | null
  contactPhone:       string | null
  diningStatus:                string | null
  packageName:                 string | null
  pricePerPerson:              number | null
  currency:                    string | null
  packageInclusions:           string[] | null
  schedule:                    Array<{ time: string | null; title: string | null; detail: string[] | null }> | null
  cancellationPenaltyApplied: boolean | null
  cancellationNote:            string | null
  showCancellation:            boolean | null
  scheduleStatus?:             string | null
  originalStartTime?:         string | null
  originalEndTime?:           string | null
  scheduleNote?:               string | null
  venue?: {
    address:         string | null
    mapsUrl:        string | null
    phone:           string | null
    dressCode:      string | null
    childrenPolicy: string | null
    tableHoldNote: string | null
    bookingTerms:   string | null
  } | null
  briefShow:          boolean
  sortOrder:          number
  supplierId:         string | null
  airlineName:        string | null
  flightNumber:       string | null
  departAirport:      string | null
  arriveAirport:      string | null
  cabinClass:         string | null
  aircraftType:       string | null
  tailNumber?:        string | null
  flightTime?:        string | null
  distanceNm?:        number | null
  departFboName?:    string | null
  departFboAddress?: string | null
  departFboPhone?:   string | null
  arriveFboName?:    string | null
  arriveFboAddress?: string | null
  arriveFboPhone?:   string | null
  crew?:               { name: string; role: string }[]
  
  imageSrc?:          string | null
  passengers?:         ElementPassenger[]
  createdAt:          string
  updatedAt:          string
}