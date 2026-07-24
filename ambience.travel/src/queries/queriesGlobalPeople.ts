// src/queries/queriesGlobalPeople.ts
// Canonical client access layer for the person registry (global_people).
// All access via the global-read-people / global-write-people Edge Functions.
// No direct table reads/writes (client-data architecture rule - sensitive
// data only through EF).
//
// Types (GlobalPersonResolved, GlobalPersonInput) live in
// src/types/typesGlobalPeople.ts and are re-exported here so consumers keep
// importing person types from the query layer (types > queries > components).
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
import { snakeizeKeys } from '@shared/camelize'
import type { GlobalPersonResolved, GlobalPersonInput } from '../types/typesGlobalPeople'
export type { GlobalPersonResolved, GlobalPersonInput }

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

// ── Reads ──────────────────────────────────────────────────────────────────
// All people, ordered by first_name. Optional search filters name fields + email.
export const fetchPeople = (search?: string): Promise<GlobalPersonResolved[]> =>
  invokeRead<{ people: GlobalPersonResolved[] }>({ mode: 'list', search }).then(r => r.people)

export const fetchPersonById = (id: string): Promise<GlobalPersonResolved | null> =>
  invokeRead<{ person: GlobalPersonResolved | null }>({ mode: 'by_id', id }).then(r => r.person)

export const fetchPeopleByIds = (ids: string[]): Promise<GlobalPersonResolved[]> =>
  ids.length === 0
    ? Promise.resolve([] as GlobalPersonResolved[])
    : invokeRead<{ people: GlobalPersonResolved[] }>({ mode: 'by_ids', ids }).then(r => r.people)

// ── Writes ─────────────────────────────────────────────────────────────────
export const createPerson = (input: GlobalPersonInput = {}): Promise<GlobalPersonResolved> =>
  invokeWrite<{ person: GlobalPersonResolved }>({ mode: 'create', ...snakeizeKeys<Record<string, unknown>>(input) }).then(r => r.person)

export const updatePerson = (id: string, patch: GlobalPersonInput): Promise<GlobalPersonResolved> =>
  invokeWrite<{ person: GlobalPersonResolved }>({ mode: 'update', id, ...snakeizeKeys<Record<string, unknown>>(patch) }).then(r => r.person)
