// ImmerseEngagementRoute.tsx — Route resolver for immerse engagement pages.
//
// Routing logic (S48 late — stage-driven):
//   /{url_id}                → routes based on engagement.stage
//   /{url_id}/proposal       → proposal overview (explicit, always renders)
//   /{url_id}/{destination}  → destination subpage
//   /{url_id}/confirmation   → legacy confirmation page (still live)
//   /{url_id}/programme      → legacy programme page (still live)
//
// Bare URL routing is data-driven via the computed `stage` field on the
// engagement, set in the query layer based on status + content presence.
//
//   stage 'trip' / 'completed'              → render ImmerseTripPage
//   stage 'proposal'                        → redirect to /proposal
//   stage 'draft' / 'cancelled'             → not found
//
// Last updated: S48 — bare URL is stage-driven. /proposal is the explicit
//   proposal route. Trip stage takes bare URL when active. /trip segment
//   removed entirely.

import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { getImmerseEngagement }              from '../../queries/queriesImmerseEngagement'
import type { ImmerseEngagementData }        from '../../types/typesImmerse'
import ImmerseEngagementPage                 from './ImmerseEngagementPage'
import DestinationPage                       from './DestinationPage'
import ImmerseLayout, { type ImmerseNavItem } from '../layouts/ImmerseLayout'
import { TravelLoadingScreen, NotFound }     from './ImmerseStateScreens'
import { isImmerseHost, isTripUrlId, getOverviewUrl } from '../../utils/utilsImmersePath'
import RouteLoading from '../RouteLoading'
import ProposalArchivedFallback              from './ProposalArchivedFallback'

const ImmerseTripPage      = lazy(() => import('./ImmerseTripPage'))

// ── Reserved second segments ──────────────────────────────────────────────────

const RESERVED_SEGMENTS = new Set(['confirmation', 'programme', 'proposal'])

// ── URL resolution ────────────────────────────────────────────────────────────

type ResolvedRoute =
  | { kind: 'auto';         urlId: string }
  | { kind: 'proposal';     urlId: string }
  | { kind: 'destination';  urlId: string; destinationSlug: string }
  | { kind: 'confirmation'; urlId: string }
  | { kind: 'programme';    urlId: string }
  | { kind: 'invalid' }

export function resolveImmerseRoute(pathname: string): ResolvedRoute {
  const stripped = isImmerseHost()
    ? pathname.replace(/^\/+|\/+$/g, '')
    : pathname.replace(/^\/+|\/+$/g, '').replace(/^immerse\/?/, '')

  const parts = stripped.split('/').filter(Boolean)
  const seg1 = parts[0]
  const seg2 = parts[1]

  if (!seg1) return { kind: 'invalid' }
  if (!isTripUrlId(seg1)) return { kind: 'invalid' }

  if (seg2 === 'confirmation') return { kind: 'confirmation', urlId: seg1 }
  if (seg2 === 'programme')    return { kind: 'programme',    urlId: seg1 }
  if (seg2 === 'proposal')     return { kind: 'proposal',     urlId: seg1 }

  if (seg2 && !RESERVED_SEGMENTS.has(seg2)) return { kind: 'destination', urlId: seg1, destinationSlug: seg2 }

  return { kind: 'auto', urlId: seg1 }
}

// ── Nav items builder ─────────────────────────────────────────────────────────

export function buildImmerseNavItems(
  engagement: ImmerseEngagementData,
  currentDestinationSlug: string | null,
): ImmerseNavItem[] {
  const base = getOverviewUrl(engagement.urlId)

  const items: ImmerseNavItem[] = [
    {
      label:    'Overview',
      href:     base,
      isActive: currentDestinationSlug === null,
    },
  ]

  for (const row of engagement.destinationRows) {
    const slug = row.destinationUrlSlug ?? row.destinationSlug ?? ''
    if (!slug) continue
    items.push({
      label:     row.title || slug,
      href:      `${base}/${slug}`,
      isActive:  currentDestinationSlug === slug,
      isPreview: row.subpageStatus === 'preview',
    })
  }

  return items
}

// ── EngagementRoute ───────────────────────────────────────────────────────────

function EngagementRoute({ route }: {
  route: Extract<ResolvedRoute, { kind: 'auto' | 'proposal' | 'destination' | 'invalid' }>
}) {
  const [engagement, setEngagement] = useState<ImmerseEngagementData | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  const urlId = route.kind === 'invalid' ? null : route.urlId

  useEffect(() => {
    if (!urlId) {
      setError('not-found')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const engagementData = await getImmerseEngagement(urlId!)
      if (cancelled) return
      if (!engagementData) {
        setError('not-found')
        setLoading(false)
        return
      }
      setEngagement(engagementData)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [urlId])

  const currentDestinationSlug = route.kind === 'destination' ? route.destinationSlug : null

  const navItems = useMemo(
    () => engagement ? buildImmerseNavItems(engagement, currentDestinationSlug) : undefined,
    [engagement, currentDestinationSlug],
  )

  const logoHref = engagement ? getOverviewUrl(engagement.urlId) : undefined

  if (loading) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <TravelLoadingScreen />
      </ImmerseLayout>
    )
  }

  if (error === 'not-found' || !engagement) {
    return (
      <ImmerseLayout>
        <NotFound
          message='This page is not publicly visible.'
          subMessage='Please reach out to your travel designer to pick things back up — they will be glad to share what&apos;s next.'
        />
      </ImmerseLayout>
    )
  }

  // ── Archived proposal → graceful fallback (AXIS-2) ────────────────────────
  // Only fires for proposal-family routes (proposal, destination, auto-as-proposal).
  // trip/completed stages are intentionally unaffected — archive is a proposal axis.
  const isProposalFamilyRoute = route.kind === 'proposal' || route.kind === 'destination' ||
    (route.kind === 'auto' && engagement.stage === 'proposal')
  if (engagement.proposalVisibility === 'archived' && isProposalFamilyRoute) {
    return (
      <ImmerseLayout logoHref={logoHref}>
        <ProposalArchivedFallback />
      </ImmerseLayout>
    )
  }

  // ── Bare URL — stage-driven routing ───────────────────────────────────────
  if (route.kind === 'auto') {
    switch (engagement.stage) {
      case 'trip':
      case 'completed':
        return (
          <Suspense fallback={<RouteLoading />}>
            <ImmerseTripPage urlId={engagement.urlId} />
          </Suspense>
        )

      case 'proposal': {
        // Explicit redirect to /proposal — bare URL is for trip surfaces only
        const target = `${getOverviewUrl(engagement.urlId)}/proposal`
        window.location.replace(target)
        return (
          <ImmerseLayout>
            <TravelLoadingScreen />
          </ImmerseLayout>
        )
      }

      case 'draft':
      case 'cancelled':
      default:
        return (
          <ImmerseLayout>
            <NotFound message='This page is not available.' />
          </ImmerseLayout>
        )
    }
  }

  // ── Explicit /proposal route ──────────────────────────────────────────────
  if (route.kind === 'proposal') {
    return <ImmerseEngagementPage data={engagement} />
  }

  // ── Destination subpage ───────────────────────────────────────────────────
  if (route.kind === 'destination') {
    return (
      <DestinationPage
        engagement={engagement}
        destinationSlug={route.destinationSlug}
      />
    )
  }

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <NotFound message='Something went wrong. Please try again.' />
    </ImmerseLayout>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImmerseEngagementRoute() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    function sync() { setPathname(window.location.pathname) }
    window.addEventListener('popstate', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  const route = useMemo(() => resolveImmerseRoute(pathname), [pathname])

  if (route.kind === 'confirmation') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ImmerseTripPage urlId={route.urlId} initialTab='confirmation' />
      </Suspense>
    )
  }

  if (route.kind === 'programme') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ImmerseTripPage urlId={route.urlId} initialTab='programme' />
      </Suspense>
    )
  }

  return <EngagementRoute route={route as any} />
}