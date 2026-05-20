// hotelGuideQueries.ts — read path for the hotels guide page
// What it owns: fetch hotels + per-destination guide overlay row.
// What it does not own: gating logic (will move to hotel_guide_for_user view
// when grants ship).
//
// Mirrors lib/diningGuideQueries.ts shape. Hotels carry richer canonical
// fields (structured address, prestige badges, brand FK) so the type is
// wider than DiningVenue.
//
// Last updated: S37 — initial. Pattern lifted from diningGuideQueries.ts.

import { supabase } from './supabase'

export interface HotelVenue {
  id: string
  slug: string
  short_slug: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  zip_code: string | null
  latitude: number | null
  longitude: number | null
  google_maps_url: string | null
  website_url: string | null
  hero_image_src: string | null
  hero_image_alt: string | null
  image_credit: string | null
  image_credit_url: string | null
  image_license: string | null
  bullets: unknown
  stars: number | null
  michelin_keys: number | null
  forbes_rating: number | null
  is_preferred_partner: boolean
  is_supplementary: boolean
  brand_id: string | null
  brand2_id: string | null
  sort_order: number
}

export interface HotelGuideOverlay {
  hero_image_src: string | null
  hero_image_alt: string | null
  headline_override: string | null
  intro_override: string | null
  eyebrow_override: string | null
}

export interface HotelGuideDestination {
  id: string
  slug: string
  name: string
  overlay: HotelGuideOverlay | null
}

/**
 * Fetches all active hotels for a given destination slug. Orders by
 * is_supplementary ascending then name ascending — supplementary entries fall
 * to bottom regardless of name. Mirrors the dining ordering convention.
 */
export async function getHotelsByDestination(
  destinationSlug: string,
): Promise<HotelVenue[]> {
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
    .from('travel_accom_hotels')
    .select(`
      id, slug, short_slug, name,
      description,
      address, city, zip_code, latitude, longitude,
      google_maps_url, website_url,
      hero_image_src, hero_image_alt,
      image_credit, image_credit_url, image_license,
      bullets,
      stars, michelin_keys, forbes_rating,
      is_preferred_partner, is_supplementary,
      brand_id, brand2_id,
      sort_order
    `)
    .eq('destination_id', dest.id)
    .eq('is_active', true)
    .order('is_supplementary', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch hotels: ${error.message}`)
  }

  return (data ?? []) as HotelVenue[]
}

/**
 * Resolves destination metadata + hotel guide overlay for header rendering.
 * Returns null if the destination doesn't exist.
 *
 * Overlay row may be missing — callers should ?? each overlay field against
 * frontend defaults. Supabase returns the joined overlay as a single object
 * (not array) when the FK column has a UNIQUE constraint — see S36 standing
 * rule on 1:1 nested-select shape.
 */
export async function getHotelGuideDestination(
  destinationSlug: string,
): Promise<HotelGuideDestination | null> {
  const { data, error } = await supabase
    .from('global_destinations')
    .select(`
      id, slug, name,
      overlay:travel_hotel_guides(
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

  const raw = (data as unknown as { overlay: HotelGuideOverlay | HotelGuideOverlay[] | null }).overlay
  const overlay: HotelGuideOverlay | null =
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