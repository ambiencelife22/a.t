// queriesGuidesHotels.ts - read path for hotels.
import { camelizeKeys } from '@shared/camelize'
//
// What it owns:
//   - HotelVenue type
//   - getHotelsByDestination - fetches travel_accom_hotels for a slug
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
// Last updated: S53 - public_preview_rank added to type + SELECT. Aligns
//   travel_accom_hotels with the canonical Gateable contract in
//   utilsGuideGating. Requires DB migration:
//     ALTER TABLE travel_accom_hotels ADD COLUMN public_preview_rank INTEGER;
//     UPDATE travel_accom_hotels SET public_preview_rank = ranked.rn
//       FROM (SELECT id, ROW_NUMBER() OVER (
//         PARTITION BY destination_id ORDER BY name) AS rn
//         FROM travel_accom_hotels WHERE is_active = TRUE) ranked
//       WHERE travel_accom_hotels.id = ranked.id;
// Prior: S53 - Destination + overlay code lifted to queriesGuides.ts.
//   Removed HotelGuideOverlay, HotelGuideDestination, getHotelGuideDestination.
//   This file is now purely the hotel read path.
// Prior: S37 - initial. Pattern lifted from queriesGuidesDining.ts.

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
  googleMapsUrl:      string | null
  website:              string | null
  heroImageSrc:       string | null
  heroImageAlt:       string | null
  imageCredit:         string | null
  imageCreditUrl:     string | null
  imageLicense:        string | null
  bullets:              unknown
  stars:                number | null
  michelinKeys:        number | null
  forbesRating:        number | null
  isPreferredPartner: boolean
  isSupplementary:     boolean
  brandId:             string | null
  brand2_id:            string | null
  sortOrder:           number
  publicPreviewRank:  number | null
}

/**
 * Fetches all active hotels for a given destination slug. Orders by
 * is_supplementary ascending then name ascending - supplementary entries
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
      google_maps_url, website,
      hero_image_src, hero_image_alt,
      image_credit, image_credit_url, image_license,
      bullets,
      stars, michelin_keys, forbes_rating,
      is_preferred_partner, is_supplementary,
      brand_id, brand2_id,
      sort_order,
      public_preview_rank
    `)
    .eq('destination_id', dest.id)
    .eq('is_active', true)
    .order('is_supplementary', { ascending: true })
    .order('name',             { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch hotels: ${error.message}`)
  }

  return camelizeKeys<HotelVenue[]>(data ?? [])
}