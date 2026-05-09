// diningGuideQueries.ts — read path for the dining guide page
// What it owns: fetch dining venues + per-destination guide overlay row.
// What it does not own: gating logic (will move to dining_guide_for_user view).
//
// v1 reads directly from travel_dining_venues + travel_dining_guides.
// When the dining_guide_for_user view ships (Migration 4 + grants table
// Migration 3), swap the venues .from() target to 'dining_guide_for_user' —
// no other changes needed; the view projects identical column shape with
// NULL on gated fields.
//
// Last updated: S39 — Removed slug (dropped S38). Replaced ambience_take
//   with body; added kicker, tagline, bullets_heading, bullets,
//   image_credit, image_credit_url, image_license to match actual DB schema.
// Prior: S37 — Added Plan Your Visit override fields to overlay
//   (s37_13): plan_your_visit_heading, plan_your_visit_intro,
//   plan_your_visit_bullets[]. All nullable; section is omitted from PDF
//   entirely when all three are NULL (no fallback paragraphs).
// Prior: S37 — Added worlds_50_best boolean (s37_12).
// Prior: S37 — Added Michelin recognition model (michelin_award, michelin_stars,
//   michelin_green_star). Legacy michelin boolean still in SELECT — drops in s37_10.
// Prior: S37 — Added guide_year + guide_version to DiningGuideOverlay.
// Prior: S37 — Added is_supplementary + venue_status to DiningVenue.
// Prior: S36 — Overlay unwrap defensive against both response shapes.
// Prior: S35 — Added GuideOverlay shape + getGuideDestination().

import { supabase } from './supabase'

export type VenueStatus = 'operational' | 'temporarily_closed' | 'permanently_closed' | 'seasonal_closure'

export type MichelinAward = 'star' | 'bib_gourmand'

export interface DiningVenue {
  id: string
  name: string
  cuisine_subcategory: string | null
  kicker: string | null
  tagline: string | null
  body: string | null
  bullets_heading: string | null
  bullets: string[] | null
  /**
   * Legacy boolean — true when venue holds any Michelin recognition.
   * Drops in s37_10 — remove from type + SELECT at that point.
   */
  michelin: boolean
  michelin_award: MichelinAward | null
  michelin_stars: number | null
  michelin_green_star: boolean
  worlds_50_best: boolean
  address: string | null
  maps_url: string | null
  website: string | null
  neighborhood: string | null
  price_band: string | null
  public_preview_rank: number | null
  tags: string[] | null
  image_src: string | null
  image_alt: string | null
  image_credit: string | null
  image_credit_url: string | null
  image_license: string | null
  image_2_src: string | null
  image_2_alt: string | null
  sort_order: number
  is_supplementary: boolean
  venue_status: VenueStatus
}

/**
 * Per-destination overlay for the dining guide page.
 * NULL on any field = frontend default flows through.
 * Resolution: override → frontend default → '' (standard ?? chain)
 *
 * guide_year + guide_version added S37 for PDF cover. NULL = current year / '1.0'
 * applied at PDF render time (not on the live page).
 */
export interface DiningGuideOverlay {
  hero_image_src: string | null
  hero_image_alt: string | null
  headline_override: string | null
  intro_override: string | null
  eyebrow_override: string | null
  guide_year: number | null
  guide_version: string | null
  /** S37 s37_13 — Plan Your Visit closing-page override.
   *  All three nullable; section omitted from PDF entirely when all NULL. */
  plan_your_visit_heading: string | null
  plan_your_visit_intro:   string | null
  plan_your_visit_bullets: string[] | null
}

export interface GuideDestination {
  id: string
  slug: string
  name: string
  /**
   * Per-guide overlay row. null when no row exists for this destination.
   * When non-null, individual fields may still be NULL — caller should ??
   * each one against frontend defaults.
   */
  overlay: DiningGuideOverlay | null
}

/**
 * Fetches all active dining venues for a given destination slug.
 * Filters by is_active = true. Orders by is_supplementary ascending then
 * name ascending — supplementary entries fall to bottom regardless of name.
 */
export async function getDiningVenuesByDestination(
  destinationSlug: string,
): Promise<DiningVenue[]> {
  const { data: dest, error: destError } = await supabase
    .from('global_destinations')
    .select('id')
    .eq('slug', destinationSlug)
    .single()

  if (destError) {
    throw new Error(`Failed to resolve destination "${destinationSlug}": ${destError.message}`)
  }
  if (!dest) {
    throw new Error(`Destination "${destinationSlug}" not found`)
  }

  const { data, error } = await supabase
    .from('travel_dining_venues')
    .select(`
      id, name, cuisine_subcategory,
      kicker, tagline, body, bullets_heading, bullets,
      michelin, michelin_award, michelin_stars, michelin_green_star,
      worlds_50_best,
      address, maps_url, website,
      neighborhood, price_band, public_preview_rank, tags,
      image_src, image_alt, image_credit, image_credit_url, image_license,
      image_2_src, image_2_alt,
      sort_order, is_supplementary, venue_status
    `)
    .eq('global_destination_id', dest.id)
    .eq('is_active', true)
    .order('is_supplementary', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch dining venues: ${error.message}`)
  }

  return (data ?? []) as DiningVenue[]
}

/**
 * Resolves destination metadata + dining guide overlay for header rendering.
 * Returns null if the destination doesn't exist.
 */
export async function getGuideDestination(
  destinationSlug: string,
): Promise<GuideDestination | null> {
  const { data, error } = await supabase
    .from('global_destinations')
    .select(`
      id, slug, name,
      overlay:travel_dining_guides(
        hero_image_src,
        hero_image_alt,
        headline_override,
        intro_override,
        eyebrow_override,
        guide_year,
        guide_version,
        plan_your_visit_heading,
        plan_your_visit_intro,
        plan_your_visit_bullets
      )
    `)
    .eq('slug', destinationSlug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch destination: ${error.message}`)
  }
  if (!data) return null

  const raw = (data as unknown as { overlay: DiningGuideOverlay | DiningGuideOverlay[] | null }).overlay
  const overlay: DiningGuideOverlay | null =
    Array.isArray(raw)
      ? (raw.length > 0 ? raw[0] : null)
      : (raw ?? null)

  return {
    id:   (data as { id: string }).id,
    slug: (data as { slug: string }).slug,
    name: (data as { name: string }).name,
    overlay,
  }
}