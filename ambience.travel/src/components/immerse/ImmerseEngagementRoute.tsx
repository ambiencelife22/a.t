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
//   invalid       → no valid url_id in first segment — redirects
//
// Reserved second segments ('confirmation', 'programme') are intercepted before
// the destinationSlug branch. All future client-facing trip surfaces follow the
// same pattern — add to RESERVED_SEGMENTS and add a route kind.
//
// Last updated: S48 — confirmation and programme route kinds added.
//   resolveImmerseRoute extended with RESERVED_SEGMENTS intercept. Lazy imports
//   for TripConfirmationPage and TripProgrammePage added.
// Prior: S32F — Inline IMMERSE_HOST + isImmerseHost() removed. url_id regex
//   match goes through isTripUrlId from lib/immersePath. Inline overview-URL
//   builder swapped for getOverviewUrl().
// Prior: S32D — Back-button fix. `kind` derived synchronously from pathname.
// Prior: S32 — Subdomain-aware path parsing.

import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { getImmerseEngagement }              from '../../lib/immerseEngagementQueries'
import type { ImmerseEngagementData }        from '../../lib/immerseTypes'
import ImmerseEngagementPage                 from './ImmerseEngagementPage'
import DestinationPage                       from './DestinationPage'
import ImmerseLayout, { type ImmerseNavItem } from '../layouts/ImmerseLayout'
import { TravelLoadingScreen, NotFound }     from './ImmerseStateScreens'
import { isImmerseHost, isTripUrlId, getOverviewUrl } from '../../lib/immersePath'
import RouteLoading from '../RouteLoading'

const TripConfirmationPage = lazy(() => import('./TripConfirmationPage.tsx'))
const TripProgrammePage    = lazy(() => import('./TripProgrammePage'))

// ── Reserved second segments ──────────────────────────────────────────────────
// These are intercepted before destinationSlug resolution. Extend here to add
// future client-facing trip surfaces.

const RESERVED_SEGMENTS = new Set(['confirmation', 'programme'])

// ── URL resolution ───────────────────────────────────────────────────────────

type ResolvedRoute =
  | { kind: 'overview';     urlId: string }
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

  // Reserved segments — client-facing trip surfaces
  if (seg2 === 'confirmation') return { kind: 'confirmation', urlId: seg1 }
  if (seg2 === 'programme')    return { kind: 'programme',    urlId: seg1 }

  // Destination subpage
  if (seg2 && !RESERVED_SEGMENTS.has(seg2)) return { kind: 'destination', urlId: seg1, destinationSlug: seg2 }

  return { kind: 'overview', urlId: seg1 }
}

// ── Nav items builder ────────────────────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────────────────────

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

  // Confirmation and programme pages handle their own data fetching
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

  // Engagement-based routes (overview + destination) — need engagement data
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