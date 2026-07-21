/* typesCards.ts
 * Single source for engagement content-card types (dining/experience cards
 * selected + overridden onto an engagement proposal).
 * DB -> EF (camelizes) -> these types -> queries -> frontend.
 */

export type CardKind = 'dining' | 'experience'

export interface CardCanonicalOption {
  id:                    string
  kind:                  CardKind
  name:                  string
  imageSrc:              string | null
  globalDestinationSlug: string | null
}

export interface CardOverride {
  id:                      string
  engagementId:            string
  diningVenueId:           string | null
  experienceId:            string | null
  kind:                    CardKind
  canonicalName:           string | null
  canonicalImageSrc:       string | null
  canonicalGlobalDestSlug: string | null
  kickerOverride:          string | null
  nameOverride:            string | null
  taglineOverride:         string | null
  bodyOverride:            string | null
  bulletsHeadingOverride:  string | null
  bulletsOverride:         unknown
  imageSrcOverride:        string | null
  imageAltOverride:        string | null
  imageCreditOverride:     string | null
  imageCreditUrlOverride:  string | null
  imageLicenseOverride:    string | null
  isActive:                boolean
}

export interface CardCanonJoin {
  name:               string | null
  imageSrc:           string | null
  globalDestinations: { slug: string | null } | null
}

export interface CardOverrideRow {
  id:                      string
  engagementId:            string
  diningVenueId:           string | null
  experienceId:            string | null
  kickerOverride:          string | null
  nameOverride:            string | null
  taglineOverride:         string | null
  bodyOverride:            string | null
  bulletsHeadingOverride:  string | null
  bulletsOverride:         unknown
  imageSrcOverride:        string | null
  imageAltOverride:        string | null
  imageCreditOverride:     string | null
  imageCreditUrlOverride:  string | null
  imageLicenseOverride:    string | null
  isActive:                boolean
  dining:     CardCanonJoin | null
  experience: CardCanonJoin | null
}

export interface CardSelection {
  id:                      string
  engagementId:            string
  sortOrder:               number
  isActive:                boolean
  diningVenueId:           string | null
  experienceId:            string | null
  kind:                    CardKind
  canonicalName:           string | null
  canonicalKicker:         string | null
  canonicalTagline:        string | null
  canonicalBody:           string | null
  canonicalBulletsHeading: string | null
  canonicalBullets:        string[] | null
  canonicalImageSrc:       string | null
  canonicalImageAlt:       string | null
  canonicalImageCredit:    string | null
  canonicalImageCreditUrl: string | null
  canonicalImageLicense:   string | null
  canonicalGlobalDestSlug: string | null
  overrideId:              string | null
  kickerOverride:          string | null
  nameOverride:            string | null
  taglineOverride:         string | null
  bodyOverride:            string | null
  bulletsHeadingOverride:  string | null
  bulletsOverride:         string[] | null
  imageSrcOverride:        string | null
  imageAltOverride:        string | null
  imageCreditOverride:     string | null
  imageCreditUrlOverride:  string | null
  imageLicenseOverride:    string | null
}

export interface CardCanonicalRow {
  name:               string | null
  kicker:             string | null
  tagline:            string | null
  body:               string | null
  bulletsHeading:     string | null
  bullets:            string[] | null
  imageSrc:           string | null
  imageAlt:           string | null
  imageCredit:        string | null
  imageCreditUrl:     string | null
  imageLicense:       string | null
  globalDestinations: { slug: string | null } | null
}

export interface CardSelectionRow {
  id:            string
  engagementId:  string
  sortOrder:     number
  isActive:      boolean
  diningVenueId: string | null
  experienceId:  string | null
  dining:        CardCanonicalRow | null
  experience:    CardCanonicalRow | null
}

export interface CardOverrideJoinRow {
  id:                     string
  diningVenueId:          string | null
  experienceId:           string | null
  kickerOverride:         string | null
  nameOverride:           string | null
  taglineOverride:        string | null
  bodyOverride:           string | null
  bulletsHeadingOverride: string | null
  bulletsOverride:        string[] | null
  imageSrcOverride:       string | null
  imageAltOverride:       string | null
  imageCreditOverride:    string | null
  imageCreditUrlOverride: string | null
  imageLicenseOverride:   string | null
}