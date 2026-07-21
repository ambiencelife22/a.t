// adminRoomsQueries.ts - Read + write paths for travel_overlay_rooms overlay editor.
//
// Owns:
//   - Fetching overlay rooms for an engagement (travel_overlay_rooms)
//   - Fetching canonical rooms for a hotel (travel_accom_rooms)
//   - Fetching rate cadences (travel_rate_cadences)
//   - CRUD on travel_overlay_rooms
//
// travel_overlay_rooms.engagementId FKs to travel_engagements.id.
// room_id FKs to travel_accom_rooms.id.
// rate_cadence_id FKs to travel_rate_cadences.id.
//
// Column shape verified S42 (16 May 2026).

import { supabase } from '../lib/supabase'
import { camelizeKeys, snakeizeKeys } from '@shared/camelize'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateCadence {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
}

export interface CanonicalRoom {
  id:          string
  hotelId:    string
  roomName:   string | null
  slug:        string | null
  categorySlug: string | null
  bedConfig:              string | null   // @deprecated - superseded by bedding_configurations (jsonb) on travel_accom_rooms
  beddingConfigurations:  string[] | null
  sqftMin:    number | null
  sqftMax:    number | null
  sqmMin:     number | null
  sqmMax:     number | null
  roomImageSrc: string | null
  // Hotel name resolved via join
  hotelName:  string | null
}

export interface OverlayRoom {
  id:                      string
  engagementId:                 string
  roomId:                 string | null
  levelLabel:             string | null
  roomBasis:              string | null
  roomBenefits:           string[] | null
  nonNegotiatedNightlyRate: string | null
  ambienceNightlyRate:   string | null
  publicNightlyRate:     string | null
  rateCadenceId:         string | null
  rateSuffixOverride:    string | null
  taxInclusive:           boolean
  roomInclusions:         string | null
  roomNameOverride:      string | null
  sqftMin:                number | null
  sqftMax:                number | null
  sqmMin:                 number | null
  sqmMax:                 number | null
  sqftMinOverride:       number | null
  sqftMaxOverride:       number | null
  sqmMinOverride:        number | null
  sqmMaxOverride:        number | null
  bedConfigOverride:     string | null  // @deprecated - superseded by bedding_type (text) on travel_overlay_rooms
  beddingType:            string | null
  heroImageSrcOverride: string | null
  heroImageAltOverride: string | null
  floorplanSrcOverride:  string | null
  isActive:               boolean | null
  sortOrder:              number
  // Resolved from canonical join
  canonicalRoomName:     string | null
  canonicalHotelName:    string | null
}

export type OverlayRoomPatch = Partial<Omit<OverlayRoom,
  'id' | 'engagementId' | 'canonicalRoomName' | 'canonicalHotelName'
>>

export type OverlayRoomCreate = {
  engagementId:      string
  room_id:      string | null
  levelLabel:  string | null
  sortOrder:   number
  isActive:    boolean
}

// ── Rate cadences ─────────────────────────────────────────────────────────────

export async function fetchRateCadences(): Promise<RateCadence[]> {
  const { data, error } = await supabase
    .from('travel_rate_cadences')
    .select('id, slug, label, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`Failed to fetch rate cadences: ${error.message}`)
  return camelizeKeys<RateCadence[]>(data ?? [])
}

// ── Canonical rooms (for picker) ──────────────────────────────────────────────

export async function fetchCanonicalRoomsForEngagement(
  engagementId: string,
): Promise<CanonicalRoom[]> {
  // Derive which hotels are featured in this engagement via trip_destination_hotels
  const { data: hotelSlots, error: hotelErr } = await supabase
    .from('travel_overlay_engagement_destination_hotels')
    .select('hotel_id')
    .eq('engagement_id', engagementId)

  if (hotelErr) throw new Error(`Failed to fetch hotel slots: ${hotelErr.message}`)

  const hotelIds = [...new Set((hotelSlots ?? []).map((r: any) => r.hotel_id as string).filter(Boolean))]

  if (hotelIds.length === 0) {
    // No hotels on engagement - return empty
    return []
  }

  const { data, error } = await supabase
    .from('travel_accom_rooms')
    .select(`
      id, hotel_id, room_name, slug, category_slug,
      bed_config, bedding_configurations, sqft_min, sqft_max, sqm_min, sqm_max,
      room_image_src,
      hotel:travel_accom_hotels!hotel_id(name)
    `)
    .in('hotel_id', hotelIds)
    .order('hotel_id', { ascending: true })
    .order('slug', { ascending: true })

  if (error) throw new Error(`Failed to fetch canonical rooms: ${error.message}`)

  return camelizeKeys<any[]>(data ?? []).map((r) => ({
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
  const { data, error } = await supabase
    .from('travel_overlay_rooms')
    .select(`
      id, engagement_id, room_id,
      level_label, room_basis, room_benefits,
      non_negotiated_nightly_rate, ambience_nightly_rate, public_nightly_rate,
      rate_cadence_id, rate_suffix_override, tax_inclusive,
      room_inclusions, room_name_override,
      sqft_min, sqft_max, sqm_min, sqm_max,
      sqft_min_override, sqft_max_override, sqm_min_override, sqm_max_override,
      bed_config_override, bedding_type,
      hero_image_src_override, hero_image_alt_override, floorplan_src_override,
      is_active, sort_order,
      canonical:travel_accom_rooms!room_id(
        room_name,
        hotel:travel_accom_hotels!hotel_id(name)
      )
    `)
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch overlay rooms: ${error.message}`)

  return camelizeKeys<any[]>(data ?? []).map((r) => ({
    ...r,
    roomBenefits:          Array.isArray(r.roomBenefits) ? r.roomBenefits : null,
    taxInclusive:          r.taxInclusive ?? false,
    beddingType:           r.beddingType ?? null,
    canonicalRoomName:     r.canonical?.roomName ?? null,
    canonicalHotelName:    r.canonical?.hotel?.name ?? null,
  })) as OverlayRoom[]
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createOverlayRoom(payload: OverlayRoomCreate): Promise<string> {
  const { data, error } = await supabase
    .from('travel_overlay_rooms')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create overlay room: ${error.message}`)
  return (data as { id: string }).id
}

export async function updateOverlayRoom(id: string, patch: OverlayRoomPatch): Promise<void> {
  const { error } = await supabase
    .from('travel_overlay_rooms')
    .update(snakeizeKeys<Record<string, unknown>>(patch))
    .eq('id', id)
  if (error) throw new Error(`Failed to update overlay room: ${error.message}`)
}

export async function deleteOverlayRoom(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_overlay_rooms')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete overlay room: ${error.message}`)
}

export async function fetchMaxRoomSortOrder(engagementId: string): Promise<number> {
  const { data, error } = await supabase
    .from('travel_overlay_rooms')
    .select('sort_order')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch max sort order: ${error.message}`)
  return ((data as any)?.sortOrder ?? 0) + 1
}