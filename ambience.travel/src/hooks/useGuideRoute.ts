// useGuideRoute.ts — shared route logic for all four guide variants.
//
// What it owns:
//   - Path parsing (extract destinationSlug from window.location)
//   - Destination + overlay fetch (via queriesGuides.getGuideDestination)
//   - Overlay gate — destinations without an overlay for the requested
//     variant resolve to notFound (e.g. miami/shopping when no
//     travel_shopping_guides row exists for Miami)
//   - Grant check + hasFullAccess resolution
//   - Error handling
//   - Loading / ready / notFound state machine
//
// What it does not own:
//   - The actual page component — route files render the variant-specific
//     page after the hook returns 'ready'
//   - GuideLayout chrome
//
// Standing rule (S53):
//   No destination should render the guide framework without data. If no
//   overlay exists for the requested variant, the route resolves to 404.
//   This prevents shells like miami/shopping showing chrome with no content.
//
// Last updated: S53 — initial build. Consolidates four near-identical route
//   files into one hook + four thin wrappers. Adds the overlay gate.

import { useEffect, useRef, useState } from 'react'
import { useToast } from '../providers/ToastContext'
import {
  getGuideDestination,
  checkGuideGrant,
} from '../queries/queriesGuides'
import {
  GUIDE_ROUTE_SEGMENTS,
  type GuideDestination,
  type GuideVariant,
} from '../types/typesGuides'

const GUIDES_HOST = 'guides.ambience.travel'

export type GuideRouteState =
  | { phase: 'loading' }
  | { phase: 'ready';    destination: GuideDestination; hasFullAccess: boolean }
  | { phase: 'notFound'; message: string }

// ── Path parsing ────────────────────────────────────────────────────────────
//
// On guides.ambience.travel: /miami/shopping → slug=miami, segment=shopping
// On ambience.travel:        /guides/miami/shopping → slug=miami, segment=shopping

function resolveDestinationSlug(variant: GuideVariant): string | null {
  const expectedSegment = GUIDE_ROUTE_SEGMENTS[variant]

  const pathname     = window.location.pathname.replace(/\/+$/, '')
  const isGuidesHost = window.location.hostname === GUIDES_HOST

  let stripped: string
  if (isGuidesHost) {
    stripped = pathname.replace(/^\/+/, '')
  } else {
    if (!pathname.startsWith('/guides/')) return null
    stripped = pathname.replace(/^\/guides\/?/, '').replace(/^\/+/, '')
  }

  const parts = stripped.split('/').filter(Boolean)
  if (parts.length === 2 && parts[1] === expectedSegment) {
    return parts[0]
  }
  return null
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useGuideRoute(variant: GuideVariant): GuideRouteState {
  const { toast }         = useToast()
  const toastRef          = useRef(toast)
  const [state, setState] = useState<GuideRouteState>({ phase: 'loading' })

  useEffect(() => { toastRef.current = toast }, [toast])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const slug = resolveDestinationSlug(variant)

      if (!slug) {
        if (cancelled) return
        setState({ phase: 'notFound', message: "We couldn't find that page." })
        return
      }

      try {
        const dest = await getGuideDestination(variant, slug)
        if (cancelled) return

        if (!dest) {
          toastRef.current.warning("We couldn't find that destination.")
          setState({ phase: 'notFound', message: "We couldn't find that destination." })
          return
        }

        // Overlay gate — the actual "miami/shopping" fix. A destination
        // without an overlay for this variant resolves to 404 rather than
        // rendering chrome with no data.
        if (!dest.overlay) {
          setState({ phase: 'notFound', message: "This guide isn't available yet." })
          return
        }

        let hasFullAccess = false
        try {
          const grant = await checkGuideGrant(variant, slug)
          // 'granted' or 'ungated' (variant has no grant infrastructure) → full access
          hasFullAccess = grant.status === 'granted' || grant.status === 'ungated'
        } catch (grantErr) {
          console.warn(`useGuideRoute(${variant}): grant check failed, defaulting to teaser`, grantErr)
          hasFullAccess = false
        }
        if (cancelled) return

        setState({
          phase:         'ready',
          destination:   dest,
          hasFullAccess,
        })
      } catch (err) {
        console.error(`useGuideRoute(${variant}): failed to load destination`, err)
        if (cancelled) return
        toastRef.current.warning('Something went wrong loading that guide.')
        setState({ phase: 'notFound', message: 'Something went wrong. Please try again.' })
      }
    }

    load()
    return () => { cancelled = true }
  }, [variant])

  return state
}