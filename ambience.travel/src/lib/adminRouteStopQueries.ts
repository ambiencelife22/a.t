// adminRouteStopQueries.ts — Supabase reads/writes for the route stops
// editor on engagement detail.
// Owns: list / update / insert / delete / reorder rows on
//       travel_immerse_route_stops.
// Not owned: uploads (adminAssetQueries.ts), engagement-level queries
//            (adminEngagementQueries.ts).
//
// Schema verified S33D pre-flight: 11 columns. Title is free text — no FK
// to global_destinations (route stops can name places without canonical
// destination rows, e.g. "Saudi Arabia" with no destination row).
// sort_order is 0-indexed in this table (matches DB sample).
// Last updated: S33D

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RouteStop = {
  id:         string
  trip_id:    string
  sort_order: number
  title:      string | null
  stay_label: string | null
  note:       string | null
  image_src:  string | null
  image_alt:  string | null
  created_at: string
  updated_at: string
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchRouteStops(engagementId: string): Promise<RouteStop[]> {
  const { data, error } = await supabase
    .from('travel_immerse_route_stops')
    .select('*')
    .eq('trip_id', engagementId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as RouteStop[]
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateRouteStop(
  id:      string,
  payload: Partial<RouteStop>,
): Promise<void> {
  const clean: Record<string, unknown> = { ...payload }
  delete clean.id
  delete clean.trip_id
  delete clean.created_at
  delete clean.updated_at

  const { error } = await supabase
    .from('travel_immerse_route_stops')
    .update(clean)
    .eq('id', id)
  if (error) throw error
}

// ── Insert ────────────────────────────────────────────────────────────────────

export type RouteStopCreatePayload = {
  trip_id:     string
  sort_order:  number
  title?:      string | null
  stay_label?: string | null
  note?:       string | null
  image_src?:  string | null
  image_alt?:  string | null
}

export async function insertRouteStop(payload: RouteStopCreatePayload): Promise<string> {
  const { data, error } = await supabase
    .from('travel_immerse_route_stops')
    .insert({
      trip_id:    payload.trip_id,
      sort_order: payload.sort_order,
      title:      payload.title      ?? null,
      stay_label: payload.stay_label ?? null,
      note:       payload.note       ?? null,
      image_src:  payload.image_src  ?? null,
      image_alt:  payload.image_alt  ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRouteStop(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_route_stops')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Reorder (drag-and-drop) ───────────────────────────────────────────────────

/**
 * Reassigns sort_order to 0..N-1 across the list of IDs in the new desired
 * order. Note 0-indexed — matches existing DB convention for this table.
 */
export async function reorderRouteStops(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('travel_immerse_route_stops')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
}

// ── Max sort_order (for new-stop defaults) ────────────────────────────────────

export async function fetchMaxRouteStopSortOrder(engagementId: string): Promise<number> {
  const { data, error } = await supabase
    .from('travel_immerse_route_stops')
    .select('sort_order')
    .eq('trip_id', engagementId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  // 0-indexed: first is 0, next default is 1
  return (data?.sort_order ?? -1) + 1
}