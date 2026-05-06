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
// Last updated: S37 — Added is_supplementary + venue_status to DiningVenue
//   type + SELECT. venue_status is enum-as-CHECK on the DB ('operational',
//   'temporarily_closed', 'permanently_closed', 'seasonal_closure').
//   Default 'operational' renders no banner; other states render a status
//   banner above the body in DiningCard.
// Prior: S36 — Overlay unwrap defensive against both response shapes.
//   Supabase nested-select returns single object (not array) when UNIQUE
//   constraint makes relationship 1:1.
// Prior: S36 — Collapsed two-register canon. ambience_take + why_recommend
//   dropped from SELECT + DiningVenue type per s36_01. Filter on
//   ambience_take removed. Order changed sort_order → name ascending.
// Prior: S35 — Dropped panel_title_override + panel_body_override from
//   DiningGuideOverlay shape + nested SELECT. Schema cleanup in s35_06.
// Prior: S35 — Added GuideOverlay shape + getGuideDestination() returns
//   overlay fields via LEFT JOIN against travel_dining_guides.

import { supabase } from './supabase'

export type VenueStatus = 'operational' | 'temporarily_closed' | 'permanently_closed' | 'seasonal_closure'

export interface DiningVenue {
  id: string
  slug: string
  name: string
  cuisine_subcategory: string | null
  michelin: boolean
  address: string | null
  maps_url: string | null
  website: string | null
  body: string | null
  bullets: string[] | null
  bullets_heading: string | null
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
  is_supplementary: boolean
  venue_status: VenueStatus
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
 * Filters by is_active = true. Orders by is_supplementary ascending then
 * name ascending — supplementary entries fall to bottom regardless of name.
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
      body, bullets, bullets_heading,
      neighborhood, price_band, public_preview_rank, tags,
      image_src, image_alt, image_2_src, image_2_alt,
      image_credit, image_credit_url,
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

  // Supabase nested-select returns:
  //   - array form when the relationship isn't 1:1
  //   - single object when a UNIQUE constraint makes it 1:1 (our case:
  //     UNIQUE(global_destination_id) on travel_dining_guides)
  // Handle both shapes defensively.
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