// queriesGuidesDining.ts — read path for dining venues.
//
// What it owns:
//   - DiningVenue type (the venue table shape)
//   - VenueStatus, MichelinAward types
//   - getDiningVenuesByDestination — fetches travel_dining_venues for a slug
//
// What it does not own:
//   - Destination + overlay fetch → queriesGuides.getGuideDestination
//   - Grant check → queriesGuides.checkGuideGrant
//   - GuideDestination type → typesGuides
//   - GrantStatus type → typesGuides
//   - Admin grant management
//
// STANDING RULE — sort_order is data hygiene only, not display logic.
// Render order on the dining guide page and PDF is alphabetical within each
// editorial section (primary, supplementary, recently closed) via
// name.localeCompare(). The `is_supplementary` flag drives section
// membership; the `venue_status` + `closed_visible_until` pair drives the
// recently-closed group. sort_order remains in the schema as advisory data
// and a stable tiebreaker for future use cases, but no display layer reads
// it.
//
// Last updated: S53 — Destination + grant code lifted to queriesGuides.ts.
//   Removed DiningGuideOverlay, GuideDestination, GrantStatus, checkGuideGrant,
//   getGuideDestination. This file is now purely the venue read path.
// Prior: S52 — Added closed_visible_until to DiningVenue type and SELECT.
// Prior: S40C — checkGuideGrant() added (now lifted).
// Prior: S40 — Canon hero resolution. hero_image_src + hero_image_alt added
//   to global_destinations as canonical fields (migration s40_01).
// Prior: S39 — Added accuracy_date. Removed slug (dropped S38).

import { supabase } from '../lib/supabase'

export type VenueStatus =
  | 'operational'
  | 'temporarily_closed'
  | 'permanently_closed'
  | 'seasonal_closure'

export type MichelinAward = 'star' | 'bib_gourmand'

export interface DiningVenue {
  id:                     string
  name:                   string
  cuisine_subcategory:    string | null
  kicker:                 string | null
  tagline:                string | null
  body:                   string | null
  bullets_heading:        string | null
  bullets:                string[] | null
  michelin_award:         MichelinAward | null
  michelin_stars:         number | null
  michelin_green_star:    boolean
  worlds_50_best:         boolean
  address:                string | null
  maps_url:               string | null
  website:                string | null
  neighborhood:           string | null
  price_band:             string | null
  public_preview_rank:    number | null
  tags:                   string[] | null
  image_src:              string | null
  image_alt:              string | null
  image_credit:           string | null
  image_credit_url:       string | null
  image_license:          string | null
  image_2_src:            string | null
  image_2_alt:            string | null
  sort_order:             number
  is_supplementary:       boolean
  is_highlighted:         boolean
  venue_status:           VenueStatus
  closed_visible_until:   string | null
}

export async function getDiningVenuesByDestination(
  destinationSlug: string,
): Promise<DiningVenue[]> {
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
    .from('travel_dining_venues')
    .select(`
      id, name, cuisine_subcategory,
      kicker, tagline, body, bullets_heading, bullets,
      michelin_award, michelin_stars, michelin_green_star,
      worlds_50_best,
      address, maps_url, website,
      neighborhood, price_band, public_preview_rank, tags,
      image_src, image_alt, image_credit, image_credit_url, image_license,
      image_2_src, image_2_alt,
      sort_order, is_supplementary, is_highlighted, venue_status,
      closed_visible_until
    `)
    .eq('global_destination_id', dest.id)
    .eq('is_active', true)
    .order('is_supplementary', { ascending: true })
    .order('name',             { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch dining venues: ${error.message}`)
  }

  return (data ?? []) as DiningVenue[]
}