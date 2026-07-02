// GuideRouteDining.tsx — thin route wrapper for the dining guide.
//
// All route logic lives in useGuideRoute (path parsing, overlay gate,
// grant check, state machine, error handling). This file picks the variant
// and renders the right page or gate component.
//
// Phase dispatch:
//   loading   → RouteLoading
//   notPublic → GuideGateDining inline inside GuideLayout
//   notFound  → NotFoundPage (dark, full page — genuine 404)
//   ready     → GuidePageDining inside GuideLayout
//
// Last updated: S53 — notPublic phase added. Overlay-gated guides now render
//   GuideGateDining inside GuideLayout instead of a dark NotFoundPage. Guest
//   sees destination hero then the tailored gate message.
// Prior: S53 — collapsed to thin wrapper.

import GuideLayout from '../layouts/GuideLayout'
import { GuideGate } from './GuideGate'
import GuidePageDining from './GuidePageDining'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function GuideRouteDining() {
  const state = useGuideRoute('dining')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  if (state.phase === 'notPublic') {
    return (
      <GuideLayout>
        <GuideGate variant='dining' destinationName={state.destination.name} />
      </GuideLayout>
    )
  }

  return (
    <GuideLayout>
      <GuidePageDining
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}