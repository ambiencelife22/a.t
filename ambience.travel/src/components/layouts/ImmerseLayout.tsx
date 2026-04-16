// ImmerseLayout.tsx — layout wrapper for ambience.travel /immerse/ proposal pages
// Owns nav, back-to-top, overflow lock. Nav matches LandingLayout / ExperiencesLayout exactly.
// Nav is always visible — no scroll trigger.
// Last updated: S10

import { useEffect, type ReactNode } from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { C, OVERLAY } from '../../lib/landingTypes'
import { ID } from '../landing/immerse/ImmerseComponents'

type Props = { children: ReactNode }

export default function ImmerseLayout({ children }: Props) {
  useEffect(() => {
    const prev = document.documentElement.style.overflowX
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    return () => {
      document.documentElement.style.overflowX = prev
      document.body.style.overflowX = ''
    }
  }, [])

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
          href='https://ambience.travel'
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <img
            src='/emblem.png'
            alt='ambience.travel'
            style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
          />
          <AmbienceLogo isDark={false} product='travel' height={44} />
        </a>

        {/* <button
          disabled
          aria-disabled='true'
          style={{
            padding:       '9px 18px',
            fontSize:      12,
            fontWeight:    700,
            borderRadius:  100,
            border:        `1px solid ${OVERLAY.cardLabel}`,
            background:    C.bgDark,
            color:         C.lightText,
            cursor:        'default',
            letterSpacing: '0.04em',
            opacity:       0.22,
          }}
        >
          Begin the Conversation
        </button> */}
      </nav>

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