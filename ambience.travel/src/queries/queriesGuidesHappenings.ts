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
  let query = supabase
    .from('travel_happenings')
    .select('id, global_destination_id, name, category, tagline, body, bullets, start_date, end_date, venue_name, address, maps_url, website, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order, public_preview_rank, surfaces, created_at, updated_at')
    .eq('global_destination_id', globalDestinationId)

  if (opts.surface) {
    query = query.contains('surfaces', [opts.surface])
  }

  const hasWindow = !!(opts.startDate || opts.endDate)

  if (hasWindow) {
    // Window-overlap: happening.startDate <= window.end AND happening.endDate >= window.start
    if (opts.endDate)   query = query.lte('start_date', opts.endDate)
    if (opts.startDate) query = query.gte('end_date',   opts.startDate)
  }
  if (!hasWindow) {
    // Default: not yet past
    const today = new Date().toISOString().slice(0, 10)
    query = query.gte('end_date', today)
  }

  const { data, error } = await query
    .order('start_date', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) throw new Error(`Failed to fetch happenings: ${error.message}`)
  return camelizeKeys<Happening[]>(data ?? [])
}

/**
 * Fetch a single happening by id. Used by admin detail surfaces and PDF
 * exports that need the full record by reference.
 */
export async function fetchHappeningById(id: string): Promise<Happening | null> {
  const { data, error } = await supabase
    .from('travel_happenings')
    .select('id, global_destination_id, name, category, tagline, body, bullets, start_date, end_date, venue_name, address, maps_url, website, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order, public_preview_rank, surfaces, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch happening: ${error.message}`)
  return data as Happening | null
}