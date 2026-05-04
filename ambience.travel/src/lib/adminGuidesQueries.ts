// adminGuidesQueries.ts — read + write paths for guides/library admin tabs
//
// What it owns:
//   - Listing destinations with dining content (UUID-keyed)
//   - Listing all dining venues (UUID-keyed)
//   - CRUD on travel_dining_venues (canonical pool) — by UUID
//   - CRUD on travel_dining_guides (per-destination overlay) — by UUID
//   - JSON ingest with collision-by-slug guard (slug used only for venue
//     identity within a destination, never as a destination key)
//
// UUID-only standing rule (S35 canon):
//   All FKs and lookups resolved via UUID. Slugs are for URL routing only.
//   Caller-side rendering of destination name/slug for display lives in the
//   tab component, not on these query types.
//
// Last updated: S36

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

export interface AdminDiningVenue {
  id:                    string
  global_destination_id: string
  slug:                  string
  name:                  string
  cuisine_subcategory:   string | null
  michelin:              boolean
  address:               string | null
  maps_url:              string | null
  website:               string | null
  ambience_take:         string | null
  why_recommend:         string | null
  neighborhood:          string | null
  price_band:            string | null
  public_preview_rank:   number | null
  tags:                  string[] | null
  image_src:             string | null
  image_alt:             string | null
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
      id, global_destination_id, slug, name,
      cuisine_subcategory, michelin, address, maps_url, website,
      ambience_take, why_recommend, neighborhood, price_band,
      public_preview_rank, tags,
      image_src, image_alt, image_2_src, image_2_alt,
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
// Caller passes globalDestinationId (UUID, the operative key) plus
// destinationSlugForVenueSlugFallback — used ONLY when JSON entries lack their
// own `id` field, to construct a per-venue slug (e.g. "newyork-eleven-madison").
// The destination slug never identifies the destination itself.

export interface IngestVenueRecord {
  id?:             string
  name:            string
  subCategory?:    string
  michelin?:       boolean
  address?:        string
  website?:        string
  description?:    string
  whyRecommended?: string
  tags?:           string[]
}

export interface IngestPayload {
  destination?: string
  contentType?: string
  restaurants:  IngestVenueRecord[]
}

export interface IngestResult {
  inserted: number
  skipped:  Array<{ slug: string; reason: string }>
}

export async function ingestDiningJson(
  globalDestinationId:               string,
  payload:                           IngestPayload,
  destinationSlugForVenueSlugFallback: string,
): Promise<IngestResult> {
  const existing = await supabase
    .from('travel_dining_venues')
    .select('slug')
    .eq('global_destination_id', globalDestinationId)
  if (existing.error) throw new Error(`pre-flight failed: ${existing.error.message}`)
  const existingSlugs = new Set(
    (existing.data ?? []).map(r => (r as { slug: string }).slug)
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
      skipped.push({ slug: r.id ?? '(no slug)', reason: 'missing name' })
      continue
    }
    const slug = r.id ?? slugifyVenueName(r.name, destinationSlugForVenueSlugFallback)
    if (existingSlugs.has(slug)) {
      skipped.push({ slug, reason: 'slug already exists' })
      continue
    }
    existingSlugs.add(slug)

    inserts.push({
      slug,
      name:                  r.name,
      global_destination_id: globalDestinationId,
      sort_order:            nextSort++,
      is_active:             true,
      cuisine_subcategory:   r.subCategory ?? null,
      michelin:              r.michelin ?? false,
      address:               r.address ?? null,
      website:               r.website ?? null,
      ambience_take:         r.description ?? null,
      why_recommend:         r.whyRecommended ?? null,
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

function slugifyVenueName(name: string, destSlug: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `${destSlug}-${cleaned}`
}