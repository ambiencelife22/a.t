// queriesGuidesHotels.ts — read path for hotels.
//
// What it owns:
//   - HotelVenue type
//   - getHotelsByDestination — fetches travel_accom_hotels for a slug
//
// What it does not own:
//   - Destination + overlay fetch → queriesGuides.getGuideDestination
//   - Grant check → queriesGuides.checkGuideGrant (hotels currently ungated)
//   - GuideDestination type → typesGuides
//
// Mirrors lib/queriesGuidesDining.ts shape. Hotels carry richer canonical
// fields (structured address, prestige badges, brand FK) so HotelVenue is
// wider than DiningVenue.
//
// Last updated: S53 — Destination + overlay code lifted to queriesGuides.ts.
//   Removed HotelGuideOverlay, HotelGuideDestination, getHotelGuideDestination.
//   This file is now purely the hotel read path.
// Prior: S37 — initial. Pattern lifted from queriesGuidesDining.ts.

import { supabase } from '../lib/supabase'

export interface HotelVenue {
  id:                   string
  slug:                 string
  short_slug:           string
  name:                 string
  description:          string | null
  address:              string | null
  city:                 string | null
  zip_code:             string | null
  latitude:             number | null
  longitude:            number | null
  google_maps_url:      string | null
  website_url:          string | null
  hero_image_src:       string | null
  hero_image_alt:       string | null
  image_credit:         string | null
  image_credit_url:     string | null
  image_license:        string | null
  bullets:              unknown
  stars:                number | null
  michelin_keys:        number | null
  forbes_rating:        number | null
  is_preferred_partner: boolean
  is_supplementary:     boolean
  brand_id:             string | null
  brand2_id:            string | null
  sort_order:           number
}

/**
 * Fetches all active hotels for a given destination slug. Orders by
 * is_supplementary ascending then name ascending — supplementary entries
 * fall to bottom regardless of name. Mirrors the dining ordering convention.
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
    throw new Error(
      `Failed to resolve destination "${destinationSlug}": ${destError.message}`,
    )
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
    .order('name',             { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch hotels: ${error.message}`)
  }

  return (data ?? []) as HotelVenue[]
}