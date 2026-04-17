// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for trip overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
// Last updated: S17 — UUID-first identity across all tables
//   - ImmerseDestinationData.destinationId is now the destination UUID
//   - ImmerseDestinationData.destinationSlug is the URL-facing slug (new field)
//   - ImmerseHotelOption.id is now the hotel UUID (was hotel_slug); storageSlug added
//   - Secondary hero fields (heroImageSrc2 et al) wired throughout

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
  id:           string   // S17: real DB UUID (was hotel_slug)
  storageSlug:  string   // S17: hotel_slug for storage path construction (/ambience-assets/.../accom/{slug}/)
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

// ─── Trip overview (master page) ─────────────────────────────────────────────

export type ImmerseTripFormat = 'journey' | 'experience'

export type ImmerseRouteStop = {
  id:        string
  title:     string
  stayLabel: string
  note:      string
  imageSrc:  string
  imageAlt:  string
}

export type ImmerseDestinationRow = {
  id:              string
  numberLabel:     string
  title:           string
  mood:            string
  summary:         string
  stayLabel:       string
  imageSrc:        string
  imageAlt:        string
  destinationId:   string | null   // S17: UUID — primary key
  destinationSlug: string | null   // S17: hydrated via JOIN for URL building
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
  routeStops:   ImmerseRouteStop[]
  // destinations
  destinationHeading: string
  destinationRows:    ImmerseDestinationRow[]
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
  // hotels
  hotelsEyebrow: string
  hotelsTitle:   string
  hotelsBody:    string
  hotels:        ImmerseHotelOption[]
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