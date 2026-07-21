// queriesAdminDestinationRows.ts - EF-routed reads/writes for the destination
// rows editor on engagement detail.
// Owns: list / update / insert / delete / reorder rows on
//       travel_overlay_engagement_destination_rows (via engagement admin EFs).
//       Search canonical destinations for the add-destination picker.
// Types live in typesDestinationRows.ts. Zero direct DB access.
// Last updated: S54 - EF-routed (frontend never touches DB).

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type {
  DestinationRow, DestinationOption, AddDestinationPayload,
} from '../types/typesDestinationRows'

async function invokeReadDR<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', { body })
  if (error) throw new Error(`destination read (${body.mode}): ${error.message}`)
  return data as T
}
async function invokeWriteDR<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', { body })
  if (error) throw new Error(`destination write (${body.mode}): ${error.message}`)
  return data as T
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchDestinationRows(
  engagementId: string,
): Promise<DestinationRow[]> {
  const { rows } = await invokeReadDR<{ rows: unknown[] }>({
    mode: 'destination_rows', engagement_id: engagementId,
  })
  return camelizeKeys<any[]>(rows ?? []).map((r: any) => ({
    ...r,
    destinationSlug: r.globalDestination?.slug ?? null,
    destinationName: r.globalDestination?.name ?? null,
  })) as DestinationRow[]
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDestinationRow(
  id:      string,
  payload: Partial<DestinationRow>,
): Promise<void> {
  await invokeWriteDR({ mode: 'destination_row_update', id, patch: payload })
}

// ── Insert (add destination flow) ─────────────────────────────────────────────

export async function insertDestinationRow(
  payload: AddDestinationPayload,
): Promise<string> {
  const { id } = await invokeWriteDR<{ id: string }>({
    mode: 'destination_row_insert',
    engagement_id:         payload.engagementId,
    global_destination_id: payload.globalDestinationId,
    title:                 payload.title,
    sort_order:            payload.sortOrder,
    subpage_status:        payload.subpageStatus ?? 'preview',
  })
  return id
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDestinationRow(id: string): Promise<void> {
  await invokeWriteDR({ mode: 'destination_row_delete', id })
}

// ── Reorder (drag-and-drop sort_order) ────────────────────────────────────────

export async function reorderDestinationRows(
  orderedIds: string[],
): Promise<void> {
  await invokeWriteDR({ mode: 'destination_rows_reorder', ordered_ids: orderedIds })
}

// ── Add-destination picker ────────────────────────────────────────────────────

export async function searchDestinations(
  query: string,
): Promise<DestinationOption[]> {
  const { rows } = await invokeReadDR<{ rows: unknown[] }>({ mode: 'destination_search', query })
  return camelizeKeys<DestinationOption[]>(rows ?? [])
}

// ── Max sort_order (for add defaults) ─────────────────────────────────────────

export async function fetchMaxDestinationSortOrder(
  engagementId: string,
): Promise<number> {
  const { maxSortOrder } = await invokeReadDR<{ maxSortOrder: number }>({
    mode: 'destination_max_sort_order', engagement_id: engagementId,
  })
  return (maxSortOrder ?? 0) + 1
}
