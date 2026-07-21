// queriesGuidesDining.ts - read path for dining venues.
import { camelizeKeys } from '@shared/camelize'
//
// What it owns:
//   - DiningVenue type (the venue table shape)
//   - VenueStatus, MichelinAward types
//   - getDiningVenuesByDestination - fetches travel_dining_venues for a slug
//
// What it does not own:
//   - Destination + overlay fetch → queriesGuides.getGuideDestination
//   - Grant check → queriesGuides.checkGuideGrant
//   - GuideDestination type → typesGuides
//   - GrantStatus type → typesGuides
//   - Admin grant management
//
// STANDING RULE - sort_order is data hygiene only, not display logic.
// Render order on the dining guide page and PDF is alphabetical within each
// editorial section (primary, supplementary, recently closed) via
// name.localeCompare(). The `is_supplementary` flag drives section
// membership; the `venue_status` + `closed_visible_until` pair drives the
// recently-closed group. sort_order remains in the schema as advisory data
// and a stable tiebreaker for future use cases, but no display layer reads
// it.
//
// Last updated: S53 - Destination + grant code lifted to queriesGuides.ts.
//   Removed DiningGuideOverlay, GuideDestination, GrantStatus, checkGuideGrant,
//   getGuideDestination. This file is now purely the venue read path.
// Prior: S52 - Added closed_visible_until to DiningVenue type and SELECT.
// Prior: S40C - checkGuideGrant() added (now lifted).
// Prior: S40 - Canon hero resolution. hero_image_src + hero_image_alt added
//   to global_destinations as canonical fields (migration s40_01).
// Prior: S39 - Added accuracy_date. Removed slug (dropped S38).

import { supabase } from '../lib/supabase'

async function invokeReadGuides<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-guides', { body })
  if (error) throw new Error(`guide read (${body.mode}): ${error.message}`)
  return data as T
}

export type VenueStatus =
  | 'operational'
  | 'temporarily_closed'
  | 'permanently_closed'
  | 'seasonal_closure'

export type MichelinAward = 'star' | 'bib_gourmand'

export interface DiningVenue {
  id:                     string
  name:                   string
  cuisineSubcategory:    string | null
  kicker:                 string | null
  tagline:                string | null
  body:                   string | null
  bulletsHeading:        string | null
  bullets:                string[] | null
  michelinAward:         MichelinAward | null
  michelinStars:         number | null
  michelinGreenStar:    boolean
  worlds50Best:         boolean
  address:                string | null
  mapsUrl:               string | null
  website:                string | null
  neighborhood:           string | null
  priceBand:             string | null
  publicPreviewRank:    number | null
  tags:                   string[] | null
  imageSrc:              string | null
  imageAlt:              string | null
  imageCredit:           string | null
  imageCreditUrl:       string | null
  imageLicense:          string | null
  image2Src:            string | null
  image2Alt:            string | null
  sortOrder:             number
  isSupplementary:       boolean
  isHighlighted:         boolean
  venue_status:           VenueStatus
  closed_visible_until:   string | null
}

export async function getDiningVenuesByDestination(
  destinationSlug: string,
): Promise<DiningVenue[]> {
  const { rows } = await invokeReadGuides<{ rows: unknown[] }>({
    mode: 'dining_by_destination', destination_slug: destinationSlug,
  })
  return camelizeKeys<DiningVenue[]>(rows ?? [])
}