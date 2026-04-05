import React, { useEffect, useState } from 'react'

// SPORTS app layout imports — not used for travel landing right now
// import type { AdminNotification as AppNotification } from '../lib/queries'
// import { C } from '../lib/theme'
// import { useContext } from 'react'
// import { ThemeContext } from '../lib/ThemeContext'
// import { APP_VERSION } from '../lib/version'
// import { ANIM, useAnimatedNumber } from '../lib/animations'
// import { BET_TYPE_COLORS, DANGER } from '../lib/colors'
// import { useIsMobile } from '../lib/useIsMobile'

import AmbienceLogo from '../AmbienceLogo'

import VideoIntroSection from '../landing/VideoIntroSection'
import IntroSection from '../landing/IntroSection'
import HeroSection from '../landing/HeroSection'
import EditorialSection from '../landing/EditorialSection'
import PillarsSection from '../landing/PillarsSection'
import JourneyMomentsSection from '../landing/JourneyMomentsSection'
import ExperienceTypesSection from '../landing/ExperienceTypesSection'
import DarkCTASection from '../landing/DarkCTASection'

import { C, OVERLAY } from '../../lib/landingTypes'

// SPORTS dashboard/app page types — not used for travel landing right now
// type Page =
//   | 'dashboard'
//   | 'entry'
//   | 'books'
//   | 'analytics'
//   | 'pwins'
//   | 'mysystem'
//   | 'reports'
//   | 'admin'
//   | 'profile'
//   | 'legal'
//   | 'glossary'
//   | 'plan-selection'
//   | 'checkout'
//   | 'checkout-success'

// SPORTS notification types — not used for travel landing right now
// interface Notification {
//   id: string
//   message: string
//   at: Date
//   read: boolean
// }

interface LayoutProps {
  // Keeping this optional so the file can be dropped in without breaking callers
  children?: React.ReactNode
}

export default function LandingLayout({ children: _children }: LayoutProps) {
  const [heroVis, setHeroVis] = useState(false)
  const [navVisible, setNavVisible] = useState(false)

  // Reveal nav once Intro scrolls out of view
  useEffect(() => {
    const el = document.getElementById('intro-section')
    if (!el) return

    const obs = new IntersectionObserver(
      ([e]) => setNavVisible(!e.isIntersecting),
      { threshold: 0, rootMargin: '-56px 0px 0px 0px' }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Shared landing keyframes
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes warmBreath { 0%,100%{opacity:1} 50%{opacity:0.78} }
      @keyframes scribbleLine1 { from{stroke-dashoffset:220} to{stroke-dashoffset:0} }
      @keyframes scribbleLine2 { from{stroke-dashoffset:225} to{stroke-dashoffset:0} }
      @keyframes scribbleIn { 0%{opacity:0} 8%{opacity:1} 100%{opacity:1} }
      @keyframes scribbleOut { 0%{opacity:1} 100%{opacity:0} }
    `

    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Prevent horizontal page scroll
  useEffect(() => {
    const prev = document.documentElement.style.overflowX
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    return () => {
      document.documentElement.style.overflowX = prev
      document.body.style.overflowX = ''
    }
  }, [])

  // Intro stagger trigger
  useEffect(() => {
    const t = setTimeout(() => setHeroVis(true), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflowX: 'hidden',
      }}
    >
      {/* Fixed nav — hidden during intro */}
      {navVisible && (
        <nav
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 60,
            background: C.navBg,
            backdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 clamp(20px,5vw,48px)',
          }}
        >
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

          <button
            disabled
            aria-disabled='true'
            style={{
              padding: '9px 18px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 100,
              border: `1px solid ${OVERLAY.cardLabel}`,
              background: C.bgDark,
              color: C.lightText,
              cursor: 'default',
              letterSpacing: '0.04em',
              opacity: 0.22,
            }}
          >
            Begin the Conversation
          </button>
        </nav>
      )}

      {/* Back to top */}
      {navVisible && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title='Back to top'
          style={{
            position: 'fixed',
            right: 28,
            bottom: 'calc(28px + env(safe-area-inset-bottom))',
            zIndex: 40,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: C.bgDark,
            border: `1px solid ${OVERLAY.cardLabel}`,
            color: C.gold,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            opacity: 0.94,
          }}
        >
          ↑
        </button>
      )}

      <div id='intro-section'>
        <IntroSection heroVis={heroVis} />
      </div>

      <HeroSection />
      <EditorialSection />
      <VideoIntroSection />
      <JourneyMomentsSection />
      <PillarsSection />
      <ExperienceTypesSection />
      {/* <HospitalitySection /> */}
      <DarkCTASection />
    </div>
  )
}