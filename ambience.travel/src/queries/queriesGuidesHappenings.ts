// queriesGuidesHappenings.ts — Public happenings fetch for destination guides.
//
// What it owns:
//   - fetchActiveHappeningsForDestination — reads travel_happenings filtered
//     by destination + future-or-current end_date.
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
// Last updated: S52 — initial ship for the What's On section on the
//   experiences guide. Les Grimaldines (28 July 2026 St Tropez) is the
//   first seeded happening.

import { supabase } from '../lib/supabase'

// ── Type ──────────────────────────────────────────────────────────────────────

export interface Happening {
  id:                    string
  global_destination_id: string
  name:                  string
  category:              string | null
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
  created_at:            string
  updated_at:            string
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Fetch active happenings for a destination that have not yet ended.
 * Filters server-side on end_date >= today (UTC) so past happenings are
 * never sent to the client.
 *
 * Sort order: ascending by start_date, then sort_order, then name.
 * (Soonest-first, with admin-controlled tiebreaker via sort_order.)
 */
export async function fetchActiveHappeningsForDestination(
  globalDestinationId: string,
): Promise<Happening[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('travel_happenings')
    .select('*')
    .eq('global_destination_id', globalDestinationId)
    .gte('end_date', today)
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