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