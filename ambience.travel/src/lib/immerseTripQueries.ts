// immerseTripQueries.ts — Supabase query layer for immerse trip master data
// Owns:
//   - getImmerseTrip(urlId)        — full ImmerseTripData fetch by public url_id
//   - getImmerseTripBySlug(slug)   — full ImmerseTripData fetch by slug
//                                    (used for public previews like /immerse/honeymoon/)
// Does not own: destination subpage data (see immerseQueries.ts)
// Last updated: S17 — Extracted hydrateTrip helper; added getImmerseTripBySlug
//   for public honeymoon preview row (slug = 'honeymoon1'). Both entry points
//   share TRIP_SELECT_COLUMNS + hydrateTrip() so response shape is identical.

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
  person_id:              string | null
  status_label:           string | null
  eyebrow:                string | null
  title:                  string | null
  subtitle:               string | null
  hero_image_src:         string | null
  hero_image_alt:         string | null
  hero_image_src_2:       string | null
  hero_image_alt_2:       string | null
  hero_title_2:           string | null
  hero_subtitle_2:        string | null
  hero_pills:             string[] | null
  route_heading:          string | null
  route_body:             string | null
  route_eyebrow:          string | null
  destination_heading:    string | null
  destination_subtitle:   string | null
  destination_body:       string | null
  pricing_heading:        string | null
  pricing_title:          string | null
  pricing_body:           string | null
  pricing_total_label:    string | null
  pricing_total_value:    string | null
  pricing_notes_heading:  string | null
  pricing_notes_title:    string | null
  pricing_notes:          string[] | null
}

type PersonDisplayRow = {
  id:         string
  first_name: string | null
  last_name:  string | null
  nickname:   string | null
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

// S17 Phase 5A: still reads destination_slug directly (no JOIN yet)
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

// Column list reused by both entry points (by url_id, by slug)
const TRIP_SELECT_COLUMNS = `
  id, url_id, slug, trip_format, journey_types,
  person_id, status_label,
  eyebrow, title, subtitle,
  hero_image_src, hero_image_alt, hero_image_src_2, hero_image_alt_2,
  hero_title_2, hero_subtitle_2, hero_pills,
  route_heading, route_body, route_eyebrow,
  destination_heading, destination_subtitle, destination_body,
  pricing_heading, pricing_title, pricing_body,
  pricing_total_label, pricing_total_value,
  pricing_notes_heading, pricing_notes_title, pricing_notes
`

// Fetch trip by public url_id (private / token-keyed trips like Yazeed)
export async function getImmerseTrip(urlId: string): Promise<ImmerseTripData | null> {
  const { data: trip, error: tripErr } = await supabaseAnon
    .from('travel_immerse_trips')
    .select(TRIP_SELECT_COLUMNS)
    .eq('url_id', urlId)
    .single()

  if (tripErr || !trip) return null
  return hydrateTrip(trip as TripRow)
}

// Fetch trip by slug (public preview rows like 'honeymoon1'; no url_id)
export async function getImmerseTripBySlug(slug: string): Promise<ImmerseTripData | null> {
  const { data: trip, error: tripErr } = await supabaseAnon
    .from('travel_immerse_trips')
    .select(TRIP_SELECT_COLUMNS)
    .eq('slug', slug)
    .single()

  if (tripErr || !trip) return null
  return hydrateTrip(trip as TripRow)
}

// ── Shared hydration ─────────────────────────────────────────────────────────
// Once we have the trip row, the follow-on fetches (person, routes, dests,
// pricing) and the response shape are identical regardless of how we looked
// up the trip.

async function hydrateTrip(tripRow: TripRow): Promise<ImmerseTripData | null> {
  const tripId = tripRow.id

  const [personRes, stopsRes, destsRes, pricingRes] = await Promise.all([
    tripRow.person_id
      ? supabaseAnon
          .from('global_people_display')
          .select('id, first_name, last_name, nickname')
          .eq('id', tripRow.person_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabaseAnon
      .from('travel_immerse_route_stops')
      .select('id, sort_order, title, stay_label, note, image_src, image_alt')
      .eq('trip_id', tripId)
      .order('sort_order'),
    supabaseAnon
      .from('travel_immerse_trip_destination_rows')
      .select('id, sort_order, number_label, title, mood, summary, stay_label, image_src, image_alt, destination_slug')
      .eq('trip_id', tripId)
      .order('sort_order'),
    supabaseAnon
      .from('travel_immerse_trip_pricing_rows')
      .select('id, sort_order, destination, recommended_basis, stay_label, indicative_range')
      .eq('trip_id', tripId)
      .order('sort_order'),
  ])

  const personRow  = (personRes.data  ?? null) as PersonDisplayRow | null
  const stopRows   = (stopsRes.data   ?? []) as RouteStopRow[]
  const destRows   = (destsRes.data   ?? []) as unknown as DestinationRowRow[]
  const priceRows  = (pricingRes.data ?? []) as PricingRowRow[]

  const clientName = personRow?.nickname
    ?? personRow?.first_name
    ?? 'Our VIP Guest'

  const routeStops: ImmerseRouteStop[] = stopRows.map(r => ({
    id:        r.id,
    title:     r.title      ?? '',
    stayLabel: r.stay_label ?? '',
    note:      r.note       ?? '',
    imageSrc:  r.image_src  ?? '',
    imageAlt:  r.image_alt  ?? '',
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
    destinationId:   null,  // S17 Phase 5A: not yet in DB; Phase 5C will populate via JOIN
    destinationSlug: r.destination_slug,
  }))

  const tripPricingRows: ImmerseTripPricingRow[] = priceRows.map(r => ({
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
    clientName,
    statusLabel:   tripRow.status_label ?? '',

    eyebrow:       tripRow.eyebrow        ?? '',
    title:         tripRow.title          ?? '',
    subtitle:      tripRow.subtitle       ?? '',
    heroImageSrc:  tripRow.hero_image_src ?? '',
    heroImageAlt:  tripRow.hero_image_alt ?? '',
    heroImageSrc2: tripRow.hero_image_src_2 ?? undefined,
    heroImageAlt2: tripRow.hero_image_alt_2 ?? undefined,
    heroTitle2:    tripRow.hero_title_2    ?? undefined,
    heroSubtitle2: tripRow.hero_subtitle_2 ?? undefined,
    heroPills:     tripRow.hero_pills     ?? [],

    routeHeading:  tripRow.route_heading ?? '',
    routeBody:     tripRow.route_body    ?? '',
    routeEyebrow:  tripRow.route_eyebrow ?? undefined,
    routeStops,

    destinationHeading:   tripRow.destination_heading   ?? '',
    destinationSubtitle:  tripRow.destination_subtitle  ?? undefined,
    destinationBody:      tripRow.destination_body      ?? undefined,
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