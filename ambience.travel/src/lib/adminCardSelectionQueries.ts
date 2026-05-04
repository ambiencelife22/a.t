/* adminCardSelectionQueries.ts
 * Query layer for travel_immerse_trip_content_card_selections — the curation
 * table that drives which cards render on the engagement page.
 *
 * Selection is the primary surface. Override is a secondary, lazy companion
 * row created only when the user customises a field. Resolution order:
 *   override field → canonical field → ''.
 *
 * Architecture (Dev Standards §IV variant 3 + 2 combined):
 *   - SELECTIONS = curation: which canonical cards appear, in what order,
 *     active or hidden. Has sort_order. Drag-to-reorder within type.
 *   - OVERRIDES  = customisation: optional per-engagement copy/image tweaks.
 *     Created lazily when the first field is customised. Empty rows possible
 *     (legacy) but no longer the default pattern.
 *
 * Last updated: S334
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type CardKind = 'dining' | 'experience'

/**
 * A single curated card on the engagement page. Selection-primary;
 * override fields lazily attached when present.
 */
export interface CardSelection {
  // Selection row identity
  id:                          string
  trip_id:                     string
  sort_order:                  number
  is_active:                   boolean
  dining_venue_id:             string | null
  experience_id:               string | null

  // Derived
  kind:                        CardKind

  // Canonical content (joined for display + override fallback)
  canonical_name:              string | null
  canonical_slug:              string | null
  canonical_kicker:            string | null
  canonical_tagline:           string | null
  canonical_body:              string | null
  canonical_bullets_heading:   string | null
  canonical_bullets:           string[] | null
  canonical_image_src:         string | null
  canonical_image_alt:         string | null
  canonical_image_credit:      string | null
  canonical_image_credit_url:  string | null
  canonical_image_license:     string | null
  canonical_global_dest_slug:  string | null

  // Override row (may not exist — null when no customisations yet)
  override_id:                 string | null
  kicker_override:             string | null
  name_override:               string | null
  tagline_override:            string | null
  body_override:               string | null
  bullets_heading_override:    string | null
  bullets_override:            string[] | null
  image_src_override:          string | null
  image_alt_override:          string | null
  image_credit_override:       string | null
  image_credit_url_override:   string | null
  image_license_override:      string | null
}

export interface CardCanonicalOption {
  id:                       string
  kind:                     CardKind
  name:                     string
  slug:                     string
  image_src:                string | null
  global_destination_slug:  string | null
}

// ── Internal canon row shape (Supabase nested select) ────────────────────────

interface CanonicalRow {
  name:              string | null
  slug:              string | null
  kicker:            string | null
  tagline:           string | null
  body:              string | null
  bullets_heading:   string | null
  bullets:           string[] | null
  image_src:         string | null
  image_alt:         string | null
  image_credit:      string | null
  image_credit_url:  string | null
  image_license:     string | null
  global_destinations: { slug: string | null } | null
}

interface OverrideRow {
  id:                          string
  kicker_override:             string | null
  name_override:               string | null
  tagline_override:            string | null
  body_override:               string | null
  bullets_heading_override:    string | null
  bullets_override:            string[] | null
  image_src_override:          string | null
  image_alt_override:          string | null
  image_credit_override:       string | null
  image_credit_url_override:   string | null
  image_license_override:      string | null
}

interface SelectionWithCanonRow {
  id:               string
  trip_id:          string
  sort_order:       number
  is_active:        boolean
  dining_venue_id:  string | null
  experience_id:    string | null
  dining:           CanonicalRow | null
  experience:       CanonicalRow | null
}

function shapeRow(
  s: SelectionWithCanonRow,
  override: OverrideRow | null,
): CardSelection {
  const isDining = s.dining_venue_id !== null
  const canon = isDining ? s.dining : s.experience
  return {
    id:         s.id,
    trip_id:    s.trip_id,
    sort_order: s.sort_order,
    is_active:  s.is_active,
    dining_venue_id: s.dining_venue_id,
    experience_id:   s.experience_id,
    kind:       isDining ? 'dining' : 'experience',
    canonical_name:             canon?.name ?? null,
    canonical_slug:             canon?.slug ?? null,
    canonical_kicker:           canon?.kicker ?? null,
    canonical_tagline:          canon?.tagline ?? null,
    canonical_body:             canon?.body ?? null,
    canonical_bullets_heading:  canon?.bullets_heading ?? null,
    canonical_bullets:          canon?.bullets ?? null,
    canonical_image_src:        canon?.image_src ?? null,
    canonical_image_alt:        canon?.image_alt ?? null,
    canonical_image_credit:     canon?.image_credit ?? null,
    canonical_image_credit_url: canon?.image_credit_url ?? null,
    canonical_image_license:    canon?.image_license ?? null,
    canonical_global_dest_slug: canon?.global_destinations?.slug ?? null,
    override_id:               override?.id ?? null,
    kicker_override:           override?.kicker_override ?? null,
    name_override:             override?.name_override ?? null,
    tagline_override:          override?.tagline_override ?? null,
    body_override:             override?.body_override ?? null,
    bullets_heading_override:  override?.bullets_heading_override ?? null,
    bullets_override:          override?.bullets_override ?? null,
    image_src_override:        override?.image_src_override ?? null,
    image_alt_override:        override?.image_alt_override ?? null,
    image_credit_override:     override?.image_credit_override ?? null,
    image_credit_url_override: override?.image_credit_url_override ?? null,
    image_license_override:    override?.image_license_override ?? null,
  }
}

const CANONICAL_FIELDS = `
  name, slug, kicker, tagline, body, bullets_heading, bullets,
  image_src, image_alt, image_credit, image_credit_url, image_license,
  global_destinations:global_destination_id ( slug )
`

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchCardSelections(engagementId: string): Promise<CardSelection[]> {
  // Fetch selections + canonical join + override rows in parallel
  const [selectionRes, overrideRes] = await Promise.all([
    supabase
      .from('travel_immerse_trip_content_card_selections')
      .select(`
        id, trip_id, sort_order, is_active, dining_venue_id, experience_id,
        dining:travel_dining_venues!dining_venue_id ( ${CANONICAL_FIELDS} ),
        experience:travel_experiences!experience_id ( ${CANONICAL_FIELDS} )
      `)
      .eq('trip_id', engagementId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('travel_immerse_trip_content_card_overrides')
      .select(`
        id, dining_venue_id, experience_id,
        kicker_override, name_override, tagline_override, body_override,
        bullets_heading_override, bullets_override,
        image_src_override, image_alt_override,
        image_credit_override, image_credit_url_override, image_license_override
      `)
      .eq('trip_id', engagementId),
  ])

  if (selectionRes.error) throw selectionRes.error
  if (overrideRes.error)  throw overrideRes.error

  const selections = (selectionRes.data ?? []) as unknown as SelectionWithCanonRow[]
  const overrides  = (overrideRes.data  ?? []) as unknown as (OverrideRow & {
    dining_venue_id: string | null
    experience_id:   string | null
  })[]

  // Index overrides by (kind, canonical_id) — selections look up their override here
  const overrideByKey = new Map<string, OverrideRow>()
  overrides.forEach(o => {
    if (o.dining_venue_id) overrideByKey.set(`dining:${o.dining_venue_id}`, o)
    if (o.experience_id)   overrideByKey.set(`experience:${o.experience_id}`, o)
  })

  return selections.map(s => {
    const key = s.dining_venue_id
      ? `dining:${s.dining_venue_id}`
      : `experience:${s.experience_id}`
    const ov = overrideByKey.get(key) ?? null
    return shapeRow(s, ov)
  })
}

// ── Selection mutations ──────────────────────────────────────────────────────

export async function updateSelection(
  id: string,
  payload: { sort_order?: number; is_active?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_trip_content_card_selections')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

export async function insertSelection(args: {
  trip_id:    string
  kind:       CardKind
  card_id:    string
  sort_order: number
}): Promise<string> {
  const row: Record<string, unknown> = {
    trip_id:    args.trip_id,
    sort_order: args.sort_order,
    is_active:  true,
  }
  if (args.kind === 'dining')     row.dining_venue_id = args.card_id
  if (args.kind === 'experience') row.experience_id   = args.card_id

  const { data, error } = await supabase
    .from('travel_immerse_trip_content_card_selections')
    .insert(row)
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function deleteSelection(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_trip_content_card_selections')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Reorders selections within a single kind. The argument is the post-drop
 * id list for that kind only, in render order; sort_order is rewritten 1..N.
 */
export async function reorderSelections(orderedIds: string[]): Promise<void> {
  // Sequential updates — sort_order is per-row, no bulk-update path
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase
      .from('travel_immerse_trip_content_card_selections')
      .update({ sort_order: i + 1 })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
}

// ── Override mutations (lazy — created on first customisation) ───────────────

/**
 * Upserts the override row for a selection. Creates the override row if it
 * does not yet exist (lazy). Returns the override row id.
 */
export async function upsertOverride(args: {
  trip_id:        string
  kind:           CardKind
  card_id:        string
  override_id:    string | null
  fields:         Partial<{
    kicker_override:             string | null
    name_override:               string | null
    tagline_override:            string | null
    body_override:               string | null
    bullets_heading_override:    string | null
    bullets_override:            string[] | null
    image_src_override:          string | null
    image_alt_override:          string | null
    image_credit_override:       string | null
    image_credit_url_override:   string | null
    image_license_override:      string | null
  }>
}): Promise<string> {
  if (args.override_id) {
    const { error } = await supabase
      .from('travel_immerse_trip_content_card_overrides')
      .update(args.fields)
      .eq('id', args.override_id)
    if (error) throw error
    return args.override_id
  }

  // Create new override row
  const insertRow: Record<string, unknown> = {
    trip_id:   args.trip_id,
    is_active: true,
    ...args.fields,
  }
  if (args.kind === 'dining')     insertRow.dining_venue_id = args.card_id
  if (args.kind === 'experience') insertRow.experience_id   = args.card_id

  const { data, error } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

/**
 * Deletes the override row entirely (reset all customisations to canonical).
 */
export async function deleteOverride(overrideId: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_trip_content_card_overrides')
    .delete()
    .eq('id', overrideId)
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

  result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves what actually renders for a given override field.
 *   - null         → canonical flows through
 *   - '' (empty)   → field hidden on render
 *   - non-empty    → override value used
 */
export function resolveText(override: string | null, canonical: string | null): {
  state:    'default' | 'customised' | 'hidden'
  rendered: string
} {
  if (override === null) return { state: 'default',    rendered: canonical ?? '' }
  if (override === '')   return { state: 'hidden',     rendered: '' }
  return                          { state: 'customised', rendered: override }
}

export function resolveBullets(override: string[] | null, canonical: string[] | null): {
  state:    'default' | 'customised' | 'hidden'
  rendered: string[]
} {
  if (override === null)        return { state: 'default',    rendered: canonical ?? [] }
  if (override.length === 0)    return { state: 'hidden',     rendered: [] }
  return                                 { state: 'customised', rendered: override }
}

/**
 * Computes the next sort_order for a new selection within a kind.
 */
export function nextSortOrder(existing: CardSelection[], kind: CardKind): number {
  const inKind = existing.filter(s => s.kind === kind)
  if (inKind.length === 0) return 1
  return Math.max(...inKind.map(s => s.sort_order)) + 1
}