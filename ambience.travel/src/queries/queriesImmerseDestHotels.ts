// immerseDestinationHotels.ts — Hotel selector + room overlay + galleries for /immerse/ subpages.
// Owns: getImmerseDestinationHotels — single canonical hotels fetcher.
//   Internal: fetchHotelsShape, fetchFlatHotels, fetchRegionGroups,
//   fetchRoomsForHotels, fetchAllGallery, fetchAllRoomGallery, fetchRoomConnections.
//
// Last updated: S53C — michelin_keys surfaced from canon travel_accom_hotels
//   onto ImmerseHotelOption.michelinKeys (flat + regioned paths). Rendered by
//   the hotel card via the shared RecognitionMark (kind="keys"), matching the
//   dining-guide accolade idiom. Keys live on the canon hotel, so they appear
//   on every proposal featuring that hotel automatically.
// Prior: S53C — rooms now carry: resolved rate cadence + tax treatment
//   labels (joined from travel_immerse_rate_cadences / travel_immerse_tax_treatments),
//   per-booking room_alert + room_alert_level, and connecting-room linkage
//   (roomId / connectedRoomId / connectingNote) resolved from the catalog
//   travel_accom_room_connections table. All additive; existing behaviour intact.
// Prior: S53B Closing+2 — fetchAllGallery now engagement-aware.
//   Pulls canon gallery rows + engagement-scoped overlay rows from
//   travel_immerse_trip_hotel_gallery_overrides in parallel. For each
//   (accom_hotel_id, sort_order) slot, an overlay image wins over the
//   canon image. Overlay table can be sparse — slots without an override
//   render canon as normal. No new table dependency at canon level;
//   no changes to existing canon seeds.
// Prior: S42 Add 3 — resort_map_src fetched from
//   travel_immerse_trip_destination_hotels and mapped to ImmerseHotelOption.resortMapSrc.

import { supabase } from '../lib/supabase'
import { rewriteImageUrl, rewriteImageUrls } from '../utils/utilsImageUrl'
import type {
  ImmerseDestinationHotelsShape,
  ImmerseHotelOption,
  ImmerseRegionGroup,
  ImmerseRoomOption,
} from '../types/typesImmerse'

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getImmerseDestinationHotels(
  engagementId:       string,
  destinationId:      string,
  destinationUrlSlug: string | null = null,
): Promise<ImmerseDestinationHotelsShape> {
  return fetchHotelsShape(engagementId, destinationId, destinationUrlSlug)
}

// ─── Hotels shape resolver ────────────────────────────────────────────────────

async function fetchHotelsShape(
  engagementId:       string,
  destId:             string,
  destinationUrlSlug: string | null,
): Promise<ImmerseDestinationHotelsShape> {

  const { data: regions } = await supabase
    .from('travel_immerse_destination_regions')
    .select('id, slug, title, shorthand, hero_image_src, hero_image_alt, region_gallery')
    .eq('destination_id', destId)
    .eq('is_active', true)

  const isRegioned = (regions?.length ?? 0) > 0

  if (isRegioned) {
    const groups = await fetchRegionGroups(engagementId, regions ?? [], destinationUrlSlug)
    return { kind: 'regioned', regions: groups }
  }

  const hotels = await fetchFlatHotels(engagementId, destId, destinationUrlSlug)
  return { kind: 'flat', hotels }
}

// ─── Flat hotels ──────────────────────────────────────────────────────────────

async function fetchFlatHotels(
  engagementId:       string,
  destId:             string,
  destinationUrlSlug: string | null,
): Promise<ImmerseHotelOption[]> {
  if (!engagementId) return []

  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_hotels')
    .select(`
      id, hotel_id, rank, rank_label, bullets,
      stay_label, sort_order, resort_map_src,
      travel_accom_hotels (
        id, name, short_slug,
        hero_image_src, hero_image_alt, image_credit,
        bullets, michelin_keys
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
    fetchRoomsForHotels(engagementId, canonicalHotelIds, destinationUrlSlug),
    fetchAllGallery(engagementId, canonicalHotelIds),
  ])

  return data.map(r => {
    const h = r.travel_accom_hotels as unknown as {
      id:             string
      name:           string
      short_slug:     string
      hero_image_src: string | null
      hero_image_alt: string | null
      image_credit:   string | null
      bullets:        string[] | null
      michelin_keys:  number | null
    } | null
    const hotelId         = h?.id ?? r.hotel_id
    const hotelSlug       = h?.short_slug ?? ''
    const hotelName       = h?.name ?? ''
    const overlayBullets  = r.bullets as string[] | null
    const canonBullets    = Array.isArray(h?.bullets) ? (h.bullets as string[]) : []
    const resolvedBullets = overlayBullets === null ? canonBullets : overlayBullets

    return {
      id:           hotelId,
      storageSlug:  hotelSlug,
      rank:         (r.rank as 'primary' | 'secondary') ?? 'primary',
      rankLabel:    r.rank_label  ?? '',
      name:         hotelName,
      bullets:      resolvedBullets,
      imageSrc:     rewriteImageUrl(h?.hero_image_src),
      imageAlt:     h?.hero_image_alt ?? '',
      imageCredit:  h?.image_credit   ?? undefined,
      stayLabel:    r.stay_label  ?? '',
      rooms:        roomsByHotel[hotelId]   ?? [],
      gallery:      galleryByHotel[hotelId] ?? [],
      resortMapSrc: (r.resort_map_src as string | null) ?? undefined,
      michelinKeys: h?.michelin_keys ?? undefined,
    }
  })
}

// ─── Regioned hotels ──────────────────────────────────────────────────────────

type RegionRow = {
  id:             string
  slug:           string
  title:          string | null
  shorthand:      string | null
  hero_image_src: string | null
  hero_image_alt: string | null
  region_gallery: string[] | null
}

async function fetchRegionGroups(
  engagementId:       string,
  regions:            RegionRow[],
  destinationUrlSlug: string | null,
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
          id, name, short_slug,
          hero_image_src, hero_image_alt, image_credit,
          bullets, michelin_keys
        )
      `)
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .in('region_id', regionIds)
      .order('sort_order', { ascending: true }),
  ])

  const tripRegionByRegionId = new Map<string, {
    rank:      'primary' | 'secondary'
    rankLabel: string
    bullets:   string[]
    stayLabel: string
    sortOrder: number
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
    fetchRoomsForHotels(engagementId, canonicalHotelIds, destinationUrlSlug),
    fetchAllGallery(engagementId, canonicalHotelIds),
  ])

  const hotelsByRegionId = new Map<string, ImmerseHotelOption[]>()
  for (const r of hotelRows) {
    const h = r.travel_accom_hotels as unknown as {
      id:             string
      name:           string
      short_slug:     string
      hero_image_src: string | null
      hero_image_alt: string | null
      image_credit:   string | null
      bullets:        string[] | null
      michelin_keys:  number | null
    } | null
    const hotelId         = h?.id ?? r.hotel_id
    const hotelSlug       = h?.short_slug ?? ''
    const hotelName       = h?.name ?? ''
    const overlayBullets  = r.bullets as string[] | null
    const canonBullets    = Array.isArray(h?.bullets) ? (h.bullets as string[]) : []
    const resolvedBullets = overlayBullets === null ? canonBullets : overlayBullets

    const option: ImmerseHotelOption = {
      id:          hotelId,
      storageSlug: hotelSlug,
      rank:        (r.rank as 'primary' | 'secondary') ?? 'primary',
      rankLabel:   r.rank_label  ?? '',
      name:        hotelName,
      bullets:     resolvedBullets,
      imageSrc:    rewriteImageUrl(h?.hero_image_src),
      imageAlt:    h?.hero_image_alt ?? '',
      imageCredit: h?.image_credit   ?? undefined,
      stayLabel:   r.stay_label  ?? '',
      rooms:       roomsByHotel[hotelId]   ?? [],
      gallery:     galleryByHotel[hotelId] ?? [],
      michelinKeys: h?.michelin_keys ?? undefined,
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
      heroImageSrc:  heroResolved ?? undefined,
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
  engagementId:       string,
  hotelIds:           string[],
  destinationUrlSlug: string | null = null,
): Promise<Record<string, ImmerseRoomOption[]>> {
  if (hotelIds.length === 0) return {}

  const { data: canonRooms } = await supabase
    .from('travel_accom_rooms')
    .select(`
      id, hotel_id, slug, room_name, room_benefits,
      room_image_src, room_image_alt, room_gallery,
      floorplan_src, sqft_min, sqft_max, sqm_min, sqm_max,
      rate_suffix,
      sort_order
    `)
    .in('hotel_id', hotelIds)
    .order('sort_order', { ascending: true })

  if (!canonRooms || canonRooms.length === 0) return {}

  const canonIds  = canonRooms.map(r => r.id as string)
  const canonById = new Map<string, typeof canonRooms[number]>()
  for (const c of canonRooms) canonById.set(c.id as string, c)

  let overlayQuery = supabase
    .from('travel_immerse_rooms')
    .select(`
      id,
      connected_overlay_id,
      room_id, level_label, room_name_override, room_basis, room_benefits, room_inclusions,
      hero_image_src_override,
      floorplan_src_override,
      public_nightly_rate, non_negotiated_nightly_rate, ambience_nightly_rate,
      tax_inclusive,
      rate_suffix_override,
      rate_cadence_id,
      travel_immerse_rate_cadences ( label ),
      tax_treatment_id,
      travel_immerse_tax_treatments ( label ),
      room_alert,
      room_alert_level,
      sqft_min, sqft_max, sqm_min, sqm_max,
      sqft_min_override, sqft_max_override, sqm_min_override, sqm_max_override,
      sort_order
    `)
    .eq('trip_id', engagementId)
    .eq('is_active', true)
    .in('room_id', canonIds)
    .order('sort_order', { ascending: true })

  if (destinationUrlSlug) {
    overlayQuery = overlayQuery.or(
      `destination_url_slug.eq.${destinationUrlSlug},destination_url_slug.is.null`
    )
  }

  const { data: overlayRooms } = await overlayQuery

  if (!overlayRooms || overlayRooms.length === 0) return {}

  const [galleryByRoom, connectionByRoom] = await Promise.all([
    fetchAllRoomGallery(canonIds),
    fetchRoomConnections(canonIds),   // S53C — connecting rooms (catalog-level)
  ])

  const grouped: Record<string, ImmerseRoomOption[]> = {}

  for (const o of overlayRooms) {
    const canon = canonById.get(o.room_id as string)
    if (!canon) continue

    const roomImageSrc = rewriteImageUrl(o.hero_image_src_override ?? canon.room_image_src)
    const roomImageAlt = canon.room_image_alt ?? ''

    const sqftMin = o.sqft_min_override ?? canon.sqft_min ?? o.sqft_min ?? undefined
    const sqftMax = o.sqft_max_override ?? canon.sqft_max ?? o.sqft_max ?? undefined
    const sqmMin  = o.sqm_min_override  ?? canon.sqm_min  ?? o.sqm_min  ?? undefined
    const sqmMax  = o.sqm_max_override  ?? canon.sqm_max  ?? o.sqm_max  ?? undefined

    const floorplanResolved = rewriteImageUrl(o.floorplan_src_override ?? canon.floorplan_src)
    const floorplanSrc = floorplanResolved ?? undefined

    const roomBenefits = Array.isArray(o.room_benefits) && (o.room_benefits as string[]).length > 0
      ? (o.room_benefits as string[])
      : (Array.isArray(canon.room_benefits) ? (canon.room_benefits as string[]) : [])

    const galleryCanonical = galleryByRoom[canon.id as string] ?? []
    const galleryJsonb     = rewriteImageUrls(canon.room_gallery as string[] | null)
    const roomGallery      = galleryCanonical.length > 0 ? galleryCanonical : galleryJsonb

    const rateSuffix  = o.rate_suffix_override ?? canon.rate_suffix ?? undefined
    const cadenceJoin = o.travel_immerse_rate_cadences as unknown as { label: string | null } | null
    const rateCadence = cadenceJoin?.label ?? undefined

    const taxJoin      = o.travel_immerse_tax_treatments as unknown as { label: string | null } | null
    const taxTreatment = taxJoin?.label ?? undefined

    const connection = connectionByRoom[canon.id as string]

    const roomName  = o.room_name_override ?? canon.room_name ?? ''
    const tierLabel = o.level_label ?? ''

    const hotelId = canon.hotel_id as string
    if (!grouped[hotelId]) grouped[hotelId] = []

    grouped[hotelId].push({
      tierLabel,
      levelLabel:               roomName,
      roomBasis:                o.room_basis                  ?? '',
      roomBenefits:             roomBenefits,
      roomImageSrc,
      roomImageAlt,
      roomGallery,
      floorplanSrc,
      publicNightlyRate:        o.public_nightly_rate         ?? undefined,
      nonNegotiatedNightlyRate: o.non_negotiated_nightly_rate ?? undefined,
      ambienceNightlyRate:      o.ambience_nightly_rate       ?? undefined,
      taxInclusive:             o.tax_inclusive               ?? false,
      rateSuffix,
      rateCadence,
      taxTreatment,
      roomAlert:                o.room_alert       ?? undefined,
      roomAlertLevel:           o.room_alert_level ?? undefined,
      roomId:                   canon.id as string,
      overlayId:                o.id as string,
      connectedOverlayId:       (o.connected_overlay_id as string | null) ?? undefined,
      connectedRoomId:          connection?.partnerId,
      connectingNote:           o.connected_overlay_id ? connection?.note : undefined,
      sqftMin, sqftMax, sqmMin, sqmMax,
    })
  }

  return grouped
}

// ─── Hotel gallery (canon + engagement overlay) ───────────────────────────────
// S53B Closing+2 — Pulls canon gallery + engagement-scoped overlay rows
// from travel_immerse_trip_hotel_gallery_overrides in parallel. For each
// canon (accom_hotel_id, sort_order) slot, an overlay row at the same
// slot wins. Empty overlay table = canon-only rendering (zero overhead).

async function fetchAllGallery(
  engagementId:      string,
  canonicalHotelIds: string[],
): Promise<Record<string, string[]>> {
  if (canonicalHotelIds.length === 0) return {}

  const [canonRes, overlayRes] = await Promise.all([
    supabase
      .from('travel_accom_hotel_gallery')
      .select('accom_hotel_id, sort_order, image_src')
      .in('accom_hotel_id', canonicalHotelIds)
      .order('sort_order', { ascending: true }),
    supabase
      .from('travel_immerse_trip_hotel_gallery_overrides')
      .select('accom_hotel_id, sort_order, image_src')
      .eq('trip_id', engagementId)
      .in('accom_hotel_id', canonicalHotelIds),
  ])

  const canonRows   = canonRes.data   ?? []
  const overlayRows = overlayRes.data ?? []

  // Build (hotel_id, sort_order) -> overlay_image_src map
  const overlayBySlot = new Map<string, string>()
  for (const o of overlayRows) {
    const key = `${o.accom_hotel_id}::${o.sort_order}`
    overlayBySlot.set(key, o.image_src as string)
  }

  // Walk canon ordered, swap in overlay where present
  const grouped: Record<string, string[]> = {}
  for (const r of canonRows) {
    const hotelId = r.accom_hotel_id as string
    const slotKey = `${hotelId}::${r.sort_order}`
    const overlay = overlayBySlot.get(slotKey)
    const resolved = overlay ?? (r.image_src as string)

    if (!grouped[hotelId]) grouped[hotelId] = []
    grouped[hotelId].push(rewriteImageUrl(resolved))
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

// ─── Room connections (catalog: travel_accom_room_connections) ────────────────
// S53C — connecting rooms. A connection row links room_a_id <-> room_b_id at the
// CATALOG level (property truth that two rooms physically connect). Bidirectional:
// for each catalog room id we return its partner id + the connection note, so the
// renderer can pair connecting rooms (e.g. "Connecting suites, private entryway").
// Two simple .in() queries merged in JS (no .or() string interpolation).

async function fetchRoomConnections(
  canonicalRoomIds: string[],
): Promise<Record<string, { partnerId: string; note?: string }>> {
  if (canonicalRoomIds.length === 0) return {}

  const [aRes, bRes] = await Promise.all([
    supabase
      .from('travel_accom_room_connections')
      .select('room_a_id, room_b_id, notes')
      .in('room_a_id', canonicalRoomIds),
    supabase
      .from('travel_accom_room_connections')
      .select('room_a_id, room_b_id, notes')
      .in('room_b_id', canonicalRoomIds),
  ])

  const rows = [...(aRes.data ?? []), ...(bRes.data ?? [])]
  const map: Record<string, { partnerId: string; note?: string }> = {}

  for (const row of rows) {
    const a    = row.room_a_id as string
    const b    = row.room_b_id as string
    const note = (row.notes as string | null) ?? undefined
    // Bidirectional: each side points at the other.
    if (!map[a]) map[a] = { partnerId: b, note }
    if (!map[b]) map[b] = { partnerId: a, note }
  }

  return map
}