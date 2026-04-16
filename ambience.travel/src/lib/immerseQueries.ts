// immerseQueries.ts — Supabase query functions for the /immerse/ proposal system
// Owns all DB reads for immerse_journeys, immerse_destinations, and child tables.
// Returns data shaped to match ImmerseDestinationData exactly — zero component changes required.
// Does not own rendering, routing, or theme tokens.
// Last updated: S13

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

// ─── getImmerseDestination ────────────────────────────────────────────────────
// Fetches a full destination subpage by journey slug + destination slug.
// Returns null if not found.
// All child tables are fetched in parallel — one round-trip per child type.

export async function getImmerseDestination(
  journeySlug:     string,
  destinationSlug: string,
): Promise<ImmerseDestinationData | null> {

  // Step 1 — resolve journey id from slug
  const { data: journey, error: journeyErr } = await supabase
    .from('immerse_journeys')
    .select('id')
    .eq('journey_slug', journeySlug)
    .single()

  if (journeyErr || !journey) return null

  // Step 2 — resolve destination row
  const { data: dest, error: destErr } = await supabase
    .from('immerse_destinations')
    .select('*')
    .eq('journey_id', journey.id)
    .eq('destination_slug', destinationSlug)
    .single()

  if (destErr || !dest) return null

  const destId = dest.id

  // Step 3 — fetch all child data in parallel
  const [
    hotelsResult,
    cardsResult,
    pricingResult,
  ] = await Promise.all([
    fetchHotels(destId),
    fetchContentCards(destId),
    fetchPricingRows(destId),
  ])

  // Step 4 — assemble into ImmerseDestinationData shape
  return {
    destinationId: dest.destination_slug,
    journeyId:     journeySlug,
    shorthand:     dest.shorthand ?? undefined,

    eyebrow:      dest.eyebrow      ?? '',
    title:        dest.title        ?? '',
    subtitle:     dest.subtitle     ?? '',
    heroImageSrc: dest.hero_image_src ?? '',
    heroImageAlt: dest.hero_image_alt ?? '',
    heroPills:    (dest.hero_pills as string[]) ?? [],

    introEyebrow: dest.intro_eyebrow ?? '',
    introTitle:   dest.intro_title   ?? '',
    introBody:    dest.intro_body    ?? '',

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
    pricingBody:         dest.pricing_body          ?? '',
    pricingRows:         pricingResult,
    pricingNotesHeading: dest.pricing_notes_heading ?? '',
    pricingNotesTitle:   dest.pricing_notes_title   ?? '',
    pricingNotes:        (dest.pricing_notes as string[]) ?? [],
  }
}

// ─── Private fetchers ─────────────────────────────────────────────────────────

async function fetchHotels(destId: string): Promise<ImmerseHotelOption[]> {
  const { data: hotels, error } = await supabase
    .from('immerse_hotels')
    .select('*')
    .eq('destination_id', destId)
    .order('sort_order', { ascending: true })

  if (error || !hotels) return []

  // Fetch rooms and gallery for all hotels in parallel
  const hotelIds = hotels.map(h => h.id)

  const [roomsResult, galleryResult] = await Promise.all([
    fetchAllRooms(hotelIds),
    fetchAllGallery(hotelIds),
  ])

  return hotels.map(h => ({
    id:              h.hotel_slug,
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
    .from('immerse_rooms')
    .select('*')
    .in('hotel_id', hotelIds)
    .order('sort_order', { ascending: true })

  if (error || !rows) return {}

  const grouped: Record<string, ImmerseRoomOption[]> = {}

  for (const r of rows) {
    if (!grouped[r.hotel_id]) grouped[r.hotel_id] = []
    grouped[r.hotel_id].push({
      levelLabel:         r.level_label          ?? '',
      roomBasis:          r.room_basis            ?? '',
      roomBenefits:       (r.room_benefits as string[]) ?? [],
      roomImageSrc:       r.room_image_src        ?? '',
      roomImageAlt:       r.room_image_alt        ?? '',
      nightlyRate:        r.nightly_rate          ?? undefined,
      publicNightlyRate:  r.public_nightly_rate   ?? undefined,
      sqft:               r.sqft                  ?? undefined,
      sqm:                r.sqm                   ?? undefined,
    })
  }

  return grouped
}

async function fetchAllGallery(
  hotelIds: string[],
): Promise<Record<string, string[]>> {
  if (hotelIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('immerse_hotel_gallery')
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

// Internal type — card_type carried through filtering, stripped before return
type ContentCardWithType = ImmerseContentCard & { _cardType: string }

async function fetchContentCards(destId: string): Promise<ContentCardWithType[]> {
  const { data: rows, error } = await supabase
    .from('immerse_content_cards')
    .select('*')
    .eq('destination_id', destId)
    .order('card_type', { ascending: true })   // dining before activity
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
    .from('immerse_destination_pricing_rows')
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