// adminGuidesQueries.ts — read + write paths for guides/library admin tabs
//
// What it owns:
//   - Listing destinations with dining content (UUID-keyed)
//   - Listing all dining venues (UUID-keyed)
//   - CRUD on travel_dining_venues (canonical pool) — by UUID
//   - CRUD on travel_dining_guides (per-destination overlay) — by UUID
//   - JSON ingest with name+destination collision guard (slug removed S38)
//
// UUID-only standing rule (S35 canon):
//   All FKs and lookups resolved via UUID. Slugs are for URL routing only.
//   Caller-side rendering of destination name for display lives in the
//   tab component, not on these query types.
//
// Last updated: S39 — Dropped legacy michelin boolean (s37_10 ran).
//   Added michelin_award, michelin_stars, michelin_green_star, worlds_50_best
//   to AdminDiningVenue type, fetchAllDiningVenues SELECT, and ingestDiningJson.
// Prior: S39 — Synced AdminDiningVenue to actual DB schema. ambience_take
//   replaced by body. Added kicker, tagline, bullets_heading, bullets,
//   image_credit, image_credit_url, image_license. Removed why_recommend.
// Prior: S38 — Removed slug from AdminDiningVenue type, SELECT, and ingest.

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DestinationOption {
  id:   string
  slug: string
  name: string
}

export interface DestinationWithDiningCounts {
  id:           string
  venue_count:  number
  has_overlay:  boolean
}

export type MichelinAward = 'star' | 'bib_gourmand'

export interface AdminDiningVenue {
  id:                    string
  global_destination_id: string
  name:                  string
  cuisine_subcategory:   string | null
  kicker:                string | null
  tagline:               string | null
  body:                  string | null
  bullets_heading:       string | null
  bullets:               string[] | null
  michelin_award:        MichelinAward | null
  michelin_stars:        number | null
  michelin_green_star:   boolean
  worlds_50_best:        boolean
  address:               string | null
  maps_url:              string | null
  website:               string | null
  neighborhood:          string | null
  price_band:            string | null
  public_preview_rank:   number | null
  tags:                  string[] | null
  image_src:             string | null
  image_alt:             string | null
  image_credit:          string | null
  image_credit_url:      string | null
  image_license:         string | null
  image_2_src:           string | null
  image_2_alt:           string | null
  is_active:             boolean
  sort_order:            number
}

export interface AdminDiningGuide {
  id:                    string
  global_destination_id: string
  hero_image_src:        string | null
  hero_image_alt:        string | null
  eyebrow_override:      string | null
  headline_override:     string | null
  intro_override:        string | null
  is_active:             boolean
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
    out.push({ id, venue_count: count, has_overlay: overlaySet.has(id) })
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
  return (data ?? []) as AdminDiningVenue[]
}

export async function fetchDiningGuides(): Promise<AdminDiningGuide[]> {
  const { data, error } = await supabase
    .from('travel_dining_guides')
    .select(`
      id, global_destination_id,
      hero_image_src, hero_image_alt,
      eyebrow_override, headline_override, intro_override,
      is_active
    `)

  if (error) throw new Error(`Failed to fetch guides: ${error.message}`)
  return (data ?? []) as AdminDiningGuide[]
}

// ── Writes — venues (UUID-keyed) ─────────────────────────────────────────────

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

// ── Writes — guides (UUID-keyed) ─────────────────────────────────────────────

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
      is_active: true,
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

// ── JSON ingest ──────────────────────────────────────────────────────────────
//
// Collision guard: name (case-insensitive) within destination UUID.
// Slug dropped S38. michelin boolean dropped S39 (s37_10).
// body is the single long-form copy field (mapped from r.description).

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
      sort_order:            nextSort++,
      is_active:             true,
      cuisine_subcategory:   r.subCategory ?? null,
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