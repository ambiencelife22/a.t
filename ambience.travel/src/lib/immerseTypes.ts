// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for trip overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
// Last updated: S23 addendum — Added bulletsHeading to ImmerseContentCard.
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
// trip via 4 nullable override columns on travel_immerse_trip_destination_rows
// once a price has been quoted. Default closer reads "Pricing Based On
// Selection" in the indicative_range column with the other three blank.
export type ImmersePricingCloser = {
  item:            string | null
  basis:           string | null
  stay:            string | null
  indicativeRange: string | null
}

// ─── Region grouping (S21) ────────────────────────────────────────────────────
// Nordic Winter has 3 regions (Iceland, Norway, Finland). Europe Finale has
// 3 (Swiss Alps, Paris, French Alps). Each region carries its own positioning
// (rank, rank_label, bullets from travel_immerse_trip_regions) plus a list of
// hotel picks (from travel_immerse_trip_region_hotels).

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

// ─── Trip overview (master page) ─────────────────────────────────────────────

export type ImmerseTripFormat = 'journey' | 'experience'

// S20: Per-trip per-destination subpage render state
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

export type ImmerseTripData = {
  // meta
  tripId:       string
  urlId:        string
  slug:         string
  tripFormat:   ImmerseTripFormat
  journeyTypes: string[]
  clientName:   string
  statusLabel:  string
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
  pricingCloser:       ImmersePricingCloser  // S23: per-trip overlay of canonical default closer
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        string[]
}