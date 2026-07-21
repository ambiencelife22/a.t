// Geo lookup types for the admin location cascade (subcontinent -> country ->
// state -> destination -> hotel). Sourced from global_* + travel_accom_hotels
// via travel-read-engagement-admin geo modes. Camel throughout (EF camelizes).
export type GeoSubcontinent = {
  id:   string
  slug: string
  name: string
}
export type GeoCountry = {
  id:              string
  slug:            string
  name:            string
  subcontinentId:  string
}
export type GeoState = {
  id:        string
  slug:      string
  name:      string
  code:      string
  countryId: string
}
export type GeoDestination = {
  id:             string
  slug:           string
  name:           string
  subcontinentId: string | null
  countryId:      string | null
  stateId:        string | null
  storagePath:    string | null
}
export type GeoHotel = {
  id:            string
  shortSlug:     string
  name:          string
  destinationId: string | null
}
export type HotelPick = { id: string; name: string; city: string | null }
