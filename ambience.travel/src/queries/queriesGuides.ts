// queriesGuides.ts - generic read path shared by all four guide variants.
//
// What it owns:
//   - getGuideDestination(variant, slug) - fetches global_destinations row
//     plus the per-variant travel_*_guides overlay
//   - checkGuideGrant(variant, slug) - checks travel_*_guide_for_user view
//     when grant infrastructure exists for the variant; returns 'ungated'
//     when it doesn't
//
// What it does not own:
//   - Variant-specific reads (venues / experiences / shops / hotels) - those
//     live in queriesGuides<X>.ts
//   - Admin writes - admin CRUD lives in queriesAdminGuides.ts
//
// Architecture:
//   Single source of truth for "fetch a destination + overlay for variant X"
//   and "check if the current user has access to variant X for this slug."
//   Eliminates four near-identical implementations that previously lived in
//   the per-variant query files.
//
// Last updated: S53 - initial build.

import { supabase } from '../lib/supabase'
import {
  GUIDE_TABLE_NAMES,
  GUIDE_GRANT_VIEW_NAMES,
  type GuideDestination,
  type GuideOverlay,
  type GuideVariant,
  type GrantStatus,
} from '../types/typesGuides'

const OVERLAY_FIELDS = `
  hero_image_src,
  hero_image_alt,
  eyebrow_override,
  headline_override,
  intro_override,
  is_active,
  accuracy_date,
  at_a_glance_bullets,
  guide_year,
  guide_version,
  plan_your_visit_heading,
  plan_your_visit_intro,
  plan_your_visit_bullets
`.trim()

// ── getGuideDestination ─────────────────────────────────────────────────────
//
// Returns null if the destination slug doesn't exist. Returns the destination
// even when overlay is null (no travel_*_guides row exists). The caller -
// typically useGuideRoute - decides what overlay-null means.

export async function getGuideDestination(
  variant: GuideVariant,
  destinationSlug: string,
): Promise<GuideDestination | null> {
  const overlayTable = GUIDE_TABLE_NAMES[variant]

  const { data, error } = await supabase
    .from('global_destinations')
    .select(`
      id, slug, name,
      hero_image_src,
      hero_image_alt,
      overlay:${overlayTable}(${OVERLAY_FIELDS})
    `)
    .eq('slug', destinationSlug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch destination "${destinationSlug}" (${variant}): ${error.message}`)
  }
  if (!data) return null

  const raw = (data as unknown as {
    overlay: GuideOverlay | GuideOverlay[] | null
  }).overlay
  const overlay: GuideOverlay | null = Array.isArray(raw)
    ? (raw.length > 0 ? raw[0] : null)
    : (raw ?? null)

  const d = data as unknown as {
    id:             string
    slug:           string
    name:           string
    heroImageSrc: string | null
    heroImageAlt: string | null
  }

  return {
    id:           d.id,
    slug:         d.slug,
    name:         d.name,
    heroImageSrc: d.heroImageSrc,
    heroImageAlt: d.heroImageAlt,
    overlay,
  }
}

// ── checkGuideGrant ─────────────────────────────────────────────────────────

export async function checkGuideGrant(
  variant: GuideVariant,
  destinationSlug: string,
): Promise<GrantStatus> {
  const viewName = GUIDE_GRANT_VIEW_NAMES[variant]
  if (!viewName) return { status: 'ungated' }

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return { status: 'no_session' }

  const { data, error } = await supabase
    .from(viewName)
    .select('global_destination_id')
    .eq('destination_slug', destinationSlug)
    .maybeSingle()

  if (error) throw new Error(`Grant check failed (${variant}): ${error.message}`)
  if (!data) return { status: 'no_grant' }
  return { status: 'granted' }
}