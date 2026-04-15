// ImmerseHero.tsx — hero section for all /immerse/ proposal pages
// Owns the full-bleed glass-card hero. Used by both journey overview and destination subpages.
// Hero image is the first element — no brand strip above it.
// Last updated: S11

import { useEffect, useRef, useState } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmersePill } from './ImmerseComponents'

type Props = {
  eyebrow:         string
  title:           string
  subtitle:        string
  pills:           string[]
  heroImageSrc:    string
  heroImageAlt:    string
  primaryHref?:    string
  primaryLabel?:   string
  secondaryHref?:  string
  secondaryLabel?: string
}

export default function ImmerseHero({
  eyebrow,
  title,
  subtitle,
  pills,
  heroImageSrc,
  primaryHref    = '#destinations',
  primaryLabel   = 'View destinations',
  secondaryHref  = '#pricing',
  secondaryLabel = 'Pricing',
}: Props) {
  const { ref, visible } = useImmerseVisible(0.05)
  const isMobile         = useImmerseMobile()
  const sectionRef       = useRef<HTMLElement>(null)
  const [cardOpacity, setCardOpacity] = useState(1)

  useEffect(() => {
    function onScroll() {
      const el = sectionRef.current
      if (!el) return
      const { top, height } = el.getBoundingClientRect()
      // Start fading when card is 20% scrolled, fully faded at 70%
      const progress = Math.max(0, Math.min(1, (-top) / (height * 0.7)))
      setCardOpacity(1 - progress * 0.82)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shellLayers = [
    `linear-gradient(90deg, rgba(6,6,6,0.80) 0%, rgba(6,6,6,0.66) 36%, rgba(6,6,6,0.34) 62%, rgba(6,6,6,0.18) 100%)`,
    `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.44) 100%)`,
    `url('${heroImageSrc}')`,
  ]

  return (
    <section
      ref={sectionRef}
      style={{ borderTop: 'none', padding: 0, margin: 0 }}
    >
      <div
        style={{
          position:               'relative',
          minHeight:              isMobile ? 620 : 740,
          backgroundImage:        shellLayers.join(', '),
          backgroundAttachment:   isMobile ? 'scroll' : 'fixed, fixed, fixed',
          backgroundSize:         'auto, auto, cover',
          backgroundPosition:     'center, center, center',
          backgroundRepeat:       'no-repeat, no-repeat, no-repeat',
          display:                'flex',
          alignItems:             'center',
        }}
      >
        <div style={{ width: 'min(1220px, calc(100% - 36px))', margin: '0 auto', padding: '44px 0' }}>
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            style={{
              width:          `min(760px, 100%)`,
              padding:        isMobile ? 22 : 38,
              border:         '1px solid rgba(255,255,255,0.08)',
              borderRadius:   30,
              background:     'linear-gradient(180deg, rgba(12,12,12,0.38), rgba(12,12,12,0.18))',
              backdropFilter: 'blur(8px)',
              opacity:        cardOpacity,
              transition:     'opacity 0.05s linear',
            }}
          >
            <div
              style={{
                color:         ID.gold,
                fontSize:      11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight:    700,
                marginBottom:  14,
                ...immerseFadeUp(visible, 0),
              }}
            >
              {eyebrow}
            </div>

            <div
              style={{
                fontSize:      isMobile ? 38 : 'clamp(48px,6.2vw,88px)',
                lineHeight:    0.93,
                letterSpacing: '-0.075em',
                fontWeight:    800,
                marginBottom:  16,
                color:         ID.text,
              }}
            >
              {title.split(' ').map((word, i) => (
                <span
                  key={i}
                  style={{
                    display:        'inline-block',
                    marginRight:    '0.22em',
                    opacity:        visible ? 1 : 0,
                    transform:      visible ? 'translateY(0)' : 'translateY(14px)',
                    transition:     `opacity 0.7s ease ${80 + i * 55}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${80 + i * 55}ms`,
                    willChange:     'opacity, transform',
                  }}
                >
                  {word}
                </span>
              ))}
            </div>

            <p
              style={{
                color:      ID.muted,
                fontSize:   18,
                lineHeight: 1.84,
                maxWidth:   700,
                margin:     0,
                ...immerseFadeUp(visible, 120),
              }}
            >
              {subtitle}
            </p>

            <div
              style={{
                display:   'flex',
                flexWrap:  'wrap',
                gap:       10,
                marginTop: 24,
                ...immerseFadeUp(visible, 180),
              }}
            >
              {pills.map(p => (
                <ImmersePill key={p}>{p}</ImmersePill>
              ))}
            </div>

            <div
              style={{
                display:       'flex',
                flexWrap:      'wrap',
                gap:           12,
                marginTop:     28,
                flexDirection: isMobile ? 'column' : 'row',
                ...immerseFadeUp(visible, 240),
              }}
            >
              <a
                href={primaryHref}
                style={{
                  minHeight:      46,
                  padding:        '0 18px',
                  borderRadius:   12,
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize:       12,
                  letterSpacing:  '0.08em',
                  textTransform:  'uppercase',
                  fontWeight:     800,
                  background:     ID.gold,
                  color:          '#090909',
                  border:         `1px solid ${ID.gold}`,
                }}
              >
                {primaryLabel}
              </a>
              <a
                href={secondaryHref}
                style={{
                  minHeight:      46,
                  padding:        '0 18px',
                  borderRadius:   12,
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize:       12,
                  letterSpacing:  '0.08em',
                  textTransform:  'uppercase',
                  fontWeight:     800,
                  background:     'transparent',
                  color:          ID.text,
                  border:         '1px solid rgba(255,255,255,0.14)',
                }}
              >
                {secondaryLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}