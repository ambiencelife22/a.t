// Room types for the engagement overlay-rooms editor + canonical room lookup.
// Backed by travel_overlay_rooms / travel_accom_rooms / travel_rate_cadences
// via the engagement admin EFs. Camel throughout (EFs camelize).
export interface RateCadence {
  id:        string
  slug:      string
  label:     string
  sortOrder: number
}
export interface CanonicalRoom {
  id:                    string
  hotelId:               string
  roomName:              string | null
  slug:                  string | null
  categorySlug:          string | null
  bedConfig:             string | null
  beddingConfigurations: string[] | null
  sqftMin:               number | null
  sqftMax:               number | null
  sqmMin:                number | null
  sqmMax:                number | null
  roomImageSrc:          string | null
  hotelName:             string | null
}
export interface OverlayRoom {
  id:                       string
  engagementId:             string
  roomId:                   string | null
  levelLabel:               string | null
  roomBasis:                string | null
  roomBenefits:             string[] | null
  nonNegotiatedNightlyRate: string | null
  ambienceNightlyRate:      string | null
  publicNightlyRate:        string | null
  rateCadenceId:            string | null
  rateSuffixOverride:       string | null
  taxInclusive:             boolean
  roomInclusions:           string | null
  roomNameOverride:         string | null
  sqftMin:                  number | null
  sqftMax:                  number | null
  sqmMin:                   number | null
  sqmMax:                   number | null
  sqftMinOverride:          number | null
  sqftMaxOverride:          number | null
  sqmMinOverride:           number | null
  sqmMaxOverride:           number | null
  bedConfigOverride:        string | null
  beddingType:              string | null
  heroImageSrcOverride:     string | null
  heroImageAltOverride:     string | null
  floorplanSrcOverride:     string | null
  isActive:                 boolean | null
  sortOrder:                number
  canonicalRoomName:        string | null
  canonicalHotelName:       string | null
}
export type OverlayRoomPatch = Partial<Omit<OverlayRoom,
  'id' | 'engagementId' | 'canonicalRoomName' | 'canonicalHotelName'
>>
export type OverlayRoomCreate = {
  engagementId: string
  roomId:       string | null
  levelLabel:   string | null
  sortOrder:    number
  isActive:     boolean
}
