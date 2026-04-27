/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 *
 * Production routes:
 *   ambience.travel/*                                    → LandingLayout (public)
 *   ambience.travel/experiences/:slug                    → SignatureExperiencePage
 *   ambience.travel/immerse/:url_id                      → ImmerseEngagementRoute (engagement overview)
 *   ambience.travel/immerse/:url_id/:destination         → ImmerseEngagementRoute (destination subpage)
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
 *   localhost:5173/immerse/:url_id                       → ImmerseEngagementRoute (engagement overview)
 *   localhost:5173/immerse/:url_id/:destination          → ImmerseEngagementRoute (destination subpage)
 *
 * Immerse disambiguator: first /immerse/ segment is shape-tested.
 *   - 11-char [A-Za-z0-9] hash → engagement route (private + public templates both
 *     use this shape; public templates use a 'pub' visual prefix convention)
 *   - anything else            → redirect to / (homepage)
 *
 * Key distinction: a url_id segment (stays/:id or journeys/:id) renders the
 * full-page programme view. The programme root renders the app shell.
 *
 * Last updated: S30E perf — Route-level code splitting via React.lazy() +
 *   Suspense. Every route component lazy-loaded so /immerse/<url_id> cold
 *   load no longer downloads ProgrammeAdmin / GuestLinker / SignatureExperience
 *   / etc. Removed PublicHoneymoonRoute and the /immerse/honeymoon and
 *   /immerse/honeymoon/<dest> routes — the only canonical immerse URL shape
 *   is now /immerse/<11-char-url_id>. Slug-based public preview replaced by
 *   url_id with the 'pub' visual prefix convention (e.g. pubMuirRzSW).
 *   Bad immerse paths now redirect to / via window.location.replace.
 *   getImmerseEngagementBySlug import removed (dead code).
 * Prior: S30E stage 3 — Import path updated for renamed
 *   immerseEngagementQueries.ts → immerseEngagementQueries.ts.
 * Prior: S30E stage 2 — Component + import path renames for the
 *   engagement abstraction.
 * Prior: S30E stage 1 — getImmerseTripBySlug → getImmerseEngagementBySlug;
 *   type ImmerseTripData → ImmerseEngagementData.
 * Prior: S17 — Public honeymoon preview was DB-backed via slug 'honeymoon1'.
 *   Replaced S30E perf with the url_id 'pub' prefix convention.
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
// /immerse/<url_id> no longer downloads ProgrammeAdmin / GuestLinker / etc.

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
  return window.location.pathname.startsWith('/immerse/')
}

function resolveImmerseSegments(): { seg1: string; seg2: string | null } {
  const parts = window.location.pathname.replace('/immerse/', '').replace(/\/$/, '').split('/')
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
    // Public templates (pub-prefix visual convention) match the same regex.
    if (isTripUrlId(seg1)) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <ImmerseEngagementRoute />
        </Suspense>
      )
    }

    // Anything else under /immerse/ — bad path, slug-based legacy URL,
    // or empty — redirect to homepage. window.location.replace avoids a
    // history entry pointing at the dead route.
    window.location.replace('/')
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