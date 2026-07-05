// typesImmerseClient.ts — Unified client-facing engagement type.
//
// Collapse A: replaces the two parallel client render paths:
//   - ImmerseEngagementData (proposal surface)
//   - TripClientData (confirmed surface)
//
// Architecture: discriminated union by stage, not a flattened superset.
// A flattened superset with 40+ optional fields forces every consumer to
// guess what's populated. The union is honest — each stage carries exactly
// what it knows, nothing more.
//
// The route resolver (ImmerseEngagementRoute) returns EngagementClientData.
// The page component (ImmerseEngagementPage) switches on stage.
// Each section renders from the appropriate sub-shape.
//
// Lifecycle stages that map to each arm:
//   proposal  → requested, quoted, pending
//   confirmed → confirmed, paid, in_service, closed_won
//
// Last updated: S53I — Collapse A types layer.

import type {
  ImmerseEngagementData,
  ImmerseDossierTrip,
  ImmerseTripBrief,
  ImmerseTripHouse,
  ImmerseTripAuxBooking,
} from './typesImmerse'

export type TripGuides = {
  hasDining:       boolean
  hasExperiences:  boolean
  destinationSlug: string | null
}

export type TripContact = {
  id:    string
  name:  string
  role:  string | null
  email: string | null
  phone: string | null
}

export type EngagementLinkContent = {
  title:     string
  body:      string
  kicker:    string | null
  image_src: string | null
  image_alt: string | null
}

export type EngagementLink = {
  id:            string
  link_type:     string
  label:         string
  url:           string
  sort_order:    number
  is_highlighted: boolean
  travel_engagement_link_content: EngagementLinkContent | null
}

export type TripClientData = {
  trip:             ImmerseDossierTrip
  brief:            ImmerseTripBrief | null
  house:            ImmerseTripHouse | null
  destinationName:  string
  auxBookings:      ImmerseTripAuxBooking[]
  guides:           TripGuides
  contacts:         TripContact[]
  links:            EngagementLink[]
  urlId:            string
  guestDisplayName: string | null
}

// ── Discriminated union ───────────────────────────────────────────────────────

export type EngagementClientStage = 'proposal' | 'delivery'

export type EngagementClientData =
  | {
      stage:      'proposal'
      urlId:      string
      engagement: ImmerseEngagementData
    }
  | {
      stage:      'delivery'
      urlId:      string
      engagement: ImmerseEngagementData  // delivery arm carries engagement data; the delivery surface fetches its own brief/confirmation/programme internally
    }
// ── Stage resolution ──────────────────────────────────────────────────────────
// Maps lifecycle status slugs to the two render arms.
// Any status not in CONFIRMED_SLUGS falls back to proposal.

const CONFIRMED_SLUGS = new Set([
  'confirmed',
  'paid',
  'in_service',
  'closed_won',
])

export function resolveStage(statusSlug: string | null | undefined): EngagementClientStage {
  if (!statusSlug) return 'proposal'
  return CONFIRMED_SLUGS.has(statusSlug) ? 'delivery' : 'proposal'
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isProposalData(
  data: EngagementClientData
): data is Extract<EngagementClientData, { stage: 'proposal' }> {
  return data.stage === 'proposal'
}

export function isDeliveryData(
  data: EngagementClientData
): data is Extract<EngagementClientData, { stage: 'delivery' }> {
  return data.stage === 'delivery'
}