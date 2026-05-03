// immerseEngagementQueries.ts — Supabase query layer for immerse engagement master data
// Owns:
//   - getImmerseEngagement(urlId) — full ImmerseEngagementData fetch by url_id
// Does not own: destination subpage data (see immerseQueries.ts).
//
// Last updated: S32K — Pricing rows + destination rows now select destination
//   NAME (title case) from global_destinations, not slug. The slug column was
//   leaking into the rendered Item label as lowercase ("seychelles", "newyork").
//   destination_slug retained on destination rows because routing/anchors need
//   it; pricing rows drop slug entirely since they only render the human label.
// Prior: S32D — Trip pricing rows now read destination slug via nested
//   join to global_destinations. Legacy `destination` text-slug column was
//   dropped in S32B Phase 4 but this file still selected it, causing 42703
//   on every engagement load. Same nested-join pattern S32C applied to
//   trip_destination_rows.
// Prior: S32C — destination_rows SELECT reads slug via nested join to
//   global_destinations rather than the immerse-side destination_slug column.
// Prior: S32 (Add 1) — Added hero_tagline. Earlier S32: audience field.
// Prior: S30E perf — Removed getImmerseEngagementBySlug.
// Prior: S30E — Engagement abstraction.
// Prior: S30D — Storage URL rewriting at the read layer.
// Prior: S30 — Welcome letter hydration.

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
  EngagementAudience,
  EngagementStatus,
  ItineraryStatus,
} from './immerseTypes'

// ── DB row types ─────────────────────────────────────────────────────────────

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
  engagement_type:                 string
  audience:                        string
  journey_types:                   string[] | null
  person_id:                       string | null
  status_label:                    string | null
  engagement_status_id:            string
  itinerary_status_id:             string
  travel_engagement_statuses:      StatusJoinRow | null
  travel_itinerary_statuses:       StatusJoinRow | null
  eyebrow:                         string | null
  title:                           string | null
  hero_tagline:                    string | null
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

type EngagementDisplayRow = {
  first_name: string | null
  nickname:   string | null
}

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

// S32C/S32K: destination rows pull both slug (for routing/anchors) and name
// (title case, for display).
type GlobalDestinationDisplayJoin = {
  slug: string | null
  name: string | null
}

type DestinationRowRow = {
  id:                  string
  sort_order:          number
  number_label:        string | null
  title:               string | null
  mood:                string | null
  summary:             string | null
  stay_label:          string | null
  image_src:           string | null
  image_alt:           string | null
  global_destinations: GlobalDestinationDisplayJoin | null
  subpage_status:      string | null
}

// S32K: pricing rows pull destination NAME only (no slug). Item column
// renders the proper-case "Seychelles" / "New York City", never the slug.
type PricingRowRow = {
  id:                 string
  sort_order:         number
  recommended_basis:  string | null
  stay_label:         string | null
  indicative_range:   string | null
  global_destinations: GlobalDestinationDisplayJoin | null
}

// ── Public fetch ─────────────────────────────────────────────────────────────

const ENGAGEMENT_SELECT_COLUMNS = `
  id, url_id, slug, trip_format, engagement_type, audience, journey_types,
  person_id, status_label,
  engagement_status_id, itinerary_status_id,
  travel_engagement_statuses (id, slug, label, sort_order, is_active),
  travel_itinerary_statuses  (id, slug, label, sort_order, is_active),
  eyebrow, title, hero_tagline, subtitle,
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

async function fetchCanonicalWelcomeLetter(): Promise<WelcomeLetterRow | null> {
  const { data } = await supabaseAnon
    .from('travel_immerse_welcome_letter')
    .select('eyebrow, title, body, signoff_body, signoff_name')
    .limit(1)
    .maybeSingle()
  return (data ?? null) as WelcomeLetterRow | null
}

const EMPTY_ENGAGEMENT_STATUS: EngagementStatus = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }
const EMPTY_ITINERARY_STATUS:  ItineraryStatus  = { id: '', slug: '', label: '', sortOrder: 0, isActive: false }

// ── Shared hydration ─────────────────────────────────────────────────────────

async function hydrateEngagement(engagementRow: EngagementRow): Promise<ImmerseEngagementData | null> {
  const engagementId = engagementRow.id

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
      .select(`
        id, sort_order, number_label, title, mood, summary, stay_label,
        image_src, image_alt, subpage_status,
        global_destinations ( slug, name )
      `)
      .eq('trip_id', engagementId)
      .neq('subpage_status', 'hidden')
      .order('sort_order'),
    // S32K: pricing rows read destination NAME (title case) for display.
    supabaseAnon
      .from('travel_immerse_trip_pricing_rows')
      .select(`
        id, sort_order, recommended_basis, stay_label, indicative_range,
        global_destinations ( slug, name )
      `)
      .eq('trip_id', engagementId)
      .order('sort_order'),
    fetchCanonicalWelcomeLetter(),
  ])

  const displayRow = (displayRes.data  ?? null) as EngagementDisplayRow | null
  const stopRows   = (stopsRes.data    ?? []) as RouteStopRow[]
  const destRows   = (destsRes.data    ?? []) as unknown as DestinationRowRow[]
  const priceRows  = (pricingRes.data  ?? []) as unknown as PricingRowRow[]

  const clientName = displayRow?.nickname
    ?? displayRow?.first_name
    ?? 'Our VIP Guest'

  const engagementStatus: EngagementStatus = engagementRow.travel_engagement_statuses
    ? mapEngagementStatus(engagementRow.travel_engagement_statuses)
    : EMPTY_ENGAGEMENT_STATUS

  const itineraryStatus: ItineraryStatus = engagementRow.travel_itinerary_statuses
    ? mapItineraryStatus(engagementRow.travel_itinerary_statuses)
    : EMPTY_ITINERARY_STATUS

  const welcomeLetter: ImmerseWelcomeLetter = {
    eyebrow:     engagementRow.welcome_eyebrow_override      ?? welcomeCanon?.eyebrow      ?? '',
    title:       engagementRow.welcome_title_override        ?? welcomeCanon?.title        ?? '',
    body:        engagementRow.welcome_body_override         ?? welcomeCanon?.body         ?? '',
    signoffBody: engagementRow.welcome_signoff_body_override ?? welcomeCanon?.signoff_body ?? '',
    signoffName: engagementRow.welcome_signoff_name_override ?? welcomeCanon?.signoff_name ?? '',
  }

  const routeStops: ImmerseRouteStop[] = stopRows.map(r => ({
    id:        r.id,
    title:     r.title      ?? '',
    stayLabel: r.stay_label ?? '',
    note:      r.note       ?? '',
    imageSrc:  rewriteImageUrl(r.image_src),
    imageAlt:  r.image_alt  ?? '',
  }))

  const destinationRows: ImmerseDestinationRow[] = destRows.map(r => ({
    id:              r.id,
    numberLabel:     r.number_label ?? '',
    title:           r.title        ?? '',
    mood:            r.mood         ?? '',
    summary:         r.summary      ?? '',
    stayLabel:       r.stay_label   ?? '',
    imageSrc:        rewriteImageUrl(r.image_src),
    imageAlt:        r.image_alt    ?? '',
    destinationSlug: r.global_destinations?.slug ?? null,  // routing/anchor
    subpageStatus:   normalizeSubpageStatus(r.subpage_status),
  }))

  // S32K: pricing rows render destination NAME, not slug.
  const tripPricingRows: ImmerseTripPricingRow[] = priceRows.map(r => ({
    id:               r.id,
    destination:      r.global_destinations?.name ?? '',
    recommendedBasis: r.recommended_basis  ?? '',
    stayLabel:        r.stay_label         ?? '',
    indicativeRange:  r.indicative_range   ?? '',
  }))

  const heroSrc2Resolved = rewriteImageUrl(engagementRow.hero_image_src_2)

  return {
    engagementId:    engagementRow.id,
    engagementType:  (engagementRow.engagement_type as EngagementType) ?? 'journey',
    audience:        normalizeAudience(engagementRow.audience),
    urlId:           engagementRow.url_id,
    slug:            engagementRow.slug,
    tripFormat:      (engagementRow.trip_format as ImmerseTripFormat) ?? 'journey',
    journeyTypes:    engagementRow.journey_types ?? [],
    clientName,
    statusLabel:     engagementRow.status_label ?? '',
    heroTagline:     engagementRow.hero_tagline ?? undefined,

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

function normalizeSubpageStatus(value: string | null): ImmerseSubpageStatus {
  if (value === 'live')    return 'live'
  if (value === 'preview') return 'preview'
  if (value === 'hidden')  return 'hidden'
  return 'live'
}

function normalizeAudience(value: string | null): EngagementAudience {
  if (value === 'private') return 'private'
  if (value === 'public')  return 'public'
  return 'private'
}