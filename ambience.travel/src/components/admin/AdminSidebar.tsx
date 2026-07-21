// AdminSidebar.tsx - Admin navigation, 5-group taxonomy.
// S53I Phase 2: rebuilt for confirmed 5-group architecture (Trips, Clients,
// Content, Residences, Studio). Legacy groups (immerse, guides, library, house,
// operations, time, finance, programme) dissolved - all routing aliased in
// utilsAdminPath.ts and still functional; sidebar now reflects the target state.
//
// Prior: S53G Phase 1 - legacy taxonomy (immerse, guides, library, house,
//   operations, time, finance, programme).

import { useState } from 'react'
import { Plane, BookOpen, Library, Home, LayoutGrid } from './_adminIcons'
import {
  buildAdminHash,
  navigateAdmin,
  type AdminTab,
  type ContentTabId,
  type ResidenceTabId,
  type StudioTabId,
} from '../../utils/utilsAdminPath'
import { A } from '../../tokens/tokensAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem = {
  key:    string
  label:  string
  hash:   string
  active: (tab: AdminTab) => boolean
}

type NavGroup = {
  key:   string
  label: string
  icon:  (props: { size?: number; color?: string; strokeWidth?: number }) => React.ReactElement
  items: NavItem[]
}

// ── Groups ────────────────────────────────────────────────────────────────────

const GROUPS: NavGroup[] = [
  {
    key: 'trips', label: 'Engagements', icon: Plane,
    items: [
      {
        key: 'trips-list', label: 'All Engagements',
        hash: buildAdminHash({ product: 'trips', tab: 'list' }),
        active: t => t.product === 'trips',
      },
    ],
  },
  {
    key: 'clients', label: 'Clients', icon: Home,
    items: [
      {
        key: 'clients-list', label: 'Clients',
        hash: buildAdminHash({ product: 'clients', tab: 'list' }),
        active: t => t.product === 'clients',
      },
    ],
  },
  {
    key: 'content', label: 'Content', icon: BookOpen,
    items: (
      ['dining', 'experiences', 'hotels', 'shopping'] as ContentTabId[]
    ).map(tab => ({
      key:    `content-${tab}`,
      label:  tab.charAt(0).toUpperCase() + tab.slice(1),
      hash:   buildAdminHash({ product: 'content', tab }),
      active: (t: AdminTab) => t.product === 'content' && t.tab === tab,
    })),
  },
  {
    key: 'residences', label: 'Residences', icon: Library,
    items: [
      { key: 'res-list',     label: 'Residences',        hash: buildAdminHash({ product: 'residences', tab: 'list' }),           active: (t: AdminTab) => t.product === 'residences' && t.tab === 'list' },
      { key: 'res-letters',  label: 'Welcome Letters',   hash: buildAdminHash({ product: 'residences', tab: 'letters' }),        active: (t: AdminTab) => t.product === 'residences' && t.tab === 'letters' },
      { key: 'res-listings', label: 'Listings',          hash: buildAdminHash({ product: 'residences', tab: 'listings' }),       active: (t: AdminTab) => t.product === 'residences' && t.tab === 'listings' },
      { key: 'res-sections', label: 'Property Sections', hash: buildAdminHash({ product: 'residences', tab: 'sections' }),       active: (t: AdminTab) => t.product === 'residences' && t.tab === 'sections' },
      { key: 'res-props',    label: 'Properties',        hash: buildAdminHash({ product: 'residences', tab: 'properties' }),     active: (t: AdminTab) => t.product === 'residences' && t.tab === 'properties' },
      { key: 'res-access',   label: 'Access Denied',     hash: buildAdminHash({ product: 'residences', tab: 'access-denied' }),  active: (t: AdminTab) => t.product === 'residences' && t.tab === 'access-denied' },
      { key: 'res-profile',  label: 'Client Profile',    hash: buildAdminHash({ product: 'residences', tab: 'client-profile' }), active: (t: AdminTab) => t.product === 'residences' && t.tab === 'client-profile' },
    ],
  },
  {
    key: 'studio', label: 'Studio', icon: LayoutGrid,
    items: [
      { key: 'studio-dash',     label: 'Dashboard',  hash: buildAdminHash({ product: 'studio', tab: 'dashboard' }),      active: (t: AdminTab) => t.product === 'studio' && t.tab === 'dashboard' },
      { key: 'studio-calendar', label: 'Calendar',   hash: buildAdminHash({ product: 'calendar', tab: 'calendar' }),     active: (t: AdminTab) => t.product === 'calendar' },
      { key: 'studio-tasks',    label: 'Tasks',      hash: buildAdminHash({ product: 'studio', tab: 'tasks' }),          active: (t: AdminTab) => t.product === 'studio' && t.tab === 'tasks' },
      { key: 'studio-finance',  label: 'Finance',    hash: buildAdminHash({ product: 'studio', tab: 'finance' }),        active: (t: AdminTab) => t.product === 'studio' && t.tab === 'finance' },
      { key: 'studio-time',     label: 'Effort Log', hash: buildAdminHash({ product: 'studio', tab: 'time' }),           active: (t: AdminTab) => t.product === 'studio' && t.tab === 'time' },
      { key: 'studio-analytics',label: 'Analytics',  hash: buildAdminHash({ product: 'studio', tab: 'time-analytics' }), active: (t: AdminTab) => t.product === 'studio' && t.tab === 'time-analytics' },
      { key: 'studio-settings', label: 'Settings',   hash: buildAdminHash({ product: 'studio', tab: 'settings' }),       active: (t: AdminTab) => t.product === 'studio' && t.tab === 'settings' },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isGroupActive(group: NavGroup, tab: AdminTab): boolean {
  return group.items.some(item => item.active(tab))
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, active }: { item: NavItem; active: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={item.hash}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'block',
        padding:        '7px 16px 7px 41px',
        fontSize:       12,
        fontWeight:     active ? 600 : 400,
        color:          active ? A.gold : A.muted,
        fontFamily:     A.font,
        background:     active ? 'rgba(216,181,106,0.08)' : hovered ? 'rgba(216,181,106,0.04)' : 'transparent',
        borderLeft:     active ? `2px solid ${A.gold}` : '2px solid transparent',
        textDecoration: 'none',
        transition:     'background 120ms ease',
        letterSpacing:  '0.01em',
      }}
    >
      {item.label}
    </a>
  )
}

// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({ group, tab, expanded, onToggle }: {
  group:    NavGroup
  tab:      AdminTab
  expanded: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const active = isGroupActive(group, tab)
  const Icon   = group.icon

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        width:      '100%',
        padding:    '9px 16px',
        background: hovered ? 'rgba(216,181,106,0.04)' : 'transparent',
        border:     'none',
        borderLeft: active ? `2px solid ${A.gold}` : '2px solid transparent',
        cursor:     'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
        textAlign:  'left',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>
        <Icon size={15} color={active ? A.gold : A.muted} strokeWidth={active ? 2 : 1.5} />
      </span>
      <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, letterSpacing: '0.04em', color: active ? A.gold : A.muted, fontFamily: A.font, flex: 1, transition: 'color 120ms ease' }}>
        {group.label}
      </span>
      <svg width={10} height={10} viewBox='0 0 10 10' style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', opacity: 0.4 }}>
        <path d='M2 3.5 L5 6.5 L8 3.5' stroke={A.muted} strokeWidth={1.5} fill='none' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </button>
  )
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function DesktopSidebar({ tab }: { tab: AdminTab }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map(g => [g.key, true]))
  )
  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  return (
    <div style={{ width: 220, flexShrink: 0, background: A.bgCard, borderRight: `1px solid ${A.border}`, paddingTop: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        {GROUPS.map(g => (
          <div key={g.key}>
            <GroupHeader group={g} tab={tab} expanded={expanded[g.key]} onToggle={() => toggle(g.key)} />
            {expanded[g.key] && g.items.map(item => (
              <ItemRow key={item.key} item={item} active={item.active(tab)} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 16px 20px', borderTop: `1px solid ${A.border}`, marginTop: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>ambience</div>
        <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.muted, fontFamily: A.font, opacity: 0.6 }}>admin</div>
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
        style={{ width: '100%', background: A.bgInput, border: `1px solid ${A.borderGold}`, borderRadius: 10, color: A.gold, padding: '10px 14px', fontSize: 13, fontWeight: 700, fontFamily: A.font, outline: 'none', colorScheme: 'dark' }}
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