// TripDetail.tsx — One trip, one interface.
// Thin shell with a tab bar that renders the trip's surfaces as inline tabs.
// Route: #admin/trips/<url_id>[/<tab>]
//
// Tabs:
//   Overview  — EngagementDetailTab (engagement editor, status, hero, routing, cards, rooms)
//   Bookings  — OutlookTab (financial outlook: margin, bookings + rooms + write panel, expenses)
//   Contacts  — Phase 3+ (placeholder)
//   Activity  — Phase 3+ (placeholder)
//
// Full-page editors (Programme, Brief) bypass this shell entirely — they're
// intercepted in AdminShell before TripDetail renders.
//
// Last updated: S53I — initial ship (Admin Redesign Phase 3).

import { useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin, buildAdminHash, type TripDetailTabId } from '../../utils/utilsAdminPath'
import EngagementDetailTab from './EngagementDetailTab'
import OutlookTab from './OutlookTab'

const TABS: { id: TripDetailTabId; label: string; ready: boolean }[] = [
  { id: 'overview',  label: 'Overview',  ready: true },
  { id: 'bookings',  label: 'Bookings',  ready: true },
  { id: 'contacts',  label: 'Contacts',  ready: false },
  { id: 'activity',  label: 'Activity',  ready: false },
]

export default function TripDetail({ urlId, activeTab }: { urlId: string; activeTab: TripDetailTabId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 24,
        borderBottom: `1px solid ${A.border}`,
      }}>
        {TABS.map(t => {
          const active = t.id === activeTab
          return (
            <a
              key={t.id}
              href={buildAdminHash({ product: 'trips', tab: t.id, urlId })}
              style={{
                padding:       '12px 20px',
                fontSize:      11,
                fontWeight:    active ? 700 : 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily:    A.font,
                color:         !t.ready ? A.faint : active ? A.gold : A.muted,
                borderBottom:  `2px solid ${active ? A.gold : 'transparent'}`,
                textDecoration: 'none',
                cursor:        t.ready ? 'pointer' : 'default',
                pointerEvents: t.ready ? 'auto' : 'none',
                transition:    'all 150ms ease',
                whiteSpace:    'nowrap',
              }}
            >
              {t.label}
            </a>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'  && <EngagementDetailTab urlId={urlId} />}
      {activeTab === 'bookings'  && <OutlookTab urlId={urlId} />}
      {activeTab === 'contacts'  && <Placeholder label='Contacts' />}
      {activeTab === 'activity'  && <Placeholder label='Activity' />}
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