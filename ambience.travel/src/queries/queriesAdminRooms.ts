// adminRoomsQueries.ts — Read + write paths for travel_immerse_rooms overlay editor.
//
// Owns:
//   - Fetching overlay rooms for an engagement (travel_immerse_rooms)
//   - Fetching canonical rooms for a hotel (travel_accom_rooms)
//   - Fetching rate cadences (travel_rate_cadences)
//   - CRUD on travel_immerse_rooms
//
// travel_immerse_rooms.engagement_id FKs to travel_immerse_engagements.id.
// room_id FKs to travel_accom_rooms.id.
// rate_cadence_id FKs to travel_rate_cadences.id.
//
// Column shape verified S42 (16 May 2026).

import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateCadence {
  id:         string
  slug:       string
  label:      string
  sort_order: number
}

export interface CanonicalRoom {
  id:          string
  hotel_id:    string
  room_name:   string | null
  slug:        string | null
  category_slug: string | null
  bed_config:              string | null   // @deprecated — superseded by bedding_configurations (jsonb) on travel_accom_rooms
  bedding_configurations:  string[] | null
  sqft_min:    number | null
  sqft_max:    number | null
  sqm_min:     number | null
  sqm_max:     number | null
  room_image_src: string | null
  // Hotel name resolved via join
  hotel_name:  string | null
}

export interface OverlayRoom {
  id:                      string
  engagement_id:                 string
  room_id:                 string | null
  level_label:             string | null
  room_basis:              string | null
  room_benefits:           string[] | null
  non_negotiated_nightly_rate: string | null
  ambience_nightly_rate:   string | null
  public_nightly_rate:     string | null
  rate_cadence_id:         string | null
  rate_suffix_override:    string | null
  tax_inclusive:           boolean
  room_inclusions:         string | null
  room_name_override:      string | null
  sqft_min:                number | null
  sqft_max:                number | null
  sqm_min:                 number | null
  sqm_max:                 number | null
  sqft_min_override:       number | null
  sqft_max_override:       number | null
  sqm_min_override:        number | null
  sqm_max_override:        number | null
  bed_config_override:     string | null  // @deprecated — superseded by bedding_type (text) on travel_immerse_rooms
  bedding_type:            string | null
  hero_image_src_override: string | null
  hero_image_alt_override: string | null
  floorplan_src_override:  string | null
  is_active:               boolean | null
  sort_order:              number
  // Resolved from canonical join
  canonical_room_name:     string | null
  canonical_hotel_name:    string | null
}

export type OverlayRoomPatch = Partial<Omit<OverlayRoom,
  'id' | 'engagement_id' | 'canonical_room_name' | 'canonical_hotel_name'
>>

export type OverlayRoomCreate = {
  engagement_id:      string
  room_id:      string | null
  level_label:  string | null
  sort_order:   number
  is_active:    boolean
}

// ── Rate cadences ─────────────────────────────────────────────────────────────

export async function fetchRateCadences(): Promise<RateCadence[]> {
  const { data, error } = await supabase
    .from('travel_rate_cadences')
    .select('id, slug, label, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`Failed to fetch rate cadences: ${error.message}`)
  return (data ?? []) as RateCadence[]
}

// ── Canonical rooms (for picker) ──────────────────────────────────────────────

export async function fetchCanonicalRoomsForEngagement(
  engagementId: string,
): Promise<CanonicalRoom[]> {
  // Derive which hotels are featured in this engagement via trip_destination_hotels
  const { data: hotelSlots, error: hotelErr } = await supabase
    .from('travel_immerse_engagement_destination_hotels')
    .select('hotel_id')
    .eq('engagement_id', engagementId)

  if (hotelErr) throw new Error(`Failed to fetch hotel slots: ${hotelErr.message}`)

  const hotelIds = [...new Set((hotelSlots ?? []).map((r: any) => r.hotel_id as string).filter(Boolean))]

  if (hotelIds.length === 0) {
    // No hotels on engagement — return empty
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

  return (data ?? []).map((r: any) => ({
    id:             r.id,
    hotel_id:       r.hotel_id,
    room_name:      r.room_name,
    slug:           r.slug,
    category_slug:  r.category_slug,
    bed_config:             r.bed_config,
    bedding_configurations: Array.isArray(r.bedding_configurations) ? r.bedding_configurations : null,
    sqft_min:       r.sqft_min,
    sqft_max:       r.sqft_max,
    sqm_min:        r.sqm_min,
    sqm_max:        r.sqm_max,
    room_image_src: r.room_image_src,
    hotel_name:     r.hotel?.name ?? null,
  })) as CanonicalRoom[]
}

// ── Overlay rooms ─────────────────────────────────────────────────────────────

export async function fetchOverlayRooms(engagementId: string): Promise<OverlayRoom[]> {
  const { data, error } = await supabase
    .from('travel_immerse_rooms')
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

  return (data ?? []).map((r: any) => ({
    id:                      r.id,
    engagement_id:                 r.engagement_id,
    room_id:                 r.room_id,
    level_label:             r.level_label,
    room_basis:              r.room_basis,
    room_benefits:           Array.isArray(r.room_benefits) ? r.room_benefits : null,
    non_negotiated_nightly_rate: r.non_negotiated_nightly_rate,
    ambience_nightly_rate:   r.ambience_nightly_rate,
    public_nightly_rate:     r.public_nightly_rate,
    rate_cadence_id:         r.rate_cadence_id,
    rate_suffix_override:    r.rate_suffix_override,
    tax_inclusive:           r.tax_inclusive ?? false,
    room_inclusions:         r.room_inclusions,
    room_name_override:      r.room_name_override,
    sqft_min:                r.sqft_min,
    sqft_max:                r.sqft_max,
    sqm_min:                 r.sqm_min,
    sqm_max:                 r.sqm_max,
    sqft_min_override:       r.sqft_min_override,
    sqft_max_override:       r.sqft_max_override,
    sqm_min_override:        r.sqm_min_override,
    sqm_max_override:        r.sqm_max_override,
    bed_config_override:     r.bed_config_override,
    bedding_type:            r.bedding_type ?? null,
    hero_image_src_override: r.hero_image_src_override,
    hero_image_alt_override: r.hero_image_alt_override,
    floorplan_src_override:  r.floorplan_src_override,
    is_active:               r.is_active,
    sort_order:              r.sort_order,
    canonical_room_name:     r.canonical?.room_name ?? null,
    canonical_hotel_name:    r.canonical?.hotel?.name ?? null,
  })) as OverlayRoom[]
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createOverlayRoom(payload: OverlayRoomCreate): Promise<string> {
  const { data, error } = await supabase
    .from('travel_immerse_rooms')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create overlay room: ${error.message}`)
  return (data as { id: string }).id
}

export async function updateOverlayRoom(id: string, patch: OverlayRoomPatch): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_rooms')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update overlay room: ${error.message}`)
}

export async function deleteOverlayRoom(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_rooms')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete overlay room: ${error.message}`)
}

export async function fetchMaxRoomSortOrder(engagementId: string): Promise<number> {
  const { data, error } = await supabase
    .from('travel_immerse_rooms')
    .select('sort_order')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch max sort order: ${error.message}`)
  return ((data as any)?.sort_order ?? 0) + 1
}