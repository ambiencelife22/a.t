// queriesAdminRooms.ts - EF-routed reads/writes for the overlay-rooms editor
// on engagement detail, plus canonical room lookup for the picker. Backed by
// travel_overlay_rooms / travel_accom_rooms / travel_rate_cadences via the
// engagement admin EFs. Types in typesRooms.ts. Zero direct DB access.
// Last updated: S54 - EF-routed (frontend never touches DB).

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type {
  RateCadence, CanonicalRoom, OverlayRoom, OverlayRoomPatch, OverlayRoomCreate,
} from '../types/typesRooms'

async function invokeReadRoom<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', { body })
  if (error) throw new Error(`room read (${body.mode}): ${error.message}`)
  return data as T
}
async function invokeWriteRoom<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', { body })
  if (error) throw new Error(`room write (${body.mode}): ${error.message}`)
  return data as T
}

// ── Rate cadences ─────────────────────────────────────────────────────────────

export async function fetchRateCadences(): Promise<RateCadence[]> {
  const { rows } = await invokeReadRoom<{ rows: unknown[] }>({ mode: 'rate_cadences' })
  return camelizeKeys<RateCadence[]>(rows ?? [])
}

// ── Canonical rooms (for picker) ──────────────────────────────────────────────

export async function fetchCanonicalRoomsForEngagement(
  engagementId: string,
): Promise<CanonicalRoom[]> {
  const { rows } = await invokeReadRoom<{ rows: unknown[] }>({
    mode: 'canonical_rooms', engagement_id: engagementId,
  })
  return camelizeKeys<any[]>(rows ?? []).map((r) => ({
    id:                    r.id,
    hotelId:               r.hotelId,
    roomName:              r.roomName,
    slug:                  r.slug,
    categorySlug:          r.categorySlug,
    bedConfig:             r.bedConfig,
    beddingConfigurations: Array.isArray(r.beddingConfigurations) ? r.beddingConfigurations : null,
    sqftMin:               r.sqftMin,
    sqftMax:               r.sqftMax,
    sqmMin:                r.sqmMin,
    sqmMax:                r.sqmMax,
    roomImageSrc:          r.roomImageSrc,
    hotelName:             r.hotel?.name ?? null,
  })) as CanonicalRoom[]
}

// ── Overlay rooms ─────────────────────────────────────────────────────────────

export async function fetchOverlayRooms(engagementId: string): Promise<OverlayRoom[]> {
  const { rows } = await invokeReadRoom<{ rows: unknown[] }>({
    mode: 'overlay_rooms', engagement_id: engagementId,
  })
  return camelizeKeys<any[]>(rows ?? []).map((r) => ({
    ...r,
    roomBenefits:       Array.isArray(r.roomBenefits) ? r.roomBenefits : null,
    taxInclusive:       r.taxInclusive ?? false,
    beddingType:        r.beddingType ?? null,
    canonicalRoomName:  r.canonical?.roomName ?? null,
    canonicalHotelName: r.canonical?.hotel?.name ?? null,
  })) as OverlayRoom[]
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createOverlayRoom(payload: OverlayRoomCreate): Promise<string> {
  const { id } = await invokeWriteRoom<{ id: string }>({
    mode: 'overlay_room_create',
    engagement_id: payload.engagementId,
    room_id:       payload.roomId,
    level_label:   payload.levelLabel,
    sort_order:    payload.sortOrder,
    is_active:     payload.isActive,
  })
  return id
}

export async function updateOverlayRoom(id: string, patch: OverlayRoomPatch): Promise<void> {
  await invokeWriteRoom({ mode: 'overlay_room_update', id, patch })
}

export async function deleteOverlayRoom(id: string): Promise<void> {
  await invokeWriteRoom({ mode: 'overlay_room_delete', id })
}

// ── Max sort_order (for new-room defaults) ────────────────────────────────────

export async function fetchMaxRoomSortOrder(engagementId: string): Promise<number> {
  const { maxSortOrder } = await invokeReadRoom<{ maxSortOrder: number }>({
    mode: 'room_max_sort', engagement_id: engagementId,
  })
  return (maxSortOrder ?? -1) + 1
}
