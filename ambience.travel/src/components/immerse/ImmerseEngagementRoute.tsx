// ImmerseEngagementRoute.tsx — Route resolver for immerse engagement pages.
// Resolves url_id (+ optional destination_slug or surface) from pathname, with
// hostname-aware path parsing.
//
// Subdomain awareness:
//   immerse.ambience.travel/<url_id>[/<dest>]   → path[0] = url_id
//   ambience.travel/immerse/<url_id>[/<dest>]   → path[1] = url_id (path[0] = 'immerse')
//   localhost:5173/immerse/<url_id>[/<dest>]    → same as above
//
// Route kinds (discriminated union):
//   overview      → no second segment — renders ImmerseEngagementPage
//   destination   → second segment is a destination slug — renders DestinationPage
//   confirmation  → second segment === 'confirmation' — renders TripConfirmationPage
//   programme     → second segment === 'programme' — renders TripProgrammePage
//   trip          → second segment === 'trip' — renders ImmerseTripPage (unified)
//   invalid       → no valid url_id in first segment — redirects
//
// Architecture note:
//   Engagement data fetching (getImmerseEngagement) is isolated in
//   EngagementRoute — a separate component mounted only for overview +
//   destination routes. This prevents hooks-after-conditional-returns which
//   caused getImmerseEngagement to fire on confirmation/programme routes,
//   making unauthorised direct Supabase queries.
//
// Last updated: S48 — ImmerseTripPage added as unified client surface.
//   Route kind 'trip' resolves /{url_id}/trip → ImmerseTripPage.
// Prior: S48 — engagement state + fetch extracted into EngagementRoute
//   component to fix hooks-after-conditional-returns bug.
// Prior: S48 — confirmation and programme route kinds added.
// Prior: S32F — immersePath helpers, overview URL builder.

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

const RESERVED_SEGMENTS = new Set(['confirmation', 'programme', 'trip'])

// ── URL resolution ────────────────────────────────────────────────────────────

type ResolvedRoute =
  | { kind: 'overview';     urlId: string }
  | { kind: 'destination';  urlId: string; destinationSlug: string }
  | { kind: 'confirmation'; urlId: string }
  | { kind: 'programme';    urlId: string }
  | { kind: 'trip';         urlId: string }
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
  if (seg2 === 'trip')         return { kind: 'trip',         urlId: seg1 }

  if (seg2 && !RESERVED_SEGMENTS.has(seg2)) return { kind: 'destination', urlId: seg1, destinationSlug: seg2 }

  return { kind: 'overview', urlId: seg1 }
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
  route: Extract<ResolvedRoute, { kind: 'overview' | 'destination' | 'invalid' }>
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

  if (error === 'not-found') {
    return (
      <ImmerseLayout>
        <NotFound message='This proposal is not available.' />
      </ImmerseLayout>
    )
  }

  if (route.kind === 'overview' && engagement) {
    return <ImmerseEngagementPage data={engagement} />
  }

  if (route.kind === 'destination' && engagement) {
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

  if (route.kind === 'trip') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ImmerseTripPage urlId={route.urlId} />
      </Suspense>
    )
  }

  return <EngagementRoute route={route as any} />
}