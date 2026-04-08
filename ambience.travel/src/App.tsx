/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 *
 * Production routes:
 *   ambience.travel/*                                    → LandingLayout (public)
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
 *
 * Key distinction: a url_id segment (stays/:id or journeys/:id) renders the
 * full-page programme view. The programme root renders the app shell.
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
import { getSession } from './lib/auth'
import { getProfile } from './lib/queries'
import { _setPalette, darkPalette, lightPalette } from './lib/theme'
import { ThemeContext } from './lib/ThemeContext'
import type { Session } from '@supabase/supabase-js'

type Route = 'landing' | 'admin' | 'app' | 'programme-detail' | 'signup'

function hasUrlId(): boolean {
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  if (hostname === 'programme.ambience.travel') {
    return /^\/(stays|journeys)\/.+/.test(pathname)
  }

  return /^\/programme\/(stays|journeys)\/.+/.test(pathname)
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

  return 'landing'
}

export default function App() {
  const [route, setRoute] = useState<Route>(resolveRoute())

  useEffect(() => {
    function handleHashChange() { setRoute(resolveRoute()) }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route === 'landing')          return <LandingLayout />
  if (route === 'signup')           return <Auth onAuth={() => { window.location.search = '' }} initialMode='signup' />
  if (route === 'admin')            return <ProgrammeAdmin />
  if (route === 'programme-detail') return <ProgrammeGate full />

  return <ProgrammeGate />
}

function ProgrammeGate({ full = false }: { full?: boolean }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    getSession().then(s => setSession(s ?? null))
  }, [])

  if (session === undefined) return null

  if (session === null) {
    return (
      <Auth
        onAuth={() => getSession().then(s => setSession(s ?? null))}
        initialMode='login'
      />
    )
  }

  if (full) return <ProgrammeRoute />
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