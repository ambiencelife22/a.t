// ImmerseLayout.tsx — layout wrapper for ambience.travel /immerse/ proposal pages
// Owns nav, back-to-top, overflow lock, and the hamburger drawer menu.
// Pure renderer — receives navItems via props. No data fetching, no URL inspection.
// Last updated: S26 — Added hamburger + slide-in drawer per S24 mini-handover.
//   Accepts navItems + logoHref props. Drawer mirrors ProgrammeLayout structure
//   (right-side slide-in, dark overlay, 240px width, 250ms ease). Active item
//   gets gold-tinted bg + gold text + gold border. 'Preview' subpage status
//   renders as a non-clickable, dimmed row with a 'Coming soon' marker —
//   visible in the menu so guests see the full journey shape, but not
//   interactive. Controllers (ImmerseTripPage, DestinationPage) compute
//   navItems + isActive from trip data they hold.
// Prior: S10 — minimal layout with fixed top nav, logo left, no menu.

import { useEffect, useState, type ReactNode } from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { C, DARK, OVERLAY } from '../../lib/landingTypes'
import { ID } from '../landing/immerse/ImmerseComponents'

export type ImmerseNavItem = {
  label:      string
  href:       string
  isActive:   boolean
  isPreview?: boolean
}

type Props = {
  children:  ReactNode
  navItems?: ImmerseNavItem[]
  logoHref?: string
}

export default function ImmerseLayout({ children, navItems, logoHref }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const prev = document.documentElement.style.overflowX
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    return () => {
      document.documentElement.style.overflowX = prev
      document.body.style.overflowX = ''
    }
  }, [])

  // Close drawer on Escape for keyboard users
  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const resolvedLogoHref = logoHref ?? 'https://ambience.travel'
  const hasNavItems = !!navItems && navItems.length > 0

  return (
    <div
      style={{
        minHeight:  '100vh',
        background: ID.bg,
        color:      ID.text,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflowX:  'hidden',
      }}
    >
      <nav
        style={{
          position:       'fixed',
          top:            0,
          left:           0,
          right:          0,
          zIndex:         50,
          height:         60,
          background:     C.navBg,
          backdropFilter: 'blur(16px)',
          borderBottom:   `1px solid ${C.border}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0 clamp(20px,5vw,48px)',
        }}
      >
        <a
          href={resolvedLogoHref}
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <img
            src='/emblem.png'
            alt='ambience.travel'
            style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
          />
          <AmbienceLogo isDark={false} product='travel' height={44} />
        </a>

        {hasNavItems && (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label='Open menu'
            style={{
              background:   'transparent',
              border:       `1px solid ${C.muted}`,
              borderRadius: 8,
              padding:      '6px 10px',
              cursor:       'pointer',
              color:        C.text,
              fontSize:     16,
              lineHeight:   1,
              transition:   'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.gold
              ;(e.currentTarget as HTMLButtonElement).style.color       = C.gold
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.muted
              ;(e.currentTarget as HTMLButtonElement).style.color       = C.text
            }}
          >
            ☰
          </button>
        )}
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.5)',
            zIndex:     60,
          }}
        />
      )}

      {/* Slide-in drawer */}
      <div
        style={{
          position:      'fixed',
          top:           0,
          right:         0,
          bottom:        0,
          width:         260,
          zIndex:        70,
          background:    '#1A1C1A',
          borderLeft:    '1px solid #333533',
          transform:     drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.25s ease',
          display:       'flex',
          flexDirection: 'column',
          pointerEvents: drawerOpen ? 'all' : 'none',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            height:         60,
            padding:        '0 20px',
            borderBottom:   '1px solid #333533',
            flexShrink:     0,
          }}
        >
          <div
            style={{
              fontSize:       11,
              fontWeight:     700,
              letterSpacing:  '0.10em',
              textTransform:  'uppercase',
              color:          DARK.label,
            }}
          >
            Menu
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label='Close menu'
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      DARK.label,
              fontSize:   18,
              lineHeight: 1,
              padding:    4,
            }}
          >
            ×
          </button>
        </div>

        {/* Nav list */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {hasNavItems && navItems!.map(item => (
            <ImmerseNavLink key={item.href + item.label} item={item} onNavigate={() => setDrawerOpen(false)} />
          ))}
        </nav>
      </div>

      <div style={{ paddingTop: 60 }}>
        {children}
      </div>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title='Back to top'
        style={{
          position:       'fixed',
          right:          28,
          bottom:         'calc(28px + env(safe-area-inset-bottom))',
          zIndex:         40,
          width:          44,
          height:         44,
          borderRadius:   '50%',
          background:     C.bgDark,
          border:         `1px solid ${OVERLAY.cardLabel}`,
          color:          C.gold,
          fontSize:       16,
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          boxShadow:      '0 4px 20px rgba(0,0,0,0.18)',
          opacity:        0.94,
        }}
      >
        ↑
      </button>
    </div>
  )
}

// ── Nav link (internal) ──────────────────────────────────────────────────────
// Split out so active/inactive hover behaviour reads cleanly. Pure render —
// only its own hover state; navigation + close handled by the <a> + onNavigate.

type NavLinkProps = {
  item:        ImmerseNavItem
  onNavigate:  () => void
}

function ImmerseNavLink({ item, onNavigate }: NavLinkProps) {
  const activeBg          = 'rgba(201,184,142,0.10)'
  const activeBorder      = 'rgba(201,184,142,0.40)'
  const hoverInactiveBg   = 'rgba(255,255,255,0.04)'

  // S26: Preview items are non-interactive — no href, no hover, dimmed.
  // Matches the ImmerseSubpageStatus='preview' semantic (non-clickable,
  // opacity reduced, "coming soon"). Keeps them visible in the menu so guests
  // see the full journey shape, but signals they're not yet available.
  if (item.isPreview) {
    return (
      <div
        aria-disabled='true'
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:             10,
          padding:         '10px 12px',
          borderRadius:    10,
          border:          '1px solid transparent',
          background:      'transparent',
          color:           DARK.label,
          fontSize:        13,
          fontWeight:      500,
          fontFamily:      "'Plus Jakarta Sans', sans-serif",
          opacity:         0.5,
          cursor:          'not-allowed',
          userSelect:      'none',
        }}
      >
        <span>{item.label}</span>
        <span
          style={{
            fontSize:       10,
            fontWeight:     600,
            letterSpacing:  '0.06em',
            textTransform:  'uppercase',
            color:          C.faint,
            flexShrink:     0,
          }}
        >
          Coming soon
        </span>
      </div>
    )
  }

  const baseBg        = item.isActive ? activeBg : 'transparent'
  const baseColor     = item.isActive ? C.gold : DARK.body
  const baseWeight    = item.isActive ? 600 : 500

  return (
    <a
      href={item.href}
      onClick={onNavigate}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             10,
        padding:         '10px 12px',
        borderRadius:    10,
        border:          item.isActive ? `1px solid ${activeBorder}` : '1px solid transparent',
        background:      baseBg,
        color:           baseColor,
        textDecoration:  'none',
        fontSize:        13,
        fontWeight:      baseWeight,
        fontFamily:      "'Plus Jakarta Sans', sans-serif",
        transition:      'all 0.15s',
      }}
      onMouseEnter={e => {
        if (item.isActive) return
        ;(e.currentTarget as HTMLAnchorElement).style.background = hoverInactiveBg
      }}
      onMouseLeave={e => {
        if (item.isActive) return
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
      }}
    >
      <span>{item.label}</span>
    </a>
  )
}