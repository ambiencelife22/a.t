/* App.tsx
 * Top-level router for ambience.travel — no external routing library.
 * Routes by hostname first, then pathname as fallback (for local dev).
 *
 * Production:
 *   ambience.travel/*                        → LandingLayout (public, ungated)
 *   programme.ambience.travel/#admin         → ProgrammeAdmin (is_admin gate)
 *   programme.ambience.travel/*              → Auth gate → ProgrammeLayout + ProgrammeRoute
 *   programme.ambience.travel/?signup=1      → Auth (signup mode, hidden — not linked in UI)
 *
 * Local dev:
 *   localhost:5173/                          → Landing
 *   localhost:5173/programme/*#admin         → ProgrammeAdmin
 *   localhost:5173/programme/*               → Auth gate → Programme
 *   localhost:5173/?signup=1                 → Auth (signup mode)
 *
 * Auth gate:
 *   Checks Supabase session on mount. If no session, shows Auth (login mode).
 *   On successful auth, re-checks session and renders the programme.
 *   Landing page is always public — never gated.
 *
 * Admin gate:
 *   Hash-based — #admin on programme.ambience.travel or any /programme/* path.
 *   Matches SPORTS pattern exactly. ProgrammeAdmin handles is_admin check internally.
 *
 * Sign-up access:
 *   Reachable via ?signup=1 query param only. Not linked anywhere in the UI.
 *   Used by admin to onboard new users.
 */

import { useEffect, useState } from 'react'
import LandingLayout from './components/layouts/LandingLayout'
import ProgrammeRoute from './components/programme/ProgrammeRoute'
import ProgrammeAdmin from './components/admin/ProgrammeAdmin'
import Auth from './components/Auth'
import { getSession } from './lib/auth'
import type { Session } from '@supabase/supabase-js'

type Route = 'landing' | 'admin' | 'programme' | 'signup'

function resolveRoute(): Route {
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  const hash     = window.location.hash
  const params   = new URLSearchParams(window.location.search)

  // Hidden signup route — not linked in any public UI
  if (params.get('signup') === '1') return 'signup'

  // Hash-based admin — works from root on both production and localhost
  // Matches SPORTS pattern: sports.ambience.life/#admin
  if (hash === '#admin') return 'admin'

  if (hostname === 'programme.ambience.travel') return 'programme'
  if (pathname.startsWith('/programme/')) return 'programme'

  return 'landing'
}

export default function App() {
  const [route, setRoute] = useState<Route>(resolveRoute())

  // Listen for hash changes — matches SPORTS hashchange pattern
  useEffect(() => {
    function handleHashChange() {
      setRoute(resolveRoute())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Landing is always public — no auth check needed
  if (route === 'landing') return <LandingLayout />

  // Hidden signup page — no session check, just render the form
  if (route === 'signup') return <Auth onAuth={() => { window.location.search = '' }} initialMode='signup' />

  // Admin route — ProgrammeAdmin handles its own is_admin gate internally
  if (route === 'admin') return <ProgrammeAdmin />

  // Programme route — session-gated
  return <ProgrammeGate />
}

function ProgrammeGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    getSession().then(s => setSession(s ?? null))
  }, [])

  // Still checking — render nothing (avoids flash)
  if (session === undefined) return null

  // No session — show login
  if (session === null) {
    return (
      <Auth
        onAuth={() => {
          getSession().then(s => setSession(s ?? null))
        }}
        initialMode='login'
      />
    )
  }

  // Authenticated — render the programme
  return <ProgrammeRoute />
}