// queriesImmerseClient.ts — Unified client-facing engagement data fetch.
//
// Collapse A: one fetch function, two EF paths, no direct DB calls.
// All reads go through Edge Functions (service role). Never direct REST.
//
// Stage resolution:
//   1. Try getImmerseEngagement (proposal EF). Returns data → proposal arm.
//   2. Delivery bundle is fetched separately by the delivery surface (fetchDeliveryBundle).
//   3. Returns data → confirmed arm.
//   4. Both null → not-found (or not-public — EF returns null for both).
//
// The EFs enforce public_view and access control server-side.
// No probe, no pre-flight, no anon REST calls.
//
// Last updated: S53I — Collapse A. Removed illegal REST probe.

import type { EngagementClientData } from '../types/typesImmerseClient'
import { getProposalEngagement, NOT_PUBLIC_SENTINEL } from './queriesImmerseProposal'
import { fetchDeliveryBundle } from './queriesImmerseDelivery'

export type { TripGuides, TripContact, DeliveryData, EngagementLink } from '../types/typesImmerseClient'

// ── Result type ───────────────────────────────────────────────────────────────

export type FetchEngagementResult =
  | { type: 'data';       data: EngagementClientData }
  | { type: 'not-found'                              }
  | { type: 'not-public'                             }
  | { type: 'error';      message: string            }

// ── Unified fetch ─────────────────────────────────────────────────────────────

export async function fetchEngagementClientData(
  urlId: string
): Promise<FetchEngagementResult> {
  // Single EF call — travel-get-immerse-proposal handles all engagements.
  // Stage is computed from the lifecycle status slug and returned on the data.
  // confirmed (trip/completed) → caller redirects to /{urlId} (brief surface)
  // proposal (proposal/draft)  → caller renders at /{urlId}/proposal
  const proposalData = await getProposalEngagement(urlId)
  if (!proposalData) {
    console.warn('[fetchEngagementClientData] EF returned null for urlId:', urlId)
    return { type: 'not-found' }
  }
  if (proposalData === NOT_PUBLIC_SENTINEL) {
    return { type: 'not-public' }
  }

  const stage = proposalData.stage
  if (stage === 'trip' || stage === 'completed') {
    const bundle = await fetchDeliveryBundle(urlId)
    if (!bundle) return { type: 'not-public' }
    return {
      type: 'data',
      data: { stage: 'delivery', urlId, engagement: proposalData, bundle },
    }
  }

  return {
    type: 'data',
    data: { stage: 'proposal', urlId, engagement: proposalData },
  }
}