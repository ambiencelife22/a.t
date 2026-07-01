// GuideRouteShopping.tsx — thin route wrapper for the shopping guide.
//
// All route logic lives in useGuideRoute (path parsing, overlay gate,
// grant check, state machine, error handling). This file picks the variant
// and renders the right page component.
//
// Last updated: S53 — collapsed to thin wrapper. Logic moved to useGuideRoute.
// Prior: S52 — initial build.

import GuideLayout from '../layouts/GuideLayout'
import GuidePageShopping from './GuidePageShopping'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function GuideRouteShopping() {
  const state = useGuideRoute('shopping')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  return (
    <GuideLayout>
      <GuidePageShopping
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}