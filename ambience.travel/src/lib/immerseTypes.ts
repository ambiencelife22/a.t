// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for trip overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
// Last updated: S14 — trip renaming: ImmerseJourneyData → ImmerseTripData, destination row links via slug

// ─── Shared primitives ────────────────────────────────────────────────────────

export type ImmerseRoomOption = {
  levelLabel:         string
  roomBasis:          string
  roomBenefits:       string[]
  roomImageSrc:       string
  roomImageAlt:       string
  nightlyRate?:       string   // indicative nightly rate shown in room panel
  publicNightlyRate?: string   // publicly listed rate for context
  sqft?:              number
  sqm?:               number
}

export type ImmerseHotelOption = {
  id:       string
  rank:     'primary' | 'secondary'
  rankLabel: string
  name:     string
  bullets:  string[]
  imageSrc: string
  imageAlt: string
  stayLabel: string
  rooms:            ImmerseRoomOption[]
  gallery?:         string[]
  imageCredit?:     string   // photographer or rights holder — e.g. "Aman Resorts"
  imageCreditUrl?:  string   // acquireLicensePage — e.g. "https://www.aman.com"
  imageLicense?:    string   // license URL — inferred for Unsplash if omitted
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
  imageCredit?:    string   // photographer or rights holder
  imageCreditUrl?: string   // acquireLicensePage
  imageLicense?:   string   // license URL — inferred for Unsplash if omitted
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
  // When set, overview renders /immerse/{urlId}/{destinationSlug}.
  // When null, the card renders without a subpage link.
  destinationSlug: string | null
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
  tripId:       string        // DB uuid
  urlId:        string        // 11-char public key
  slug:         string        // internal admin slug, e.g. 'yazeed-honeymoon'
  tripFormat:   ImmerseTripFormat
  journeyTypes: string[]      // display metadata — ['honeymoon'], ['family'], etc.
  clientName:   string
  statusLabel:  string
  // hero
  eyebrow:      string
  title:        string
  subtitle:     string
  heroImageSrc: string
  heroImageAlt: string
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
  destinationId: string
  journeyId:     string   // journey-type slug reference (e.g. 'honeymoon') — template key
  shorthand?:    string   // e.g. "NYC" — display shorthand for the destination
  // hero
  eyebrow:      string
  title:        string
  subtitle:     string
  heroImageSrc: string
  heroImageAlt: string
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