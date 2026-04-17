// immerseQueries.ts — Supabase query functions for the /immerse/ proposal system
// Owns all DB reads for travel_immerse_destinations and child tables.
// Returns data shaped to match ImmerseDestinationData — component layer unchanged.
// Last updated: S17 — UUID-first queries + per-trip override resolution + room gallery
//   - fetchTripOverride queries travel_immerse_trip_destination_rows by destination_id (UUID)
//   - Resolution chain: trip_override → destination_template → fallback
//   - Hotel identity switched: id = real UUID, storageSlug = hotel_slug (for image paths)
//   - Per-room gallery fetched from travel_immerse_room_gallery, legacy array as fallback

import { supabase } from './supabase'
import type {
  ImmerseDestinationData,
  ImmerseHotelOption,
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

// ─── Per-trip override row ────────────────────────────────────────────────────
// When tripId is a url_id (not 'honeymoon'/'public'), fetch the matching
// travel_immerse_trip_destination_rows row. Non-null *_override fields overlay
// the destination template.
//
// S17 Phase 5A: queries by destination_slug (unchanged column post-migration-06).
// S18 Phase 5C will swap to destination_id UUID after migration 07 runs.

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
  tripId: string,
  destinationSlug: string,
): Promise<TripDestinationOverride | null> {
  // Public path has no per-trip override row.
  if (tripId === 'honeymoon' || tripId === 'public' || !tripId) return null

  // Resolve url_id → trip uuid
  const { data: trip } = await supabase
    .from('travel_immerse_trips')
    .select('id')
    .eq('url_id', tripId)
    .maybeSingle()

  if (!trip) return null

  // S17 Phase 5A: query by destination_slug (still present after migration 06).
  // S18 Phase 5C will migrate this to destination_id UUID after migration 07.
  const { data: row, error } = await supabase
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
    .eq('trip_id', trip.id)
    .eq('destination_slug', destinationSlug)
    .maybeSingle()

  if (error || !row) return null
  return row as TripDestinationOverride
}

// ─── getImmerseDestination ────────────────────────────────────────────────────
// Fetches a full destination subpage. Applies per-trip overrides where present.
// Returns null if destination not found.
//
// URL slug → destination UUID happens inside this function.

export async function getImmerseDestination(
  journeySlug:     string,
  destinationSlug: string,
): Promise<ImmerseDestinationData | null> {

  // Step 1 — resolve destination template (slug → full row including UUID)
  const { data: dest, error: destErr } = await supabase
    .from('travel_immerse_destinations')
    .select('*')
    .eq('destination_slug', destinationSlug)
    .single()

  if (destErr || !dest) return null

  const destId = dest.id as string

  // Step 2 — fetch override + child data in parallel
  // Override still queried by destination_slug until Phase 5C (migration 07) runs.
  const [
    overrideResult,
    hotelsResult,
    cardsResult,
    pricingResult,
  ] = await Promise.all([
    fetchTripOverride(journeySlug, destinationSlug),
    fetchHotels(destId),
    fetchContentCards(destId),
    fetchPricingRows(destId),
  ])

  const ov = overrideResult

  // Step 3 — assemble with override resolution
  return {
    destinationId:   destId,                         // S17: UUID primary
    destinationSlug: dest.destination_slug ?? '',    // S17: slug for URL building
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
    hotels:        hotelsResult,

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

// ─── Private fetchers ─────────────────────────────────────────────────────────

async function fetchHotels(destId: string): Promise<ImmerseHotelOption[]> {
  const { data: hotels, error } = await supabase
    .from('travel_immerse_hotels')
    .select('*')
    .eq('destination_id', destId)
    .order('sort_order', { ascending: true })

  if (error || !hotels) return []

  const hotelIds = hotels.map(h => h.id)

  const [roomsResult, galleryResult] = await Promise.all([
    fetchAllRooms(hotelIds),
    fetchAllGallery(hotelIds),
  ])

  return hotels.map(h => ({
    id:              h.id,               // S17: real UUID (was hotel_slug)
    storageSlug:     h.hotel_slug ?? '', // S17: retained for storage path construction
    rank:            h.rank as 'primary' | 'secondary',
    rankLabel:       h.rank_label        ?? '',
    name:            h.name              ?? '',
    bullets:         (h.bullets as string[]) ?? [],
    imageSrc:        h.image_src         ?? '',
    imageAlt:        h.image_alt         ?? '',
    imageCredit:     h.image_credit      ?? undefined,
    imageCreditUrl:  h.image_credit_url  ?? undefined,
    imageLicense:    h.image_license     ?? undefined,
    stayLabel:       h.stay_label        ?? '',
    rooms:           roomsResult[h.id]   ?? [],
    gallery:         galleryResult[h.id] ?? [],
  }))
}

async function fetchAllRooms(
  hotelIds: string[],
): Promise<Record<string, ImmerseRoomOption[]>> {
  if (hotelIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('travel_immerse_rooms')
    .select('*')
    .in('hotel_id', hotelIds)
    .order('sort_order', { ascending: true })

  if (error || !rows) return {}

  // S17: Fetch per-room gallery from new travel_immerse_room_gallery table.
  // Falls back to legacy room_gallery TEXT[] column if new table has no entries
  // for a room (supports gradual migration).
  const roomIds = rows.map(r => r.id)
  const galleryByRoom = await fetchAllRoomGallery(roomIds)

  const grouped: Record<string, ImmerseRoomOption[]> = {}

  for (const r of rows) {
    if (!grouped[r.hotel_id]) grouped[r.hotel_id] = []

    const newGallery    = galleryByRoom[r.id] ?? []
    // S17: room_gallery is jsonb in DB. Supabase returns parsed JSON — typically
    // an array of strings when populated. Defensive handling: only use if array.
    const legacyGallery = Array.isArray(r.room_gallery) ? (r.room_gallery as string[]) : []
    const resolvedGallery = newGallery.length > 0 ? newGallery : legacyGallery

    grouped[r.hotel_id].push({
      levelLabel:         r.level_label          ?? '',
      roomBasis:          r.room_basis            ?? '',
      roomBenefits:       (r.room_benefits as string[]) ?? [],
      roomImageSrc:       r.room_image_src        ?? '',
      roomImageAlt:       r.room_image_alt        ?? '',
      roomGallery:        resolvedGallery,
      floorplanSrc:       r.floorplan_src         ?? undefined,
      nightlyRate:        r.nightly_rate          ?? undefined,
      publicNightlyRate:  r.public_nightly_rate   ?? undefined,
      taxInclusive:       r.tax_inclusive         ?? false,
      sqftMin:            r.sqft_min              ?? undefined,
      sqftMax:            r.sqft_max              ?? undefined,
      sqmMin:             r.sqm_min               ?? undefined,
      sqmMax:             r.sqm_max               ?? undefined,
    })
  }

  return grouped
}

// S17: Per-room gallery fetch — matches fetchAllGallery pattern for hotels
async function fetchAllRoomGallery(
  roomIds: string[],
): Promise<Record<string, string[]>> {
  if (roomIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('travel_immerse_room_gallery')
    .select('room_id, image_src')
    .in('room_id', roomIds)
    .order('sort_order', { ascending: true })

  if (error || !rows) return {}

  const grouped: Record<string, string[]> = {}

  for (const r of rows) {
    if (!grouped[r.room_id]) grouped[r.room_id] = []
    grouped[r.room_id].push(r.image_src)
  }

  return grouped
}

async function fetchAllGallery(
  hotelIds: string[],
): Promise<Record<string, string[]>> {
  if (hotelIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('travel_immerse_hotel_gallery')
    .select('hotel_id, image_src')
    .in('hotel_id', hotelIds)
    .order('sort_order', { ascending: true })

  if (error || !rows) return {}

  const grouped: Record<string, string[]> = {}

  for (const r of rows) {
    if (!grouped[r.hotel_id]) grouped[r.hotel_id] = []
    grouped[r.hotel_id].push(r.image_src)
  }

  return grouped
}

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