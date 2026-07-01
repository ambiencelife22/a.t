/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 *
 * Production routes:
 *   ambience.travel/*                                    → LandingLayout (public)
 *   ambience.travel/experiences/:slug                    → SignatureExperiencePage
 *   ambience.travel/login                                → Auth (admin login, S40D)
 *   ambience.travel/#admin                               → AmbienceAdmin (S33)
 *   ambience.travel/immerse/:url_id                      → ImmerseEngagementRoute
 *   ambience.travel/immerse/:url_id/:destination         → ImmerseEngagementRoute
 *   ambience.travel/immerse/:url_id/confirmation         → ImmerseTripPage (confirmation tab)
 *   ambience.travel/immerse/:url_id/programme            → ImmerseTripPage (programme tab)
 *   ambience.travel/guides/:destination/dining           → GuideRouteDining (S35)
 *   ambience.travel/guides/:destination/hotels           → GuideRouteHotels (S37)
 *   ambience.travel/guides/:destination/experiences      → GuideRouteExperiences
 *   ambience.travel/guides/:destination/shopping         → GuideRouteShopping
 *   immerse.ambience.travel/:url_id                      → ImmerseEngagementRoute
 *   immerse.ambience.travel/:url_id/:destination         → ImmerseEngagementRoute
 *   immerse.ambience.travel/:url_id/confirmation         → ImmerseTripPage (confirmation tab)
 *   immerse.ambience.travel/:url_id/programme            → ImmerseTripPage (programme tab)
 *   guides.ambience.travel/:destination/dining           → GuideRouteDining (S35)
 *   guides.ambience.travel/:destination/hotels           → GuideRouteHotels (S37)
 *   guides.ambience.travel/:destination/experiences      → GuideRouteExperiences
 *   guides.ambience.travel/:destination/shopping         → GuideRouteShopping
 *   programme.ambience.travel/#admin                     → ProgrammeAdmin (existing, untouched)
 *   programme.ambience.travel/?signup=1                  → Auth signup
 *   programme.ambience.travel/stays/:id                  → Auth → full-page ProgrammeRoute
 *   programme.ambience.travel/ (root)                    → Auth → Layout (Dashboard/List/Profile)
 *
 * Local dev routes:
 *   localhost:5173/                                      → Landing
 *   localhost:5173/login                                 → Auth (admin login, S40D)
 *   localhost:5173/?signup=1                             → Auth signup
 *   localhost:5173/#admin                                → AmbienceAdmin (new shell, S33)
 *   localhost:5173/programme/#admin                      → ProgrammeAdmin (existing)
 *   localhost:5173/programme/stays/:id                   → Auth → full-page ProgrammeRoute
 *   localhost:5173/programme/ or /programme              → Auth → Layout
 *   localhost:5173/immerse/:url_id                       → ImmerseEngagementRoute
 *   localhost:5173/immerse/:url_id/:destination          → ImmerseEngagementRoute
 *   localhost:5173/immerse/:url_id/confirmation          → ImmerseTripPage (confirmation tab)
 *   localhost:5173/immerse/:url_id/programme             → ImmerseTripPage (programme tab)
 *   localhost:5173/guides/:destination/dining            → GuideRouteDining (S35)
 *   localhost:5173/guides/:destination/hotels            → GuideRouteHotels (S37)
 *   localhost:5173/guides/:destination/experiences       → GuideRouteExperiences
 *   localhost:5173/guides/:destination/shopping          → GuideRouteShopping
 *
 * Admin routing (S33): hash === '#admin' is hostname-disambiguated.
 *   - programme.ambience.travel/#admin OR localhost:5173/programme/#admin
 *     → ProgrammeAdmin (existing, side-by-side, untouched)
 *   - any other host with #admin (incl. ambience.travel, localhost root)
 *     → AmbienceAdmin (new unified admin)
 *   The route resolver also supports any /admin/* hash sub-paths
 *   (#admin/immerse/engagements/<url_id>, etc) via the same 'admin' route —
 *   the inner shell parses the hash itself.
 *
 * Login route (S40D): ambience.travel/login renders Auth in login mode.
 *   On successful auth, redirects to #admin. Allows admin access without
 *   depending on programme.ambience.travel for session establishment.
 *   Signup mode (?signup=1) is unaffected — remains programme-context only.
 *
 * Last updated: S53 — Guide route imports point at the renamed
 *   GuideRoute<Variant> files under src/components/guides/.
 *   DiningGuideRoute → GuideRouteDining, HotelGuideRoute → GuideRouteHotels,
 *   ExperiencesGuideRoute → GuideRouteExperiences,
 *   ShoppingGuideRoute → GuideRouteShopping.
 * Prior: S53 — Journey programme surface retired. Superseded by
 *   ImmerseTripPage + Programme tab. /journeys/:id routes and
 *   'preview-journey' route removed. ProgrammeRoute now serves only
 *   stay-type programmes.
 * Prior: /confirmation + /programme routes now resolve to ImmerseTripPage
 *   with an initialTab (confirmation/programme) — legacy
 *   TripConfirmationPage + TripProgrammePage retired, consolidating to one
 *   trip surface. Still handled inside ImmerseEngagementRoute via
 *   RESERVED_SEGMENTS intercept.
 * Prior: S48 — Added confirmation + programme routes under immerse surface.
 * Prior: S40D — Added 'login' route at /login for admin auth.
 * Prior: S37 — Added 'guides-hotels' route. resolveGuidePath() now
 *   returns surface union ('dining' | 'hotels'). Route resolver dispatches
 *   on surface. Mirrors S35 dining shape.
 */

import { useEffect, useState, useContext, lazy, Suspense } from 'react'
import RouteLoading from './components/RouteLoading'
import { getSession, signOut } from './utils/utilsAuth'
import { getProfile } from './queries/queriesProgramme'
import { _setPalette, darkPalette, lightPalette } from './tokens/tokensProgramme'
import { ThemeContext } from './context/contextTheme'
import { isImmerseHost, isTripUrlId } from './utils/utilsImmersePath'
import type { Session } from '@supabase/supabase-js'
import type { Page } from './components/Layout'


// ── Lazy route components ────────────────────────────────────────────────────

const LandingLayout            = lazy(() => import('./components/layouts/LandingLayout'))
const ProgrammeRoute           = lazy(() => import('./components/programme/ProgrammeRoute'))
const ProgrammeAdmin           = lazy(() => import('./components/admin/ProgrammeAdmin'))
const AmbienceAdmin            = lazy(() => import('./components/AmbienceAdmin'))
const Layout                   = lazy(() => import('./components/Layout'))
const Dashboard                = lazy(() => import('./components/Dashboard'))
const ProgrammeList            = lazy(() => import('./components/ProgrammeList'))
const Profile                  = lazy(() => import('./components/Profile'))
const Auth                     = lazy(() => import('./components/Auth'))
const SignatureExperiencePage  = lazy(() => import('./components/landing/experiences/SignatureExperiencePage'))
const ImmerseEngagementRoute   = lazy(() => import('./components/immerse/ImmerseEngagementRoute'))
const GuideRouteDining         = lazy(() => import('./components/guides/GuideRouteDining'))
const GuideRouteHotels         = lazy(() => import('./components/guides/GuideRouteHotels'))
const GuideRouteExperiences    = lazy(() => import('./components/guides/GuideRouteExperiences'))
const GuideRouteShopping       = lazy(() => import('./components/guides/GuideRouteShopping'))

type Route =
  | 'landing'
  | 'login'
  | 'admin-programme'
  | 'admin-ambience'
  | 'app'
  | 'programme-detail'
  | 'signup'
  | 'experience'
  | 'immerse'
  | 'guides-dining'
  | 'guides-hotels'
  | 'guides-experiences'
  | 'guides-shopping'


function hasUrlId(): boolean {
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  if (hostname === 'programme.ambience.travel') {
    return /^\/stays\/.+/.test(pathname)
  }

  return /^\/programme\/stays\/.+/.test(pathname)
}

function isExperienceRoute(): boolean {
  return window.location.pathname.startsWith('/experiences/')
}

function isLoginRoute(): boolean {
  const pathname = window.location.pathname.replace(/\/+$/, '')
  return pathname === '/login'
}

function isImmerseRoute(): boolean {
  if (isImmerseHost()) return true
  return window.location.pathname.startsWith('/immerse/')
}

function resolveImmerseSegments(): { seg1: string; seg2: string | null } {
  const pathname = window.location.pathname.replace(/\/$/, '')
  const stripped = isImmerseHost()
    ? pathname.replace(/^\/+/, '')
    : pathname.replace(/^\/immerse\/?/, '').replace(/^\/+/, '')
  const parts = stripped.split('/').filter(Boolean)
  return { seg1: parts[0] ?? '', seg2: parts[1] ?? null }
}

// S35 — guides subdomain detection.
function isGuidesHost(): boolean {
  return window.location.hostname === 'guides.ambience.travel'
}

// S35/S37 — resolve guide path segments.
function resolveGuidePath(): { destinationSlug: string; surface: 'dining' | 'hotels' | 'experiences' | 'shopping' } | null {
  const pathname = window.location.pathname.replace(/\/+$/, '')

  let stripped: string
  if (isGuidesHost()) {
    stripped = pathname.replace(/^\/+/, '')
  }
  if (!isGuidesHost()) {
    if (!pathname.startsWith('/guides/')) return null
    stripped = pathname.replace(/^\/guides\/?/, '').replace(/^\/+/, '')
  }

  const parts = (stripped!).split('/').filter(Boolean)
  if (parts.length === 2 && (parts[1] === 'dining' || parts[1] === 'hotels' || parts[1] === 'experiences' || parts[1] === 'shopping')) {
    return { destinationSlug: parts[0], surface: parts[1] as 'dining' | 'hotels' | 'experiences' | 'shopping' }
  }
  return null
}

// S33 — admin route disambiguator.
function isProgrammeAdminContext(): boolean {
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  if (hostname === 'programme.ambience.travel') return true
  if (
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) &&
    pathname.startsWith('/programme')
  ) {
    return true
  }
  return false
}

function resolveRoute(): Route {
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  const hash     = window.location.hash
  const params   = new URLSearchParams(window.location.search)

  if (params.get('signup') === '1') return 'signup'

  // S40D — /login route for admin auth. Checked before #admin hash so that
  // ambience.travel/login works regardless of hash state.
  // Not active on programme subdomain — signup flow there is separate.
  if (isLoginRoute() && !isProgrammeAdminContext()) return 'login'

  // S33 — hash sub-paths supported (#admin/immerse/engagements/<url_id>, etc)
  if (hash.startsWith('#admin')) {
    return isProgrammeAdminContext() ? 'admin-programme' : 'admin-ambience'
  }

  if (isGuidesHost() || pathname.startsWith('/guides/')) {
    const guidePath = resolveGuidePath()
    if (guidePath) {
      if (guidePath.surface === 'hotels')      return 'guides-hotels'
      if (guidePath.surface === 'experiences') return 'guides-experiences'
      if (guidePath.surface === 'shopping')    return 'guides-shopping'
      return 'guides-dining'
    }
    if (isGuidesHost()) {
      window.location.replace('https://ambience.travel/')
    }
  }

  if (isImmerseHost()) return 'immerse'

  if (hostname === 'programme.ambience.travel') {
    if (hasUrlId()) return 'programme-detail'
    return 'app'
  }

  if (pathname.startsWith('/programme')) {
    if (hasUrlId()) return 'programme-detail'
    return 'app'
  }

  if (isImmerseRoute())    return 'immerse'
  if (isExperienceRoute()) return 'experience'

  return 'landing'
}

export default function App() {
  const [route, setRoute] = useState<Route>(resolveRoute())

  useEffect(() => {
    function handleChange() { setRoute(resolveRoute()) }
    window.addEventListener('hashchange', handleChange)
    window.addEventListener('popstate', handleChange)
    return () => {
      window.removeEventListener('hashchange', handleChange)
      window.removeEventListener('popstate', handleChange)
    }
  }, [])

  if (route === 'landing') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <LandingLayout />
      </Suspense>
    )
  }

  if (route === 'experience') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <SignatureExperiencePage />
      </Suspense>
    )
  }

  // S40D — admin login. On success, push to #admin.
  if (route === 'login') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <Auth
          onAuth={() => { window.location.href = '/#admin' }}
          initialMode='login'
        />
      </Suspense>
    )
  }

  if (route === 'immerse') {
    const { seg1 } = resolveImmerseSegments()

    if (isTripUrlId(seg1)) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <ImmerseEngagementRoute />
        </Suspense>
      )
    }

    const homeUrl = isImmerseHost() ? 'https://ambience.travel/' : '/'
    window.location.replace(homeUrl)
    return <RouteLoading />
  }

  if (route === 'guides-dining') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <GuideRouteDining />
      </Suspense>
    )
  }

  if (route === 'guides-hotels') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <GuideRouteHotels />
      </Suspense>
    )
  }

  if (route === 'guides-experiences') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <GuideRouteExperiences />
      </Suspense>
    )
  }

  if (route === 'guides-shopping') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <GuideRouteShopping />
      </Suspense>
    )
  }

  if (route === 'signup') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <Auth onAuth={() => { window.location.search = '' }} initialMode='signup' />
      </Suspense>
    )
  }

  // S33 — programme admin (existing, untouched)
  if (route === 'admin-programme') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ProgrammeAdmin />
      </Suspense>
    )
  }

  // S33 — new unified ambience admin
  if (route === 'admin-ambience') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <AmbienceAdmin />
      </Suspense>
    )
  }

  if (route === 'programme-detail') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ProgrammeGate full />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <ProgrammeGate />
    </Suspense>
  )
}

function ProgrammeGate({ full = false }: { full?: boolean }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    getSession().then(s => setSession(s ?? null))
  }, [])

  if (full) return <ProgrammeRoute />

  if (session === undefined) return null

  if (session === null) {
    return (
      <Auth
        onAuth={() => getSession().then(s => setSession(s ?? null))}
        initialMode='login'
      />
    )
  }

  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const { isDark } = useContext(ThemeContext)
  const [activePage,  setActivePage]  = useState<Page>('dashboard')
  const [displayName, setDisplayName] = useState<string | undefined>(undefined)
  const [guestName,   setGuestName]   = useState<string | undefined>(undefined)

  useEffect(() => {
    _setPalette(isDark ? darkPalette : lightPalette)
  }, [isDark])

  useEffect(() => {
    getProfile().then(p => {
      if (!p) return
      const name = p.displayName ?? p.email.split('@')[0]
      setDisplayName(name)
      setGuestName(name)
    }).catch(console.error)
  }, [])

  async function handleSignOut() {
    await signOut()
    window.location.reload()
  }

  return (
    <Layout
      activePage={activePage}
      onNavigate={setActivePage}
      onSignOut={handleSignOut}
      guestName={guestName}
    >
      {activePage === 'dashboard' && (
        <Dashboard displayName={displayName} />
      )}
      {activePage === 'programme' && (
        <ProgrammeList />
      )}
      {activePage === 'profile' && (
        <Profile />
      )}
    </Layout>
  )
}