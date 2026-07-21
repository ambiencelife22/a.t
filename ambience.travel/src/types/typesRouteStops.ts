// Route-stop types for the engagement route-stops editor.
// Backed by travel_overlay_route_stops via the engagement admin EFs.
// Camel throughout (EFs camelize). Note sort_order is 0-indexed for this table.
export type RouteStop = {
  id:               string
  engagementId:     string
  sortOrder:        number
  title:            string | null
  stayLabel:        string | null
  note:             string | null
  imageSrc:         string | null
  imageAlt:         string | null
  destinationRowId: string | null
  nights:           number | null
  createdAt:        string
  updatedAt:        string
}
export type RouteStopCreatePayload = {
  engagementId: string
  sortOrder:    number
  title?:       string | null
  stayLabel?:   string | null
  note?:        string | null
  imageSrc?:    string | null
  imageAlt?:    string | null
}
