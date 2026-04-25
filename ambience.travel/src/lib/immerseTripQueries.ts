// immerseTripQueries.ts — Supabase query layer for immerse trip master data
// Owns:
//   - getImmerseTrip(urlId)        — full ImmerseTripData fetch by public url_id
//   - getImmerseTripBySlug(slug)   — full ImmerseTripData fetch by slug
//                                    (used for public previews like /immerse/honeymoon/)
// Does not own: destination subpage data (see immerseQueries.ts)
// Last updated: S30D — Trip + itinerary status FK lookups. travel_immerse_trips
//   now carries trip_status_id + itinerary_status_id (both NOT NULL FKs) into
//   travel_trip_statuses + travel_itinerary_statuses. Hydration resolves both
//   via Supabase nested select; ImmerseTripData carries tripStatus +
//   itineraryStatus as full TripStatus / ItineraryStatus objects (id, slug,
//   label, sortOrder, isActive). Existing statusLabel free-text field
//   preserved — different concept (guest-facing display copy vs operator-facing
//   lifecycle state). Mappers imported from statusQueries.ts to avoid
//   duplicating the snake_case → camelCase shape.
// Prior: S30D — Storage URL rewriting at the read layer. Trip hero
//   (image 1 + image 2), route stop image_src, and destination row image_src
//   pass through rewriteImageUrl() before reaching components. The Supabase
//   project-host prefix never reaches rendered HTML; the /img/* rewrite in
//   vercel.json proxies these to Supabase Storage at the edge. Defensive +
//   idempotent — see imageUrl.ts.
// Prior: S30 — Welcome letter hydration. fetchCanonicalWelcomeLetter()
//   reads the single row in travel_immerse_welcome_letter. Per-trip 5x
//   welcome_*_override columns on travel_immerse_trips resolved via the
//   standard ?? chain. ImmerseTripData.welcomeLetter is always present
//   (never optional); every field is '' when all sources are null.
// Prior: S25 — swap display-name read from global_people_display → travel_immerse_trip_display.
//   Trip-keyed, unconditional, maybeSingle(). Preserves nickname → first_name →
//   'Our VIP Guest' fallback via trip_display's first_name + nickname columns.
//   Sync from global_people handled DB-side by trg_sync_trip_display_from_person.
// Prior: S20 — hydrate subpage_status column into ImmerseDestinationRow.subpageStatus;
//   filter 'hidden' rows at the query layer.

import { supabaseAnon } from './supabase'
import { rewriteImageUrl } from './imageUrl'
import { mapTripStatus, mapItineraryStatus } from './statusQueries'
import type {
  ImmerseTripData,
  ImmerseTripFormat,
  ImmerseRouteStop,
  ImmerseDestinationRow,
  ImmerseSubpageStatus,
  ImmerseTripPricingRow,
  ImmerseWelcomeLetter,
  TripStatus,
  ItineraryStatus,
} from './immerseTypes'

// ── DB row types ─────────────────────────────────────────────────────────────

// S30D: nested join row shape returned by Supabase for status FKs.
// Identical for both trip + itinerary statuses (lookup tables share schema).
type StatusJoinRow = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
  is_active:  boolean
}

type TripRow = {
  id:                              string
  url_id:                          string
  slug:                            string
  trip_format:                     string
  journey_types:                   string[] | null
  person_id:                       string | null
  status_label:                    string | null
  // S30D: status FK columns + nested join rows
  trip_status_id:                  string
  itinerary_status_id:             string
  travel_trip_statuses:            StatusJoinRow | null
  travel_itinerary_statuses:       StatusJoinRow | null
  eyebrow:                         string | null
  title:                           string | null
  subtitle:                        string | null
  hero_image_src:                  string | null
  hero_image_alt:                  string | null
  hero_image_src_2:                string | null
  hero_image_alt_2:                string | null
  hero_title_2:                    string | null
  hero_subtitle_2:                 string | null
  hero_pills:                      string[] | null
  welcome_eyebrow_override:        string | null   // S30
  welcome_title_override:          string | null   // S30
  welcome_body_override:           string | null   // S30
  welcome_signoff_body_override:   string | null   // S30
  welcome_signoff_name_override:   string | null   // S30
  route_heading:                   string | null
  route_body:                      string | null
  route_eyebrow:                   string | null
  destination_heading:             string | null
  destination_subtitle:            string | null
  destination_body:                string | null
  pricing_heading:                 string | null
  pricing_title:                   string | null
  pricing_body:                    string | null
  pricing_total_label:             string | null
  pricing_total_value:             string | null
  pricing_notes_heading:           string | null
  pricing_notes_title:             string | null
  pricing_notes:                   string[] | null
}

// S25: narrowed from PersonDisplayRow(id, first_name, last_name, nickname)
// to only the fields trip_display exposes. first_name + nickname are sufficient
// for the display-name fallback chain in hydrateTrip.
type TripDisplayRow = {
  first_name: string | null
  nickname:   string | null
}

// S30: Canonical proposal welcome letter row shape.
type WelcomeLetterRow = {
  eyebrow:      string | null
  title:        string | null
  body:         string | null
  signoff_body: string | null
  signoff_name: string | null
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

// S20: subpage_status added to select list. NOT NULL DEFAULT 'live' in DB —
// nullable here only as a defensive fallback if a legacy row somehow lacks it.
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
  subpage_status:    string | null
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
// S30D: TRIP_SELECT_COLUMNS extended to pull both status FKs + their joined
// lookup rows in a single round trip. Pattern matches the canonical
// travel_accom_hotels nested select used in immerseQueries.ts.

const TRIP_SELECT_COLUMNS = `
  id, url_id, slug, trip_format, journey_types,
  person_id, status_label,
  trip_status_id, itinerary_status_id,
  travel_trip_statuses (id, slug, label, sort_order, is_active),
  travel_itinerary_statuses (id, slug, label, sort_order, is_active),
  eyebrow, title, subtitle,
  hero_image_src, hero_image_alt, hero_image_src_2, hero_image_alt_2,
  hero_title_2, hero_subtitle_2, hero_pills,
  welcome_eyebrow_override, welcome_title_override, welcome_body_override,
  welcome_signoff_body_override, welcome_signoff_name_override,
  route_heading, route_body, route_eyebrow,
  destination_heading, destination_subtitle, destination_body,
  pricing_heading, pricing_title, pricing_body,
  pricing_total_label, pricing_total_value,
  pricing_notes_heading, pricing_notes_title, pricing_notes
`

export async function getImmerseTrip(urlId: string): Promise<ImmerseTripData | null> {
  const { data: trip, error: tripErr } = await supabaseAnon
    .from('travel_immerse_trips')
    .select(TRIP_SELECT_COLUMNS)
    .eq('url_id', urlId)
    .single()

  if (tripErr || !trip) return null
  return hydrateTrip(trip as unknown as TripRow)
}

export async function getImmerseTripBySlug(slug: string): Promise<ImmerseTripData | null> {
  const { data: trip, error: tripErr } = await supabaseAnon
    .from('travel_immerse_trips')
    .select(TRIP_SELECT_COLUMNS)
    .eq('slug', slug)
    .single()

  if (tripErr || !trip) return null
  return hydrateTrip(trip as unknown as TripRow)
}

// S30: Canonical welcome letter is a single-row table. maybeSingle() returns
// null if the table is somehow empty; component handles "all empty" as hidden.
async function fetchCanonicalWelcomeLetter(): Promise<WelcomeLetterRow | null> {
  const { data } = await supabaseAnon
    .from('travel_immerse_welcome_letter')
    .select('eyebrow, title, body, signoff_body, signoff_name')
    .limit(1)
    .maybeSingle()
  return (data ?? null) as WelcomeLetterRow | null
}

// S30D: defensive fallback when a status join row is somehow missing.
// Both FK columns are NOT NULL in DB so this should never fire — keeps
// the type contract on ImmerseTripData (non-nullable) honest if it does.
const EMPTY_TRIP_STATUS:      TripStatus      = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }
const EMPTY_ITINERARY_STATUS: ItineraryStatus = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }

// ── Shared hydration ─────────────────────────────────────────────────────────

async function hydrateTrip(tripRow: TripRow): Promise<ImmerseTripData | null> {
  const tripId = tripRow.id

  // S25: display-name read is now trip-keyed and unconditional. Public template
  // hits its trip_display row with first_name=NULL and falls through to the
  // 'Our VIP Guest' default. Yazeed's trip hits his row with first_name='Yazeed'.
  // S30: canonical welcome letter fetched in parallel.
  const [displayRes, stopsRes, destsRes, pricingRes, welcomeCanon] = await Promise.all([
    supabaseAnon
      .from('travel_immerse_trip_display')
      .select('first_name, nickname')
      .eq('trip_id', tripId)
      .maybeSingle(),
    supabaseAnon
      .from('travel_immerse_route_stops')
      .select('id, sort_order, title, stay_label, note, image_src, image_alt')
      .eq('trip_id', tripId)
      .order('sort_order'),
    // S20: subpage_status added to select; 'hidden' rows filtered server-side
    supabaseAnon
      .from('travel_immerse_trip_destination_rows')
      .select('id, sort_order, number_label, title, mood, summary, stay_label, image_src, image_alt, destination_slug, subpage_status')
      .eq('trip_id', tripId)
      .neq('subpage_status', 'hidden')
      .order('sort_order'),
    supabaseAnon
      .from('travel_immerse_trip_pricing_rows')
      .select('id, sort_order, destination, recommended_basis, stay_label, indicative_range')
      .eq('trip_id', tripId)
      .order('sort_order'),
    fetchCanonicalWelcomeLetter(),
  ])

  const displayRow = (displayRes.data  ?? null) as TripDisplayRow | null
  const stopRows   = (stopsRes.data    ?? []) as RouteStopRow[]
  const destRows   = (destsRes.data    ?? []) as unknown as DestinationRowRow[]
  const priceRows  = (pricingRes.data  ?? []) as PricingRowRow[]

  const clientName = displayRow?.nickname
    ?? displayRow?.first_name
    ?? 'Our VIP Guest'

  // S30D: status FKs resolved via nested join. Both NOT NULL in DB so the
  // fallback to EMPTY_*_STATUS should never trigger; if it ever does, the
  // empty slug ('') will fail the union narrow at any consumer that branches
  // on TripStatusSlug — visible failure mode preferred over silent default.
  const tripStatus: TripStatus = tripRow.travel_trip_statuses
    ? mapTripStatus(tripRow.travel_trip_statuses)
    : EMPTY_TRIP_STATUS

  const itineraryStatus: ItineraryStatus = tripRow.travel_itinerary_statuses
    ? mapItineraryStatus(tripRow.travel_itinerary_statuses)
    : EMPTY_ITINERARY_STATUS

  // S30: trip override → canonical → '' for all 5 welcome letter fields.
  const welcomeLetter: ImmerseWelcomeLetter = {
    eyebrow:     tripRow.welcome_eyebrow_override      ?? welcomeCanon?.eyebrow      ?? '',
    title:       tripRow.welcome_title_override        ?? welcomeCanon?.title        ?? '',
    body:        tripRow.welcome_body_override         ?? welcomeCanon?.body         ?? '',
    signoffBody: tripRow.welcome_signoff_body_override ?? welcomeCanon?.signoff_body ?? '',
    signoffName: tripRow.welcome_signoff_name_override ?? welcomeCanon?.signoff_name ?? '',
  }

  // S30D: route stop image_src rewritten on the way out.
  const routeStops: ImmerseRouteStop[] = stopRows.map(r => ({
    id:        r.id,
    title:     r.title      ?? '',
    stayLabel: r.stay_label ?? '',
    note:      r.note       ?? '',
    imageSrc:  rewriteImageUrl(r.image_src),
    imageAlt:  r.image_alt  ?? '',
  }))

  // S30D: destination row image_src rewritten on the way out.
  const destinationRows: ImmerseDestinationRow[] = destRows.map(r => ({
    id:              r.id,
    numberLabel:     r.number_label ?? '',
    title:           r.title        ?? '',
    mood:            r.mood         ?? '',
    summary:         r.summary      ?? '',
    stayLabel:       r.stay_label   ?? '',
    imageSrc:        rewriteImageUrl(r.image_src),
    imageAlt:        r.image_alt    ?? '',
    destinationSlug: r.destination_slug,
    subpageStatus:   normalizeSubpageStatus(r.subpage_status),  // S20
  }))

  const tripPricingRows: ImmerseTripPricingRow[] = priceRows.map(r => ({
    id:               r.id,
    destination:      r.destination        ?? '',
    recommendedBasis: r.recommended_basis  ?? '',
    stayLabel:        r.stay_label         ?? '',
    indicativeRange:  r.indicative_range   ?? '',
  }))

  // S30D: trip hero image fields rewritten. heroImageSrc2 uses `|| undefined`
  // to preserve the existing optional-undefined contract — rewriteImageUrl
  // returns '' on null/empty input.
  const heroSrc2Resolved = rewriteImageUrl(tripRow.hero_image_src_2)

  return {
    tripId:        tripRow.id,
    urlId:         tripRow.url_id,
    slug:          tripRow.slug,
    tripFormat:    (tripRow.trip_format as ImmerseTripFormat) ?? 'journey',
    journeyTypes:  tripRow.journey_types ?? [],
    clientName,
    statusLabel:   tripRow.status_label ?? '',

    tripStatus,         // S30D
    itineraryStatus,    // S30D

    welcomeLetter,

    eyebrow:       tripRow.eyebrow        ?? '',
    title:         tripRow.title          ?? '',
    subtitle:      tripRow.subtitle       ?? '',
    heroImageSrc:  rewriteImageUrl(tripRow.hero_image_src),
    heroImageAlt:  tripRow.hero_image_alt ?? '',
    heroImageSrc2: heroSrc2Resolved || undefined,
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

// S20: defensive normalizer — DB has NOT NULL DEFAULT 'live' but this catches
// any unexpected value from a legacy migration or schema drift.
function normalizeSubpageStatus(value: string | null): ImmerseSubpageStatus {
  if (value === 'live')    return 'live'
  if (value === 'preview') return 'preview'
  if (value === 'hidden')  return 'hidden'
  return 'live'
}