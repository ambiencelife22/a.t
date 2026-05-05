// HotelGuideRoute.tsx — route entry for the hotels guide
// Mirrors DiningGuideRoute. Path parsing + destination validation +
// redirect on miss. Page receives validated destination as guaranteed-non-null.
//
// Path shape:
//   guides.ambience.travel/<dest>/hotels           (production subdomain)
//   ambience.travel/guides/<dest>/hotels           (main domain fallback)
//   localhost:5173/guides/<dest>/hotels            (local dev)
//
// Last updated: S37

import { useEffect, useRef, useState } from 'react'
import GuideLayout from '../layouts/GuideLayout'
import HotelGuidePage from './HotelGuidePage'
import RouteLoading from '../RouteLoading'
import { useToast } from '../../lib/ToastContext'
import { getHotelGuideDestination, type HotelGuideDestination } from '../../lib/hotelGuideQueries'

const GUIDES_HOST = 'guides.ambience.travel'
const HOME_URL = 'https://ambience.travel/'

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
  if (parts.length === 2 && parts[1] === 'hotels') {
    return parts[0]
  }
  return null
}

export default function HotelGuideRoute() {
  const { toast } = useToast()
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const [destination, setDestination] = useState<HotelGuideDestination | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const slug = resolveDestinationSlug()

      if (!slug) {
        if (cancelled) return
        toastRef.current.warning(`We couldn't find that page. Returning home.`)
        window.history.replaceState(null, '', HOME_URL)
        window.dispatchEvent(new PopStateEvent('popstate'))
        setLoading(false)
        return
      }

      try {
        const dest = await getHotelGuideDestination(slug)
        if (cancelled) return

        if (!dest) {
          toastRef.current.warning(`We couldn't find that destination. Returning home.`)
          window.history.replaceState(null, '', HOME_URL)
          window.dispatchEvent(new PopStateEvent('popstate'))
          setLoading(false)
          return
        }

        setDestination(dest)
        setLoading(false)
      } catch (err) {
        console.error('HotelGuideRoute: failed to load destination', err)
        if (cancelled) return
        toastRef.current.warning('Something went wrong loading that guide. Returning home.')
        window.history.replaceState(null, '', HOME_URL)
        window.dispatchEvent(new PopStateEvent('popstate'))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <RouteLoading />
  }

  if (!destination) {
    return null
  }

  return (
    <GuideLayout>
      <HotelGuidePage destination={destination} />
    </GuideLayout>
  )
}