// HotelGuideRoute.tsx — thin route wrapper for the hotels guide.
//
// All route logic lives in useGuideRoute (path parsing, overlay gate,
// grant check, state machine, error handling). This file picks the variant
// and renders the right page component.
//
// Note on naming: file is `HotelGuideRoute` (historical singular) but the
// variant in the type system is 'hotels' (plural) and the URL segment is
// '/hotels' (plural). This is fine — the file name is internal; the variant
// + segment are the source of truth.
//
// Last updated: S53 — collapsed to thin wrapper. Logic moved to useGuideRoute.
//   Overlay gate now applies — destinations without a travel_hotel_guides
//   row resolve to 404 rather than rendering chrome with no data.
// Prior: S37 — initial build.

import GuideLayout from '../layouts/GuideLayout'
import HotelGuidePage from './HotelGuidePage'
import RouteLoading from '../RouteLoading'
import NotFoundPage from '../NotFoundPage'
import { useGuideRoute } from '../../hooks/useGuideRoute'

const HOME_URL = 'https://ambience.travel/'

export default function HotelGuideRoute() {
  const state = useGuideRoute('hotels')

  if (state.phase === 'loading')  return <RouteLoading />
  if (state.phase === 'notFound') return <NotFoundPage message={state.message} homeUrl={HOME_URL} />

  return (
    <GuideLayout>
      <HotelGuidePage
        destination={state.destination}
        hasFullAccess={state.hasFullAccess}
      />
    </GuideLayout>
  )
}