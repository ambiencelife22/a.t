// queriesAdminEngagements.ts - Supabase reads/writes for AmbienceAdmin
// Engagement list (trip-grouped), detail, update, create, delete + status
// lookups + person/trip typeahead. Single source of truth for admin-side
// engagement data access. Components call these - never .from() inline.
//
// Last updated: S54 - Engagement writes migrated to travel-write-engagement EF
//   (create/update/status/visibility/welcome/archive/delete via invokeWrite).
//   Status split into setEngagementStatus + setItineraryStatus (two axes).
//   Archive (reversible) and Delete (EF-backed, financial-guarded) are distinct.
//   Trip/person inline-edit writes remain direct supabase (not engagement scope).
// Prior: S54 - Read paths migrated to travel-read-engagement-admin EF
//   (max_sort_order later removed - sort_order computed server-side on create).
// Prior: S33B - Added trip + person inline-edit + drag-and-drop re-parenting
//   writes. New: updateTrip, createEngagement, updatePerson, reassignEngagementJourney.
// Prior: S33 - Added iteration_label. List query joins travel_journey +
//   global_people for trip-group rendering.

import { supabase } from '../lib/supabase'
import type {
  EngagementPatch,
  CreateEngagementInput,
  ReorderItem,
  WelcomeLetterPatch,
  EngagementStatusSlug,
  ItineraryStatusSlug,
  ArchiveEngagementSlug,
} from '../types/typesImmerse'

const READ_EF  = 'travel-read-engagement-admin'
const WRITE_EF = 'travel-write-engagement'

// Thin invoke wrapper - centralises the error shape so call sites stay clean.
async function invokeRead<T>(mode: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(READ_EF, {
    body: { mode, ...params },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

// Thin invoke wrapper - twin of invokeRead, for the write EF.
async function invokeWrite<T>(mode: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(WRITE_EF, {
    body: { mode, ...params },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    const d = data as { error: string; message?: string }
    throw new Error(d.message ?? d.error)
  }
  return data as T
}

// ── Types ─────────────────────────────────────────────────────────────────────
// Types live in typesAdminEngagements.ts (their own layer). Re-exported here so
// existing consumers importing from this query file keep resolving.
import type {
  EngagementListRow, EngagementDetailRow, StatusLookup, EngagementTypeLookup,
  PersonOption, EngagementOption, ChildCounts, EngagementGroup, HouseOption,
  EngagementHouseLink, CandidateLabel, EngagementDetail, WelcomeLetterCanonical,
  EngagementCreatePayload, EngagementUpdatePayload, PersonUpdatePayload,
} from '../types/typesAdminEngagements'
export type {
  EngagementListRow, EngagementDetailRow, StatusLookup, EngagementTypeLookup,
  PersonOption, EngagementOption, ChildCounts, EngagementGroup, HouseOption,
  EngagementHouseLink, CandidateLabel, EngagementDetail, WelcomeLetterCanonical,
  EngagementCreatePayload, EngagementUpdatePayload, PersonUpdatePayload,
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function fetchEngagementList(): Promise<EngagementListRow[]> {
  const { rows } = await invokeRead<{ rows: EngagementListRow[] }>('list')
  return rows
}

// Group engagements by journey_id. Orphans (NULL journey_id) into a synthetic
// group sorted to the bottom. Within each group, engagements ordered by
// created_at ASC so v1/v2/v3 reads chronologically top-to-bottom.
export function groupByEngagement(rows: EngagementListRow[]): EngagementGroup[] {
  const groups = new Map<string, EngagementGroup>()
  const orphans: EngagementListRow[] = []

  for (const row of rows) {
    if (row.journeyId == null) {
      orphans.push(row)
      continue
    }
    const existing = groups.get(row.journeyId)
    if (existing) {
      existing.engagements.push(row)
      continue
    }
    const joined = [row.clientFirstName, row.clientLastName].filter(Boolean).join(' ')
    const clientDisplay = row.clientNickname ?? (joined || null)

    groups.set(row.journeyId, {
      journeyId:           row.journeyId,
      engagementCode:      row.engagementCode,
      tripPublicTitle: row.tripPublicTitle,
      tripStartDate: row.tripStartDate,
      clientId:         row.clientId,
      clientDisplay:    clientDisplay && clientDisplay.length > 0 ? clientDisplay : null,
      clientFirstName: row.clientFirstName,
      clientLastName:  row.clientLastName,
      clientNickname:   row.clientNickname,
      engagements:       [row],
    })
  }

  // Sort engagements within each trip by created_at ASC
  for (const group of groups.values()) {
    group.engagements.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  }

  // Sort trips by start_date DESC (most recent first), nulls last
  const tripGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.tripStartDate && b.tripStartDate) {
      return b.tripStartDate.localeCompare(a.tripStartDate)
    }
    if (a.tripStartDate) return -1
    if (b.tripStartDate) return 1
    return 0
  })

  // Orphan group at the bottom
  if (orphans.length > 0) {
    orphans.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    tripGroups.push({
      journeyId:           null,
      engagementCode:      null,
      tripPublicTitle: null,
      tripStartDate: null,
      clientId:         null,
      clientDisplay:    null,
      clientFirstName: null,
      clientLastName:  null,
      clientNickname:   null,
      engagements:       orphans,
    })
  }

  return tripGroups
}

export async function fetchEngagementDetail(urlId: string): Promise<EngagementDetail | null> {
  const { row, houses, candidateLabels } = await invokeRead<{
    row: EngagementDetailRow | null
    houses: EngagementHouseLink[]
    candidateLabels: CandidateLabel[]
  }>('detail', { url_id: urlId })
  if (!row) return null
  return { row, houses: houses ?? [], candidateLabels: candidateLabels ?? [] }
}

export async function searchHouses(query: string): Promise<HouseOption[]> {
  const { rows } = await invokeRead<{ rows: HouseOption[] }>('houses', { query })
  return rows ?? []
}

export async function linkHouse(engagementId: string, houseId: string): Promise<void> {
  await invokeWrite('link_house', { engagementId: engagementId, houseId: houseId })
}

export async function unlinkHouse(id: string): Promise<void> {
  await invokeWrite('unlink_house', { id })
}

export async function setPrimaryHouse(id: string): Promise<void> {
  await invokeWrite('set_primary_house', { id })
}

export async function setLabel(
  id: string,
  publicLabelId: string | null,
  override: string | null,
): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('set_label', {
    id, public_label_id: publicLabelId, guestDisplayNameOverride: override,
  })
  return row
}

// ── Child counts (read-only summary for detail page) ──────────────────────────

export async function fetchChildCounts(engagementId: string): Promise<ChildCounts> {
  const { counts } = await invokeRead<{ counts: ChildCounts }>('child_counts', { engagementId: engagementId })
  return counts
}

// ── Update ────────────────────────────────────────────────────────────────────

// Status writes - two independent axes; neither gates the other.
// setEngagementStatus is the canonical "commit"/"promote" action (Engagement
// Model canon §V). Forward AND backward transitions allowed (re-proposal loop).

export async function setEngagementStatus(id: string, slug: EngagementStatusSlug): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('set_engagement_status', { id, slug })
  return row
}

export async function setItineraryStatus(id: string, slug: ItineraryStatusSlug): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('set_itinerary_status', { id, slug })
  return row
}

export async function updateEngagement(id: string, patch: EngagementPatch): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('update_engagement', { id, patch })
  return row
}

// ── Create ────────────────────────────────────────────────────────────────────
// EF seeds new_request / draft, generates url_id, computes sort_order.
// Caller passes only the scalar fields it wants set. Returns the full new row.

export async function createEngagement(input: CreateEngagementInput = {}): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('create_engagement', {
    engagement:             input.engagement ?? {},
    engagementStatusSlug: input.engagementStatusSlug,
    itineraryStatusSlug:  input.itineraryStatusSlug,
    houseId:              input.houseId,
  })
  return row
}

// ── Reorder (batch) ───────────────────────────────────────────────────────────

export async function reorderEngagements(items: ReorderItem[]): Promise<number> {
  const { updated } = await invokeWrite<{ updated: number }>('reorder', { items })
  return updated
}

// ── Visibility ────────────────────────────────────────────────────────────────
// Toggles public_view - the live show/hide gate the public stage EF checks.
// NOT is_public / is_public_template (those govern the template library).

export async function setEngagementVisibility(id: string, publicView: boolean): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('set_visibility', { id, public_view: publicView })
  return row
}

// AXIS-2 - toggles proposal_visibility (active|archived). Orthogonal to
// public_view: archived shows the client the "ask your travel designer"
// fallback instead of the proposal, while still resolving (not a 404).
export async function setEngagementProposalVisibility(
  id: string,
  visibility: 'active' | 'archived',
): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>(
    'set_proposal_visibility', { id, proposalVisibility: visibility },
  )
  return row
}

// ── Archive (reversible; distinct from delete) ────────────────────────────────
// Sets engagement_status -> cancelled|lost, itinerary_status -> archived.
// Content preserved, reactivatable. Delete (below) is the irreversible path.

export async function archiveEngagement(
  id: string,
  engagementSlug: ArchiveEngagementSlug = 'cancelled',
): Promise<EngagementDetailRow> {
  const { row } = await invokeWrite<{ row: EngagementDetailRow }>('archive', {
    id,
    engagementSlug: engagementSlug,
  })
  return row
}

// ── Delete (hard, EF-backed, financial-guarded) ───────────────────────────────
// EF refuses with 409 CANNOT_DELETE_HAS_RECORDS if bookings/time_entries/
// requests exist (Retention Spec v1). invokeWrite surfaces the friendly
// message. On success the 12 travel_immerse_* content tables cascade.

export async function deleteEngagement(id: string): Promise<void> {
  await invokeWrite<{ deleted: boolean }>('delete_engagement', { id })
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export async function fetchEngagementTypes(): Promise<EngagementTypeLookup[]> {
  const { rows } = await invokeRead<{ rows: EngagementTypeLookup[] }>('engagement_types')
  return rows
}

export async function fetchEngagementStatuses(): Promise<StatusLookup[]> {
  const { rows } = await invokeRead<{ rows: StatusLookup[] }>('engagement_statuses')
  return rows
}

export async function fetchItineraryStatuses(): Promise<StatusLookup[]> {
  const { rows } = await invokeRead<{ rows: StatusLookup[] }>('itinerary_statuses')
  return rows
}

export async function fetchPeople(query: string): Promise<PersonOption[]> {
  const { rows } = await invokeRead<{ rows: PersonOption[] }>('people', { query })
  return rows
}

export async function fetchTrips(query: string): Promise<EngagementOption[]> {
  const { rows } = await invokeRead<{ rows: EngagementOption[] }>('trips', { query })
  return rows
}

export async function fetchPersonById(id: string): Promise<PersonOption | null> {
  const { row } = await invokeRead<{ row: PersonOption | null }>('person_by_id', { id })
  return row
}

export async function fetchEngagementById(id: string): Promise<EngagementOption | null> {
  const { row } = await invokeRead<{ row: EngagementOption | null }>('trip_by_id', { id })
  return row
}

export async function fetchWelcomeLetterCanonical(): Promise<WelcomeLetterCanonical | null> {
  const { row } = await invokeRead<{ row: WelcomeLetterCanonical | null }>('welcome_letter')
  return row
}

export async function updateWelcomeLetter(patch: WelcomeLetterPatch): Promise<WelcomeLetterCanonical> {
  const { row } = await invokeWrite<{ row: WelcomeLetterCanonical }>('update_welcome_letter', { patch })
  return row
}

// ─────────────────────────────────────────────────────────────────────────────
// S33B additions - group header inline edit + drag-and-drop re-parenting
// ─────────────────────────────────────────────────────────────────────────────

// ── Trip create (drag-to-create-new-trip flow) ───────────────────────────────

export async function createJourney(payload: EngagementCreatePayload): Promise<string> {
  if (!payload.journeyCode || !payload.journeyCode.trim()) {
    throw new Error('journey_code is required')
  }
  const { data, error } = await supabase.functions.invoke('travel-write-journey', {
    body: { mode: 'create_journey', ...payload },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) throw new Error((data as { error: string }).error)
  return (data as { trip: { id: string } }).trip.id
}

// ── Trip update (group-header inline edits for journey_code + public_title) ─────

export async function updateTrip(id: string, payload: EngagementUpdatePayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke('travel-write-journey', {
    body: { mode: 'update_journey', id, ...payload },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) throw new Error((data as { error: string }).error)
}

// ── Person update (group-header client name edit) ────────────────────────────
// Note: this writes to global_people which is shared across products. Edits
// here flow through to every surface that displays this person.

export async function updatePerson(id: string, payload: PersonUpdatePayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke('global-write-people', {
    body: { mode: 'update', id, ...payload },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) throw new Error((data as { error: string }).error)
}

// ── Engagement re-parenting (drag-and-drop target) ────────────────────────────
// Reassigns an engagement to a different trip (or to NULL = Unlinked).
// journey_id NULL is valid per FK constraint (ON DELETE SET NULL).

export async function reassignEngagementJourney(
  engagementId: string,
  newJourneyId:    string | null,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', {
    body: { mode: 'reassign_trip', id: engagementId, journey_id: newJourneyId },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) throw new Error((data as { error: string }).error)
}

// ── Trip primary client update ────────────────────────────────────────────────
// Appended S42. Allows setting primary_client_id on travel_journey from the
// engagement list group header when no client is currently linked.

export async function updateEngagementPrimaryClient(
  journeyId:   string,
  personId: string | null,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('travel-write-journey', {
    body: { mode: 'update_journey_primary_client', id: journeyId, primary_client_id: personId },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) throw new Error((data as { error: string }).error)
}