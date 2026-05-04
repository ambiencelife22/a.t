/* AdminSidebar.tsx
 * Sidebar navigation for AmbienceAdmin. Groups by product (Immerse, Guides,
 * Library, Programme). Future products (LIFE, MONEY) shown disabled.
 *
 * Last updated: S36 — Library/dining link now passes destinationId: null
 *   (unscoped landing — drill-in scoping happens from Guides tab).
 * Prior: S36 — Added Guides + Library groups (Dining tab in each).
 * Prior: S33
 */

import {
  buildAdminHash,
  type AdminTab,
  type ProgrammeTabId,
} from '../../lib/adminPath'
import { A } from '../../lib/adminTokens'

type SidebarLink =
  | { kind: 'immerse-engagements' }
  | { kind: 'immerse-showcases' }
  | { kind: 'guides-dining' }
  | { kind: 'library-dining' }
  | { kind: 'programme'; tab: ProgrammeTabId }

type SidebarItem = {
  key:      string
  label:    string
  link:     SidebarLink
  disabled?: boolean
}

const IMMERSE_ITEMS: SidebarItem[] = [
  { key: 'immerse-engagements', label: 'Engagements', link: { kind: 'immerse-engagements' } },
  { key: 'immerse-showcases',   label: 'Showcases',   link: { kind: 'immerse-showcases' } },
]

const GUIDES_ITEMS: SidebarItem[] = [
  { key: 'guides-dining', label: 'Dining', link: { kind: 'guides-dining' } },
]

const LIBRARY_ITEMS: SidebarItem[] = [
  { key: 'library-dining', label: 'Dining', link: { kind: 'library-dining' } },
]

const PROGRAMME_ITEMS: SidebarItem[] = [
  { key: 'p-programmes',    label: 'Programmes',         link: { kind: 'programme', tab: 'programmes' } },
  { key: 'p-letters',       label: 'Welcome Letters',    link: { kind: 'programme', tab: 'letters' } },
  { key: 'p-listings',      label: 'Listings',           link: { kind: 'programme', tab: 'listings' } },
  { key: 'p-sections',      label: 'Property Sections',  link: { kind: 'programme', tab: 'sections' } },
  { key: 'p-properties',    label: 'Properties',         link: { kind: 'programme', tab: 'properties' } },
  { key: 'p-access-denied', label: 'Access Denied',      link: { kind: 'programme', tab: 'access-denied' } },
  { key: 'p-client',        label: 'Client Profile',     link: { kind: 'programme', tab: 'client-profile' } },
]

const SOON_ITEMS: SidebarItem[] = [
  { key: 'life',  label: 'LIFE',  link: { kind: 'immerse-engagements' }, disabled: true },
  { key: 'money', label: 'MONEY', link: { kind: 'immerse-engagements' }, disabled: true },
]

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
  if (item.link.kind === 'library-dining') {
    return current.product === 'library' && current.tab === 'dining'
  }
  return current.product === 'programme' && current.tab === item.link.tab
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
  if (item.link.kind === 'library-dining') {
    return buildAdminHash({ product: 'library', tab: 'dining', destinationId: null })
  }
  return buildAdminHash({ product: 'programme', tab: item.link.tab })
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color:         A.faint,
      fontFamily:    A.font,
      padding:       '16px 20px 8px',
    }}>
      {label}
    </div>
  )
}

function SidebarRow({ item, active }: { item: SidebarItem; active: boolean }) {
  const baseStyle: React.CSSProperties = {
    display:      'block',
    padding:      '8px 20px',
    fontSize:     12,
    fontWeight:   active ? 700 : 500,
    color:        item.disabled ? A.faint : (active ? A.gold : A.muted),
    fontFamily:   A.font,
    background:   active ? 'rgba(201,184,142,0.06)' : 'transparent',
    borderLeft:   active ? `2px solid ${A.gold}` : '2px solid transparent',
    textDecoration: 'none',
    cursor:       item.disabled ? 'default' : 'pointer',
    pointerEvents: item.disabled ? 'none' : 'auto',
  }

  if (item.disabled) {
    return (
      <div style={baseStyle}>
        {item.label} <span style={{ fontSize: 9, color: A.faint, marginLeft: 4 }}>soon</span>
      </div>
    )
  }

  return (
    <a href={hashFor(item)} style={baseStyle}>
      {item.label}
    </a>
  )
}

function DesktopSidebar({ tab }: { tab: AdminTab }) {
  return (
    <div style={{
      width:        220,
      flexShrink:   0,
      background:   A.bgCard,
      borderRight:  `1px solid ${A.border}`,
      paddingTop:   8,
      overflowY:    'auto',
    }}>
      <GroupHeader label='Immerse' />
      {IMMERSE_ITEMS.map(item => (
        <SidebarRow key={item.key} item={item} active={isActive(item, tab)} />
      ))}

      <GroupHeader label='Guides' />
      {GUIDES_ITEMS.map(item => (
        <SidebarRow key={item.key} item={item} active={isActive(item, tab)} />
      ))}

      <GroupHeader label='Library' />
      {LIBRARY_ITEMS.map(item => (
        <SidebarRow key={item.key} item={item} active={isActive(item, tab)} />
      ))}

      <GroupHeader label='Programme' />
      {PROGRAMME_ITEMS.map(item => (
        <SidebarRow key={item.key} item={item} active={isActive(item, tab)} />
      ))}

      <div style={{ borderTop: `1px solid ${A.border}`, marginTop: 12, paddingTop: 4 }} />
      <GroupHeader label='Future' />
      {SOON_ITEMS.map(item => (
        <SidebarRow key={item.key} item={item} active={false} />
      ))}
    </div>
  )
}

function MobileSelector({ tab }: { tab: AdminTab }) {
  const all: SidebarItem[] = [
    ...IMMERSE_ITEMS,
    ...GUIDES_ITEMS,
    ...LIBRARY_ITEMS,
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
        <optgroup label='Programme'>
          {PROGRAMME_ITEMS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
        </optgroup>
      </select>
    </div>
  )
}

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