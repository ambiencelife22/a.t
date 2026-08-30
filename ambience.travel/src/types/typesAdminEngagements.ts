// typesAdminEngagements.ts - types for the AmbienceAdmin engagement surfaces
// (list, detail, create/update, lookups). Backed by travel_engagements +
// travel_engagement_journey_detail via travel-read/write-engagement EFs.
// Camel throughout (EFs camelize). Extracted from queriesAdminEngagements.ts
// (S53K) so types own their layer per the DB > TYPES > QUERIES > FRONTEND chain.

export type EngagementListRow = {
  id:                   string
  urlId:               string | null
  title:                string | null
  audience:             'private' | 'public'
  isPublicTemplate:   boolean | null
  engagementStatusId: string
  itineraryStatusId:  string
  sortOrder:           number
  createdAt:           string
  iterationLabel:      string
  // Joined display fields (status lookups)
  engagementStatusSlug:  string | null
  engagementStatusLabel: string | null
  itineraryStatusSlug:   string | null
  itineraryStatusLabel:  string | null
  // Trip linkage (NULL when engagement isn't linked to a canonical trip)
  journeyId:           string | null
  engagementCode:      string | null
  tripPublicTitle: string | null
  tripStartDate:   string | null
  // Primary client on the linked trip (NULL when no trip OR no primary client)
  clientFirstName: string | null
  clientLastName:  string | null
  clientNickname:   string | null
  // Primary client id - needed for inline-edit writes from the group header
  clientId:         string | null
}

export type EngagementDetailRow = {
  // Identity
  id:                  string
  urlId:              string | null
  title:               string | null
  slug:                string | null
  iterationLabel:     string
  audience:            'private' | 'public'
  isPublic:           boolean
  isPublicTemplate:  boolean | null
  proposalVisibility: 'active' | 'archived'
  journeyTypes:       string[]
  sortOrder:          number
  // Linkage
  personId:           string | null
  journeyId:             string | null
  engagementTypeId:  string | null
  // Guest label (Step 11)
  publicLabelId:              string | null
  guestDisplayNameOverride:  string | null
  // Status
  engagementStatusId: string
  itineraryStatusId:  string
  statusLabel:         string | null
  // Hero primary
  eyebrow:         string | null
  heroTagline:    string | null
  subtitle:        string | null
  heroImageSrc:  string | null
  heroImageAlt:  string | null
  heroPills:      unknown // jsonb
  // Hero secondary
  heroTitle2:        string | null
  heroSubtitle2:     string | null
  heroImageSrc2:    string | null
  heroImageAlt2:    string | null
  // Route
  routeEyebrow: string | null
  routeHeading: string | null
  routeBody:    string | null
  // Destination
  destinationHeading:  string | null
  destinationSubtitle: string | null
  destinationBody:     string | null
  // Pricing
  pricingHeading:        string | null
  pricingTitle:          string | null
  pricingBody:           string | null
  pricingTotalLabel:    string | null
  pricingTotalValue:    string | null
  pricingNotesHeading:  string | null
  pricingNotesTitle:    string | null
  pricingNotes:          unknown // jsonb
  // Welcome overrides
  welcomeEyebrowOverride:      string | null
  welcomeTitleOverride:        string | null
  welcomeBodyOverride:         string | null
  welcomeSignoffBodyOverride: string | null
  welcomeSignoffNameOverride: string | null
  createdAt: string
  updatedAt: string
}

export type StatusLookup = {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
}

export type EngagementTypeLookup = {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
}

export type PersonOption = {
  id:         string
  firstName: string | null
  lastName:  string | null
  nickname:   string | null
}

export type EngagementOption = {
  id:         string
  engagementCode:  string
  startDate: string | null
}

export type ChildCounts = {
  destination_rows:        number
  pricingRows:            number
  destinationHotels:       number
  regionHotels:           number
  route_stops:             number
  card_selections:         number
  card_overrides:          number
  rooms:                   number
}

// ── Trip-grouped list shape ───────────────────────────────────────────────────
// The list tab consumes this - trips at top level, engagements as children.
// Orphans (engagements with journey_id NULL) collected into a synthetic group.
export type EngagementGroup = {
  // null when this is the orphan group
  journeyId:           string | null
  engagementCode:      string | null
  tripPublicTitle: string | null
  tripStartDate:   string | null
  clientId:         string | null
  clientDisplay:    string | null   // "Yazeed" or "Yazeed Last" or null
  // Raw client name fields - needed for inline-edit writes
  clientFirstName: string | null
  clientLastName:  string | null
  clientNickname:   string | null
  engagements:       EngagementListRow[]
}

export type HouseOption = { id: string; displayName: string; publicName: string | null }

export type EngagementHouseLink = {
  id: string; houseId: string; isPrimary: boolean; sortOrder: number
  aHouses: { displayName: string; publicName: string | null } | null
}

export type CandidateLabel = {
  id: string; houseId: string; key: string; displayName: string; isDefault: boolean
}

export type EngagementDetail = {
  row: EngagementDetailRow
  houses: EngagementHouseLink[]
  candidateLabels: CandidateLabel[]
}

export type WelcomeLetterCanonical = {
  eyebrow:       string | null
  title:         string | null
  body:          string | null
  signoffBody:  string | null
  signoffName:  string | null
}

// ── Trip create (drag-to-create-new-trip flow) ───────────────────────────────
export type EngagementCreatePayload = {
  journeyCode:       string
  public_title:    string | null
  startDate:      string | null   // ISO YYYY-MM-DD
  endDate:        string | null   // ISO YYYY-MM-DD
  currency:        string          // 'USD' default at DB layer
  primary_client_id: string | null
}

// ── Trip update (group-header inline edits for journey_code + public_title) ─────
export type EngagementUpdatePayload = {
  journey_code?:    string
  public_title?: string | null
}

export type PersonUpdatePayload = {
  first_name?: string | null
  last_name?:  string | null
  nickname?:   string | null
}