// queriesGuidesHappenings.ts — Public happenings fetch for destination guides.
//
// What it owns:
//   - fetchActiveHappeningsForDestination — reads travel_happenings filtered
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
//   - Public clients only see is_active = true AND is_public = true rows
//   - Admin clients see all rows (via separate RLS policy)
//   - Industry-data classification — no Edge Function needed
//
// Last updated: S52 — optional startDate/endDate args added for future
//   trip-aware callers (immerse pages that know the guest's stay window).
//   The current ExperiencesGuidePage caller does not pass dates and gets
//   all future happenings for the destination.
// Prior: S52 — initial ship for the What's On section on the experiences
//   guide. Les Grimaldines (28 July 2026 St Tropez) is the first seeded
//   happening.

import { supabase } from '../lib/supabase'
import type { HappeningCategory, HappeningSurface } from '../types/typesHappenings'

// ── Type ──────────────────────────────────────────────────────────────────────

export interface Happening {
  id:                    string
  global_destination_id: string
  name:                  string
  category:              HappeningCategory | null
  tagline:               string | null
  body:                  string | null
  bullets:               string[] | Array<{ text: string }>
  start_date:            string   // ISO date (YYYY-MM-DD)
  end_date:              string   // ISO date (YYYY-MM-DD)
  venue_name:            string | null
  address:               string | null
  maps_url:              string | null
  website_url:           string | null
  image_src:             string | null
  image_alt:             string | null
  image_credit:          string | null
  image_credit_url:      string | null
  image_license:         string | null
  is_active:             boolean
  is_public:             boolean
  sort_order:            number
  surfaces:              HappeningSurface[]
  created_at:            string
  updated_at:            string
}

// ── Reads ─────────────────────────────────────────────────────────────────────

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
    .select('*')
    .eq('global_destination_id', globalDestinationId)

  if (opts.surface) {
    query = query.contains('surfaces', [opts.surface])
  }

  const hasWindow = !!(opts.startDate || opts.endDate)

  if (hasWindow) {
    // Window-overlap: happening.start_date <= window.end AND happening.end_date >= window.start
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
  return (data ?? []) as Happening[]
}

/**
 * Fetch a single happening by id. Used by admin detail surfaces and PDF
 * exports that need the full record by reference.
 */
export async function fetchHappeningById(id: string): Promise<Happening | null> {
  const { data, error } = await supabase
    .from('travel_happenings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch happening: ${error.message}`)
  return data as Happening | null
}