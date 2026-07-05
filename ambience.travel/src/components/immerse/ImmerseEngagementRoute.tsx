// ImmerseEngagementRoute.tsx — Unified client-facing engagement route.
//
// Collapse A: one route, one fetch, stage discriminant determines render.
// proposal  → ImmerseEngagementPage (destination rows, pricing, welcome)
// delivery → ImmerseDeliveryPage (confirmation, programme, brief, contacts)
//
// Phase dispatch:
//   loading    → ImmerseLayout shell (blank, no flash)
//   not-found  → NotFoundPage (dark, full page — engagement does not exist)
//   not-public → ImmerseNotPublicFallback (cream, full page — visibility gate)
//   error      → NotFoundPage (dark, full page — unexpected failure)
//   archived   → ImmerseProposalArchivedFallback (cream — proposal was archived)
//   proposal   → ImmerseEngagementPage (stage=proposal)
//   delivery   → ImmerseEngagementPage (stage=delivery)
//
// not-public is deliberately distinct from not-found:
//   not-found  = engagement does not exist (genuine 404)
//   not-public = engagement exists, public_view=false (visibility gate)
//   Both show full-page screens with no ImmerseLayout chrome. Different
//   surfaces, different messages, different colours.
//
// Last updated: S53 — not-public routes to ImmerseNotPublicFallback instead
//   of NotFoundPage. P0 gate screen: branded cream surface with tailored
//   message rather than the generic dark 404.
// Prior: S53I — Collapse A route layer.

import { useEffect, useState } from 'react'
import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseEngagementPage from './ImmerseEngagementPage'
import NotFoundPage from '../NotFoundPage'
import ImmerseProposalArchivedFallback from './ImmerseProposalArchivedFallback'
import ImmerseNotPublicFallback from './ImmerseNotPublicFallback'
import {
  fetchEngagementClientData,
} from '../../queries/queriesImmerseClient'
import { isProposalData, isDeliveryData } from '../../types/typesImmerseClient'
import type { ImmerseEngagementData } from '../../types/typesImmerse'
import type { DeliveryBundle } from '../../types/typesImmerseClient'

// ── Nav builder (shared across both surfaces) ─────────────────────────────────

export function buildImmerseNavItems(
  data: ImmerseEngagementData,
  activeDestSlug: string | null
) {
  const liveRows = data.destinationRows.filter(r => r.subpageStatus === 'live')
  const base = window.location.hostname === 'immerse.ambience.travel'
    ? `/${data.urlId}/proposal`
    : `/immerse/${data.urlId}/proposal`
  const overviewItem = {
    label:    'Overview',
    href:     base,
    isActive: !activeDestSlug,
  }
  return [
    overviewItem,
    ...liveRows.map(r => ({
      label:    r.title ?? r.destinationSlug ?? 'Destination',
      href:     `${base}/${r.destinationUrlSlug ?? r.destinationSlug}`,
      isActive: (r.destinationUrlSlug ?? r.destinationSlug) === activeDestSlug,
    })),
  ]
}

// ── Route state ───────────────────────────────────────────────────────────────

type RouteState =
  | { phase: 'loading'    }
  | { phase: 'not-found'  }
  | { phase: 'not-public' }
  | { phase: 'archived'   }
  | { phase: 'proposal';  data: ImmerseEngagementData }
  | { phase: 'delivery'; data: ImmerseEngagementData; bundle: DeliveryBundle }
  | { phase: 'error'                                  }

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

      if (isDeliveryData(data)) {
        setState({ phase: 'delivery', data: data.engagement, bundle: data.bundle })
      }
    })
  }, [urlId])

  return state
}

// ── Route component ───────────────────────────────────────────────────────────

interface ImmerseEngagementRouteProps {
  activeDestSlug?:  string | null
  isProposalPath?:  boolean
}

function extractUrlId(): string {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const immerseIdx = parts.indexOf('immerse')
  if (immerseIdx !== -1) return parts[immerseIdx + 1] ?? ''
  return parts[0] ?? ''
}

export default function ImmerseEngagementRoute({
  activeDestSlug  = null,
  isProposalPath  = false,
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
    return <NotFoundPage message="We couldn't find that page." />
  }

  if (state.phase === 'not-public') {
    return <ImmerseNotPublicFallback />
  }

  if (state.phase === 'archived') {
    return <ImmerseProposalArchivedFallback />
  }

  if (state.phase === 'proposal') {
    // Proposal engagements must be accessed at /{urlId}/proposal
    // If someone hits the root /{urlId} for a proposal, redirect to /proposal
    if (!isProposalPath) {
      const proposalBase = window.location.hostname === 'immerse.ambience.travel'
        ? `/${urlId}/proposal`
        : `/immerse/${urlId}/proposal`
      const proposalUrl = activeDestSlug ? `${proposalBase}/${activeDestSlug}` : proposalBase
      window.location.replace(proposalUrl)
      return <ImmerseLayout><div style={{ minHeight: '60vh' }} /></ImmerseLayout>
    }
    return (
      <ImmerseEngagementPage
        data={{ stage: 'proposal', urlId, engagement: state.data }}
        activeDestSlug={activeDestSlug}
      />
    )
  }

  if (state.phase === 'delivery') {
    // Delivery engagements render at root /{urlId} — the brief/confirmation/programme surface.
    // A hit on /{urlId}/proposal for a delivery engagement redirects to root.
    if (isProposalPath) {
      const rootUrl = window.location.hostname === 'immerse.ambience.travel'
        ? `/${urlId}`
        : `/immerse/${urlId}`
      window.location.replace(rootUrl)
      return <ImmerseLayout><div style={{ minHeight: '60vh' }} /></ImmerseLayout>
    }
    return (
      <ImmerseEngagementPage
        data={{ stage: 'delivery', urlId, engagement: state.data, bundle: state.bundle }}
        activeDestSlug={activeDestSlug}
      />
    )
  }
  return null
}