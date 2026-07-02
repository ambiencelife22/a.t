// GuideRouteExperiences.tsx — thin route wrapper for the experiences guide.
//
// Phase dispatch:
//   loading   → RouteLoading
//   notPublic → GuideGateExperiences inline inside GuideLayout
//   notFound  → NotFoundPage (dark, full page — genuine 404)
//   ready     → GuidePageExperiences inside GuideLayout
//
// Last updated: S53 — notPublic phase added.
// Prior: S53 — collapsed to thin wrapper.

import GuideLayout from '../layouts/GuideLayout'
import { GuideGate } from './GuideGate'
import GuidePageExperiences from './GuidePageExperiences'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function GuideRouteExperiences() {
  const state = useGuideRoute('experiences')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  if (state.phase === 'notPublic') {
    return (
      <GuideLayout>
        <GuideGate variant='experiences' destinationName={state.destination.name} />
      </GuideLayout>
    )
  }

  return (
    <GuideLayout>
      <GuidePageExperiences
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}