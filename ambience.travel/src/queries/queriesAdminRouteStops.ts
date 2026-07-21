// adminRouteStopQueries.ts - Supabase reads/writes for the route stops
import { camelizeKeys } from '@shared/camelize'
// editor on engagement detail.
// Owns: list / update / insert / delete / reorder rows on
//       travel_overlay_route_stops.
// Not owned: uploads (adminAssetQueries.ts), engagement-level queries
//            (adminEngagementQueries.ts).
//
// Schema verified S33D pre-flight: 11 columns. Title is free text - no FK
// to global_destinations (route stops can name places without canonical
// destination rows, e.g. "Saudi Arabia" with no destination row).
// sort_order is 0-indexed in this table (matches DB sample).
// Last updated: S33D

import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RouteStop = {
  id:                 string
  engagementId:            string
  sortOrder:         number
  title:              string | null
  stayLabel:         string | null
  note:               string | null
  imageSrc:          string | null
  imageAlt:          string | null
  destinationRowId: string | null
  nights:             number | null
  createdAt:         string
  updatedAt:         string
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchRouteStops(engagementId: string): Promise<RouteStop[]> {
  const { data, error } = await supabase
    .from('travel_overlay_route_stops')
    .select('id, engagement_id, title, stay_label, note, image_src, image_alt, sort_order, destination_row_id, nights, created_at, updated_at')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return camelizeKeys<RouteStop[]>(data ?? [])
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateRouteStop(
  id:      string,
  payload: Partial<RouteStop>,
): Promise<void> {
  const clean: Record<string, unknown> = { ...payload }
  delete clean.id
  delete clean.engagementId
  delete clean.createdAt
  delete clean.updatedAt

  const { error } = await supabase
    .from('travel_overlay_route_stops')
    .update(clean)
    .eq('id', id)
  if (error) throw error
}

// ── Insert ────────────────────────────────────────────────────────────────────

export type RouteStopCreatePayload = {
  engagementId:     string
  sortOrder:  number
  title?:      string | null
  stayLabel?: string | null
  note?:       string | null
  imageSrc?:  string | null
  imageAlt?:  string | null
}

export async function insertRouteStop(payload: RouteStopCreatePayload): Promise<string> {
  const { data, error } = await supabase
    .from('travel_overlay_route_stops')
    .insert({
      engagement_id: payload.engagementId,
      sort_order: payload.sortOrder,
      title:      payload.title      ?? null,
      stay_label: payload.stayLabel ?? null,
      note:       payload.note       ?? null,
      image_src: payload.imageSrc  ?? null,
      image_alt: payload.imageAlt  ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRouteStop(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_overlay_route_stops')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Reorder (drag-and-drop) ───────────────────────────────────────────────────

/**
 * Reassigns sort_order to 0..N-1 across the list of IDs in the new desired
 * order. Note 0-indexed - matches existing DB convention for this table.
 */
export async function reorderRouteStops(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('travel_overlay_route_stops')
      .update({ sortOrder: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
}

// ── Max sort_order (for new-stop defaults) ────────────────────────────────────

export async function fetchMaxRouteStopSortOrder(engagementId: string): Promise<number> {
  const { data, error } = await supabase
    .from('travel_overlay_route_stops')
    .select('sort_order')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  // 0-indexed: first is 0, next default is 1
  return (data?.sort_order ?? -1) + 1
}