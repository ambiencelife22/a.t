// GuideRouteExperiences.tsx — thin route wrapper for the experiences guide.
//
// All route logic lives in useGuideRoute (path parsing, overlay gate,
// grant check, state machine, error handling). This file picks the variant
// and renders the right page component.
//
// Last updated: S53 — collapsed to thin wrapper. Logic moved to useGuideRoute.
// Prior: S41 — initial build.

import GuideLayout from '../layouts/GuideLayout'
import GuidePageExperiences from './GuidePageExperiences'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function GuideRouteExperiences() {
  const state = useGuideRoute('experiences')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  return (
    <GuideLayout>
      <GuidePageExperiences
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}