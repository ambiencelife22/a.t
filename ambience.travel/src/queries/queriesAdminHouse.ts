// adminHouseQueries.ts - read + write paths for ambience.HOUSE CRM
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
//   - Profile link read (global_profiles.personId)
//
// PPD security model:
//   a_ppd_people and a_ppd_contacts have no direct client read or write policy.
//   All operations go through Edge Functions which verify admin status
//   server-side using the service role key, validate data_key against the
//   canonical PPD registries, and log every write with actor + action + id.
//
// Last updated: S52 - PPD writes migrated to a-write-ppd Edge Function.
//   The 4 direct .from('a_ppd_*') writes (createPPDPeopleEntry, deletePPDPeopleEntry,
//   createPPDContactEntry, deletePPDContactEntry) replaced with a single
//   writePpd() helper. Closes the highest-priority gap in the Client Data
//   Edge Function Plan - PPD writes were previously RLS-only.
// Prior: S40D - added destinations, contacts, a_ppd_* tables,
//   Edge Function caller for PPD reads.

import { supabase } from '../lib/supabase'
import { camelizeKeys, snakeizeKeys } from '@shared/camelize'
import type { PpdPeopleKey, PpdContactKey } from '../types/typesPpd'

// ── Types ────────────────────────────────────────────────────────────────────

export type HouseStatus      = 'active' | 'inactive' | 'archived'
export type HouseDesignation = 'HRH' | 'HH' | 'VVIP' | null
export type HouseRole        = string
export type PrefConfidence   = 'confirmed' | 'to_confirm' | 'outdated'
export type DiningStatus     = 'favorite' | 'visited' | 'avoid' | 'to_try'
export type DestinationStatus = 'visited' | 'planned' | 'avoided'
export type DestinationTripType = 'family' | 'couple' | 'solo' | 'business' | 'other'
export type ContactType      = 'pa' | 'driver' | 'fixer' | 'medical' | 'security' | 'concierge' | 'other'

// Back-compat alias - PpdContactKey is now canonical, lives in typesPpd.ts
export type PPDContactKey = PpdContactKey

export type PrefCategory =
  | 'Dining' | 'Accommodation' | 'Experiences' | 'Flight'
  | 'Beverage' | 'Allergies' | 'Service' | 'Misc'
  | string

export interface House {
  id:                   string
  aHouseId:           string
  displayName:         string
  designation:          HouseDesignation
  status:               HouseStatus
  summary:              string | null
  serviceStyleNotes:  string | null
  travelStyleNotes:   string | null
  avoidNotes:          string | null
  serviceNotes:        string | null
  missingInfoNotes:   string | null
  salutationRule:      string | null
  briefLanguage:       string | null
  publicName:          string | null
  createdAt:           string
  updatedAt:           string
}

export interface HousePerson {
  id:         string
  houseId:   string
  personId:  string | null
  memberRef: string
  role:       HouseRole
  notes:      string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface HousePreference {
  id:          string
  houseId:    string
  personId:   string | null
  category:    PrefCategory
  prefKey:    string
  prefValue:  string
  notes:       string | null
  source:      string
  confidence:  PrefConfidence
  createdAt:  string
  updatedAt:  string
}

export type HouseLabelKey = 'family' | 'principal' | 'delegation' | 'couple' | 'staff'

export interface HouseLabel {
  id:           string
  houseId:     string
  key:          HouseLabelKey
  displayName: string
  isDefault:   boolean
  sortOrder:   number
  createdAt:   string
  updatedAt:   string
}

export interface HouseDiningEntry {
  id:              string
  houseId:        string
  restaurant_name: string
  city:            string | null
  country:         string | null
  status:          DiningStatus
  visitDate:      string | null
  journeyId:      string | null
  venue_id:        string | null
  notes:           string | null
  createdAt:      string
  updatedAt:      string
}

export interface HouseDestination {
  id:               string
  houseId:         string
  destinationName: string
  country:          string | null
  city:             string | null
  tripType:        DestinationTripType | null
  status:           DestinationStatus
  visitDate:       string | null
  journeyId:       string | null
  notes:            string | null
  createdAt:       string
  updatedAt:       string
}

export interface HouseContact {
  id:           string
  houseId:     string
  personId:    string | null
  contactType: ContactType
  name:         string
  role:         string | null
  company:      string | null
  isPrimary:   boolean
  notes:        string | null
  createdAt:   string
  updatedAt:   string
}

// PPD types - returned by Edge Functions
export interface PPDPeopleEntry {
  id:          string
  houseId:    string
  personId:   string | null
  dataKey:    string
  dataValue:  string
  accessNote: string | null
  createdAt:  string
  updatedAt:  string
}

export interface PPDContactEntry {
  id:          string
  houseId:    string
  contactId:  string
  dataKey:    PpdContactKey
  dataValue:  string
  accessNote: string | null
  createdAt:  string
  updatedAt:  string
}

export interface PPDResponse {
  people:   PPDPeopleEntry[]
  contacts: PPDContactEntry[]
}

export interface HousePersonProfile {
  id:           string
  displayName: string | null
}

export type HousePatch = Partial<Omit<House, 'id' | 'aHouseId' | 'createdAt' | 'updatedAt'>>

// ── House reads/writes ────────────────────────────────────────────────────────

export async function fetchHouses(): Promise<House[]> {
  const { data, error } = await supabase
    .from('a_houses').select('id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, public_name, created_at, updated_at').order('display_name', { ascending: true })
  if (error) throw new Error(`Failed to fetch houses: ${error.message}`)
  return camelizeKeys<House[]>(data ?? [])
}

export async function fetchHouseById(id: string): Promise<House | null> {
  const { data, error } = await supabase
    .from('a_houses').select('id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, public_name, created_at, updated_at').eq('id', id).maybeSingle()
  if (error) throw new Error(`Failed to fetch house: ${error.message}`)
  return data as House | null
}

export async function fetchHouseByHouseId(aHouseId: string): Promise<House | null> {
  const { data, error } = await supabase
    .from('a_houses').select('id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, public_name, created_at, updated_at').eq('a_house_id', aHouseId).maybeSingle()
  if (error) throw new Error(`Failed to fetch house: ${error.message}`)
  return data as House | null
}

export async function updateHouse(id: string, patch: HousePatch): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house', {
    body: { mode: 'update', id, ...snakeizeKeys<Record<string, unknown>>(patch) },
  })
  if (error) throw new Error(`Failed to update house: ${error.message}`)
}

// ── Roles registry ────────────────────────────────────────────────────────────

export interface HouseRole_Registry {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
  isActive:  boolean
}

export async function fetchHouseRoles(): Promise<HouseRole_Registry[]> {
  const { data, error } = await supabase.functions.invoke('a-read-house', {
    body: { mode: 'roles' },
  })
  if (error) throw new Error(`Failed to fetch house roles: ${error.message}`)
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return (data as { roles: HouseRole_Registry[] }).roles
}

// ── People reads/writes ───────────────────────────────────────────────────────

export async function fetchPeopleForHouse(houseId: string): Promise<HousePerson[]> {
  const { data, error } = await supabase
    .from('a_house_people').select('id, house_id, person_id, member_ref, role, notes, sort_order, created_at, updated_at').eq('house_id', houseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to fetch people: ${error.message}`)
  return camelizeKeys<HousePerson[]>(data ?? [])
}

// Household rank - the SINGLE SOURCE composition: role tier (from the roles registry
// sort_order) first, then per-member sort_order within the tier, created_at as the
// final stable tiebreak. Every member list renders through this so rank is identical
// everywhere. Unknown roles sort last.
export function orderHouseholdMembers(
  people: HousePerson[],
  roles: HouseRole_Registry[],
): HousePerson[] {
  const tierBySlug = new Map(roles.map(r => [r.slug, r.sortOrder]))
  const TIER_LAST = Number.MAX_SAFE_INTEGER
  return [...people].sort((a, b) => {
    const ta = tierBySlug.get(a.role) ?? TIER_LAST
    const tb = tierBySlug.get(b.role) ?? TIER_LAST
    if (ta !== tb) return ta - tb
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.createdAt < b.createdAt ? -1 : 1
  })
}

export async function createPerson(houseId: string, memberRef: string, role: string, notes: string | null, personId: string | null = null): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-people', {
    body: { mode: 'create', houseId: houseId, memberRef: memberRef, role, notes, personId: personId },
  })
  if (error) throw new Error(`Failed to create person: ${error.message}`)
}

export async function updatePerson(id: string, patch: Partial<Pick<HousePerson, 'memberRef' | 'role' | 'notes' | 'personId'>>): Promise<void> {
  const dbPatch: Record<string, unknown> = {}
  if ('memberRef' in patch) dbPatch.member_ref = patch.memberRef
  if ('role' in patch) dbPatch.role = patch.role
  if ('notes' in patch) dbPatch.notes = patch.notes
  if ('personId' in patch) dbPatch.person_id = patch.personId
  const { error } = await supabase.functions.invoke('a-write-house-people', {
    body: { mode: 'update', id, ...dbPatch },
  })
  if (error) throw new Error(`Failed to update person: ${error.message}`)
}

export async function reorderPeople(orderedIds: string[]): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-people', {
    body: { mode: 'reorder', ordered_ids: orderedIds },
  })
  if (error) throw new Error(`Failed to reorder people: ${error.message}`)
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-people', {
    body: { mode: 'delete', id },
  })
  if (error) throw new Error(`Failed to delete person: ${error.message}`)
}

// ── House public labels (a_house_public_labels) ──────────────────────────────
// The authored public-identity source for a house. Read direct (mirrors
// fetchPeopleForHouse); write via the a-write-house-labels EF (sibling of
// a-write-house-people). is_default flows ONLY through setDefaultLabel - the
// one-default-per-house partial unique index is enforced EF-side (clear-then-set).

export async function fetchLabelsForHouse(houseId: string): Promise<HouseLabel[]> {
  const { data, error } = await supabase
    .from('a_house_public_labels')
    .select('id, house_id, key, display_name, is_default, sort_order, created_at, updated_at')
    .eq('house_id', houseId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`Failed to fetch labels: ${error.message}`)
  return camelizeKeys<HouseLabel[]>(data ?? [])
}

export async function createLabel(houseId: string, key: HouseLabelKey, displayName: string, sortOrder = 0): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-labels', {
    body: { mode: 'create', houseId: houseId, key, displayName: displayName, sortOrder: sortOrder },
  })
  if (error) throw new Error(`Failed to create label: ${error.message}`)
}

export async function updateLabel(id: string, patch: Partial<Pick<HouseLabel, 'key' | 'displayName' | 'sortOrder'>>): Promise<void> {
  const dbPatch: Record<string, unknown> = {}
  if ('key' in patch) dbPatch.key = patch.key
  if ('displayName' in patch) dbPatch.display_name = patch.displayName
  if ('sortOrder' in patch) dbPatch.sort_order = patch.sortOrder
  const { error } = await supabase.functions.invoke('a-write-house-labels', {
    body: { mode: 'update', id, ...dbPatch },
  })
  if (error) throw new Error(`Failed to update label: ${error.message}`)
}

export async function setDefaultLabel(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-labels', {
    body: { mode: 'set_default', id },
  })
  if (error) throw new Error(`Failed to set default label: ${error.message}`)
}

export async function reorderLabels(orderedIds: string[]): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-labels', {
    body: { mode: 'reorder', ordered_ids: orderedIds },
  })
  if (error) throw new Error(`Failed to reorder labels: ${error.message}`)
}

export async function deleteLabel(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-labels', {
    body: { mode: 'delete', id },
  })
  if (error) throw new Error(`Failed to delete label: ${error.message}`)
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
    .from('a_house_preferences').select('id, house_id, person_id, category, pref_key, pref_value, notes, source, confidence, created_at, updated_at').eq('house_id', houseId)
    .order('category', { ascending: true }).order('pref_key', { ascending: true })
  if (error) throw new Error(`Failed to fetch preferences: ${error.message}`)
  return camelizeKeys<HousePreference[]>(data ?? [])
}

export async function createPreference(
  houseId: string, personId: string | null, category: string,
  prefKey: string, prefValue: string, notes: string | null,
  source: string, confidence: PrefConfidence,
): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: {
      mode: 'create', table: 'preferences',
      houseId: houseId, personId: personId, category, prefKey: prefKey,
      prefValue: prefValue, notes, source, confidence,
    },
  })
  if (error) throw new Error(`Failed to create preference: ${error.message}`)
}

export async function updatePreference(id: string, patch: Partial<Pick<HousePreference,
  'prefKey' | 'prefValue' | 'notes' | 'source' | 'confidence' | 'category' | 'personId'
>>): Promise<void> {
  const dbPatch: Record<string, unknown> = {}
  if ('prefKey' in patch) dbPatch.pref_key = patch.prefKey
  if ('prefValue' in patch) dbPatch.pref_value = patch.prefValue
  if ('notes' in patch) dbPatch.notes = patch.notes
  if ('source' in patch) dbPatch.source = patch.source
  if ('confidence' in patch) dbPatch.confidence = patch.confidence
  if ('category' in patch) dbPatch.category = patch.category
  if ('personId' in patch) dbPatch.person_id = patch.personId
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: { mode: 'update', table: 'preferences', id, ...dbPatch },
  })
  if (error) throw new Error(`Failed to update preference: ${error.message}`)
}

export async function deletePreference(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: { mode: 'delete', table: 'preferences', id },
  })
  if (error) throw new Error(`Failed to delete preference: ${error.message}`)
}

// ── Dining history reads/writes ───────────────────────────────────────────────

export async function fetchDiningHistoryForHouse(houseId: string): Promise<HouseDiningEntry[]> {
  const { data, error } = await supabase
    .from('a_house_dininghistory').select('id, house_id, restaurant_name, city, country, status, visit_date, journey_id, venue_id, notes, created_at, updated_at').eq('house_id', houseId)
    .order('status', { ascending: true }).order('restaurant_name', { ascending: true })
  if (error) throw new Error(`Failed to fetch dining history: ${error.message}`)
  return camelizeKeys<HouseDiningEntry[]>(data ?? [])
}

export async function createDiningEntry(
  houseId: string, restaurantName: string, city: string | null, country: string | null,
  status: DiningStatus, visitDate: string | null, journeyId: string | null,
  venueId: string | null, notes: string | null,
): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: {
      mode: 'create', table: 'dining',
      houseId: houseId, restaurant_name: restaurantName, city, country,
      status, visitDate: visitDate, journeyId: journeyId, venue_id: venueId, notes,
    },
  })
  if (error) throw new Error(`Failed to create dining entry: ${error.message}`)
}

export async function updateDiningEntry(id: string, patch: Partial<Omit<HouseDiningEntry, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: { mode: 'update', table: 'dining', id, ...patch },
  })
  if (error) throw new Error(`Failed to update dining entry: ${error.message}`)
}

export async function deleteDiningEntry(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: { mode: 'delete', table: 'dining', id },
  })
  if (error) throw new Error(`Failed to delete dining entry: ${error.message}`)
}

// ── Destinations reads/writes ─────────────────────────────────────────────────

export async function fetchDestinationsForHouse(houseId: string): Promise<HouseDestination[]> {
  const { data, error } = await supabase
    .from('a_house_destinations').select('id, house_id, destination_name, country, city, trip_type, status, visit_date, journey_id, notes, created_at, updated_at').eq('house_id', houseId)
    .order('status', { ascending: true })
    .order('destination_name', { ascending: true })
  if (error) throw new Error(`Failed to fetch destinations: ${error.message}`)
  return camelizeKeys<HouseDestination[]>(data ?? [])
}

export async function createDestination(
  houseId: string, destinationName: string, country: string | null,
  city: string | null, tripType: DestinationTripType | null,
  status: DestinationStatus, visitDate: string | null,
  journeyId: string | null, notes: string | null,
): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: {
      mode: 'create', table: 'destinations',
      houseId: houseId, destinationName: destinationName, country, city,
      tripType: tripType, status, visitDate: visitDate, journeyId: journeyId, notes,
    },
  })
  if (error) throw new Error(`Failed to create destination: ${error.message}`)
}

export async function updateDestination(id: string, patch: Partial<Omit<HouseDestination, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: { mode: 'update', table: 'destinations', id, ...patch },
  })
  if (error) throw new Error(`Failed to update destination: ${error.message}`)
}

export async function deleteDestination(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-records', {
    body: { mode: 'delete', table: 'destinations', id },
  })
  if (error) throw new Error(`Failed to delete destination: ${error.message}`)
}

// ── Contacts reads/writes ─────────────────────────────────────────────────────

export async function fetchContactsForHouse(houseId: string): Promise<HouseContact[]> {
  const { data, error } = await supabase
    .from('a_house_contacts').select('id, house_id, person_id, contact_type, name, role, company, is_primary, notes, created_at, updated_at').eq('house_id', houseId)
    .order('is_primary', { ascending: false })
    .order('contact_type', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
  return camelizeKeys<HouseContact[]>(data ?? [])
}

export async function createContact(
  houseId: string, contactType: ContactType, name: string,
  role: string | null, company: string | null,
  isPrimary: boolean, notes: string | null, personId: string | null,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('a-write-house-contacts', {
    body: {
      mode: 'create', houseId: houseId, contactType: contactType, name, role,
      company, isPrimary: isPrimary, notes, personId: personId,
    },
  })
  if (error) throw new Error(`Failed to create contact: ${error.message}`)
  return (data as { contact: { id: string } }).contact.id
}

export async function updateContact(id: string, patch: Partial<Omit<HouseContact, 'id' | 'house_id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-contacts', {
    body: { mode: 'update', id, ...snakeizeKeys<Record<string, unknown>>(patch) },
  })
  if (error) throw new Error(`Failed to update contact: ${error.message}`)
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('a-write-house-contacts', {
    body: { mode: 'delete', id },
  })
  if (error) throw new Error(`Failed to delete contact: ${error.message}`)
}

// ── PPD reads - via a-get-ppd Edge Function ──────────────────────────────────

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
      houseId:   houseId,
      personId:  opts.personId,
      contactId: opts.contactId,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`a-get-ppd failed: ${err.error ?? res.statusText}`)
  }

  return res.json() as Promise<PPDResponse>
}

// ── PPD writes - via a-write-ppd Edge Function ─────────────────────────────

/**
 * Single dispatcher for all PPD writes. Replaces the 4 direct table-write
 * helpers (createPPDPeopleEntry, deletePPDPeopleEntry, createPPDContactEntry,
 * deletePPDContactEntry). The Edge Function verifies admin, validates
 * data_key against canonical PPD registries, and logs every write.
 *
 * Returns inserted row on insert, void on delete.
 */
type WritePpdBody =
  | { action: 'insert'; table: 'people';   payload: { houseId: string; personId: string | null; dataKey: string;       dataValue: string; accessNote: string | null } }
  | { action: 'insert'; table: 'contacts'; payload: { houseId: string; contactId:  string;      dataKey: PpdContactKey; dataValue: string; accessNote: string | null } }
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

// ── PPD write helpers - same signatures as before, now Edge-Function-backed ──
// Existing callers in HouseTab.tsx work without changes.

export async function createPPDPeopleEntry(
  houseId: string, personId: string | null,
  dataKey: string, dataValue: string, accessNote: string | null,
): Promise<void> {
  await writePpd({
    action:  'insert',
    table:   'people',
    payload: {
      houseId:    houseId,
      personId:   personId,
      dataKey:    dataKey,
      dataValue:  dataValue,
      accessNote: accessNote,
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
      houseId:    houseId,
      contactId:  contactId,
      dataKey:    dataKey,
      dataValue:  dataValue,
      accessNote: accessNote,
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