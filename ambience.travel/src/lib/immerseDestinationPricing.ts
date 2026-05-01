// immerseDestinationPricing.ts — Destination-level pricing rows for /immerse/ subpages.
// Owns: getImmerseDestinationPricing — single canonical pricing fetcher.
// Does not own: trip-overview pricing (lives in immerseEngagementQueries),
//   pricing-closer (in core fetcher, comes from override row).
//
// Reads from travel_immerse_destination_pricing_rows by destination_id.
// Per Seed Reference v7 §6: 4 rows per destination — Highlighted / Alt 1 /
// Alt 2 / Dining-Experiences. is_total flag retained but all rows = false
// today (S23 cleanup left the column for future use).

import { supabase } from './supabase'
import type { ImmersePricingRow } from './immerseTypes'

export async function getImmerseDestinationPricing(
  destinationId: string,
): Promise<ImmersePricingRow[]> {
  const { data: rows, error } = await supabase
    .from('travel_immerse_destination_pricing_rows')
    .select('*')
    .eq('destination_id', destinationId)
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