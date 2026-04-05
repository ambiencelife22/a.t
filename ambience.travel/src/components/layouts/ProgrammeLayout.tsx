/* ProgrammeLayout.tsx
 * Global layout shell for all programme.ambience.travel pages.
 * Provides: nav (emblem + logo + guest slot), footer, base typography.
 * Content is injected via children — no page-specific logic here.
 *
 * Usage:
 *   <ProgrammeLayout guestNames="Ragnar & Gunnar">
 *     <ProgrammePage ... />
 *   </ProgrammeLayout>
 */

import React from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { C } from '../../lib/landingTypes'

interface ProgrammeLayoutProps {
  children:    React.ReactNode
  guestNames?: string   // shown in nav — optional (admin pages won't have it)
}

export default function ProgrammeLayout({ children, guestNames }: ProgrammeLayoutProps) {
  return (
    <div style={{
      minHeight:  '100vh',
      background: C.bg,
      color:      C.text,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflowX:  'hidden',
    }}>
      {/* ── Fixed nav ──────────────────────────────────────────────────── */}
      <nav style={{
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
      }}>
        <a
          href='https://ambience.travel'
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <img
            src='/emblem.png'
            alt='ambience.travel emblem'
            style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
          />
          <AmbienceLogo isDark={false} product='travel' height={44} />
        </a>

        {guestNames && (
          <div style={{
            fontSize:      11,
            color:         C.muted,
            letterSpacing: '0.02em',
          }}>
            {guestNames}
          </div>
        )}
      </nav>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <div>
        {children}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        padding:        '24px clamp(20px,5vw,48px)',
        background:     C.bgDark,
        borderTop:      `1px solid #333533`,
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        flexWrap:       'wrap',
        gap:            12,
      }}>
        <div style={{ fontSize: 11, color: '#838383' }}>
          ambience.travel · Private guest guide
        </div>
        <a
          href='https://ambience.travel'
          style={{ fontSize: 11, color: C.gold, textDecoration: 'none' }}
        >
          ambience.travel
        </a>
      </footer>
    </div>
  )
}