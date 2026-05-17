// immerseDestinationCore.ts — Hero/intro/section-headings + IDs for /immerse/ subpages.
// Owns: getImmerseDestinationCore — single canonical core fetcher.
//   getImmerseDestination — back-compat wrapper that composes all 4 fetchers
//   into the original bundled ImmerseDestinationData shape (parallel fan-out).
//   Also owns: slug resolution cache, fetchEngagementOverride, ImmerseDestinationCore type.
//
// Last updated: S42 Add 3 — getImmerseDestination back-compat wrapper now
//   passes core.destinationUrlSlug to getImmerseDestinationHotels so variant
//   pages scope their room overlays correctly.

import { supabase } from './supabase'
import { rewriteImageUrl } from './imageUrl'
import { getImmerseDestinationHotels }   from './immerseDestinationHotels'
import { getImmerseDestinationCards }    from './immerseDestinationCards'
import { getImmerseDestinationPricing }  from './immerseDestinationPricing'
import type { ImmerseDestinationData }   from './immerseTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImmerseDestinationCore {
  destinationId:        string
  globalDestinationId:  string
  tripDestinationRowId: string
  destinationSlug:      string
  destinationUrlSlug:   string | null
  journeyId:            string
  shorthand?:           string
  eyebrow:              string
  title:                string
  subtitle:             string
  heroImageSrc:         string
  heroImageAlt:         string
  heroImageSrc2?:       string
  heroImageAlt2?:       string
  heroTitle2?:          string
  heroSubtitle2?:       string
  heroPills:            string[]
  introEyebrow:         string
  introTitle:           string
  introBody:            string
  hotelsEyebrow:        string
  hotelsTitle:          string
  hotelsBody:           string
  diningEyebrow:        string
  diningTitle:          string
  diningBody:           string
  experiencesEyebrow:   string
  experiencesTitle:     string
  experiencesBody:      string
  pricingEyebrow:       string
  pricingTitle:         string
  pricingBody:          string
  pricingCloser: {
    item:            string | null
    basis:           string | null
    stay:            string | null
    indicativeRange: string | null
  }
  pricingNotesHeading:  string
  pricingNotesTitle:    string
  pricingNotes:         string[]
}

// ─── Slug resolution ──────────────────────────────────────────────────────────

type SlugResolution =
  | { kind: 'variant';   destRow: Record<string, unknown>; globalDestinationId: string }
  | { kind: 'canonical'; globalDestinationId: string }

const slugResolutionCache = new Map<string, SlugResolution>()

async function resolveSlug(slug: string): Promise<SlugResolution | null> {
  if (!slug) return null

  const cached = slugResolutionCache.get(slug)
  if (cached) return cached

  const { data: variantRow } = await supabase
    .from('travel_immerse_destinations')
    .select('*')
    .eq('url_slug', slug)
    .maybeSingle()

  if (variantRow) {
    const resolution: SlugResolution = {
      kind:                'variant',
      destRow:             variantRow as Record<string, unknown>,
      globalDestinationId: variantRow.global_destination_id as string,
    }
    slugResolutionCache.set(slug, resolution)
    return resolution
  }

  const { data: globalRow } = await supabase
    .from('global_destinations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const globalDestinationId = globalRow?.id ?? null
  if (!globalDestinationId) return null

  const resolution: SlugResolution = {
    kind: 'canonical',
    globalDestinationId,
  }
  slugResolutionCache.set(slug, resolution)
  return resolution
}

// ─── Per-engagement destination override ─────────────────────────────────────

type EngagementDestinationOverride = {
  id:                                        string
  hero_image_src_override:                   string | null
  hero_image_alt_override:                   string | null
  hero_image_src_2_override:                 string | null
  hero_image_alt_2_override:                 string | null
  hero_title_2_override:                     string | null
  hero_subtitle_2_override:                  string | null
  intro_title_override:                      string | null
  intro_body_override:                       string | null
  dining_eyebrow_override:                   string | null
  dining_title_override:                     string | null
  dining_body_override:                      string | null
  experiences_eyebrow_override:              string | null
  experiences_title_override:                string | null
  experiences_body_override:                 string | null
  pricing_body_override:                     string | null
  pricing_notes_heading_override:            string | null
  pricing_notes_title_override:              string | null
  pricing_notes_override:                    string[] | null
  pricing_closer_item_override:              string | null
  pricing_closer_basis_override:             string | null
  pricing_closer_stay_override:              string | null
  pricing_closer_indicative_range_override:  string | null
}

async function fetchEngagementOverride(
  engagementId:        string,
  globalDestinationId: string,
  variantSlug:         string | null = null,
): Promise<EngagementDestinationOverride | null> {

  let query = supabase
    .from('travel_immerse_trip_destination_rows')
    .select(`
      id,
      hero_image_src_override,
      hero_image_alt_override,
      hero_image_src_2_override,
      hero_image_alt_2_override,
      hero_title_2_override,
      hero_subtitle_2_override,
      intro_title_override,
      intro_body_override,
      dining_eyebrow_override,
      dining_title_override,
      dining_body_override,
      experiences_eyebrow_override,
      experiences_title_override,
      experiences_body_override,
      pricing_body_override,
      pricing_notes_heading_override,
      pricing_notes_title_override,
      pricing_notes_override,
      pricing_closer_item_override,
      pricing_closer_basis_override,
      pricing_closer_stay_override,
      pricing_closer_indicative_range_override
    `)
    .eq('trip_id', engagementId)
    .eq('global_destination_id', globalDestinationId)

  if (variantSlug) {
    query = query.eq('destination_url_slug', variantSlug)
  } else {
    query = query.is('destination_url_slug', null)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  return data as EngagementDestinationOverride
}

// ─── getImmerseDestinationCore ────────────────────────────────────────────────

export async function getImmerseDestinationCore(
  engagementId: string,
  urlSlug:      string,
): Promise<ImmerseDestinationCore | null> {

  if (!engagementId) return null

  const resolution = await resolveSlug(urlSlug)
  if (!resolution) return null

  const { globalDestinationId } = resolution

  let dest: Record<string, unknown>

  if (resolution.kind === 'variant') {
    dest = resolution.destRow
  } else {
    const { data, error } = await supabase
      .from('travel_immerse_destinations')
      .select('*')
      .eq('global_destination_id', globalDestinationId)
      .is('url_slug', null)
      .maybeSingle()
    if (error || !data) return null
    dest = data as Record<string, unknown>
  }

  const overrideResult = await fetchEngagementOverride(
    engagementId,
    globalDestinationId,
    resolution.kind === 'variant' ? urlSlug : null,
  )
  if (!overrideResult) return null

  const ov     = overrideResult
  const destId = dest.id as string

  const heroSrc2Resolved = rewriteImageUrl(
    (ov?.hero_image_src_2_override ?? dest.hero_image_src_2) as string | null
  )

  return {
    destinationId:        destId,
    globalDestinationId,
    tripDestinationRowId: ov.id,
    destinationSlug:      urlSlug,
    destinationUrlSlug:   resolution.kind === 'variant' ? urlSlug : null,
    journeyId:            engagementId,
    shorthand:            (dest.shorthand as string | null) ?? undefined,

    eyebrow:      (dest.eyebrow   as string | null) ?? '',
    title:        (dest.title     as string | null) ?? '',
    subtitle:     (dest.subtitle  as string | null) ?? '',
    heroImageSrc: rewriteImageUrl(
                    (ov?.hero_image_src_override ?? dest.hero_image_src) as string | null
                  ),
    heroImageAlt:  ov?.hero_image_alt_override
                     ?? (dest.hero_image_alt  as string | null) ?? '',
    heroImageSrc2: heroSrc2Resolved || undefined,
    heroImageAlt2: ov?.hero_image_alt_2_override
                     ?? (dest.hero_image_alt_2 as string | null) ?? undefined,
    heroTitle2:    ov?.hero_title_2_override
                     ?? (dest.hero_title_2    as string | null) ?? undefined,
    heroSubtitle2: ov?.hero_subtitle_2_override
                     ?? (dest.hero_subtitle_2 as string | null) ?? undefined,
    heroPills:     (dest.hero_pills as string[] | null) ?? [],

    introEyebrow: (dest.intro_eyebrow as string | null) ?? '',
    introTitle:   ov?.intro_title_override ?? (dest.intro_title as string | null) ?? '',
    introBody:    ov?.intro_body_override  ?? (dest.intro_body  as string | null) ?? '',

    hotelsEyebrow: (dest.hotels_eyebrow as string | null) ?? '',
    hotelsTitle:   (dest.hotels_title   as string | null) ?? '',
    hotelsBody:    (dest.hotels_body    as string | null) ?? '',

    diningEyebrow: ov?.dining_eyebrow_override ?? (dest.dining_eyebrow as string | null) ?? '',
    diningTitle:   ov?.dining_title_override   ?? (dest.dining_title   as string | null) ?? '',
    diningBody:    ov?.dining_body_override    ?? (dest.dining_body    as string | null) ?? '',

    experiencesEyebrow: ov?.experiences_eyebrow_override ?? (dest.experiences_eyebrow as string | null) ?? '',
    experiencesTitle:   ov?.experiences_title_override   ?? (dest.experiences_title   as string | null) ?? '',
    experiencesBody:    ov?.experiences_body_override    ?? (dest.experiences_body    as string | null) ?? '',

    pricingEyebrow: (dest.pricing_eyebrow as string | null) ?? '',
    pricingTitle:   (dest.pricing_title   as string | null) ?? '',
    pricingBody:    ov?.pricing_body_override ?? (dest.pricing_body as string | null) ?? '',

    pricingCloser: {
      item:            ov?.pricing_closer_item_override             ?? null,
      basis:           ov?.pricing_closer_basis_override            ?? null,
      stay:            ov?.pricing_closer_stay_override             ?? null,
      indicativeRange: ov?.pricing_closer_indicative_range_override ?? null,
    },
    pricingNotesHeading: ov?.pricing_notes_heading_override
                           ?? (dest.pricing_notes_heading as string | null) ?? '',
    pricingNotesTitle:   ov?.pricing_notes_title_override
                           ?? (dest.pricing_notes_title   as string | null) ?? '',
    pricingNotes:        (ov?.pricing_notes_override as string[] | null)
                           ?? (dest.pricing_notes as string[] | null)
                           ?? [],
  }
}

// ─── getImmerseDestination — back-compat parallel wrapper ────────────────────

export async function getImmerseDestination(
  engagementId: string,
  urlSlug:      string,
): Promise<ImmerseDestinationData | null> {

  const core = await getImmerseDestinationCore(engagementId, urlSlug)
  if (!core) return null

  const [hotels, cards, pricingRows] = await Promise.all([
    getImmerseDestinationHotels(engagementId, core.destinationId, core.destinationUrlSlug),
    getImmerseDestinationCards(engagementId, core.globalDestinationId, core.destinationUrlSlug),
    getImmerseDestinationPricing(core.tripDestinationRowId),
  ])

  return {
    destinationId:       core.destinationId,
    destinationSlug:     core.destinationSlug,
    journeyId:           core.journeyId,
    shorthand:           core.shorthand,

    eyebrow:             core.eyebrow,
    title:               core.title,
    subtitle:            core.subtitle,
    heroImageSrc:        core.heroImageSrc,
    heroImageAlt:        core.heroImageAlt,
    heroImageSrc2:       core.heroImageSrc2,
    heroImageAlt2:       core.heroImageAlt2,
    heroTitle2:          core.heroTitle2,
    heroSubtitle2:       core.heroSubtitle2,
    heroPills:           core.heroPills,

    introEyebrow:        core.introEyebrow,
    introTitle:          core.introTitle,
    introBody:           core.introBody,

    hotelsEyebrow:       core.hotelsEyebrow,
    hotelsTitle:         core.hotelsTitle,
    hotelsBody:          core.hotelsBody,
    hotels,

    diningEyebrow:       core.diningEyebrow,
    diningTitle:         core.diningTitle,
    diningBody:          core.diningBody,
    dining:              cards.dining,

    experiencesEyebrow:  core.experiencesEyebrow,
    experiencesTitle:    core.experiencesTitle,
    experiencesBody:     core.experiencesBody,
    experiences:         cards.experiences,

    pricingEyebrow:      core.pricingEyebrow,
    pricingTitle:        core.pricingTitle,
    pricingBody:         core.pricingBody,
    pricingRows,
    pricingCloser:       core.pricingCloser,
    pricingNotesHeading: core.pricingNotesHeading,
    pricingNotesTitle:   core.pricingNotesTitle,
    pricingNotes:        core.pricingNotes,
  }
}