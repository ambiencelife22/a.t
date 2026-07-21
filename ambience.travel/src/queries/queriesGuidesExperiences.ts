// queriesGuidesExperiences.ts - read path for experience venues.
//
// What it owns:
//   - ExperienceVenue type
//   - getExperienceVenuesByDestination - fetches travel_experiences for a slug
//
// What it does not own:
//   - Destination + overlay fetch → queriesGuides.getGuideDestination
//   - Grant check → queriesGuides.checkGuideGrant
//   - GuideDestination type → typesGuides
//   - GrantStatus type → typesGuides
//
// Last updated: S53 - public_preview_rank added to type + SELECT. Aligns
//   travel_experiences with the canonical Gateable contract in
//   utilsGuideGating. Requires DB migration:
//     ALTER TABLE travel_experiences ADD COLUMN public_preview_rank INTEGER;
//     UPDATE travel_experiences SET public_preview_rank = ranked.rn
//       FROM (SELECT id, ROW_NUMBER() OVER (
//         PARTITION BY global_destination_id ORDER BY name) AS rn
//         FROM travel_experiences WHERE is_active = TRUE) ranked
//       WHERE travel_experiences.id = ranked.id;
// Prior: S53 - Destination + grant code lifted to queriesGuides.ts.
//   Removed ExperiencesGuideOverlay, ExperiencesGuideDestination, GrantStatus,
//   checkExperiencesGuideGrant, getExperiencesGuideDestination. This file is
//   now purely the experience read path.
// Prior: S41 - checkExperiencesGuideGrant() added (now lifted).
// Prior: S40B - experience_category added to ExperienceVenue type + SELECT.
// Prior: S41 - initial build.

import { supabase } from '../lib/supabase'

export interface ExperienceVenue {
  id:                  string
  name:                string
  kicker:              string | null
  tagline:             string | null
  body:                string | null
  bulletsHeading:     string | null
  bullets:             string[] | null
  address:             string | null
  mapsUrl:            string | null
  imageSrc:           string | null
  imageAlt:           string | null
  imageCredit:        string | null
  imageCreditUrl:    string | null
  imageLicense:       string | null
  sortOrder:          number
  experienceCategory: string | null
  publicPreviewRank: number | null
}

export async function getExperienceVenuesByDestination(
  destinationSlug: string,
): Promise<ExperienceVenue[]> {
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
    .from('travel_experiences')
    .select(`
      id, name,
      kicker, tagline, body, bullets_heading, bullets,
      address, maps_url,
      image_src, image_alt, image_credit, image_credit_url, image_license,
      sort_order,
      experienceCategory:travel_experience_categories(label),
      public_preview_rank
    `)
    .eq('global_destination_id', dest.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch experiences: ${error.message}`)
  }

  return (data ?? []).map((r: any) => ({
    ...r,
    experienceCategory: r.experienceCategory?.label ?? null,
  })) as ExperienceVenue[]
}