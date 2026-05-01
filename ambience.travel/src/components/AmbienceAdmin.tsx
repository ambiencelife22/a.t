/* AmbienceAdmin.tsx
 * Top-level admin shell for ambience.travel/#admin (and localhost:5173/#admin).
 * Mounts both the Immerse and Programme product groups behind a single sidebar.
 *
 * Side-by-side with ProgrammeAdmin (mounted at programme.ambience.travel/#admin).
 * The two coexist by hostname — see App.tsx admin route resolution.
 *
 * Auth gate: same pattern as ProgrammeAdmin — getSession() + global_profiles.is_admin.
 *
 * Last updated: S33 — initial ship.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getSession } from '../lib/auth'
import { parseAdminHash, type AdminTab } from '../lib/adminPath'
import { A } from '../lib/adminTokens'

import AdminSidebar      from './admin/AdminSidebar'
import EngagementsListTab    from './admin/EngagementsListTab'
import EngagementDetailTab from './admin/EngagementDetailTab'
import ShowcasesListTab  from './admin/ShowcasesListTab'

// Existing programme tabs — wrapped from ProgrammeAdmin without modification.
// We import the named tab functions; ProgrammeAdmin currently keeps them
// internal (default export only). For now, the cleanest path is to re-mount
// ProgrammeAdmin's existing internal tab content via a stub import.
// If those tab functions aren't exported yet, see §note at bottom.
import {
  ProgrammesTab,
  WelcomeLettersTab,
  ListingsTab,
  PropertySectionsTab,
  PropertiesTab,
  AccessDeniedPageTab,
} from './admin/ProgrammeAdminTabs'
import ClientProfilePage from './admin/ClientProfilePage'

// ── Access denied (shared with ProgrammeAdmin pattern) ───────────────────────

function AccessDenied() {
  return (
    <div style={{
      minHeight:      '100vh',
      background:     A.bg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: A.text, fontFamily: A.font }}>Access denied.</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: A.gold, textDecoration: 'none', fontFamily: A.font }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}

// ── Shell ────────────────────────────────────────────────────────────────────

function AdminShell() {
  const [tab, setTab] = useState<AdminTab>(() => parseAdminHash(window.location.hash))
  const [isMobile, setIsMobile] = useState(false)

  // Hash sync — admin tab state is derived from window.location.hash
  useEffect(() => {
    function sync() { setTab(parseAdminHash(window.location.hash)) }
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font, color: A.text }}>
      {/* Topbar */}
      <div style={{
        position:     'sticky',
        top:          0,
        zIndex:       100,
        background:   A.bgCard,
        borderBottom: `1px solid ${A.border}`,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        padding:      '0 clamp(16px, 4vw, 32px)',
        height:       52,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, letterSpacing: '0.06em' }}>
          ambience · Admin
        </div>
        <a
          href='https://ambience.travel'
          style={{ fontSize: 11, color: A.faint, textDecoration: 'none', letterSpacing: '0.04em' }}
        >
          ← Back to site
        </a>
      </div>

      {/* Sidebar + content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        {!isMobile && <AdminSidebar tab={tab} />}

        <div style={{
          flex:      1,
          padding:   `clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px)`,
          maxWidth:  isMobile ? '100%' : 1100,
          width:     '100%',
          margin:    '0 auto',
          boxSizing: 'border-box',
        }}>
          {isMobile && <AdminSidebar tab={tab} mobile />}
          <TabContent tab={tab} />
        </div>
      </div>
    </div>
  )
}

// ── Tab dispatch ─────────────────────────────────────────────────────────────

function TabContent({ tab }: { tab: AdminTab }) {
  if (tab.product === 'immerse') {
    if (tab.tab === 'engagements') {
      if (tab.urlId) return <EngagementDetailTab urlId={tab.urlId} />
      return <EngagementsListTab />
    }
    if (tab.tab === 'showcases') return <ShowcasesListTab />
  }

  if (tab.product === 'programme') {
    if (tab.tab === 'programmes')      return <ProgrammesTab />
    if (tab.tab === 'letters')         return <WelcomeLettersTab />
    if (tab.tab === 'listings')        return <ListingsTab />
    if (tab.tab === 'sections')        return <PropertySectionsTab />
    if (tab.tab === 'properties')      return <PropertiesTab />
    if (tab.tab === 'access-denied')   return <AccessDeniedPageTab />
    if (tab.tab === 'client-profile')  return <ClientProfilePage />
  }

  return <EngagementsListTab />
}

// ── Gated entry point ────────────────────────────────────────────────────────

export default function AmbienceAdmin() {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    async function check() {
      const session = await getSession()
      if (!session) {
        setStatus('denied')
        return
      }

      const { data } = await supabase
        .from('global_profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (data?.is_admin === true) {
        setStatus('allowed')
        return
      }
      setStatus('denied')
    }

    check()
  }, [])

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: A.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>
          Checking access…
        </div>
      </div>
    )
  }

  if (status === 'denied') return <AccessDenied />

  return <AdminShell />
}

/*
 * §note on ProgrammeAdminTabs import:
 *
 * ProgrammeAdmin.tsx currently keeps ProgrammesTab / WelcomeLettersTab /
 * ListingsTab / PropertySectionsTab / PropertiesTab / AccessDeniedPageTab as
 * INTERNAL function declarations (not exported). To re-mount them from
 * AmbienceAdmin without forking, we need a tiny shim file that re-exports
 * the named tab functions. The shim is the load-bearing change to
 * ProgrammeAdmin.tsx — see ProgrammeAdmin.tsx surgical edit notes in the
 * S33 ship summary.
 *
 * ClientProfilePage is already a default export from its own file and
 * imports cleanly from the existing path.
 */