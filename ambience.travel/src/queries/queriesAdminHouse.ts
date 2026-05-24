// adminHouseQueries.ts — read + write paths for ambience.HOUSE CRM
//
// What it owns:
//   - Household list + detail reads (a_houses)
//   - People reads/writes (a_house_people)
//   - Preferences CRUD (a_house_preferences)
//   - Dining history CRUD (a_house_dininghistory)
//   - Destinations CRUD (a_house_destinations)
//   - Contacts CRUD (a_house_contacts)
//   - PPD reads via Edge Function a-get-ppd (NOT direct table reads)
//   - PPD writes via Edge Function a-write-ppd (NOT direct table writes)
//   - Profile link read (global_profiles.person_id)
//
// PPD security model:
//   a_ppd_people and a_ppd_contacts have no direct client read or write policy.
//   All operations go through Edge Functions which verify admin status
//   server-side using the service role key, validate data_key against the
//   canonical PPD registries, and log every write with actor + action + id.
//
// Last updated: S52 \u2014 PPD writes migrated to a-write-ppd Edge Function.
//   The 4 direct .from('a_ppd_*') writes (createPPDPeopleEntry, deletePPDPeopleEntry,
//   createPPDContactEntry, deletePPDContactEntry) replaced with a single
//   writePpd() helper. Closes the highest-priority gap in the Client Data
//   Edge Function Plan \u2014 PPD writes were previously RLS-only.
// Prior: S40D \u2014 added destinations, contacts, a_ppd_* tables,
//   Edge Function caller for PPD reads.

import { supabase } from '../lib/supabase'
import type { PpdPeopleKey, PpdContactKey } from '../types/typesPpd'

// ── Types ────────────────────────────────────────────────────────────────────

export type HouseStatus      = 'active' | 'inactive' | 'archived'
export type HouseDesignation = 'HRH' | 'HH' | 'VVIP' | null
export type HouseRole        = 'principal' | 'spouse' | 'child' | 'staff' | 'advisor' | string
export type PrefConfidence   = 'confirmed' | 'to_confirm' | 'outdated'
export type DiningStatus     = 'favorite' | 'visited' | 'avoid' | 'to_try'
export type DestinationStatus = 'visited' | 'planned' | 'avoided'
export type DestinationTripType = 'family' | 'couple' | 'solo' | 'business' | 'other'
export type ContactType      = 'pa' | 'driver' | 'fixer' | 'medical' | 'security' | 'concierge' | 'other'

// Back-compat alias \u2014 PpdContactKey is now canonical, lives in typesPpd.ts
export type PPDContactKey = PpdContactKey

export type PrefCategory =
  | 'Dining' | 'Accommodation' | 'Experiences' | 'Flight'
  | 'Beverage' | 'Allergies' | 'Service' | 'Misc'
  | string

export interface House {
  id:                   string
  a_house_id:           string
  display_name:         string
  designation:          HouseDesignation
  status:               HouseStatus
  summary:              string | null
  service_style_notes:  string | null
  travel_style_notes:   string | null
  avoid_notes:          string | null
  service_notes:        string | null
  missing_info_notes:   string | null
  created_at:           string
  updated_at:           string
}

export interface HousePerson {
  id:         string
  house_id:   string
  member_ref: string
  role:       HouseRole
  notes:      string | null
  created_at: string
  updated_at: string
}

export interface HousePreference {
  id:          string
  house_id:    string
  person_id:   string | null
  category:    PrefCategory
  pref_key:    string
  pref_value:  string
  notes:       string | null
  source:      string
  confidence:  PrefConfidence
  created_at:  string
  updated_at:  string
}

export interface HouseDiningEntry {
  id:              string
  house_id:        string
  restaurant_name: string
  city:            string | null
  country:         string | null
  status:          DiningStatus
  visit_date:      string | null
  trip_ref:        string | null
  venue_id:        string | null
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface HouseDestination {
  id:               string
  house_id:         string
  destination_name: string
  country:          string | null
  city:             string | null
  trip_type:        DestinationTripType | null
  status:           DestinationStatus
  visit_date:       string | null
  trip_ref:         string | null
  notes:            string | null
  created_at:       string
  updated_at:       string
}

export interface HouseContact {
  id:           string
  house_id:     string
  person_id:    string | null
  contact_type: ContactType
  name:         string
  role:         string | null
  company:      string | null
  is_primary:   boolean
  notes:        string | null
  created_at:   string
  updated_at:   string
}

// PPD types \u2014 returned by Edge Functions
export interface PPDPeopleEntry {
  id:          string
  house_id:    string
  person_id:   string | null
  data_key:    string
  data_value:  string
  access_note: string | null
  created_at:  string
  updated_at:  string
}

export interface PPDContactEntry {
  id:          string
  house_id:    string
  contact_id:  string
  data_key:    PpdContactKey
  data_value:  string
  access_note: string | null
  created_at:  string
  updated_at:  string
}

export interface PPDResponse {
  people:   PPDPeopleEntry[]
  contacts: PPDContactEntry[]
}

export interface HousePersonProfile {
  id:           string
  display_name: string | null
}

export type HousePatch = Partial<Omit<House, 'id' | 'a_house_id' | 'created_at' | 'updated_at'>>

// ── House reads/writes ────────────────────────────────────────────────────────

export async function fetchHouses(): Promise<House[]> {
  const { data, error } = await supabase
    .from('a_houses').select('*').order('display_name', { ascending: true })
  if (error) throw new Error(`Failed to fetch houses: ${error.message}`)
  return (data ?? []) as House[]
}

export async function fetchHouseById(id: string): Promise<House | null> {
  const { data, error } = await supabase
    .from('a_houses').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`Failed to fetch house: ${error.message}`)
  return data as House | null
}

export async function fetchHouseByHouseId(aHouseId: string): Promise<House | null> {
  const { data, error } = await supabase
    .from('a_houses').select('*').eq('a_house_id', aHouseId).maybeSingle()
  if (error) throw new Error(`Failed to fetch house: ${error.message}`)
  return data as House | null
}

export async function updateHouse(id: string, patch: HousePatch): Promise<void> {
  const { error } = await supabase.from('a_houses').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update house: ${error.message}`)
}

// ── People reads/writes ───────────────────────────────────────────────────────

export async function fetchPeopleForHouse(houseId: string): Promise<HousePerson[]> {
  const { data, error } = await supabase
    .from('a_house_people').select('*').eq('house_id', houseId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to fetch people: ${error.message}`)
  return (data ?? []) as HousePerson[]
}

export async function createPerson(houseId: string, memberRef: string, role: string, notes: string | null): Promise<void> {
  const { error } = await supabase
    .from('a_house_people').insert({ house_id: houseId, member_ref: memberRef, role, notes })
  if (error) throw new Error(`Failed to create person: ${error.message}`)
}

export async function updatePerson(id: string, patch: Partial<Pick<HousePerson, 'member_ref' | 'role' | 'notes'>>): Promise<void> {
  const { error } = await supabase.from('a_house_people').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update person: ${error.message}`)
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from('a_house_people').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete person: ${error.message}`)
}

export async function fetchProfileForPerson(personId: string): Promise<HousePersonProfile | null> {
  const { data, error } = await supabase
    .from('global_profiles').select('id, display_name')
    .eq('person_id', personId).maybeSingle()
  if (error) throw new Error(`Failed to fetch profile: ${error.message}`)
  return data as HousePersonProfile | null
}

// ── Preferences reads/writes ──────────────────────────────────────────────────

export async function fetchPreferencesForHouse(houseId: string): Promise<HousePreference[]> {
  const { data, error } = await supabase
    .from('a_house_preferences').select('*').eq('house_id', houseId)
    .order('category', { ascending: true }).order('pref_key', { ascending: true })
  if (error) throw new Error(`Failed to fetch preferences: ${error.message}`)
  return (data ?? []) as HousePreference[]
}

export async function createPreference(
  houseId: string, personId: string | null, category: string,
  prefKey: string, prefValue: string, notes: string | null,
  source: string, confidence: PrefConfidence,
): Promise<void> {
  const { error } = await supabase.from('a_house_preferences').insert({
    house_id: houseId, person_id: personId, category, pref_key: prefKey,
    pref_value: prefValue, notes, source, confidence,
  })
  if (error) throw new Error(`Failed to create preference: ${error.message}`)
}

export async function updatePreference(id: string, patch: Partial<Pick<HousePreference,
  'pref_key' | 'pref_value' | 'notes' | 'source' | 'confidence' | 'category' | 'person_id'
>>): Promise<void> {
  const { error } = await supabase.from('a_house_preferences').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update preference: ${error.message}`)
}

export async function deletePreference(id: string): Promise<void> {
  const { error } = await supabase.from('a_house_preferences').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete preference: ${error.message}`)
}

// ── Dining history reads/writes ───────────────────────────────────────────────

export async function fetchDiningHistoryForHouse(houseId: string): Promise<HouseDiningEntry[]> {
  const { data, error } = await supabase
    .from('a_house_dininghistory').select('*').eq('house_id', houseId)
    .order('status', { ascending: true }).order('restaurant_name', { ascending: true })
  if (error) throw new Error(`Failed to fetch dining history: ${error.message}`)
  return (data ?? []) as HouseDiningEntry[]
}

export async function createDiningEntry(
  houseId: string, restaurantName: string, city: string | null, country: string | null,
  status: DiningStatus, visitDate: string | null, tripRef: string | null,
  venueId: string | null, notes: string | null,
): Promise<void> {
  const { error } = await supabase.from('a_house_dininghistory').insert({
    house_id: houseId, restaurant_name: restaurantName, city, country,
    status, visit_date: visitDate, trip_ref: tripRef, venue_id: venueId, notes,
  })
  if (error) throw new Error(`Failed to create dining entry: ${error.message}`)
}

export async function updateDiningEntry(id: string, patch: Partial<Omit<HouseDiningEntry, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('a_house_dininghistory').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update dining entry: ${error.message}`)
}

export async function deleteDiningEntry(id: string): Promise<void> {
  const { error } = await supabase.from('a_house_dininghistory').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete dining entry: ${error.message}`)
}

// ── Destinations reads/writes ─────────────────────────────────────────────────

export async function fetchDestinationsForHouse(houseId: string): Promise<HouseDestination[]> {
  const { data, error } = await supabase
    .from('a_house_destinations').select('*').eq('house_id', houseId)
    .order('status', { ascending: true })
    .order('destination_name', { ascending: true })
  if (error) throw new Error(`Failed to fetch destinations: ${error.message}`)
  return (data ?? []) as HouseDestination[]
}

export async function createDestination(
  houseId: string, destinationName: string, country: string | null,
  city: string | null, tripType: DestinationTripType | null,
  status: DestinationStatus, visitDate: string | null,
  tripRef: string | null, notes: string | null,
): Promise<void> {
  const { error } = await supabase.from('a_house_destinations').insert({
    house_id: houseId, destination_name: destinationName, country, city,
    trip_type: tripType, status, visit_date: visitDate, trip_ref: tripRef, notes,
  })
  if (error) throw new Error(`Failed to create destination: ${error.message}`)
}

export async function updateDestination(id: string, patch: Partial<Omit<HouseDestination, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('a_house_destinations').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update destination: ${error.message}`)
}

export async function deleteDestination(id: string): Promise<void> {
  const { error } = await supabase.from('a_house_destinations').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete destination: ${error.message}`)
}

// ── Contacts reads/writes ─────────────────────────────────────────────────────

export async function fetchContactsForHouse(houseId: string): Promise<HouseContact[]> {
  const { data, error } = await supabase
    .from('a_house_contacts').select('*').eq('house_id', houseId)
    .order('is_primary', { ascending: false })
    .order('contact_type', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
  return (data ?? []) as HouseContact[]
}

export async function createContact(
  houseId: string, contactType: ContactType, name: string,
  role: string | null, company: string | null,
  isPrimary: boolean, notes: string | null, personId: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('a_house_contacts')
    .insert({
      house_id: houseId, contact_type: contactType, name, role,
      company, is_primary: isPrimary, notes, person_id: personId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create contact: ${error.message}`)
  return data.id
}

export async function updateContact(id: string, patch: Partial<Omit<HouseContact, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('a_house_contacts').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update contact: ${error.message}`)
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('a_house_contacts').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete contact: ${error.message}`)
}

// ── PPD reads \u2014 via a-get-ppd Edge Function ──────────────────────────────────

/**
 * Fetches both a_ppd_people and a_ppd_contacts for a house.
 * Passes the caller's JWT to the Edge Function for admin verification.
 * Optional person_id or contact_id to scope the response.
 */
export async function fetchPPDForHouse(
  houseId: string,
  opts: { personId?: string; contactId?: string } = {},
): Promise<PPDResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No active session')

  const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
    ?? import.meta.env.VITE_SUPABASE_URL

  const res = await fetch(`${supabaseUrl}/functions/v1/a-get-ppd`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      house_id:   houseId,
      person_id:  opts.personId,
      contact_id: opts.contactId,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`a-get-ppd failed: ${err.error ?? res.statusText}`)
  }

  return res.json() as Promise<PPDResponse>
}

// ── PPD writes \u2014 via a-write-ppd Edge Function ─────────────────────────────

/**
 * Single dispatcher for all PPD writes. Replaces the 4 direct table-write
 * helpers (createPPDPeopleEntry, deletePPDPeopleEntry, createPPDContactEntry,
 * deletePPDContactEntry). The Edge Function verifies admin, validates
 * data_key against canonical PPD registries, and logs every write.
 *
 * Returns inserted row on insert, void on delete.
 */
type WritePpdBody =
  | { action: 'insert'; table: 'people';   payload: { house_id: string; person_id: string | null; data_key: string;       data_value: string; access_note: string | null } }
  | { action: 'insert'; table: 'contacts'; payload: { house_id: string; contact_id:  string;      data_key: PpdContactKey; data_value: string; access_note: string | null } }
  | { action: 'delete'; table: 'people'   | 'contacts'; payload: { id: string } }

async function writePpd<T extends WritePpdBody>(body: T): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No active session')

  const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
    ?? import.meta.env.VITE_SUPABASE_URL

  const res = await fetch(`${supabaseUrl}/functions/v1/a-write-ppd`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`a-write-ppd failed: ${err.error ?? res.statusText}`)
  }

  return res.json()
}

// ── PPD write helpers \u2014 same signatures as before, now Edge-Function-backed ──
// Existing callers in HouseTab.tsx work without changes.

export async function createPPDPeopleEntry(
  houseId: string, personId: string | null,
  dataKey: string, dataValue: string, accessNote: string | null,
): Promise<void> {
  await writePpd({
    action:  'insert',
    table:   'people',
    payload: {
      house_id:    houseId,
      person_id:   personId,
      data_key:    dataKey,
      data_value:  dataValue,
      access_note: accessNote,
    },
  })
}

export async function deletePPDPeopleEntry(id: string): Promise<void> {
  await writePpd({
    action:  'delete',
    table:   'people',
    payload: { id },
  })
}

export async function createPPDContactEntry(
  houseId: string, contactId: string,
  dataKey: PpdContactKey, dataValue: string, accessNote: string | null,
): Promise<void> {
  await writePpd({
    action:  'insert',
    table:   'contacts',
    payload: {
      house_id:    houseId,
      contact_id:  contactId,
      data_key:    dataKey,
      data_value:  dataValue,
      access_note: accessNote,
    },
  })
}

export async function deletePPDContactEntry(id: string): Promise<void> {
  await writePpd({
    action:  'delete',
    table:   'contacts',
    payload: { id },
  })
}