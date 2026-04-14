// SignatureHero.tsx — parallax hero for ambience.travel signature experience pages
// Owns the immersive full-bleed hero only. Does not own downstream sections.
// Last updated: S9

import { useEffect, useRef, useState } from 'react'
import AmbienceLogo from '../../AmbienceLogo'
import { C, OVERLAY } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

// Iceland palette — local to this component only, not exported
const ICE = {
  text:        '#F7F2EA',
  textMuted:   'rgba(247,242,234,0.78)',
  eyebrow:     '#DEC694',
  pillBorder:  'rgba(247,242,234,0.28)',
  pillBg:      'rgba(247,242,234,0.10)',
  pillGoldBorder: 'rgba(222,198,148,0.70)',
  pillGoldBg:  'rgba(184,141,59,0.18)',
  pillGoldText: '#F4DFB0',
  btnSecBg:    'rgba(255,255,255,0.11)',
  btnSecBorder: 'rgba(255,255,255,0.22)',
  breadcrumb:  'rgba(247,242,234,0.38)',
  breadcrumbGold: '#DEC694',
  chevron:     'rgba(247,242,234,0.25)',
}

type Props = {
  eyebrow:   string
  title:     string
  subtitle:  string
  pills:     string[]
  imageSrc:  string
  imageAlt:  string
  glassNote: string
}

export default function SignatureHero({
  eyebrow,
  title,
  subtitle,
  pills,
  imageSrc,
  imageAlt,
  glassNote,
}: Props) {
  const { ref, visible } = useVisible(0.05)
  const bgRef            = useRef<HTMLDivElement>(null)
  const [offsetY, setOffsetY] = useState(0)

  useEffect(() => {
    function handleScroll() {
      const node = bgRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight
      if (!isVisible) return
      setOffsetY(rect.top * -0.12)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section
      ref={ref}
      style={{
        borderBottom:    `1px solid rgba(34,50,71,0.6)`,
        padding:         'clamp(20px,3vw,36px) clamp(20px,5vw,48px) clamp(36px,5vw,56px)',
        position:        'relative',
        overflow:        'hidden',
        // Base: deep Nordic blue-grey gradient — matches mockup exactly
        backgroundImage: [
          'linear-gradient(180deg, rgba(36,50,67,0.96) 0%, rgba(82,100,120,0.80) 38%, rgba(217,210,200,0.18) 78%, rgba(247,243,237,0.04) 100%)',
          // Teal aurora bloom — drifts slowly via animation
          'radial-gradient(ellipse 55% 45% at 76% 18%, rgba(125,201,197,0.32) 0%, transparent 60%)',
          // Cooler secondary bloom bottom-left — subtle counter-movement
          'radial-gradient(ellipse 40% 35% at 12% 82%, rgba(100,160,200,0.12) 0%, transparent 55%)',
          // Base colour field
          'linear-gradient(135deg, #223247 0%, #5D738D 46%, #D9D2C8 100%)',
        ].join(', '),
        backgroundSize:     '100% 100%, 220% 220%, 180% 180%, 100% 100%',
        backgroundPosition: '0 0, 100% 0%, 0% 100%, 0 0',
        animation:          'icelandAurora 28s ease-in-out infinite alternate',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Two-column hero grid */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(360px,0.95fr)',
            gap:                 34,
            alignItems:          'stretch',
            minHeight:           600,
          }}
        >
          {/* Left — copy — light-on-dark matching mockup */}
          <div
            style={{
              display:        'flex',
              flexDirection:  'column',
              justifyContent: 'flex-start',
              paddingTop:     'clamp(16px,2.5vw,32px)',
              gap:            20,
              color:          ICE.text,
            }}
          >
            <p
              style={{
                fontSize:      11,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color:         ICE.eyebrow,
                margin:        0,
                ...fadeUp(visible, 60),
              }}
            >
              {eyebrow}
            </p>

            {/* Emblem + logo — mirrors IntroSection identity treatment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...fadeUp(visible, 100) }}>
              <img
                src='/emblem.png'
                alt='ambience.travel emblem'
                style={{
                  width:        56,
                  height:       56,
                  borderRadius: '50%',
                  boxShadow:    '0 0 0 1px rgba(201,184,142,0.35), 0 0 36px rgba(201,184,142,0.22)',
                }}
              />
              <AmbienceLogo isDark={true} product='travel' height='clamp(72px,3.5vw,80px)' />
            </div>

            <h1
              style={{
                fontSize:      'clamp(46px,7vw,82px)',
                fontWeight:    800,
                letterSpacing: '-0.06em',
                lineHeight:    0.95,
                color:         ICE.text,
                margin:        '0 0 20px',
                ...fadeUp(visible, 140),
              }}
            >
              {title}
            </h1>

            <p
              style={{
                fontSize:   19,
                lineHeight: 1.85,
                color:      ICE.textMuted,
                maxWidth:   720,
                margin:     '0 0 28px',
                ...fadeUp(visible, 220),
              }}
            >
              {subtitle}
            </p>

            {/* Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28, ...fadeUp(visible, 300) }}>
              {pills.map((pill, i) => (
                <div
                  key={pill}
                  style={{
                    display:        'inline-flex',
                    alignItems:     'center',
                    padding:        '10px 15px',
                    borderRadius:   999,
                    border:         `1px solid ${i === 0 ? ICE.pillBorder : ICE.pillGoldBorder}`,
                    background:     i === 0 ? ICE.pillBg : ICE.pillGoldBg,
                    color:          i === 0 ? ICE.text : ICE.pillGoldText,
                    fontSize:       12,
                    fontWeight:     600,
                    letterSpacing:  '0.06em',
                    textTransform:  'uppercase',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {pill}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...fadeUp(visible, 380) }}>
              <a
                href='#enquire'
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '14px 22px',
                  borderRadius:   12,
                  background:     C.gold,
                  color:          '#1F1D18',
                  fontSize:       13,
                  fontWeight:     800,
                  letterSpacing:  '0.05em',
                  textTransform:  'uppercase',
                  textDecoration: 'none',
                  border:         `1px solid ${C.gold}`,
                  minWidth:       170,
                }}
              >
                Request details
              </a>
              <a
                href='#enquire'
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '14px 22px',
                  borderRadius:   12,
                  background:     ICE.btnSecBg,
                  color:          ICE.text,
                  fontSize:       13,
                  fontWeight:     800,
                  letterSpacing:  '0.05em',
                  textTransform:  'uppercase',
                  textDecoration: 'none',
                  border:         `1px solid ${ICE.btnSecBorder}`,
                  minWidth:       170,
                }}
              >
                Enquire privately
              </a>
            </div>
          </div>

          {/* Right — image card with parallax — unchanged structurally */}
          <div
            style={{
              ...fadeUp(visible, 200),
              position:     'relative',
              borderRadius: 34,
              overflow:     'hidden',
              border:       'rgba(247,242,234,0.18)',
              boxShadow:    '0 28px 80px rgba(17,24,28,0.22)',
              minHeight:    600,
              background:   '#1A2530',
            }}
          >
            {/* Parallax image layer */}
            <div
              ref={bgRef}
              style={{
                position:   'absolute',
                inset:      '-8% 0',
                transform:  `translateY(${offsetY}px)`,
                willChange: 'transform',
                transition: 'transform 0.08s linear',
              }}
            >
              <img
                src={imageSrc}
                alt={imageAlt}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            {/* Gradient overlay */}
            <div
              style={{
                position:   'absolute',
                inset:      0,
                background: 'linear-gradient(180deg, rgba(13,20,24,0.02) 0%, rgba(13,20,24,0.18) 42%, rgba(13,20,24,0.50) 100%)',
                zIndex:     1,
              }}
            />

            {/* Overlay captions */}
            <div
              style={{
                position:       'absolute',
                left:           22,
                right:          22,
                bottom:         22,
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'flex-end',
                gap:            14,
                flexWrap:       'wrap',
                zIndex:         2,
              }}
            >
              <div
                style={{
                  padding:        '11px 15px',
                  borderRadius:   999,
                  background:     'rgba(251,248,243,0.85)',
                  border:         '1px solid rgba(251,248,243,0.50)',
                  color:          '#1E2320',
                  fontSize:       11,
                  fontWeight:     700,
                  letterSpacing:  '0.12em',
                  textTransform:  'uppercase',
                }}
              >
                Elemental immersion
              </div>

              <div
                style={{
                  maxWidth:       320,
                  padding:        '15px 17px',
                  borderRadius:   22,
                  background:     'rgba(251,248,243,0.16)',
                  border:         '1px solid rgba(251,248,243,0.22)',
                  backdropFilter: 'blur(14px)',
                  color:          '#FBFAF3',
                }}
              >
                <div
                  style={{
                    fontSize:      10,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color:         'rgba(251,248,243,0.72)',
                    marginBottom:  8,
                    fontWeight:    700,
                  }}
                >
                  Signature note
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.55, letterSpacing: '-0.02em' }}>
                  {glassNote}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .sig-hero-grid { grid-template-columns: 1fr !important; }
          .sig-hero-img  { min-height: 360px !important; }
        }
      `}</style>
    </section>
  )
}