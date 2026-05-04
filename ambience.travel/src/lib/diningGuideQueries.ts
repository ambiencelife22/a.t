// diningGuideQueries.ts — read path for the dining guide page
// What it owns: fetch dining venues + per-destination guide overlay row.
// What it does not own: gating logic (will move to dining_guide_for_user view in S36).
//
// v1 reads directly from travel_dining_venues + travel_dining_guides.
// When the dining_guide_for_user view ships (S36 Migration 4 + grants table
// Migration 3), swap the venues .from() target to 'dining_guide_for_user' —
// no other changes needed; the view projects identical column shape with
// NULL on gated fields.
//
// Last updated: S36 — Fixed overlay unwrap. Supabase PostgREST detects the
//   UNIQUE constraint on travel_dining_guides.global_destination_id and
//   returns the nested-select join as a single object (not an array).
//   Previous Array.isArray unwrap silently resolved every overlay to null;
//   defaults flowed through on every page load. Now reads as object|null
//   direct.
// Prior: S35 — Dropped panel_title_override + panel_body_override
//   from DiningGuideOverlay shape + nested SELECT. Panel block removed
//   from GuideHero entirely. Schema cleanup in s35_06.
// Prior: S35 — Added GuideOverlay shape + getGuideDestination() now
//   returns overlay fields via LEFT JOIN against travel_dining_guides. NULL
//   overlay fields = frontend defaults flow through (standard ?? chain).

import { supabase } from './supabase'

export interface DiningVenue {
  id: string
  slug: string
  name: string
  cuisine_subcategory: string | null
  michelin: boolean
  address: string | null
  maps_url: string | null
  website: string | null
  ambience_take: string | null
  why_recommend: string | null
  neighborhood: string | null
  price_band: string | null
  public_preview_rank: number | null
  tags: string[] | null
  image_src: string | null
  image_alt: string | null
  image_2_src: string | null
  image_2_alt: string | null
  image_credit: string | null
  image_credit_url: string | null
  sort_order: number
}

/**
 * Per-destination overlay for the dining guide page.
 * NULL on any field = frontend default flows through.
 * Resolution: override → frontend default → '' (standard ?? chain)
 */
export interface DiningGuideOverlay {
  hero_image_src: string | null
  hero_image_alt: string | null
  headline_override: string | null
  intro_override: string | null
  eyebrow_override: string | null
}

export interface GuideDestination {
  id: string
  slug: string
  name: string
  /**
   * Per-guide overlay row. null when no row exists for this destination
   * (e.g. destinations without a dining guide configured yet).
   * When non-null, individual fields may still be NULL — caller should ??
   * each one against frontend defaults.
   */
  overlay: DiningGuideOverlay | null
}

/**
 * Fetches all active dining venues for a given destination slug.
 * Filters by is_active = true and only returns venues with ambience_take populated
 * (excludes proposal-only canonical rows that lack guide-register content).
 */
export async function getDiningVenuesByDestination(
  destinationSlug: string,
): Promise<DiningVenue[]> {
  // Resolve destination UUID first — never join on slug per architecture canon.
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
      id, slug, name, cuisine_subcategory, michelin,
      address, maps_url, website,
      ambience_take, why_recommend,
      neighborhood, price_band, public_preview_rank, tags,
      image_src, image_alt, image_2_src, image_2_alt,
      image_credit, image_credit_url,
      sort_order
    `)
    .eq('global_destination_id', dest.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch dining venues: ${error.message}`)
  }

  return (data ?? []) as DiningVenue[]
}

/**
 * Resolves destination metadata + dining guide overlay for header rendering.
 * Returns null if the destination doesn't exist.
 *
 * Overlay row may be missing (destinations without a configured guide) —
 * callers should ?? each overlay field against frontend defaults.
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
        eyebrow_override
      )
    `)
    .eq('slug', destinationSlug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch destination: ${error.message}`)
  }
  if (!data) return null

  // Supabase returns overlay as a single object (not array) when the FK
  // column carries a UNIQUE constraint — PostgREST detects 1:1 and unwraps
  // automatically. travel_dining_guides has UNIQUE on global_destination_id,
  // so the nested select returns either the overlay row or null.
  const overlay = (data as unknown as { overlay: DiningGuideOverlay | null }).overlay ?? null

  return {
    id:   (data as { id: string }).id,
    slug: (data as { slug: string }).slug,
    name: (data as { name: string }).name,
    overlay,
  }
}