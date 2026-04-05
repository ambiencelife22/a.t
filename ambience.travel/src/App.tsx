/* App.tsx
 * Top-level router — no external routing library.
 * Routes by hostname first, then pathname as fallback (for local dev).
 *
 * Production:
 *   ambience.travel/*          → LandingLayout
 *   trips.ambience.travel/*    → TripsLayout + TripRoute
 *
 * Local dev:
 *   localhost:5173/            → Landing
 *   localhost:5173/trips/:id   → Trip guide
 */

import LandingLayout from './components/layouts/LandingLayout'
import TripRoute from './components/trips/TripRoute'

function resolveRoute(): 'landing' | 'trip' {
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  if (hostname === 'trips.ambience.travel') return 'trip'
  if (pathname.startsWith('/trips/')) return 'trip'

  return 'landing'
}

export default function App() {
  const route = resolveRoute()

  if (route === 'trip') return <TripRoute />
  return <LandingLayout />
}