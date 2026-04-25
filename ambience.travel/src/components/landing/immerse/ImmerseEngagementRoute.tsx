// ImmerseEngagementRoute.tsx — Route resolver for /immerse/{url_id}/...
// Resolves url_id (+ optional destination_slug) from pathname.
// Overview (/immerse/{url_id})          → fetches engagement, renders ImmerseEngagementPage.
// Destination (/immerse/{url_id}/{slug}) → verifies engagement exists, hands off to
//   DestinationPage which resolves its own slug from the URL.
// No React Router — reads window.location.pathname directly.
//
// Last updated: S30E stage 2 — File renamed ImmerseTripRoute.tsx →
//   ImmerseEngagementRoute.tsx. Component renamed ImmerseTripRoute →
//   ImmerseEngagementRoute. Import updated to ImmerseEngagementPage.
// Prior: S30E stage 1 — Engagement abstraction. getImmerseTrip →
//   getImmerseEngagement; type ImmerseTripData → ImmerseEngagementData;
//   buildImmerseNavItems first arg renamed engagement.
// Prior: S26 — Builds navItems from engagement.destinationRows and passes to
//   ImmerseLayout on loading / not-found / unknown states. On the overview
//   state ImmerseEngagementPage owns its own layout wrapper.

import { useEffect, useMemo, useState } from 'react'
import { getImmerseEngagement }            from '../../../lib/immerseTripQueries'
import type { ImmerseEngagementData }      from '../../../lib/immerseTypes'
import ImmerseEngagementPage               from './ImmerseEngagementPage'
import DestinationPage                     from './DestinationPage'
import ImmerseLayout, { type ImmerseNavItem } from '../../layouts/ImmerseLayout'

// ── URL resolution ───────────────────────────────────────────────────────────

type ResolvedRoute =
  | { kind: 'overview';    urlId: string }
  | { kind: 'destination'; urlId: string; destinationSlug: string }
  | { kind: 'invalid' }

export function resolveImmerseRoute(pathname: string): ResolvedRoute {
  // Expects pathname starting with /immerse/
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/')
  // parts[0] === 'immerse'
  const seg1 = parts[1]
  const seg2 = parts[2]

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

export function buildImmerseNavItems(
  engagement: ImmerseEngagementData,
  currentDestinationSlug: string | null,
): ImmerseNavItem[] {
  const items: ImmerseNavItem[] = [
    {
      label:    'Trip Overview',
      href:     `/immerse/${engagement.urlId}`,
      isActive: currentDestinationSlug === null,
    },
  ]

  for (const row of engagement.destinationRows) {
    const slug = row.destinationSlug ?? ''
    if (!slug) continue
    items.push({
      label:     row.title || slug,
      href:      `/immerse/${engagement.urlId}/${slug}`,
      isActive:  currentDestinationSlug === slug,
      isPreview: row.subpageStatus === 'preview',
    })
  }

  return items
}

// ── Loading / not found ──────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: 13, color: '#7A8476', letterSpacing: '0.06em' }}>
        Loading your proposal…
      </div>
    </div>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#171917' }}>{message}</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}>
        Return to ambience.travel →
      </a>
    </div>
  )
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
      // engagement-scoped. This catches /immerse/badurlid0/anything cleanly.
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

  const logoHref = engagement ? `/immerse/${engagement.urlId}` : undefined

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