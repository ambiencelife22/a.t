// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for engagement overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
// Last updated: S30F — Added rateSuffix to ImmerseRoomOption. Free-text per-room
//   suffix rendered after both nonNegotiated and ambience rate chips. Resolved
//   override (travel_immerse_rooms.rate_suffix_override) → canonical
//   (travel_accom_rooms.rate_suffix) → undefined in immerseQueries.ts via the
//   standard ?? chain. Replaces hardcoded "+ Taxes & Fees" / "+ tax" in
//   RoomCategory. NULL renders nothing — no assumed-standard behaviour. The
//   domain demands per-room verbatim suffixes (taxes vary, fees vary, some
//   rooms have one, some both, some neither — see deferred admin selector).
// Prior: S30E — Engagement abstraction. Master data type renamed
//   ImmerseTripData → ImmerseEngagementData and now carries an engagementType
//   discriminator ('journey' | 'service' | 'experience' | 'acquisition'),
//   defaulted to 'journey' DB-side. Status types renamed TripStatus →
//   EngagementStatus + TripStatusSlug → EngagementStatusSlug to mirror the
//   underlying lookup table rename (travel_trip_statuses →
//   travel_engagement_statuses). Itinerary side unchanged — itinerary is
//   journey-engagement-specific lifecycle, not universal. Journey-shape
//   types (ImmerseTripFormat, ImmerseTripPricingRow, ImmerseRouteStop,
//   ImmerseDestinationRow) preserved as-is — they describe journey-typed
//   engagement detail, which stays semantically "trip"-shaped.
// Prior: S30D — Added TripStatus + ItineraryStatus interfaces and slug
//   union types. ImmerseTripData carried tripStatus + itineraryStatus
//   resolved from the new lookup tables travel_trip_statuses +
//   travel_itinerary_statuses (FK columns trip_status_id + itinerary_status_id
//   on travel_immerse_trips, both NOT NULL). Slug union types narrow to the
//   canonical seed values for compile-time safety; the runtime slug field is
//   `string` so adding a new lookup row doesn't break type-checking.
//   statusLabel preserved — different concept (guest-facing display copy
//   like 'Designed For You · January 2027' vs operator-facing lifecycle).
// Prior: S30 — Added ImmerseWelcomeLetter + welcomeLetter on ImmerseTripData.
//   Canonical table travel_immerse_welcome_letter holds a single shared proposal
//   letter. Per-trip overrides live as 5 nullable welcome_*_override columns on
//   travel_immerse_trips. Resolution: trip override → canonical → ''. Empty
//   string = hide field; component hides section if all five fields empty.
// Prior: S29 addendum 2 — Added regionGallery to ImmerseRegionGroup.
// Prior: S23 addendum — Added bulletsHeading to ImmerseContentCard.
//   Small header rendered above each card's bullets list (e.g. "Highlights").
//   Resolves trip-override → canonical → ''. Empty string = hide header.
// Prior: S23 — Added ImmerseDestinationData.pricingCloser. Per-trip
//   overlay of the canonical destination pricing closer row (the "Pricing
//   Based On Selection" line at the bottom of every destination pricing
//   table). Resolution: trip override (4 nullable columns on
//   travel_immerse_trip_destination_rows) → frontend constant default
//   PRICING_CLOSER_DEFAULT (in ImmerseDestinationComponents.tsx). Closer is
//   structurally separate from data.pricingRows and never lives in
//   travel_immerse_destination_pricing_rows.
// Prior: S22 — No type shape changes. Pricing notes per-trip override
//   path consolidated into immerseQueries (was: parallel travel_immerse_bottom_notes
//   table + immerseBottomNotes.ts). pricingNotesHeading, pricingNotesTitle,
//   pricingNotes on ImmerseDestinationData are now resolved as
//   trip-override → canonical-destination → empty by the query layer.
//   Component fallback ("To be advised") handled at render time.
// Prior: S22 — Three-tier rate taxonomy on ImmerseRoomOption:
//   publicNightlyRate (was: same), nonNegotiatedNightlyRate (was: nightlyRate),
//   ambienceNightlyRate (NEW). Reflects DB rename of travel_immerse_rooms.nightly_rate
//   → non_negotiated_nightly_rate plus addition of ambience_nightly_rate column.
// Prior: S21 — ImmerseDestinationHotelsShape discriminated union.
//   Destinations can render hotels flat (NYC, St-Barths) or grouped by region
//   (Nordic Winter, Europe Finale). Region-grouped reads now flow through
//   travel_immerse_trip_region_hotels keyed on canonical trip_id.

// ─── Engagement-level discriminator (S30E) ───────────────────────────────────
// engagement_type discriminator on travel_immerse_engagements. Drives
// frontend dispatch and lets queries scope correctly when product types
// beyond 'journey' arrive (service, experience, acquisition). DB DEFAULT
// is 'journey'; the union below mirrors the CHECK constraint enum.

export type EngagementType =
  | 'journey'
  | 'service'
  | 'experience'
  | 'acquisition'

// ─── Status lookups (S30D, renamed S30E) ─────────────────────────────────────
// Slug union types match the canonical seed values from
// migration_s30d_01_trip_itinerary_status_lookups.sql. Adding a new status
// row to either lookup table without updating the union here will still
// type-check at runtime — the runtime slug field is `string`. The unions
// exist so consumers that want to branch on known slugs (e.g. "if the
// engagement is in_travel, show the in-trip dashboard") get compile-time
// coverage of the canonical set.
//
// S30E: TripStatus → EngagementStatus, TripStatusSlug → EngagementStatusSlug
// to mirror travel_trip_statuses → travel_engagement_statuses table rename.
// ItineraryStatus stays as-is — itinerary is journey-engagement-specific
// lifecycle, not universal. When product type #2 arrives, services likely
// bring a sibling status table (ServiceStatus) rather than reshape the
// universal one.

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
  levelLabel:                 string
  roomBasis:                  string
  roomBenefits:               string[]
  roomImageSrc:               string
  roomImageAlt:               string
  roomGallery?:               string[]
  floorplanSrc?:              string
  // S22: three-tier rate taxonomy
  publicNightlyRate?:         string   // direct/rack rate — struck-through in UI
  nonNegotiatedNightlyRate?:  string   // current published rate — was 'nightlyRate' pre-S22
  ambienceNightlyRate?:       string   // partner-negotiated rate — NULL until rates locked
  taxInclusive?:              boolean
  // S30F: free-text per-room rate suffix rendered after both rate chips.
  // Resolved override → canonical → undefined. NULL renders nothing.
  rateSuffix?:                string
  sqftMin?:                   number
  sqftMax?:                   number
  sqmMin?:                    number
  sqmMax?:                    number
}

export type ImmerseHotelOption = {
  id:           string   // S17: real DB UUID (canonical travel_accom_hotels.id)
  storageSlug:  string   // hotel_slug for storage path construction (/ambience-assets/.../accom/{slug}/)
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
  bulletsHeading?: string   // S23 addendum: small header above bullets (e.g. "Highlights")
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

// S23: Pricing closer row (final closer beneath the pricing table).
// All four fields nullable — null means "fall back to the frontend constant
// PRICING_CLOSER_DEFAULT in ImmerseDestinationComponents.tsx". Populated per
// engagement via 4 nullable override columns on travel_immerse_trip_destination_rows
// once a price has been quoted. Default closer reads "Pricing Based On
// Selection" in the indicative_range column with the other three blank.
export type ImmersePricingCloser = {
  item:            string | null
  basis:           string | null
  stay:            string | null
  indicativeRange: string | null
}

// S30: Proposal-wide welcome letter. Single canonical row shared across all
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

// ─── Region grouping (S21) ────────────────────────────────────────────────────
// Nordic Winter has 3 regions (Iceland, Norway, Finland). Europe Finale has
// 3 (Swiss Alps, Paris, French Alps). Each region carries its own positioning
// (rank, rank_label, bullets from travel_immerse_trip_regions) plus a list of
// hotel picks (from travel_immerse_trip_region_hotels). S30E: child tables
// retain "trip" prefix because their content is journey-engagement-specific.

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
// S30E: Renamed from "Trip overview". The master page surface is the same;
// the data shape now identifies as engagement and carries engagementType.
// Journey-shape detail types (ImmerseTripFormat, ImmerseRouteStop,
// ImmerseDestinationRow, ImmerseTripPricingRow) keep "trip" naming because
// they describe journey-engagement-specific content.

export type ImmerseTripFormat = 'journey' | 'experience'

// S20: Per-engagement per-destination subpage render state
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
  subpageStatus: ImmerseSubpageStatus  // S20: render state — live | preview | hidden
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
  engagementType:  EngagementType        // S30E: 'journey' | 'service' | 'experience' | 'acquisition'
  urlId:           string
  slug:            string
  tripFormat:      ImmerseTripFormat     // journey-engagement format detail
  journeyTypes:    string[]
  clientName:      string
  statusLabel:     string                // guest-facing display copy (e.g. 'Designed For You · January 2027')
  // status (S30D, renamed S30E) — operator-facing lifecycle, distinct from statusLabel
  engagementStatus:  EngagementStatus
  itineraryStatus:   ItineraryStatus
  // welcome (S30)
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
  destinationId:   string   // S17: UUID — primary DB identity
  destinationSlug: string   // S17: URL-facing slug (e.g. "new-york")
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
  // hotels — S21: flat OR region-grouped depending on destination
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
  pricingCloser:       ImmersePricingCloser  // S23: per-engagement overlay of canonical default closer
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        string[]
}