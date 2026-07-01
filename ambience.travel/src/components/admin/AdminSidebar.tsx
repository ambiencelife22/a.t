// AdminSidebar.tsx — Admin navigation for the 5-group taxonomy.
//
// Groups (confirmed S53G Admin Redesign v2, locked):
//   Trips      — pipeline list + per-trip detail (overview/bookings/contacts/activity)
//   Clients    — households + profiles + trip history
//   Content    — Dining / Hotels / Experiences / Shopping (library+guides unified)
//   Residences — list / letters / listings / sections / properties / access-denied / client-profile
//   Studio     — dashboard / Finance pipeline / Effort Log / Time Analytics
//
// Replaces the legacy sidebar (immerse/guides/library/house/operations/time/
// calendar/finance/programme groups). Legacy routes still parse + dispatch
// correctly in utilsAdminPath + AmbienceAdmin; the sidebar just no longer
// exposes them. They dissolve in Phase 7.
//
// Last updated: S53I — Phase 2 sidebar (5-group taxonomy).

import { useState } from 'react'
import { buildAdminHash, navigateAdmin, type AdminTab } from '../../utils/utilsAdminPath'
import { A } from '../../tokens/tokensAdmin'

// ── Icons (inline SVG — no external dep) ─────────────────────────────────────

function IconTrips({ active }: { active: boolean }) {
  return (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke={active ? A.gold : A.muted} strokeWidth={active ? 2 : 1.5} strokeLinecap='round' strokeLinejoin='round'>
      <path d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
    </svg>
  )
}
function IconClients({ active }: { active: boolean }) {
  return (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke={active ? A.gold : A.muted} strokeWidth={active ? 2 : 1.5} strokeLinecap='round' strokeLinejoin='round'>
      <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' /><circle cx='9' cy='7' r='4' /><path d='M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' />
    </svg>
  )
}
function IconContent({ active }: { active: boolean }) {
  return (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke={active ? A.gold : A.muted} strokeWidth={active ? 2 : 1.5} strokeLinecap='round' strokeLinejoin='round'>
      <path d='M4 19.5A2.5 2.5 0 016.5 17H20' /><path d='M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' />
    </svg>
  )
}
function IconResidences({ active }: { active: boolean }) {
  return (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke={active ? A.gold : A.muted} strokeWidth={active ? 2 : 1.5} strokeLinecap='round' strokeLinejoin='round'>
      <rect x='2' y='3' width='20' height='14' rx='2' ry='2' /><path d='M8 21h8M12 17v4' />
    </svg>
  )
}
function IconStudio({ active }: { active: boolean }) {
  return (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke={active ? A.gold : A.muted} strokeWidth={active ? 2 : 1.5} strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='3' width='7' height='7' /><rect x='14' y='3' width='7' height='7' /><rect x='14' y='14' width='7' height='7' /><rect x='3' y='14' width='7' height='7' />
    </svg>
  )
}

// ── Group definitions ─────────────────────────────────────────────────────────

type NavItem = {
  key:    string
  label:  string
  hash:   string
  active: (tab: AdminTab) => boolean
}

type NavGroup = {
  key:    string
  label:  string
  Icon:   (props: { active: boolean }) => React.ReactElement
  items:  NavItem[]
  active: (tab: AdminTab) => boolean
}

const GROUPS: NavGroup[] = [
  {
    key: 'trips', label: 'Trips',
    Icon: IconTrips,
    active: tab => tab.product === 'trips',
    items: [
      {
        key: 'trips-list', label: 'All Trips',
        hash: buildAdminHash({ product: 'trips', tab: 'list' }),
        active: tab => tab.product === 'trips' && tab.tab === 'list',
      },
    ],
  },
  {
    key: 'clients', label: 'Clients',
    Icon: IconClients,
    active: tab => tab.product === 'clients',
    items: [
      {
        key: 'clients-list', label: 'Households',
        hash: buildAdminHash({ product: 'clients', tab: 'list' }),
        active: tab => tab.product === 'clients',
      },
    ],
  },
  {
    key: 'content', label: 'Content',
    Icon: IconContent,
    active: tab => tab.product === 'content',
    items: [
      {
        key: 'content-dining', label: 'Dining',
        hash: buildAdminHash({ product: 'content', tab: 'dining' }),
        active: tab => tab.product === 'content' && tab.tab === 'dining',
      },
      {
        key: 'content-hotels', label: 'Hotels',
        hash: buildAdminHash({ product: 'content', tab: 'hotels' }),
        active: tab => tab.product === 'content' && tab.tab === 'hotels',
      },
      {
        key: 'content-experiences', label: 'Experiences',
        hash: buildAdminHash({ product: 'content', tab: 'experiences' }),
        active: tab => tab.product === 'content' && tab.tab === 'experiences',
      },
      {
        key: 'content-shopping', label: 'Shopping',
        hash: buildAdminHash({ product: 'content', tab: 'shopping' }),
        active: tab => tab.product === 'content' && tab.tab === 'shopping',
      },
    ],
  },
  {
    key: 'residences', label: 'Residences',
    Icon: IconResidences,
    active: tab => tab.product === 'residences',
    items: [
      {
        key: 'res-list',     label: 'Residences',
        hash: buildAdminHash({ product: 'residences', tab: 'list' }),
        active: tab => tab.product === 'residences' && tab.tab === 'list',
      },
      {
        key: 'res-letters',  label: 'Welcome Letters',
        hash: buildAdminHash({ product: 'residences', tab: 'letters' }),
        active: tab => tab.product === 'residences' && tab.tab === 'letters',
      },
      {
        key: 'res-listings', label: 'Listings',
        hash: buildAdminHash({ product: 'residences', tab: 'listings' }),
        active: tab => tab.product === 'residences' && tab.tab === 'listings',
      },
      {
        key: 'res-sections', label: 'Property Sections',
        hash: buildAdminHash({ product: 'residences', tab: 'sections' }),
        active: tab => tab.product === 'residences' && tab.tab === 'sections',
      },
      {
        key: 'res-props',    label: 'Properties',
        hash: buildAdminHash({ product: 'residences', tab: 'properties' }),
        active: tab => tab.product === 'residences' && tab.tab === 'properties',
      },
      {
        key: 'res-denied',   label: 'Access Denied',
        hash: buildAdminHash({ product: 'residences', tab: 'access-denied' }),
        active: tab => tab.product === 'residences' && tab.tab === 'access-denied',
      },
      {
        key: 'res-profile',  label: 'Client Profile',
        hash: buildAdminHash({ product: 'residences', tab: 'client-profile' }),
        active: tab => tab.product === 'residences' && tab.tab === 'client-profile',
      },
    ],
  },
  {
    key: 'studio', label: 'Studio',
    Icon: IconStudio,
    active: tab => tab.product === 'studio',
    items: [
      {
        key: 'studio-dash',  label: 'Dashboard',
        hash: buildAdminHash({ product: 'studio', tab: 'dashboard' }),
        active: tab => tab.product === 'studio' && tab.tab === 'dashboard',
      },
      {
        key: 'studio-fin',   label: 'Finance',
        hash: buildAdminHash({ product: 'studio', tab: 'finance' }),
        active: tab => tab.product === 'studio' && (tab.tab === 'finance' || tab.tab === 'finance-engagement'),
      },
      {
        key: 'studio-time',  label: 'Effort Log',
        hash: buildAdminHash({ product: 'studio', tab: 'time' }),
        active: tab => tab.product === 'studio' && tab.tab === 'time',
      },
      {
        key: 'studio-analytics', label: 'Time Analytics',
        hash: buildAdminHash({ product: 'studio', tab: 'time-analytics' }),
        active: tab => tab.product === 'studio' && tab.tab === 'time-analytics',
      },
    ],
  },
]

// ── Row components ────────────────────────────────────────────────────────────

function GroupHeader({ group, tab, expanded, onToggle }: {
  group: NavGroup; tab: AdminTab; expanded: boolean; onToggle: () => void
}) {
  const [hov, setHov] = useState(false)
  const active = group.active(tab)
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 16px',
        background: hov ? 'rgba(216,181,106,0.04)' : 'transparent',
        border: 'none',
        borderLeft: active ? `2px solid ${A.gold}` : '2px solid transparent',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 120ms ease',
      }}
    >
      <group.Icon active={active} />
      <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, letterSpacing: '0.04em', color: active ? A.gold : A.muted, fontFamily: A.font, flex: 1, transition: 'color 120ms ease' }}>
        {group.label}
      </span>
      <svg width='10' height='10' viewBox='0 0 10 10' style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', opacity: 0.4 }}>
        <path d='M2 3.5 L5 6.5 L8 3.5' stroke={A.muted} strokeWidth={1.5} fill='none' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </button>
  )
}

function NavRow({ item, tab }: { item: NavItem; tab: AdminTab }) {
  const [hov, setHov] = useState(false)
  const active = item.active(tab)
  return (
    <a
      href={item.hash}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', padding: '7px 16px 7px 41px',
        fontSize: 12, fontWeight: active ? 600 : 400,
        color: active ? A.gold : A.muted,
        fontFamily: A.font,
        background: active ? 'rgba(216,181,106,0.08)' : hov ? 'rgba(216,181,106,0.04)' : 'transparent',
        borderLeft: active ? `2px solid ${A.gold}` : '2px solid transparent',
        textDecoration: 'none', letterSpacing: '0.01em',
        transition: 'background 120ms ease',
      }}
    >
      {item.label}
    </a>
  )
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function DesktopSidebar({ tab }: { tab: AdminTab }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map(g => [g.key, true]))
  )

  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: A.bgCard, borderRight: `1px solid ${A.border}`,
      paddingTop: 12, overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1 }}>
        {GROUPS.map(group => (
          <div key={group.key}>
            <GroupHeader
              group={group} tab={tab}
              expanded={expanded[group.key]}
              onToggle={() => setExpanded(p => ({ ...p, [group.key]: !p[group.key] }))}
            />
            {expanded[group.key] && group.items.map(item => (
              <NavRow key={item.key} item={item} tab={tab} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 16px 20px', borderTop: `1px solid ${A.border}`, marginTop: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>ambience</div>
        <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.muted, fontFamily: A.font, opacity: 0.6 }}>admin</div>
      </div>
    </div>
  )
}

// ── Mobile selector ───────────────────────────────────────────────────────────

function MobileSelector({ tab }: { tab: AdminTab }) {
  const all = GROUPS.flatMap(g => g.items)
  const current = all.find(i => i.active(tab))?.key ?? all[0].key

  return (
    <div style={{ marginBottom: 20 }}>
      <select
        value={current}
        onChange={e => {
          const item = all.find(i => i.key === e.target.value)
          if (item) window.location.hash = item.hash
        }}
        style={{
          width: '100%', background: A.bgInput,
          border: `1px solid ${A.borderGold}`, borderRadius: 10,
          color: A.gold, padding: '10px 14px',
          fontSize: 13, fontWeight: 700, fontFamily: A.font,
          outline: 'none', colorScheme: 'dark',
        }}
      >
        {GROUPS.map(g => (
          <optgroup key={g.key} label={g.label}>
            {g.items.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function AdminSidebar({ tab, mobile = false }: { tab: AdminTab; mobile?: boolean }) {
  if (mobile) return <MobileSelector tab={tab} />
  return <DesktopSidebar tab={tab} />
}