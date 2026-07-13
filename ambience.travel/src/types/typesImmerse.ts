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
  beddingConfigurations?:     string[]  // canonical slugs — all available options
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
// operator edits it; the stage follows. (S55 — removed hasProposalContent /
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
// resolveSectionSet — which sections the unified surface renders. Single source:
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
// Null / unknown → 'journey' (the safe superset — renders the full surface).
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
// dark in A1 — nothing renders it yet. A2 extracts each render block into a
// Section component keyed on SectionType; A3 builds the surface that consumes
// resolveSectionSet. Admin toggles (show_tab_*) subtract from the resolved set
// at render time — the registry is the structural superset.

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
// renumber to consecutive integers — the gaps ARE the interleave contract.
export const SECTION_REGISTRY: readonly Section[] = [
  { id: 'hero',             stages: ['draft', 'proposal', 'delivery', 'completed'], shapes: ENGAGEMENT_SHAPES,                                                                        sortOrder: 0 },
  { id: 'intro',            stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 10 },
  { id: 'welcome',          stages: ['draft', 'proposal'],                          shapes: ['journey', 'experience', 'arrangement'],                                                 sortOrder: 15 },
  { id: 'hotel_options',    stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 20 },
  { id: 'route',            stages: ['draft', 'proposal'],                          shapes: ['journey'],                                                                              sortOrder: 25 },
  { id: 'dining_grid',      stages: ['draft', 'proposal'],                          shapes: ['stay'],                                                                                 sortOrder: 30 },
  // interstitial: mid-scroll cinematic band (hero-2 fields). journey reads it
  // from ImmerseEngagementData.heroImageSrc2; stay reads it from
  // ImmerseDestinationData.heroImageSrc2 — same band, both payloads carry it.
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
// all stages). DERIVED from SECTION_REGISTRY — never authored separately.
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
  journey_id:                        string | null
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
// import these; they NEVER import from queriesAdminJourney. These intentionally OMIT
// ambience's margin (commission_*, net_revenue, commissionable_rate, invoice_number,
// iata/referral/individual shares) — a client type must not even DESCRIBE the agency's
// profit. The client's-own-bill fields (price, rates, taxes, deposit/balance) ARE kept;
// each surface decides what it renders. (Phase 1, S53F. Phase 2 will make the admin
// types extend these as base & margin so there's a single definition.)

export type ImmerseEngagementDestination = {
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

export type ImmerseEngagementHouse = {
  id:                 string
  display_name:       string
  salutation_rule:    string | null
  travel_style_notes: string | null
  avoid_notes:        string | null
  service_notes:      string | null
}

export type ImmerseEngagementBrief = {
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

export type ImmerseJourneyDay = {
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

export type ImmerseJourneyDayEntry = {
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

export type ImmerseElementPassenger = {
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
export type ImmerseElementDriverDetail = {
  id:             string
  aux_booking_id: string
  driver_name:    string | null
  driver_phone:   string | null
  car_model:      string | null
  plate:          string | null
  vehicle_role:   string | null
  sort_order:     number
}

export type EngagementElement = {
  id:                  string
  journey_id:             string
  engagement_type_id:  string | null
  element_type:        string | null
  element_type_label:  string | null
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
  dining_status:                string | null
  cancellation_penalty_applied: boolean | null
  cancellation_note:            string | null
  show_cancellation:            boolean | null
  venue?: {
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
  passengers?:         ImmerseElementPassenger[]
  driver_details?:     ImmerseElementDriverDetail[]
  created_at:          string
  updated_at:          string
}

// Room: client's-bill fields KEPT (rate/tax_pct/total/extra_person_fee). No margin
// exists at room level, so nothing stripped here beyond what admin already lacks.
export type BookingInvoice = {
  id:             string
  booking_id:     string
  invoice_number: string
  invoice_date:   string | null
  amount:         number | null
  currency:       string
  description:    string | null
  sort_order:     number
}

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
  check_in_time:       string | null
  bedding_type:        string | null   // confirmed configuration slug, null = TBD on arrival
  sort_order:          number
  created_at:          string
  updated_at:          string
  resolved_image_src?:         string | null
  resolved_image_alt?:         string | null
  resolved_guest_name?:        string | null
  resolved_additional_guests?: string[] | null
}

// Booking: client's-bill KEPT, MARGIN STRIPPED. Omitted vs admin EngagementBooking:
// commissionable_rate, commission_pct, commission_amount, net_revenue,
// commission_paid_at, invoice_number, iata_*, referral_*, individual_*,
// supplier_*, primary/supplier contact fields, cancellation/booking policy.
export type ImmerseEngagementBooking = {
  id:                  string
  journey_id:             string
  house_id:            string | null
  engagement_id:       string | null
  name:                string | null
  status:              string | null
  confirmation_number: string | null
  start_date:          string | null
  check_in_date:       string | null
  start_time:          string | null
  check_in_note:       string | null
  check_out_note:      string | null
  end_date:            string | null
  nights:              number | null
  total_rate:          number | null
  taxes_and_fees:      number | null
  currency:            string | null
  rate_type:           string | null
  inclusions:            string | null
  inclusions_override:   unknown[] | null
  cancellation_policy:   string | null
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
  // Derived on the wire by travel-get-engagement-confirmation only. Optional because
  // admin surfaces construct ImmerseEngagementBooking without computing it; absent
  // reads as "no exception". The raw balance date/override that produce it are
  // never sent to the client.
  payment_exception?:  boolean
  // Client-resolved
  _hotel_name:      string | null
  _hotel_image_src: string | null
  _rooms:           ImmerseBookingRoom[]
  _invoices:        BookingInvoice[]
}

export type ImmerseDossierJourney = {
  id:                   string
  journey_code:            string
  stage:                EngagementStage | null
  start_date:           string | null
  end_date:             string | null
  duration_nights:      number | null
  trip_type:            string | null
  destinations:         ImmerseEngagementDestination[]
  guest_count_adults:   number | null
  guest_count_children: number | null
  bookings:             ImmerseEngagementBooking[]
  brief:                ImmerseEngagementBrief | null
  url_id:               string | null
}