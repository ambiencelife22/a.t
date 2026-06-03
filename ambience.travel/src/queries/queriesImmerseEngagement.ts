// queriesImmerseEngagement.ts — Supabase query layer for immerse engagement master data
// Owns:
//   - getImmerseEngagement(urlId) — full ImmerseEngagementData fetch by url_id
// Does not own: destination subpage data (see queriesImmerseDestCore.ts).
//
// Last updated: S53B Closing+1 — destination_row.hero_eyebrow_override
//   added. Surfaces per-subpage tailored hero eyebrow. Resolved in
//   DestinationPage.tsx via:
//     destination_row.heroEyebrowOverride
//     → engagement.heroEyebrowOverride
//     → composed guestName + titlePrefix (legacy)
// Prior: S53B Closing — engagement.hero_eyebrow_override added. When
//   populated, replaces composed guestName + titlePrefix on both the
//   overview hero and destination subpage hero.
// Prior: S53B Closing — destination row card hero now resolves via
//   canon-fallback chain.
// Prior: S48 — engagement primary fetch routed through the
//   get-engagement-stage Edge Function.

import { supabaseAnon } from '../lib/supabase'
import { rewriteImageUrl } from '../utils/utilsImageUrl'
import { mapEngagementStatus, mapItineraryStatus } from '../queries/queriesStatus'
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
  EngagementStage,
} from '../types/typesImmerse'
import { computeEngagementStage } from '../types/typesImmerse'

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
  trip_id:                         string | null
  trip_format:                     string
  engagement_type:                 string
  audience:                        string
  journey_types:                   string[] | null
  person_id:                       string | null
  status_label:                    string | null
  public_view:                     boolean
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
  hero_eyebrow_override:           string | null
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

type GlobalDestinationDisplayJoin = {
  slug: string | null
  name: string | null
}

type DestinationRowRow = {
  id:                     string
  sort_order:             number
  number_label:           string | null
  title:                  string | null
  mood:                   string | null
  summary:                string | null
  stay_label:             string | null
  image_src:              string | null
  image_alt:              string | null
  global_destinations:    GlobalDestinationDisplayJoin | null
  subpage_status:         string | null
  destination_url_slug:   string | null
  hero_eyebrow_override:  string | null   // S53B Closing+1
}

type PricingRowRow = {
  id:                 string
  sort_order:         number
  recommended_basis:  string | null
  stay_label:         string | null
  indicative_range:   string | null
  global_destinations: GlobalDestinationDisplayJoin | null
}

// ── Destination hero canon-fallback ─────────────────────────────────────────

type DestinationHeroFallback = {
  template_hero: string | null
  template_alt:  string | null
  global_hero:   string | null
  global_alt:    string | null
}

async function fetchDestinationHeroFallbacks(
  slugs: string[],
): Promise<Map<string, DestinationHeroFallback>> {
  const map = new Map<string, DestinationHeroFallback>()
  if (slugs.length === 0) return map

  const { data: globalRows } = await supabaseAnon
    .from('global_destinations')
    .select('slug, id, hero_image_src, hero_image_alt')
    .in('slug', slugs)

  const idsBySlug = new Map<string, string>()
  for (const row of (globalRows ?? []) as Array<{
    slug: string
    id: string
    hero_image_src: string | null
    hero_image_alt: string | null
  }>) {
    map.set(row.slug, {
      template_hero: null,
      template_alt:  null,
      global_hero:   row.hero_image_src,
      global_alt:    row.hero_image_alt,
    })
    idsBySlug.set(row.slug, row.id)
  }

  const ids = Array.from(idsBySlug.values())
  if (ids.length === 0) return map

  const { data: templateRows } = await supabaseAnon
    .from('travel_immerse_destinations')
    .select('global_destination_id, hero_image_src, hero_image_alt')
    .in('global_destination_id', ids)
    .is('url_slug', null)

  const slugByGlobalId = new Map<string, string>()
  for (const [slug, id] of idsBySlug.entries()) slugByGlobalId.set(id, slug)

  for (const row of (templateRows ?? []) as Array<{
    global_destination_id: string
    hero_image_src: string | null
    hero_image_alt: string | null
  }>) {
    const slug = slugByGlobalId.get(row.global_destination_id)
    if (!slug) continue
    const existing = map.get(slug)
    if (!existing) continue
    map.set(slug, {
      ...existing,
      template_hero: row.hero_image_src,
      template_alt:  row.hero_image_alt,
    })
  }

  return map
}

// ── Edge Function gateway ─────────────────────────────────────────────────────

type EngagementStagePayload = {
  engagement:     EngagementRow
  hasTripContent: boolean
}

async function fetchEngagementStage(urlId: string): Promise<EngagementStagePayload | null> {
  try {
    const { data, error } = await supabaseAnon.functions.invoke('travel-get-engagement-stage', {
      body: { url_id: urlId },
    })

    if (error || !data) return null
    if (!data.engagement) return null

    return data as EngagementStagePayload
  } catch {
    return null
  }
}

// ── Public fetch ─────────────────────────────────────────────────────────────

export async function getImmerseEngagement(urlId: string): Promise<ImmerseEngagementData | null> {
  const payload = await fetchEngagementStage(urlId)
  if (!payload) return null
  return hydrateEngagement(payload.engagement, payload.hasTripContent)
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

async function hydrateEngagement(
  engagementRow: EngagementRow,
  hasTripContent: boolean,
): Promise<ImmerseEngagementData | null> {
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
        image_src, image_alt, subpage_status, destination_url_slug,
        hero_eyebrow_override,
        global_destinations ( slug, name )
      `)
      .eq('trip_id', engagementId)
      .neq('subpage_status', 'hidden')
      .order('sort_order'),
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

  const destinationSlugs = destRows
    .map(r => r.global_destinations?.slug)
    .filter((s): s is string => !!s)
  const heroFallbacks = await fetchDestinationHeroFallbacks(destinationSlugs)

  const hasProposalContent = !!(
    engagementRow.hero_tagline    ||
    engagementRow.route_body      ||
    engagementRow.destination_body ||
    engagementRow.pricing_body    ||
    engagementRow.pricing_total_value ||
    destRows.length > 0
  )

  const stage: EngagementStage = computeEngagementStage({
    statusSlug:         engagementRow.travel_engagement_statuses?.slug ?? '',
    hasProposalContent,
    hasTripContent,
  })

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

  const destinationRows: ImmerseDestinationRow[] = destRows.map(r => {
    const globalSlug = r.global_destinations?.slug ?? null
    const fallback   = globalSlug ? heroFallbacks.get(globalSlug) : null

    const resolvedImageSrc =
      r.image_src
      ?? fallback?.template_hero
      ?? fallback?.global_hero
      ?? null

    const resolvedImageAlt =
      r.image_alt
      ?? fallback?.template_alt
      ?? fallback?.global_alt
      ?? ''

    return {
      id:                  r.id,
      numberLabel:         r.number_label ?? '',
      title:               r.title        ?? '',
      mood:                r.mood         ?? '',
      summary:             r.summary      ?? '',
      stayLabel:           r.stay_label   ?? '',
      imageSrc:            rewriteImageUrl(resolvedImageSrc),
      imageAlt:            resolvedImageAlt,
      destinationSlug:     globalSlug,
      destinationUrlSlug:  r.destination_url_slug  ?? null,
      subpageStatus:       normalizeSubpageStatus(r.subpage_status),
      heroEyebrowOverride: r.hero_eyebrow_override  ?? undefined,
    }
  })

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
    stage,
    slug:            engagementRow.slug,
    tripFormat:      (engagementRow.trip_format as ImmerseTripFormat) ?? 'journey',
    journeyTypes:    engagementRow.journey_types ?? [],
    clientName,
    statusLabel:     engagementRow.status_label ?? '',
    heroTagline:     engagementRow.hero_tagline ?? undefined,
    heroEyebrowOverride: engagementRow.hero_eyebrow_override ?? undefined,

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