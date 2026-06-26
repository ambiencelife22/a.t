// src/queries/queriesGlobalPeople.ts
// Canonical client access layer for the person registry (global_people).
// All access via the global-read-people / global-write-people Edge Functions.
// No direct table reads/writes (client-data architecture rule — sensitive
// data only through EF).
//
// global_people is a cross-product spine: passengers, house-people, grants,
// and team all FK to it. This layer is the canonical client path
// ecosystem-wide. Consumers: PersonLinkPicker (link existing), PersonModal
// (create-and-link new house-people), and any admin person-edit surface.
//
// NOTE: queriesAdminGuides.ts still reads global_people directly
// (fetchAllPeople + grant batch-fetches). Those predate the architecture
// rule and should be migrated onto this layer.

import { supabase } from '../lib/supabase'

async function invokeRead<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('global-read-people', { body })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

async function invokeWrite<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('global-write-people', { body })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    const d = data as { error: string; message?: string }
    throw new Error(d.message ?? d.error)
  }
  return data as T
}

// ── Types ──────────────────────────────────────────────────────────────────

// Resolved person (read/write shape — display_name resolved server-side).
export interface GlobalPersonResolved {
  id:                   string
  first_name:           string | null
  middle_name:          string | null
  last_name:            string | null
  father_name:          string | null
  grandfather_name:     string | null
  patronymic_connector: string | null
  pronouns:             string | null
  nickname:             string | null
  email:                string | null
  phone:                string | null
  last_initial:         string | null
  is_public_display:    boolean
  over_18_confirmed_at: string | null
  display_name:         string
}

// Editable fields for create/update. All optional — create defaults NOT NULLs.
export interface GlobalPersonInput {
  first_name?:           string | null
  middle_name?:          string | null
  last_name?:            string | null
  father_name?:          string | null
  grandfather_name?:     string | null
  patronymic_connector?: string | null
  pronouns?:             string | null
  nickname?:             string | null
  email?:                string | null
  phone?:                string | null
  notes?:                string | null
  last_initial?:         string | null
  is_public_display?:    boolean
  over_18_confirmed_at?: string | null
}

// ── Reads ──────────────────────────────────────────────────────────────────

// All people, ordered by first_name. Optional search filters name fields + email.
export const fetchPeople = (search?: string) =>
  invokeRead<{ people: GlobalPersonResolved[] }>({ mode: 'list', search })
    .then(r => r.people)

// Single person by global_people.id.
export const fetchPersonById = (id: string) =>
  invokeRead<{ person: GlobalPersonResolved | null }>({ mode: 'by_id', id })
    .then(r => r.person)

// Batch resolve a list of global_people ids.
export const fetchPeopleByIds = (ids: string[]) =>
  ids.length === 0
    ? Promise.resolve([] as GlobalPersonResolved[])
    : invokeRead<{ people: GlobalPersonResolved[] }>({ mode: 'by_ids', ids })
        .then(r => r.people)

// ── Writes ─────────────────────────────────────────────────────────────────

// Mint a new global_people row. Returns the resolved person (with its new id).
export const createPerson = (input: GlobalPersonInput = {}) =>
  invokeWrite<{ person: GlobalPersonResolved }>({ mode: 'create', ...input })
    .then(r => r.person)

// Patch an existing global_people row.
export const updatePerson = (id: string, patch: GlobalPersonInput) =>
  invokeWrite<{ person: GlobalPersonResolved }>({ mode: 'update', id, ...patch })
    .then(r => r.person)