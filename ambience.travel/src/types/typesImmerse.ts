// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for engagement overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
//
// Last updated: S48 — EngagementStage added as a first-class computed property
//   on ImmerseEngagementData. Drives bare-URL routing decisions, admin badges,
//   and future automation. Replaces ad-hoc tripId nullable presence checks.
// Prior: S42 Add 3 — resort_map_src added to ImmerseHotelOption.
//   Sourced from travel_immerse_trip_destination_hotels.resort_map_src.
//   Rendered as a downloadable link below the hotel gallery in HotelDetailPanel.

export type EngagementType =
  | 'journey'
  | 'service'
  | 'experience'
  | 'acquisition'

export type EngagementAudience =
  | 'private'
  | 'public'

export type EngagementStatusSlug =
  | 'new_request'
  | 'proposal_in_progress'
  | 'proposal_sent'
  | 'revisions_in_progress'
  | 'booked'
  | 'in_travel'
  | 'completed'
  | 'cancelled'
  | 'lost'

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
  destinationSlug?:    string | null
  destinationUrlSlug?: string | null
  anchorId?:           string
  subpageStatus:       ImmerseSubpageStatus
}

export type ImmerseTripPricingRow = {
  id:               string
  destination:      string
  recommendedBasis: string
  stayLabel:        string
  indicativeRange:  string
}

// ─── Engagement stage ─────────────────────────────────────────────────────────
// S48 — Computed lifecycle state for an engagement. Drives routing decisions,
// admin UI badges, and future automation.
//
// Derived from two signals:
//   1. The advisor's declared engagement_status_id (intent)
//   2. The actual data presence on the linked trip (system truth)
//
// Status alone can lie (an advisor might mark something "confirmed" before
// bookings land). Data alone is too raw. Stage combines both into the single
// source of truth for routing.

export type EngagementStage =
  | 'draft'                  // No proposal content, no trip content
  | 'proposal'               // Proposal narrative only
  | 'proposal_with_pending'  // Proposal narrative + trip content forming
  | 'trip'                   // Trip content present; live for the client
  | 'completed'              // Trip exists AND status declared completed/archived
  | 'cancelled'              // Status declared cancelled/lost

const COMPLETED_STATUS_SLUGS = new Set<string>(['completed', 'archived'])
const CANCELLED_STATUS_SLUGS = new Set<string>(['cancelled', 'lost'])

export type EngagementStageInputs = {
  statusSlug:         string  // engagement_status.slug
  hasProposalContent: boolean // any narrative or destination_rows
  hasTripContent:     boolean // any bookings, days, or aux bookings on linked trip
}

export function computeEngagementStage(input: EngagementStageInputs): EngagementStage {
  if (CANCELLED_STATUS_SLUGS.has(input.statusSlug)) return 'cancelled'
  if (COMPLETED_STATUS_SLUGS.has(input.statusSlug) && input.hasTripContent) return 'completed'

  if (input.hasTripContent && input.hasProposalContent) return 'proposal_with_pending'
  if (input.hasTripContent)     return 'trip'
  if (input.hasProposalContent) return 'proposal'
  return 'draft'
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
  heroTagline?:    string
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
  pricingNotes:        string[]
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
  pricingNotes:        string[]
}