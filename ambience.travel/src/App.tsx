import { useEffect, useState } from 'react'
import IntroSection from './components/landing/IntroSection'
import HeroSection from './components/landing/HeroSection'
import EditorialSection from './components/landing/EditorialSection'
import PillarsSection from './components/landing/PillarsSection'
import JourneyMomentsSection from './components/landing/JourneyMomentsSection'
import ExperienceTypesSection from './components/landing/ExperienceTypesSection'
import HospitalitySection from './components/landing/HospitalitySection'
import DarkCTASection from './components/landing/DarkCTASection'
import { C } from './lib/landingTypes'
import AmbienceLogo from './components/AmbienceLogo'

export default function App() {
  const [heroVis, setHeroVis] = useState(false)
  const [navVisible, setNavVisible] = useState(false)

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

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes warmBreath { 0%,100%{opacity:1} 50%{opacity:0.78} }
      @keyframes scribbleLine1 { from{stroke-dashoffset:220} to{stroke-dashoffset:0} }
      @keyframes scribbleLine2 { from{stroke-dashoffset:225} to{stroke-dashoffset:0} }
      @keyframes scribbleLine3 { from{stroke-dashoffset:215} to{stroke-dashoffset:0} }
      @keyframes scribbleIn    { 0%{opacity:0} 8%{opacity:1} 100%{opacity:1} }
      @keyframes scribbleOut   { 0%{opacity:1} 100%{opacity:0} }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    const prev = document.documentElement.style.overflowX
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
    return () => {
      document.documentElement.style.overflowX = prev
      document.body.style.overflowX = ''
    }
  }, [])

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
      {navVisible && (
        <nav
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 60,
            background: 'rgba(247,244,238,0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 clamp(20px,5vw,48px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src='/emblem.png'
              alt='ambience emblem'
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            />
            <AmbienceLogo isDark={false} product='travel' height={44} />
          </div>

          <button
            disabled
            aria-disabled='true'
            style={{
              padding: '9px 18px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 100,
              border: `1px solid rgba(201,184,142,0.38)`,
              background: '#171917',
              color: '#F7F4EE',
              cursor: 'default',
              letterSpacing: '0.04em',
              opacity: 0.44,
            }}
          >
            Begin the Conversation
          </button>
        </nav>
      )}

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
            background: '#171917',
            border: '1px solid rgba(201,184,142,0.3)',
            color: '#C9B88E',
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
      <JourneyMomentsSection />
      <PillarsSection />
      <ExperienceTypesSection />
      {/* <HospitalitySection /> */}
      <DarkCTASection />
    </div>
  )
}