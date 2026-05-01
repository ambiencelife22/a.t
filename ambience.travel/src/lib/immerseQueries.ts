// immerseQueries.ts — Supabase query functions for the /immerse/ proposal system
// Owns all DB reads for travel_immerse_destinations and child tables.
// Returns data shaped to match ImmerseDestinationData.
//
// Last updated: S32K — fetchRoomsForHotels updated for room name schema refactor.
//   Reads canon.room_name + overlay.room_name_override; emits tierLabel
//   (engagement-specific tier) + levelLabel (room name for display).
// Prior: S32F — Destination read split into 4 independently-callable
//   fetchers for progressive reveal:
//     · getImmerseDestinationCore     — destination row + override + gate
//     · getImmerseDestinationHotels   — fetchHotelsShape + rooms + galleries
//     · getImmerseDestinationCards    — selections + overrides → dining/exp
//     · getImmerseDestinationPricing  — destination_pricing_rows
//   getImmerseDestination retained as a thin parallel wrapper that calls
//   the 4 fetchers concurrently — back-compat for any caller still using
//   the bundled signature. DestinationPage now uses the 4 fetchers directly
//   so hero paints when core lands and below-fold sections shimmer in
//   independently. File split (immerseDestinationCore.ts / Hotels / Cards /
//   Pricing) deferred to S32G — same content, different organising
//   principle, lower risk to ship in two passes.
// Prior: S32E perf — Two changes:
//   (1) getImmerseDestination accepts engagementId directly as a parameter.
//       Caller (DestinationPage) already has it from the parent route's
//       engagement fetch. Eliminates the resolveEngagementId round-trip
//       that used to live in the middle of the destination waterfall.
//   (2) Module-scope slug→UUID cache for resolveGlobalDestinationId. First
//       call per slug hits DB; subsequent calls in the same session are
//       instant. Eliminates one round-trip on warm navigation between
//       destinations within the same session.
//   Net: destination subpage waterfall reduced by 1 round-trip on cold load,
//   2 on warm navigation.
// Prior: S32C — Phase D of cards refactor. fetchContentCards now reads
//   via UNION of two queries on travel_immerse_trip_content_card_selections,
//   joined to canonical travel_dining_venues + travel_experiences. Filter is
//   the canonical row's global_destination_id (FK truth). Override merge keys
//   on the new dual FK (dining_venue_id / experience_id), surviving the
//   phase E drop of card_id + travel_immerse_content_cards.
// Prior: S32C — Phase 3 of destination FK refactor. All destination reads
//   flow through global_destination_id FK, with URL slug resolved to FK once
//   at the top of getImmerseDestination via global_destinations lookup.
// Prior: S32B — fetchContentCards reads via trip_content_card_selections
//   inner-join (engagement-scoped pool). getImmerseDestination enforces
//   itinerary membership: returns null if no trip_destination_rows row
//   exists for (engagement, destination). Anonymous reads also return null.
// Prior: S30F — Added rate_suffix to fetchRoomsForHotels.
// Prior: S30E — Engagement abstraction. resolveTripId → resolveEngagementId.
// Prior: S30D — Storage URL rewriting at the read layer.
// Prior: S30 — fetchContentCards merges per-engagement card overrides.

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

// S32F — Result shape for getImmerseDestinationCore. Carries everything
// needed to paint the hero + intro + section headings, plus the IDs that
// the other 3 fetchers need so they don't re-resolve.
export interface ImmerseDestinationCore {
  // IDs — passed to subsequent fetchers
  destinationId:        string
  globalDestinationId:  string

  // Destination identity
  destinationSlug:      string
  journeyId:            string
  shorthand?:           string

  // Hero
  eyebrow:              string
  title:                string
  subtitle:             string
  heroImageSrc:         string
  heroImageAlt:         string
  heroImageSrc2?:       string
  heroImageAlt2?:       string
  heroTitle2?:          string
  heroSubtitle2?:       string
  heroPills:            string[]

  // Intro
  introEyebrow:         string
  introTitle:           string
  introBody:            string

  // Section eyebrows / titles / bodies (cheap fields from dest + override)
  hotelsEyebrow:        string
  hotelsTitle:          string
  hotelsBody:           string

  diningEyebrow:        string
  diningTitle:          string
  diningBody:           string

  experiencesEyebrow:   string
  experiencesTitle:     string
  experiencesBody:      string

  pricingEyebrow:       string
  pricingTitle:         string
  pricingBody:          string

  pricingCloser: {
    item:            string | null
    basis:           string | null
    stay:            string | null
    indicativeRange: string | null
  }
  pricingNotesHeading:  string
  pricingNotesTitle:    string
  pricingNotes:         string[]
}

// S32F — Cards fetcher returns dining + experiences pre-split, since they
// always render in two separate sections. Saves the consumer from filtering.
export interface ImmerseDestinationCards {
  dining:      ImmerseContentCard[]
  experiences: ImmerseContentCard[]
}

// ─── Global destination resolver (S32C, cache added S32E) ────────────────────
// URL slug → global_destinations.id. The single canonical lookup that
// converts a URL handle to FK truth. Every downstream query uses FK.

const globalDestinationIdCache = new Map<string, string>()

async function resolveGlobalDestinationId(slug: string): Promise<string | null> {
  if (!slug) return null

  const cached = globalDestinationIdCache.get(slug)
  if (cached) return cached

  const { data } = await supabase
    .from('global_destinations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const id = data?.id ?? null
  if (id) globalDestinationIdCache.set(slug, id)
  return id
}

// ─── Per-engagement destination override (S32C: FK-keyed) ────────────────────

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
  engagementId:        string,
  globalDestinationId: string,
): Promise<EngagementDestinationOverride | null> {

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
    .eq('global_destination_id', globalDestinationId)
    .maybeSingle()

  if (error || !data) return null
  return data as EngagementDestinationOverride
}

// ─── getImmerseDestinationCore (S32F) ────────────────────────────────────────
// Returns hero + intro + section headings + pricing closer/notes. Plus IDs
// (destinationId, globalDestinationId) for downstream fetchers. Carries the
// itinerary-membership gate — returns null if no override row, which means
// the destination is not on this engagement's itinerary.
//
// Round-trips: 1 (slug cache) + 1 (destination row) + 1 (override) = 3 cold,
// 2 warm. Hero paints once this resolves.

export async function getImmerseDestinationCore(
  engagementId: string,
  urlSlug:      string,
): Promise<ImmerseDestinationCore | null> {

  if (!engagementId) return null

  const globalDestinationId = await resolveGlobalDestinationId(urlSlug)
  if (!globalDestinationId) return null

  const [destResult, overrideResult] = await Promise.all([
    supabase
      .from('travel_immerse_destinations')
      .select('*')
      .eq('global_destination_id', globalDestinationId)
      .single(),
    fetchEngagementOverride(engagementId, globalDestinationId),
  ])

  if (destResult.error || !destResult.data) return null
  if (!overrideResult) return null   // S32B itinerary membership gate

  const dest = destResult.data
  const ov   = overrideResult
  const destId = dest.id as string

  const heroSrc2Resolved = rewriteImageUrl(ov?.hero_image_src_2_override ?? dest.hero_image_src_2)

  return {
    destinationId:       destId,
    globalDestinationId,
    destinationSlug:     urlSlug,
    journeyId:           engagementId,
    shorthand:           dest.shorthand ?? undefined,

    eyebrow:        dest.eyebrow                        ?? '',
    title:          dest.title                          ?? '',
    subtitle:       dest.subtitle                       ?? '',
    heroImageSrc:   rewriteImageUrl(ov?.hero_image_src_override ?? dest.hero_image_src),
    heroImageAlt:   ov?.hero_image_alt_override         ?? dest.hero_image_alt   ?? '',
    heroImageSrc2:  heroSrc2Resolved || undefined,
    heroImageAlt2:  ov?.hero_image_alt_2_override       ?? dest.hero_image_alt_2 ?? undefined,
    heroTitle2:     ov?.hero_title_2_override           ?? dest.hero_title_2     ?? undefined,
    heroSubtitle2:  ov?.hero_subtitle_2_override        ?? dest.hero_subtitle_2  ?? undefined,
    heroPills:      (dest.hero_pills as string[])       ?? [],

    introEyebrow:   dest.intro_eyebrow                  ?? '',
    introTitle:     ov?.intro_title_override            ?? dest.intro_title ?? '',
    introBody:      ov?.intro_body_override             ?? dest.intro_body  ?? '',

    hotelsEyebrow:  dest.hotels_eyebrow ?? '',
    hotelsTitle:    dest.hotels_title   ?? '',
    hotelsBody:     dest.hotels_body    ?? '',

    diningEyebrow:  ov?.dining_eyebrow_override        ?? dest.dining_eyebrow ?? '',
    diningTitle:    ov?.dining_title_override          ?? dest.dining_title   ?? '',
    diningBody:     ov?.dining_body_override           ?? dest.dining_body    ?? '',

    experiencesEyebrow: dest.experiences_eyebrow ?? '',
    experiencesTitle:   dest.experiences_title   ?? '',
    experiencesBody:    dest.experiences_body    ?? '',

    pricingEyebrow:     dest.pricing_eyebrow       ?? '',
    pricingTitle:       dest.pricing_title         ?? '',
    pricingBody:        ov?.pricing_body_override  ?? dest.pricing_body ?? '',

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

// ─── getImmerseDestinationHotels (S32F) ──────────────────────────────────────
// Returns hotels shape only. Caller passes destinationId from core result.

export async function getImmerseDestinationHotels(
  engagementId: string,
  destinationId: string,
): Promise<ImmerseDestinationHotelsShape> {
  return fetchHotelsShape(engagementId, destinationId)
}

// ─── getImmerseDestinationCards (S32F) ───────────────────────────────────────
// Returns dining + experiences pre-split. Caller passes globalDestinationId
// from core result.

export async function getImmerseDestinationCards(
  engagementId:        string,
  globalDestinationId: string,
): Promise<ImmerseDestinationCards> {
  const cards = await fetchContentCards(engagementId, globalDestinationId)
  return {
    dining:      cards.filter(c => c._cardType === 'dining').map(stripCardType),
    experiences: cards.filter(c => c._cardType === 'experience').map(stripCardType),
  }
}

// ─── getImmerseDestinationPricing (S32F) ─────────────────────────────────────
// Returns destination-level pricing rows only. Caller passes destinationId
// from core result.

export async function getImmerseDestinationPricing(
  destinationId: string,
): Promise<ImmersePricingRow[]> {
  return fetchPricingRows(destinationId)
}

// ─── getImmerseDestination — back-compat parallel wrapper (S32F) ─────────────
// Preserved for any caller still using the bundled signature. Calls the 4
// fetchers concurrently and reassembles into the original ImmerseDestinationData
// shape. Pure forwarder — no logic changes.

export async function getImmerseDestination(
  engagementId: string,
  urlSlug:      string,
): Promise<ImmerseDestinationData | null> {

  const core = await getImmerseDestinationCore(engagementId, urlSlug)
  if (!core) return null

  const [hotels, cards, pricingRows] = await Promise.all([
    getImmerseDestinationHotels(engagementId, core.destinationId),
    getImmerseDestinationCards(engagementId, core.globalDestinationId),
    getImmerseDestinationPricing(core.destinationId),
  ])

  return {
    destinationId:       core.destinationId,
    destinationSlug:     core.destinationSlug,
    journeyId:           core.journeyId,
    shorthand:           core.shorthand,

    eyebrow:             core.eyebrow,
    title:               core.title,
    subtitle:            core.subtitle,
    heroImageSrc:        core.heroImageSrc,
    heroImageAlt:        core.heroImageAlt,
    heroImageSrc2:       core.heroImageSrc2,
    heroImageAlt2:       core.heroImageAlt2,
    heroTitle2:          core.heroTitle2,
    heroSubtitle2:       core.heroSubtitle2,
    heroPills:           core.heroPills,

    introEyebrow:        core.introEyebrow,
    introTitle:          core.introTitle,
    introBody:           core.introBody,

    hotelsEyebrow:       core.hotelsEyebrow,
    hotelsTitle:         core.hotelsTitle,
    hotelsBody:          core.hotelsBody,
    hotels,

    diningEyebrow:       core.diningEyebrow,
    diningTitle:         core.diningTitle,
    diningBody:          core.diningBody,
    dining:              cards.dining,

    experiencesEyebrow:  core.experiencesEyebrow,
    experiencesTitle:    core.experiencesTitle,
    experiencesBody:     core.experiencesBody,
    experiences:         cards.experiences,

    pricingEyebrow:      core.pricingEyebrow,
    pricingTitle:        core.pricingTitle,
    pricingBody:         core.pricingBody,
    pricingRows,
    pricingCloser:       core.pricingCloser,
    pricingNotesHeading: core.pricingNotesHeading,
    pricingNotesTitle:   core.pricingNotesTitle,
    pricingNotes:        core.pricingNotes,
  }
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
// S32K: Reads canon.room_name + overlay.room_name_override for the new room
// name schema. Emits tierLabel (engagement-specific tier from level_label) and
// levelLabel (room name from overlay override → canon room_name). roomBasis
// retained for back-compat but now correctly represents meal plan basis.

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

    // S32K: room name read path — overlay override → canon room_name
    const roomName  = o.room_name_override ?? canon.room_name ?? ''
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

// ─── Content cards + pricing ──────────────────────────────────────────────────

type ContentCardWithType = ImmerseContentCard & { _cardType: 'dining' | 'experience' }

type CardOverrideRow = {
  dining_venue_id:           string | null
  experience_id:             string | null
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

type CanonicalCardRow = {
  id:                string
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
}

// S32C: Reads via UNION of two queries on travel_immerse_trip_content_card_selections,
// joined to canonical travel_dining_venues + travel_experiences. Filtered by the
// canonical row's global_destination_id (FK truth, not slug). Override merge keys
// on the new dual FK (dining_venue_id / experience_id) — survives phase E drop.
async function fetchContentCards(
  engagementId:        string,
  globalDestinationId: string,
): Promise<ContentCardWithType[]> {
  if (!engagementId) return []

  const [diningRes, expRes] = await Promise.all([
    supabase
      .from('travel_immerse_trip_content_card_selections')
      .select(`
        sort_order,
        dining_venue_id,
        travel_dining_venues!inner (
          id, global_destination_id,
          kicker, name, tagline, body,
          bullets_heading, bullets,
          image_src, image_alt, image_credit, image_credit_url, image_license
        )
      `)
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .not('dining_venue_id', 'is', null)
      .eq('travel_dining_venues.global_destination_id', globalDestinationId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('travel_immerse_trip_content_card_selections')
      .select(`
        sort_order,
        experience_id,
        travel_experiences!inner (
          id, global_destination_id,
          kicker, name, tagline, body,
          bullets_heading, bullets,
          image_src, image_alt, image_credit, image_credit_url, image_license
        )
      `)
      .eq('trip_id', engagementId)
      .eq('is_active', true)
      .not('experience_id', 'is', null)
      .eq('travel_experiences.global_destination_id', globalDestinationId)
      .order('sort_order', { ascending: true }),
  ])

  if (diningRes.error && expRes.error) return []

  type SelectionWithCanon = {
    sort_order: number
    cardType:   'dining' | 'experience'
    fkId:       string
    canon:      CanonicalCardRow
  }

  const selections: SelectionWithCanon[] = []

  for (const row of (diningRes.data ?? [])) {
    const canon = row.travel_dining_venues as unknown as CanonicalCardRow | null
    if (!canon || !row.dining_venue_id) continue
    selections.push({
      sort_order: row.sort_order as number,
      cardType:   'dining',
      fkId:       row.dining_venue_id as string,
      canon,
    })
  }
  for (const row of (expRes.data ?? [])) {
    const canon = row.travel_experiences as unknown as CanonicalCardRow | null
    if (!canon || !row.experience_id) continue
    selections.push({
      sort_order: row.sort_order as number,
      cardType:   'experience',
      fkId:       row.experience_id as string,
      canon,
    })
  }

  if (selections.length === 0) return []

  const diningIds = selections.filter(s => s.cardType === 'dining').map(s => s.fkId)
  const expIds    = selections.filter(s => s.cardType === 'experience').map(s => s.fkId)

  const overrideQueries = []
  if (diningIds.length > 0) {
    overrideQueries.push(
      supabase
        .from('travel_immerse_trip_content_card_overrides')
        .select(`
          dining_venue_id, experience_id,
          kicker_override, name_override, tagline_override, body_override,
          bullets_heading_override, bullets_override,
          image_src_override, image_alt_override,
          image_credit_override, image_credit_url_override, image_license_override
        `)
        .eq('trip_id', engagementId)
        .eq('is_active', true)
        .in('dining_venue_id', diningIds)
    )
  }
  if (expIds.length > 0) {
    overrideQueries.push(
      supabase
        .from('travel_immerse_trip_content_card_overrides')
        .select(`
          dining_venue_id, experience_id,
          kicker_override, name_override, tagline_override, body_override,
          bullets_heading_override, bullets_override,
          image_src_override, image_alt_override,
          image_credit_override, image_credit_url_override, image_license_override
        `)
        .eq('trip_id', engagementId)
        .eq('is_active', true)
        .in('experience_id', expIds)
    )
  }

  const overrideResults = await Promise.all(overrideQueries)

  const overrideByDiningId = new Map<string, CardOverrideRow>()
  const overrideByExpId    = new Map<string, CardOverrideRow>()
  for (const res of overrideResults) {
    for (const ov of (res.data ?? []) as CardOverrideRow[]) {
      if (ov.dining_venue_id) overrideByDiningId.set(ov.dining_venue_id, ov)
      if (ov.experience_id)   overrideByExpId.set(ov.experience_id, ov)
    }
  }

  selections.sort((a, b) => a.sort_order - b.sort_order)

  return selections.map(s => {
    const ov = s.cardType === 'dining'
      ? overrideByDiningId.get(s.fkId)
      : overrideByExpId.get(s.fkId)

    const r = s.canon

    const bulletsOverride = ov?.bullets_override
    const bulletsCanon    = Array.isArray(r.bullets) ? (r.bullets as string[]) : null
    const bullets         = Array.isArray(bulletsOverride)
      ? (bulletsOverride as string[])
      : bulletsCanon ?? undefined

    return {
      _cardType:       s.cardType,
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