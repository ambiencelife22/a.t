// ImmerseEngagementRoute.tsx — Route resolver for immerse engagement pages.
// Resolves url_id (+ optional destination_slug) from pathname, with
// hostname-aware path parsing.
//
// Subdomain awareness:
//   immerse.ambience.travel/<url_id>[/<dest>]   → path[0] = url_id
//   ambience.travel/immerse/<url_id>[/<dest>]   → path[1] = url_id (path[0] = 'immerse')
//   localhost:5173/immerse/<url_id>[/<dest>]    → same as above
//
// Overview (no destination segment)  → fetches engagement, renders ImmerseEngagementPage.
// Destination (with slug)             → fetches engagement, renders DestinationPage.
// No React Router — reads window.location.pathname directly.
//
// Last updated: S32D — Back-button fix. `kind` is now derived synchronously
//   from pathname instead of being React state set inside an async effect.
//   On back-navigation, render decisions use the current URL on the same tick
//   the URL changes, eliminating the stale-state window where a destination
//   slug is gone from the URL but DestinationPage still mounted. Engagement
//   fetch runs only when urlId changes, not on every pathname change.
// Prior: S32 — Subdomain-aware path parsing. resolveImmerseRoute strips the
//   /immerse/ prefix only when not on the immerse subdomain.

import { useEffect, useMemo, useState } from 'react'
import { getImmerseEngagement }            from '../../lib/immerseEngagementQueries'
import type { ImmerseEngagementData }      from '../../lib/immerseTypes'
import ImmerseEngagementPage               from './ImmerseEngagementPage'
import DestinationPage                     from './DestinationPage'
import ImmerseLayout, { type ImmerseNavItem } from '../layouts/ImmerseLayout'
import { TravelLoadingScreen, NotFound } from './ImmerseStateScreens'

const IMMERSE_HOST = 'immerse.ambience.travel'

function isImmerseHost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === IMMERSE_HOST
}

// ── URL resolution ───────────────────────────────────────────────────────────

type ResolvedRoute =
  | { kind: 'overview';    urlId: string }
  | { kind: 'destination'; urlId: string; destinationSlug: string }
  | { kind: 'invalid' }

export function resolveImmerseRoute(pathname: string): ResolvedRoute {
  const stripped = isImmerseHost()
    ? pathname.replace(/^\/+|\/+$/g, '')
    : pathname.replace(/^\/+|\/+$/g, '').replace(/^immerse\/?/, '')

  const parts = stripped.split('/').filter(Boolean)
  const seg1 = parts[0]
  const seg2 = parts[1]

  if (!seg1) return { kind: 'invalid' }
  if (!/^[A-Za-z0-9]{11}$/.test(seg1)) return { kind: 'invalid' }

  if (seg2) return { kind: 'destination', urlId: seg1, destinationSlug: seg2 }
  return { kind: 'overview', urlId: seg1 }
}

// ── Nav items builder ────────────────────────────────────────────────────────
// Trip Overview first, then one item per destination row in sort_order.
// 'hidden' rows are filtered server-side; 'preview' rows render with the
// Preview pill.

export function buildImmerseNavItems(
  engagement: ImmerseEngagementData,
  currentDestinationSlug: string | null,
): ImmerseNavItem[] {
  const base = isImmerseHost()
    ? `/${engagement.urlId}`
    : `/immerse/${engagement.urlId}`

  const items: ImmerseNavItem[] = [
    {
      label:    'Trip Overview',
      href:     base,
      isActive: currentDestinationSlug === null,
    },
  ]

  for (const row of engagement.destinationRows) {
    const slug = row.destinationSlug ?? ''
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
  // Track pathname so component re-resolves on browser back/forward within
  // the immerse subtree.
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

  // S32D: Route is derived synchronously from pathname on every render.
  // This is the load-bearing change — render decisions never see a stale
  // `kind` while the URL says otherwise.
  const route = useMemo(() => resolveImmerseRoute(pathname), [pathname])

  const [engagement, setEngagement] = useState<ImmerseEngagementData | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Engagement only needs to refetch when urlId changes, not on every URL
  // change. Switching between overview and destination subpages of the same
  // engagement reuses the cached engagement state.
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

  const logoHref = engagement
    ? (isImmerseHost() ? `/${engagement.urlId}` : `/immerse/${engagement.urlId}`)
    : undefined

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