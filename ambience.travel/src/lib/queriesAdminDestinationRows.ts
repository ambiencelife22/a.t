// adminDestinationRowQueries.ts — Supabase reads/writes for the destination
// rows editor on engagement detail.
// Owns: list / update / insert / delete / reorder rows on
//       travel_immerse_trip_destination_rows. Search canonical destinations
//       for the add-destination picker.
// Not owned: storage path composition (storagePath.ts), uploads
//            (adminAssetQueries.ts), engagement-level queries
//            (adminEngagementQueries.ts).
//
// Schema verified S33C pre-flight: 34 columns. global_destination_id NOT
// NULL; destination_id nullable. subpage_status NOT NULL default 'live'.
// Last updated: S33C

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DestinationRow = {
  id:                   string
  trip_id:              string
  destination_id:       string | null
  global_destination_id: string

  // Joined display fields
  destination_slug:     string | null
  destination_name:     string | null

  // Card
  number_label:         string | null
  title:                string | null
  mood:                 string | null
  summary:              string | null
  stay_label:           string | null
  image_src:            string | null
  image_alt:            string | null
  sort_order:           number
  subpage_status:       'live' | 'preview'

  // Subpage hero overrides
  hero_image_src_override:   string | null
  hero_image_alt_override:   string | null
  hero_image_src_2_override: string | null
  hero_image_alt_2_override: string | null
  hero_title_2_override:     string | null
  hero_subtitle_2_override:  string | null

  // Subpage intro overrides
  intro_title_override: string | null
  intro_body_override:  string | null

  // Pricing overrides
  pricing_body_override:                    string | null
  pricing_notes_heading_override:           string | null
  pricing_notes_title_override:             string | null
  pricing_notes_override:                   unknown   // jsonb
  pricing_closer_item_override:             string | null
  pricing_closer_basis_override:            string | null
  pricing_closer_stay_override:             string | null
  pricing_closer_indicative_range_override: string | null

  // Dining overrides
  dining_eyebrow_override: string | null
  dining_title_override:   string | null
  dining_body_override:    string | null

  created_at: string
  updated_at: string
}

export type DestinationOption = {
  id:           string
  slug:         string
  name:         string
  storage_path: string | null
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchDestinationRows(
  engagementId: string,
): Promise<DestinationRow[]> {
  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .select(`
      *,
      global_destination:global_destinations!global_destination_id (
        slug, name
      )
    `)
    .eq('trip_id', engagementId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  return (data ?? []).map((r: any) => ({
    ...r,
    destination_slug: r.global_destination?.slug ?? null,
    destination_name: r.global_destination?.name ?? null,
  })) as DestinationRow[]
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDestinationRow(
  id:      string,
  payload: Partial<DestinationRow>,
): Promise<void> {
  // Strip joined display fields and immutable identity fields before sending
  const clean: Record<string, unknown> = { ...payload }
  delete clean.id
  delete clean.trip_id
  delete clean.created_at
  delete clean.updated_at
  delete clean.destination_slug
  delete clean.destination_name

  const { error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .update(clean)
    .eq('id', id)
  if (error) throw error
}

// ── Insert (add destination flow) ─────────────────────────────────────────────

export type AddDestinationPayload = {
  trip_id:               string
  global_destination_id: string
  title:                 string                  // pre-filled with destination name
  sort_order:            number                  // caller computes max + 1
  subpage_status?:       'live' | 'preview'
}

export async function insertDestinationRow(
  payload: AddDestinationPayload,
): Promise<string> {
  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .insert({
      trip_id:               payload.trip_id,
      global_destination_id: payload.global_destination_id,
      title:                 payload.title,
      sort_order:            payload.sort_order,
      subpage_status:        payload.subpage_status ?? 'preview',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDestinationRow(id: string): Promise<void> {
  const { error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Reorder (drag-and-drop sort_order) ────────────────────────────────────────

/**
 * Reassign sort_order on a list of row IDs. Callers should pass the full list
 * of destination row IDs in the new desired order; sort_order is reset to
 * 1..N to match. One UPDATE per row — Postgres has no native multi-row update
 * by id with different values per row that matches our shape.
 */
export async function reorderDestinationRows(
  orderedIds: string[],
): Promise<void> {
  // Run sequentially to keep error messages clean; volume is small (typically 5–8)
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('travel_immerse_trip_destination_rows')
      .update({ sort_order: i + 1 })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
}

// ── Add-destination picker ────────────────────────────────────────────────────

/**
 * Search canonical destinations (kind='place') by name match. Returns up to
 * 30 results sorted by name. Caller filters out destinations already on the
 * engagement to prevent duplicates.
 */
export async function searchDestinations(
  query: string,
): Promise<DestinationOption[]> {
  let q = supabase
    .from('global_destinations')
    .select('id, slug, name, storage_path')
    .eq('kind', 'place')
    .order('name', { ascending: true })
    .limit(30)

  const trimmed = query.trim()
  if (trimmed) {
    q = q.or(`name.ilike.%${trimmed}%,slug.ilike.%${trimmed}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as DestinationOption[]
}

// ── Max sort_order (for add defaults) ─────────────────────────────────────────

export async function fetchMaxDestinationSortOrder(
  engagementId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('travel_immerse_trip_destination_rows')
    .select('sort_order')
    .eq('trip_id', engagementId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.sort_order ?? 0) + 1
}