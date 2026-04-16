// ExperiencesLayout.tsx — layout wrapper for ambience.travel signature experience pages
// Owns the nav, back-to-top, global keyframes, and overflow lock for all /experiences/* routes.
// Does not own section content — each SignatureExperiencePage composes its own sections.
// Last updated: S9

import { useEffect, useState, type ReactNode } from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { C, OVERLAY } from '../../lib/landingTypes'

interface Props {
  children: ReactNode
}

export default function ExperiencesLayout({ children }: Props) {
  const [navVisible, setNavVisible]   = useState(false)
  const [scrolled,   setScrolled]     = useState(false)

  // Show nav + back-to-top once user scrolls past the hero
  useEffect(() => {
    function handleScroll() {
      const past = window.scrollY > 80
      setNavVisible(past)
      setScrolled(past)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Global keyframes — aurora animation used by SignatureHero, any future haze sections
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes icelandAurora {
        0%   { background-position: 0 0, 100% 0%,   0% 100%, 0 0; }
        33%  { background-position: 0 0,  60% 30%,  40% 70%,  0 0; }
        66%  { background-position: 0 0,  80% 10%,  20% 90%,  0 0; }
        100% { background-position: 0 0,  40% 55%,  80% 30%,  0 0; }
      }
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  // Prevent horizontal scroll
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
        background: C.bg,
        color:      C.text,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflowX:  'hidden',
      }}
    >
      {/* Fixed nav — fades in after hero scrolls out */}
      {navVisible && (
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
            opacity:        scrolled ? 1 : 0,
            transition:     'opacity 0.3s ease',
          }}
        >
          {/* Logo — links back to landing */}
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

          {/* CTA */}
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
      )}

      {/* Back to top */}
      {navVisible && (
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
      )}

      {/* Page content */}
      {children}
    </div>
  )
}