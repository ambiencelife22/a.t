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
import { getImmerseEngagement } from './queriesImmerseEngagement'
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
  // Step 1: try confirmed EF (confirmation/brief — primary state)
  try {
    const confirmedData = await fetchTripClientData(urlId)
    if (confirmedData) {
      return {
        type: 'data',
        data: { stage: 'confirmed', urlId, engagement: confirmedData },
      }
    }
  } catch {
    // confirmed EF failed — try proposal
  }

  // Step 2: try proposal EF (fallback)
  try {
    const proposalData = await getImmerseEngagement(urlId)
    if (proposalData) {
      return {
        type: 'data',
        data: { stage: 'proposal', urlId, engagement: proposalData },
      }
    }
  } catch {
    // proposal EF also failed
  }

  return { type: 'not-found' }
}