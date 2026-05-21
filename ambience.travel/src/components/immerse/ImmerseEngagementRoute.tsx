// ImmerseEngagementRoute.tsx — Route resolver for immerse engagement pages.
//
// Routing logic (S48 late):
//   /{url_id}                → trip surface if trip exists, else proposal overview
//   /{url_id}/proposal       → proposal overview (explicit)
//   /{url_id}/{destination}  → destination subpage
//   /{url_id}/confirmation   → legacy confirmation page (still live)
//   /{url_id}/programme      → legacy programme page (still live)
//
// Data-driven default: when proposal content exists, bare URL renders proposal.
// When no proposal content but trip is linked, bare URL renders trip surface.
// When neither, not found.
//
// Last updated: S48 — bare /{url_id} renders trip surface when no proposal
//   content exists. /{url_id}/proposal explicitly renders proposal. /trip
//   segment removed.

import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { getImmerseEngagement }              from '../../queries/queriesImmerseEngagement'
import type { ImmerseEngagementData }        from '../../types/typesImmerse'
import ImmerseEngagementPage                 from './ImmerseEngagementPage'
import DestinationPage                       from './DestinationPage'
import ImmerseLayout, { type ImmerseNavItem } from '../layouts/ImmerseLayout'
import { TravelLoadingScreen, NotFound }     from './ImmerseStateScreens'
import { isImmerseHost, isTripUrlId, getOverviewUrl } from '../../utils/utilsImmersePath'
import RouteLoading from '../RouteLoading'

const TripConfirmationPage = lazy(() => import('./TripConfirmationPage'))
const TripProgrammePage    = lazy(() => import('./TripProgrammePage'))
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

// ── Content detection ─────────────────────────────────────────────────────────

function hasProposalContent(engagement: ImmerseEngagementData): boolean {
  return !!(
    engagement.heroTagline ||
    engagement.routeBody ||
    engagement.destinationBody ||
    engagement.pricingBody ||
    engagement.pricingTotalValue ||
    (engagement.destinationRows && engagement.destinationRows.length > 0)
  )
}

function hasTripContent(engagement: ImmerseEngagementData): boolean {
  return !!engagement.tripId
}

// ── Nav items builder ─────────────────────────────────────────────────────────

export function buildImmerseNavItems(
  engagement: ImmerseEngagementData,
  currentDestinationSlug: string | null,
): ImmerseNavItem[] {
  const base = getOverviewUrl(engagement.urlId)

  const items: ImmerseNavItem[] = [
    {
      label:    'Trip Overview',
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
        <NotFound message='This page is not available.' />
      </ImmerseLayout>
    )
  }

  // Bare URL — content-driven
  if (route.kind === 'auto') {
    // Trip wins the bare URL whenever it exists
    if (hasTripContent(engagement)) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <ImmerseTripPage urlId={engagement.urlId} />
        </Suspense>
      )
    }
    // No trip but proposal exists — redirect to explicit /proposal
    if (hasProposalContent(engagement)) {
      const target = `${getOverviewUrl(engagement.urlId)}/proposal`
      window.location.replace(target)
      return (
        <ImmerseLayout>
          <TravelLoadingScreen />
        </ImmerseLayout>
      )
    }
    return (
      <ImmerseLayout>
        <NotFound message='This page is not available.' />
      </ImmerseLayout>
    )
  }

  // Explicit /proposal
  if (route.kind === 'proposal') {
    return <ImmerseEngagementPage data={engagement} />
  }

  // Destination subpage
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
        <TripConfirmationPage urlId={route.urlId} />
      </Suspense>
    )
  }

  if (route.kind === 'programme') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <TripProgrammePage urlId={route.urlId} />
      </Suspense>
    )
  }

  return <EngagementRoute route={route as any} />
}