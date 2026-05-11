// DiningGuideRoute.tsx — route entry for the dining guide
// What it owns:
//   - Path parsing (extract destinationSlug from window.location)
//   - Destination validation (look up against global_destinations)
//   - Grant check (dining_guide_for_user view via checkGuideGrant)
//   - Error handling (toast + NotFoundPage on bad slug)
//   - Layout/page composition (GuideLayout wrapping DiningGuidePage)
// What it does not own: page chrome (GuideLayout), data fetch (DiningGuidePage),
//   filter state, card rendering, 404 chrome (NotFoundPage).
//
// Grant states:
//   no_session  → hasFullAccess=false (teaser + editorial strip)
//   no_grant    → hasFullAccess=false (teaser + editorial strip)
//   granted     → hasFullAccess=true (full access)
//
// Grant check failures default to teaser — never block page render.
//
// Last updated: S40C — Grant check added. All non-granted states render
//   teaser via DiningGuidePage hasFullAccess={false}. Grant check errors
//   isolated — fall back to teaser, never notFound.
// Prior: S40 — NotFoundPage replaces null return on failed destination load.
// Prior: S39 — Fixed toast loop via toastRef pattern.

import { useEffect, useRef, useState } from 'react'
import GuideLayout from '../layouts/GuideLayout'
import DiningGuidePage from './DiningGuidePage'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useToast } from '../../lib/ToastContext'
import {
  getGuideDestination,
  checkGuideGrant,
  type GuideDestination,
} from '../../lib/diningGuideQueries'

const GUIDES_HOST = 'guides.ambience.travel'
const HOME_URL    = 'https://ambience.travel/'

function resolveDestinationSlug(): string | null {
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
  if (parts.length === 2 && parts[1] === 'dining') {
    return parts[0]
  }
  return null
}

type RouteState =
  | { phase: 'loading' }
  | { phase: 'ready';    destination: GuideDestination; hasFullAccess: boolean }
  | { phase: 'notFound'; message: string }

export default function DiningGuideRoute() {
  const { toast }         = useToast()
  const toastRef          = useRef(toast)
  const [state, setState] = useState<RouteState>({ phase: 'loading' })

  useEffect(() => { toastRef.current = toast }, [toast])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const slug = resolveDestinationSlug()

      if (!slug) {
        if (cancelled) return
        setState({ phase: 'notFound', message: "We couldn't find that page." })
        return
      }

      try {
        const dest = await getGuideDestination(slug)
        if (cancelled) return

        if (!dest) {
          toastRef.current.warning(`We couldn't find that destination.`)
          setState({ phase: 'notFound', message: "We couldn't find that destination." })
          return
        }

        let hasFullAccess = false
        try {
          const grant = await checkGuideGrant(slug)
          hasFullAccess = grant.status === 'granted'
        } catch (grantErr) {
          console.warn('DiningGuideRoute: grant check failed, defaulting to teaser', grantErr)
          hasFullAccess = false
        }
        if (cancelled) return

        setState({
          phase:         'ready',
          destination:   dest,
          hasFullAccess,
        })
      } catch (err) {
        console.error('DiningGuideRoute: failed to load destination', err)
        if (cancelled) return
        toastRef.current.warning('Something went wrong loading that guide.')
        setState({ phase: 'notFound', message: 'Something went wrong. Please try again.' })
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (state.phase === 'loading') return <RouteLoading />

  if (state.phase === 'notFound') {
    return <NotFoundPage message={state.message} homeUrl={HOME_URL} />
  }

  return (
    <GuideLayout>
      <DiningGuidePage
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}