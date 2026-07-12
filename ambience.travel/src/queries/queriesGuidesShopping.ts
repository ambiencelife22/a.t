// queriesGuidesShopping.ts — public shopping fetch for destination guides.
//
// What it owns:
//   - Shop type
//   - fetchShoppingForDestination — reads travel_shopping for a destination
//
// What it does not own:
//   - Destination + overlay fetch → queriesGuides.getGuideDestination
//   - GuideDestination type → typesGuides
//   - Admin CRUD (future queriesAdminShopping.ts)
//   - Rendering / UI
//
// Security model:
//   - Reads travel_shopping via RLS-gated SELECT
//   - Public clients only see is_active = true AND public_preview_rank IS NOT NULL rows (RLS: happenings_public_read, also gated end_date >= today)
//   - Admin clients see all rows (via separate RLS policy)
//   - Industry-data classification — no Edge Function needed
//
// Last updated: S53 — public_preview_rank added to type. (is_public column dropped S53O;
//   the migration recipe below is historical record of the original backfill.) select('*') pulls
//   it once the column ships. Aligns travel_shopping with the canonical
//   Gateable contract in utilsGuideGating. Requires DB migration:
//     ALTER TABLE travel_shopping ADD COLUMN public_preview_rank INTEGER;
//     UPDATE travel_shopping SET public_preview_rank = ranked.rn
//       FROM (SELECT id, ROW_NUMBER() OVER (
//         PARTITION BY global_destination_id ORDER BY name) AS rn
//         FROM travel_shopping WHERE is_active = TRUE AND is_public = TRUE)
//         ranked
//       WHERE travel_shopping.id = ranked.id;
//   Follow-up debt: replace select('*') with an explicit column list to
//   match the standard pattern in queriesGuidesDining and
//   queriesGuidesExperiences.
// Prior: S53 — Destination + overlay code lifted to queriesGuides.ts.
//   Removed ShoppingGuideOverlay, ShoppingGuideDestination,
//   getShoppingGuideDestination. This file is now purely the shop read path.
// Prior: S52 — initial ship.

import { supabase } from '../lib/supabase'
import type { ShopType } from '../types/typesShopping'

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
  sort_order:            number
  public_preview_rank:   number | null
  created_at:            string
  updated_at:            string
}

/**
 * Fetch shops for a destination. Sort: sort_order ascending, name ascending.
 * Public clients only see active+public rows; admin clients see everything
 * via RLS policy.
 */
export async function fetchShoppingForDestination(
  globalDestinationId: string,
): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('travel_shopping')
    .select('id, global_destination_id, name, brand, shop_type, tagline, body, bullets, address, maps_url, by_appointment, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order, public_preview_rank, created_at, updated_at')
    .eq('global_destination_id', globalDestinationId)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (error) throw new Error(`Failed to fetch shopping: ${error.message}`)
  return (data ?? []) as Shop[]
}