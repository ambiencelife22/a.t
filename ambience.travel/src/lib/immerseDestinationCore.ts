// immerseDestinationCore.ts — Hero/intro/section-headings + IDs for /immerse/ subpages.
// Owns: getImmerseDestinationCore — single canonical core fetcher.
//   getImmerseDestination — back-compat wrapper that composes all 4 fetchers
//   into the original bundled ImmerseDestinationData shape (parallel fan-out).
//   Also owns: slug→UUID cache, fetchEngagementOverride, ImmerseDestinationCore type.
// Does not own: hotels (immerseDestinationHotels), cards (Cards), pricing (Pricing).
//
// Dependency direction: this file imports from the other 3 split files.
// They do not import from each other. Core sits at the top of the dependency
// graph because the bundled wrapper composes them.
//
// Round-trip budget for getImmerseDestinationCore:
//   1 (slug cache) + 1 (destination row + override Promise.all) = 2 cold,
//   1 warm (slug cached). Hero paints once this resolves.
//
// Itinerary-membership gate:
//   fetchEngagementOverride returns the trip_destination_rows row for
//   (engagementId, globalDestinationId). Null = destination not on this
//   engagement's itinerary → core returns null → DestinationPage 404s.
//
// Last updated: S32F — Split from immerseQueries.ts. No logic change. Single-
//   purpose file is the canonical home for hero + intro + section-heading
//   reads, plus the slug→UUID cache and override row fetch. Kept the
//   bundled getImmerseDestination wrapper here because it composes the
//   other 3 split files via Promise.all.

import { supabase } from './supabase'
import { rewriteImageUrl } from './imageUrl'
import { getImmerseDestinationHotels }   from './immerseDestinationHotels'
import { getImmerseDestinationCards }    from './immerseDestinationCards'
import { getImmerseDestinationPricing }  from './immerseDestinationPricing'
import type { ImmerseDestinationData }   from './immerseTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

// Result shape for getImmerseDestinationCore. Carries everything needed to
// paint the hero + intro + section headings, plus the IDs that the other 3
// fetchers need so they don't re-resolve.
export interface ImmerseDestinationCore {
  // IDs — passed to subsequent fetchers
  destinationId:        string
  globalDestinationId:  string

  // Destination identity
  destinationSlug:      string
  journeyId:            string
  shorthand?:           string

  // Hero
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

  // Intro
  introEyebrow:         string
  introTitle:           string
  introBody:            string

  // Section eyebrows / titles / bodies (cheap fields from dest + override)
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

// ─── Global destination resolver (S32C, cache added S32E) ────────────────────
// URL slug → global_destinations.id. The single canonical lookup that
// converts a URL handle to FK truth. Every downstream query uses FK.
//
// Module-scope cache. First call per slug hits DB; subsequent calls within
// the same session return instantly. Cache is process-scoped (lost on full
// page reload) which is the correct lifetime — slug→UUID is stable as long
// as the destination row exists.

const globalDestinationIdCache = new Map<string, string>()

async function resolveGlobalDestinationId(slug: string): Promise<string | null> {
  if (!slug) return null

  const cached = globalDestinationIdCache.get(slug)
  if (cached) return cached

  const { data } = await supabase
    .from('global_destinations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const id = data?.id ?? null
  if (id) globalDestinationIdCache.set(slug, id)
  return id
}

// ─── Per-engagement destination override (S32C: FK-keyed) ────────────────────

type EngagementDestinationOverride = {
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
): Promise<EngagementDestinationOverride | null> {

  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .select(`
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
    .maybeSingle()

  if (error || !data) return null
  return data as EngagementDestinationOverride
}

// ─── getImmerseDestinationCore ────────────────────────────────────────────────
// Returns hero + intro + section headings + pricing closer/notes. Plus IDs
// (destinationId, globalDestinationId) for downstream fetchers. Carries the
// itinerary-membership gate — returns null if no override row, which means
// the destination is not on this engagement's itinerary.

export async function getImmerseDestinationCore(
  engagementId: string,
  urlSlug:      string,
): Promise<ImmerseDestinationCore | null> {

  if (!engagementId) return null

  const globalDestinationId = await resolveGlobalDestinationId(urlSlug)
  if (!globalDestinationId) return null

  const [destResult, overrideResult] = await Promise.all([
    supabase
      .from('travel_immerse_destinations')
      .select('*')
      .eq('global_destination_id', globalDestinationId)
      .single(),
    fetchEngagementOverride(engagementId, globalDestinationId),
  ])

  if (destResult.error || !destResult.data) return null
  if (!overrideResult) return null   // S32B itinerary membership gate

  const dest = destResult.data
  const ov   = overrideResult
  const destId = dest.id as string

  const heroSrc2Resolved = rewriteImageUrl(ov?.hero_image_src_2_override ?? dest.hero_image_src_2)

  return {
    destinationId:       destId,
    globalDestinationId,
    destinationSlug:     urlSlug,
    journeyId:           engagementId,
    shorthand:           dest.shorthand ?? undefined,

    eyebrow:        dest.eyebrow                        ?? '',
    title:          dest.title                          ?? '',
    subtitle:       dest.subtitle                       ?? '',
    heroImageSrc:   rewriteImageUrl(ov?.hero_image_src_override ?? dest.hero_image_src),
    heroImageAlt:   ov?.hero_image_alt_override         ?? dest.hero_image_alt   ?? '',
    heroImageSrc2:  heroSrc2Resolved || undefined,
    heroImageAlt2:  ov?.hero_image_alt_2_override       ?? dest.hero_image_alt_2 ?? undefined,
    heroTitle2:     ov?.hero_title_2_override           ?? dest.hero_title_2     ?? undefined,
    heroSubtitle2:  ov?.hero_subtitle_2_override        ?? dest.hero_subtitle_2  ?? undefined,
    heroPills:      (dest.hero_pills as string[])       ?? [],

    introEyebrow:   dest.intro_eyebrow                  ?? '',
    introTitle:     ov?.intro_title_override            ?? dest.intro_title ?? '',
    introBody:      ov?.intro_body_override             ?? dest.intro_body  ?? '',

    hotelsEyebrow:  dest.hotels_eyebrow ?? '',
    hotelsTitle:    dest.hotels_title   ?? '',
    hotelsBody:     dest.hotels_body    ?? '',

    diningEyebrow:  ov?.dining_eyebrow_override        ?? dest.dining_eyebrow ?? '',
    diningTitle:    ov?.dining_title_override          ?? dest.dining_title   ?? '',
    diningBody:     ov?.dining_body_override           ?? dest.dining_body    ?? '',

    experiencesEyebrow: dest.experiences_eyebrow ?? '',
    experiencesTitle:   dest.experiences_title   ?? '',
    experiencesBody:    dest.experiences_body    ?? '',

    pricingEyebrow:     dest.pricing_eyebrow       ?? '',
    pricingTitle:       dest.pricing_title         ?? '',
    pricingBody:        ov?.pricing_body_override  ?? dest.pricing_body ?? '',

    pricingCloser: {
      item:            ov?.pricing_closer_item_override             ?? null,
      basis:           ov?.pricing_closer_basis_override            ?? null,
      stay:            ov?.pricing_closer_stay_override             ?? null,
      indicativeRange: ov?.pricing_closer_indicative_range_override ?? null,
    },
    pricingNotesHeading: ov?.pricing_notes_heading_override ?? dest.pricing_notes_heading ?? '',
    pricingNotesTitle:   ov?.pricing_notes_title_override   ?? dest.pricing_notes_title   ?? '',
    pricingNotes:        (ov?.pricing_notes_override as string[] | null)
                          ?? (dest.pricing_notes as string[] | null)
                          ?? [],
  }
}

// ─── getImmerseDestination — back-compat parallel wrapper ────────────────────
// Preserved for any caller still using the bundled signature. Calls the 4
// fetchers concurrently and reassembles into the original ImmerseDestinationData
// shape. Pure forwarder — no logic changes. Lives in core because it
// composes the other 3 split files.

export async function getImmerseDestination(
  engagementId: string,
  urlSlug:      string,
): Promise<ImmerseDestinationData | null> {

  const core = await getImmerseDestinationCore(engagementId, urlSlug)
  if (!core) return null

  const [hotels, cards, pricingRows] = await Promise.all([
    getImmerseDestinationHotels(engagementId, core.destinationId),
    getImmerseDestinationCards(engagementId, core.globalDestinationId),
    getImmerseDestinationPricing(core.destinationId),
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