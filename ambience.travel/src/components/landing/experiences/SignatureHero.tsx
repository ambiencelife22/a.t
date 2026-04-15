// SignatureHero.tsx — parallax hero for ambience.travel signature experience pages
// Owns the immersive full-bleed hero only. Does not own downstream sections.
// Last updated: S9

import { useEffect, useRef, useState } from 'react'
import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

// Iceland palette — local to this component only, not exported
const ICE = {
  text:           '#F7F2EA',
  textMuted:      'rgba(247,242,234,0.78)',
  eyebrow:        '#DEC694',
  pillBorder:     'rgba(247,242,234,0.28)',
  pillBg:         'rgba(247,242,234,0.10)',
  pillGoldBorder: 'rgba(222,198,148,0.70)',
  pillGoldBg:     'rgba(184,141,59,0.18)',
  pillGoldText:   '#F4DFB0',
  btnSecBg:       'rgba(255,255,255,0.11)',
  btnSecBorder:   'rgba(255,255,255,0.22)',
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
  const bgRef             = useRef<HTMLDivElement>(null)
  const [offsetY,  setOffsetY]  = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 860) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
        backgroundImage: [
          'linear-gradient(180deg, rgba(36,50,67,0.96) 0%, rgba(82,100,120,0.80) 38%, rgba(217,210,200,0.18) 78%, rgba(247,243,237,0.04) 100%)',
          'radial-gradient(ellipse 55% 45% at 76% 18%, rgba(125,201,197,0.32) 0%, transparent 60%)',
          'radial-gradient(ellipse 40% 35% at 12% 82%, rgba(100,160,200,0.12) 0%, transparent 55%)',
          'linear-gradient(135deg, #223247 0%, #5D738D 46%, #D9D2C8 100%)',
        ].join(', '),
        backgroundSize:     '100% 100%, 220% 220%, 180% 180%, 100% 100%',
        backgroundPosition: '0 0, 100% 0%, 0% 100%, 0 0',
        animation:          'icelandAurora 28s ease-in-out infinite alternate',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Two-column grid — stacks on mobile */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) minmax(360px,0.95fr)',
            gap:                 isMobile ? 28 : 34,
            alignItems:          'stretch',
            minHeight:           isMobile ? 'auto' : 600,
          }}
        >
          {/* Left — copy */}
          <div
            style={{
              display:        'flex',
              flexDirection:  'column',
              justifyContent: 'flex-start',
              paddingTop:     isMobile ? 8 : 'clamp(16px,2.5vw,32px)',
              gap:            isMobile ? 16 : 20,
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

            <h1
              style={{
                fontSize:      'clamp(38px,7vw,82px)',
                fontWeight:    800,
                letterSpacing: '-0.06em',
                lineHeight:    0.95,
                color:         ICE.text,
                margin:        0,
                ...fadeUp(visible, 140),
              }}
            >
              {title}
            </h1>

            <p
              style={{
                fontSize:   isMobile ? 16 : 19,
                lineHeight: 1.85,
                color:      ICE.textMuted,
                maxWidth:   720,
                margin:     0,
                ...fadeUp(visible, 220),
              }}
            >
              {subtitle}
            </p>

            {/* Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, ...fadeUp(visible, 300) }}>
              {pills.map((pill, i) => (
                <div
                  key={pill}
                  style={{
                    display:        'inline-flex',
                    alignItems:     'center',
                    padding:        '9px 14px',
                    borderRadius:   999,
                    border:         `1px solid ${i === 0 ? ICE.pillBorder : ICE.pillGoldBorder}`,
                    background:     i === 0 ? ICE.pillBg : ICE.pillGoldBg,
                    color:          i === 0 ? ICE.text : ICE.pillGoldText,
                    fontSize:       11,
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
            <div
              style={{
                display:       'flex',
                gap:           12,
                flexWrap:      'wrap',
                flexDirection: isMobile ? 'column' : 'row',
                ...fadeUp(visible, 380),
              }}
            >
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
                }}
              >
                Enquire privately
              </a>
            </div>
          </div>

          {/* Right — image card with parallax */}
          <div
            style={{
              ...fadeUp(visible, 200),
              position:     'relative',
              borderRadius: 28,
              overflow:     'hidden',
              border:       '1px solid rgba(247,242,234,0.18)',
              boxShadow:    '0 28px 80px rgba(17,24,28,0.22)',
              minHeight:    isMobile ? 320 : 600,
              background:   '#1A2530',
            }}
          >
            {/* Parallax image layer — disabled on mobile for perf */}
            <div
              ref={bgRef}
              style={{
                position:   'absolute',
                inset:      '-8% 0',
                transform:  isMobile ? 'none' : `translateY(${offsetY}px)`,
                willChange: isMobile ? 'auto' : 'transform',
                transition: isMobile ? 'none' : 'transform 0.08s linear',
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

            {/* Overlay captions — hide glass note on mobile to reduce clutter */}
            <div
              style={{
                position:       'absolute',
                left:           16,
                right:          16,
                bottom:         16,
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'flex-end',
                gap:            12,
                flexWrap:       'wrap',
                zIndex:         2,
              }}
            >
              <div
                style={{
                  padding:        '10px 14px',
                  borderRadius:   999,
                  background:     'rgba(251,248,243,0.85)',
                  border:         '1px solid rgba(251,248,243,0.50)',
                  color:          '#1E2320',
                  fontSize:       10,
                  fontWeight:     700,
                  letterSpacing:  '0.12em',
                  textTransform:  'uppercase',
                }}
              >
                Elemental immersion
              </div>

              {!isMobile && (
                <div
                  style={{
                    maxWidth:       300,
                    padding:        '14px 16px',
                    borderRadius:   20,
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
                  <div style={{ fontSize: 15, lineHeight: 1.55, letterSpacing: '-0.02em' }}>
                    {glassNote}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}