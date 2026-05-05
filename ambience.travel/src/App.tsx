/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 *
 * Production routes:
 *   ambience.travel/*                                    → LandingLayout (public)
 *   ambience.travel/experiences/:slug                    → SignatureExperiencePage
 *   ambience.travel/#admin                               → AmbienceAdmin (S33)
 *   ambience.travel/immerse/:url_id                      → ImmerseEngagementRoute
 *   ambience.travel/immerse/:url_id/:destination         → ImmerseEngagementRoute
 *   ambience.travel/guides/:destination/dining           → DiningGuideRoute (S35)
 *   ambience.travel/guides/:destination/hotels           → HotelGuideRoute (S37)
 *   immerse.ambience.travel/:url_id                      → ImmerseEngagementRoute
 *   immerse.ambience.travel/:url_id/:destination         → ImmerseEngagementRoute
 *   guides.ambience.travel/:destination/dining           → DiningGuideRoute (S35)
 *   guides.ambience.travel/:destination/hotels           → HotelGuideRoute (S37)
 *   programme.ambience.travel/#admin                     → ProgrammeAdmin (existing, untouched)
 *   programme.ambience.travel/?signup=1                  → Auth signup
 *   programme.ambience.travel/stays/:id                  → Auth → full-page ProgrammeRoute
 *   programme.ambience.travel/journeys/:id               → Auth → full-page ProgrammeRoute
 *   programme.ambience.travel/ (root)                    → Auth → Layout (Dashboard/List/Profile)
 *
 * Local dev routes:
 *   localhost:5173/                                      → Landing
 *   localhost:5173/?signup=1                             → Auth signup
 *   localhost:5173/#admin                                → AmbienceAdmin (new shell, S33)
 *   localhost:5173/programme/#admin                      → ProgrammeAdmin (existing)
 *   localhost:5173/programme/stays/:id                   → Auth → full-page ProgrammeRoute
 *   localhost:5173/programme/journeys/:id                → Auth → full-page ProgrammeRoute
 *   localhost:5173/programme/ or /programme              → Auth → Layout
 *   localhost:5173/immerse/:url_id                       → ImmerseEngagementRoute
 *   localhost:5173/immerse/:url_id/:destination          → ImmerseEngagementRoute
 *   localhost:5173/guides/:destination/dining            → DiningGuideRoute (S35)
 *   localhost:5173/guides/:destination/hotels            → HotelGuideRoute (S37)
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
 * Last updated: S37 — Added 'guides-hotels' route. resolveGuidePath() now
 *   returns surface union ('dining' | 'hotels'). Route resolver dispatches
 *   on surface. New lazy import HotelGuideRoute. Mirrors S35 dining shape.
 * Prior: S35 — Added 'guides-dining' route for guides.ambience.travel
 *   and ambience.travel/guides/<dest>/dining. Hostname-based + path-based
 *   disambiguator mirrors the immerse pattern (isImmerseHost + isImmerseRoute).
 *   New helpers: isGuidesHost() + resolveGuidePath(). New lazy import
 *   DiningGuideRoute. No other elements touched.
 * Prior: S33 — Added 'admin-new' route for AmbienceAdmin.
 *   Hash matching changed from === '#admin' to startsWith('#admin') to
 *   support sub-paths. Hostname disambiguator distinguishes the existing
 *   programme admin from the new shell.
 * Prior: S32F — Inline IMMERSE_HOST + isImmerseHost() + isTripUrlId()
 *   removed in favour of imports from lib/immersePath.
 * Prior: S32 — Added immerse.ambience.travel hostname routing.
 * Prior: S30E perf — Route-level code splitting via React.lazy() + Suspense.
 */

import { useEffect, useState, useContext, lazy, Suspense } from 'react'
import RouteLoading from './components/RouteLoading'
import { getSession } from './lib/auth'
import { getProfile } from './lib/queries'
import { _setPalette, darkPalette, lightPalette } from './lib/theme'
import { ThemeContext } from './lib/ThemeContext'
import { isImmerseHost, isTripUrlId } from './lib/immersePath'
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
const DiningGuideRoute         = lazy(() => import('./components/guides/DiningGuideRoute'))
const HotelGuideRoute          = lazy(() => import('./components/guides/HotelGuideRoute'))

type Route =
  | 'landing'
  | 'admin-programme'
  | 'admin-ambience'
  | 'app'
  | 'programme-detail'
  | 'signup'
  | 'experience'
  | 'immerse'
  | 'guides-dining'
  | 'guides-hotels'

function hasUrlId(): boolean {
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  if (hostname === 'programme.ambience.travel') {
    return /^\/(stays|journeys)\/.+/.test(pathname)
  }

  return /^\/programme\/(stays|journeys)\/.+/.test(pathname)
}

function isExperienceRoute(): boolean {
  return window.location.pathname.startsWith('/experiences/')
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
// guides.ambience.travel hosts the destination guide pages (dining first,
// hotels in S37, activities later). Mirrors isImmerseHost() pattern.
function isGuidesHost(): boolean {
  return window.location.hostname === 'guides.ambience.travel'
}

// S35 — resolve guide path segments.
// S37 — extended to include 'hotels' surface.
// On guides subdomain: /<dest>/<surface>
// On main domain: /guides/<dest>/<surface>
// Returns { destinationSlug, surface } when matched, null otherwise.
function resolveGuidePath(): { destinationSlug: string; surface: 'dining' | 'hotels' } | null {
  const pathname = window.location.pathname.replace(/\/+$/, '')
  let stripped: string

  if (isGuidesHost()) {
    stripped = pathname.replace(/^\/+/, '')
  } else {
    if (!pathname.startsWith('/guides/')) return null
    stripped = pathname.replace(/^\/guides\/?/, '').replace(/^\/+/, '')
  }

  const parts = stripped.split('/').filter(Boolean)
  if (parts.length === 2 && (parts[1] === 'dining' || parts[1] === 'hotels')) {
    return { destinationSlug: parts[0], surface: parts[1] as 'dining' | 'hotels' }
  }
  return null
}

// S33 — admin route disambiguator.
// programme.ambience.travel/#admin and localhost:5173/programme/#admin route
// to the existing ProgrammeAdmin (untouched). Anything else with #admin routes
// to the new unified AmbienceAdmin shell.
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

  // S33 — hash sub-paths supported (#admin/immerse/engagements/<url_id>, etc)
  if (hash.startsWith('#admin')) {
    return isProgrammeAdminContext() ? 'admin-programme' : 'admin-ambience'
  }

  // S35: guides subdomain → always guides route. On main domain, /guides/
  // path prefix routes the same way. Resolved before immerse host check
  // because guides has its own hostname.
  // S37: surface-based dispatch (dining vs hotels).
  if (isGuidesHost() || pathname.startsWith('/guides/')) {
    const guidePath = resolveGuidePath()
    if (guidePath) {
      if (guidePath.surface === 'hotels') return 'guides-hotels'
      return 'guides-dining'
    }
    // On guides subdomain with no valid path, redirect to ambience.travel root.
    if (isGuidesHost()) {
      window.location.replace('https://ambience.travel/')
    }
    // On main domain at /guides/ with no valid path, fall through to landing.
  }

  // S32: immerse.ambience.travel → always immerse route.
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
        <DiningGuideRoute />
      </Suspense>
    )
  }

  if (route === 'guides-hotels') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <HotelGuideRoute />
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
    const { signOut } = await import('./lib/auth')
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