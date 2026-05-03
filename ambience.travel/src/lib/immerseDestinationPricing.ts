// immerseDestinationPricing.ts — Destination-level pricing rows for /immerse/ subpages.
// Owns: getImmerseDestinationPricing — single canonical pricing fetcher.
// Does not own: trip-overview pricing (lives in immerseEngagementQueries),
//   pricing-closer (in core fetcher, comes from override row).
//
// Last updated: S32K — Migrated from canon-keyed to engagement-scoped reads.
//   Pricing rows now FK to travel_immerse_trip_destination_rows.id (the
//   per-engagement destination row), not to travel_immerse_destinations.id
//   (canon). Each engagement carries its own pricing rows. No canon fallback.
// Prior: pre-S32K — Read by destination_id (canon). Multi-engagement
//   contamination risk: every engagement using a destination saw the same
//   pricing rows. Resolved by structural migration s32k_71 (column added,
//   data fanned out, frontend cutover here).
//
// Reads from travel_immerse_destination_pricing_rows by trip_destination_row_id.
// Per Seed Reference v7 §6: typically 2-4 rows per engagement-destination —
// Highlighted / Alt 1 / Alt 2 / Dining-Experiences, or Stay 1 / Stay 2 split.
// is_total flag retained but all rows = false today.

import { supabase } from './supabase'
import type { ImmersePricingRow } from './immerseTypes'

export async function getImmerseDestinationPricing(
  tripDestinationRowId: string,
): Promise<ImmersePricingRow[]> {
  const { data: rows, error } = await supabase
    .from('travel_immerse_destination_pricing_rows')
    .select('*')
    .eq('trip_destination_row_id', tripDestinationRowId)
    .order('sort_order', { ascending: true })

  if (error || !rows) return []

  return rows.map(r => ({
    id:              r.id,
    item:            r.item             ?? '',
    basis:           r.basis            ?? '',
    stay:            r.stay             ?? '',
    indicativeRange: r.indicative_range ?? '',
    isTotal:         r.is_total         ?? false,
  }))
}