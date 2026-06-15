// queriesGuidesShopping.ts — Public shopping fetch for destination guides.
//
// What it owns:
//   - fetchShoppingForDestination — reads travel_shopping for a destination.
//   - Type Shop for consumer surfaces.
//
// What it does not own:
//   - Admin CRUD (future queriesAdminShopping.ts)
//   - Rendering / UI
//
// Security model:
//   - Reads travel_shopping via RLS-gated SELECT
//   - Public clients only see is_active = true AND is_public = true rows
//   - Admin clients see all rows (via separate RLS policy)
//   - Industry-data classification — no Edge Function needed
//
// Last updated: S52 — initial ship for the Selected shopping section on the
//   experiences guide.

import { supabase } from '../lib/supabase'
import type { ShopType } from '../types/typesShopping'

// ── Type ──────────────────────────────────────────────────────────────────────

export interface Shop {
  id:                    string
  global_destination_id: string
  name:                  string
  brand:                 string | null
  shop_type:             ShopType | null
  tagline:               string | null
  body:                  string | null
  bullets:               string[] | Array<{ text: string }>
  address:               string | null
  maps_url:              string | null
  by_appointment:        boolean
  image_src:             string | null
  image_alt:             string | null
  image_credit:          string | null
  image_credit_url:      string | null
  image_license:         string | null
  is_active:             boolean
  is_public:             boolean
  sort_order:            number
  created_at:            string
  updated_at:            string
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Fetch shops for a destination. Sort: sort_order ascending, name ascending.
 * Public clients only see active+public rows; admin clients see everything via
 * RLS policy.
 */
export async function fetchShoppingForDestination(
  globalDestinationId: string,
): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('travel_shopping')
    .select('*')
    .eq('global_destination_id', globalDestinationId)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) throw new Error(`Failed to fetch shopping: ${error.message}`)
  return (data ?? []) as Shop[]
}

// ── Guide destination + overlay ──────────────────────────────────────────────

export interface ShoppingGuideOverlay {
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

export interface ShoppingGuideDestination {
  id:           string
  slug:         string
  name:         string
  heroImageSrc: string | null
  heroImageAlt: string | null
  overlay:      ShoppingGuideOverlay | null
}

export async function getShoppingGuideDestination(
  destinationSlug: string,
): Promise<ShoppingGuideDestination | null> {
  const { data, error } = await supabase
    .from('global_destinations')
    .select(`
      id, slug, name,
      hero_image_src,
      hero_image_alt,
      overlay:travel_shopping_guides(
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
    overlay: ShoppingGuideOverlay | ShoppingGuideOverlay[] | null
  }).overlay
  const overlay: ShoppingGuideOverlay | null = Array.isArray(raw)
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