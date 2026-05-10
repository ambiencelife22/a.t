// DiningGuideRoute.tsx — route entry for the dining guide
// What it owns:
//   - Path parsing (extract destinationSlug from window.location)
//   - Destination validation (look up against global_destinations)
//   - Error handling (toast + replaceState + popstate redirect on bad slug)
//   - Layout/page composition (mount GuideLayout wrapping DiningGuidePage)
// What it does not own: page chrome (GuideLayout), data fetch (DiningGuidePage),
//   filter state, card rendering, 404 chrome (NotFoundPage).
//
// Pattern: mirrors ImmerseEngagementRoute. Route component resolves the
// canonical entity from the URL, validates it exists, redirects on miss
// with global toast feedback. Page receives the validated destination as
// a guaranteed-non-null prop.
//
// Path shape:
//   guides.ambience.travel/<dest>/dining           (production subdomain)
//   ambience.travel/guides/<dest>/dining           (main domain fallback)
//   localhost:5173/guides/<dest>/dining            (local dev)
//
// Future: when Activities + Hotels guides ship, add tab nav items here:
//   const navItems = [
//     { label: 'Dining', href: `/${dest}/dining`, isActive: true },
//     { label: 'Activities', href: `/${dest}/activities`, isActive: false },
//     { label: 'Hotels', href: `/${dest}/hotels`, isActive: false, isPreview: true },
//   ]
//
// Last updated: S40 — NotFoundPage replaces null return on failed destination
//   load. Gives users a branded 404 screen instead of a blank page.
// Prior: S39 — Fixed toast loop. toastRef pattern: stable effect dep array,
//   toast object kept current via sync effect.
// Prior: S35

import { useEffect, useRef, useState } from 'react'
import GuideLayout from '../layouts/GuideLayout'
import DiningGuidePage from './DiningGuidePage'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useToast } from '../../lib/ToastContext'
import { getGuideDestination, type GuideDestination } from '../../lib/diningGuideQueries'

const GUIDES_HOST = 'guides.ambience.travel'
const HOME_URL    = 'https://ambience.travel/'

/**
 * Extracts destination slug from current path.
 * Handles both the guides subdomain (path = /<dest>/dining) and the
 * /guides/ prefix on main domain (path = /guides/<dest>/dining).
 */
function resolveDestinationSlug(): string | null {
  const pathname    = window.location.pathname.replace(/\/+$/, '')
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
  | { phase: 'ready';    destination: GuideDestination }
  | { phase: 'notFound'; message: string }

export default function DiningGuideRoute() {
  const { toast }   = useToast()
  const toastRef    = useRef(toast)
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

        setState({ phase: 'ready', destination: dest })
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

  if (state.phase === 'loading') {
    return <RouteLoading />
  }

  if (state.phase === 'notFound') {
    return <NotFoundPage message={state.message} homeUrl={HOME_URL} />
  }

  return (
    <GuideLayout>
      <DiningGuidePage destination={state.destination} />
    </GuideLayout>
  )
}