// immerseDestinationHotels.ts — Hotel selector + room overlay + galleries for /immerse/ subpages.
// Owns: getImmerseDestinationHotels — single canonical hotels fetcher.
//   Internal: fetchHotelsShape (flat-vs-regioned dispatch), fetchFlatHotels,
//   fetchRegionGroups, fetchRoomsForHotels, fetchAllGallery, fetchAllRoomGallery.
// Does not own: canonical hotel/room registry seeding (lives in DB
//   migrations), trip overview hotels (lives in immerseEngagementQueries).
//
// Flat-vs-regioned dispatch (Seed Reference v7 §1.5):
//   Query travel_immerse_destination_regions first to determine shape.
//   Flat destinations (NYC, St Barths, Bahamas, Miami, Paris) → trip_destination_hotels.
//   Regioned destinations (nordic-winter, europe-finale) → trip_region_hotels.
//
// Largest of the 4 split files — owns the carousel data shape feeding
// ImmerseHotelOptions + RoomCategory render.
//
// Last updated: S32K — Room name read path fixed. Canon room_name added to schema;
//   frontend now reads overlay.room_name_override ?? canon.room_name (line 293).
//   levelLabel field in ImmerseRoomOption now correctly carries room name, not tier.
//
// S32F — Split from immerseQueries.ts. No logic change. Single-
//   purpose file is the canonical home for hotel + room + gallery reads.
//   Caller passes destinationId (resolved by core fetcher) so this file does
//   not re-resolve from URL slug.

import { supabase } from './supabase'
import { rewriteImageUrl, rewriteImageUrls } from './imageUrl'
import type {
  ImmerseDestinationHotelsShape,
  ImmerseHotelOption,
  ImmerseRegionGroup,
  ImmerseRoomOption,
} from './immerseTypes'

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getImmerseDestinationHotels(
  engagementId:  string,
  destinationId: string,
): Promise<ImmerseDestinationHotelsShape> {
  return fetchHotelsShape(engagementId, destinationId)
}

// ─── Hotels shape resolver ────────────────────────────────────────────────────

async function fetchHotelsShape(
  engagementId: string,
  destId: string,
): Promise<ImmerseDestinationHotelsShape> {

  const { data: regions } = await supabase
    .from('travel_immerse_destination_regions')
    .select('id, slug, title, shorthand, hero_image_src, hero_image_alt, region_gallery')
    .eq('destination_id', destId)
    .eq('is_active', true)

  const isRegioned = (regions?.length ?? 0) > 0

  if (isRegioned) {
    const groups = await fetchRegionGroups(engagementId, regions ?? [])
    return { kind: 'regioned', regions: groups }
  }

  const hotels = await fetchFlatHotels(engagementId, destId)
  return { kind: 'flat', hotels }
}

// ─── Flat hotels ──────────────────────────────────────────────────────────────

async function fetchFlatHotels(
  engagementId: string,
  destId: string,
): Promise<ImmerseHotelOption[]> {
  if (!engagementId) return []

  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_hotels')
    .select(`
      id, hotel_id, rank, rank_label, bullets,
      stay_label, sort_order,
      travel_accom_hotels (
        id, slug, name, short_slug,
        hero_image_src, hero_image_alt, image_credit
      )
    `)
    .eq('trip_id', engagementId)
    .eq('destination_id', destId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  const canonicalHotelIds = data
    .map(r => {
      const h = r.travel_accom_hotels as unknown as { id: string } | null
      return h?.id
    })
    .filter((x): x is string => Boolean(x))

  const [roomsByHotel, galleryByHotel] = await Promise.all([
    fetchRoomsForHotels(engagementId, canonicalHotelIds),
    fetchAllGallery(canonicalHotelIds),
  ])

  return data.map(r => {
    const h = r.travel_accom_hotels as unknown as {
      id:              string
      slug:            string
      name:            string
      short_slug:      string
      hero_image_src:  string | null
      hero_image_alt:  string | null
      image_credit:    string | null
    } | null
    const hotelId   = h?.id ?? r.hotel_id
    const hotelSlug = h?.short_slug ?? h?.slug ?? ''
    const hotelName = h?.name ?? ''

    return {
      id:              hotelId,
      storageSlug:     hotelSlug,
      rank:            (r.rank as 'primary' | 'secondary') ?? 'primary',
      rankLabel:       r.rank_label     ?? '',
      name:            hotelName,
      bullets:         Array.isArray(r.bullets) ? (r.bullets as string[]) : [],
      imageSrc:        rewriteImageUrl(h?.hero_image_src),
      imageAlt:        h?.hero_image_alt ?? '',
      imageCredit:     h?.image_credit   ?? undefined,
      stayLabel:       r.stay_label     ?? '',
      rooms:           roomsByHotel[hotelId]   ?? [],
      gallery:         galleryByHotel[hotelId] ?? [],
    }
  })
}

// ─── Regioned hotels ──────────────────────────────────────────────────────────

type RegionRow = {
  id:              string
  slug:            string
  title:           string | null
  shorthand:       string | null
  hero_image_src:  string | null
  hero_image_alt:  string | null
  region_gallery:  string[] | null
}

async function fetchRegionGroups(
  engagementId:  string,
  regions:       RegionRow[],
): Promise<ImmerseRegionGroup[]> {
  if (!engagementId || regions.length === 0) return []

  const regionIds = regions.map(r => r.id)

  const [tripRegionsRes, regionHotelsRes] = await Promise.all([
    supabase
      .from('travel_immerse_trip_regions')
      .select('region_id, rank, rank_label, bullets, stay_label, sort_order')
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .in('region_id', regionIds),
    supabase
      .from('travel_immerse_trip_region_hotels')
      .select(`
        id, region_id, hotel_id, rank, rank_label, bullets,
        stay_label, sort_order,
        travel_accom_hotels (
          id, slug, name, short_slug,
          hero_image_src, hero_image_alt, image_credit
        )
      `)
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .in('region_id', regionIds)
      .order('sort_order', { ascending: true }),
  ])

  const tripRegionByRegionId = new Map<string, {
    rank:       'primary' | 'secondary'
    rankLabel:  string
    bullets:    string[]
    stayLabel:  string
    sortOrder:  number
  }>()
  for (const tr of (tripRegionsRes.data ?? [])) {
    tripRegionByRegionId.set(tr.region_id as string, {
      rank:      (tr.rank as 'primary' | 'secondary') ?? 'primary',
      rankLabel: tr.rank_label ?? '',
      bullets:   Array.isArray(tr.bullets) ? (tr.bullets as string[]) : [],
      stayLabel: tr.stay_label ?? '',
      sortOrder: (tr.sort_order as number) ?? 0,
    })
  }

  const hotelRows = regionHotelsRes.data ?? []

  const canonicalHotelIds = hotelRows
    .map(r => (r.travel_accom_hotels as unknown as { id: string } | null)?.id)
    .filter((x): x is string => Boolean(x))

  const [roomsByHotel, galleryByHotel] = await Promise.all([
    fetchRoomsForHotels(engagementId, canonicalHotelIds),
    fetchAllGallery(canonicalHotelIds),
  ])

  const hotelsByRegionId = new Map<string, ImmerseHotelOption[]>()
  for (const r of hotelRows) {
    const h = r.travel_accom_hotels as unknown as {
      id:              string
      slug:            string
      name:            string
      short_slug:      string
      hero_image_src:  string | null
      hero_image_alt:  string | null
      image_credit:    string | null
    } | null
    const hotelId   = h?.id ?? r.hotel_id
    const hotelSlug = h?.short_slug ?? h?.slug ?? ''
    const hotelName = h?.name ?? ''

    const option: ImmerseHotelOption = {
      id:              hotelId,
      storageSlug:     hotelSlug,
      rank:            (r.rank as 'primary' | 'secondary') ?? 'primary',
      rankLabel:       r.rank_label    ?? '',
      name:            hotelName,
      bullets:         Array.isArray(r.bullets) ? (r.bullets as string[]) : [],
      imageSrc:        rewriteImageUrl(h?.hero_image_src),
      imageAlt:        h?.hero_image_alt ?? '',
      imageCredit:     h?.image_credit   ?? undefined,
      stayLabel:       r.stay_label    ?? '',
      rooms:           roomsByHotel[hotelId]   ?? [],
      gallery:         galleryByHotel[hotelId] ?? [],
    }

    const bucket = hotelsByRegionId.get(r.region_id as string) ?? []
    bucket.push(option)
    hotelsByRegionId.set(r.region_id as string, bucket)
  }

  const groups: ImmerseRegionGroup[] = regions.map(region => {
    const tr = tripRegionByRegionId.get(region.id)
    const heroResolved = rewriteImageUrl(region.hero_image_src)
    return {
      regionId:      region.id,
      slug:          region.slug,
      title:         region.title ?? '',
      shorthand:     region.shorthand ?? undefined,
      rank:          tr?.rank      ?? 'primary',
      rankLabel:     tr?.rankLabel ?? '',
      bullets:       tr?.bullets   ?? [],
      stayLabel:     tr?.stayLabel ?? '',
      heroImageSrc:  heroResolved || undefined,
      heroImageAlt:  region.hero_image_alt ?? undefined,
      regionGallery: rewriteImageUrls(region.region_gallery),
      hotels:        hotelsByRegionId.get(region.id) ?? [],
    }
  })

  groups.sort((a, b) => {
    const sa = tripRegionByRegionId.get(a.regionId)?.sortOrder ?? 99
    const sb = tripRegionByRegionId.get(b.regionId)?.sortOrder ?? 99
    return sa - sb
  })

  return groups
}

// ─── Rooms (engagement-scoped overlay + canonical join) ──────────────────────

async function fetchRoomsForHotels(
  engagementId: string,
  hotelIds:     string[],
): Promise<Record<string, ImmerseRoomOption[]>> {
  if (hotelIds.length === 0) return {}

  const { data: canonRooms } = await supabase
    .from('travel_accom_rooms')
    .select(`
      id, hotel_id, slug, room_name, room_basis, room_benefits,
      room_image_src, room_image_alt, room_gallery,
      floorplan_src, sqft_min, sqft_max, sqm_min, sqm_max,
      rate_suffix,
      sort_order
    `)
    .in('hotel_id', hotelIds)
    .order('sort_order', { ascending: true })

  if (!canonRooms || canonRooms.length === 0) return {}

  const canonIds    = canonRooms.map(r => r.id as string)
  const canonById   = new Map<string, typeof canonRooms[number]>()
  for (const c of canonRooms) canonById.set(c.id as string, c)

  const { data: overlayRooms } = await supabase
    .from('travel_immerse_rooms')
    .select(`
      room_id, level_label, room_name_override, room_basis, room_benefits, room_inclusions,
      room_image_src, room_image_alt, hero_image_src_override,
      floorplan_src, floorplan_src_override,
      public_nightly_rate, non_negotiated_nightly_rate, ambience_nightly_rate,
      tax_inclusive,
      rate_suffix_override,
      sqft_min, sqft_max, sqm_min, sqm_max,
      sqft_min_override, sqft_max_override, sqm_min_override, sqm_max_override,
      sort_order
    `)
    .eq('trip_id', engagementId)
    .eq('is_active', true)
    .in('room_id', canonIds)
    .order('sort_order', { ascending: true })

  if (!overlayRooms || overlayRooms.length === 0) return {}

  const galleryByRoom = await fetchAllRoomGallery(canonIds)

  const grouped: Record<string, ImmerseRoomOption[]> = {}

  for (const o of overlayRooms) {
    const canon = canonById.get(o.room_id as string)
    if (!canon) continue

    const roomImageSrc = rewriteImageUrl(
      o.hero_image_src_override
        ?? canon.room_image_src
        ?? o.room_image_src
    )
    const roomImageAlt = canon.room_image_alt ?? o.room_image_alt ?? ''

    const sqftMin = o.sqft_min_override ?? canon.sqft_min ?? o.sqft_min ?? undefined
    const sqftMax = o.sqft_max_override ?? canon.sqft_max ?? o.sqft_max ?? undefined
    const sqmMin  = o.sqm_min_override  ?? canon.sqm_min  ?? o.sqm_min  ?? undefined
    const sqmMax  = o.sqm_max_override  ?? canon.sqm_max  ?? o.sqm_max  ?? undefined

    const floorplanResolved = rewriteImageUrl(
      o.floorplan_src_override
        ?? canon.floorplan_src
        ?? o.floorplan_src
    )
    const floorplanSrc = floorplanResolved || undefined

    const roomBenefits = Array.isArray(o.room_benefits) && (o.room_benefits as string[]).length > 0
      ? (o.room_benefits as string[])
      : (Array.isArray(canon.room_benefits) ? (canon.room_benefits as string[]) : [])

    const galleryCanonical = galleryByRoom[canon.id as string] ?? []
    const galleryJsonb     = rewriteImageUrls(canon.room_gallery as string[] | null)
    const roomGallery      = galleryCanonical.length > 0 ? galleryCanonical : galleryJsonb

    const rateSuffix = o.rate_suffix_override ?? canon.rate_suffix ?? undefined

    // Room name: overlay room_name_override takes precedence, fallback to canon room_name
    const roomName = o.room_name_override ?? canon.room_name ?? ''
    
    // Tier label: from overlay level_label (engagement-specific tier)
    const tierLabel = o.level_label ?? ''

    const hotelId = canon.hotel_id as string
    if (!grouped[hotelId]) grouped[hotelId] = []

    grouped[hotelId].push({
      tierLabel:                tierLabel,
      levelLabel:               roomName,
      roomBasis:                o.room_basis                   ?? canon.room_basis ?? '',
      roomBenefits:             roomBenefits,
      roomImageSrc:             roomImageSrc,
      roomImageAlt:             roomImageAlt,
      roomGallery:              roomGallery,
      floorplanSrc:             floorplanSrc,
      publicNightlyRate:        o.public_nightly_rate          ?? undefined,
      nonNegotiatedNightlyRate: o.non_negotiated_nightly_rate  ?? undefined,
      ambienceNightlyRate:      o.ambience_nightly_rate        ?? undefined,
      taxInclusive:             o.tax_inclusive                ?? false,
      rateSuffix:               rateSuffix,
      sqftMin, sqftMax, sqmMin, sqmMax,
    })
  }

  return grouped
}

// ─── Hotel gallery (canonical) ────────────────────────────────────────────────

async function fetchAllGallery(
  canonicalHotelIds: string[],
): Promise<Record<string, string[]>> {
  if (canonicalHotelIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('travel_accom_hotel_gallery')
    .select('accom_hotel_id, image_src')
    .in('accom_hotel_id', canonicalHotelIds)
    .order('sort_order', { ascending: true })

  if (error || !rows) return {}

  const grouped: Record<string, string[]> = {}
  for (const r of rows) {
    const key = r.accom_hotel_id as string
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(rewriteImageUrl(r.image_src as string))
  }
  return grouped
}

// ─── Room gallery (canonical) ─────────────────────────────────────────────────

async function fetchAllRoomGallery(
  canonicalRoomIds: string[],
): Promise<Record<string, string[]>> {
  if (canonicalRoomIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('travel_accom_room_gallery')
    .select('accom_room_id, image_src')
    .in('accom_room_id', canonicalRoomIds)
    .order('sort_order', { ascending: true })

  if (error || !rows) return {}

  const grouped: Record<string, string[]> = {}
  for (const r of rows) {
    const key = r.accom_room_id as string
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(rewriteImageUrl(r.image_src as string))
  }
  return grouped
}