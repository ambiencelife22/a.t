// ExperiencesGuideRoute.tsx — route entry for the experiences guide
// Mirrors DiningGuideRoute exactly.
// What it owns:
//   - Path parsing (extract destinationSlug from window.location)
//   - Destination validation (look up against global_destinations)
//   - Error handling (toast + NotFoundPage on bad slug)
//   - Layout/page composition (GuideLayout wrapping ExperiencesGuidePage)
//
// Grant gating: no experiences_guide_for_user view yet.
// hasFullAccess hardcoded true until that view ships — same pattern as
// dining's current state. Remove hardcode when grant view is ready.
//
// Prior: S41 — initial build.

import { useEffect, useRef, useState } from 'react'
import GuideLayout from '../layouts/GuideLayout'
import ExperiencesGuidePage from './ExperiencesGuidePage'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useToast } from '../../lib/ToastContext'
import {
  getExperiencesGuideDestination,
  // checkExperiencesGuideGrant,
  type ExperiencesGuideDestination,
} from '../../lib/queriesGuidesExperiences'

const GUIDES_HOST = 'guides.ambience.travel'
const HOME_URL    = 'https://ambience.travel/'

function resolveDestinationSlug(): string | null {
  const pathname     = window.location.pathname.replace(/\/+$/, '')
  const isGuidesHost = window.location.hostname === GUIDES_HOST

  let stripped: string
  if (isGuidesHost) {
    stripped = pathname.replace(/^\/+/, '')
  }
  if (!isGuidesHost) {
    if (!pathname.startsWith('/guides/')) return null
    stripped = pathname.replace(/^\/guides\/?/, '').replace(/^\/+/, '')
  }

  const parts = (stripped!).split('/').filter(Boolean)
  if (parts.length === 2 && parts[1] === 'experiences') {
    return parts[0]
  }
  return null
}

type RouteState =
  | { phase: 'loading' }
  | { phase: 'ready';    destination: ExperiencesGuideDestination; hasFullAccess: boolean }
  | { phase: 'notFound'; message: string }

export default function ExperiencesGuideRoute() {
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
        const dest = await getExperiencesGuideDestination(slug)
        if (cancelled) return

        if (!dest) {
          toastRef.current.warning(`We couldn't find that destination.`)
          setState({ phase: 'notFound', message: "We couldn't find that destination." })
          return
        }

        if (cancelled) return

        setState({
          phase:         'ready',
          destination:   dest,
          hasFullAccess: true,
        })
      } catch (err) {
        console.error('ExperiencesGuideRoute: failed to load destination', err)
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
      <ExperiencesGuidePage
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}