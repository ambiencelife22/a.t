// immerseTripQueries.ts — Supabase query layer for immerse trip master data
// Owns: getImmerseTrip(urlId) — full ImmerseTripData fetch by public url_id
// Does not own: destination subpage data (see immerseQueries.ts)
// Last updated: S14

import { supabaseAnon } from './supabase'
import type {
  ImmerseTripData,
  ImmerseTripFormat,
  ImmerseRouteStop,
  ImmerseDestinationRow,
  ImmerseTripPricingRow,
} from './immerseTypes'

// ── DB row types ─────────────────────────────────────────────────────────────

type TripRow = {
  id:                     string
  url_id:                 string
  slug:                   string
  trip_format:            string
  journey_types:          string[] | null
  client_name:            string | null
  status_label:           string | null
  eyebrow:                string | null
  title:                  string | null
  subtitle:               string | null
  hero_image_src:         string | null
  hero_image_alt:         string | null
  hero_pills:             string[] | null
  route_heading:          string | null
  route_body:             string | null
  destination_heading:    string | null
  pricing_heading:        string | null
  pricing_title:          string | null
  pricing_body:           string | null
  pricing_total_label:    string | null
  pricing_total_value:    string | null
  pricing_notes_heading:  string | null
  pricing_notes_title:    string | null
  pricing_notes:          string[] | null
}

type RouteStopRow = {
  id:         string
  sort_order: number
  title:      string | null
  stay_label: string | null
  note:       string | null
  image_src:  string | null
  image_alt:  string | null
}

type DestinationRowRow = {
  id:                string
  sort_order:        number
  number_label:      string | null
  title:             string | null
  mood:              string | null
  summary:           string | null
  stay_label:        string | null
  image_src:         string | null
  image_alt:         string | null
  destination_slug:  string | null
}

type PricingRowRow = {
  id:                 string
  sort_order:         number
  destination:        string | null
  recommended_basis:  string | null
  stay_label:         string | null
  indicative_range:   string | null
}

// ── Public fetch ─────────────────────────────────────────────────────────────

export async function getImmerseTrip(urlId: string): Promise<ImmerseTripData | null> {
  const { data: trip, error: tripErr } = await supabaseAnon
    .from('immerse_trips')
    .select(`
      id, url_id, slug, trip_format, journey_types,
      client_name, status_label,
      eyebrow, title, subtitle,
      hero_image_src, hero_image_alt, hero_pills,
      route_heading, route_body,
      destination_heading,
      pricing_heading, pricing_title, pricing_body,
      pricing_total_label, pricing_total_value,
      pricing_notes_heading, pricing_notes_title, pricing_notes
    `)
    .eq('url_id', urlId)
    .single()

  if (tripErr || !trip) return null

  const tripRow = trip as TripRow
  const tripId  = tripRow.id

  const [stopsRes, destsRes, pricingRes] = await Promise.all([
    supabaseAnon
      .from('immerse_route_stops')
      .select('id, sort_order, title, stay_label, note, image_src, image_alt')
      .eq('trip_id', tripId)
      .order('sort_order'),
    supabaseAnon
      .from('immerse_trip_destination_rows')
      .select('id, sort_order, number_label, title, mood, summary, stay_label, image_src, image_alt, destination_slug')
      .eq('trip_id', tripId)
      .order('sort_order'),
    supabaseAnon
      .from('immerse_trip_pricing_rows')
      .select('id, sort_order, destination, recommended_basis, stay_label, indicative_range')
      .eq('trip_id', tripId)
      .order('sort_order'),
  ])

  const stopRows    = (stopsRes.data    ?? []) as RouteStopRow[]
  const destRows    = (destsRes.data    ?? []) as DestinationRowRow[]
  const pricingRows = (pricingRes.data  ?? []) as PricingRowRow[]

  const routeStops: ImmerseRouteStop[] = stopRows.map(r => ({
    id:        r.id,
    title:     r.title     ?? '',
    stayLabel: r.stay_label ?? '',
    note:      r.note      ?? '',
    imageSrc:  r.image_src ?? '',
    imageAlt:  r.image_alt ?? '',
  }))

  const destinationRows: ImmerseDestinationRow[] = destRows.map(r => ({
    id:              r.id,
    numberLabel:     r.number_label ?? '',
    title:           r.title        ?? '',
    mood:            r.mood         ?? '',
    summary:         r.summary      ?? '',
    stayLabel:       r.stay_label   ?? '',
    imageSrc:        r.image_src    ?? '',
    imageAlt:        r.image_alt    ?? '',
    destinationSlug: r.destination_slug,
  }))

  const tripPricingRows: ImmerseTripPricingRow[] = pricingRows.map(r => ({
    id:               r.id,
    destination:      r.destination        ?? '',
    recommendedBasis: r.recommended_basis  ?? '',
    stayLabel:        r.stay_label         ?? '',
    indicativeRange:  r.indicative_range   ?? '',
  }))

  return {
    tripId:        tripRow.id,
    urlId:         tripRow.url_id,
    slug:          tripRow.slug,
    tripFormat:    (tripRow.trip_format as ImmerseTripFormat) ?? 'journey',
    journeyTypes:  tripRow.journey_types ?? [],
    clientName:    tripRow.client_name   ?? '',
    statusLabel:   tripRow.status_label  ?? '',

    eyebrow:       tripRow.eyebrow        ?? '',
    title:         tripRow.title          ?? '',
    subtitle:      tripRow.subtitle       ?? '',
    heroImageSrc:  tripRow.hero_image_src ?? '',
    heroImageAlt:  tripRow.hero_image_alt ?? '',
    heroPills:     tripRow.hero_pills     ?? [],

    routeHeading:  tripRow.route_heading ?? '',
    routeBody:     tripRow.route_body    ?? '',
    routeStops,

    destinationHeading: tripRow.destination_heading ?? '',
    destinationRows,

    pricingHeading:      tripRow.pricing_heading       ?? '',
    pricingTitle:        tripRow.pricing_title         ?? '',
    pricingBody:         tripRow.pricing_body          ?? '',
    pricingRows:         tripPricingRows,
    pricingTotalLabel:   tripRow.pricing_total_label   ?? '',
    pricingTotalValue:   tripRow.pricing_total_value   ?? '',
    pricingNotesHeading: tripRow.pricing_notes_heading ?? '',
    pricingNotesTitle:   tripRow.pricing_notes_title   ?? '',
    pricingNotes:        tripRow.pricing_notes         ?? [],
  }
}