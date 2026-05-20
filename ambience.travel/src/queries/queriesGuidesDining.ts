// diningGuideQueries.ts — read path for the dining guide page
// What it owns: fetch dining venues + per-destination guide overlay row +
//   grant check via dining_guide_for_user view.
// What it does not own: gating UI, admin grant management.
//
// Last updated: S40C — Added checkGuideGrant(). Queries dining_guide_for_user
//   view (SECURITY INVOKER) to determine whether the current auth user has
//   been granted access to a specific destination's guide.
// Prior: S40 — Canon hero resolution. hero_image_src + hero_image_alt added
//   to global_destinations as canonical fields (migration s40_01).
// Prior: S39 — Added accuracy_date. Removed slug (dropped S38).

import { supabase } from '../lib/supabase'

export type VenueStatus = 'operational' | 'temporarily_closed' | 'permanently_closed' | 'seasonal_closure'

export type MichelinAward = 'star' | 'bib_gourmand'

export interface DiningVenue {
  id: string
  name: string
  cuisine_subcategory: string | null
  kicker: string | null
  tagline: string | null
  body: string | null
  bullets_heading: string | null
  bullets: string[] | null
  michelin_award: MichelinAward | null
  michelin_stars: number | null
  michelin_green_star: boolean
  worlds_50_best: boolean
  address: string | null
  maps_url: string | null
  website: string | null
  neighborhood: string | null
  price_band: string | null
  public_preview_rank: number | null
  tags: string[] | null
  image_src: string | null
  image_alt: string | null
  image_credit: string | null
  image_credit_url: string | null
  image_license: string | null
  image_2_src: string | null
  image_2_alt: string | null
  sort_order: number
  is_supplementary: boolean
  is_highlighted: boolean
  venue_status: VenueStatus
}

export interface DiningGuideOverlay {
  hero_image_src: string | null
  hero_image_alt: string | null
  headline_override: string | null
  intro_override: string | null
  eyebrow_override: string | null
  guide_year: number | null
  guide_version: string | null
  plan_your_visit_heading: string | null
  plan_your_visit_intro:   string | null
  plan_your_visit_bullets: string[] | null
  accuracy_date: string | null
}

export interface GuideDestination {
  id: string
  slug: string
  name: string
  heroImageSrc: string | null
  heroImageAlt: string | null
  overlay: DiningGuideOverlay | null
}

export type GrantStatus =
  | { status: 'granted' }
  | { status: 'no_grant' }
  | { status: 'no_session' }

export async function checkGuideGrant(
  destinationSlug: string,
): Promise<GrantStatus> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return { status: 'no_session' }

  const { data, error } = await supabase
    .from('travel_dining_guide_for_user')
    .select('global_destination_id')
    .eq('destination_slug', destinationSlug)
    .maybeSingle()

  if (error) throw new Error(`Grant check failed: ${error.message}`)
  if (!data) return { status: 'no_grant' }
  return { status: 'granted' }
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
    throw new Error(`Failed to resolve destination "${destinationSlug}": ${destError.message}`)
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
      sort_order, is_supplementary, is_highlighted, venue_status
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

export async function getGuideDestination(
  destinationSlug: string,
): Promise<GuideDestination | null> {
  const { data, error } = await supabase
    .from('global_destinations')
    .select(`
      id, slug, name,
      hero_image_src,
      hero_image_alt,
      overlay:travel_dining_guides(
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

  const raw = (data as unknown as { overlay: DiningGuideOverlay | DiningGuideOverlay[] | null }).overlay
  const overlay: DiningGuideOverlay | null =
    Array.isArray(raw)
      ? (raw.length > 0 ? raw[0] : null)
      : (raw ?? null)

  const d = data as unknown as {
    id: string
    slug: string
    name: string
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