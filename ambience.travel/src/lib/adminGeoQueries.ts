// adminGeoQueries.ts — Supabase reads for admin geography cascade
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

import { supabase } from './supabase'

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
  country_id: string
}

export type GeoDestination = {
  id:               string
  slug:             string
  name:             string
  subcontinent_id:  string | null
  country_id:       string | null
  state_id:         string | null
  storage_path:     string | null   // s33b_03 column
}

export type GeoHotel = {
  id:             string
  slug:           string
  short_slug:     string
  name:           string
  destination_id: string | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function fetchSubcontinents(): Promise<GeoSubcontinent[]> {
  const { data, error } = await supabase
    .from('global_subcontinents')
    .select('id, slug, name')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as GeoSubcontinent[]
}

export async function fetchCountriesBySubcontinent(subcontinentId: string): Promise<GeoCountry[]> {
  const { data, error } = await supabase
    .from('global_countries')
    .select('id, slug, name, subcontinent_id')
    .eq('subcontinent_id', subcontinentId)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
  if (error) throw error
  return (data ?? []) as GeoCountry[]
}

export async function fetchStatesByCountry(countryId: string): Promise<GeoState[]> {
  const { data, error } = await supabase
    .from('global_states')
    .select('id, slug, name, code, country_id')
    .eq('country_id', countryId)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
  if (error) throw error
  return (data ?? []) as GeoState[]
}

/**
 * Destinations filtered by parent FK. Pass exactly one of stateId / countryId
 * / subcontinentId — the most-specific available. kind='place' filter excludes
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
  return (data ?? []) as GeoDestination[]
}

export async function fetchHotelsByDestination(destinationId: string): Promise<GeoHotel[]> {
  const { data, error } = await supabase
    .from('travel_accom_hotels')
    .select('id, slug, short_slug, name, destination_id')
    .eq('destination_id', destinationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true })
  if (error) throw error
  return (data ?? []) as GeoHotel[]
}