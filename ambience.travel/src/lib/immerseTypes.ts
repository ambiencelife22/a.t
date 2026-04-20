// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for trip overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
// Last updated: S21 — ImmerseDestinationHotelsShape discriminated union.
//   Destinations can render hotels flat (NYC, St-Barths) or grouped by region
//   (Nordic Winter, Europe Finale). Region-grouped reads now flow through
//   travel_immerse_trip_region_hotels keyed on canonical trip_id.

// ─── Shared primitives ────────────────────────────────────────────────────────

export type ImmerseRoomOption = {
  levelLabel:          string
  roomBasis:           string
  roomBenefits:        string[]
  roomImageSrc:        string
  roomImageAlt:        string
  roomGallery?:        string[]
  floorplanSrc?:       string
  nightlyRate?:        string
  publicNightlyRate?:  string
  taxInclusive?:       boolean
  sqftMin?:            number
  sqftMax?:            number
  sqmMin?:             number
  sqmMax?:             number
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
  // activities
  activitiesEyebrow: string
  activitiesTitle:   string
  activitiesBody:    string
  activities:        ImmerseContentCard[]
  // pricing
  pricingEyebrow:      string
  pricingTitle:        string
  pricingBody:         string
  pricingRows:         ImmersePricingRow[]
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        string[]
}