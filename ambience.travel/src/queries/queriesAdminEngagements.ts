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
import { camelizeKeys } from '@shared/camelize'
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

export type EngagementListRow = {
  id:                   string
  urlId:               string | null
  title:                string | null
  audience:             'private' | 'public'
  isPublicTemplate:   boolean | null
  engagementStatusId: string
  itineraryStatusId:  string
  sortOrder:           number
  createdAt:           string
  iterationLabel:      string

  // Joined display fields (status lookups)
  engagementStatusSlug:  string | null
  engagementStatusLabel: string | null
  itineraryStatusSlug:   string | null
  itineraryStatusLabel:  string | null

  // Trip linkage (NULL when engagement isn't linked to a canonical trip)
  journeyId:           string | null
  journeyCode:         string | null
  trip_public_title: string | null
  trip_start_date:   string | null

  // Primary client on the linked trip (NULL when no trip OR no primary client)
  clientFirstName: string | null
  clientLastName:  string | null
  clientNickname:   string | null

  // Primary client id - needed for inline-edit writes from the group header
  clientId:         string | null
}

export type EngagementDetailRow = {
  // Identity
  id:                  string
  urlId:              string | null
  title:               string | null
  slug:                string | null
  iterationLabel:     string
  audience:            'private' | 'public'
  isPublic:           boolean
  isPublicTemplate:  boolean | null
  proposalVisibility: 'active' | 'archived'
  journeyTypes:       string[]
  sortOrder:          number

  // Linkage
  personId:           string | null
  journeyId:             string | null
  engagementTypeId:  string | null
  // Guest label (Step 11)
  publicLabelId:              string | null
  guestDisplayNameOverride:  string | null

  // Status
  engagementStatusId: string
  itineraryStatusId:  string
  statusLabel:         string | null

  // Hero primary
  eyebrow:         string | null
  heroTagline:    string | null
  subtitle:        string | null
  heroImageSrc:  string | null
  heroImageAlt:  string | null
  heroPills:      unknown // jsonb

  // Hero secondary
  heroTitle2:        string | null
  heroSubtitle2:     string | null
  heroImageSrc2:    string | null
  heroImageAlt2:    string | null

  // Route
  routeEyebrow: string | null
  routeHeading: string | null
  routeBody:    string | null

  // Destination
  destinationHeading:  string | null
  destinationSubtitle: string | null
  destinationBody:     string | null

  // Pricing
  pricingHeading:        string | null
  pricingTitle:          string | null
  pricingBody:           string | null
  pricingTotalLabel:    string | null
  pricingTotalValue:    string | null
  pricingNotesHeading:  string | null
  pricingNotesTitle:    string | null
  pricingNotes:          unknown // jsonb

  // Welcome overrides
  welcomeEyebrowOverride:      string | null
  welcomeTitleOverride:        string | null
  welcomeBodyOverride:         string | null
  welcomeSignoffBodyOverride: string | null
  welcomeSignoffNameOverride: string | null

  createdAt: string
  updatedAt: string
}

export type StatusLookup = {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
}

export type EngagementTypeLookup = {
  id:         string
  slug:       string
  label:      string
  sortOrder: number
}

export type PersonOption = {
  id:         string
  firstName: string | null
  lastName:  string | null
  nickname:   string | null
}

export type EngagementOption = {
  id:         string
  journeyCode:  string
  startDate: string | null
}

export type ChildCounts = {
  destination_rows:        number
  pricingRows:            number
  destination_hotels:      number
  region_hotels:           number
  route_stops:             number
  card_selections:         number
  card_overrides:          number
  rooms:                   number
}

// ── Trip-grouped list shape ───────────────────────────────────────────────────
// The list tab consumes this - trips at top level, engagements as children.
// Orphans (engagements with journey_id NULL) collected into a synthetic group.

export type EngagementGroup = {
  // null when this is the orphan group
  journeyId:           string | null
  journeyCode:         string | null
  trip_public_title: string | null
  trip_start_date:   string | null
  clientId:         string | null
  clientDisplay:    string | null   // "Yazeed" or "Yazeed Last" or null
  // Raw client name fields - needed for inline-edit writes
  clientFirstName: string | null
  clientLastName:  string | null
  clientNickname:   string | null
  engagements:       EngagementListRow[]
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
      journeyCode:         row.journeyCode,
      trip_public_title: row.trip_public_title,
      trip_start_date:   row.trip_start_date,
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
    group.engagements.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  // Sort trips by start_date DESC (most recent first), nulls last
  const tripGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.trip_start_date && b.trip_start_date) {
      return b.trip_start_date.localeCompare(a.trip_start_date)
    }
    if (a.trip_start_date) return -1
    if (b.trip_start_date) return 1
    return 0
  })

  // Orphan group at the bottom
  if (orphans.length > 0) {
    orphans.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    tripGroups.push({
      journeyId:           null,
      journeyCode:         null,
      trip_public_title: null,
      trip_start_date:   null,
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

// ── Detail ────────────────────────────────────────────────────────────────────

export type HouseOption = { id: string; displayName: string; public_name: string | null }

export type EngagementHouseLink = {
  id: string; houseId: string; isPrimary: boolean; sortOrder: number
  a_houses: { displayName: string; public_name: string | null } | null
}

export type CandidateLabel = {
  id: string; houseId: string; key: string; displayName: string; isDefault: boolean
}

export type EngagementDetail = {
  row: EngagementDetailRow
  houses: EngagementHouseLink[]
  candidate_labels: CandidateLabel[]
}

export async function fetchEngagementDetail(urlId: string): Promise<EngagementDetail | null> {
  const { row, houses, candidateLabels } = await invokeRead<{
    row: EngagementDetailRow | null
    houses: EngagementHouseLink[]
    candidateLabels: CandidateLabel[]
  }>('detail', { url_id: urlId })
  if (!row) return null
  return { row, houses: houses ?? [], candidate_labels: candidateLabels ?? [] }
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

// ── Welcome letter canonical singleton (read-only for placeholder display) ────

export type WelcomeLetterCanonical = {
  eyebrow:       string | null
  title:         string | null
  body:          string | null
  signoff_body:  string | null
  signoff_name:  string | null
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

export type EngagementCreatePayload = {
  journeyCode:       string
  public_title:    string | null
  startDate:      string | null   // ISO YYYY-MM-DD
  endDate:        string | null   // ISO YYYY-MM-DD
  currency:        string          // 'USD' default at DB layer
  primary_client_id: string | null
}

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

export type EngagementUpdatePayload = {
  journey_code?:    string
  public_title?: string | null
}

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

export type PersonUpdatePayload = {
  first_name?: string | null
  last_name?:  string | null
  nickname?:   string | null
}

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
  newjourneyId:    string | null,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('travel-write-engagement', {
    body: { mode: 'reassign_trip', id: engagementId, journeyId: newjourneyId },
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