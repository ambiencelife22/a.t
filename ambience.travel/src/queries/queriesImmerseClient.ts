// queriesImmerseClient.ts — Unified client-facing engagement data fetch.
//
// Collapse A: one fetch function, two EF paths, no direct DB calls.
// All reads go through Edge Functions (service role). Never direct REST.
//
// Stage resolution:
//   1. Try getImmerseEngagement (proposal EF). Returns data → proposal arm.
//   2. Returns null → try fetchTripClientData (confirmed EF).
//   3. Returns data → confirmed arm.
//   4. Both null → not-found (or not-public — EF returns null for both).
//
// The EFs enforce public_view and access control server-side.
// No probe, no pre-flight, no anon REST calls.
//
// Last updated: S53I — Collapse A. Removed illegal REST probe.

import type { EngagementClientData } from '../types/typesImmerseClient'
import { getProposalEngagement } from './queriesImmerseProposal'
import { fetchTripClientData } from './queriesImmerseTrip'

export type { TripGuides, TripContact, TripClientData } from '../types/typesImmerseClient'

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
  // Single EF call — travel-get-engagement-stage handles all engagements.
  // Stage is computed from the lifecycle status slug and returned on the data.
  // confirmed (trip/completed) → caller redirects to /{urlId} (brief surface)
  // proposal (proposal/draft)  → caller renders at /{urlId}/proposal
  const proposalData = await getProposalEngagement(urlId)
  if (!proposalData) {
    console.warn('[fetchEngagementClientData] EF returned null for urlId:', urlId)
    return { type: 'not-found' }
  }

  const stage = proposalData.stage
  if (stage === 'trip' || stage === 'completed') {
    return {
      type: 'data',
      data: { stage: 'confirmed', urlId, engagement: proposalData },
    }
  }

  return {
    type: 'data',
    data: { stage: 'proposal', urlId, engagement: proposalData },
  }
}