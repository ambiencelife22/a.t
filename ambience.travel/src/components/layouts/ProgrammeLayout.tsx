/* ProgrammeLayout.tsx
 * Global layout shell for all programme.ambience.travel detail pages.
 * Provides: fixed nav (logo + guest name + hamburger), slide-in drawer, footer.
 *
 * Hamburger opens a minimal drawer with:
 *   Dashboard, My Programme, My Account, Sign Out
 * Navigation links push to the app root — no in-app routing needed here.
 *
 * Uses landingTypes (C / DARK) — this is the dark programme aesthetic,
 * not the travel theme palette.
 */

import { useState } from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { C, DARK } from '../../lib/landingTypes'
import { signOut } from '../../lib/auth'

interface ProgrammeLayoutProps {
  children:    React.ReactNode
  guestNames?: string
}

function appRoot(): string {
  const hostname = window.location.hostname
  if (hostname === 'programme.ambience.travel') return 'https://programme.ambience.travel/programme'
  return `${window.location.protocol}//${window.location.host}/programme`
}

const NAV_LINKS = [
  { label: 'Dashboard',      icon: '▦', hash: ''           },
  { label: 'My Programme',   icon: '◎', hash: '#programme' },
  { label: 'My Account',     icon: '⊙', hash: '#profile'   },
]

export default function ProgrammeLayout({ children, guestNames }: ProgrammeLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    window.location.reload()
  }

  const root = appRoot()

  return (
    <div style={{
      minHeight:  '100vh',
      background: C.bgDark,
      color:      DARK.text,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflowX:  'hidden',
    }}>

      {/* ── Fixed nav ── */}
      <nav style={{
        position:       'fixed',
        top:            0,
        left:           0,
        right:          0,
        zIndex:         50,
        height:         60,
        background:     'rgba(23,25,23,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom:   `1px solid #333533`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 clamp(16px,4vw,40px)',
      }}>

        {/* Logo */}
        <a
          href={root}
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <img
            src='/emblem.png'
            alt='ambience.travel'
            style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
          />
          <AmbienceLogo isDark={true} product='travel' height={44} />
        </a>

        {/* Right side — guest name + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {guestNames && (
            <div style={{ fontSize: 11, color: DARK.label, letterSpacing: '0.02em' }}>
              {guestNames}
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background:   'transparent',
              border:       `1px solid #333533`,
              borderRadius: 8,
              padding:      '6px 10px',
              cursor:       'pointer',
              color:        C.gold,
              fontSize:     16,
              lineHeight:   1,
              transition:   'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(201,184,142,0.4)`}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#333533'}
            aria-label='Open menu'
          >
            ☰
          </button>
        </div>
      </nav>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.6)',
            zIndex:     60,
          }}
        />
      )}

      {/* ── Slide-in drawer ── */}
      <div style={{
        position:   'fixed',
        top:        0,
        right:      0,
        bottom:     0,
        width:      240,
        zIndex:     70,
        background: '#1A1C1A',
        borderLeft: `1px solid #333533`,
        transform:  drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        display:    'flex',
        flexDirection: 'column',
        pointerEvents: drawerOpen ? 'all' : 'none',
      }}>

        {/* Drawer header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '20px 20px',
          borderBottom:   `1px solid #333533`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: DARK.label }}>
            Menu
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: DARK.label, fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_LINKS.map(item => (
            <a
              key={item.label}
              href={`${root}${item.hash}`}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            10,
                padding:        '10px 12px',
                borderRadius:   10,
                border:         '1px solid transparent',
                color:          DARK.body,
                textDecoration: 'none',
                fontSize:       13,
                fontWeight:     500,
                fontFamily:     "'Plus Jakarta Sans', sans-serif",
                transition:     'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background   = 'rgba(201,184,142,0.08)'
                ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(201,184,142,0.20)'
                ;(e.currentTarget as HTMLAnchorElement).style.color       = C.gold
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background   = 'transparent'
                ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent'
                ;(e.currentTarget as HTMLAnchorElement).style.color       = DARK.body
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid #333533` }}>
          <button
            onClick={handleSignOut}
            style={{
              width:        '100%',
              padding:      '9px',
              fontSize:     12,
              fontWeight:   600,
              background:   'transparent',
              border:       `1px solid #333533`,
              borderRadius: 8,
              color:        DARK.label,
              cursor:       'pointer',
              fontFamily:   "'Plus Jakarta Sans', sans-serif",
              transition:   'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color        = '#f87171'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.4)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color        = DARK.label
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#333533'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Page content ── */}
      <div>
        {children}
      </div>

      {/* ── Footer ── */}
      <footer style={{
        padding:        '24px clamp(20px,5vw,48px)',
        background:     '#131513',
        borderTop:      `1px solid #333533`,
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        flexWrap:       'wrap',
        gap:            12,
      }}>
        <div style={{ fontSize: 11, color: '#555D55' }}>
          ambience.travel · Private guest guide
        </div>
        <a href={root} style={{ fontSize: 11, color: C.gold, textDecoration: 'none' }}>
          ← Back to my programmes
        </a>
      </footer>
    </div>
  )
}