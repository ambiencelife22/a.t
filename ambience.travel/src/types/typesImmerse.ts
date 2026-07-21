// typesImmerse.ts - shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for engagement overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
//
// Last updated: S53B Closing+1 - ImmerseHeroProps moved here from inline
//   declaration in ImmerseHero.tsx, per standing rule: renderers render,
//   types files own data and types.
// Prior: S53B Closing+1 - heroEyebrowOverride added to ImmerseDestinationRow.
// Prior: S53B Closing - heroEyebrowOverride added to ImmerseEngagementData.
// Prior: S48 - EngagementStage added as a first-class computed property
//   on ImmerseEngagementData.
// Prior: S42 Add 3 - resort_map_src added to ImmerseHotelOption.

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

export interface EngagementStatusRow {
  id: string
  slug: string
  label: string
  sortOrder: number
  isActive: boolean
}
export type ItineraryStatusRow = EngagementStatusRow

export interface PlatformSettings {
  maintenanceMode: boolean
  updatedAt: string | null
  updatedBy: string | null
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
  taxTreatment?:              string   // S53C - resolved tax_treatments.label
  roomAlert?:                 string   // S53C - per-booking alert message
  roomAlertLevel?:            string   // S53C - info | warning | pending
  roomId?:                    string   // S53C - catalog room id (for connection matching)
  overlayId?:                 string   // S53C - overlay row id (unique per offer; canon room may repeat)
  connectedOverlayId?:        string   // S53C - overlay id of connecting partner offer (per-offer connection)
  connectedRoomId?:           string   // S53C - catalog id of connecting partner room
  connectingNote?:            string   // S53C - connection descriptor (e.g. private entryway)
  sqftMin?:                   number
  sqftMax?:                   number
  sqmMin?:                    number
  sqmMax?:                    number
  beddingConfigurations?:     string[]  // canonical slugs - all available options
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
  michelinKeys?:  number   // S53C - canon travel_accom_hotels.michelinKeys (1-3)
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
  nights?:          number   // S53C - explicit night count (stayLabel = date range)
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
  nights?:             number   // S53C - explicit night count
  destinationSlug?:    string | null
  destinationUrlSlug?: string | null
  anchorId?:           string
  subpageStatus:       ImmerseSubpageStatus
  heroEyebrowOverride?: string    // S53B Closing+1 - per-destination_row eyebrow
}

export type ImmerseEngagementPricingRow = {
  id:               string
  destination:      string
  recommendedBasis: string
  stayLabel:        string
  indicativeRange:  string
}

// ─── Engagement stage ─────────────────────────────────────────────────────────
// MISSION: stage is a pure function of DECLARED engagement status. No inference
// from content presence. The status slug is the single source of truth; the
// operator edits it; the stage follows. (S55 - removed hasProposalContent /
// hasTripContent inference, which violated single-source and misread completed
// engagements whose content keyed located in another place.)

export type EngagementStage =
  | 'draft'
  | 'proposal'
  | 'delivery'
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
      return 'delivery'

    case 'quoted':
    case 'pending':
      return 'proposal'

    case 'requested':
      return 'draft'
  }
}

// ─── Deliverable shape ───────────────────────────────────────────────────────
// MISSION: shape is the SECOND render axis beside stage. Stage answers "where in
// the lifecycle"; shape answers "what kind of deliverable". Together they drive
// resolveSectionSet - which sections the unified surface renders. Single source:
// the 8 top-level shapes below, and the map from the 20-row travel_engagement_types
// registry onto them. (Collapse A · A1.)

export type EngagementShape =
  | 'journey'      // multi-destination arc (the flagship shape)
  | 'stay'         // single-property stay
  | 'dining'       // dining reservation as the deliverable
  | 'reservation'  // generic reservation (non-dining)
  | 'transport'    // flight / transfer / car / heli / jet as the deliverable
  | 'experience'   // tour / activity / experience as the deliverable
  | 'acquisition'      // single-product procurement (watch / handbag / artwork)
  | 'arrangement'      // brokered: a service procured through a third party on the guest's behalf
  | 'concierge_service' // ours: a service ambience renders itself (research, appointments, the direct work of the house)

export const ENGAGEMENT_SHAPES: readonly EngagementShape[] = [
  'journey', 'stay', 'dining', 'reservation',
  'transport', 'experience', 'acquisition', 'arrangement', 'concierge_service',
] as const

// Every travel_engagement_types slug maps to one of THE NINE shapes.
// Top-level shapes map to themselves; element/booking sub-types roll up.
// Null / unknown → 'journey' (the safe superset - renders the full surface).
const SLUG_TO_SHAPE: Record<string, EngagementShape> = {
  journey:          'journey',
  stay:             'stay',
  dining:           'dining',
  reservation:      'reservation',
  experience:       'experience',
  acquisition:      'acquisition',
  arrangement:       'arrangement',
  concierge_service: 'concierge_service',
  flight:           'transport',
  private_jet:      'transport',
  airport_transfer: 'transport',
  transfer:         'transport',
  car_service:      'transport',
  car_rental:       'transport',
  heli_transfer:    'transport',
  public_transport: 'transport',
  yacht_charter:    'transport',
  cruise:           'transport',
  tour:             'experience',
  meet_greet:       'experience',
  other:            'arrangement',
}

export function resolveEngagementShape(slug: string | null | undefined): EngagementShape {
  if (!slug) return 'journey'
  return SLUG_TO_SHAPE[slug] ?? 'journey'
}

// ─── Section registry ────────────────────────────────────────────────────────
// The unified engagement surface renders a set of sections resolved from
// (stage, shape). This registry is the single source for that mapping. It ships
// dark in A1 - nothing renders it yet. A2 extracts each render block into a
// Section component keyed on SectionType; A3 builds the surface that consumes
// resolveSectionSet. Admin toggles (show_tab_*) subtract from the resolved set
// at render time - the registry is the structural superset.

export type SectionType =
  | 'hero'
  | 'interstitial'
  | 'welcome'
  | 'route'
  | 'destinations'
  | 'pricing'
  | 'confirmation'
  | 'programme'
  | 'brief'
  | 'contacts'
  // Stay-detail sections (Collapse A · eight-shape Stage A). Content lives in
  // ImmerseDestinationData; renderers wrap the existing ImmerseDest* components.
  // A standalone stay resolves these in place of route/destinations; a
  // destination-within-a-journey (Stage B route) renders the same set scoped to
  // one destination's payload. Ships dark until the stay context arm exists.
  | 'intro'
  | 'hotel_options'
  | 'dining_grid'
  | 'experiences_grid'
  | 'detail_pricing'

export type Section = {
  id:        SectionType
  stages:    readonly EngagementStage[]
  shapes:    readonly EngagementShape[]
  sortOrder: number
}

// sortOrder: gapped integers (0,10,20…). Gaps let journey and stay sections
// interleave on round numbers without fractions. Within a resolved (stage,shape)
// set the order is sortOrder-ascending. pricing and detail_pricing share 60 but
// never co-resolve (mutually exclusive shapes). Keep gaps when inserting; do NOT
// renumber to consecutive integers - the gaps ARE the interleave contract.
export const SECTION_REGISTRY: readonly Section[] = [
  { id: 'hero',             stages: ['draft', 'proposal', 'delivery', 'completed'], shapes: ENGAGEMENT_SHAPES,                                                                        sortOrder: 0 },
  { id: 'intro',            stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 10 },
  { id: 'welcome',          stages: ['draft', 'proposal'],                          shapes: ['journey', 'experience', 'arrangement'],                                                 sortOrder: 15 },
  { id: 'hotel_options',    stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 20 },
  { id: 'route',            stages: ['draft', 'proposal'],                          shapes: ['journey'],                                                                              sortOrder: 25 },
  { id: 'dining_grid',      stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 30 },
  // interstitial: mid-scroll cinematic band (hero-2 fields). journey reads it
  // from ImmerseEngagementData.heroImageSrc2; stay reads it from
  // ImmerseDestinationData.heroImageSrc2 - same band, both payloads carry it.
  { id: 'interstitial',     stages: ['draft', 'proposal'],                          shapes: ['journey', 'stay'],                                                                      sortOrder: 40 },
  { id: 'experiences_grid', stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 50 },
  { id: 'destinations',     stages: ['draft', 'proposal'],                          shapes: ['journey'],                                                                              sortOrder: 55 },
  { id: 'pricing',          stages: ['draft', 'proposal'],                          shapes: ['journey', 'dining', 'reservation', 'transport', 'experience', 'acquisition', 'arrangement'], sortOrder: 60 },
  { id: 'detail_pricing',   stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 60 },
  { id: 'brief',            stages: ['delivery', 'completed'],                      shapes: ['journey', 'stay'],                                                                      sortOrder: 70 },
  { id: 'programme',        stages: ['delivery', 'completed'],                      shapes: ['journey', 'stay', 'experience'],                                                        sortOrder: 80 },
  { id: 'confirmation',     stages: ['delivery', 'completed'],                      shapes: ENGAGEMENT_SHAPES,                                                                        sortOrder: 90 },
  { id: 'contacts',         stages: ['delivery', 'completed'],                      shapes: ENGAGEMENT_SHAPES,                                                                        sortOrder: 100 },
] as const

// SHAPE_SECTIONS: for each shape, the SectionTypes it can ever include (across
// all stages). DERIVED from SECTION_REGISTRY - never authored separately.
export const SHAPE_SECTIONS: Record<EngagementShape, readonly SectionType[]> =
  ENGAGEMENT_SHAPES.reduce((acc, shape) => {
    acc[shape] = SECTION_REGISTRY
      .filter(s => s.shapes.includes(shape))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(s => s.id)
    return acc
  }, {} as Record<EngagementShape, SectionType[]>)

// resolveSectionSet: the one function the unified surface calls. Given
// (stage, shape), returns the ordered sections to render. Pure and total.
// Cancelled renders no sections (route shows a cancelled fallback instead).
export function resolveSectionSet(
  stage: EngagementStage,
  shape: EngagementShape,
): readonly Section[] {
  if (stage === 'cancelled') return []
  return SECTION_REGISTRY
    .filter(s => s.stages.includes(stage) && s.shapes.includes(shape))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// ─── Engagement data ─────────────────────────────────────────────────────────

export type ImmerseEngagementData = {
  engagementId:    string
  audience:        EngagementAudience
  urlId:           string
  slug:            string
  journeyTypes:    string[]
  clientName:      string | null
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
  pricingRows:         ImmerseEngagementPricingRow[]
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
  eyebrowHotels:   string
  titleHotels:     string
  bodyHotels:      string
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
  titlePrefix?:    string   // renders in Cormorant Garamond italic - e.g. "Honeymoon in"
  dateLabel?:      string   // renders in gold below title - e.g. "January 2027"
  nightsLabel?:    string   // appended to dateLabel with · separator - e.g. "5-6 Nights"
  itineraryStage?: string   // small italic line - e.g. "Refined Proposal"

  // Content
  title:           string
  subtitle:        string
  pills?:          string[]
  heroImageSrc:    string
  heroImageAlt:    string

  // CTAs
  primaryHref?:    string
  primaryLabel?:   string
  diningHref?:     string   // optional third CTA - "Dining + Experiences"
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
  journeyTypes:                  string[]
  iterationLabel:                string
  journeyId:                        string | null
  personId:                      string | null
  slug:                           string | null
  statusLabel:                   string | null
  eyebrow:                        string | null
  heroTagline:                   string | null
  subtitle:                       string | null
  heroImageSrc:                 string | null
  heroImageAlt:                 string | null
  hero_image_src_2:               string | null
  hero_image_alt_2:               string | null
  hero_title_2:                   string | null
  hero_subtitle_2:                string | null
  heroPills:                     string[]
  heroEyebrowOverride:          string | null
  welcomeEyebrowOverride:       string | null
  welcomeTitleOverride:         string | null
  welcomeBodyOverride:          string | null
  welcomeSignoffBodyOverride:  string | null
  welcomeSignoffNameOverride:  string | null
  routeHeading:                  string | null
  routeBody:                     string | null
  routeEyebrow:                  string | null
  destinationHeading:            string | null
  destinationSubtitle:           string | null
  destinationBody:               string | null
  pricingHeading:                string | null
  pricingTitle:                  string | null
  pricingBody:                   string | null
  pricingTotalLabel:            string | null
  pricingTotalValue:            string | null
  pricingNotesHeading:          string | null
  pricingNotesTitle:            string | null
  pricingNotes:                  ImmersePricingNote[]
  publicJourneySlug:            string | null
}

export type EngagementPatch = Partial<EngagementWritableFields>

export interface CreateEngagementInput {
  engagement?:             EngagementPatch
  engagementStatusSlug?: EngagementStatusSlug   // default 'requested'
  itineraryStatusSlug?:  ItineraryStatusSlug    // default 'draft'
}

export interface ReorderItem {
  id:         string
  sortOrder: number
}

export interface WelcomeLetterPatch {
  eyebrow?:      string
  title?:        string
  body?:         string
  signoffBody?: string
  signoffName?: string
}

// Terminal engagement status for archive (itinerary always → 'archived').
export type ArchiveEngagementSlug = Extract<EngagementStatusSlug, 'cancelled' | 'closed_lost'>

// ─── Trip client surface (confirmation / programme / brief) ───────────────────
// Client-owned contracts for the /immerse/ trip pages. ONE-WAY RULE: client files
// import these; they NEVER import from queriesAdminJourney. These intentionally OMIT
// ambience's margin (commission_*, netRevenue, commissionableRate, invoiceNumber,
// iata/referral/individual shares) - a client type must not even DESCRIBE the agency's
// profit. The client's-own-bill fields (price, rates, taxes, deposit/balance) ARE kept;
// each surface decides what it renders. (Phase 1, S53F. Phase 2 will make the admin
// types extend these as base & margin so there's a single definition.)

export type ImmerseEngagementDestination = {
  id:             string
  destinationId: string
  sortOrder:     number
  slug:           string
  name:           string
  storagePath:   string | null
  heroImageSrc: string | null
}

export type ImmerseJourneyStep = {
  icon:   string
  label:  string
  detail: string
}

export type ImmerseEngagementHouse = {
  id:                 string
  displayName:       string
  salutationRule:    string | null
  travelStyleNotes: string | null
  avoidNotes:        string | null
  serviceNotes:      string | null
}

export type ImmerseEngagementBrief = {
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
  journeySteps:         ImmerseJourneyStep[]
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

export type ImmerseJourneyDay = {
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

export type ImmerseJourneyDayEntry = {
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

// Passenger is canonical in typesElements (ElementPassenger). Alias kept for
// existing import sites.
import type { ElementBase, ElementPassenger } from './typesElements'
import type { TimelineItemView } from './typesImmerseDelivery'
export type ImmerseElementPassenger = ElementPassenger

// Driver detail: client-safe. `company` (operator-internal) deliberately OMITTED -
// matches attachDriverDetails in _shared/names.ts which never sends it client-side.
export type ImmerseElementDriverDetail = {
  id:             string
  auxBookingId: string
  driverName:    string | null
  driverPhone:   string | null
  carModel:      string | null
  plate:          string | null
  vehicleRole:   string | null
  sortOrder:     number
}

export type EngagementElement = ElementBase & {
  driverDetails?: ImmerseElementDriverDetail[]   // client driver type - no `company`
}

// Room: client's-bill fields KEPT (rate/tax_pct/total/extra_person_fee). No margin
// exists at room level, so nothing stripped here beyond what admin already lacks.
export type BookingInvoice = {
  id:             string
  bookingId:     string
  invoiceNumber: string
  invoiceDate:   string | null
  amount:         number | null
  currency:       string
  description:    string | null
  sortOrder:     number
}

export type ImmerseBookingRoom = {
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
  beddingType:        string | null   // confirmed configuration slug, null = TBD on arrival
  sortOrder:          number
  createdAt:          string
  updatedAt:          string
  resolvedImageSrc?:         string | null
  resolvedImageAlt?:         string | null
  resolvedGuestName?:        string | null
  resolvedAdditionalGuests?: string[] | null
}

// Booking: client's-bill KEPT, MARGIN STRIPPED. Omitted vs admin EngagementBooking:
// commissionableRate, commissionPct, commissionAmount, netRevenue,
// commissionPaidAt, invoiceNumber, iata_*, referral_*, individual_*,
// supplier_*, primary/supplier contact fields, cancellation/booking policy.
export type ImmerseEngagementBooking = {
  id:                  string
  journeyId:             string
  houseId:            string | null
  engagementId:       string | null
  name:                string | null
  status:              string | null
  statusNote:         string | null
  confirmationNumber: string | null
  startDate:          string | null
  checkInDate:       string | null
  startTime:          string | null
  checkInNote:       string | null
  checkOutNote:      string | null
  standardCheckinTime?: string | null
  approvedCheckinTime?: string | null
  expectedArrivalTime?: string | null
  lateCheckoutApprovedTime?: string | null
  requestedCheckinTime?: string | null
  requestedCheckoutTime?: string | null
  extras?: { label: string; amount: number; currency: string; note?: string; charge_to?: string }[]
  endDate:            string | null
  nights:              number | null
  totalRate:          number | null
  taxesAndFees:      number | null
  currency:            string | null
  inclusions:            string | null
  inclusionsOverride:   unknown[] | null
  cancellationPolicy:   string | null
  price:               number | null
  depositAmount:      number | null
  depositDueDate:    string | null
  depositPaidAt:     string | null
  balanceAmount:      number | null
  balanceDueDate:    string | null
  balancePaidAt:     string | null
  accomHotelId:      string | null
  partyComposition:   string | null
  briefCategory:      string | null
  briefShow:          boolean
  briefImageSrc:     string | null
  bookedBy:           string | null
  notes:               string | null
  sortOrder:          number | null
  createdAt:          string | null
  updatedAt:          string | null
  // Derived on the wire by travel-get-engagement-confirmation only. Optional because
  // admin surfaces construct ImmerseEngagementBooking without computing it; absent
  // reads as "no exception". The raw balance date/override that produce it are
  // never sent to the client.
  paymentException?:  boolean
  // Client-resolved
  _hotel_name:      string | null
  _hotel_image_src: string | null
  _rooms:           ImmerseBookingRoom[]
  _invoices:        BookingInvoice[]
}

export type ImmerseDossierJourney = {
  id:                   string
  journeyCode:            string
  stage:                EngagementStage | null
  startDate:           string | null
  endDate:             string | null
  durationNights:      number | null
  tripType:            string | null
  destinations:         ImmerseEngagementDestination[]
  guestCountAdults:   number | null
  guestCountChildren: number | null
  bookings:             ImmerseEngagementBooking[]
  brief:                ImmerseEngagementBrief | null
  urlId:               string | null
}

// One element view: the camelCase TimelineItemView the EF emits, plus four
// frontend-derived flight fields (origin/destination parsed from subtitle,
// depart/arrive gated on isFlight). Every other field flows from TimelineItemView
// directly. Replaces the former hand-maintained CardItem mirror (BIG STEP 2).
export type EngagementElementView = TimelineItemView & {
  flightOrigin:      string | null
  flightDestination: string | null
  flightDepartTime:  string | null
  flightArriveTime:  string | null
}