// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
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

export type EngagementType =
  | 'journey'
  | 'service'
  | 'experience'
  | 'acquisition'

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

export type ImmerseTripFormat = 'journey' | 'experience'

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
  engagementType:  EngagementType
  audience:        EngagementAudience
  urlId:           string
  slug:            string
  tripFormat:      ImmerseTripFormat
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
  engagement_type:                EngagementType
  trip_format:                    ImmerseTripFormat
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