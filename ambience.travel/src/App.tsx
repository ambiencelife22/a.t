/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 *
 * Production routes:
 *   ambience.travel/*                                    → LandingLayout (public)
 *   ambience.travel/experiences/:slug                    → SignatureExperiencePage
 *   ambience.travel/immerse/:url_id                      → ImmerseEngagementRoute
 *   ambience.travel/immerse/:url_id/:destination         → ImmerseEngagementRoute
 *   immerse.ambience.travel/:url_id                      → ImmerseEngagementRoute
 *   immerse.ambience.travel/:url_id/:destination         → ImmerseEngagementRoute
 *   programme.ambience.travel/#admin                     → ProgrammeAdmin
 *   programme.ambience.travel/?signup=1                  → Auth signup
 *   programme.ambience.travel/stays/:id                  → Auth → full-page ProgrammeRoute
 *   programme.ambience.travel/journeys/:id               → Auth → full-page ProgrammeRoute
 *   programme.ambience.travel/ (root)                    → Auth → Layout (Dashboard/List/Profile)
 *
 * Local dev routes:
 *   localhost:5173/                                      → Landing
 *   localhost:5173/?signup=1                             → Auth signup
 *   localhost:5173/programme/#admin                      → ProgrammeAdmin
 *   localhost:5173/programme/stays/:id                   → Auth → full-page ProgrammeRoute
 *   localhost:5173/programme/journeys/:id                → Auth → full-page ProgrammeRoute
 *   localhost:5173/programme/ or /programme              → Auth → Layout
 *   localhost:5173/immerse/:url_id                       → ImmerseEngagementRoute
 *   localhost:5173/immerse/:url_id/:destination          → ImmerseEngagementRoute
 *
 * Immerse subdomain (S32): immerse.ambience.travel is the canonical immerse host.
 *   On that host, the URL shape is /<url_id> (no /immerse/ prefix). The
 *   ambience.travel/immerse/* path-prefix shape continues to work in parallel
 *   until verified, after which it 301s to the new subdomain.
 *
 * Immerse disambiguator: first immerse path segment is shape-tested.
 *   - 11-char [A-Za-z0-9] hash → engagement route
 *   - anything else            → redirect to / (homepage)
 *
 * Last updated: S32 — Added immerse.ambience.travel hostname routing.
 *   resolveRoute() detects the new subdomain and routes any 11-char path
 *   segment to ImmerseEngagementRoute. resolveImmerseSegments() uses
 *   subdomain-aware path parsing (no /immerse/ prefix on the new subdomain).
 *   Both URL shapes (subdomain + path-prefix) work simultaneously during
 *   transition. Path-prefix → subdomain 301 redirect deferred until both
 *   shapes are verified rendering identically on prod.
 * Prior: S30E perf — Route-level code splitting via React.lazy() + Suspense.
 *   Every route component lazy-loaded so /immerse/<url_id> cold load no
 *   longer downloads ProgrammeAdmin / GuestLinker / SignatureExperience /
 *   etc. Slug-based public preview replaced by url_id with the 'pub' visual
 *   prefix convention (e.g. pubMuirRzSW). Bad immerse paths redirect to /
 *   via window.location.replace.
 */

import { useEffect, useState, useContext, lazy, Suspense } from 'react'
import RouteLoading from './components/RouteLoading'
import { getSession } from './lib/auth'
import { getProfile } from './lib/queries'
import { _setPalette, darkPalette, lightPalette } from './lib/theme'
import { ThemeContext } from './lib/ThemeContext'
import type { Session } from '@supabase/supabase-js'
import type { Page } from './components/Layout'

// ── Lazy route components ────────────────────────────────────────────────────
// Every route boundary is a code-split point. Each component below becomes its
// own Vite chunk at build time, downloaded only when the route resolves to it.

const LandingLayout            = lazy(() => import('./components/layouts/LandingLayout'))
const ProgrammeRoute           = lazy(() => import('./components/programme/ProgrammeRoute'))
const ProgrammeAdmin           = lazy(() => import('./components/admin/ProgrammeAdmin'))
const Layout                   = lazy(() => import('./components/Layout'))
const Dashboard                = lazy(() => import('./components/Dashboard'))
const ProgrammeList            = lazy(() => import('./components/ProgrammeList'))
const Profile                  = lazy(() => import('./components/Profile'))
const Auth                     = lazy(() => import('./components/Auth'))
const SignatureExperiencePage  = lazy(() => import('./components/landing/experiences/SignatureExperiencePage'))
const ImmerseEngagementRoute   = lazy(() => import('./components/immerse/ImmerseEngagementRoute'))

type Route = 'landing' | 'admin' | 'app' | 'programme-detail' | 'signup' | 'experience' | 'immerse'

const IMMERSE_HOST = 'immerse.ambience.travel'

function isImmerseHost(): boolean {
  return window.location.hostname === IMMERSE_HOST
}

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

// S32: immerse routes match either ambience.travel/immerse/* OR any path on
// immerse.ambience.travel.
function isImmerseRoute(): boolean {
  if (isImmerseHost()) return true
  return window.location.pathname.startsWith('/immerse/')
}

// S32: subdomain-aware segment resolution.
// On immerse.ambience.travel the URL is /<url_id>[/<destination>].
// On ambience.travel (and localhost) the URL is /immerse/<url_id>[/<destination>].
function resolveImmerseSegments(): { seg1: string; seg2: string | null } {
  const pathname = window.location.pathname.replace(/\/$/, '')
  const stripped = isImmerseHost()
    ? pathname.replace(/^\/+/, '')
    : pathname.replace(/^\/immerse\/?/, '').replace(/^\/+/, '')
  const parts = stripped.split('/').filter(Boolean)
  return { seg1: parts[0] ?? '', seg2: parts[1] ?? null }
}

function isTripUrlId(seg: string): boolean {
  return /^[A-Za-z0-9]{11}$/.test(seg)
}

function resolveRoute(): Route {
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  const hash     = window.location.hash
  const params   = new URLSearchParams(window.location.search)

  if (params.get('signup') === '1') return 'signup'
  if (hash === '#admin')            return 'admin'

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

    // Shape-based disambiguator: 11-char alphanumeric → engagement route.
    if (isTripUrlId(seg1)) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <ImmerseEngagementRoute />
        </Suspense>
      )
    }

    // Anything else under the immerse surface — bad path, slug-based legacy
    // URL, or empty — redirect to homepage. window.location.replace avoids a
    // history entry pointing at the dead route. On the new subdomain we
    // redirect to the marketing site root, not the immerse subdomain root.
    const homeUrl = isImmerseHost() ? 'https://ambience.travel/' : '/'
    window.location.replace(homeUrl)
    return <RouteLoading />
  }

  if (route === 'signup') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <Auth onAuth={() => { window.location.search = '' }} initialMode='signup' />
      </Suspense>
    )
  }

  if (route === 'admin') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ProgrammeAdmin />
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

  // Always render ProgrammeRoute for detail pages — it handles
  // public/private branching internally via supabaseAnon
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