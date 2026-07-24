// Admin guide types for the guide-admin surfaces (dining / experiences / hotels
// / shopping venues + guides + grants). Backed by travel_*_venues / travel_*_guides
// / travel_*_guide_grants via the guide-admin EFs. Camel throughout (EFs camelize).
import type { GlobalPersonResolved } from './typesGlobalPeople'

// GlobalPerson resolved shape imported above

export interface DestinationOption {
  id:   string
  slug: string
  name: string
}
export type MichelinAward = 'star' | 'bib_gourmand'

export interface DestinationWithDiningCounts {
  id:         string
  venueCount: number
  hasOverlay: boolean
}
export interface DestinationWithExperiencesCounts {
  id:         string
  venueCount: number
  hasOverlay: boolean
}
export interface DestinationWithHotelCounts {
  id:         string
  hotelCount: number
  hasOverlay: boolean
}
export interface DestinationWithShoppingCounts {
  id:        string
  shopCount: number
  hasOverlay: boolean
}

export interface AdminDiningVenue {
  id:                  string
  globalDestinationId: string
  name:                string
  cuisineSubcategory:  string | null
  kicker:              string | null
  tagline:             string | null
  body:                string | null
  bulletsHeading:      string | null
  bullets:             string[] | null
  michelinAward:       MichelinAward | null
  michelinStars:       number | null
  michelinGreenStar:   boolean
  worlds50Best:        boolean
  address:             string | null
  mapsUrl:             string | null
  website:             string | null
  neighborhood:        string | null
  priceBand:           string | null
  publicPreviewRank:   number | null
  tags:                string[] | null
  imageSrc:            string | null
  imageAlt:            string | null
  imageCredit:         string | null
  imageCreditUrl:      string | null
  imageLicense:        string | null
  image2Src:           string | null
  image2Alt:           string | null
  isActive:            boolean
  sortOrder:           number
}
export interface AdminExperienceVenue {
  id:                  string
  globalDestinationId: string
  name:                string
  kicker:              string | null
  tagline:             string | null
  body:                string | null
  bulletsHeading:      string | null
  bullets:             string[] | null
  address:             string | null
  mapsUrl:             string | null
  imageSrc:            string | null
  imageAlt:            string | null
  imageCredit:         string | null
  imageCreditUrl:      string | null
  imageLicense:        string | null
  isActive:            boolean
  sortOrder:           number
}
export interface AdminHotel {
  id:                  string
  globalDestinationId: string
  name:                string
  shortSlug:           string
  heroImageSrc:        string | null
  heroImageAlt:        string | null
  bullets:             string[] | null
  sortOrder:           number
  isActive:            boolean
  isPreferredPartner:  boolean
  isSupplementary:     boolean
  stars:               number | null
  michelinKeys:        number | null
  forbesRating:        number | null
  description:         string | null
  internalNotes:       string | null
  address:             string | null
  city:                string | null
  zipCode:             string | null
  latitude:            number | null
  longitude:           number | null
  googleMapsUrl:       string | null
  website:             string | null
  phone:               string | null
  reservationsPhone:   string | null
  mainEmail:           string | null
  reservationsEmail:   string | null
  salesEmail:          string | null
  conciergeEmail:      string | null
  guestRelationsEmail: string | null
  frontOfficeEmail:    string | null
  imageCredit:         string | null
  imageCreditUrl:      string | null
  imageLicense:        string | null
}
export interface AdminShop {
  id:                  string
  globalDestinationId: string
  name:                string
  brand:               string | null
  shopType:            string | null
  tagline:             string | null
  body:                string | null
  bullets:             unknown
  address:             string | null
  mapsUrl:             string | null
  byAppointment:       boolean
  imageSrc:            string | null
  imageAlt:            string | null
  imageCredit:         string | null
  imageCreditUrl:      string | null
  imageLicense:        string | null
  isActive:            boolean
  sortOrder:           number
}

interface AdminGuideBase {
  id:                   string
  globalDestinationId:  string
  heroImageSrc:         string | null
  heroImageAlt:         string | null
  eyebrowOverride:      string | null
  headlineOverride:     string | null
  introOverride:        string | null
  isActive:             boolean
  accuracyDate:         string | null
  atAGlanceBullets:     string[] | null
  guideYear:            number | null
  guideVersion:         string | null
  planYourVisitHeading: string | null
  planYourVisitIntro:   string | null
  planYourVisitBullets: string[] | null
}
export type AdminDiningGuide = AdminGuideBase
export type AdminExperiencesGuide = AdminGuideBase
export type AdminHotelGuide = AdminGuideBase
export type AdminShoppingGuide = AdminGuideBase

export interface AdminGrant {
  id:                  string
  userId:              string
  globalDestinationId: string
  grantedAt:           string
  person:              GlobalPersonResolved | null
}
export type AdminExperiencesGrant = AdminGrant

export type DiningVenuePatch = Partial<Omit<AdminDiningVenue, 'id'>>
export type HotelPatch = Partial<Omit<AdminHotel, 'id'>>
export type DiningGuidePatch = Partial<Omit<AdminDiningGuide, 'id' | 'globalDestinationId'>>
export type ExperiencesGuidePatch = Partial<Omit<AdminExperiencesGuide, 'id' | 'globalDestinationId'>>
export type HotelGuidePatch = Partial<Omit<AdminHotelGuide, 'id' | 'globalDestinationId'>>
export type ShoppingGuidePatch = Partial<Omit<AdminShoppingGuide, 'id' | 'globalDestinationId'>>

export interface IngestVenueRecord {
  name:         string
  subCategory?: string
  address?:     string
  website?:     string
  description?: string
  tags?:        string[]
}
export interface IngestPayload {
  destination?: string
  contentType?: string
  restaurants:  IngestVenueRecord[]
}
export interface IngestResult {
  inserted: number
  skipped:  Array<{ name: string; reason: string }>
}
