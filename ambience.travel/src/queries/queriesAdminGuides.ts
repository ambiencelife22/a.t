// queriesAdminGuides.ts - EF-routed read + write paths for guides/library admin tabs.
// All access via the travel-admin-guides Edge Function (admin-gated). No direct
// table reads/writes. Variant-parameterised: each fn passes its variant, the EF
// resolves tables server-side and snakeizes every write payload.
//
// Types live in src/types/typesAdminGuides.ts and are re-exported here so
// consumers keep importing guide types from the query layer (types > queries > tsx).
//
// Experiences/shopping venue reads are NOT here - they live in the guest-side
// queriesGuidesExperiences / queriesGuidesShopping (single source of truth,
// already EF-routed via travel-read-guides). This file owns dining venues,
// hotels, all four guide overlays, dining/experiences grants, and dining ingest.
//
// Last updated: S53Q - EF-routed onto travel-admin-guides. Fixes prior camel-key
// write bugs by construction (isActive/userId to snake columns, raw .update(patch)).

import { supabase } from '../lib/supabase'
import type {
  DestinationOption, MichelinAward,
  DestinationWithDiningCounts, DestinationWithExperiencesCounts,
  DestinationWithHotelCounts, DestinationWithShoppingCounts,
  AdminDiningVenue, AdminHotel,
  AdminDiningGuide, AdminExperiencesGuide, AdminHotelGuide, AdminShoppingGuide,
  AdminGrant, AdminExperiencesGrant,
  DiningVenuePatch, HotelPatch, DiningGuidePatch, ExperiencesGuidePatch,
  HotelGuidePatch, ShoppingGuidePatch,
  IngestVenueRecord, IngestPayload, IngestResult,
} from '../types/typesAdminGuides'
export type {
  DestinationOption, MichelinAward,
  DestinationWithDiningCounts, DestinationWithExperiencesCounts,
  DestinationWithHotelCounts, DestinationWithShoppingCounts,
  AdminDiningVenue, AdminHotel,
  AdminDiningGuide, AdminExperiencesGuide, AdminHotelGuide, AdminShoppingGuide,
  AdminGrant, AdminExperiencesGrant,
  DiningVenuePatch, HotelPatch, DiningGuidePatch, ExperiencesGuidePatch,
  HotelGuidePatch, ShoppingGuidePatch,
  IngestVenueRecord, IngestPayload, IngestResult,
} from '../types/typesAdminGuides'
import { fetchPeopleByIds, type GlobalPersonResolved } from './queriesGlobalPeople'

// S54c - global_people is read exclusively via queriesGlobalPeople (EF layer).
// GlobalPerson is the canonical resolved shape; no local person type, no direct read.
export type GlobalPerson = GlobalPersonResolved

type Variant = 'dining' | 'experiences' | 'hotels' | 'shopping'

// ── EF invoke helpers ────────────────────────────────────────────────────────

async function invokeGuides<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-admin-guides', { body })
  if (error) throw new Error(`admin guides (${body.mode}): ${error.message}`)
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

// Shared grant-row shape returned by the EF grants mode (raw snake + profile join).
type GrantRowRaw = {
  id:                  string
  userId:              string
  globalDestinationId: string
  grantedAt:           string
  profile: { personId: string | null } | null
}

// Resolve grant rows into AdminGrant[] by batch-fetching linked people.
async function resolveGrants(rows: GrantRowRaw[]): Promise<AdminGrant[]> {
  const personIds = rows
    .map(r => r.profile?.personId)
    .filter((id): id is string => id != null)
  const peopleById = new Map<string, GlobalPerson>()
  if (personIds.length > 0) {
    const people = await fetchPeopleByIds(personIds)
    for (const p of people) peopleById.set(p.id, p)
  }
  return rows.map(r => ({
    id:                  r.id,
    userId:              r.userId,
    globalDestinationId: r.globalDestinationId,
    grantedAt:           r.grantedAt,
    person:              r.profile?.personId
      ? (peopleById.get(r.profile.personId) ?? null)
      : null,
  }))
}

// ── Destinations ─────────────────────────────────────────────────────────────

export async function fetchDestinationOptions(): Promise<DestinationOption[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({ mode: 'destination_options' })
  return (rows ?? []) as DestinationOption[]
}

async function fetchDestinationsWithCounts(variant: Variant): Promise<Array<{ id: string; count: number; hasOverlay: boolean }>> {
  const { rows } = await invokeGuides<{ rows: Array<{ id: string; count: number; hasOverlay: boolean }> }>({
    mode: 'destinations_with_counts', variant,
  })
  return rows ?? []
}

export async function fetchDestinationsWithDining(): Promise<DestinationWithDiningCounts[]> {
  const rows = await fetchDestinationsWithCounts('dining')
  return rows.map(r => ({ id: r.id, venueCount: r.count, hasOverlay: r.hasOverlay }))
}

export async function fetchDestinationsWithExperiences(): Promise<DestinationWithExperiencesCounts[]> {
  const rows = await fetchDestinationsWithCounts('experiences')
  return rows.map(r => ({ id: r.id, venueCount: r.count, hasOverlay: r.hasOverlay }))
}

export async function fetchDestinationsWithHotels(): Promise<DestinationWithHotelCounts[]> {
  const rows = await fetchDestinationsWithCounts('hotels')
  return rows.map(r => ({ id: r.id, hotelCount: r.count, hasOverlay: r.hasOverlay }))
}

export async function fetchDestinationsWithShopping(): Promise<DestinationWithShoppingCounts[]> {
  const rows = await fetchDestinationsWithCounts('shopping')
  return rows.map(r => ({ id: r.id, shopCount: r.count, hasOverlay: r.hasOverlay }))
}

// ── Dining venues ────────────────────────────────────────────────────────────

export async function fetchAllDiningVenues(
  destinationIdFilter?: string | null,
): Promise<AdminDiningVenue[]> {
  const body: Record<string, unknown> = { mode: 'venues', variant: 'dining' }
  if (destinationIdFilter) body.destination_id = destinationIdFilter
  const { rows } = await invokeGuides<{ rows: unknown[] }>(body)
  return (rows ?? []) as AdminDiningVenue[]
}

export async function updateDiningVenue(id: string, patch: DiningVenuePatch): Promise<void> {
  await invokeGuides({ mode: 'venue_update', variant: 'dining', id, patch })
}

export async function deleteDiningVenue(id: string): Promise<void> {
  await invokeGuides({ mode: 'venue_delete', variant: 'dining', id })
}

// ── Dining guides ────────────────────────────────────────────────────────────

export async function fetchDiningGuides(): Promise<AdminDiningGuide[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({ mode: 'guides', variant: 'dining' })
  return (rows ?? []) as AdminDiningGuide[]
}

export async function updateDiningGuide(id: string, patch: DiningGuidePatch): Promise<void> {
  await invokeGuides({ mode: 'guide_update', variant: 'dining', id, patch })
}

export async function createDiningGuide(globalDestinationId: string): Promise<string> {
  const { id } = await invokeGuides<{ id: string }>({
    mode: 'guide_create', variant: 'dining', global_destination_id: globalDestinationId,
  })
  return id
}

export async function deleteDiningGuide(id: string): Promise<void> {
  await invokeGuides({ mode: 'guide_delete', variant: 'dining', id })
}

// ── Dining grants ────────────────────────────────────────────────────────────

export async function fetchGrantsForDestination(
  globalDestinationId: string,
): Promise<AdminGrant[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({
    mode: 'grants', variant: 'dining', global_destination_id: globalDestinationId,
  })
  return resolveGrants((rows ?? []) as GrantRowRaw[])
}

export async function createGrant(
  userId:              string,
  globalDestinationId: string,
): Promise<void> {
  await invokeGuides({
    mode: 'grant_create', variant: 'dining',
    user_id: userId, global_destination_id: globalDestinationId,
  })
}

export async function deleteGrant(id: string): Promise<void> {
  await invokeGuides({ mode: 'grant_delete', variant: 'dining', id })
}

// ── Profile lookup ───────────────────────────────────────────────────────────

// Given a global_people UUID, find the linked global_profiles row.
export async function fetchProfileByPersonId(
  personId: string,
): Promise<{ id: string } | null> {
  const { row } = await invokeGuides<{ row: { id: string } | null }>({
    mode: 'profile_by_person', person_id: personId,
  })
  return row ?? null
}

// ── Experiences guides ───────────────────────────────────────────────────────

export async function fetchExperiencesGuides(): Promise<AdminExperiencesGuide[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({ mode: 'guides', variant: 'experiences' })
  return (rows ?? []) as AdminExperiencesGuide[]
}

export async function updateExperiencesGuide(id: string, patch: ExperiencesGuidePatch): Promise<void> {
  await invokeGuides({ mode: 'guide_update', variant: 'experiences', id, patch })
}

export async function createExperiencesGuide(globalDestinationId: string): Promise<string> {
  const { id } = await invokeGuides<{ id: string }>({
    mode: 'guide_create', variant: 'experiences', global_destination_id: globalDestinationId,
  })
  return id
}

export async function deleteExperiencesGuide(id: string): Promise<void> {
  await invokeGuides({ mode: 'guide_delete', variant: 'experiences', id })
}

// ── Experiences grants ───────────────────────────────────────────────────────

export async function fetchExperiencesGrantsForDestination(
  globalDestinationId: string,
): Promise<AdminExperiencesGrant[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({
    mode: 'grants', variant: 'experiences', global_destination_id: globalDestinationId,
  })
  return resolveGrants((rows ?? []) as GrantRowRaw[])
}

export async function createExperiencesGrant(
  userId:              string,
  globalDestinationId: string,
): Promise<void> {
  await invokeGuides({
    mode: 'grant_create', variant: 'experiences',
    user_id: userId, global_destination_id: globalDestinationId,
  })
}

export async function deleteExperiencesGrant(id: string): Promise<void> {
  await invokeGuides({ mode: 'grant_delete', variant: 'experiences', id })
}

// ── Dining JSON ingest ───────────────────────────────────────────────────────

export async function ingestDiningJson(
  globalDestinationId: string,
  payload:             IngestPayload,
): Promise<IngestResult> {
  return invokeGuides<IngestResult>({
    mode: 'ingest_dining',
    global_destination_id: globalDestinationId,
    restaurants: payload.restaurants,
  })
}

// ── Hotels ───────────────────────────────────────────────────────────────────

export async function fetchAllHotels(
  destinationIdFilter?: string | null,
): Promise<AdminHotel[]> {
  const body: Record<string, unknown> = { mode: 'venues', variant: 'hotels' }
  if (destinationIdFilter) body.destination_id = destinationIdFilter
  const { rows } = await invokeGuides<{ rows: unknown[] }>(body)
  // Hotel venues key destinations via destination_id; remap to globalDestinationId
  // for consistency with the other variants. bullets is jsonb - cast to string[].
  const camel = (rows ?? []) as Record<string, unknown>[]
  return camel.map((r) => {
    const bullets = Array.isArray(r.bullets) ? (r.bullets as string[]) : null
    return { ...r, globalDestinationId: r.destinationId as string, bullets }
  }) as unknown as AdminHotel[]
}

export async function fetchHotelGuides(): Promise<AdminHotelGuide[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({ mode: 'guides', variant: 'hotels' })
  return (rows ?? []) as AdminHotelGuide[]
}

export async function updateHotel(id: string, patch: HotelPatch): Promise<void> {
  // Hotel venue keys destinations via destination_id, not global_destination_id.
  // Remap so the EF snakeizes to the correct column.
  const { globalDestinationId, ...rest } = patch as HotelPatch & { globalDestinationId?: string }
  const outPatch: Record<string, unknown> = { ...rest }
  if (globalDestinationId) outPatch.destinationId = globalDestinationId
  await invokeGuides({ mode: 'venue_update', variant: 'hotels', id, patch: outPatch })
}

export async function updateHotelGuide(id: string, patch: HotelGuidePatch): Promise<void> {
  await invokeGuides({ mode: 'guide_update', variant: 'hotels', id, patch })
}

export async function createHotelGuide(globalDestinationId: string): Promise<string> {
  const { id } = await invokeGuides<{ id: string }>({
    mode: 'guide_create', variant: 'hotels', global_destination_id: globalDestinationId,
  })
  return id
}

export async function deleteHotelGuide(id: string): Promise<void> {
  await invokeGuides({ mode: 'guide_delete', variant: 'hotels', id })
}

// ── Shopping guides ──────────────────────────────────────────────────────────

export async function fetchShoppingGuides(): Promise<AdminShoppingGuide[]> {
  const { rows } = await invokeGuides<{ rows: unknown[] }>({ mode: 'guides', variant: 'shopping' })
  return (rows ?? []) as AdminShoppingGuide[]
}

export async function updateShoppingGuide(id: string, patch: ShoppingGuidePatch): Promise<void> {
  await invokeGuides({ mode: 'guide_update', variant: 'shopping', id, patch })
}

export async function createShoppingGuide(globalDestinationId: string): Promise<string> {
  const { id } = await invokeGuides<{ id: string }>({
    mode: 'guide_create', variant: 'shopping', global_destination_id: globalDestinationId,
  })
  return id
}

export async function deleteShoppingGuide(id: string): Promise<void> {
  await invokeGuides({ mode: 'guide_delete', variant: 'shopping', id })
}