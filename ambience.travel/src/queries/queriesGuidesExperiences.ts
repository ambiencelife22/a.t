// experiencesGuideQueries.ts — read path for the experiences guide page
// Mirrors diningGuideQueries.ts shape exactly.
// What it owns: fetch experience venues + per-destination guide overlay row
//   + grant check via experiences_guide_for_user view.
// What it does not own: gating UI, admin grant management.
//
// Grant gating: experiences_guide_for_user view live (S41). Grant check
//   wired but hasFullAccess hardcoded true in ExperiencesGuideRoute until
//   gating is enabled. Remove hardcode when ready to gate.
//
// Last updated: S41 — checkExperiencesGuideGrant() added. experiences_guide_grants
//   table + experiences_guide_for_user view (SECURITY INVOKER) live.
// Prior: S40B — experience_category added to ExperienceVenue type + SELECT.
// Prior: S41 — initial build. Mirrors dining guide query architecture.

import { supabase } from '../lib/supabase'

export interface ExperienceVenue {
  id:                  string
  name:                string
  kicker:              string | null
  tagline:             string | null
  body:                string | null
  bullets_heading:     string | null
  bullets:             string[] | null
  address:             string | null
  maps_url:            string | null
  image_src:           string | null
  image_alt:           string | null
  image_credit:        string | null
  image_credit_url:    string | null
  image_license:       string | null
  sort_order:          number
  experience_category: string | null
}

export interface ExperiencesGuideOverlay {
  hero_image_src:          string | null
  hero_image_alt:          string | null
  headline_override:       string | null
  intro_override:          string | null
  eyebrow_override:        string | null
  guide_year:              number | null
  guide_version:           string | null
  plan_your_visit_heading: string | null
  plan_your_visit_intro:   string | null
  plan_your_visit_bullets: string[] | null
  at_a_glance_bullets:     string[] | null
  accuracy_date:           string | null
}

export interface ExperiencesGuideDestination {
  id:           string
  slug:         string
  name:         string
  heroImageSrc: string | null
  heroImageAlt: string | null
  overlay:      ExperiencesGuideOverlay | null
}

export type GrantStatus =
  | { status: 'granted' }
  | { status: 'no_grant' }
  | { status: 'no_session' }

export async function checkExperiencesGuideGrant(
  destinationSlug: string,
): Promise<GrantStatus> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return { status: 'no_session' }

  const { data, error } = await supabase
    .from('travel_experiences_guide_for_user')
    .select('global_destination_id')
    .eq('destination_slug', destinationSlug)
    .maybeSingle()

  if (error) throw new Error(`Grant check failed: ${error.message}`)
  if (!data) return { status: 'no_grant' }
  return { status: 'granted' }
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
    throw new Error(`Failed to resolve destination "${destinationSlug}": ${destError.message}`)
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
      sort_order, experience_category
    `)
    .eq('global_destination_id', dest.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch experiences: ${error.message}`)
  }

  return (data ?? []) as ExperienceVenue[]
}

export async function getExperiencesGuideDestination(
  destinationSlug: string,
): Promise<ExperiencesGuideDestination | null> {
  const { data, error } = await supabase
    .from('global_destinations')
    .select(`
      id, slug, name,
      hero_image_src,
      hero_image_alt,
      overlay:travel_experiences_guides(
        hero_image_src,
        hero_image_alt,
        headline_override,
        intro_override,
        eyebrow_override,
        guide_year,
        guide_version,
        plan_your_visit_heading,
        plan_your_visit_intro,
        plan_your_visit_bullets,
        at_a_glance_bullets,
        accuracy_date
      )
    `)
    .eq('slug', destinationSlug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch destination: ${error.message}`)
  }
  if (!data) return null

  const raw = (data as unknown as {
    overlay: ExperiencesGuideOverlay | ExperiencesGuideOverlay[] | null
  }).overlay
  const overlay: ExperiencesGuideOverlay | null = Array.isArray(raw)
    ? (raw.length > 0 ? raw[0] : null)
    : (raw ?? null)

  const d = data as unknown as {
    id:             string
    slug:           string
    name:           string
    hero_image_src: string | null
    hero_image_alt: string | null
  }

  return {
    id:           d.id,
    slug:         d.slug,
    name:         d.name,
    heroImageSrc: d.hero_image_src,
    heroImageAlt: d.hero_image_alt,
    overlay,
  }
}