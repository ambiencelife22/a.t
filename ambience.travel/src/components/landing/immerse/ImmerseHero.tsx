// ImmerseHero.tsx — hero section for all /immerse/ proposal pages
// Owns the full-bleed glass-card hero. Used by both journey overview and destination subpages.
// Hero image is the first element — no brand strip above it.
// Last updated: S11

import { useEffect, useRef, useState } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp } from './ImmerseComponents'

type Props = {
  // Personalisation
  guestName:       string
  titlePrefix?:    string   // renders in Cormorant Garamond italic — e.g. "Honeymoon in"
  dateLabel?:      string   // renders in gold below title — e.g. "January 2027"
  nightsLabel?:    string   // appended to dateLabel with · separator — e.g. "5–6 Nights"
  // Content
  title:           string
  subtitle:        string
  pills?:          string[]
  heroImageSrc:    string
  heroImageAlt:    string
  primaryHref?:    string
  primaryLabel?:   string
  diningHref?:     string   // optional third CTA — "Dining + activities"
  diningLabel?:    string
  secondaryHref?:  string
  secondaryLabel?: string
}

export default function ImmerseHero({
  guestName,
  titlePrefix,
  dateLabel,
  nightsLabel,
  title,
  subtitle,
  pills = [],
  heroImageSrc,
  heroImageAlt,
  primaryHref    = '#destinations',
  primaryLabel   = 'View destinations',
  diningHref,
  diningLabel    = 'Dining + activities',
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
      const progress = Math.max(0, Math.min(1, (-top) / (height * 0.7)))
      setCardOpacity(1 - progress * 0.82)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Vignette (radial) + vertical gradient + left-side gradient + image
  const shellLayers = [
    'radial-gradient(circle at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.44) 100%)',
    'linear-gradient(180deg, rgba(3,6,18,0.22) 0%, rgba(2,4,12,0.52) 100%)',
    'linear-gradient(90deg, rgba(6,6,6,0.72) 0%, rgba(6,6,6,0.40) 32%, rgba(6,6,6,0.18) 62%, rgba(6,6,6,0.28) 100%)',
    `url('${heroImageSrc}')`,
  ]

  return (
    <section
      ref={sectionRef}
      style={{ borderTop: 'none', padding: 0, margin: 0 }}
    >
      <div
        aria-label={heroImageAlt}
        style={{
          position:             'relative',
          minHeight:            isMobile ? 640 : 820,
          backgroundImage:      shellLayers.join(', '),
          backgroundAttachment: isMobile ? 'scroll' : 'fixed, fixed, fixed, fixed',
          backgroundSize:       'auto, auto, auto, cover',
          backgroundPosition:   'center, center, center, center',
          backgroundRepeat:     'no-repeat, no-repeat, no-repeat, no-repeat',
          display:              'flex',
          alignItems:           'center',
        }}
      >
        <div style={{ width: 'min(1220px, calc(100% - 36px))', margin: '0 auto', padding: '44px 0' }}>
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            style={{
              width:                'min(760px, 100%)',
              padding:              isMobile ? 22 : 38,
              border:               '1px solid rgba(255,255,255,0.20)',
              borderRadius:         30,
              background:           'linear-gradient(180deg, rgba(12,12,12,0.18), rgba(12,12,12,0.10))',
              backdropFilter:       'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow:            '0 20px 60px rgba(0,0,0,0.22)',
              opacity:              cardOpacity,
              transition:           'opacity 0.05s linear',
            }}
          >
            {/* Guest name — larger than standard eyebrow */}
            <div
              style={{
                color:         ID.gold,
                fontSize:      isMobile ? 13 : 15,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight:    700,
                marginBottom:  20,
                ...immerseFadeUp(visible, 0),
              }}
            >
              {guestName}
            </div>

            {/* titlePrefix — Cormorant Garamond italic */}
            {titlePrefix && (
              <div
                style={{
                  color:        ID.text,
                  fontSize:     isMobile ? 38 : 'clamp(42px,5vw,68px)',
                  lineHeight:   1.0,
                  fontFamily:   '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
                  fontStyle:    'italic',
                  fontWeight:   400,
                  marginBottom: 4,
                  ...immerseFadeUp(visible, 50),
                }}
              >
                {titlePrefix}
              </div>
            )}

            {/* Main title — Plus Jakarta Sans, word stagger */}
            <div
              style={{
                fontSize:      isMobile ? 38 : 'clamp(48px,6.2vw,88px)',
                lineHeight:    0.93,
                letterSpacing: '-0.075em',
                fontWeight:    800,
                marginBottom:  dateLabel ? 14 : 16,
                color:         ID.text,
              }}
            >
              {title.split(' ').map((word, i) => (
                <span
                  key={i}
                  style={{
                    display:    'inline-block',
                    marginRight: '0.22em',
                    opacity:    visible ? 1 : 0,
                    transform:  visible ? 'translateY(0)' : 'translateY(14px)',
                    transition: `opacity 0.7s ease ${100 + i * 55}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${100 + i * 55}ms`,
                    willChange: 'opacity, transform',
                  }}
                >
                  {word}
                </span>
              ))}
            </div>

            {/* Date + nights label */}
            {(dateLabel || nightsLabel) && (
              <div
                style={{
                  color:         ID.gold,
                  fontSize:      isMobile ? 12 : 13,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight:    700,
                  marginBottom:  18,
                  ...immerseFadeUp(visible, 200),
                }}
              >
                {dateLabel}
                {dateLabel && nightsLabel && (
                  <span style={{ opacity: 0.5, margin: '0 8px' }}>·</span>
                )}
                {nightsLabel}
              </div>
            )}

            {/* Subtitle */}
            <p
              style={{
                color:      ID.muted,
                fontSize:   18,
                lineHeight: 1.84,
                maxWidth:   700,
                margin:     0,
                ...immerseFadeUp(visible, 240),
              }}
            >
              {subtitle}
            </p>

            {/* CTAs — gold primary, ghost dining, ghost secondary */}
            <div
              style={{
                display:       'flex',
                flexWrap:      'wrap',
                gap:           12,
                marginTop:     28,
                flexDirection: isMobile ? 'column' : 'row',
                ...immerseFadeUp(visible, 290),
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

              {diningHref && (
                <a
                  href={diningHref}
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
                    fontWeight:     700,
                    background:     'transparent',
                    color:          ID.muted,
                    border:         '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  {diningLabel}
                </a>
              )}

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