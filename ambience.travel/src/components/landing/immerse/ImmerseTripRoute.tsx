// ImmerseTripRoute.tsx — Route resolver for /immerse/{url_id}/...
// Resolves url_id (+ optional destination_slug) from pathname.
// Overview (/immerse/{url_id})          → fetches trip, renders ImmerseTripPage.
// Destination (/immerse/{url_id}/{slug}) → verifies trip exists, hands off to
//   HoneymoonDestinationPage which resolves its own slug from the URL.
// No React Router — reads window.location.pathname directly.
// Last updated: S14

import { useEffect, useState } from 'react'
import { getImmerseTrip }         from '../../../lib/immerseTripQueries'
import type { ImmerseTripData }   from '../../../lib/immerseTypes'
import ImmerseTripPage            from './ImmerseTripPage'
import HoneymoonDestinationPage   from './HoneymoonDestinationPage'
import ImmerseLayout              from '../../layouts/ImmerseLayout'

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

  // 11-char alphanumeric = trip url_id
  const isUrlId = /^[A-Za-z0-9]{11}$/.test(seg1)
  if (!isUrlId) return { kind: 'invalid' }

  if (seg2) return { kind: 'destination', urlId: seg1, destinationSlug: seg2 }
  return { kind: 'overview', urlId: seg1 }
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

export default function ImmerseTripRoute() {
  const [trip,    setTrip]    = useState<ImmerseTripData | null>(null)
  const [kind,    setKind]    = useState<'overview' | 'destination' | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const route = resolveImmerseRoute(window.location.pathname)

    if (route.kind === 'invalid') {
      setError('not-found')
      setLoading(false)
      return
    }

    async function load() {
      if (route.kind === 'invalid') return

      // Always verify the trip exists before rendering anything trip-scoped.
      // This catches /immerse/badurlid0/anything cleanly.
      const tripData = await getImmerseTrip(route.urlId)
      if (!tripData) {
        setError('not-found')
        setLoading(false)
        return
      }

      setTrip(tripData)
      setKind(route.kind)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <ImmerseLayout>
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

  if (kind === 'overview' && trip) {
    return <ImmerseTripPage data={trip} />
  }

  if (kind === 'destination' && trip) {
    // Hand off to HoneymoonDestinationPage — it resolves its own destination slug
    // from window.location.pathname (last URL segment). Trip context available
    // via closure if per-trip overrides are added later.
    return <HoneymoonDestinationPage />
  }

  return (
    <ImmerseLayout>
      <NotFound message='Something went wrong. Please try again.' />
    </ImmerseLayout>
  )
}