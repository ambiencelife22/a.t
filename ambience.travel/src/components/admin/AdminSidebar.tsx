/* AdminSidebar.tsx
 * Sidebar navigation for AmbienceAdmin. Groups by product (Immerse, Guides,
 * Library, House, Operations, Programme). Future products (LIFE, MONEY) shown disabled.
 *
 * Last updated: S44 — Added Operations group (Bookings tab).
 * Prior: S43 — Phase 1 redesign: custom SVG icons, no group headers,
 *   hover states, bottom wordmark, motion system aligned.
 * Prior: S40D — Added HOUSE group (ambience.HOUSE CRM).
 * Prior: S36 — Library/dining link now passes destinationId: null.
 * Prior: S36 — Added Guides + Library groups (Dining tab in each).
 * Prior: S33
 */

import { useState } from 'react'
import {
  Plane,
  BookOpen,
  Library,
  Home,
  LayoutGrid,
} from './_adminIcons'
import {
  buildAdminHash,
  type AdminTab,
  type ProgrammeTabId,
} from '../../lib/utilsAdminPath'
import { A } from '../../lib/tokensAdmin'

// ─── Types ───────────────────────────────────────────────────────────────────

type SidebarLink =
  | { kind: 'immerse-engagements' }
  | { kind: 'immerse-showcases' }
  | { kind: 'guides-dining' }
  | { kind: 'guides-experiences' }
  | { kind: 'library-dining' }
  | { kind: 'library-hotels' }
  | { kind: 'house-households' }
  | { kind: 'operations-bookings' }
  | { kind: 'programme'; tab: ProgrammeTabId }

type SidebarItem = {
  key:       string
  label:     string
  link:      SidebarLink
  disabled?: boolean
}

type IconComponent = (props: { size?: number; color?: string; strokeWidth?: number }) => React.ReactElement

type SidebarGroup = {
  key:   string
  icon:  IconComponent
  items: SidebarItem[]
}

// ─── Item definitions ─────────────────────────────────────────────────────────

const IMMERSE_ITEMS: SidebarItem[] = [
  { key: 'immerse-engagements', label: 'Engagements', link: { kind: 'immerse-engagements' } },
  { key: 'immerse-showcases',   label: 'Showcases',   link: { kind: 'immerse-showcases' } },
]

const GUIDES_ITEMS: SidebarItem[] = [
  { key: 'guides-dining',      label: 'Dining',       link: { kind: 'guides-dining' } },
  { key: 'guides-experiences', label: 'Experiences',  link: { kind: 'guides-experiences' } },
]

const LIBRARY_ITEMS: SidebarItem[] = [
  { key: 'library-dining',  label: 'Dining',  link: { kind: 'library-dining' } },
  { key: 'library-hotels',  label: 'Hotels',  link: { kind: 'library-hotels' } },
]

const HOUSE_ITEMS: SidebarItem[] = [
  { key: 'house-households', label: 'Households', link: { kind: 'house-households' } },
]

const OPERATIONS_ITEMS: SidebarItem[] = [
  { key: 'operations-bookings', label: 'Bookings', link: { kind: 'operations-bookings' } },
]

const PROGRAMME_ITEMS: SidebarItem[] = [
  { key: 'p-programmes',    label: 'Programmes',        link: { kind: 'programme', tab: 'programmes' } },
  { key: 'p-letters',       label: 'Welcome Letters',   link: { kind: 'programme', tab: 'letters' } },
  { key: 'p-listings',      label: 'Listings',          link: { kind: 'programme', tab: 'listings' } },
  { key: 'p-sections',      label: 'Property Sections', link: { kind: 'programme', tab: 'sections' } },
  { key: 'p-properties',    label: 'Properties',        link: { kind: 'programme', tab: 'properties' } },
  { key: 'p-access-denied', label: 'Access Denied',     link: { kind: 'programme', tab: 'access-denied' } },
  { key: 'p-client',        label: 'Client Profile',    link: { kind: 'programme', tab: 'client-profile' } },
]

const SOON_ITEMS: SidebarItem[] = [
  { key: 'life',  label: 'LIFE',  link: { kind: 'immerse-engagements' }, disabled: true },
  { key: 'money', label: 'MONEY', link: { kind: 'immerse-engagements' }, disabled: true },
]

const GROUPS: SidebarGroup[] = [
  { key: 'immerse',    icon: Plane,      items: IMMERSE_ITEMS    },
  { key: 'guides',     icon: BookOpen,   items: GUIDES_ITEMS     },
  { key: 'library',    icon: Library,    items: LIBRARY_ITEMS    },
  { key: 'house',      icon: Home,       items: HOUSE_ITEMS      },
  { key: 'operations', icon: LayoutGrid, items: OPERATIONS_ITEMS },
  { key: 'programme',  icon: LayoutGrid, items: PROGRAMME_ITEMS  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(item: SidebarItem, current: AdminTab): boolean {
  if (item.link.kind === 'immerse-engagements') {
    return current.product === 'immerse' && current.tab === 'engagements'
  }
  if (item.link.kind === 'immerse-showcases') {
    return current.product === 'immerse' && current.tab === 'showcases'
  }
  if (item.link.kind === 'guides-dining') {
    return current.product === 'guides' && current.tab === 'dining'
  }
  if (item.link.kind === 'guides-experiences') {
    return current.product === 'guides' && current.tab === 'experiences'
  }
  if (item.link.kind === 'library-dining') {
    return current.product === 'library' && current.tab === 'dining'
  }
  if (item.link.kind === 'library-hotels') {
    return current.product === 'library' && current.tab === 'hotels'
  }
  if (item.link.kind === 'house-households') {
    return current.product === 'house'
  }
  if (item.link.kind === 'operations-bookings') {
    return current.product === 'operations'
  }
  return current.product === 'programme' && current.tab === (item.link as { tab: ProgrammeTabId }).tab
}

function isGroupActive(group: SidebarGroup, current: AdminTab): boolean {
  return group.items.some(item => isActive(item, current))
}

function hashFor(item: SidebarItem): string {
  if (item.link.kind === 'immerse-engagements') {
    return buildAdminHash({ product: 'immerse', tab: 'engagements', urlId: null })
  }
  if (item.link.kind === 'immerse-showcases') {
    return buildAdminHash({ product: 'immerse', tab: 'showcases' })
  }
  if (item.link.kind === 'guides-dining') {
    return buildAdminHash({ product: 'guides', tab: 'dining' })
  }
  if (item.link.kind === 'guides-experiences') {
    return buildAdminHash({ product: 'guides', tab: 'experiences' })
  }
  if (item.link.kind === 'library-dining') {
    return buildAdminHash({ product: 'library', tab: 'dining', destinationId: null })
  }
  if (item.link.kind === 'library-hotels') {
    return buildAdminHash({ product: 'library', tab: 'hotels', destinationId: null })
  }
  if (item.link.kind === 'house-households') {
    return buildAdminHash({ product: 'house', tab: 'households' })
  }
  if (item.link.kind === 'operations-bookings') {
    return buildAdminHash({ product: 'operations', tab: 'bookings' })
  }
  return buildAdminHash({ product: 'programme', tab: (item.link as { tab: ProgrammeTabId }).tab })
}

// ─── Group header row ─────────────────────────────────────────────────────────

function GroupRow({
  group,
  current,
  expanded,
  onToggle,
}: {
  group:    SidebarGroup
  current:  AdminTab
  expanded: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const active = isGroupActive(group, current)
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
      <span style={{ flexShrink: 0, transition: 'color 120ms ease', display: 'flex' }}>
        <Icon
          size={15}
          color={active ? A.gold : A.muted}
          strokeWidth={active ? 2 : 1.5}
        />
      </span>
      <span style={{
        fontSize:      11,
        fontWeight:    active ? 600 : 400,
        letterSpacing: '0.04em',
        color:         active ? A.gold : A.muted,
        fontFamily:    A.font,
        transition:    'color 120ms ease, font-weight 120ms ease',
        flex:          1,
      }}>
        {group.key.charAt(0).toUpperCase() + group.key.slice(1)}
      </span>
      <svg
        width={10}
        height={10}
        viewBox='0 0 10 10'
        style={{
          flexShrink: 0,
          transform:  expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
          opacity:    0.4,
        }}
      >
        <path d='M2 3.5 L5 6.5 L8 3.5' stroke={A.muted} strokeWidth={1.5} fill='none' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </button>
  )
}

// ─── Individual nav item row ──────────────────────────────────────────────────

function SidebarRow({ item, active }: { item: SidebarItem; active: boolean }) {
  const [hovered, setHovered] = useState(false)

  const baseStyle: React.CSSProperties = {
    display:        'block',
    padding:        '7px 16px 7px 41px',
    fontSize:       12,
    fontWeight:     active ? 600 : 400,
    color:          item.disabled ? A.faint : (active ? A.gold : A.muted),
    fontFamily:     A.font,
    background:     active
      ? 'rgba(216,181,106,0.08)'
      : hovered
        ? 'rgba(216,181,106,0.04)'
        : 'transparent',
    borderLeft:     active ? `2px solid ${A.gold}` : '2px solid transparent',
    textDecoration: 'none',
    cursor:         item.disabled ? 'default' : 'pointer',
    pointerEvents:  item.disabled ? 'none' : 'auto',
    transition:     'background 120ms ease',
    letterSpacing:  '0.01em',
  }

  if (item.disabled) {
    return (
      <div style={baseStyle}>
        {item.label}
        <span style={{ fontSize: 9, color: A.faint, marginLeft: 6, letterSpacing: '0.08em' }}>
          soon
        </span>
      </div>
    )
  }

  return (
    <a
      href={hashFor(item)}
      style={baseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item.label}
    </a>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({ tab }: { tab: AdminTab }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map(g => [g.key, true]))
  )

  function toggle(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={{
      width:         220,
      flexShrink:    0,
      background:    A.bgCard,
      borderRight:   `1px solid ${A.border}`,
      paddingTop:    12,
      overflowY:     'auto',
      display:       'flex',
      flexDirection: 'column',
    }}>
      <div style={{ flex: 1 }}>
        {GROUPS.map(group => (
          <div key={group.key}>
            <GroupRow
              group={group}
              current={tab}
              expanded={expanded[group.key]}
              onToggle={() => toggle(group.key)}
            />
            {expanded[group.key] && group.items.map(item => (
              <SidebarRow key={item.key} item={item} active={isActive(item, tab)} />
            ))}
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${A.border}`, marginTop: 8, paddingTop: 4 }}>
          {SOON_ITEMS.map(item => (
            <SidebarRow key={item.key} item={item} active={false} />
          ))}
        </div>
      </div>

      <div style={{
        padding:   '16px 16px 20px',
        borderTop: `1px solid ${A.border}`,
        marginTop: 8,
      }}>
        <div style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color:         A.muted,
          fontFamily:    A.font,
          lineHeight:    1.6,
        }}>
          ambience
        </div>
        <div style={{
          fontSize:      9,
          fontWeight:    400,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color:         A.muted,
          fontFamily:    A.font,
          opacity:       0.6,
        }}>
          admin
        </div>
      </div>
    </div>
  )
}

// ─── Mobile selector ──────────────────────────────────────────────────────────

function MobileSelector({ tab }: { tab: AdminTab }) {
  const all: SidebarItem[] = [
    ...IMMERSE_ITEMS,
    ...GUIDES_ITEMS,
    ...LIBRARY_ITEMS,
    ...HOUSE_ITEMS,
    ...OPERATIONS_ITEMS,
    ...PROGRAMME_ITEMS,
  ]

  function currentValue(): string {
    const found = all.find(i => isActive(i, tab))
    return found?.key ?? all[0].key
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const item = all.find(i => i.key === e.target.value)
    if (!item) return
    window.location.hash = hashFor(item)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <select
        value={currentValue()}
        onChange={handleChange}
        style={{
          width:        '100%',
          background:   A.bgInput,
          border:       `1px solid ${A.borderGold}`,
          borderRadius: 10,
          color:        A.gold,
          padding:      '10px 14px',
          fontSize:     13,
          fontWeight:   700,
          fontFamily:   A.font,
          outline:      'none',
          colorScheme:  'dark',
        }}
      >
        <optgroup label='Immerse'>
          {IMMERSE_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
        <optgroup label='Guides'>
          {GUIDES_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
        <optgroup label='Library'>
          {LIBRARY_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
        <optgroup label='House'>
          {HOUSE_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
        <optgroup label='Operations'>
          {OPERATIONS_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
        <optgroup label='Programme'>
          {PROGRAMME_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
      </select>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function AdminSidebar({
  tab,
  mobile = false,
}: {
  tab:     AdminTab
  mobile?: boolean
}) {
  if (mobile) return <MobileSelector tab={tab} />
  return <DesktopSidebar tab={tab} />
}