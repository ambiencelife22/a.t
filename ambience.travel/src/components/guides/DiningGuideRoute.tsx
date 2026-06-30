// DiningGuideRoute.tsx — thin route wrapper for the dining guide.
//
// All route logic lives in useGuideRoute (path parsing, overlay gate,
// grant check, state machine, error handling). This file picks the variant
// and renders the right page component.
//
// Last updated: S53 — collapsed to thin wrapper. Logic moved to useGuideRoute.
//   Path parsing, destination fetch, overlay gate, grant resolution all live
//   in the shared hook. Also fixes prior bug where hasFullAccess was hardcoded
//   true regardless of grant check result.
// Prior: S40C — Grant check added.
// Prior: S40 — NotFoundPage replaces null return on failed destination load.

import GuideLayout from '../layouts/GuideLayout'
import DiningGuidePage from './DiningGuidePage'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function DiningGuideRoute() {
  const state = useGuideRoute('dining')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  return (
    <GuideLayout>
      <DiningGuidePage
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}