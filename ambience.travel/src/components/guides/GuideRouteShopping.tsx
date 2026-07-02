// GuideRouteShopping.tsx — thin route wrapper for the shopping guide.
//
// Phase dispatch:
//   loading   → RouteLoading
//   notPublic → GuideGateShopping inline inside GuideLayout
//   notFound  → NotFoundPage (dark, full page — genuine 404)
//   ready     → GuidePageShopping inside GuideLayout
//
// Last updated: S53 — notPublic phase added.
// Prior: S53 — collapsed to thin wrapper.

import GuideLayout from '../layouts/GuideLayout'
import { GuideGate } from './GuideGate'
import GuidePageShopping from './GuidePageShopping'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function GuideRouteShopping() {
  const state = useGuideRoute('shopping')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  if (state.phase === 'notPublic') {
    return (
      <GuideLayout>
        <GuideGate variant='shopping' destinationName={state.destination.name} />
      </GuideLayout>
    )
  }

  return (
    <GuideLayout>
      <GuidePageShopping
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}