/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 *
 * Production routes:
 *   ambience.travel/*                                    → LandingLayout (public)
 *   ambience.travel/experiences/:slug                    → SignatureExperiencePage
 *   ambience.travel/immerse/honeymoon                    → PublicHoneymoonRoute → ImmerseTripPage
 *                                                          (DB-backed via slug 'honeymoon1')
 *   ambience.travel/immerse/:journey_type/:destination   → DestinationPage (public inspiration)
 *   ambience.travel/immerse/:url_id                      → ImmerseTripRoute (engagement overview)
 *   ambience.travel/immerse/:url_id/:destination         → ImmerseTripRoute (destination subpage)
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
 *   localhost:5173/immerse/honeymoon                     → PublicHoneymoonRoute → ImmerseTripPage
 *   localhost:5173/immerse/:journey_type/:destination    → DestinationPage (public inspiration)
 *   localhost:5173/immerse/:url_id                       → ImmerseTripRoute (engagement overview)
 *   localhost:5173/immerse/:url_id/:destination          → ImmerseTripRoute (destination subpage)
 *
 * Immerse disambiguator: first /immerse/ segment is shape-tested.
 *   - 11-char [A-Za-z0-9] hash → engagement route (private, url_id keyed)
 *   - 'honeymoon' (no seg2)    → public preview (slug = 'honeymoon1' in DB)
 *   - 'honeymoon' + :dest      → public inspiration destination page
 *   - anything else            → landing
 *
 * Key distinction: a url_id segment (stays/:id or journeys/:id) renders the
 * full-page programme view. The programme root renders the app shell.
 *
 * Last updated: S30E — Engagement abstraction. getImmerseTripBySlug →
 *   getImmerseEngagementBySlug; type ImmerseTripData → ImmerseEngagementData.
 *   Component name + filename preserved this session.
 * Prior: S17 — Public honeymoon preview is now DB-backed (slug 'honeymoon1')
 */

import { useEffect, useState, useContext } from 'react'
import LandingLayout from './components/layouts/LandingLayout'
import ProgrammeRoute from './components/programme/ProgrammeRoute'
import ProgrammeAdmin from './components/admin/ProgrammeAdmin'
import Layout, { type Page } from './components/Layout'
import Dashboard from './components/Dashboard'
import ProgrammeList from './components/ProgrammeList'
import Profile from './components/Profile'
import Auth from './components/Auth'
import SignatureExperiencePage from './components/landing/experiences/SignatureExperiencePage'
import ImmerseTripRoute          from './components/landing/immerse/ImmerseTripRoute'
import ImmerseTripPage          from './components/landing/immerse/ImmerseTripPage'
import DestinationPage          from './components/landing/immerse/DestinationPage'
import { getImmerseEngagementBySlug } from './lib/immerseTripQueries'
import type { ImmerseEngagementData } from './lib/immerseTypes'
import { getSession } from './lib/auth'
import { getProfile } from './lib/queries'
import { _setPalette, darkPalette, lightPalette } from './lib/theme'
import { ThemeContext } from './lib/ThemeContext'
import type { Session } from '@supabase/supabase-js'

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

  if (route === 'landing')          return <LandingLayout />
  if (route === 'experience')       return <SignatureExperiencePage />

  if (route === 'immerse') {
  const { seg1, seg2 } = resolveImmerseSegments()

  // Shape-based disambiguator: 11-char alphanumeric → engagement route
  if (isTripUrlId(seg1)) return <ImmerseTripRoute />

  // Public honeymoon overview — DB-backed via slug lookup
  if (seg1 === 'honeymoon' && !seg2) return <PublicHoneymoonRoute />

  // Public inspiration destination pages
  if (seg1 === 'honeymoon' && seg2) return <DestinationPage />

  return <LandingLayout />
}

  if (route === 'signup')           return <Auth onAuth={() => { window.location.search = '' }} initialMode='signup' />
  if (route === 'admin')            return <ProgrammeAdmin />
  if (route === 'programme-detail') return <ProgrammeGate full />

  return <ProgrammeGate />
}

// ── Public honeymoon preview wrapper ────────────────────────────────────────
// Fetches the public honeymoon engagement row (slug = 'honeymoon1') and
// renders it through the normal ImmerseTripPage. No url_id involved — this
// is a slug-keyed public preview, distinct from Yazeed's url_id-keyed private
// engagement. As more preview options ship, this can be upgraded to select
// among them (splash page) rather than loading a single row.
function PublicHoneymoonRoute() {
  const [data, setData] = useState<ImmerseEngagementData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getImmerseEngagementBySlug('honeymoon1').then(t => {
      if (cancelled) return
      setData(t)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  if (loading) return null
  return <ImmerseTripPage data={data} />
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