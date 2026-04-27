// ImmerseEngagementRoute.tsx — Route resolver for immerse engagement pages.
// Resolves url_id (+ optional destination_slug) from pathname, with
// hostname-aware path parsing.
//
// Subdomain awareness:
//   immerse.ambience.travel/<url_id>[/<dest>]   → path[0] = url_id
//   ambience.travel/immerse/<url_id>[/<dest>]   → path[1] = url_id  (path[0] = 'immerse')
//   localhost:5173/immerse/<url_id>[/<dest>]    → same as above
//
// Overview (no destination segment)  → fetches engagement, renders ImmerseEngagementPage.
// Destination (with slug)             → verifies engagement exists, hands off to
//   DestinationPage which resolves its own slug from the URL.
// No React Router — reads window.location.pathname directly.
//
// Last updated: S32 — Added subdomain-aware path parsing. resolveImmerseRoute
//   now strips the /immerse/ prefix when not on the immerse subdomain;
//   accepts the bare /<url_id> shape directly on immerse.ambience.travel.
//   Hostname check inlined to keep the file self-contained; same logic
//   exists in App.tsx + DestinationPage.tsx. Worth lifting to lib/immersePath.ts
//   in next pass.
// Prior: S30E perf — Extracted LoadingScreen + NotFound to shared
//   ImmerseStateScreens.tsx so DestinationPage can consume the same shells
//   and fix its white-flash. No behaviour change here.
// Prior: S30E — Engagement abstraction. getImmerseTrip → getImmerseEngagement;
//   type ImmerseTripData → ImmerseEngagementData; buildImmerseNavItems first
//   arg renamed engagement.

import { useEffect, useMemo, useState } from 'react'
import { getImmerseEngagement }            from '../../lib/immerseEngagementQueries'
import type { ImmerseEngagementData }      from '../../lib/immerseTypes'
import ImmerseEngagementPage               from './ImmerseEngagementPage'
import DestinationPage                     from './DestinationPage'
import ImmerseLayout, { type ImmerseNavItem } from '../layouts/ImmerseLayout'
import { LoadingScreen, NotFound }         from './ImmerseStateScreens'

const IMMERSE_HOST = 'immerse.ambience.travel'

function isImmerseHost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === IMMERSE_HOST
}

// ── URL resolution ───────────────────────────────────────────────────────────

type ResolvedRoute =
  | { kind: 'overview';    urlId: string }
  | { kind: 'destination'; urlId: string; destinationSlug: string }
  | { kind: 'invalid' }

// S32: subdomain-aware. Strips /immerse/ prefix only when not on the immerse
// subdomain. On immerse.ambience.travel the URL is /<url_id>[/<dest>] and
// the prefix doesn't exist.
export function resolveImmerseRoute(pathname: string): ResolvedRoute {
  const stripped = isImmerseHost()
    ? pathname.replace(/^\/+|\/+$/g, '')
    : pathname.replace(/^\/+|\/+$/g, '').replace(/^immerse\/?/, '')

  const parts = stripped.split('/').filter(Boolean)
  const seg1 = parts[0]
  const seg2 = parts[1]

  if (!seg1) return { kind: 'invalid' }

  // 11-char alphanumeric = engagement url_id
  const isUrlId = /^[A-Za-z0-9]{11}$/.test(seg1)
  if (!isUrlId) return { kind: 'invalid' }

  if (seg2) return { kind: 'destination', urlId: seg1, destinationSlug: seg2 }
  return { kind: 'overview', urlId: seg1 }
}

// ── Nav items builder ────────────────────────────────────────────────────────
// Pure function — takes engagement + current destination slug (or null for
// overview) and returns the ImmerseLayout nav items. Trip Overview first,
// then one item per destination row in sort_order. 'hidden' rows are already
// filtered server side; 'preview' rows render with the Preview pill.
//
// S32: hrefs use root-relative paths on the immerse subdomain (/<url_id>...)
// and the legacy /immerse/<url_id>... shape elsewhere. This keeps in-page
// navigation on the same host.

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
  const [engagement, setEngagement] = useState<ImmerseEngagementData | null>(null)
  const [kind,    setKind]    = useState<'overview' | 'destination' | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Track pathname so this component re-resolves when user navigates via
  // back/forward within the immerse subtree.
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

  useEffect(() => {
    const route = resolveImmerseRoute(pathname)

    if (route.kind === 'invalid') {
      setError('not-found')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      if (route.kind === 'invalid') return

      setLoading(true)
      setError(null)

      // Always verify the engagement exists before rendering anything
      // engagement-scoped. This catches bad url_ids cleanly.
      const engagementData = await getImmerseEngagement(route.urlId)
      if (cancelled) return
      if (!engagementData) {
        setError('not-found')
        setLoading(false)
        return
      }

      setEngagement(engagementData)
      setKind(route.kind)
      setLoading(false)
    }

    load()

    return () => { cancelled = true }
  }, [pathname])

  // Nav items for Layout wrapper on states we render here. Overview branch
  // delegates to ImmerseEngagementPage which owns its own Layout; we only
  // need items for loading / not-found shells. Build them whenever
  // engagement is loaded so loading-inside-a-valid-engagement states show
  // the menu.
  const currentDestinationSlug = useMemo(() => {
    const route = resolveImmerseRoute(pathname)
    if (route.kind === 'destination') return route.destinationSlug
    return null
  }, [pathname])

  const navItems = useMemo(() => {
    if (!engagement) return undefined
    return buildImmerseNavItems(engagement, currentDestinationSlug)
  }, [engagement, currentDestinationSlug])

  const logoHref = engagement
    ? (isImmerseHost() ? `/${engagement.urlId}` : `/immerse/${engagement.urlId}`)
    : undefined

  if (loading) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <LoadingScreen />
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

  if (kind === 'overview' && engagement) {
    return <ImmerseEngagementPage data={engagement} />
  }

  if (kind === 'destination' && engagement) {
    // Hand off to DestinationPage — it resolves its own destination slug
    // from window.location.pathname (last URL segment). Engagement context
    // available via closure if per-engagement overrides are added later.
    return <DestinationPage />
  }

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <NotFound message='Something went wrong. Please try again.' />
    </ImmerseLayout>
  )
}