// immerseTypes.ts — shared types for the ambience.travel /immerse/ proposal system
// Owns all data contracts for journey overview and destination subpages.
// Does not own rendering, routing, or theme tokens.
// Last updated: S10

// ─── Shared primitives ────────────────────────────────────────────────────────

export type ImmerseHotelOption = {
  id:             string
  rank:           'primary' | 'secondary'
  rankLabel:      string
  name:           string
  tagline:        string
  description:    string
  bullets:        string[]
  nightlyRange:   string
  nightlyNote:    string
  imageSrc:       string
  imageAlt:       string
  roomCategory:   string
  roomBasis:      string
  roomBenefits:   string[]
  roomImageSrc:   string
  roomImageAlt:   string
  stayLabel:      string
}

export type ImmerseContentCard = {
  id:       string
  kicker:   string
  name:     string
  tagline:  string
  body:     string
  imageSrc: string
  imageAlt: string
}

export type ImmersePricingRow = {
  id:             string
  item:           string
  basis:          string
  stay:           string
  indicativeRange: string
  isTotal?:       boolean
}

// ─── Journey overview (master page) ──────────────────────────────────────────

export type ImmerseRouteStop = {
  id:         string
  title:      string
  stayLabel:  string
  note:       string
  imageSrc:   string
  imageAlt:   string
}

export type ImmerseDestinationRow = {
  id:          string
  numberLabel: string
  title:       string
  mood:        string
  summary:     string
  stayLabel:   string
  imageSrc:    string
  imageAlt:    string
  href:        string
}

export type ImmerseJourneyPricingRow = {
  id:              string
  destination:     string
  recommendedBasis: string
  stayLabel:       string
  indicativeRange: string
}

export type ImmerseJourneyData = {
  // meta
  journeyId:    string
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
  pricingHeading:     string
  pricingTitle:       string
  pricingBody:        string
  pricingRows:        ImmerseJourneyPricingRow[]
  pricingTotalLabel:  string
  pricingTotalValue:  string
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        string[]
}

// ─── Destination subpage ──────────────────────────────────────────────────────

export type ImmerseDestinationData = {
  // meta
  destinationId: string
  journeyId:     string
  // hero
  eyebrow:       string
  title:         string
  subtitle:      string
  heroImageSrc:  string
  heroImageAlt:  string
  heroPills:     string[]
  // intro
  introEyebrow:  string
  introTitle:    string
  introBody:     string
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
  pricingEyebrow:    string
  pricingTitle:      string
  pricingBody:       string
  pricingRows:       ImmersePricingRow[]
  pricingNotesHeading: string
  pricingNotesTitle:   string
  pricingNotes:        string[]
}
