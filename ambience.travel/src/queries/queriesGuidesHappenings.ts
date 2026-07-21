// queriesGuidesHappenings.ts - Public happenings fetch for destination guides.
import { camelizeKeys } from '@shared/camelize'
//
// What it owns:
//   - fetchActiveHappeningsForDestination - reads travel_happenings filtered
//     by destination + future-or-current end_date.
//   - Optional startDate/endDate narrowing for trip-aware callers.
//   - Type Happening for consumer surfaces.
//
// What it does not own:
//   - Admin happenings CRUD (lives in queriesAdminHappenings.ts when built)
//   - Rendering / UI
//
// Security model:
//   - Reads travel_happenings via RLS-gated SELECT
//   - Public clients only see is_active = true AND public_preview_rank IS NOT NULL rows (RLS: happenings_public_read, also gated end_date >= today)
//   - Admin clients see all rows (via separate RLS policy)
//   - Industry-data classification - no Edge Function needed
//
// Last updated: S53 - public_preview_rank added to type. (is_public column dropped S53O;
//   the migration recipe below is historical record of the original backfill.) select('*') pulls
//   it once the column ships. Aligns travel_happenings with the canonical
//   Gateable contract in utilsGuideGating. Requires DB migration:
//     ALTER TABLE travel_happenings ADD COLUMN public_preview_rank INTEGER;
//     UPDATE travel_happenings SET public_preview_rank = ranked.rn
//       FROM (SELECT id, ROW_NUMBER() OVER (
//         PARTITION BY global_destination_id ORDER BY start_date, name) AS rn
//         FROM travel_happenings WHERE is_active = TRUE AND is_public = TRUE)
//         ranked
//       WHERE travel_happenings.id = ranked.id;
//   Follow-up debt: replace select('*') with an explicit column list to
//   match the standard pattern in queriesGuidesDining and
//   queriesGuidesExperiences.
// Prior: S52 - optional startDate/endDate args added for future trip-aware
//   callers (immerse pages that know the guest's stay window). The current
//   GuidePageExperiences caller does not pass dates and gets all future
//   happenings for the destination.
// Prior: S52 - initial ship for the Coming Up section on the experiences
//   guide. Les Grimaldines (28 July 2026 St Tropez) is the first seeded
//   happening.

import { supabase } from '../lib/supabase'

async function invokeReadGuides<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-guides', { body })
  if (error) throw new Error(`guide read (${body.mode}): ${error.message}`)
  return data as T
}
import type { HappeningCategory, HappeningSurface } from '../types/typesHappenings'

// ── Type ─────────────────────────────────────────────────────────────────────

export interface Happening {
  id:                    string
  global_destination_id: string
  name:                  string
  category:              HappeningCategory | null
  tagline:               string | null
  body:                  string | null
  bullets:               string[] | Array<{ text: string }>
  startDate:            string   // ISO date (YYYY-MM-DD)
  endDate:              string   // ISO date (YYYY-MM-DD)
  venue_name:            string | null
  address:               string | null
  mapsUrl:              string | null
  website:               string | null
  imageSrc:             string | null
  imageAlt:             string | null
  imageCredit:          string | null
  imageCreditUrl:      string | null
  imageLicense:         string | null
  isActive:             boolean
  sortOrder:            number
  publicPreviewRank:   number | null
  surfaces:              HappeningSurface[]
  createdAt:            string
  updatedAt:            string
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Fetch active happenings for a destination.
 *
 * Default behaviour (no opts): returns happenings whose end_date is today
 * or later (i.e. not yet past). Used by destination guides that have no
 * trip context.
 *
 * With opts.startDate/endDate: returns happenings whose time window overlaps
 * with the given window. Used by trip-aware surfaces (immerse pages) to
 * narrow to "happenings during your stay."
 *
 * Sort: ascending start_date, then sort_order, then name.
 */
export async function fetchActiveHappeningsForDestination(
  globalDestinationId: string,
  opts: { surface?: HappeningSurface; startDate?: string; endDate?: string } = {},
): Promise<Happening[]> {
  const { rows } = await invokeReadGuides<{ rows: unknown[] }>({
    mode: 'happenings_by_destination',
    global_destination_id: globalDestinationId,
    surface: opts.surface ?? null,
    start_date: opts.startDate ?? null,
    end_date: opts.endDate ?? null,
  })
  return camelizeKeys<Happening[]>(rows ?? [])
}
export async function fetchHappeningById(id: string): Promise<Happening | null> {
  const { row } = await invokeReadGuides<{ row: unknown }>({ mode: 'happening_by_id', id })
  return row ? camelizeKeys<Happening>(row) : null
}

/**
 * Fetch a single happening by id. Used by admin detail surfaces and PDF
 * exports that need the full record by reference.
 */
