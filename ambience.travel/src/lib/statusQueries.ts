// statusQueries.ts — Engagement + itinerary status lookup queries
// Owns:
//   - fetchEngagementStatuses()  — all rows of travel_engagement_statuses
//   - fetchItineraryStatuses()   — all rows of travel_itinerary_statuses
//   - mapEngagementStatus / mapItineraryStatus — row → camelCase mappers,
//     exported so hydrateEngagement in immerseEngagementQueries.ts can reuse them
//     on the nested join row without duplicating the snake_case → camelCase
//     shape.
//
// Used by admin dropdowns (operator-facing). Neither fetcher is consumed
// by guest-facing routes — guests see resolved labels via the joined
// status object on ImmerseEngagementData (see immerseEngagementQueries.ts
// hydrateEngagement).
//
// Last updated: S30E — Engagement abstraction. Renames mirror DB:
//   travel_trip_statuses → travel_engagement_statuses; fetchTripStatuses →
//   fetchEngagementStatuses; mapTripStatus → mapEngagementStatus;
//   TripStatus type → EngagementStatus. Itinerary side unchanged —
//   itinerary lifecycle is journey-engagement-specific.
// Prior: S30D — initial.
//
// Lookup tables are public-readable per RLS; using `supabase` (auth-attached)
// is fine. Order by sort_order so dropdowns render in the operator-facing
// logical sequence without re-sorting client-side.

import { supabase } from './supabase'
import type { EngagementStatus, ItineraryStatus } from './immerseTypes'

// ─── DB row types ────────────────────────────────────────────────────────────

type EngagementStatusRow = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
  is_active:  boolean
}

type ItineraryStatusRow = EngagementStatusRow   // identical shape

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchEngagementStatuses(activeOnly = true): Promise<EngagementStatus[]> {
  const query = supabase
    .from('travel_engagement_statuses')
    .select('id, slug, label, sort_order, is_active')
    .order('sort_order', { ascending: true })

  if (activeOnly) query.eq('is_active', true)

  const { data, error } = await query
  if (error || !data) return []

  return (data as EngagementStatusRow[]).map(mapEngagementStatus)
}

export async function fetchItineraryStatuses(activeOnly = true): Promise<ItineraryStatus[]> {
  const query = supabase
    .from('travel_itinerary_statuses')
    .select('id, slug, label, sort_order, is_active')
    .order('sort_order', { ascending: true })

  if (activeOnly) query.eq('is_active', true)

  const { data, error } = await query
  if (error || !data) return []

  return (data as ItineraryStatusRow[]).map(mapItineraryStatus)
}

// ─── Internal mappers ────────────────────────────────────────────────────────
// Exported for reuse by hydrateEngagement (immerseEngagementQueries.ts) on nested
// join rows.

export function mapEngagementStatus(row: EngagementStatusRow): EngagementStatus {
  return {
    id:        row.id,
    slug:      row.slug,
    label:     row.label,
    sortOrder: row.sort_order,
    isActive:  row.is_active,
  }
}

export function mapItineraryStatus(row: ItineraryStatusRow): ItineraryStatus {
  return {
    id:        row.id,
    slug:      row.slug,
    label:     row.label,
    sortOrder: row.sort_order,
    isActive:  row.is_active,
  }
}