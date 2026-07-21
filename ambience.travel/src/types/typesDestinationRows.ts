// Destination-row types for the engagement destination-rows editor.
// Backed by travel_overlay_engagement_destination_rows via the engagement
// admin EFs. Camel throughout (EFs camelize).
export type DestinationRow = {
  id:                   string
  engagementId:         string
  destinationId:        string | null
  globalDestinationId:  string
  destinationSlug:      string | null
  destinationName:      string | null
  numberLabel:          string | null
  title:                string | null
  mood:                 string | null
  summary:              string | null
  stayLabel:            string | null
  imageSrc:             string | null
  imageAlt:             string | null
  sortOrder:            number
  subpageStatus:        'live' | 'preview'
  heroImageSrcOverride:   string | null
  heroImageAltOverride:   string | null
  heroImageSrc2Override:  string | null
  heroImageAlt2Override:  string | null
  heroTitle2Override:     string | null
  heroSubtitle2Override:  string | null
  introTitleOverride:   string | null
  introBodyOverride:    string | null
  pricingBodyOverride:                  string | null
  pricingNotesHeadingOverride:          string | null
  pricingNotesTitleOverride:            string | null
  pricingNotesOverride:                 unknown
  pricingCloserItemOverride:            string | null
  pricingCloserBasisOverride:           string | null
  pricingCloserStayOverride:            string | null
  pricingCloserIndicativeRangeOverride: string | null
  diningEyebrowOverride: string | null
  diningTitleOverride:   string | null
  diningBodyOverride:    string | null
  createdAt: string
  updatedAt: string
}
export type DestinationOption = {
  id:          string
  slug:        string
  name:        string
  storagePath: string | null
}
export type AddDestinationPayload = {
  engagementId:        string
  globalDestinationId: string
  title:               string
  sortOrder:           number
  subpageStatus?:      'live' | 'preview'
}
