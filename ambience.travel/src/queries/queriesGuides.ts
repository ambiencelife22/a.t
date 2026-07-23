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
import { camelizeKeys } from '@shared/camelize'
import {
  type GuideDestination,
  type GuideOverlay,
  type GuideVariant,
  type GrantStatus,
} from '../types/typesGuides'

async function invokeReadGuides<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-guides', { body })
  if (error) throw new Error(`guide read (${body.mode}): ${error.message}`)
  return data as T
}

export async function fetchAllDestinationsFull(): Promise<Array<{ id: string; slug: string; name: string; storagePath: string | null }>> {
  const { rows } = await invokeReadGuides<{ rows: unknown[] }>({ mode: 'destinations_all' })
  return camelizeKeys<Array<{ id: string; slug: string; name: string; storagePath: string | null }>>(rows ?? [])
}


// ── getGuideDestination ─────────────────────────────────────────────────────
//
// Returns null if the destination slug doesn't exist. Returns the destination
// even when overlay is null (no travel_*_guides row exists). The caller -
// typically useGuideRoute - decides what overlay-null means.

export async function getGuideDestination(
  variant: GuideVariant,
  destinationSlug: string,
): Promise<GuideDestination | null> {
  const { row } = await invokeReadGuides<{ row: unknown }>({
    mode: 'destination', variant, destination_slug: destinationSlug,
  })
  if (!row) return null
  const d = camelizeKeys<any>(row)
  const raw = d.overlay as GuideOverlay | GuideOverlay[] | null
  const overlay: GuideOverlay | null = Array.isArray(raw)
    ? (raw.length > 0 ? raw[0] : null)
    : (raw ?? null)
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
  const { status } = await invokeReadGuides<{ status: GrantStatus['status'] }>({
    mode: 'grant', variant, destination_slug: destinationSlug,
  })
  return { status }
}