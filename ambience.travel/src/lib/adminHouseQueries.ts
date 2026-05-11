// adminHouseQueries.ts — read + write paths for ambience.HOUSE CRM
//
// What it owns:
//   - Household list + detail reads (a_houses)
//   - People reads/writes (a_house_people)
//   - Preferences CRUD (a_house_preferences) — grouped by category
//   - Dining history CRUD (a_house_dininghistory)
//   - Sensitive/PPD CRUD (a_house_people_ppd) — admin write, admin read only
//
// Keys: a_house_id is the human-readable key (HRAE, HC etc).
//   All FK joins use UUID id columns.
//
// Last updated: S40D — initial ship.

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type HouseStatus = 'active' | 'inactive' | 'archived'

export type HouseDesignation = 'HRH' | 'HH' | 'VVIP' | null

export interface House {
  id:                   string   // uuid PK
  a_house_id:           string   // human-readable e.g. HRAE
  display_name:         string
  designation:          HouseDesignation
  status:               HouseStatus
  service_style_notes:  string | null
  travel_style_notes:   string | null
  avoid_notes:          string | null
  service_notes:        string | null
  missing_info_notes:   string | null
  created_at:           string
  updated_at:           string
}

export type HouseRole = 'principal' | 'spouse' | 'child' | 'staff' | 'advisor' | string

export interface HousePerson {
  id:         string
  house_id:   string
  member_ref: string   // code reference e.g. J, K, Child 1
  role:       HouseRole
  notes:      string | null
  created_at: string
  updated_at: string
}

export type PrefCategory = 'Dietary' | 'Travel' | 'Service' | 'Beverage' | string
export type PrefConfidence = 'confirmed' | 'to_confirm' | 'outdated'

export interface HousePreference {
  id:          string
  house_id:    string
  person_id:   string | null   // null = household-level preference
  category:    PrefCategory
  pref_key:    string
  pref_value:  string
  notes:       string | null
  source:      string          // e.g. 'trip:YAZ-2027-HM', 'manual', 'observation'
  confidence:  PrefConfidence
  created_at:  string
  updated_at:  string
}

export type DiningStatus = 'favorite' | 'visited' | 'avoid' | 'to_try'

export interface HouseDiningEntry {
  id:              string
  house_id:        string
  restaurant_name: string
  city:            string | null
  country:         string | null
  status:          DiningStatus
  visit_date:      string | null   // date ISO
  trip_ref:        string | null   // e.g. YAZ-2027-HM
  venue_id:        string | null   // FK to travel_dining_venues (optional)
  notes:           string | null
  created_at:      string
  updated_at:      string
}

// PPD — sensitive personal data for booking (passport, DOB, contacts etc)
// Standard keys: 'DOB', 'Passport Number', 'Passport Expiry', 'Passport Country',
//   'Nationality', 'Mobile', 'Emergency Contact', 'Dietary Medical', 'Seat Preference',
//   'Frequent Flyer', 'Known Traveller Number', 'Hotel Loyalty', 'Visa Notes'
export interface HousePPDEntry {
  id:          string
  house_id:    string
  person_id:   string | null
  data_key:    string
  data_value:  string
  access_note: string | null
  created_at:  string
  updated_at:  string
}

export type HousePatch = Partial<Omit<House, 'id' | 'a_house_id' | 'created_at' | 'updated_at'>>

// ── House reads ──────────────────────────────────────────────────────────────

export async function fetchHouses(): Promise<House[]> {
  const { data, error } = await supabase
    .from('a_houses')
    .select('*')
    .order('display_name', { ascending: true })

  if (error) throw new Error(`Failed to fetch houses: ${error.message}`)
  return (data ?? []) as House[]
}

export async function fetchHouseById(id: string): Promise<House | null> {
  const { data, error } = await supabase
    .from('a_houses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch house: ${error.message}`)
  return data as House | null
}

export async function fetchHouseByHouseId(aHouseId: string): Promise<House | null> {
  const { data, error } = await supabase
    .from('a_houses')
    .select('*')
    .eq('a_house_id', aHouseId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch house: ${error.message}`)
  return data as House | null
}

export async function updateHouse(id: string, patch: HousePatch): Promise<void> {
  const { error } = await supabase
    .from('a_houses')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update house: ${error.message}`)
}

// ── People reads/writes ──────────────────────────────────────────────────────

export async function fetchPeopleForHouse(houseId: string): Promise<HousePerson[]> {
  const { data, error } = await supabase
    .from('a_house_people')
    .select('*')
    .eq('house_id', houseId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch people: ${error.message}`)
  return (data ?? []) as HousePerson[]
}

export async function createPerson(houseId: string, memberRef: string, role: string, notes: string | null): Promise<void> {
  const { error } = await supabase
    .from('a_house_people')
    .insert({ house_id: houseId, member_ref: memberRef, role, notes })
  if (error) throw new Error(`Failed to create person: ${error.message}`)
}

export async function updatePerson(id: string, patch: Partial<Pick<HousePerson, 'member_ref' | 'role' | 'notes'>>): Promise<void> {
  const { error } = await supabase
    .from('a_house_people')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update person: ${error.message}`)
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase
    .from('a_house_people')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete person: ${error.message}`)
}

// ── Preferences reads/writes ─────────────────────────────────────────────────

export async function fetchPreferencesForHouse(houseId: string): Promise<HousePreference[]> {
  const { data, error } = await supabase
    .from('a_house_preferences')
    .select('*')
    .eq('house_id', houseId)
    .order('category', { ascending: true })
    .order('pref_key', { ascending: true })

  if (error) throw new Error(`Failed to fetch preferences: ${error.message}`)
  return (data ?? []) as HousePreference[]
}

export async function createPreference(
  houseId:   string,
  personId:  string | null,
  category:  string,
  prefKey:   string,
  prefValue: string,
  notes:     string | null,
  source:    string,
  confidence: PrefConfidence,
): Promise<void> {
  const { error } = await supabase
    .from('a_house_preferences')
    .insert({ house_id: houseId, person_id: personId, category, pref_key: prefKey, pref_value: prefValue, notes, source, confidence })
  if (error) throw new Error(`Failed to create preference: ${error.message}`)
}

export async function updatePreference(id: string, patch: Partial<Pick<HousePreference, 'pref_key' | 'pref_value' | 'notes' | 'source' | 'confidence' | 'category' | 'person_id'>>): Promise<void> {
  const { error } = await supabase
    .from('a_house_preferences')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update preference: ${error.message}`)
}

export async function deletePreference(id: string): Promise<void> {
  const { error } = await supabase
    .from('a_house_preferences')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete preference: ${error.message}`)
}

// ── Dining history reads/writes ──────────────────────────────────────────────

export async function fetchDiningHistoryForHouse(houseId: string): Promise<HouseDiningEntry[]> {
  const { data, error } = await supabase
    .from('a_house_dininghistory')
    .select('*')
    .eq('house_id', houseId)
    .order('status', { ascending: true })
    .order('restaurant_name', { ascending: true })

  if (error) throw new Error(`Failed to fetch dining history: ${error.message}`)
  return (data ?? []) as HouseDiningEntry[]
}

export async function createDiningEntry(
  houseId:        string,
  restaurantName: string,
  city:           string | null,
  country:        string | null,
  status:         DiningStatus,
  visitDate:      string | null,
  tripRef:        string | null,
  venueId:        string | null,
  notes:          string | null,
): Promise<void> {
  const { error } = await supabase
    .from('a_house_dininghistory')
    .insert({ house_id: houseId, restaurant_name: restaurantName, city, country, status, visit_date: visitDate, trip_ref: tripRef, venue_id: venueId, notes })
  if (error) throw new Error(`Failed to create dining entry: ${error.message}`)
}

export async function updateDiningEntry(id: string, patch: Partial<Omit<HouseDiningEntry, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase
    .from('a_house_dininghistory')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update dining entry: ${error.message}`)
}

export async function deleteDiningEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('a_house_dininghistory')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete dining entry: ${error.message}`)
}

// ── PPD reads/writes (sensitive) ─────────────────────────────────────────────

export async function fetchPPDForHouse(houseId: string): Promise<HousePPDEntry[]> {
  const { data, error } = await supabase
    .from('a_house_people_ppd')
    .select('*')
    .eq('house_id', houseId)
    .order('person_id', { ascending: true })
    .order('data_key', { ascending: true })

  if (error) throw new Error(`Failed to fetch PPD: ${error.message}`)
  return (data ?? []) as HousePPDEntry[]
}

export async function createPPDEntry(
  houseId:    string,
  personId:   string | null,
  dataKey:    string,
  dataValue:  string,
  accessNote: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('a_house_people_ppd')
    .insert({ house_id: houseId, person_id: personId, data_key: dataKey, data_value: dataValue, access_note: accessNote })
  if (error) throw new Error(`Failed to create PPD entry: ${error.message}`)
}

export async function updatePPDEntry(id: string, patch: Partial<Pick<HousePPDEntry, 'data_key' | 'data_value' | 'access_note' | 'person_id'>>): Promise<void> {
  const { error } = await supabase
    .from('a_house_people_ppd')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Failed to update PPD entry: ${error.message}`)
}

export async function deletePPDEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('a_house_people_ppd')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`Failed to delete PPD entry: ${error.message}`)
}