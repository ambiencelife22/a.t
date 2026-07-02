// ImmerseEngagementRoute.tsx — Unified client-facing engagement route.
//
// Collapse A: one route, one fetch, stage discriminant determines render.
// proposal  → ImmerseEngagementPage (destination rows, pricing, welcome)
// confirmed → ImmerseTripPage (confirmation, programme, brief, contacts)
//
// Both page components are unchanged in this layer — the unified page
// component (ImmerseEngagementPage rewritten) is the next Collapse A step.
//
// Last updated: S53I — Collapse A route layer.

import { useEffect, useState } from 'react'
import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseEngagementPage from './ImmerseEngagementPage'
import NotFoundPage from '../NotFoundPage'
import ProposalArchivedFallback from './ProposalArchivedFallback'
import {
  fetchEngagementClientData,
} from '../../queries/queriesImmerseClient'
import { isProposalData, isConfirmedData } from '../../types/typesImmerseClient'
import type { ImmerseEngagementData } from '../../types/typesImmerse'
import type { TripClientData } from '../../types/typesImmerseClient'

// ── Nav builder (shared across both surfaces) ─────────────────────────────────

export function buildImmerseNavItems(
  data: ImmerseEngagementData | TripClientData,
  activeDestSlug: string | null
) {
  if ('destinationRows' in data) {
    const liveRows = data.destinationRows.filter(r => r.subpageStatus === 'live')
    return liveRows.map(r => ({
      label:    r.title ?? r.destinationSlug ?? 'Destination',
      href:     `/immerse/${data.urlId}/${r.destinationSlug}`,
      isActive: r.destinationSlug === activeDestSlug,
    }))
  }
  return []
}

// ── Route state ───────────────────────────────────────────────────────────────

type RouteState =
  | { phase: 'loading'    }
  | { phase: 'not-found'  }
  | { phase: 'not-public' }
  | { phase: 'archived'   }
  | { phase: 'proposal';  data: ImmerseEngagementData }
  | { phase: 'confirmed'; data: TripClientData        }
  | { phase: 'error'                                            }

// ── Hook ──────────────────────────────────────────────────────────────────────

function useEngagementRoute(urlId: string): RouteState {
  const [state, setState] = useState<RouteState>({ phase: 'loading' })

  useEffect(() => {
    setState({ phase: 'loading' })
    fetchEngagementClientData(urlId).then(result => {
      if (result.type === 'not-found')  { setState({ phase: 'not-found'  }); return }
      if (result.type === 'not-public') { setState({ phase: 'not-public' }); return }
      if (result.type === 'error')      { setState({ phase: 'error'      }); return }

      const { data } = result

      if (isProposalData(data)) {
        const eng = data.engagement
        if (eng.proposalVisibility === 'archived') { setState({ phase: 'archived' }); return }
        setState({ phase: 'proposal', data: eng })
        return
      }

      if (isConfirmedData(data)) {
        setState({ phase: 'confirmed', data: data.engagement })
      }
    })
  }, [urlId])

  return state
}

// ── Route component ───────────────────────────────────────────────────────────

const NOT_VISIBLE_MSG = 'This page is not publicly visible. Please reach out to your travel designer to pick things back up; they will be glad to share what\u2019s next.'

interface ImmerseEngagementRouteProps {
  activeDestSlug?: string | null
  activeTab?:      string | null
}

function extractUrlId(): string {
  const parts = window.location.pathname.split('/').filter(Boolean)
  // /immerse/:url_id[/:dest] or immerse.ambience.travel/:url_id[/:dest]
  const immerseIdx = parts.indexOf('immerse')
  if (immerseIdx !== -1) return parts[immerseIdx + 1] ?? ''
  return parts[0] ?? ''
}

export default function ImmerseEngagementRoute({
  activeDestSlug = null,
  activeTab      = null,
}: ImmerseEngagementRouteProps) {
  const urlId = extractUrlId()
  const state = useEngagementRoute(urlId)

  if (state.phase === 'loading') {
    return (
      <ImmerseLayout>
        <div style={{ minHeight: '60vh' }} />
      </ImmerseLayout>
    )
  }

  if (state.phase === 'not-found' || state.phase === 'error') {
    return <NotFoundPage message={NOT_VISIBLE_MSG} />
  }

  if (state.phase === 'not-public') {
    return <NotFoundPage message={NOT_VISIBLE_MSG} />
  }

  if (state.phase === 'archived') {
    return <ProposalArchivedFallback />
  }

  if (state.phase === 'proposal') {
    return (
      <ImmerseEngagementPage
        data={{ stage: 'proposal', urlId, engagement: state.data }}
        activeTab={activeTab}
        activeDestSlug={activeDestSlug}
      />
    )
  }

  if (state.phase === 'confirmed') {
    return (
      <ImmerseEngagementPage
        data={{ stage: 'confirmed', urlId, engagement: state.data }}
        activeTab={activeTab}
        activeDestSlug={activeDestSlug}
      />
    )
  }

  return null
}