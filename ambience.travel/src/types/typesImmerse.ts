// typesImmerse.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for engagement overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
//
// Last updated: S53B Closing+1 — ImmerseHeroProps moved here from inline
//   declaration in ImmerseHero.tsx, per standing rule: renderers render,
//   types files own data and types.
// Prior: S53B Closing+1 — heroEyebrowOverride added to ImmerseDestinationRow.
// Prior: S53B Closing — heroEyebrowOverride added to ImmerseEngagementData.
// Prior: S48 — EngagementStage added as a first-class computed property
//   on ImmerseEngagementData.
// Prior: S42 Add 3 — resort_map_src added to ImmerseHotelOption.

export type EngagementAudience =
  | 'private'
  | 'public'

export type EngagementStatusSlug =
    | 'requested'
    | 'quoted'
    | 'pending'
    | 'confirmed'
    | 'paid'
    | 'in_service'
    | 'closed_won'
    | 'cancelled'
    | 'closed_lost'

export type ItineraryStatusSlug =
  | 'draft'
  | 'initial_proposal'
  | 'refined_proposal'
  | 'final_proposal'
  | 'partially_confirmed'
  | 'confirmed'
  | 'in_travel'
  | 'completed'
  | 'cancelled'
  | 'archived'

export interface EngagementStatus {
  id:        string
  slug:      string
  label:     string
  sortOrder: number
  isActive:  boolean
}

export interface ItineraryStatus {
  id:        string
  slug:      string
  label:     string
  sortOrder: number
  isActive:  boolean
}

// ─── Shared primitives ────────────────────────────────────────────────────────

export type ImmerseRoomOption = {
  tierLabel:                  string
  levelLabel:                 string
  roomBasis:                  string
  roomBenefits:               string[]
  roomImageSrc:               string
  roomImageAlt:               string
  roomGallery?:               string[]
  floorplanSrc?:              string
  publicNightlyRate?:         string
  nonNegotiatedNightlyRate?:  string
  ambienceNightlyRate?:       string
  taxInclusive?:              boolean
  rateSuffix?:                string
  rateCadence?:               string
  taxTreatment?:              string   // S53C — resolved tax_treatments.label
  roomAlert?:                 string   // S53C — per-booking alert message
  roomAlertLevel?:            string   // S53C — info | warning | pending
  roomId?:                    string   // S53C — catalog room id (for connection matching)
  overlayId?:                 string   // S53C — overlay row id (unique per offer; canon room may repeat)
  connectedOverlayId?:        string   // S53C — overlay id of connecting partner offer (per-offer connection)
  connectedRoomId?:           string   // S53C — catalog id of connecting partner room
  connectingNote?:            string   // S53C — connection descriptor (e.g. private entryway)
  sqftMin?:                   number
  sqftMax?:                   number
  sqmMin?:                    number
  sqmMax?:                    number
}

export type ImmerseHotelOption = {
  id:             string
  storageSlug:    string
  rank:           'primary' | 'secondary'
  rankLabel:      string
  name:           string
  bullets:        string[]
  imageSrc:       string
  imageAlt:       string
  stayLabel:      string
  rooms:          ImmerseRoomOption[]
  gallery?:       string[]
  imageCredit?:   string
  imageCreditUrl?: string
  imageLicense?:  string
  resortMapSrc?:  string
  michelinKeys?:  number   // S53C — canon travel_accom_hotels.michelin_keys (1-3)
}

export type ImmerseContentCard = {
  id:              string
  kicker:          string
  name:            string
  tagline:         string
  body:            string
  bulletsHeading?: string
  bullets?:        string[]
  imageSrc:        string
  imageAlt:        string
  imageCredit?:    string
  imageCreditUrl?: string
  imageLicense?:   string
}

export type ImmersePricingRow = {
  id:              string
  item:            string
  basis:           string
  stay:            string
  indicativeRange: string
  isTotal?:        boolean
}

export type ImmersePricingNote = {
  text:        string
  highlighted: boolean
}

export type ImmersePricingCloser = {
  item:            string | null
  basis:           string | null
  stay:            string | null
  indicativeRange: string | null
}

export type ImmerseWelcomeLetter = {
  eyebrow:     string
  title:       string
  body:        string
  signoffBody: string
  signoffName: string
}

// ─── Region grouping ──────────────────────────────────────────────────────────

export type ImmerseRegionGroup = {
  regionId:      string
  slug:          string
  title:         string
  shorthand?:    string
  rank:          'primary' | 'secondary'
  rankLabel:     string
  bullets:       string[]
  stayLabel:     string
  heroImageSrc?: string
  heroImageAlt?: string
  regionGallery?: string[]
  hotels:        ImmerseHotelOption[]
}

export type ImmerseDestinationHotelsShape =
  | { kind: 'flat';     hotels: ImmerseHotelOption[] }
  | { kind: 'regioned'; regions: ImmerseRegionGroup[] }

// ─── Engagement overview ──────────────────────────────────────────────────────

export type ImmerseSubpageStatus = 'live' | 'preview' | 'hidden'

export type ImmerseRouteStop = {
  id:               string
  title:            string
  stayLabel:        string
  note:             string
  imageSrc:         string
  imageAlt:         string
  destinationSlug?: string | null
  anchorId?:        string
  destinationRowId?: string | null
  nights?:          number   // S53C — explicit night count (stayLabel = date range)
}

export type ImmerseDestinationRow = {
  id:                  string
  numberLabel:         string
  title:               string
  mood:                string
  summary:             string
  imageSrc:            string
  imageAlt:            string
  stayLabel:           string
  nights?:             number   // S53C — explicit night count
  destinationSlug?:    string | null
  destinationUrlSlug?: string | null
  anchorId?:           string
  subpageStatus:       ImmerseSubpageStatus
  heroEyebrowOverride?: string    // S53B Closing+1 — per-destination_row eyebrow
}

export type ImmerseTripPricingRow = {
  id:               string
  destination:      string
  recommendedBasis: string
  stayLabel:        string
  indicativeRange:  string
}

// ─── Engagement stage ─────────────────────────────────────────────────────────
// MISSION: stage is a pure function of DECLARED engagement status. No inference
// from content presence. The status slug is the single source of truth; the
// operator edits it; the stage follows. (S55 — removed hasProposalContent /
// hasTripContent inference, which violated single-source and misread completed
// engagements whose content keyed elsewhere.)

export type EngagementStage =
  | 'draft'
  | 'proposal'
  | 'trip'
  | 'completed'
  | 'cancelled'

export type EngagementStageInputs = {
  statusSlug: EngagementStatusSlug
}

export function computeEngagementStage(input: EngagementStageInputs): EngagementStage {
  switch (input.statusSlug) {
    case 'cancelled':
    case 'closed_lost':
      return 'cancelled'

    case 'closed_won':
      return 'completed'

    case 'confirmed':
    case 'paid':
    case 'in_service':
      return 'trip'

    case 'quoted':
    case 'pending':
      return 'proposal'

    case 'requested':
      return 'draft'
  }
}

// ─── Engagement data ─────────────────────────────────────────────────────────

export type ImmerseEngagementData = {
  engagementId:    string
  audience:        EngagementAudience
  urlId:           string
  slug:            string
  journeyTypes:    string[]
  clientName:      string
  statusLabel:     string
  stage:           EngagementStage
  proposalVisibility: 'active' | 'archived'
  heroTagline?:    string
  heroEyebrowOverride?: string
  engagementStatus:  EngagementStatus
  itineraryStatus:   ItineraryStatus
  welcomeLetter:   ImmerseWelcomeLetter
  eyebrow:         string
  title:           string
  subtitle:        string
  heroImageSrc:    string
  heroImageAlt:    string
  heroImageSrc2?:  string
  heroImageAlt2?:  string
  heroTitle2?:     string
  heroSubtitle2?:  string
  heroPills:       string[]
  routeHeading:    string
  routeBody:       string
  routeEyebrow?:   string
  routeStops:      ImmerseRouteStop[]
  destinationHeading:   string
  destinationSubtitle?: string
  destinationBody?:     string
  destinationRows:      ImmerseDestinationRow[]
  pricingHeading:      string
  pricingTitle:        string
  pricingBody:         string
  pricingRows:         ImmerseTripPricingRow[]
  pricingTotalLabel:   string
  pricingTotalValue:   string
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        ImmersePricingNote[]
}

// ─── Destination subpage ──────────────────────────────────────────────────────

export type ImmerseDestinationData = {
  destinationId:   string
  destinationSlug: string
  journeyId:       string
  shorthand?:      string
  eyebrow:         string
  title:           string
  subtitle:        string
  heroImageSrc:    string
  heroImageAlt:    string
  heroImageSrc2?:  string
  heroImageAlt2?:  string
  heroTitle2?:     string
  heroSubtitle2?:  string
  heroPills:       string[]
  introEyebrow:    string
  introTitle:      string
  introBody:       string
  hotelsEyebrow:   string
  hotelsTitle:     string
  hotelsBody:      string
  hotels:          ImmerseDestinationHotelsShape
  diningEyebrow:   string
  diningTitle:     string
  diningBody:      string
  dining:          ImmerseContentCard[]
  experiencesEyebrow: string
  experiencesTitle:   string
  experiencesBody:    string
  experiences:        ImmerseContentCard[]
  pricingEyebrow:      string
  pricingTitle:        string
  pricingBody:         string
  pricingRows:         ImmersePricingRow[]
  pricingCloser:       ImmersePricingCloser
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        ImmersePricingNote[]
}

// ─── Component prop types ────────────────────────────────────────────────────
// Renderer prop contracts. Live here per standing rule:
// renderers render, types files own data and types.

export type ImmerseHeroProps = {
  // Personalisation
  guestName:       string
  titlePrefix?:    string   // renders in Cormorant Garamond italic — e.g. "Honeymoon in"
  dateLabel?:      string   // renders in gold below title — e.g. "January 2027"
  nightsLabel?:    string   // appended to dateLabel with · separator — e.g. "5–6 Nights"
  itineraryStage?: string   // small italic line — e.g. "Refined Proposal"

  // Content
  title:           string
  subtitle:        string
  pills?:          string[]
  heroImageSrc:    string
  heroImageAlt:    string

  // CTAs
  primaryHref?:    string
  primaryLabel?:   string
  diningHref?:     string   // optional third CTA — "Dining + Experiences"
  diningLabel?:    string
  secondaryHref?:  string
  secondaryLabel?: string
}

// ─── Engagement admin WRITES (travel-write-engagement EF, S54) ────────────────
// Write-side contracts for the 8 EF modes. Reuses the slug unions + enums above.
// Payloads are snake_case: they map 1:1 to DB columns the EF writes, NOT to the
// camelCase view-model (ImmerseEngagementData). Keep the two shapes distinct.

export type EngagementWriteMode =
  | 'create_engagement'
  | 'update_engagement'
  | 'set_engagement_status'
  | 'set_itinerary_status'
  | 'reorder'
  | 'set_visibility'
  | 'update_welcome_letter'
  | 'archive'

// Editable scalar columns (create + update). Mirrors EDITABLE_SCALARS in the EF.
export interface EngagementWritableFields {
  title:                          string | null
  audience:                       EngagementAudience
  journey_types:                  string[]
  iteration_label:                string
  trip_id:                        string | null
  person_id:                      string | null
  slug:                           string | null
  status_label:                   string | null
  eyebrow:                        string | null
  hero_tagline:                   string | null
  subtitle:                       string | null
  hero_image_src:                 string | null
  hero_image_alt:                 string | null
  hero_image_src_2:               string | null
  hero_image_alt_2:               string | null
  hero_title_2:                   string | null
  hero_subtitle_2:                string | null
  hero_pills:                     string[]
  hero_eyebrow_override:          string | null
  welcome_eyebrow_override:       string | null
  welcome_title_override:         string | null
  welcome_body_override:          string | null
  welcome_signoff_body_override:  string | null
  welcome_signoff_name_override:  string | null
  route_heading:                  string | null
  route_body:                     string | null
  route_eyebrow:                  string | null
  destination_heading:            string | null
  destination_subtitle:           string | null
  destination_body:               string | null
  pricing_heading:                string | null
  pricing_title:                  string | null
  pricing_body:                   string | null
  pricing_total_label:            string | null
  pricing_total_value:            string | null
  pricing_notes_heading:          string | null
  pricing_notes_title:            string | null
  pricing_notes:                  ImmersePricingNote[]
  public_journey_slug:            string | null
}

export type EngagementPatch = Partial<EngagementWritableFields>

export interface CreateEngagementInput {
  engagement?:             EngagementPatch
  engagement_status_slug?: EngagementStatusSlug   // default 'requested'
  itinerary_status_slug?:  ItineraryStatusSlug    // default 'draft'
}

export interface ReorderItem {
  id:         string
  sort_order: number
}

export interface WelcomeLetterPatch {
  eyebrow?:      string
  title?:        string
  body?:         string
  signoff_body?: string
  signoff_name?: string
}

// Terminal engagement status for archive (itinerary always → 'archived').
export type ArchiveEngagementSlug = Extract<EngagementStatusSlug, 'cancelled' | 'closed_lost'>

// ─── Trip client surface (confirmation / programme / brief) ───────────────────
// Client-owned contracts for the /immerse/ trip pages. ONE-WAY RULE: client files
// import these; they NEVER import from queriesAdminTrip. These intentionally OMIT
// ambience's margin (commission_*, net_revenue, commissionable_rate, invoice_number,
// iata/referral/individual shares) — a client type must not even DESCRIBE the agency's
// profit. The client's-own-bill fields (price, rates, taxes, deposit/balance) ARE kept;
// each surface decides what it renders. (Phase 1, S53F. Phase 2 will make the admin
// types extend these as base & margin so there's a single definition.)

export type ImmerseTripDestination = {
  id:             string
  destination_id: string
  sort_order:     number
  slug:           string
  name:           string
  storage_path:   string | null
  hero_image_src: string | null
}

export type ImmerseJourneyStep = {
  icon:   string
  label:  string
  detail: string
}

export type ImmerseTripHouse = {
  id:                 string
  display_name:       string
  salutation_rule:    string | null
  travel_style_notes: string | null
  avoid_notes:        string | null
  service_notes:      string | null
}

export type ImmerseTripBrief = {
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
  journey_steps:         ImmerseJourneyStep[]
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

export type ImmerseTripDay = {
  id:         string | null
  trip_id:    string
  entry_date: string
  show:       boolean
  day_label:  string | null
  day_note:   string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ImmerseTripDayEntry = {
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

export type ImmerseTripAuxPassenger = {
  id:                        string
  aux_booking_id:            string
  person_id:                 string | null
  passenger_label:           string | null
  confirmation_number:       string | null
  seat_numbers:              string | null
  sort_order:                number
  resolved_passenger_label?: string | null
}

// Driver detail: client-safe. `company` (operator-internal) deliberately OMITTED —
// matches attachDriverDetails in _shared/names.ts which never sends it client-side.
export type ImmerseTripAuxDriverDetail = {
  id:             string
  aux_booking_id: string
  driver_name:    string | null
  driver_phone:   string | null
  car_model:      string | null
  plate:          string | null
  vehicle_role:   string | null
  sort_order:     number
}

export type ImmerseTripAuxBooking = {
  id:                  string
  trip_id:             string
  engagement_type_id:  string | null
  booking_type:        string | null
  booking_type_label:  string | null
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
  brief_show:          boolean
  sort_order:          number
  airline_supplier_id: string | null
  airline_name:        string | null
  flight_number:       string | null
  depart_airport:      string | null
  arrive_airport:      string | null
  cabin_class:         string | null
  seat_type:           string | null
  aircraft_type:       string | null
  dining_venue_id?:    string | null
  image_src?:          string | null
  passengers?:         ImmerseTripAuxPassenger[]
  driver_details?:     ImmerseTripAuxDriverDetail[]
  created_at:          string
  updated_at:          string
}

// Room: client's-bill fields KEPT (rate/tax_pct/total/extra_person_fee). No margin
// exists at room level, so nothing stripped here beyond what admin already lacks.
export type ImmerseBookingRoom = {
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
  sort_order:          number
  created_at:          string
  updated_at:          string
  resolved_image_src?:         string | null
  resolved_image_alt?:         string | null
  resolved_guest_name?:        string | null
  resolved_additional_guests?: string[] | null
}

// Booking: client's-bill KEPT, MARGIN STRIPPED. Omitted vs admin TripBooking:
// commissionable_rate, commission_pct, commission_amount, net_revenue,
// commission_paid_at, invoice_number, iata_*, referral_*, individual_*,
// supplier_*, primary/supplier contact fields, cancellation/booking policy.
export type ImmerseTripBooking = {
  id:                  string
  trip_id:             string
  house_id:            string | null
  engagement_id:       string | null
  booking_type:        string | null
  name:                string | null
  status:              string | null
  confirmation_number: string | null
  start_date:          string | null
  end_date:            string | null
  nights:              number | null
  total_rate:          number | null
  taxes_and_fees:      number | null
  currency:            string | null
  rate_type:           string | null
  inclusions:          string | null
  price:               number | null
  deposit_amount:      number | null
  deposit_due_date:    string | null
  deposit_paid_at:     string | null
  balance_amount:      number | null
  balance_due_date:    string | null
  balance_paid_at:     string | null
  accom_hotel_id:      string | null
  party_composition:   string | null
  brief_category:      string | null
  brief_show:          boolean
  brief_image_src:     string | null
  booked_by:           string | null
  notes:               string | null
  sort_order:          number | null
  created_at:          string | null
  updated_at:          string | null
  // Client-resolved
  _hotel_name:      string | null
  _hotel_image_src: string | null
  _rooms:           ImmerseBookingRoom[]
}

export type ImmerseDossierTrip = {
  id:                   string
  trip_code:            string
  stage:                EngagementStage | null
  start_date:           string | null
  end_date:             string | null
  duration_nights:      number | null
  trip_type:            string | null
  destinations:         ImmerseTripDestination[]
  guest_count_adults:   number | null
  guest_count_children: number | null
  bookings:             ImmerseTripBooking[]
  brief:                ImmerseTripBrief | null
  url_id:               string | null
}