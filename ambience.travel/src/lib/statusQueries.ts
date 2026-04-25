// statusQueries.ts — Trip + itinerary status lookup queries
// Owns:
//   - fetchTripStatuses()        — all rows of travel_trip_statuses
//   - fetchItineraryStatuses()   — all rows of travel_itinerary_statuses
//   - mapTripStatus / mapItineraryStatus — row → camelCase mappers, exported
//     so hydrateTrip in immerseTripQueries.ts can reuse them on the nested
//     join row without duplicating the snake_case → camelCase shape.
//
// Used by admin dropdowns (operator-facing). Neither fetcher is consumed
// by guest-facing routes — guests see resolved labels via the joined
// status object on ImmerseTripData (see immerseTripQueries.ts hydrateTrip).
//
// Last updated: S30D — initial.
//
// Lookup tables are public-readable per RLS; using `supabase` (auth-attached)
// is fine. Order by sort_order so dropdowns render in the operator-facing
// logical sequence without re-sorting client-side.

import { supabase } from './supabase'
import type { TripStatus, ItineraryStatus } from './immerseTypes'

// ─── DB row types ────────────────────────────────────────────────────────────

type TripStatusRow = {
  id:         string
  slug:       string
  label:      string
  sort_order: number
  is_active:  boolean
}

type ItineraryStatusRow = TripStatusRow   // identical shape

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchTripStatuses(activeOnly = true): Promise<TripStatus[]> {
  const query = supabase
    .from('travel_trip_statuses')
    .select('id, slug, label, sort_order, is_active')
    .order('sort_order', { ascending: true })

  if (activeOnly) query.eq('is_active', true)

  const { data, error } = await query
  if (error || !data) return []

  return (data as TripStatusRow[]).map(mapTripStatus)
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
// Exported for reuse by hydrateTrip (immerseTripQueries.ts) on nested join rows.

export function mapTripStatus(row: TripStatusRow): TripStatus {
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