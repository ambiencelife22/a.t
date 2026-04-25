// immerseTripQueries.ts — Supabase query layer for immerse engagement master data
// Owns:
//   - getImmerseEngagement(urlId)        — full ImmerseEngagementData fetch by public url_id
//   - getImmerseEngagementBySlug(slug)   — full ImmerseEngagementData fetch by slug
//                                          (used for public previews like /immerse/honeymoon/)
// Does not own: destination subpage data (see immerseQueries.ts).
//
// Last updated: S30E — Engagement abstraction. Master table reads now target
//   travel_immerse_engagements; status FK column engagement_status_id replaces
//   trip_status_id; nested status join targets travel_engagement_statuses.
//   Type renames: TripRow → EngagementRow, ImmerseTripData → ImmerseEngagementData,
//   TripStatus → EngagementStatus. Function renames: getImmerseTrip →
//   getImmerseEngagement, getImmerseTripBySlug → getImmerseEngagementBySlug,
//   hydrateTrip → hydrateEngagement, TRIP_SELECT_COLUMNS → ENGAGEMENT_SELECT_COLUMNS.
//   New field on output: engagementType discriminator pulled from the new
//   DB column (DEFAULT 'journey'). Child table reads still .eq() on trip_id —
//   children retain "trip" prefix because their content is journey-engagement-
//   specific (scope-preservation). Mappers imported from statusQueries
//   renamed to mapEngagementStatus.
// Prior: S30D — Trip + itinerary status FK lookups. travel_immerse_trips
//   carried trip_status_id + itinerary_status_id (both NOT NULL FKs) into
//   travel_trip_statuses + travel_itinerary_statuses. Hydration resolved
//   both via Supabase nested select. Storage URL rewriting at the read
//   layer: trip hero (image 1 + image 2), route stop image_src, and
//   destination row image_src pass through rewriteImageUrl() before reaching
//   components. The Supabase project-host prefix never reaches rendered
//   HTML; the /img/* rewrite in vercel.json proxies these to Supabase
//   Storage at the edge. Defensive + idempotent — see imageUrl.ts.
// Prior: S30 — Welcome letter hydration. fetchCanonicalWelcomeLetter()
//   reads the single row in travel_immerse_welcome_letter. Per-engagement
//   5x welcome_*_override columns on the master row resolved via the
//   standard ?? chain. ImmerseEngagementData.welcomeLetter is always present
//   (never optional); every field is '' when all sources are null.

import { supabaseAnon } from './supabase'
import { rewriteImageUrl } from './imageUrl'
import { mapEngagementStatus, mapItineraryStatus } from './statusQueries'
import type {
  ImmerseEngagementData,
  ImmerseTripFormat,
  ImmerseRouteStop,
  ImmerseDestinationRow,
  ImmerseSubpageStatus,
  ImmerseTripPricingRow,
  ImmerseWelcomeLetter,
  EngagementType,
  EngagementStatus,
  ItineraryStatus,
} from './immerseTypes'

// ── DB row types ─────────────────────────────────────────────────────────────

// Nested join row shape returned by Supabase for status FKs. Identical for
// both engagement + itinerary statuses (lookup tables share schema).
type StatusJoinRow = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
  is_active:  boolean
}

type EngagementRow = {
  id:                              string
  url_id:                          string
  slug:                            string
  trip_format:                     string
  engagement_type:                 string                // S30E discriminator
  journey_types:                   string[] | null
  person_id:                       string | null
  status_label:                    string | null
  // S30E: status FK column + nested join row both renamed
  engagement_status_id:            string
  itinerary_status_id:             string
  travel_engagement_statuses:      StatusJoinRow | null  // S30E
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
  welcome_eyebrow_override:        string | null
  welcome_title_override:          string | null
  welcome_body_override:           string | null
  welcome_signoff_body_override:   string | null
  welcome_signoff_name_override:   string | null
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

// Display-name overlay row shape. trip_display table retains its name —
// per-engagement display-name overlay, journey-specific in current usage.
type EngagementDisplayRow = {
  first_name: string | null
  nickname:   string | null
}

// Canonical proposal welcome letter row shape.
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
// S30E: SELECT pulls engagement_type + engagement_status_id + nested join
// from travel_engagement_statuses. Itinerary nested join unchanged.

const ENGAGEMENT_SELECT_COLUMNS = `
  id, url_id, slug, trip_format, engagement_type, journey_types,
  person_id, status_label,
  engagement_status_id, itinerary_status_id,
  travel_engagement_statuses (id, slug, label, sort_order, is_active),
  travel_itinerary_statuses  (id, slug, label, sort_order, is_active),
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

export async function getImmerseEngagement(urlId: string): Promise<ImmerseEngagementData | null> {
  const { data: engagement, error } = await supabaseAnon
    .from('travel_immerse_engagements')
    .select(ENGAGEMENT_SELECT_COLUMNS)
    .eq('url_id', urlId)
    .single()

  if (error || !engagement) return null
  return hydrateEngagement(engagement as unknown as EngagementRow)
}

export async function getImmerseEngagementBySlug(slug: string): Promise<ImmerseEngagementData | null> {
  const { data: engagement, error } = await supabaseAnon
    .from('travel_immerse_engagements')
    .select(ENGAGEMENT_SELECT_COLUMNS)
    .eq('slug', slug)
    .single()

  if (error || !engagement) return null
  return hydrateEngagement(engagement as unknown as EngagementRow)
}

// Canonical welcome letter is a single-row table. maybeSingle() returns null
// if the table is somehow empty; component handles "all empty" as hidden.
async function fetchCanonicalWelcomeLetter(): Promise<WelcomeLetterRow | null> {
  const { data } = await supabaseAnon
    .from('travel_immerse_welcome_letter')
    .select('eyebrow, title, body, signoff_body, signoff_name')
    .limit(1)
    .maybeSingle()
  return (data ?? null) as WelcomeLetterRow | null
}

// Defensive fallback when a status join row is somehow missing. Both FK
// columns are NOT NULL in DB so this should never fire — keeps the type
// contract on ImmerseEngagementData (non-nullable) honest if it does.
const EMPTY_ENGAGEMENT_STATUS: EngagementStatus = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }
const EMPTY_ITINERARY_STATUS:  ItineraryStatus  = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }

// ── Shared hydration ─────────────────────────────────────────────────────────

async function hydrateEngagement(engagementRow: EngagementRow): Promise<ImmerseEngagementData | null> {
  const engagementId = engagementRow.id

  // Display-name read is engagement-keyed and unconditional. Public template
  // hits its trip_display row with first_name=NULL and falls through to the
  // 'Our VIP Guest' default. Yazeed's row carries first_name='Yazeed'.
  // Canonical welcome letter fetched in parallel.
  const [displayRes, stopsRes, destsRes, pricingRes, welcomeCanon] = await Promise.all([
    supabaseAnon
      .from('travel_immerse_trip_display')
      .select('first_name, nickname')
      .eq('trip_id', engagementId)
      .maybeSingle(),
    supabaseAnon
      .from('travel_immerse_route_stops')
      .select('id, sort_order, title, stay_label, note, image_src, image_alt')
      .eq('trip_id', engagementId)
      .order('sort_order'),
    supabaseAnon
      .from('travel_immerse_trip_destination_rows')
      .select('id, sort_order, number_label, title, mood, summary, stay_label, image_src, image_alt, destination_slug, subpage_status')
      .eq('trip_id', engagementId)
      .neq('subpage_status', 'hidden')
      .order('sort_order'),
    supabaseAnon
      .from('travel_immerse_trip_pricing_rows')
      .select('id, sort_order, destination, recommended_basis, stay_label, indicative_range')
      .eq('trip_id', engagementId)
      .order('sort_order'),
    fetchCanonicalWelcomeLetter(),
  ])

  const displayRow = (displayRes.data  ?? null) as EngagementDisplayRow | null
  const stopRows   = (stopsRes.data    ?? []) as RouteStopRow[]
  const destRows   = (destsRes.data    ?? []) as unknown as DestinationRowRow[]
  const priceRows  = (pricingRes.data  ?? []) as PricingRowRow[]

  const clientName = displayRow?.nickname
    ?? displayRow?.first_name
    ?? 'Our VIP Guest'

  // Status FKs resolved via nested join. Both NOT NULL in DB so the fallback
  // to EMPTY_*_STATUS should never trigger; if it ever does, the empty slug
  // ('') will fail the union narrow at any consumer that branches on
  // EngagementStatusSlug — visible failure mode preferred over silent default.
  const engagementStatus: EngagementStatus = engagementRow.travel_engagement_statuses
    ? mapEngagementStatus(engagementRow.travel_engagement_statuses)
    : EMPTY_ENGAGEMENT_STATUS

  const itineraryStatus: ItineraryStatus = engagementRow.travel_itinerary_statuses
    ? mapItineraryStatus(engagementRow.travel_itinerary_statuses)
    : EMPTY_ITINERARY_STATUS

  // Engagement override → canonical → '' for all 5 welcome letter fields.
  const welcomeLetter: ImmerseWelcomeLetter = {
    eyebrow:     engagementRow.welcome_eyebrow_override      ?? welcomeCanon?.eyebrow      ?? '',
    title:       engagementRow.welcome_title_override        ?? welcomeCanon?.title        ?? '',
    body:        engagementRow.welcome_body_override         ?? welcomeCanon?.body         ?? '',
    signoffBody: engagementRow.welcome_signoff_body_override ?? welcomeCanon?.signoff_body ?? '',
    signoffName: engagementRow.welcome_signoff_name_override ?? welcomeCanon?.signoff_name ?? '',
  }

  // Route stop image_src rewritten on the way out.
  const routeStops: ImmerseRouteStop[] = stopRows.map(r => ({
    id:        r.id,
    title:     r.title      ?? '',
    stayLabel: r.stay_label ?? '',
    note:      r.note       ?? '',
    imageSrc:  rewriteImageUrl(r.image_src),
    imageAlt:  r.image_alt  ?? '',
  }))

  // Destination row image_src rewritten on the way out.
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
    subpageStatus:   normalizeSubpageStatus(r.subpage_status),
  }))

  const tripPricingRows: ImmerseTripPricingRow[] = priceRows.map(r => ({
    id:               r.id,
    destination:      r.destination        ?? '',
    recommendedBasis: r.recommended_basis  ?? '',
    stayLabel:        r.stay_label         ?? '',
    indicativeRange:  r.indicative_range   ?? '',
  }))

  // Hero image fields rewritten. heroImageSrc2 uses `|| undefined` to
  // preserve the optional-undefined contract — rewriteImageUrl returns ''
  // on null/empty input.
  const heroSrc2Resolved = rewriteImageUrl(engagementRow.hero_image_src_2)

  return {
    engagementId:    engagementRow.id,
    engagementType:  (engagementRow.engagement_type as EngagementType) ?? 'journey',
    urlId:           engagementRow.url_id,
    slug:            engagementRow.slug,
    tripFormat:      (engagementRow.trip_format as ImmerseTripFormat) ?? 'journey',
    journeyTypes:    engagementRow.journey_types ?? [],
    clientName,
    statusLabel:     engagementRow.status_label ?? '',

    engagementStatus,
    itineraryStatus,

    welcomeLetter,

    eyebrow:       engagementRow.eyebrow        ?? '',
    title:         engagementRow.title          ?? '',
    subtitle:      engagementRow.subtitle       ?? '',
    heroImageSrc:  rewriteImageUrl(engagementRow.hero_image_src),
    heroImageAlt:  engagementRow.hero_image_alt ?? '',
    heroImageSrc2: heroSrc2Resolved || undefined,
    heroImageAlt2: engagementRow.hero_image_alt_2 ?? undefined,
    heroTitle2:    engagementRow.hero_title_2    ?? undefined,
    heroSubtitle2: engagementRow.hero_subtitle_2 ?? undefined,
    heroPills:     engagementRow.hero_pills     ?? [],

    routeHeading:  engagementRow.route_heading ?? '',
    routeBody:     engagementRow.route_body    ?? '',
    routeEyebrow:  engagementRow.route_eyebrow ?? undefined,
    routeStops,

    destinationHeading:   engagementRow.destination_heading   ?? '',
    destinationSubtitle:  engagementRow.destination_subtitle  ?? undefined,
    destinationBody:      engagementRow.destination_body      ?? undefined,
    destinationRows,

    pricingHeading:      engagementRow.pricing_heading       ?? '',
    pricingTitle:        engagementRow.pricing_title         ?? '',
    pricingBody:         engagementRow.pricing_body          ?? '',
    pricingRows:         tripPricingRows,
    pricingTotalLabel:   engagementRow.pricing_total_label   ?? '',
    pricingTotalValue:   engagementRow.pricing_total_value   ?? '',
    pricingNotesHeading: engagementRow.pricing_notes_heading ?? '',
    pricingNotesTitle:   engagementRow.pricing_notes_title   ?? '',
    pricingNotes:        engagementRow.pricing_notes         ?? [],
  }
}

// Defensive normalizer — DB has NOT NULL DEFAULT 'live' but this catches any
// unexpected value from a legacy migration or schema drift.
function normalizeSubpageStatus(value: string | null): ImmerseSubpageStatus {
  if (value === 'live')    return 'live'
  if (value === 'preview') return 'preview'
  if (value === 'hidden')  return 'hidden'
  return 'live'
}