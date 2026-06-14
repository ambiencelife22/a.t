/* AmbienceAdmin.tsx
 * Top-level admin shell for ambience.travel/#admin (and localhost:5173/#admin).
 * Mounts both the Immerse and Programme product groups behind a single sidebar.
 *
 * Last updated: S43 Add 2 — all tab imports converted to lazy() for code
 *   splitting. AmbienceAdmin chunk: 541KB → distributed across per-tab chunks.
 *   Suspense wrapper added around TabContent with AdminLoading fallback.
 * Prior: S49 — import programme tabs directly from ProgrammeAdmin.tsx.
 * Prior: S45 — Added ItineraryEditorPage at #admin/trips/{tripId}/itinerary.
 * Prior: S46 — Added BriefEditorPage at #admin/trips/{tripId}/brief.
 * Prior: S40D — Added House product group (HouseTab).
 * Prior: S36 — Wired Library + Guides product groups.
 * Prior: S33
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getSession } from '../utils/utilsAuth'
import { parseAdminHash, type AdminTab } from '../utils/utilsAdminPath'
import { A } from '../tokens/tokensAdmin'
import { AdminToastProvider } from './admin/_adminPrimitives'

const AdminSidebar         = lazy(() => import('./admin/AdminSidebar'))
const EngagementsListTab   = lazy(() => import('./admin/EngagementsListTab'))
const EngagementDetailTab  = lazy(() => import('./admin/EngagementDetailTab'))
const ShowcasesListTab     = lazy(() => import('./admin/ShowcasesListTab'))
const LibraryDiningTab     = lazy(() => import('./admin/LibraryDiningTab'))
const GuidesDiningTab      = lazy(() => import('./admin/GuidesDiningTab'))
const GuidesHotelsTab      = lazy(() => import('./admin/GuidesHotelsTab'))
const LibraryHotelsTab     = lazy(() => import('./admin/LibraryHotelsTab'))
const GuidesExperiencesTab = lazy(() => import('./admin/GuidesExperiencesTab'))
const HouseTab             = lazy(() => import('./admin/HouseTab'))
const BriefEditorPage      = lazy(() => import('./admin/BriefEditorPage'))
const ItineraryEditorPage  = lazy(() => import('./admin/ItineraryEditorPage'))
const OperationsTab        = lazy(() => import('./admin/OperationsTab').then(m => ({ default: m.OperationsTab })))
const TimeTrackingTab      = lazy(() => import('./admin/TimeTrackingTab'))
const TimeAnalyticsTab     = lazy(() => import('./admin/TimeAnalyticsTab'))
const ClientProfilePage    = lazy(() => import('./admin/ClientProfilePage'))

const ProgrammesTab        = lazy(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.ProgrammesTab })))
const WelcomeLettersTab    = lazy(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.WelcomeLettersTab })))
const ListingsTab          = lazy(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.ListingsTab })))
const PropertySectionsTab  = lazy(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.PropertySectionsTab })))
const PropertiesTab        = lazy(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.PropertiesTab })))
const AccessDeniedPageTab  = lazy(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.AccessDeniedPageTab })))

// ── Loading fallback ──────────────────────────────────────────────────────────

function AdminLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading…</div>
    </div>
  )
}

// ── Access denied ─────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: A.text, fontFamily: A.font }}>Access denied.</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: A.gold, textDecoration: 'none', fontFamily: A.font }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function AdminShell() {
  const [tab,      setTab]      = useState<AdminTab>(() => parseAdminHash(window.location.hash))
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function sync() { setTab(parseAdminHash(window.location.hash)) }
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate',   sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate',   sync)
    }
  }, [])

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Full-page cream editors — bypass standard admin chrome
  if (tab.product === 'trips' && tab.tab === 'brief') {
    return (
      <Suspense fallback={<AdminLoading />}>
        <BriefEditorPage tripId={tab.tripId} />
      </Suspense>
    )
  }
  if (tab.product === 'trips' && tab.tab === 'itinerary') {
    return (
      <Suspense fallback={<AdminLoading />}>
        <ItineraryEditorPage tripId={tab.tripId} />
      </Suspense>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font, color: A.text }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: A.bgCard, borderBottom: `1px solid ${A.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 32px)', height: 52,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, letterSpacing: '0.06em' }}>
          ambience · Admin
        </div>
        <a href='https://ambience.travel' style={{ fontSize: 11, color: A.faint, textDecoration: 'none', letterSpacing: '0.04em' }}>
          ← Back to site
        </a>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        <Suspense fallback={null}>
          {!isMobile && <AdminSidebar tab={tab} />}
        </Suspense>
        <div style={{ flex: 1, padding: `clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px)`, maxWidth: isMobile ? '100%' : 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <Suspense fallback={null}>
            {isMobile && <AdminSidebar tab={tab} mobile />}
          </Suspense>
          <Suspense fallback={<AdminLoading />}>
            <TabContent tab={tab} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

// ── Tab dispatch ──────────────────────────────────────────────────────────────

function TabContent({ tab }: { tab: AdminTab }) {
  if (tab.product === 'immerse') {
    if (tab.tab === 'engagements') {
      if (tab.urlId) return <EngagementDetailTab urlId={tab.urlId} />
      return <EngagementsListTab />
    }
    if (tab.tab === 'showcases') return <ShowcasesListTab />
  }

  if (tab.product === 'guides') {
    if (tab.tab === 'dining')      return <GuidesDiningTab />
    if (tab.tab === 'experiences') return <GuidesExperiencesTab />
    if (tab.tab === 'hotels')      return <GuidesHotelsTab />
  }

  if (tab.product === 'library') {
    if (tab.tab === 'dining') return <LibraryDiningTab destinationId={tab.destinationId} />
    if (tab.tab === 'hotels') return <LibraryHotelsTab destinationId={tab.destinationId} />
  }

  if (tab.product === 'house')      return <HouseTab />
  if (tab.product === 'operations') return <OperationsTab />
  if (tab.product === 'time') {
    if (tab.tab === 'analytics') return <TimeAnalyticsTab />
    return <TimeTrackingTab />
  }

  if (tab.product === 'programme') {
    if (tab.tab === 'programmes')     return <ProgrammesTab />
    if (tab.tab === 'letters')        return <WelcomeLettersTab />
    if (tab.tab === 'listings')       return <ListingsTab />
    if (tab.tab === 'sections')       return <PropertySectionsTab />
    if (tab.tab === 'properties')     return <PropertiesTab />
    if (tab.tab === 'access-denied')  return <AccessDeniedPageTab />
    if (tab.tab === 'client-profile') return <ClientProfilePage />
  }

  return <EngagementsListTab />
}

// ── Gated entry point ─────────────────────────────────────────────────────────

export default function AmbienceAdmin() {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    async function check() {
      const session = await getSession()
      if (!session) { setStatus('denied'); return }
      const { data } = await supabase
        .from('global_profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
      setStatus(data?.is_admin === true ? 'allowed' : 'denied')
    }
    check()
  }, [])

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Checking access…</div>
      </div>
    )
  }

  if (status === 'denied') return <AccessDenied />
  return <AdminToastProvider><AdminShell /></AdminToastProvider>
}