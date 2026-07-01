/* AmbienceAdmin.tsx
 * Top-level admin shell for ambience.travel/#admin (and localhost:5173/#admin).
 *
 * Last updated: S53G Phase 1 — new 5-group taxonomy wired into TabContent.
 *   Legacy products (immerse, guides, library, house, operations, time, calendar,
 *   finance, programme) still dispatch correctly via alias routes in utilsAdminPath.
 *   New products (trips, clients, content, residences, studio) wired to placeholder
 *   or existing components as appropriate — full surface builds happen in Phase 3+.
 *   'itinerary' tab renamed to 'programme' throughout.
 *
 * Prior: S43 Add 2 — lazy() code splitting + Suspense.
 * Prior: S49 — programme tabs imported from ProgrammeAdmin.tsx.
 * Prior: S45 — ItineraryEditorPage at #admin/trips/{tripId}/itinerary.
 * Prior: S46 — BriefEditorPage at #admin/trips/{tripId}/brief.
 * Prior: S40D — House product group.
 * Prior: S36 — Library + Guides product groups.
 * Prior: S33
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getSession } from '../utils/utilsAuth'
import { parseAdminHash, type AdminTab } from '../utils/utilsAdminPath'
import { A } from '../tokens/tokensAdmin'
import { AdminToastProvider } from './admin/_adminPrimitives'

function lazyWithReload<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const KEY = 'admin-chunk-reload'
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1')
        window.location.reload()
        return new Promise<T>(() => {})
      }
      throw err
    }),
  )
}

// ── Lazy imports ──────────────────────────────────────────────────────────────

const AdminSidebar         = lazyWithReload(() => import('./admin/AdminSidebar'))

// Legacy surfaces (still used during Phase 1-2 transition)
const EngagementsListTab   = lazyWithReload(() => import('./admin/EngagementsListTab'))
const EngagementDetailTab  = lazyWithReload(() => import('./admin/EngagementDetailTab'))
const ShowcasesListTab     = lazyWithReload(() => import('./admin/ShowcasesListTab'))
const LibraryDiningTab     = lazyWithReload(() => import('./admin/LibraryDiningTab'))
const LibraryHotelsTab     = lazyWithReload(() => import('./admin/LibraryHotelsTab'))
const GuidesDiningTab      = lazyWithReload(() => import('./admin/GuidesDiningTab'))
const GuidesHotelsTab      = lazyWithReload(() => import('./admin/GuidesHotelsTab'))
const GuidesExperiencesTab = lazyWithReload(() => import('./admin/GuidesExperiencesTab'))
const GuidesShoppingTab    = lazyWithReload(() => import('./admin/GuidesShoppingTab'))
const HouseTab             = lazyWithReload(() => import('./admin/HouseTab'))
const OperationsTab        = lazyWithReload(() => import('./admin/OperationsTab').then(m => ({ default: m.OperationsTab })))
const TimeTrackingTab      = lazyWithReload(() => import('./admin/TimeTrackingTab'))
const TimeAnalyticsTab     = lazyWithReload(() => import('./admin/TimeAnalyticsTab'))
const CalendarTab          = lazyWithReload(() => import('./admin/CalendarTab'))
const ClientProfilePage    = lazyWithReload(() => import('./admin/ClientProfilePage'))

// Full-page editors (cream canvas — bypass admin chrome)
const BriefEditorPage      = lazyWithReload(() => import('./admin/BriefEditorPage'))
const ItineraryEditorPage  = lazyWithReload(() => import('./admin/ItineraryEditorPage'))

// Financial
const FinancialTab         = lazyWithReload(() => import('./admin/FinancialTab'))
const OutlookTab           = lazyWithReload(() => import('./admin/OutlookTab'))
const TripDetail           = lazyWithReload(() => import('./admin/TripDetail'))
const StudioDashboard      = lazyWithReload(() => import('./admin/StudioDashboard'))

// Residences (was Programme)
const ProgrammesTab        = lazyWithReload(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.ProgrammesTab })))
const WelcomeLettersTab    = lazyWithReload(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.WelcomeLettersTab })))
const ListingsTab          = lazyWithReload(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.ListingsTab })))
const PropertySectionsTab  = lazyWithReload(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.PropertySectionsTab })))
const PropertiesTab        = lazyWithReload(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.PropertiesTab })))
const AccessDeniedPageTab  = lazyWithReload(() => import('./admin/ProgrammeAdmin').then(m => ({ default: m.AccessDeniedPageTab })))

// ── Loading / access denied ───────────────────────────────────────────────────

function AdminLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading…</div>
    </div>
  )
}

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

  useEffect(() => { sessionStorage.removeItem('admin-chunk-reload') }, [])

  // Full-page cream editors — bypass standard admin chrome
  if (tab.product === 'trips' && tab.tab === 'programme') {
    return (
      <Suspense fallback={<AdminLoading />}>
        <ItineraryEditorPage tripId={tab.tripId} />
      </Suspense>
    )
  }
  if (tab.product === 'trips' && tab.tab === 'brief') {
    return (
      <Suspense fallback={<AdminLoading />}>
        <BriefEditorPage tripId={tab.tripId} />
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
// Phase 1: new products dispatch here. Legacy products still resolve via
// utilsAdminPath aliases and land on their existing components.
// Phase 3+ will replace the legacy dispatches with new TripDetail, ClientsTab, etc.

function TabContent({ tab }: { tab: AdminTab }) {

  // ── New taxonomy ────────────────────────────────────────────────────────────

  if (tab.product === 'trips') {
    if (tab.tab === 'list') return <EngagementsListTab />
    if ('urlId' in tab) return <TripDetail urlId={tab.urlId} activeTab={tab.tab} />
    return <EngagementsListTab />
  }

  if (tab.product === 'clients') {
    // Phase 5: ClientsTab. For now, HouseTab is the nearest equivalent.
    return <HouseTab />
  }

  if (tab.product === 'content') {
    // Unified content surface — dispatches to existing guide/library tabs
    // Phase 3+: these will merge into a single ContentTab per category
    if (tab.tab === 'dining')      return <GuidesDiningTab />
    if (tab.tab === 'experiences') return <GuidesExperiencesTab />
    if (tab.tab === 'hotels')      return <GuidesHotelsTab />
    if (tab.tab === 'shopping')    return <GuidesShoppingTab />
    return <GuidesDiningTab />
  }

  if (tab.product === 'residences') {
    if (tab.tab === 'list')           return <ProgrammesTab />
    if (tab.tab === 'letters')        return <WelcomeLettersTab />
    if (tab.tab === 'listings')       return <ListingsTab />
    if (tab.tab === 'sections')       return <PropertySectionsTab />
    if (tab.tab === 'properties')     return <PropertiesTab />
    if (tab.tab === 'access-denied')  return <AccessDeniedPageTab />
    if (tab.tab === 'client-profile') return <ClientProfilePage />
    return <ProgrammesTab />
  }

  if (tab.product === 'studio') {
    if (tab.tab === 'finance')              return <FinancialTab />
    if (tab.tab === 'finance-engagement')   return <FinancialTab engagementId={tab.engagementId} />
    if (tab.tab === 'time')                 return <TimeTrackingTab />
    if (tab.tab === 'time-analytics')       return <TimeAnalyticsTab />
    return <StudioDashboard />
  }

  // ── Legacy aliases (kept until Phase 7 dissolution) ──────────────────────

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
    if (tab.tab === 'shopping')    return <GuidesShoppingTab />
  }

  if (tab.product === 'library') {
    if (tab.tab === 'dining') return <LibraryDiningTab destinationId={tab.destinationId} />
    if (tab.tab === 'hotels') return <LibraryHotelsTab destinationId={tab.destinationId} />
  }

  if (tab.product === 'house')      return <HouseTab />
  if (tab.product === 'calendar')   return <CalendarTab />
  if (tab.product === 'operations') return <OperationsTab />

  if (tab.product === 'time') {
    if (tab.tab === 'analytics') return <TimeAnalyticsTab />
    return <TimeTrackingTab />
  }

  if (tab.product === 'finance') {
    if (tab.tab === 'engagement') return <FinancialTab engagementId={tab.engagementId} />
    return <FinancialTab />
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

  // Default: trips list
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