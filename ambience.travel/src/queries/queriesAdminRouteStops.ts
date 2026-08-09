// queriesAdminRouteStops.ts - EF-routed reads/writes for the route-stops editor
// on engagement detail. Backed by travel_overlay_route_stops via the engagement
// admin EFs. Types in typesRouteStops.ts. Zero direct DB access.
// Note: sort_order is 0-indexed for this table.
// Last updated: S54 - EF-routed (frontend never touches DB).

import { supabase } from '../lib/supabase'
import type { RouteStop, RouteStopCreatePayload } from '../types/typesRouteStops'

async function invokeReadRS<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', { body })
  if (error) throw new Error(`route stop read (${body.mode}): ${error.message}`)
  return data as T
}
async function invokeWriteRS<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', { body })
  if (error) throw new Error(`route stop write (${body.mode}): ${error.message}`)
  return data as T
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchRouteStops(engagementId: string): Promise<RouteStop[]> {
  const { rows } = await invokeReadRS<{ rows: unknown[] }>({
    mode: 'route_stops', engagementId,
  })
  return (rows ?? []) as RouteStop[]
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateRouteStop(
  id:      string,
  payload: Partial<RouteStop>,
): Promise<void> {
  await invokeWriteRS({ mode: 'route_stop_update', id, patch: payload })
}

// ── Insert ────────────────────────────────────────────────────────────────────

export async function insertRouteStop(payload: RouteStopCreatePayload): Promise<string> {
  const { id } = await invokeWriteRS<{ id: string }>({
    mode: 'route_stop_insert',
    engagementId: payload.engagementId,
    sortOrder:    payload.sortOrder,
    title:        payload.title     ?? null,
    stayLabel:    payload.stayLabel ?? null,
    note:         payload.note      ?? null,
    imageSrc:     payload.imageSrc  ?? null,
    imageAlt:     payload.imageAlt  ?? null,
  })
  return id
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRouteStop(id: string): Promise<void> {
  await invokeWriteRS({ mode: 'route_stop_delete', id })
}

// ── Reorder (drag-and-drop, 0-indexed) ────────────────────────────────────────

export async function reorderRouteStops(orderedIds: string[]): Promise<void> {
  await invokeWriteRS({ mode: 'route_stops_reorder', orderedIds })
}

// ── Max sort_order (for new-stop defaults) ────────────────────────────────────

export async function fetchMaxRouteStopSortOrder(engagementId: string): Promise<number> {
  const { maxSortOrder } = await invokeReadRS<{ maxSortOrder: number }>({
    mode: 'route_stop_max_sort', engagementId,
  })
  return (maxSortOrder ?? -1) + 1
}
