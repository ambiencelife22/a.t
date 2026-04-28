// immerseQueries.ts — Supabase query functions for the /immerse/ proposal system
// Owns all DB reads for travel_immerse_destinations and child tables.
// Returns data shaped to match ImmerseDestinationData.
//
// Last updated: S32B — Two changes.
//   (1) getImmerseDestination now enforces itinerary membership: if the
//       destination has no row in travel_immerse_trip_destination_rows for the
//       engagement, return null (component handles 404 redirect). Anonymous
//       reads (engagementId null) also return null — engagements are the only
//       legitimate destination-render context.
//   (2) fetchContentCards now reads via travel_immerse_trip_content_card_selections
//       (inner-join). Card pool is engagement-scoped, not destination-scoped.
//       Selection.sort_order wins over canonical sort_order. No engagement →
//       empty array.
// Prior: S30F — Added rate_suffix (canonical travel_accom_rooms) and
//   rate_suffix_override (overlay travel_immerse_rooms) to fetchRoomsForHotels.
//   Merged via standard ?? chain — override → canonical → undefined — into
//   ImmerseRoomOption.rateSuffix. Free-text per-room suffix that replaces the
//   hardcoded "+ Taxes & Fees" / "+ tax" strings in RoomCategory. NULL renders
//   nothing (no assumed-standard fallback per D direction).
// Prior: S30E perf — Removed legacy 'honeymoon' slug branch from
//   resolveEngagementId. The /immerse/honeymoon public-preview route was
//   deleted; only canonical 11-char url_id and the deprecated
//   public_journey_slug fallback remain. The deprecated branch will be
//   removed when public_journey_slug column drops.
// Prior: S30E stage 1 — Engagement abstraction. resolveTripId →
//   resolveEngagementId. Master table reads target
//   travel_immerse_engagements. TripDestinationOverride type →
//   EngagementDestinationOverride. Child table reads still .eq() on
//   trip_id — child tables retain "trip" prefix because their content is
//   journey-engagement-specific.

import { supabase } from './supabase'
import { rewriteImageUrl, rewriteImageUrls } from './imageUrl'
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

// ─── Engagement resolver ──────────────────────────────────────────────────────

async function resolveEngagementId(journeyToken: string): Promise<string | null> {
  if (!journeyToken) return null

  if (/^[A-Za-z0-9]{11}$/.test(journeyToken)) {
    const { data } = await supabase
      .from('travel_immerse_engagements')
      .select('id')
      .eq('url_id', journeyToken)
      .maybeSingle()
    return data?.id ?? null
  }

  const { data } = await supabase
    .from('travel_immerse_engagements')
    .select('id')
    .eq('public_journey_slug', journeyToken)
    .maybeSingle()
  return data?.id ?? null
}

// ─── Per-engagement destination override ──────────────────────────────────────

type EngagementDestinationOverride = {
  hero_image_src_override:                   string | null
  hero_image_alt_override:                   string | null
  hero_image_src_2_override:                 string | null
  hero_image_alt_2_override:                 string | null
  hero_title_2_override:                     string | null
  hero_subtitle_2_override:                  string | null
  intro_title_override:                      string | null
  intro_body_override:                       string | null
  dining_eyebrow_override:                   string | null
  dining_title_override:                     string | null
  dining_body_override:                      string | null
  pricing_body_override:                     string | null
  pricing_notes_heading_override:            string | null
  pricing_notes_title_override:              string | null
  pricing_notes_override:                    string[] | null
  pricing_closer_item_override:              string | null
  pricing_closer_basis_override:             string | null
  pricing_closer_stay_override:              string | null
  pricing_closer_indicative_range_override:  string | null
}

async function fetchEngagementOverride(
  engagementId: string | null,
  destinationSlug: string,
): Promise<EngagementDestinationOverride | null> {
  if (!engagementId) return null

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
      dining_eyebrow_override,
      dining_title_override,
      dining_body_override,
      pricing_body_override,
      pricing_notes_heading_override,
      pricing_notes_title_override,
      pricing_notes_override,
      pricing_closer_item_override,
      pricing_closer_basis_override,
      pricing_closer_stay_override,
      pricing_closer_indicative_range_override
    `)
    .eq('trip_id', engagementId)
    .eq('destination_slug', destinationSlug)
    .maybeSingle()

  if (error || !data) return null
  return data as EngagementDestinationOverride
}

// ─── getImmerseDestination ────────────────────────────────────────────────────

export async function getImmerseDestination(
  journeyToken:    string,
  destinationSlug: string,
): Promise<ImmerseDestinationData | null> {

  const { data: dest, error: destErr } = await supabase
    .from('travel_immerse_destinations')
    .select('*')
    .eq('destination_slug', destinationSlug)
    .single()

  if (destErr || !dest) return null

  const destId = dest.id as string
  const engagementId = await resolveEngagementId(journeyToken)

  // S32B: itinerary membership gate. Without an engagement, no destination
  // render. Component handles null with a 404 redirect to overview.
  if (!engagementId) return null

  const [
    overrideResult,
    hotelsShape,
    cardsResult,
    pricingResult,
  ] = await Promise.all([
    fetchEngagementOverride(engagementId, destinationSlug),
    fetchHotelsShape(engagementId, destId),
    fetchContentCards(engagementId, destId),
    fetchPricingRows(destId),
  ])

  // S32B: itinerary membership gate. fetchEngagementOverride returns the
  // trip_destination_rows row for (engagementId, destinationSlug). Null means
  // the destination isn't on this engagement's itinerary — do not render.
  if (!overrideResult) return null

  const ov = overrideResult

  const heroSrc2Resolved  = rewriteImageUrl(ov?.hero_image_src_2_override ?? dest.hero_image_src_2)

  return {
    destinationId:   destId,
    destinationSlug: dest.destination_slug ?? '',
    journeyId:       journeyToken,
    shorthand:       dest.shorthand ?? undefined,

    eyebrow:       dest.eyebrow                        ?? '',
    title:         dest.title                          ?? '',
    subtitle:      dest.subtitle                       ?? '',
    heroImageSrc:  rewriteImageUrl(ov?.hero_image_src_override ?? dest.hero_image_src),
    heroImageAlt:  ov?.hero_image_alt_override         ?? dest.hero_image_alt   ?? '',
    heroImageSrc2: heroSrc2Resolved || undefined,
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

    diningEyebrow: ov?.dining_eyebrow_override        ?? dest.dining_eyebrow ?? '',
    diningTitle:   ov?.dining_title_override          ?? dest.dining_title   ?? '',
    diningBody:    ov?.dining_body_override           ?? dest.dining_body    ?? '',
    dining:        cardsResult.filter(c => c._cardType === 'dining').map(stripCardType),

    experiencesEyebrow: dest.experiences_eyebrow ?? '',
    experiencesTitle:   dest.experiences_title   ?? '',
    experiencesBody:    dest.experiences_body    ?? '',
    experiences:        cardsResult.filter(c => c._cardType === 'experience').map(stripCardType),

    pricingEyebrow:      dest.pricing_eyebrow       ?? '',
    pricingTitle:        dest.pricing_title         ?? '',
    pricingBody:         ov?.pricing_body_override  ?? dest.pricing_body ?? '',
    pricingRows:         pricingResult,
    pricingCloser: {
      item:            ov?.pricing_closer_item_override             ?? null,
      basis:           ov?.pricing_closer_basis_override            ?? null,
      stay:            ov?.pricing_closer_stay_override             ?? null,
      indicativeRange: ov?.pricing_closer_indicative_range_override ?? null,
    },
    pricingNotesHeading: ov?.pricing_notes_heading_override ?? dest.pricing_notes_heading ?? '',
    pricingNotesTitle:   ov?.pricing_notes_title_override   ?? dest.pricing_notes_title   ?? '',
    pricingNotes:        (ov?.pricing_notes_override as string[] | null)
                          ?? (dest.pricing_notes as string[] | null)
                          ?? [],
  }
}

// ─── Hotels shape resolver ────────────────────────────────────────────────────

async function fetchHotelsShape(
  engagementId: string | null,
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
  engagementId: string | null,
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
  engagementId:  string | null,
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
      id, hotel_id, slug, room_basis, room_benefits,
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
      room_id, level_label, room_basis, room_benefits, room_inclusions,
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

    const hotelId = canon.hotel_id as string
    if (!grouped[hotelId]) grouped[hotelId] = []

    grouped[hotelId].push({
      levelLabel:               o.level_label                  ?? '',
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

// ─── Content cards + pricing ──────────────────────────────────────────────────

type ContentCardWithType = ImmerseContentCard & { _cardType: string }

type CardOverrideRow = {
  card_id:                   string
  kicker_override:           string | null
  name_override:             string | null
  tagline_override:          string | null
  body_override:             string | null
  bullets_heading_override:  string | null
  bullets_override:          string[] | null
  image_src_override:        string | null
  image_alt_override:        string | null
  image_credit_override:     string | null
  image_credit_url_override: string | null
  image_license_override:    string | null
}

async function fetchContentCards(
  engagementId: string | null,
  destId:       string,
): Promise<ContentCardWithType[]> {
  // S32B: card pool is engagement-scoped via trip_content_card_selections.
  // No engagement → no selections → empty array.
  if (!engagementId) return []

  // Read selections joined to canonical cards. Selection.sort_order drives
  // render order — lets curation re-order canonical default.
  const { data: selRows, error } = await supabase
    .from('travel_immerse_trip_content_card_selections')
    .select(`
      sort_order,
      travel_immerse_content_cards!inner (
        id, destination_id, card_type,
        kicker, name, tagline, body,
        bullets_heading, bullets,
        image_src, image_alt, image_credit, image_credit_url, image_license,
        sort_order
      )
    `)
    .eq('trip_id', engagementId)
    .eq('is_active', true)
    .eq('travel_immerse_content_cards.destination_id', destId)
    .order('sort_order', { ascending: true })

  if (error || !selRows || selRows.length === 0) return []

  type CanonicalCardRow = {
    id:                string
    destination_id:    string
    card_type:         string
    kicker:            string | null
    name:              string | null
    tagline:           string | null
    body:              string | null
    bullets_heading:   string | null
    bullets:           unknown
    image_src:         string | null
    image_alt:         string | null
    image_credit:      string | null
    image_credit_url:  string | null
    image_license:     string | null
    sort_order:        number
  }

  const rows: CanonicalCardRow[] = selRows
    .map(s => s.travel_immerse_content_cards as unknown as CanonicalCardRow | null)
    .filter((c): c is CanonicalCardRow => c !== null)

  if (rows.length === 0) return []

  // Override merge — unchanged from pre-patch.
  const overridesByCardId = new Map<string, CardOverrideRow>()
  const cardIds = rows.map(r => r.id)
  const { data: ovRows } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .select(`
      card_id,
      kicker_override,
      name_override,
      tagline_override,
      body_override,
      bullets_heading_override,
      bullets_override,
      image_src_override,
      image_alt_override,
      image_credit_override,
      image_credit_url_override,
      image_license_override
    `)
    .eq('trip_id', engagementId)
    .eq('is_active', true)
    .in('card_id', cardIds)

  for (const ov of (ovRows ?? []) as CardOverrideRow[]) {
    overridesByCardId.set(ov.card_id, ov)
  }

  return rows.map(r => {
    const ov = overridesByCardId.get(r.id)

    const bulletsOverride = ov?.bullets_override
    const bulletsCanon    = Array.isArray(r.bullets) ? (r.bullets as string[]) : null
    const bullets         = Array.isArray(bulletsOverride)
      ? (bulletsOverride as string[])
      : bulletsCanon ?? undefined

    return {
      _cardType:       r.card_type,
      id:              r.id,
      kicker:          ov?.kicker_override            ?? r.kicker            ?? '',
      name:            ov?.name_override              ?? r.name              ?? '',
      tagline:         ov?.tagline_override           ?? r.tagline           ?? '',
      body:            ov?.body_override              ?? r.body              ?? '',
      bulletsHeading:  ov?.bullets_heading_override   ?? r.bullets_heading   ?? '',
      bullets:         bullets,
      imageSrc:        rewriteImageUrl(ov?.image_src_override ?? r.image_src),
      imageAlt:        ov?.image_alt_override         ?? r.image_alt         ?? '',
      imageCredit:     ov?.image_credit_override      ?? r.image_credit      ?? undefined,
      imageCreditUrl:  ov?.image_credit_url_override  ?? r.image_credit_url  ?? undefined,
      imageLicense:    ov?.image_license_override     ?? r.image_license     ?? undefined,
    }
  })
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