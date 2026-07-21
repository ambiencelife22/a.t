// adminDestinationRowQueries.ts - Supabase reads/writes for the destination
// rows editor on engagement detail.
// Owns: list / update / insert / delete / reorder rows on
//       travel_overlay_engagement_destination_rows. Search canonical destinations
//       for the add-destination picker.
// Not owned: storage path composition (storagePath.ts), uploads
//            (adminAssetQueries.ts), engagement-level queries
//            (adminEngagementQueries.ts).
//
// Schema verified S33C pre-flight: 34 columns. global_destination_id NOT
// NULL; destination_id nullable. subpage_status NOT NULL default 'live'.
// Last updated: S33C

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DestinationRow = {
  id:                   string
  engagementId:              string
  destinationId:       string | null
  globalDestinationId: string

  // Joined display fields
  destinationSlug:     string | null
  destinationName:     string | null

  // Card
  numberLabel:         string | null
  title:                string | null
  mood:                 string | null
  summary:              string | null
  stayLabel:           string | null
  imageSrc:            string | null
  imageAlt:            string | null
  sortOrder:           number
  subpageStatus:       'live' | 'preview'

  // Subpage hero overrides
  heroImageSrcOverride:   string | null
  heroImageAltOverride:   string | null
  heroImageSrc2Override: string | null
  heroImageAlt2Override: string | null
  heroTitle2Override:     string | null
  heroSubtitle2Override:  string | null

  // Subpage intro overrides
  introTitleOverride: string | null
  introBodyOverride:  string | null

  // Pricing overrides
  pricingBodyOverride:                    string | null
  pricingNotesHeadingOverride:           string | null
  pricingNotesTitleOverride:             string | null
  pricingNotesOverride:                   unknown   // jsonb
  pricingCloserItemOverride:             string | null
  pricingCloserBasisOverride:            string | null
  pricingCloserStayOverride:             string | null
  pricingCloserIndicativeRangeOverride: string | null

  // Dining overrides
  diningEyebrowOverride: string | null
  diningTitleOverride:   string | null
  diningBodyOverride:    string | null

  createdAt: string
  updatedAt: string
}

export type DestinationOption = {
  id:           string
  slug:         string
  name:         string
  storagePath: string | null
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchDestinationRows(
  engagementId: string,
): Promise<DestinationRow[]> {
  const { data, error } = await supabase
    .from('travel_overlay_engagement_destination_rows')
    .select(`
      *,
      global_destination:global_destinations!global_destination_id (
        slug, name
      )
    `)
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  const rows = camelizeKeys<any[]>(data ?? [])
  return rows.map((r: any) => ({
    ...r,
    destinationSlug: r.global_destination?.slug ?? null,
    destinationName: r.global_destination?.name ?? null,
  })) as DestinationRow[]
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDestinationRow(
  id:      string,
  payload: Partial<DestinationRow>,
): Promise<void> {
  // Map camel payload -> snake DB columns; strip joined/immutable fields.
  const colMap: Record<string, string> = {
    title: 'title', sortOrder: 'sort_order', subpageStatus: 'subpage_status',
    globalDestinationId: 'global_destination_id', nights: 'nights', note: 'note',
  }
  const clean: Record<string, unknown> = {}
  for (const k of Object.keys(payload)) {
    const col = colMap[k]
    if (col) clean[col] = (payload as Record<string, unknown>)[k]
  }

  const { error } = await supabase
    .from('travel_overlay_engagement_destination_rows')
    .update(clean)
    .eq('id', id)
  if (error) throw error
}

// ── Insert (add destination flow) ─────────────────────────────────────────────

export type AddDestinationPayload = {
  engagementId:               string
  global_destination_id: string
  title:                 string                  // pre-filled with destination name
  sortOrder:            number                  // caller computes max + 1
  subpage_status?:       'live' | 'preview'
}

export async function insertDestinationRow(
  payload: AddDestinationPayload,
): Promise<string> {
  const { data, error } = await supabase
    .from('travel_overlay_engagement_destination_rows')
    .insert({
      engagementId:               payload.engagementId,
      global_destination_id: payload.global_destination_id,
      title:                 payload.title,
      sortOrder:            payload.sortOrder,
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
    .from('travel_overlay_engagement_destination_rows')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Reorder (drag-and-drop sort_order) ────────────────────────────────────────

/**
 * Reassign sort_order on a list of row IDs. Callers should pass the full list
 * of destination row IDs in the new desired order; sort_order is reset to
 * 1..N to match. One UPDATE per row - Postgres has no native multi-row update
 * by id with different values per row that matches our shape.
 */
export async function reorderDestinationRows(
  orderedIds: string[],
): Promise<void> {
  // Run sequentially to keep error messages clean; volume is small (typically 5-8)
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('travel_overlay_engagement_destination_rows')
      .update({ sortOrder: i + 1 })
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
  return camelizeKeys<DestinationOption[]>(data ?? [])
}

// ── Max sort_order (for add defaults) ─────────────────────────────────────────

export async function fetchMaxDestinationSortOrder(
  engagementId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('travel_overlay_engagement_destination_rows')
    .select('sort_order')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.sort_order ?? 0) + 1
}