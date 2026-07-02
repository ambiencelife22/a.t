// queriesImmerseClient.ts — Unified client-facing engagement data fetch.
//
// Collapse A: replaces two parallel fetch paths:
//   - fetchImmerseEngagement (proposal, calls travel-get-immerse-engagement)
//   - fetchTripClientData (confirmed, calls travel-get-trip-confirmation)
//
// How it works:
//   1. Probe the engagement status via a lightweight status-only call.
//   2. Based on status slug, resolve the stage (proposal | confirmed).
//   3. Fetch the full data from the appropriate EF.
//   4. Return EngagementClientData discriminated union.
//
// The status probe is a single row fetch — cheap, fast, no service role needed.
// It uses the public anon key; the engagement's public_view gate is enforced
// by the EF, not here.
//
// BACKWARD COMPATIBILITY: both underlying fetch functions are still exported
// directly from their original files. This file composes them — it does NOT
// replace them yet. Callers can migrate to fetchEngagementClientData
// incrementally. Original files are NOT deleted until all callers migrate.
//
// Last updated: S53I — Collapse A queries layer (additive, no deletions).

import type { EngagementClientData } from '../types/typesImmerseClient'
import { resolveStage } from '../types/typesImmerseClient'
import { fetchTripClientData } from './queriesImmerseTrip'
import { getImmerseEngagement } from './queriesImmerseEngagement'
export type { TripGuides, TripContact, TripClientData } from '../types/typesImmerseClient'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Lightweight status probe — resolves url_id → status slug without a full EF call.
async function probeEngagementStatus(urlId: string): Promise<{
  statusSlug:  string | null
  publicView:  boolean
} | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/travel_immerse_engagements` +
      `?url_id=eq.${encodeURIComponent(urlId)}` +
      `&select=public_view,travel_lifecycle_statuses(slug)` +
      `&limit=1`,
      {
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
    if (!res.ok) return null
    const rows = await res.json()
    if (!rows?.length) return null
    const row = rows[0]
    return {
      statusSlug: row.travel_lifecycle_statuses?.slug ?? null,
      publicView: row.public_view ?? false,
    }
  } catch {
    return null
  }
}

// ── Unified fetch ─────────────────────────────────────────────────────────────

export type FetchEngagementResult =
  | { type: 'data';      data: EngagementClientData }
  | { type: 'not-found'                             }
  | { type: 'not-public'                            }
  | { type: 'error';     message: string            }

export async function fetchEngagementClientData(
  urlId: string
): Promise<FetchEngagementResult> {
  // Step 1: probe status
  const probe = await probeEngagementStatus(urlId)

  if (!probe) return { type: 'not-found' }
  if (!probe.publicView) return { type: 'not-public' }

  const stage = resolveStage(probe.statusSlug)

  // Step 2: fetch full data from the appropriate EF
  if (stage === 'confirmed') {
    const data = await fetchTripClientData(urlId)
    if (!data) return { type: 'error', message: 'Failed to load engagement' }
    return { type: 'data', data: { stage: 'confirmed', urlId, engagement: data } }
  }

  // stage === 'proposal'
  const data = await getImmerseEngagement(urlId)
  if (!data) return { type: 'error', message: 'Failed to load engagement' }
  return { type: 'data', data: { stage: 'proposal', urlId, engagement: data } }
}