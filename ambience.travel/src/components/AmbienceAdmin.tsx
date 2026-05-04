/* AmbienceAdmin.tsx
 * Top-level admin shell for ambience.travel/#admin (and localhost:5173/#admin).
 * Mounts both the Immerse and Programme product groups behind a single sidebar.
 *
 * Side-by-side with ProgrammeAdmin (mounted at programme.ambience.travel/#admin).
 * The two coexist by hostname — see App.tsx admin route resolution.
 *
 * Auth gate: same pattern as ProgrammeAdmin — getSession() + global_profiles.is_admin.
 *
 * Last updated: S36 — Wired Library + Guides product groups (Dining tab in each).
 *   Library tab passes destinationId from URL hash for destination-scoped views.
 * Prior: S33
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
import LibraryDiningTab from './admin/LibraryDiningTab'
import GuidesDiningTab  from './admin/GuidesDiningTab'

import {
  ProgrammesTab,
  WelcomeLettersTab,
  ListingsTab,
  PropertySectionsTab,
  PropertiesTab,
  AccessDeniedPageTab,
} from './admin/ProgrammeAdminTabs'
import ClientProfilePage from './admin/ClientProfilePage'

// ── Access denied ────────────────────────────────────────────────────────────

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

  if (tab.product === 'guides') {
    if (tab.tab === 'dining') return <GuidesDiningTab />
  }

  if (tab.product === 'library') {
    if (tab.tab === 'dining') return <LibraryDiningTab destinationId={tab.destinationId} />
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