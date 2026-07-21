// adminGuidesQueries.ts - read + write paths for guides/library admin tabs
import { camelizeKeys } from '@shared/camelize'
//
// What it owns:
//   - Listing destinations with dining content (UUID-keyed)
//   - Listing all dining venues (UUID-keyed)
//   - CRUD on travel_dining_venues (canonical pool) - by UUID
//   - CRUD on travel_dining_guides (per-destination overlay) - by UUID
//   - CRUD on dining_guide_grants - by UUID
//   - JSON ingest with name+destination collision guard (slug removed S38)
//
// Last updated: S40D - Fixed fetchGrantsForDestination profile join shape.
//   dining_guide_grants.userId → global_profiles.id is many-to-one (child → parent).
//   PostgREST returns this as a single object, not an array. Prior code cast
//   profile as Array<{...}> and indexed r.profile[0] - always undefined, causing
//   all grantees to display as (unknown user) and grantedPersonIds dedup to fail.
// Prior: S40C - Added grant types + fetchGrantsForDestination,
//   fetchAllPeople, fetchProfileByPersonId, createGrant, deleteGrant.
//   global_profiles.personId → global_people join for display only.
//   Grant keys are always UUIDs - email/name are display-only.
// Prior: S39 - Added accuracy_date to AdminDiningGuide type and
//   fetchDiningGuides SELECT. NULL = disclaimer omitted on both surfaces.
// Prior: S39 - Dropped legacy michelin boolean. Added michelin_award,
//   michelin_stars, michelin_green_star, worlds_50_best.

import { supabase } from '../lib/supabase'
import { fetchPeople, fetchPeopleByIds, type GlobalPersonResolved } from './queriesGlobalPeople'

// S54c - global_people is read exclusively via queriesGlobalPeople (EF layer).
// GlobalPerson is the canonical resolved shape; no local person type, no direct read.
export type GlobalPerson = GlobalPersonResolved

// ── Types ────────────────────────────────────────────────────────────────────

export interface DestinationOption {
  id:   string
  slug: string
  name: string
}

export interface DestinationWithDiningCounts {
  id:          string
  venue_count: number
  hasOverlay: boolean
}

export type MichelinAward = 'star' | 'bib_gourmand'

export interface AdminDiningVenue {
  id:                    string
  globalDestinationId: string
  name:                  string
  cuisineSubcategory:   string | null
  kicker:                string | null
  tagline:               string | null
  body:                  string | null
  bulletsHeading:       string | null
  bullets:               string[] | null
  michelinAward:        MichelinAward | null
  michelinStars:        number | null
  michelinGreenStar:   boolean
  worlds50Best:        boolean
  address:               string | null
  mapsUrl:              string | null
  website:               string | null
  neighborhood:          string | null
  priceBand:            string | null
  publicPreviewRank:   number | null
  tags:                  string[] | null
  imageSrc:             string | null
  imageAlt:             string | null
  imageCredit:          string | null
  imageCreditUrl:      string | null
  imageLicense:         string | null
  image2Src:           string | null
  image2Alt:           string | null
  isActive:             boolean
  sortOrder:            number
}

export interface AdminDiningGuide {
  id:                      string
  global_destination_id:   string
  heroImageSrc:          string | null
  heroImageAlt:          string | null
  eyebrowOverride:        string | null
  headlineOverride:       string | null
  introOverride:          string | null
  isActive:               boolean
  accuracyDate:           string | null
  atAGlanceBullets:     string[] | null
  guideYear:              number | null
  guideVersion:           string | null
  planYourVisitHeading: string | null
  planYourVisitIntro:   string | null
  planYourVisitBullets: string[] | null
}

export interface AdminGrant {
  id:                    string
  userId:               string
  global_destination_id: string
  grantedAt:            string
  person:                GlobalPerson | null  // null = profile not linked to a person
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function fetchDestinationOptions(): Promise<DestinationOption[]> {
  const { data, error } = await supabase
    .from('global_destinations')
    .select('id, slug, name')
    .order('name', { ascending: true })

  if (error) throw new Error(`Failed to fetch destinations: ${error.message}`)
  return (data ?? []) as DestinationOption[]
}

export async function fetchDestinationsWithDining(): Promise<DestinationWithDiningCounts[]> {
  const [venuesRes, guidesRes] = await Promise.all([
    supabase
      .from('travel_dining_venues')
      .select('global_destination_id')
      .eq('is_active', true),
    supabase
      .from('travel_dining_guides')
      .select('global_destination_id'),
  ])

  if (venuesRes.error) throw new Error(`venues: ${venuesRes.error.message}`)
  if (guidesRes.error) throw new Error(`guides: ${guidesRes.error.message}`)

  const venueCountByDest = new Map<string, number>()
  for (const v of venuesRes.data ?? []) {
    const id = (v as { global_destination_id: string }).global_destination_id
    venueCountByDest.set(id, (venueCountByDest.get(id) ?? 0) + 1)
  }

  const overlaySet = new Set<string>(
    (guidesRes.data ?? []).map(g => (g as { global_destination_id: string }).global_destination_id)
  )

  const out: DestinationWithDiningCounts[] = []
  for (const [id, count] of venueCountByDest.entries()) {
    out.push({ id, venue_count: count, hasOverlay: overlaySet.has(id) })
  }
  return out
}

export async function fetchAllDiningVenues(
  destinationIdFilter?: string | null,
): Promise<AdminDiningVenue[]> {
  let q = supabase
    .from('travel_dining_venues')
    .select(`
      id, global_destination_id, name,
      cuisine_subcategory, kicker, tagline, body, bullets_heading, bullets,
      michelin_award, michelin_stars, michelin_green_star, worlds_50_best,
      address, maps_url, website,
      neighborhood, price_band, public_preview_rank, tags,
      image_src, image_alt, image_credit, image_credit_url, image_license,
      image_2_src, image_2_alt,
      is_active, sort_order
    `)
    .order('sort_order', { ascending: true })

  if (destinationIdFilter) {
    q = q.eq('global_destination_id', destinationIdFilter)
  }

  const { data, error } = await q
  if (error) throw new Error(`Failed to fetch venues: ${error.message}`)
  return camelizeKeys<AdminDiningVenue[]>(data ?? [])
}

export async function fetchDiningGuides(): Promise<AdminDiningGuide[]> {
  const { data, error } = await supabase
    .from('travel_dining_guides')
    .select(`
      id, global_destination_id,
      hero_image_src, hero_image_alt,
      eyebrow_override, headline_override, intro_override,
      is_active, accuracy_date, at_a_glance_bullets,
      guide_year, guide_version,
      plan_your_visit_heading, plan_your_visit_intro, plan_your_visit_bullets
    `)

  if (error) throw new Error(`Failed to fetch guides: ${error.message}`)
  return camelizeKeys<AdminDiningGuide[]>(data ?? [])
}

export async function fetchGrantsForDestination(
  globalDestinationId: string,
): Promise<AdminGrant[]> {
  const { data, error } = await supabase
    .from('travel_dining_guide_grants')
    .select(`
      id, user_id, global_destination_id, granted_at,
      profile:global_profiles!user_id (
        person_id
      )
    `)
    .eq('global_destination_id', globalDestinationId)
    .order('granted_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch grants: ${error.message}`)

  // dining_guide_grants.userId → global_profiles.id is many-to-one (child → parent).
  // PostgREST returns this join as a single object, not an array.
  // S51: display_name dropped from global_profiles spine - name resolves
  // exclusively via the profile → person link.
  const rows = (data ?? []) as unknown as Array<{
    id:                    string
    userId:               string
    global_destination_id: string
    grantedAt:            string
    profile: {
      personId: string | null
    } | null
  }>

  // Collect person_ids to batch-fetch from global_people
  const personIds = rows
    .map(r => r.profile?.personId)
    .filter((id): id is string => id != null)

  const peopleById = new Map<string, GlobalPerson>()
  if (personIds.length > 0) {
    const people = await fetchPeopleByIds(personIds)
    for (const p of people) peopleById.set(p.id, p)
  }

  return rows.map(r => ({
    id:                    r.id,
    userId:               r.userId,
    global_destination_id: r.global_destination_id,
    grantedAt:            r.grantedAt,
    person:                r.profile?.personId
      ? (peopleById.get(r.profile.personId) ?? null)
      : null,
  }))
}

// Given a global_people UUID, find the linked global_profiles row.
// S51: display_name dropped from global_profiles spine - only id is returned now.
export async function fetchProfileByPersonId(
  personId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('global_profiles')
    .select('id')
    .eq('person_id', personId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch profile: ${error.message}`)
  if (!data) return null
  return data as { id: string }
}

// ── Writes - venues (UUID-keyed) ─────────────────────────────────────────────

export type DiningVenuePatch = Partial<Omit<AdminDiningVenue, 'id'>>

export async function updateDiningVenue(id: string, patch: DiningVenuePatch): Promise<void> {
  const { error } = await supabase
    .from('travel_dining_venues')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update venue: ${error.message}`)
}

export async function deleteDiningVenue(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_dining_venues')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete venue: ${error.message}`)
}

// ── Writes - guides (UUID-keyed) ─────────────────────────────────────────────

export type DiningGuidePatch = Partial<Omit<AdminDiningGuide, 'id' | 'global_destination_id'>>

export async function updateDiningGuide(id: string, patch: DiningGuidePatch): Promise<void> {
  const { error } = await supabase
    .from('travel_dining_guides')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update guide: ${error.message}`)
}

export async function createDiningGuide(globalDestinationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('travel_dining_guides')
    .insert({
      global_destination_id: globalDestinationId,
      isActive: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create guide: ${error.message}`)
  return (data as { id: string }).id
}

export async function deleteDiningGuide(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_dining_guides')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete guide: ${error.message}`)
}

// ── Experiences guide types ──────────────────────────────────────────────────

export interface AdminExperienceVenue {
  id:                    string
  global_destination_id: string
  name:                  string
  kicker:                string | null
  tagline:               string | null
  body:                  string | null
  bulletsHeading:       string | null
  bullets:               string[] | null
  address:               string | null
  mapsUrl:              string | null
  imageSrc:             string | null
  imageAlt:             string | null
  imageCredit:          string | null
  imageCreditUrl:      string | null
  imageLicense:         string | null
  isActive:             boolean
  sortOrder:            number
}

export interface AdminExperiencesGuide {
  id:                      string
  global_destination_id:   string
  heroImageSrc:          string | null
  heroImageAlt:          string | null
  eyebrowOverride:        string | null
  headlineOverride:       string | null
  introOverride:          string | null
  isActive:               boolean
  accuracyDate:           string | null
  atAGlanceBullets:     string[] | null
  guideYear:              number | null
  guideVersion:           string | null
  planYourVisitHeading: string | null
  planYourVisitIntro:   string | null
  planYourVisitBullets: string[] | null
}

export interface AdminExperiencesGrant {
  id:                    string
  userId:               string
  global_destination_id: string
  grantedAt:            string
  person:                GlobalPerson | null
}

export interface DestinationWithExperiencesCounts {
  id:          string
  venue_count: number
  hasOverlay: boolean
}

// ── Experiences reads ────────────────────────────────────────────────────────

export async function fetchDestinationsWithExperiences(): Promise<DestinationWithExperiencesCounts[]> {
  const [venuesRes, guidesRes] = await Promise.all([
    supabase
      .from('travel_experiences')
      .select('global_destination_id')
      .eq('is_active', true),
    supabase
      .from('travel_experiences_guides')
      .select('global_destination_id'),
  ])

  if (venuesRes.error) throw new Error(`venues: ${venuesRes.error.message}`)
  if (guidesRes.error) throw new Error(`guides: ${guidesRes.error.message}`)

  const venueCountByDest = new Map<string, number>()
  for (const v of venuesRes.data ?? []) {
    const id = (v as { global_destination_id: string }).global_destination_id
    venueCountByDest.set(id, (venueCountByDest.get(id) ?? 0) + 1)
  }

  const overlaySet = new Set<string>(
    (guidesRes.data ?? []).map(g => (g as { global_destination_id: string }).global_destination_id)
  )

  const out: DestinationWithExperiencesCounts[] = []
  for (const [id, count] of venueCountByDest.entries()) {
    out.push({ id, venue_count: count, hasOverlay: overlaySet.has(id) })
  }
  return out
}

export async function fetchExperiencesGuides(): Promise<AdminExperiencesGuide[]> {
  const { data, error } = await supabase
    .from('travel_experiences_guides')
    .select(`
      id, global_destination_id,
      hero_image_src, hero_image_alt,
      eyebrow_override, headline_override, intro_override,
      is_active, accuracy_date, at_a_glance_bullets,
      guide_year, guide_version,
      plan_your_visit_heading, plan_your_visit_intro, plan_your_visit_bullets
    `)

  if (error) throw new Error(`Failed to fetch experiences guides: ${error.message}`)
  return camelizeKeys<AdminExperiencesGuide[]>(data ?? [])
}

export async function fetchExperiencesGrantsForDestination(
  globalDestinationId: string,
): Promise<AdminExperiencesGrant[]> {
  const { data, error } = await supabase
    .from('travel_experiences_guide_grants')
    .select(`
      id, user_id, global_destination_id, granted_at,
      profile:global_profiles!user_id (
        person_id
      )
    `)
    .eq('global_destination_id', globalDestinationId)
    .order('granted_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch grants: ${error.message}`)

  // S51: display_name dropped from global_profiles spine - name resolves
  // exclusively via the profile → person link.
  const rows = (data ?? []) as unknown as Array<{
    id:                    string
    userId:               string
    global_destination_id: string
    grantedAt:            string
    profile: {
      personId: string | null
    } | null
  }>

  const personIds = rows
    .map(r => r.profile?.personId)
    .filter((id): id is string => id != null)

  const peopleById = new Map<string, GlobalPerson>()
  if (personIds.length > 0) {
    const people = await fetchPeopleByIds(personIds)
    for (const p of people) peopleById.set(p.id, p)
  }

  return rows.map(r => ({
    id:                    r.id,
    userId:               r.userId,
    global_destination_id: r.global_destination_id,
    grantedAt:            r.grantedAt,
    person:                r.profile?.personId
      ? (peopleById.get(r.profile.personId) ?? null)
      : null,
  }))
}

// ── Experiences writes - guides ───────────────────────────────────────────────

export type ExperiencesGuidePatch = Partial<Omit<AdminExperiencesGuide, 'id' | 'global_destination_id'>>

export async function updateExperiencesGuide(id: string, patch: ExperiencesGuidePatch): Promise<void> {
  const { error } = await supabase
    .from('travel_experiences_guides')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update experiences guide: ${error.message}`)
}

export async function createExperiencesGuide(globalDestinationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('travel_experiences_guides')
    .insert({
      global_destination_id: globalDestinationId,
      isActive: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create experiences guide: ${error.message}`)
  return (data as { id: string }).id
}

export async function deleteExperiencesGuide(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_experiences_guides')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete experiences guide: ${error.message}`)
}

// ── Experiences writes - grants ───────────────────────────────────────────────

export async function createExperiencesGrant(
  userId:              string,
  globalDestinationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('travel_experiences_guide_grants')
    .insert({ userId: userId, global_destination_id: globalDestinationId })
  if (error) throw new Error(`Failed to create experiences grant: ${error.message}`)
}

export async function deleteExperiencesGrant(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_experiences_guide_grants')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete experiences grant: ${error.message}`)
}

// ── Writes - grants (UUID-keyed) ─────────────────────────────────────────────

export async function createGrant(
  userId:               string,
  globalDestinationId:  string,
): Promise<void> {
  const { error } = await supabase
    .from('travel_dining_guide_grants')
    .insert({ userId: userId, global_destination_id: globalDestinationId })
  if (error) throw new Error(`Failed to create grant: ${error.message}`)
}

export async function deleteGrant(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_dining_guide_grants')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete grant: ${error.message}`)
}

// ── JSON ingest ──────────────────────────────────────────────────────────────

export interface IngestVenueRecord {
  name:         string
  subCategory?: string
  address?:     string
  website?:     string
  description?: string
  tags?:        string[]
}

export interface IngestPayload {
  destination?: string
  contentType?: string
  restaurants:  IngestVenueRecord[]
}

export interface IngestResult {
  inserted: number
  skipped:  Array<{ name: string; reason: string }>
}

export async function ingestDiningJson(
  globalDestinationId: string,
  payload:             IngestPayload,
): Promise<IngestResult> {
  const existing = await supabase
    .from('travel_dining_venues')
    .select('name')
    .eq('global_destination_id', globalDestinationId)
  if (existing.error) throw new Error(`pre-flight failed: ${existing.error.message}`)

  const existingNames = new Set(
    (existing.data ?? []).map(r => (r as { name: string }).name.toLowerCase().trim())
  )

  const maxSortRes = await supabase
    .from('travel_dining_venues')
    .select('sort_order')
    .eq('global_destination_id', globalDestinationId)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (maxSortRes.error) throw new Error(`sort_order pre-flight failed: ${maxSortRes.error.message}`)
  let nextSort = ((maxSortRes.data?.[0] as { sort_order: number } | undefined)?.sort_order ?? 0) + 1

  const skipped: IngestResult['skipped'] = []
  const inserts: Array<Record<string, unknown>> = []

  for (const r of payload.restaurants) {
    if (!r.name || r.name.trim().length === 0) {
      skipped.push({ name: '(missing)', reason: 'missing name' })
      continue
    }
    const normalised = r.name.toLowerCase().trim()
    if (existingNames.has(normalised)) {
      skipped.push({ name: r.name, reason: 'name already exists for this destination' })
      continue
    }
    existingNames.add(normalised)

    inserts.push({
      name:                  r.name,
      global_destination_id: globalDestinationId,
      sortOrder:            nextSort++,
      isActive:             true,
      cuisineSubcategory:   r.subCategory ?? null,
      address:               r.address ?? null,
      website:               r.website ?? null,
      body:                  r.description ?? null,
      tags:                  r.tags && r.tags.length > 0 ? r.tags : null,
    })
  }

  if (inserts.length === 0) return { inserted: 0, skipped }

  const { error } = await supabase
    .from('travel_dining_venues')
    .insert(inserts)
  if (error) throw new Error(`Insert failed: ${error.message}`)

  return { inserted: inserts.length, skipped }
}

// ── Hotel types ───────────────────────────────────────────────────────────────

export interface AdminHotel {
  id:                    string
  globalDestinationId: string  // via destination_id FK
  name:                  string
  shortSlug:            string
  heroImageSrc:        string | null
  heroImageAlt:        string | null
  bullets:               string[] | null
  sortOrder:            number
  isActive:             boolean
  isPreferredPartner:  boolean
  isSupplementary:      boolean
  stars:                 number | null
  michelinKeys:         number | null
  forbesRating:         number | null
  description:           string | null
  internalNotes:        string | null
  address:               string | null
  city:                  string | null
  zipCode:              string | null
  latitude:              number | null
  longitude:             number | null
  googleMapsUrl:       string | null
  website:               string | null
  phone:                 string | null
  reservationsPhone:    string | null
  mainEmail:            string | null
  reservationsEmail:    string | null
  salesEmail:           string | null
  conciergeEmail:       string | null
  guestRelationsEmail: string | null
  frontOfficeEmail:    string | null
  imageCredit:          string | null
  imageCreditUrl:      string | null
  imageLicense:         string | null
}

export interface AdminHotelGuide {
  id:                      string
  global_destination_id:   string
  heroImageSrc:          string | null
  heroImageAlt:          string | null
  eyebrowOverride:        string | null
  headlineOverride:       string | null
  introOverride:          string | null
  isActive:               boolean
  accuracyDate:           string | null
  guideYear:              number | null
  guideVersion:           string | null
  atAGlanceBullets:     string[] | null
  planYourVisitHeading: string | null
  planYourVisitIntro:   string | null
  planYourVisitBullets: string[] | null
}

export interface DestinationWithHotelCounts {
  id:          string
  hotel_count: number
  hasOverlay: boolean
}

export type HotelPatch      = Partial<Omit<AdminHotel, 'id'>>
export type HotelGuidePatch = Partial<Omit<AdminHotelGuide, 'id' | 'global_destination_id'>>

// ── Hotel reads ───────────────────────────────────────────────────────────────

export async function fetchAllHotels(
  destinationIdFilter?: string | null,
): Promise<AdminHotel[]> {
  let q = supabase
    .from('travel_accom_hotels')
    .select(`
      id, destination_id, name, short_slug,
      hero_image_src, hero_image_alt, bullets, sort_order,
      is_active, is_preferred_partner, is_supplementary,
      stars, michelin_keys, forbes_rating,
      description, internal_notes,
      address, city, zip_code, latitude, longitude,
      google_maps_url, website, phone, reservations_phone,
      main_email, reservations_email, sales_email,
      concierge_email, guest_relations_email, front_office_email,
      image_credit, image_credit_url, image_license
    `)
    .order('sort_order', { ascending: true })

  if (destinationIdFilter) {
    q = q.eq('destination_id', destinationIdFilter)
  }

  const { data, error } = await q
  if (error) throw new Error(`Failed to fetch hotels: ${error.message}`)

  // Remap destination_id → global_destination_id for consistency
  // bullets is jsonb - cast to string[]
  const rows = camelizeKeys<Record<string, unknown>[]>(data ?? [])
  return rows.map((r) => ({
    ...r,
    globalDestinationId: r.destinationId as string,
    bullets: Array.isArray(r.bullets) ? (r.bullets as string[]) : null,
  })) as unknown as AdminHotel[]
}

export async function fetchDestinationsWithHotels(): Promise<DestinationWithHotelCounts[]> {
  const [hotelsRes, guidesRes] = await Promise.all([
    supabase
      .from('travel_accom_hotels')
      .select('destination_id')
      .eq('is_active', true),
    supabase
      .from('travel_hotel_guides')
      .select('global_destination_id'),
  ])

  if (hotelsRes.error) throw new Error(`hotels: ${hotelsRes.error.message}`)
  if (guidesRes.error) throw new Error(`guides: ${guidesRes.error.message}`)

  const countByDest = new Map<string, number>()
  for (const h of hotelsRes.data ?? []) {
    const id = (h as { destination_id: string }).destination_id
    if (!id) continue
    countByDest.set(id, (countByDest.get(id) ?? 0) + 1)
  }

  const overlaySet = new Set<string>(
    (guidesRes.data ?? []).map(g => (g as { global_destination_id: string }).global_destination_id)
  )

  return Array.from(countByDest.entries()).map(([id, count]) => ({
    id,
    hotel_count: count,
    hasOverlay: overlaySet.has(id),
  }))
}

export async function fetchHotelGuides(): Promise<AdminHotelGuide[]> {
  const { data, error } = await supabase
    .from('travel_hotel_guides')
    .select(`
      id, global_destination_id,
      hero_image_src, hero_image_alt,
      eyebrow_override, headline_override, intro_override,
      is_active, accuracy_date, at_a_glance_bullets,
      guide_year, guide_version,
      plan_your_visit_heading, plan_your_visit_intro, plan_your_visit_bullets
    `)
  if (error) throw new Error(`Failed to fetch hotel guides: ${error.message}`)
  return camelizeKeys<AdminHotelGuide[]>(data ?? [])
}

// ── Hotel writes ──────────────────────────────────────────────────────────────

export async function updateHotel(id: string, patch: HotelPatch): Promise<void> {
  // Remap global_destination_id back to destination_id for the DB write
  const { global_destination_id, ...rest } = patch as HotelPatch & { global_destination_id?: string }
  const dbPatch = global_destination_id
    ? { ...rest, destinationId: global_destination_id }
    : rest
  const { error } = await supabase
    .from('travel_accom_hotels')
    .update(dbPatch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update hotel: ${error.message}`)
}

export async function updateHotelGuide(id: string, patch: HotelGuidePatch): Promise<void> {
  const { error } = await supabase
    .from('travel_hotel_guides')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update hotel guide: ${error.message}`)
}

export async function createHotelGuide(globalDestinationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('travel_hotel_guides')
    .insert({ global_destination_id: globalDestinationId, isActive: true })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create hotel guide: ${error.message}`)
  return (data as { id: string }).id
}

export async function deleteHotelGuide(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_hotel_guides')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete hotel guide: ${error.message}`)
}

// ── Shopping guide types ──────────────────────────────────────────────────────

export interface AdminShop {
  id:                    string
  global_destination_id: string
  name:                  string
  brand:                 string | null
  shopType:             string | null
  tagline:               string | null
  body:                  string | null
  bullets:               unknown
  address:               string | null
  mapsUrl:              string | null
  byAppointment:        boolean
  imageSrc:             string | null
  imageAlt:             string | null
  imageCredit:          string | null
  imageCreditUrl:      string | null
  imageLicense:         string | null
  isActive:             boolean
  sortOrder:            number
}

export interface AdminShoppingGuide {
  id:                      string
  global_destination_id:   string
  heroImageSrc:          string | null
  heroImageAlt:          string | null
  eyebrowOverride:        string | null
  headlineOverride:       string | null
  introOverride:          string | null
  isActive:               boolean
  accuracyDate:           string | null
  atAGlanceBullets:     string[] | null
  guideYear:              number | null
  guideVersion:           string | null
  planYourVisitHeading: string | null
  planYourVisitIntro:   string | null
  planYourVisitBullets: string[] | null
}

export interface DestinationWithShoppingCounts {
  id:          string
  shop_count:  number
  hasOverlay: boolean
}

export type ShoppingGuidePatch = Partial<Omit<AdminShoppingGuide, 'id' | 'global_destination_id'>>

// ── Shopping reads ────────────────────────────────────────────────────────────

export async function fetchDestinationsWithShopping(): Promise<DestinationWithShoppingCounts[]> {
  const [shopsRes, guidesRes] = await Promise.all([
    supabase
      .from('travel_shopping')
      .select('global_destination_id')
      .eq('is_active', true),
    supabase
      .from('travel_shopping_guides')
      .select('global_destination_id'),
  ])

  if (shopsRes.error)  throw new Error(`shops: ${shopsRes.error.message}`)
  if (guidesRes.error) throw new Error(`guides: ${guidesRes.error.message}`)

  const shopCountByDest = new Map<string, number>()
  for (const s of shopsRes.data ?? []) {
    const id = (s as { global_destination_id: string }).global_destination_id
    shopCountByDest.set(id, (shopCountByDest.get(id) ?? 0) + 1)
  }

  const overlaySet = new Set<string>(
    (guidesRes.data ?? []).map(g => (g as { global_destination_id: string }).global_destination_id)
  )

  const out: DestinationWithShoppingCounts[] = []
  for (const [id, count] of shopCountByDest.entries()) {
    out.push({ id, shop_count: count, hasOverlay: overlaySet.has(id) })
  }
  return out
}

export async function fetchShoppingGuides(): Promise<AdminShoppingGuide[]> {
  const { data, error } = await supabase
    .from('travel_shopping_guides')
    .select(`
      id, global_destination_id,
      hero_image_src, hero_image_alt,
      eyebrow_override, headline_override, intro_override,
      is_active, accuracy_date, at_a_glance_bullets,
      guide_year, guide_version,
      plan_your_visit_heading, plan_your_visit_intro, plan_your_visit_bullets
    `)

  if (error) throw new Error(`Failed to fetch shopping guides: ${error.message}`)
  return camelizeKeys<AdminShoppingGuide[]>(data ?? [])
}

// ── Shopping writes ───────────────────────────────────────────────────────────

export async function updateShoppingGuide(id: string, patch: ShoppingGuidePatch): Promise<void> {
  const { error } = await supabase
    .from('travel_shopping_guides')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update shopping guide: ${error.message}`)
}

export async function createShoppingGuide(globalDestinationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('travel_shopping_guides')
    .insert({
      global_destination_id: globalDestinationId,
      isActive: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create shopping guide: ${error.message}`)
  return (data as { id: string }).id
}

export async function deleteShoppingGuide(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_shopping_guides')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete shopping guide: ${error.message}`)
}