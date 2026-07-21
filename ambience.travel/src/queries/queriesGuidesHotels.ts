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

async function invokeReadGuides<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-guides', { body })
  if (error) throw new Error(`guide read (${body.mode}): ${error.message}`)
  return data as T
}

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
  const { rows } = await invokeReadGuides<{ rows: unknown[] }>({
    mode: 'hotels_by_destination', destination_slug: destinationSlug,
  })
  return camelizeKeys<HotelVenue[]>(rows ?? [])
}
