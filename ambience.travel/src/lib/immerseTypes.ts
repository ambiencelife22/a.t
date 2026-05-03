// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for engagement overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
//
// Last updated: S32K — Added rateCadence to ImmerseRoomOption. Reads from
//   travel_immerse_rooms.rate_cadence_id JOIN against travel_immerse_rate_cadences.
//   Replaces hardcoded "/ night" suffix in RoomCategory render. Cadence values
//   come from a reference table (Per Night, Per Stay, Per Week, Per Month);
//   admin can extend without code changes.
// Prior: S32 (Add 1) — Added optional heroTagline field on
//   ImmerseEngagementData. Mirrors the renamed travel_immerse_engagements.hero_tagline
//   column (was: title before s32_add1_01). Pulled into the type and query layer
//   but not yet rendered — preserves the route-summary copy ("Saudi → Nordic Winter
//   → ...") for future use without a separate query patch when render lands.
//   Earlier S32 entry: Added EngagementAudience union + audience field.
//  Prior S32 — Added EngagementAudience union ('private' | 'public') +
//   audience field on ImmerseEngagementData. Mirrors the audience enum on
//   travel_immerse_engagements (added s32_01). Used by the route dispatcher
//   to branch render path between private and public surfaces. Default
//   value 'private' on existing engagements; pubMuirRzSW (Template) flipped
//   to 'public' in s32_01b.
// Prior: S30F — Added rateSuffix to ImmerseRoomOption. Free-text per-room
//   suffix rendered after both nonNegotiated and ambience rate chips. Resolved
//   override (travel_immerse_rooms.rate_suffix_override) → canonical
//   (travel_accom_rooms.rate_suffix) → undefined in immerseQueries.ts via the
//   standard ?? chain. Replaces hardcoded "+ Taxes & Fees" / "+ tax" in
//   RoomCategory. NULL renders nothing.
// Prior: S30E — Engagement abstraction. Master data type renamed
//   ImmerseTripData → ImmerseEngagementData and now carries an engagementType
//   discriminator ('journey' | 'service' | 'experience' | 'acquisition'),
//   defaulted to 'journey' DB-side. Status types renamed TripStatus →
//   EngagementStatus + TripStatusSlug → EngagementStatusSlug to mirror the
//   underlying lookup table rename (travel_trip_statuses →
//   travel_engagement_statuses). Itinerary side unchanged — itinerary is
//   journey-engagement-specific lifecycle, not universal.
// ─── Engagement-level discriminators ─────────────────────────────────────────
// engagement_type (S30E): journey | service | experience | acquisition.
// audience (S32): private | public. Drives render path dispatch.
// Both are extensible enums DB-side and union types here.

export type EngagementType =
  | 'journey'
  | 'service'
  | 'experience'
  | 'acquisition'

export type EngagementAudience =
  | 'private'
  | 'public'

// ─── Status lookups ──────────────────────────────────────────────────────────
// Slug union types match the canonical seed values from
// migration_s30d_01_trip_itinerary_status_lookups.sql. Adding a new status
// row to either lookup table without updating the union here will still
// type-check at runtime — the runtime slug field is `string`. The unions
// exist so consumers that want to branch on known slugs get compile-time
// coverage of the canonical set.

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
  slug:      string   // narrows to EngagementStatusSlug for known canonical values
  label:     string
  sortOrder: number
  isActive:  boolean
}

export interface ItineraryStatus {
  id:        string
  slug:      string   // narrows to ItineraryStatusSlug for known canonical values
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
  // Three-tier rate taxonomy
  publicNightlyRate?:         string   // direct/rack rate — struck-through in UI
  nonNegotiatedNightlyRate?:  string   // current published rate
  ambienceNightlyRate?:       string   // partner-negotiated rate — NULL until rates locked
  taxInclusive?:              boolean
  // Free-text per-room rate suffix rendered after both rate chips.
  // Resolved override → canonical → undefined. NULL renders nothing.
  rateSuffix?:                string
  // S32K: rate cadence label (e.g. "Per Night", "Per Stay", "Per Week", "Per Month").
  // Sourced from travel_immerse_rate_cadences via FK. Pulled by query layer; rendered
  // beside numeric rate chips in place of the prior hardcoded "/ night" suffix.
  rateCadence?:               string
  sqftMin?:                   number
  sqftMax?:                   number
  sqmMin?:                    number
  sqmMax?:                    number
}

export type ImmerseHotelOption = {
  id:           string   // real DB UUID (canonical travel_accom_hotels.id)
  storageSlug:  string   // hotel_slug for storage path construction
  rank:         'primary' | 'secondary'
  rankLabel:    string
  name:         string
  bullets:      string[]
  imageSrc:     string
  imageAlt:     string
  stayLabel:    string
  rooms:            ImmerseRoomOption[]
  gallery?:         string[]
  imageCredit?:     string
  imageCreditUrl?:  string
  imageLicense?:    string
}

export type ImmerseContentCard = {
  id:              string
  kicker:          string
  name:            string
  tagline:         string
  body:            string
  bulletsHeading?: string   // small header above bullets (e.g. "Highlights")
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

// Pricing closer row (final closer beneath the pricing table). All four fields
// nullable — null means "fall back to the frontend constant
// PRICING_CLOSER_DEFAULT in ImmerseDestinationComponents.tsx". Populated per
// engagement via 4 nullable override columns on travel_immerse_trip_destination_rows
// once a price has been quoted.
export type ImmersePricingCloser = {
  item:            string | null
  basis:           string | null
  stay:            string | null
  indicativeRange: string | null
}

// Proposal-wide welcome letter. Single canonical row shared across all
// engagements; per-engagement overrides on travel_immerse_engagements.welcome_*_override.
// Resolution: engagement override → canonical → ''. Empty string on all five
// fields hides the entire section; empty string on an individual field hides
// just that field (handled in ImmerseWelcomeLetter component).
export type ImmerseWelcomeLetter = {
  eyebrow:     string
  title:       string
  body:        string
  signoffBody: string
  signoffName: string
}

// ─── Region grouping ──────────────────────────────────────────────────────────
// Nordic Winter has 3 regions (Iceland, Norway, Finland). Europe Finale has
// 3 (Swiss Alps, Paris, French Alps). Each region carries its own positioning
// (rank, rank_label, bullets from travel_immerse_trip_regions) plus a list of
// hotel picks (from travel_immerse_trip_region_hotels). Child tables retain
// "trip" prefix because their content is journey-engagement-specific.

export type ImmerseRegionGroup = {
  regionId:     string
  slug:         string
  title:        string
  shorthand?:   string
  rank:         'primary' | 'secondary'
  rankLabel:    string
  bullets:      string[]
  stayLabel:    string
  heroImageSrc?: string
  heroImageAlt?: string
  regionGallery?: string[]
  hotels:       ImmerseHotelOption[]
}

// Discriminated union — destination renders either flat hotels or region groups
export type ImmerseDestinationHotelsShape =
  | { kind: 'flat';     hotels: ImmerseHotelOption[] }
  | { kind: 'regioned'; regions: ImmerseRegionGroup[] }

// ─── Engagement overview (master page) ───────────────────────────────────────
// The master page surface; data shape identifies as engagement and carries
// engagementType + audience. Journey-shape detail types (ImmerseTripFormat,
// ImmerseRouteStop, ImmerseDestinationRow, ImmerseTripPricingRow) keep "trip"
// naming because they describe journey-engagement-specific content.

export type ImmerseTripFormat = 'journey' | 'experience'

// Per-engagement per-destination subpage render state
//   'live'    — clickable card, normal CTA (Discover More →)
//   'preview' — non-clickable card, opacity 0.5, "Coming soon" badge
//   'hidden'  — filtered out server-side; row not rendered at all
export type ImmerseSubpageStatus = 'live' | 'preview' | 'hidden'

export type ImmerseRouteStop = {
  id: string
  title: string
  stayLabel: string
  note: string
  imageSrc: string
  imageAlt: string
  destinationSlug?: string | null
  anchorId?: string
  destinationRowId?: string | null
}

export type ImmerseDestinationRow = {
  id: string
  numberLabel: string
  title: string
  mood: string
  summary: string
  imageSrc: string
  imageAlt: string
  stayLabel: string
  destinationSlug?: string | null
  anchorId?: string
  subpageStatus: ImmerseSubpageStatus  // render state — live | preview | hidden
}

export type ImmerseTripPricingRow = {
  id:               string
  destination:      string
  recommendedBasis: string
  stayLabel:        string
  indicativeRange:  string
}

export type ImmerseEngagementData = {
  // meta
  engagementId:    string
  engagementType:  EngagementType        // 'journey' | 'service' | 'experience' | 'acquisition'
  audience:        EngagementAudience    // S32: 'private' | 'public' — drives render path dispatch
  urlId:           string
  slug:            string
  tripFormat:      ImmerseTripFormat     // journey-engagement format detail
  journeyTypes:    string[]
  clientName:      string
  statusLabel:     string                // guest-facing display copy
  heroTagline?:    string                // S32 Add 1: route-summary copy (optional, not yet rendered)
  // status — operator-facing lifecycle, distinct from statusLabel
  engagementStatus:  EngagementStatus
  itineraryStatus:   ItineraryStatus
  // welcome
  welcomeLetter: ImmerseWelcomeLetter
  // hero
  eyebrow:      string
  title:        string
  subtitle:     string
  heroImageSrc: string
  heroImageAlt: string
  heroImageSrc2?: string
  heroImageAlt2?: string
  heroTitle2?:    string
  heroSubtitle2?: string
  heroPills:    string[]
  // route
  routeHeading: string
  routeBody:    string
  routeEyebrow?: string
  routeStops:   ImmerseRouteStop[]
  // destinations
  destinationHeading:    string
  destinationSubtitle?:  string
  destinationBody?:      string
  destinationRows:       ImmerseDestinationRow[]
  // pricing
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
  // meta
  destinationId:   string   // UUID — primary DB identity
  destinationSlug: string   // URL-facing slug (e.g. "new-york")
  journeyId:       string
  shorthand?:      string
  // hero
  eyebrow:      string
  title:        string
  subtitle:     string
  heroImageSrc: string
  heroImageAlt: string
  heroImageSrc2?: string
  heroImageAlt2?: string
  heroTitle2?:    string
  heroSubtitle2?: string
  heroPills:    string[]
  // intro
  introEyebrow: string
  introTitle:   string
  introBody:    string
  // hotels — flat OR region-grouped depending on destination
  hotelsEyebrow: string
  hotelsTitle:   string
  hotelsBody:    string
  hotels:        ImmerseDestinationHotelsShape
  // dining
  diningEyebrow: string
  diningTitle:   string
  diningBody:    string
  dining:        ImmerseContentCard[]
  // experiences
  experiencesEyebrow: string
  experiencesTitle:   string
  experiencesBody:    string
  experiences:        ImmerseContentCard[]
  // pricing
  pricingEyebrow:      string
  pricingTitle:        string
  pricingBody:         string
  pricingRows:         ImmersePricingRow[]
  pricingCloser:       ImmersePricingCloser  // per-engagement overlay of canonical default closer
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        string[]
}