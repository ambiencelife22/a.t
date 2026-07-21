// statusQueries.ts - Engagement + itinerary status lookup queries
// Owns:
//   - fetchEngagementStatuses()  - all rows of travel_lifecycle_statuses
//   - fetchItineraryStatuses()   - all rows of travel_itinerary_statuses
//   - mapEngagementStatus / mapItineraryStatus - row → camelCase mappers,
//     exported so hydrateEngagement in immerseEngagementQueries.ts can reuse them
//     on the nested join row without duplicating the snake_case → camelCase
//     shape.
//
// Used by admin dropdowns (operator-facing). Neither fetcher is consumed
// by guest-facing routes - guests see resolved labels via the joined
// status object on ImmerseEngagementData (see immerseEngagementQueries.ts
// hydrateEngagement).
//
// Last updated: S30E - Engagement abstraction. Renames mirror DB:
//   travel_trip_statuses → travel_lifecycle_statuses; fetchTripStatuses →
//   fetchEngagementStatuses; mapTripStatus → mapEngagementStatus;
//   TripStatus type → EngagementStatus. Itinerary side unchanged -
//   itinerary lifecycle is journey-engagement-specific.
// Prior: S30D - initial.
//
// Lookup tables are public-readable per RLS; using `supabase` (auth-attached)
// is fine. Order by sort_order so dropdowns render in the operator-facing
// logical sequence without re-sorting client-side.

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type { EngagementStatus, ItineraryStatus, EngagementStatusRow, ItineraryStatusRow } from '../types/typesImmerse'

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchEngagementStatuses(activeOnly = true): Promise<EngagementStatus[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', {
    body: { mode: 'engagement_statuses', activeOnly },
  })
  if (error) throw new Error(`engagement_statuses: ${error.message}`)
  const rows = camelizeKeys<EngagementStatusRow[]>(data?.rows ?? [])
  return rows.map(mapEngagementStatus)
}

export async function fetchItineraryStatuses(activeOnly = true): Promise<ItineraryStatus[]> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', {
    body: { mode: 'itinerary_statuses', activeOnly },
  })
  if (error) throw new Error(`itinerary_statuses: ${error.message}`)
  const rows = camelizeKeys<ItineraryStatusRow[]>(data?.rows ?? [])
  return rows.map(mapItineraryStatus)
}

// ─── Internal mappers ────────────────────────────────────────────────────────
// Exported for reuse by hydrateEngagement (immerseEngagementQueries.ts) on nested
// join rows.

export function mapEngagementStatus(row: EngagementStatusRow): EngagementStatus {
  return {
    id:        row.id,
    slug:      row.slug,
    label:     row.label,
    sortOrder: row.sortOrder,
    isActive:  row.isActive,
  }
}

export function mapItineraryStatus(row: ItineraryStatusRow): ItineraryStatus {
  return {
    id:        row.id,
    slug:      row.slug,
    label:     row.label,
    sortOrder: row.sortOrder,
    isActive:  row.isActive,
  }
}