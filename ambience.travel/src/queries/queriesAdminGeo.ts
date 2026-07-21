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

// ── Types ─────────────────────────────────────────────────────────────────────

export type GeoSubcontinent = {
  id:   string
  slug: string
  name: string
}

export type GeoCountry = {
  id:               string
  slug:             string
  name:             string
  subcontinent_id:  string
}

export type GeoState = {
  id:         string
  slug:       string
  name:       string
  code:       string
  countryId: string
}

export type GeoDestination = {
  id:               string
  slug:             string
  name:             string
  subcontinent_id:  string | null
  countryId:       string | null
  state_id:         string | null
  storagePath:     string | null   // s33b_03 column
}

export type GeoHotel = {
  id:             string
  short_slug:     string
  name:           string
  destinationId: string | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchSubcontinents(): Promise<GeoSubcontinent[]> {
  const { data, error } = await supabase
    .from('global_subcontinents')
    .select('id, slug, name')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return camelizeKeys<GeoSubcontinent[]>(data ?? [])
}

export async function fetchCountriesBySubcontinent(subcontinentId: string): Promise<GeoCountry[]> {
  const { data, error } = await supabase
    .from('global_countries')
    .select('id, slug, name, subcontinent_id')
    .eq('subcontinent_id', subcontinentId)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
  if (error) throw error
  return camelizeKeys<GeoCountry[]>(data ?? [])
}

export async function fetchStatesByCountry(countryId: string): Promise<GeoState[]> {
  const { data, error } = await supabase
    .from('global_states')
    .select('id, slug, name, code, country_id')
    .eq('country_id', countryId)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
  if (error) throw error
  return camelizeKeys<GeoState[]>(data ?? [])
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
  let q = supabase
    .from('global_destinations')
    .select('id, slug, name, subcontinent_id, country_id, state_id, storage_path')
    .eq('kind', 'place')
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })

  if (filter.stateId) {
    q = q.eq('state_id', filter.stateId)
  }
  if (!filter.stateId && filter.countryId) {
    q = q.eq('country_id', filter.countryId).is('state_id', null)
  }
  if (!filter.stateId && !filter.countryId && filter.subcontinentId) {
    q = q.eq('subcontinent_id', filter.subcontinentId).is('country_id', null)
  }

  const { data, error } = await q
  if (error) throw error
  return camelizeKeys<GeoDestination[]>(data ?? [])
}

export async function fetchHotelsByDestination(destinationId: string): Promise<GeoHotel[]> {
  const { data, error } = await supabase
    .from('travel_accom_hotels')
    .select('id, short_slug, name, destination_id')
    .eq('destination_id', destinationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
  if (error) throw error
  return camelizeKeys<GeoHotel[]>(data ?? [])
}

// Global hotel search for the booking-create picker. Catalog data (the public
// hotel library), read directly - consistent with queriesGuidesHotels and the
// other direct travel_accom_hotels reads. Not client-private, so no EF needed.
export type HotelPick = { id: string; name: string; city: string | null }

export async function fetchHotels(search?: string): Promise<HotelPick[]> {
  let q = supabase
    .from('travel_accom_hotels')
    .select('id, name, city')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(50)
  if (search && search.trim()) {
    q = q.ilike('name', `%${search.trim()}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return camelizeKeys<HotelPick[]>(data ?? [])
}