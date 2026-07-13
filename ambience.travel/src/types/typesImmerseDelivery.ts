// typesImmerseDelivery.ts — Unified engagement RENDER-PAYLOAD types.
//
// Named for what it holds: the client-FACING render payload for the immerse
// engagement surface — NOT client identity. Client identity (the person/party)
// lives in global_people and its relationship tables, never here. Everything in
// this file is engagement/delivery composition: the stage-discriminated render
// union, the delivery bundle, engagement contacts (client AND hotel AND ambience
// people on the engagement), links, and guide flags.
//
// Renamed from typesImmerseClient.ts (S53O eight-shape B0): the old name claimed
// "client" but the contents are delivery/engagement render data. Per the
// Client-=-identity-only law, the misnamed file was dissolved and its whole
// contents relocated here.
//
// Architecture: discriminated union by stage, not a flattened superset.
// A flattened superset with 40+ optional fields forces every consumer to
// guess what's populated. The union is honest — each stage carries exactly
// what it knows, nothing more.
//
// The route resolver (ImmerseEngagementRoute) returns EngagementClientData.
// The surface component (ImmerseEngagementSurface) switches on stage.
// Each section renders from the appropriate sub-shape.
//
// Lifecycle stages that map to each arm:
//   proposal  → requested, quoted, pending
//   confirmed → confirmed, paid, in_service, closed_won
//
// Last updated: S53O — eight-shape B0. Honest rename from typesImmerseClient.

import type {
  ImmerseEngagementData,
  ImmerseDestinationData,
  ImmerseDossierTrip,
  ImmerseTripBrief,
  ImmerseTripHouse,
  EngagementElement,
  ImmerseTripDay,
} from './typesImmerse'
import type { TimelineItem } from './typesTimeline'

export type EngagementGuides = {
  hasDining:       boolean
  hasExperiences:  boolean
  destinationSlug: string | null
}

export type EngagementContact = {
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

export type DeliveryData = {
  trip:             ImmerseDossierTrip
  brief:            ImmerseTripBrief | null
  house:            ImmerseTripHouse | null
  destinationName:  string
  elements:      EngagementElement[]
  guides:           EngagementGuides
  contacts:         EngagementContact[]
  links:            EngagementLink[]
  urlId:            string
  guestDisplayName: string | null
}

// ── Discriminated union ───────────────────────────────────────────────────────

// ── Delivery bundle ───────────────────────────────────────────────────────────
// Full render payload for the delivery surface: DeliveryData (confirmation half)
// + programme days/entries. Assembled by fetchDeliveryBundle from both delivery
// Edge Functions.
export type DeliveryBundle = {
  clientData: DeliveryData
  days:       ImmerseTripDay[]
  entries:    TimelineItem[]
}

// Tab identifiers for the delivery surface's tabbed navigation.
export type DeliveryTabId = 'welcome' | 'confirmation' | 'programme' | 'brief' | 'contacts'

export type EngagementClientStage = 'proposal' | 'delivery'

export type EngagementClientData =
  | {
      stage:      'proposal'
      urlId:      string
      engagement: ImmerseEngagementData
      // Stay-shape detail (eight-shape B1). Present when the proposal is scoped
      // to a single destination — a standalone stay, or a destination-within-a-
      // journey opened directly. Undefined for a whole-journey proposal. The
      // stay-detail renderers (intro/hotel_options/dining_grid/experiences_grid/
      // detail_pricing) read from here and resolve only for shape 'stay', so
      // `detail` is only ever read when present. Fetched by the route resolver
      // (getProposalDestination) — B2 wires that fetch behind ?surface=next.
      detail?:    ImmerseDestinationData
    }
  | {
      stage:      'delivery'
      urlId:      string
      engagement: ImmerseEngagementData
      bundle:     DeliveryBundle  // delivery render payload, fetched once at the route resolver
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