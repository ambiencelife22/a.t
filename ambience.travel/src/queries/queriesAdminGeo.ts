// adminGeoQueries.ts - Supabase reads for admin geography cascade
// Owns: subcontinent / country / state / destination / hotel queries used
//       by the GeoCascade dropdown component.
// Not owned: cascade UI (GeoCascade.tsx), storage path composition
//            (storagePath.ts), uploads (adminAssetQueries.ts).
//
// Filters applied:
//   - destinations: kind = 'place' (excludes narrative + system rows)
//   - hotels:       is_active = true
// All ordered by sort_order then name/slug for stable display.
//
// Last updated: S33B

import { supabase } from '../lib/supabase'
import { camelizeKeys } from '@shared/camelize'
import type {
  GeoSubcontinent, GeoCountry, GeoState, GeoDestination, GeoHotel, HotelPick,
} from '../types/typesGeo'

async function invokeGeo<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-read-engagement-admin', { body })
  if (error) throw new Error(`geo read (${body.mode}): ${error.message}`)
  return camelizeKeys<T>(data?.rows ?? [])
}
// ── Types moved to typesGeo.ts ────────────────────────────────────────────────


// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchSubcontinents(): Promise<GeoSubcontinent[]> {
  return invokeGeo<GeoSubcontinent[]>({ mode: 'geo_subcontinents' })
}

export async function fetchCountriesBySubcontinent(subcontinentId: string): Promise<GeoCountry[]> {
  return invokeGeo<GeoCountry[]>({ mode: 'geo_countries', subcontinent_id: subcontinentId })
}

export async function fetchStatesByCountry(countryId: string): Promise<GeoState[]> {
  return invokeGeo<GeoState[]>({ mode: 'geo_states', country_id: countryId })
}

/**
 * Destinations filtered by parent FK. Pass exactly one of stateId / countryId
 * / subcontinentId - the most-specific available. kind='place' filter excludes
 * narrative + system rows.
 */
export async function fetchDestinations(filter: {
  stateId?:        string
  countryId?:      string
  subcontinentId?: string
}): Promise<GeoDestination[]> {
  return invokeGeo<GeoDestination[]>({
    mode: 'geo_destinations',
    state_id: filter.stateId ?? null,
    country_id: filter.countryId ?? null,
    subcontinent_id: filter.subcontinentId ?? null,
  })
}

export async function fetchHotelsByDestination(destinationId: string): Promise<GeoHotel[]> {
  return invokeGeo<GeoHotel[]>({ mode: 'geo_hotels_by_destination', destination_id: destinationId })
}

export async function fetchHotels(search?: string): Promise<HotelPick[]> {
  return invokeGeo<HotelPick[]>({ mode: 'geo_hotels_search', search: search ?? '' })
}