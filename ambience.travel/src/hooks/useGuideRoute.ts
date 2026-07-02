// useGuideRoute.ts — shared route logic for all four guide variants.
//
// What it owns:
//   - Path parsing (extract destinationSlug from window.location)
//   - Destination + overlay fetch (via queriesGuides.getGuideDestination)
//   - Overlay gate — destinations without an overlay for the requested
//     variant resolve to notPublic (distinct from notFound — the destination
//     exists but the guide for this variant is not publicly visible)
//   - Grant check + hasFullAccess resolution
//   - Error handling
//   - Loading / ready / notPublic / notFound state machine
//
// What it does not own:
//   - The actual page component — route files render the variant-specific
//     page after the hook returns 'ready'
//   - GuideLayout chrome
//
// Phase semantics:
//   loading   — fetch in flight
//   ready     — destination + overlay found, hasFullAccess resolved
//   notPublic — destination found, overlay missing for this variant.
//               The guide exists but is not publicly visible. Route renders
//               the variant-specific GuideGate* screen inside GuideLayout.
//   notFound  — destination slug unresolvable, destination not in DB, or
//               unexpected error. Route renders NotFoundPage (dark, full page).
//
// Last updated: S53 — Added notPublic phase. Overlay gate previously resolved
//   to notFound with message "This guide isn't available yet." — indistinguishable
//   from a genuine 404 and showing a dark full-page error for a deliberate
//   visibility decision. notPublic now routes to the variant-specific
//   GuideGate* inline screen inside GuideLayout.
// Prior: S53 — initial build. Consolidated four near-identical route files
//   into one hook + four thin wrappers. Added overlay gate.

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
  | { phase: 'loading'   }
  | { phase: 'ready';     destination: GuideDestination; hasFullAccess: boolean }
  | { phase: 'notPublic'; destination: GuideDestination }
  | { phase: 'notFound';  message: string }

// ── Path parsing ─────────────────────────────────────────────────────────────
//
// On guides.ambience.travel: /miami/shopping → slug=miami, segment=shopping
// On ambience.travel:        /guides/miami/shopping → slug=miami, segment=shopping

function resolveDestinationSlug(variant: GuideVariant): string | null {
  const expectedSegment = GUIDE_ROUTE_SEGMENTS[variant]

  const pathname     = window.location.pathname.replace(/\/+$/, '')
  const isGuidesHost = window.location.hostname === GUIDES_HOST

  let stripped = ''
  if (isGuidesHost) {
    stripped = pathname.replace(/^\/+/, '')
  }
  if (!isGuidesHost) {
    if (!pathname.startsWith('/guides/')) return null
    stripped = pathname.replace(/^\/guides\/?/, '').replace(/^\/+/, '')
  }

  const parts = stripped.split('/').filter(Boolean)
  if (parts.length === 2 && parts[1] === expectedSegment) {
    return parts[0]
  }
  return null
}

// ── Hook ─────────────────────────────────────────────────────────────────────

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

        // Overlay gate — destination exists but no guide overlay for this
        // variant. This is a deliberate visibility decision, not a 404.
        // Route renders the variant-specific GuideGate* screen inline inside
        // GuideLayout so the guest still sees destination context.
        if (!dest.overlay) {
          setState({ phase: 'notPublic', destination: dest })
          return
        }

        let hasFullAccess = false
        try {
          const grant = await checkGuideGrant(variant, slug)
          hasFullAccess = grant.status === 'granted' || grant.status === 'ungated'
        } catch (grantErr) {
          console.warn(`useGuideRoute(${variant}): grant check failed, defaulting to teaser`, grantErr)
          hasFullAccess = false
        }
        if (cancelled) return

        setState({ phase: 'ready', destination: dest, hasFullAccess })
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