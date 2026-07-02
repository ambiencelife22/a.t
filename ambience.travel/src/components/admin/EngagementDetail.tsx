// EngagementDetail.tsx — One engagement, one interface.
// Tab bar: Overview (engagement editor) | Bookings (financial outlook).
// Contacts + Activity placeholders for Phase 3+.
//
// Last updated: S53I — tab bar reinstated after one-scroll approach caused UX issues.

import { A } from '../../tokens/tokensAdmin'
import { buildAdminHash, type EngagementDetailTabId } from '../../utils/utilsAdminPath'
import EngagementDetailTab from './EngagementDetailTab'
import OutlookTab from './OutlookTab'
import TasksSection from './TasksSection'

const TABS: { id: EngagementDetailTabId; label: string; ready: boolean }[] = [
  { id: 'overview',  label: 'Overview',  ready: true  },
  { id: 'bookings',  label: 'Bookings',  ready: true  },
  { id: 'tasks',     label: 'Tasks',     ready: true  },
  { id: 'contacts',  label: 'Contacts',  ready: false },
  { id: 'activity',  label: 'Activity',  ready: false },
]

export default function EngagementDetail({ urlId, activeTab }: {
  urlId:     string
  activeTab: EngagementDetailTabId
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `1px solid ${A.border}` }}>
        {TABS.map(t => {
          const active = t.id === activeTab
          return (
            <a
              key={t.id}
              href={buildAdminHash({ product: 'trips', tab: t.id, urlId })}
              style={{
                padding:        '12px 20px',
                fontSize:       11,
                fontWeight:     active ? 700 : 500,
                letterSpacing:  '0.06em',
                textTransform:  'uppercase',
                fontFamily:     A.font,
                color:          !t.ready ? A.faint : active ? A.gold : A.muted,
                borderBottom:   `2px solid ${active ? A.gold : 'transparent'}`,
                textDecoration: 'none',
                cursor:         t.ready ? 'pointer' : 'default',
                pointerEvents:  t.ready ? 'auto' : 'none',
                transition:     'all 150ms ease',
                whiteSpace:     'nowrap',
              }}
            >
              {t.label}
            </a>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <EngagementDetailTab urlId={urlId} />}
      {activeTab === 'bookings' && <OutlookTab urlId={urlId} />}
      {activeTab === 'tasks'    && <TasksSection urlId={urlId} />}
      {activeTab === 'contacts' && <Placeholder label='Contacts' />}
      {activeTab === 'activity' && <Placeholder label='Activity' />}
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>{label} — coming soon.</div>
    </div>
  )
}