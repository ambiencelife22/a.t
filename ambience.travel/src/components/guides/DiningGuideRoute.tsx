// DiningGuideRoute.tsx — route entry for the dining guide
// What it owns:
//   - Path parsing (extract destinationSlug from window.location)
//   - Destination validation (look up against global_destinations)
//   - Error handling (toast + replaceState + popstate redirect on bad slug)
//   - Layout/page composition (mount GuideLayout wrapping DiningGuidePage)
// What it does not own: page chrome (GuideLayout), data fetch (DiningGuidePage),
//   filter state, card rendering.
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
// Last updated: S35

import { useEffect, useState } from 'react'
import GuideLayout from '../layouts/GuideLayout'
import DiningGuidePage from './DiningGuidePage'
import RouteLoading from '../RouteLoading'
import { useToast } from '../../lib/ToastContext'
import { getGuideDestination, type GuideDestination } from '../../lib/diningGuideQueries'

const GUIDES_HOST = 'guides.ambience.travel'
const HOME_URL = 'https://ambience.travel/'

/**
 * Extracts destination slug from current path.
 * Handles both the guides subdomain (path = /<dest>/dining) and the
 * /guides/ prefix on main domain (path = /guides/<dest>/dining).
 */
function resolveDestinationSlug(): string | null {
  const pathname = window.location.pathname.replace(/\/+$/, '')
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

export default function DiningGuideRoute() {
  const { toast } = useToast()
  const [destination, setDestination] = useState<GuideDestination | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const slug = resolveDestinationSlug()

      if (!slug) {
        if (cancelled) return
        toast.warning(`We couldn't find that page. Returning home.`)
        window.history.replaceState(null, '', HOME_URL)
        window.dispatchEvent(new PopStateEvent('popstate'))
        setLoading(false)
        return
      }

      try {
        const dest = await getGuideDestination(slug)
        if (cancelled) return

        if (!dest) {
          toast.warning(`We couldn't find that destination. Returning home.`)
          window.history.replaceState(null, '', HOME_URL)
          window.dispatchEvent(new PopStateEvent('popstate'))
          setLoading(false)
          return
        }

        setDestination(dest)
        setLoading(false)
      } catch (err) {
        console.error('DiningGuideRoute: failed to load destination', err)
        if (cancelled) return
        toast.warning('Something went wrong loading that guide. Returning home.')
        window.history.replaceState(null, '', HOME_URL)
        window.dispatchEvent(new PopStateEvent('popstate'))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [toast])

  if (loading) {
    return <RouteLoading />
  }

  if (!destination) {
    // Toast already fired and redirect dispatched. Render nothing while
    // the route resolver re-evaluates against the new URL.
    return null
  }

  return (
    <GuideLayout>
      <DiningGuidePage destination={destination} />
    </GuideLayout>
  )
}