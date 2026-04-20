// immerseQueries.ts — Supabase query functions for the /immerse/ proposal system
// Owns all DB reads for travel_immerse_destinations and child tables.
// Returns data shaped to match ImmerseDestinationData.
// Last updated: S22 — Gallery table reads now point at canonical names
//   (travel_accom_hotel_gallery, travel_accom_room_gallery). Tables were
//   renamed from travel_immerse_* — galleries are canonical hotel/room
//   facts, not trip-scoped presentation. No query shape changes.
// Prior: S21 — Full rewrite. Reads from canonical junctions instead of
//   legacy travel_immerse_hotels.
//     - fetchHotels(tripId, destId) joins travel_immerse_trip_destination_hotels
//       with canonical travel_accom_hotels.
//     - fetchRegionGroups(tripId, destId) joins travel_immerse_trip_regions
//       + travel_immerse_trip_region_hotels + canonical hotels.
//     - fetchRooms(tripId, hotelIds) pulls overlay rooms for that trip's hotels
//       via canonical room_id, then hydrates canonical travel_accom_rooms.
//     - fetchAllGallery uses accom_hotel_id; fetchAllRoomGallery uses accom_room_id.
//   Discriminated union ImmerseDestinationHotelsShape picks flat vs regioned
//   layout per destination. NYC/St-Barths → flat; Nordic Winter/Europe Finale
//   → regioned.

import { supabase } from './supabase'
import type {
  ImmerseDestinationData,
  ImmerseDestinationHotelsShape,
  ImmerseHotelOption,
  ImmerseRegionGroup,
  ImmerseRoomOption,
  ImmerseContentCard,
  ImmersePricingRow,
} from './immerseTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImmerseDestinationMeta {
  id:               string
  journeyId:        string
  destinationSlug:  string
  title:            string
  eyebrow:          string
}

// ─── Trip resolver ────────────────────────────────────────────────────────────
// S21: journeySlug may be a url_id (private trip), 'honeymoon' (legacy public
// route), or a public_journey_slug. Resolve to canonical trip.id for all
// downstream trip-scoped queries.

async function resolveTripId(journeySlug: string): Promise<string | null> {
  if (!journeySlug) return null

  // Public legacy route: '/immerse/honeymoon' — slug = 'honeymoon1' in DB
  if (journeySlug === 'honeymoon') {
    const { data } = await supabase
      .from('travel_immerse_trips')
      .select('id')
      .eq('slug', 'honeymoon1')
      .maybeSingle()
    return data?.id ?? null
  }

  // 11-char url_id → private trip
  if (/^[A-Za-z0-9]{11}$/.test(journeySlug)) {
    const { data } = await supabase
      .from('travel_immerse_trips')
      .select('id')
      .eq('url_id', journeySlug)
      .maybeSingle()
    return data?.id ?? null
  }

  // Otherwise: public_journey_slug (S21 forward path)
  const { data } = await supabase
    .from('travel_immerse_trips')
    .select('id')
    .eq('public_journey_slug', journeySlug)
    .maybeSingle()
  return data?.id ?? null
}

// ─── Per-trip destination override ────────────────────────────────────────────

type TripDestinationOverride = {
  hero_image_src_override:   string | null
  hero_image_alt_override:   string | null
  hero_image_src_2_override: string | null
  hero_image_alt_2_override: string | null
  hero_title_2_override:     string | null
  hero_subtitle_2_override:  string | null
  intro_title_override:      string | null
  intro_body_override:       string | null
  pricing_body_override:     string | null
}

async function fetchTripOverride(
  tripId: string | null,
  destinationSlug: string,
): Promise<TripDestinationOverride | null> {
  if (!tripId) return null

  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .select(`
      hero_image_src_override,
      hero_image_alt_override,
      hero_image_src_2_override,
      hero_image_alt_2_override,
      hero_title_2_override,
      hero_subtitle_2_override,
      intro_title_override,
      intro_body_override,
      pricing_body_override
    `)
    .eq('trip_id', tripId)
    .eq('destination_slug', destinationSlug)
    .maybeSingle()

  if (error || !data) return null
  return data as TripDestinationOverride
}

// ─── getImmerseDestination ────────────────────────────────────────────────────

export async function getImmerseDestination(
  journeySlug:     string,
  destinationSlug: string,
): Promise<ImmerseDestinationData | null> {

  // Step 1 — destination template (slug → full row including UUID)
  const { data: dest, error: destErr } = await supabase
    .from('travel_immerse_destinations')
    .select('*')
    .eq('destination_slug', destinationSlug)
    .single()

  if (destErr || !dest) return null

  const destId = dest.id as string

  // Step 2 — resolve trip id once, use everywhere downstream
  const tripId = await resolveTripId(journeySlug)

  // Step 3 — fetch override + hotels + content cards + pricing in parallel
  const [
    overrideResult,
    hotelsShape,
    cardsResult,
    pricingResult,
  ] = await Promise.all([
    fetchTripOverride(tripId, destinationSlug),
    fetchHotelsShape(tripId, destId),
    fetchContentCards(destId),
    fetchPricingRows(destId),
  ])

  const ov = overrideResult

  // Step 4 — assemble with override resolution
  return {
    destinationId:   destId,
    destinationSlug: dest.destination_slug ?? '',
    journeyId:       journeySlug,
    shorthand:       dest.shorthand ?? undefined,

    eyebrow:       dest.eyebrow                        ?? '',
    title:         dest.title                          ?? '',
    subtitle:      dest.subtitle                       ?? '',
    heroImageSrc:  ov?.hero_image_src_override         ?? dest.hero_image_src   ?? '',
    heroImageAlt:  ov?.hero_image_alt_override         ?? dest.hero_image_alt   ?? '',
    heroImageSrc2: ov?.hero_image_src_2_override       ?? dest.hero_image_src_2 ?? undefined,
    heroImageAlt2: ov?.hero_image_alt_2_override       ?? dest.hero_image_alt_2 ?? undefined,
    heroTitle2:    ov?.hero_title_2_override           ?? dest.hero_title_2     ?? undefined,
    heroSubtitle2: ov?.hero_subtitle_2_override        ?? dest.hero_subtitle_2  ?? undefined,
    heroPills:     (dest.hero_pills as string[])       ?? [],

    introEyebrow: dest.intro_eyebrow                  ?? '',
    introTitle:   ov?.intro_title_override            ?? dest.intro_title ?? '',
    introBody:    ov?.intro_body_override             ?? dest.intro_body  ?? '',

    hotelsEyebrow: dest.hotels_eyebrow ?? '',
    hotelsTitle:   dest.hotels_title   ?? '',
    hotelsBody:    dest.hotels_body    ?? '',
    hotels:        hotelsShape,

    diningEyebrow: dest.dining_eyebrow ?? '',
    diningTitle:   dest.dining_title   ?? '',
    diningBody:    dest.dining_body    ?? '',
    dining:        cardsResult.filter(c => c._cardType === 'dining').map(stripCardType),

    activitiesEyebrow: dest.activities_eyebrow ?? '',
    activitiesTitle:   dest.activities_title   ?? '',
    activitiesBody:    dest.activities_body    ?? '',
    activities:        cardsResult.filter(c => c._cardType === 'activity').map(stripCardType),

    pricingEyebrow:      dest.pricing_eyebrow       ?? '',
    pricingTitle:        dest.pricing_title         ?? '',
    pricingBody:         ov?.pricing_body_override  ?? dest.pricing_body ?? '',
    pricingRows:         pricingResult,
    pricingNotesHeading: dest.pricing_notes_heading ?? '',
    pricingNotesTitle:   dest.pricing_notes_title   ?? '',
    pricingNotes:        (dest.pricing_notes as string[]) ?? [],
  }
}

// ─── Hotels shape resolver ────────────────────────────────────────────────────
// Decides whether this destination renders as a flat hotel list or as regions.
// If travel_immerse_destination_regions has rows for this destination, we
// render regioned. Otherwise flat.

async function fetchHotelsShape(
  tripId: string | null,
  destId: string,
): Promise<ImmerseDestinationHotelsShape> {

  // Is this destination regioned? Check destination_regions for child rows.
  const { data: regions } = await supabase
    .from('travel_immerse_destination_regions')
    .select('id, slug, title, shorthand, hero_image_src, hero_image_alt')
    .eq('destination_id', destId)
    .eq('is_active', true)

  const isRegioned = (regions?.length ?? 0) > 0

  if (isRegioned) {
    const groups = await fetchRegionGroups(tripId, regions ?? [])
    return { kind: 'regioned', regions: groups }
  }

  const hotels = await fetchFlatHotels(tripId, destId)
  return { kind: 'flat', hotels }
}

// ─── Flat hotels (NYC, St-Barths, etc.) ───────────────────────────────────────
// Reads travel_immerse_trip_destination_hotels filtered by trip_id + destination.
// Joins canonical travel_accom_hotels for name/slug.

async function fetchFlatHotels(
  tripId: string | null,
  destId: string,
): Promise<ImmerseHotelOption[]> {
  if (!tripId) return []

  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_hotels')
    .select(`
      id, hotel_id, rank, rank_label, bullets,
      image_src, image_alt, image_credit, stay_label, sort_order,
      travel_accom_hotels ( id, slug, name, short_slug )
    `)
    .eq('trip_id', tripId)
    .eq('destination_id', destId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  // Build hotel list
  const canonicalHotelIds = data
    .map(r => {
      const h = r.travel_accom_hotels as unknown as { id: string } | null
      return h?.id
    })
    .filter((x): x is string => Boolean(x))

  const [roomsByHotel, galleryByHotel] = await Promise.all([
    fetchRoomsForHotels(tripId, canonicalHotelIds),
    fetchAllGallery(canonicalHotelIds),
  ])

  return data.map(r => {
    const h = r.travel_accom_hotels as unknown as { id: string; slug: string; name: string; short_slug: string } | null
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
      imageSrc:        r.image_src      ?? '',
      imageAlt:        r.image_alt      ?? '',
      imageCredit:     r.image_credit   ?? undefined,
      stayLabel:       r.stay_label     ?? '',
      rooms:           roomsByHotel[hotelId]   ?? [],
      gallery:         galleryByHotel[hotelId] ?? [],
    }
  })
}

// ─── Regioned hotels (Nordic Winter, Europe Finale) ───────────────────────────
// Reads travel_immerse_trip_regions for per-region positioning (rank, bullets,
// stay_label) then fetches travel_immerse_trip_region_hotels for each region's
// hotel picks. Joins canonical hotels + rooms.

type RegionRow = {
  id:              string
  slug:            string
  title:           string | null
  shorthand:       string | null
  hero_image_src:  string | null
  hero_image_alt:  string | null
}

async function fetchRegionGroups(
  tripId:  string | null,
  regions: RegionRow[],
): Promise<ImmerseRegionGroup[]> {
  if (!tripId || regions.length === 0) return []

  const regionIds = regions.map(r => r.id)

  // Trip-scoped region positioning + hotel picks (parallel)
  const [tripRegionsRes, regionHotelsRes] = await Promise.all([
    supabase
      .from('travel_immerse_trip_regions')
      .select('region_id, rank, rank_label, bullets, stay_label, sort_order')
      .eq('trip_id', tripId)
      .eq('is_active', true)
      .in('region_id', regionIds),
    supabase
      .from('travel_immerse_trip_region_hotels')
      .select(`
        id, region_id, hotel_id, rank, rank_label, bullets,
        image_src, image_alt, image_credit, stay_label, sort_order,
        travel_accom_hotels ( id, slug, name, short_slug )
      `)
      .eq('trip_id', tripId)
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

  // Hotels per region with canonical metadata
  const hotelRows = regionHotelsRes.data ?? []

  const canonicalHotelIds = hotelRows
    .map(r => (r.travel_accom_hotels as unknown as { id: string } | null)?.id)
    .filter((x): x is string => Boolean(x))

  const [roomsByHotel, galleryByHotel] = await Promise.all([
    fetchRoomsForHotels(tripId, canonicalHotelIds),
    fetchAllGallery(canonicalHotelIds),
  ])

  const hotelsByRegionId = new Map<string, ImmerseHotelOption[]>()
  for (const r of hotelRows) {
    const h = r.travel_accom_hotels as unknown as { id: string; slug: string; name: string; short_slug: string } | null
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
      imageSrc:        r.image_src     ?? '',
      imageAlt:        r.image_alt     ?? '',
      imageCredit:     r.image_credit  ?? undefined,
      stayLabel:       r.stay_label    ?? '',
      rooms:           roomsByHotel[hotelId]   ?? [],
      gallery:         galleryByHotel[hotelId] ?? [],
    }

    const bucket = hotelsByRegionId.get(r.region_id as string) ?? []
    bucket.push(option)
    hotelsByRegionId.set(r.region_id as string, bucket)
  }

  // Assemble groups, ordered by trip_regions.sort_order
  const groups: ImmerseRegionGroup[] = regions.map(region => {
    const tr = tripRegionByRegionId.get(region.id)
    return {
      regionId:      region.id,
      slug:          region.slug,
      title:         region.title ?? '',
      shorthand:     region.shorthand ?? undefined,
      rank:          tr?.rank      ?? 'primary',
      rankLabel:     tr?.rankLabel ?? '',
      bullets:       tr?.bullets   ?? [],
      stayLabel:     tr?.stayLabel ?? '',
      heroImageSrc:  region.hero_image_src ?? undefined,
      heroImageAlt:  region.hero_image_alt ?? undefined,
      hotels:        hotelsByRegionId.get(region.id) ?? [],
    }
  })

  // Sort by trip-scoped sort_order if present; fall back to destination_regions sort
  groups.sort((a, b) => {
    const sa = tripRegionByRegionId.get(a.regionId)?.sortOrder ?? 99
    const sb = tripRegionByRegionId.get(b.regionId)?.sortOrder ?? 99
    return sa - sb
  })

  return groups
}

// ─── Rooms (trip-scoped overlay + canonical join) ─────────────────────────────
// For each canonical hotel the trip cares about, find that trip's overlay rows
// in travel_immerse_rooms (keyed on trip_id + canonical room_id) and hydrate
// with canonical room data for pricing-free facts.

async function fetchRoomsForHotels(
  tripId:   string,
  hotelIds: string[],
): Promise<Record<string, ImmerseRoomOption[]>> {
  if (hotelIds.length === 0) return {}

  // Canonical rooms for these hotels — pricing-free facts
  const { data: canonRooms } = await supabase
    .from('travel_accom_rooms')
    .select(`
      id, hotel_id, slug, room_basis, room_benefits,
      room_image_src, room_image_alt, room_gallery,
      floorplan_src, sqft_min, sqft_max, sqm_min, sqm_max,
      sort_order
    `)
    .in('hotel_id', hotelIds)
    .order('sort_order', { ascending: true })

  if (!canonRooms || canonRooms.length === 0) return {}

  const canonIds    = canonRooms.map(r => r.id as string)
  const canonById   = new Map<string, typeof canonRooms[number]>()
  for (const c of canonRooms) canonById.set(c.id as string, c)

  // Trip-scoped overlay rows (pricing + level_label)
  const { data: overlayRooms } = await supabase
    .from('travel_immerse_rooms')
    .select(`
      room_id, level_label, room_basis, room_benefits, room_inclusions,
      room_image_src, room_image_alt, hero_image_src_override,
      floorplan_src, floorplan_src_override,
      nightly_rate, public_nightly_rate, tax_inclusive,
      sqft_min, sqft_max, sqm_min, sqm_max,
      sqft_min_override, sqft_max_override, sqm_min_override, sqm_max_override,
      sort_order
    `)
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .in('room_id', canonIds)
    .order('sort_order', { ascending: true })

  if (!overlayRooms || overlayRooms.length === 0) return {}

  // Gallery lookup by canonical room_id (uses new accom_room_id FK column)
  const galleryByRoom = await fetchAllRoomGallery(canonIds)

  const grouped: Record<string, ImmerseRoomOption[]> = {}

  for (const o of overlayRooms) {
    const canon = canonById.get(o.room_id as string)
    if (!canon) continue

    // Override resolution: overlay override > canonical > overlay base
    const roomImageSrc = o.hero_image_src_override
      ?? canon.room_image_src
      ?? o.room_image_src
      ?? ''
    const roomImageAlt = canon.room_image_alt ?? o.room_image_alt ?? ''

    const sqftMin = o.sqft_min_override ?? canon.sqft_min ?? o.sqft_min ?? undefined
    const sqftMax = o.sqft_max_override ?? canon.sqft_max ?? o.sqft_max ?? undefined
    const sqmMin  = o.sqm_min_override  ?? canon.sqm_min  ?? o.sqm_min  ?? undefined
    const sqmMax  = o.sqm_max_override  ?? canon.sqm_max  ?? o.sqm_max  ?? undefined

    const floorplanSrc = o.floorplan_src_override
      ?? canon.floorplan_src
      ?? o.floorplan_src
      ?? undefined

    const roomBenefits = Array.isArray(o.room_benefits) && (o.room_benefits as string[]).length > 0
      ? (o.room_benefits as string[])
      : (Array.isArray(canon.room_benefits) ? (canon.room_benefits as string[]) : [])

    // Per-room gallery: prefer canonical-keyed gallery, fallback to canonical's jsonb column
    const galleryCanonical = galleryByRoom[canon.id as string] ?? []
    const galleryJsonb     = Array.isArray(canon.room_gallery) ? (canon.room_gallery as string[]) : []
    const roomGallery      = galleryCanonical.length > 0 ? galleryCanonical : galleryJsonb

    const hotelId = canon.hotel_id as string
    if (!grouped[hotelId]) grouped[hotelId] = []

    grouped[hotelId].push({
      levelLabel:         o.level_label         ?? '',
      roomBasis:          o.room_basis          ?? canon.room_basis ?? '',
      roomBenefits:       roomBenefits,
      roomImageSrc:       roomImageSrc,
      roomImageAlt:       roomImageAlt,
      roomGallery:        roomGallery,
      floorplanSrc:       floorplanSrc,
      nightlyRate:        o.nightly_rate        ?? undefined,
      publicNightlyRate:  o.public_nightly_rate ?? undefined,
      taxInclusive:       o.tax_inclusive       ?? false,
      sqftMin, sqftMax, sqmMin, sqmMax,
    })
  }

  return grouped
}

// ─── Hotel gallery (canonical) ────────────────────────────────────────────────
// S22: reads travel_accom_hotel_gallery (renamed from travel_immerse_hotel_gallery).

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
    grouped[key].push(r.image_src as string)
  }
  return grouped
}

// ─── Room gallery (canonical) ─────────────────────────────────────────────────
// S22: reads travel_accom_room_gallery (renamed from travel_immerse_room_gallery).

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
    grouped[key].push(r.image_src as string)
  }
  return grouped
}

// ─── Content cards + pricing (unchanged from pre-S21) ─────────────────────────

type ContentCardWithType = ImmerseContentCard & { _cardType: string }

async function fetchContentCards(destId: string): Promise<ContentCardWithType[]> {
  const { data: rows, error } = await supabase
    .from('travel_immerse_content_cards')
    .select('*')
    .eq('destination_id', destId)
    .order('card_type', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error || !rows) return []

  return rows.map(r => ({
    _cardType:       r.card_type,
    id:              r.id,
    kicker:          r.kicker          ?? '',
    name:            r.name            ?? '',
    tagline:         r.tagline         ?? '',
    body:            r.body            ?? '',
    bullets:         (r.bullets as string[] | null) ?? undefined,
    imageSrc:        r.image_src       ?? '',
    imageAlt:        r.image_alt       ?? '',
    imageCredit:     r.image_credit    ?? undefined,
    imageCreditUrl:  r.image_credit_url ?? undefined,
    imageLicense:    r.image_license   ?? undefined,
  }))
}

function stripCardType(c: ContentCardWithType): ImmerseContentCard {
  const { _cardType, ...card } = c
  return card
}

async function fetchPricingRows(destId: string): Promise<ImmersePricingRow[]> {
  const { data: rows, error } = await supabase
    .from('travel_immerse_destination_pricing_rows')
    .select('*')
    .eq('destination_id', destId)
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