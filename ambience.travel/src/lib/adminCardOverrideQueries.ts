/* adminCardOverrideQueries.ts
 * Query layer for travel_immerse_trip_content_card_overrides.
 *
 * Override rows FK directly to canonical (dining_venue_id XOR experience_id).
 * Canonical pool: travel_dining_venues + travel_experiences (variant 3 in the
 * curation/canonical split — Dev Standards §IV).
 *
 * Resolution: override field flows through canonical. NULL = use canonical;
 * '' = hide on render; non-empty = override.
 *
 * Last updated: S334
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type CardKind = 'dining' | 'experience'

export interface CardOverride {
  id:                          string
  trip_id:                     string
  dining_venue_id:             string | null
  experience_id:               string | null
  // Resolved canonical metadata (joined for display — not persisted on this row)
  kind:                        CardKind
  canonical_name:              string | null
  canonical_slug:              string | null
  canonical_image_src:         string | null
  canonical_global_dest_slug:  string | null
  // Override columns
  kicker_override:             string | null
  name_override:               string | null
  tagline_override:            string | null
  body_override:               string | null
  bullets_heading_override:    string | null
  bullets_override:            unknown
  image_src_override:          string | null
  image_alt_override:          string | null
  image_credit_override:       string | null
  image_credit_url_override:   string | null
  image_license_override:      string | null
  is_active:                   boolean
}

export interface CardCanonicalOption {
  id:                  string
  kind:                CardKind
  name:                string
  slug:                string
  image_src:           string | null
  global_destination_slug: string | null
}

// ── Internal row shape (DB column names) ─────────────────────────────────────

interface CardOverrideRow {
  id: string
  trip_id: string
  dining_venue_id: string | null
  experience_id: string | null
  kicker_override: string | null
  name_override: string | null
  tagline_override: string | null
  body_override: string | null
  bullets_heading_override: string | null
  bullets_override: unknown
  image_src_override: string | null
  image_alt_override: string | null
  image_credit_override: string | null
  image_credit_url_override: string | null
  image_license_override: string | null
  is_active: boolean
  dining: { name: string | null; slug: string | null; image_src: string | null; global_destinations: { slug: string | null } | null } | null
  experience: { name: string | null; slug: string | null; image_src: string | null; global_destinations: { slug: string | null } | null } | null
}

function shapeRow(r: CardOverrideRow): CardOverride {
  const isDining = r.dining_venue_id !== null
  const canon = isDining ? r.dining : r.experience
  return {
    id:                          r.id,
    trip_id:                     r.trip_id,
    dining_venue_id:             r.dining_venue_id,
    experience_id:               r.experience_id,
    kind:                        isDining ? 'dining' : 'experience',
    canonical_name:              canon?.name ?? null,
    canonical_slug:              canon?.slug ?? null,
    canonical_image_src:         canon?.image_src ?? null,
    canonical_global_dest_slug:  canon?.global_destinations?.slug ?? null,
    kicker_override:             r.kicker_override,
    name_override:               r.name_override,
    tagline_override:            r.tagline_override,
    body_override:               r.body_override,
    bullets_heading_override:    r.bullets_heading_override,
    bullets_override:            r.bullets_override,
    image_src_override:          r.image_src_override,
    image_alt_override:          r.image_alt_override,
    image_credit_override:       r.image_credit_override,
    image_credit_url_override:   r.image_credit_url_override,
    image_license_override:      r.image_license_override,
    is_active:                   r.is_active,
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchCardOverrides(engagementId: string): Promise<CardOverride[]> {
  const { data, error } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .select(`
      id,
      trip_id,
      dining_venue_id,
      experience_id,
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
      image_license_override,
      is_active,
      dining:travel_dining_venues!dining_venue_id (
        name, slug, image_src,
        global_destinations:global_destination_id ( slug )
      ),
      experience:travel_experiences!experience_id (
        name, slug, image_src,
        global_destinations:global_destination_id ( slug )
      )
    `)
    .eq('trip_id', engagementId)
    .order('is_active', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as unknown as CardOverrideRow[]
  return rows
    .map(shapeRow)
    // Sort within result: active first, then by kind, then canonical name
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
      return (a.canonical_name ?? '').localeCompare(b.canonical_name ?? '')
    })
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateCardOverride(
  id: string,
  payload: Partial<CardOverride>,
): Promise<void> {
  // Strip joined/derived fields — never persist these
  const dbPayload: Record<string, unknown> = {}
  const persistableKeys: (keyof CardOverride)[] = [
    'kicker_override',
    'name_override',
    'tagline_override',
    'body_override',
    'bullets_heading_override',
    'bullets_override',
    'image_src_override',
    'image_alt_override',
    'image_credit_override',
    'image_credit_url_override',
    'image_license_override',
    'is_active',
  ]
  persistableKeys.forEach(k => {
    if (k in payload) dbPayload[k] = payload[k]
  })

  if (Object.keys(dbPayload).length === 0) return

  const { error } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .update(dbPayload)
    .eq('id', id)

  if (error) throw error
}

// ── Insert ───────────────────────────────────────────────────────────────────

export async function insertCardOverride(args: {
  trip_id: string
  kind:    CardKind
  card_id: string
}): Promise<string> {
  const row: Record<string, unknown> = {
    trip_id:   args.trip_id,
    is_active: true,
  }
  if (args.kind === 'dining')     row.dining_venue_id = args.card_id
  if (args.kind === 'experience') row.experience_id   = args.card_id

  const { data, error } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .insert(row)
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCardOverride(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── Canonical pool search (for picker) ───────────────────────────────────────

export async function searchCanonicalCards(query: string): Promise<CardCanonicalOption[]> {
  const trimmed = query.trim()
  const ilikeFilter = trimmed.length > 0 ? `%${trimmed}%` : '%'

  const [diningRes, expRes] = await Promise.all([
    supabase
      .from('travel_dining_venues')
      .select(`id, name, slug, image_src, global_destinations:global_destination_id ( slug )`)
      .ilike('name', ilikeFilter)
      .order('name', { ascending: true })
      .limit(40),
    supabase
      .from('travel_experiences')
      .select(`id, name, slug, image_src, global_destinations:global_destination_id ( slug )`)
      .ilike('name', ilikeFilter)
      .order('name', { ascending: true })
      .limit(40),
  ])

  if (diningRes.error) throw diningRes.error
  if (expRes.error)    throw expRes.error

  type CanonRow = {
    id: string; name: string; slug: string; image_src: string | null;
    global_destinations: { slug: string | null } | null;
  }

  const dining = (diningRes.data ?? []) as unknown as CanonRow[]
  const exps   = (expRes.data ?? [])    as unknown as CanonRow[]

  const result: CardCanonicalOption[] = [
    ...dining.map(d => ({
      id: d.id, kind: 'dining' as const, name: d.name, slug: d.slug,
      image_src: d.image_src, global_destination_slug: d.global_destinations?.slug ?? null,
    })),
    ...exps.map(e => ({
      id: e.id, kind: 'experience' as const, name: e.name, slug: e.slug,
      image_src: e.image_src, global_destination_slug: e.global_destinations?.slug ?? null,
    })),
  ]

  // Sort: dining first (alphabetic), then experiences (alphabetic) — predictable picker order
  result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}