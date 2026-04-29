// ImmerseHero.tsx — hero section for all /immerse/ proposal pages
// Owns the full-bleed glass-card hero. Used by both journey overview and destination subpages.
// Hero image is the first element — no brand strip above it.
//
// Last updated: S32E (Add 1 perf fix) — Path A refactor: hero image now renders as
//   real <img> with fetchpriority="high" instead of CSS background-image stack.
//   3 gradient layers become absolutely-positioned overlay divs sitting between
//   image and glass card. Parallax preserved via JS transform on the <img>
//   (PARALLAX_MAGNITUDE constant — tune as needed). Targets LCP fix from 5.3s.
//   Visual output preserved; paint pipeline fundamentally different.
// Prior: S32 (Add 1) — Optional itinerary status line. Renders below
//   the date+nights label as small italic dim text. Subtle marker for guests
//   so they understand which stage of the proposal lifecycle they're seeing.

import { useEffect, useRef, useState } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp } from './ImmerseComponents'

// Parallax tuning 0.8 is closer to true background-attachment:fixed feel.
// Image overscan (height 116% / top -8%) accommodates magnitudes up to 0.8.
const PARALLAX_MAGNITUDE = 0.8

type Props = {
  // Personalisation
  guestName:       string
  titlePrefix?:    string   // renders in Cormorant Garamond italic — e.g. "Honeymoon in"
  dateLabel?:      string   // renders in gold below title — e.g. "January 2027"
  nightsLabel?:    string   // appended to dateLabel with · separator — e.g. "5–6 Nights"
  itineraryStage?: string   // S32: small italic line — e.g. "Refined Proposal"
  // Content
  title:           string
  subtitle:        string
  pills?:          string[]
  heroImageSrc:    string
  heroImageAlt:    string
  primaryHref?:    string
  primaryLabel?:   string
  diningHref?:     string   // optional third CTA — "Dining + Experiences"
  diningLabel?:    string
  secondaryHref?:  string
  secondaryLabel?: string
}

export default function ImmerseHero({
  guestName,
  titlePrefix,
  dateLabel,
  nightsLabel,
  itineraryStage,
  title,
  subtitle,
  pills = [],
  heroImageSrc,
  heroImageAlt,
  primaryHref    = '#destinations',
  primaryLabel   = 'View destinations',
  diningHref,
  diningLabel    = 'Dining + Experiences',
  secondaryHref  = '#pricing',
  secondaryLabel = 'Pricing',
}: Props) {
  const { ref, visible } = useImmerseVisible(0.05)
  const isMobile         = useImmerseMobile()
  const sectionRef       = useRef<HTMLElement>(null)
  const imgRef           = useRef<HTMLImageElement>(null)
  const [cardOpacity, setCardOpacity] = useState(1)

  // Single rAF-throttled scroll listener — drives both parallax and card fade.
  // Mobile skips parallax (matches prior backgroundAttachment: 'scroll' behavior).
  useEffect(() => {
    let rafId = 0
    let ticking = false

    function update() {
      const el = sectionRef.current
      if (!el) {
        ticking = false
        return
      }
      const { top, height } = el.getBoundingClientRect()

      // Card opacity fade — unchanged from prior shape
      const progress = Math.max(0, Math.min(1, (-top) / (height * 0.7)))
      setCardOpacity(1 - progress * 0.82)

      // Parallax — desktop only. Translate <img> against scroll direction.
      // top is positive when section is below viewport, negative when scrolled past.
      if (!isMobile && imgRef.current) {
        const translateY = -top * PARALLAX_MAGNITUDE
        imgRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`
      }

      ticking = false
    }

    function onScroll() {
      if (!ticking) {
        rafId = requestAnimationFrame(update)
        ticking = true
      }
    }

    // Run once on mount to set initial parallax position
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMobile])

  return (
    <section
      ref={sectionRef}
      style={{ borderTop: 'none', padding: 0, margin: 0 }}
    >
      <div
        style={{
          position:   'relative',
          minHeight:  isMobile ? 640 : 820,
          overflow:   'hidden',                // contain the overscanned <img>
          display:    'flex',
          alignItems: 'center',
        }}
      >
        {/* Hero image — real <img> for LCP prioritization. */}
        {/* Overscanned (116% height, -8% top) so parallax translation never reveals edges. */}
        <img
          ref={imgRef}
          src={heroImageSrc}
          alt={heroImageAlt}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          style={{
            position:       'absolute',
            top:            isMobile ? 0 : '-40%',
            left:           0,
            width:          '100%',
            height:         isMobile ? '100%' : '180%',
            objectFit:      'cover',
            objectPosition: 'center',
            zIndex:         0,
            willChange:     isMobile ? 'auto' : 'transform',
          }}
        />

        {/* Overlay layer 1 — radial vignette */}
        <div
          aria-hidden
          style={{
            position:   'absolute',
            inset:      0,
            background: 'radial-gradient(circle at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.44) 100%)',
            zIndex:     1,
            pointerEvents: 'none',
          }}
        />

        {/* Overlay layer 2 — vertical gradient */}
        <div
          aria-hidden
          style={{
            position:   'absolute',
            inset:      0,
            background: 'linear-gradient(180deg, rgba(3,6,18,0.22) 0%, rgba(2,4,12,0.52) 100%)',
            zIndex:     2,
            pointerEvents: 'none',
          }}
        />

        {/* Overlay layer 3 — side gradient (left-biased darken) */}
        <div
          aria-hidden
          style={{
            position:   'absolute',
            inset:      0,
            background: 'linear-gradient(90deg, rgba(6,6,6,0.72) 0%, rgba(6,6,6,0.40) 32%, rgba(6,6,6,0.18) 62%, rgba(6,6,6,0.28) 100%)',
            zIndex:     3,
            pointerEvents: 'none',
          }}
        />

        {/* Content layer — glass card */}
        <div
          style={{
            position:  'relative',
            zIndex:    4,
            width:     'min(1220px, calc(100% - 36px))',
            margin:    '0 auto',
            padding:   '44px 0',
          }}
        >
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

            {/* Main title — Cormorant Garamond, word stagger */}
            <div
              style={{
                fontSize:      isMobile ? 52 : 'clamp(60px,7.5vw,108px)',
                lineHeight:    0.95,
                letterSpacing: '-0.02em',
                fontWeight:    400,
                fontFamily:    '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
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
                  marginBottom:  itineraryStage ? 8 : 18,
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

            {/* S32: Itinerary stage indicator — italic, dim, subtle */}
            {itineraryStage && (
              <div
                style={{
                  color:         ID.dim,
                  fontSize:      isMobile ? 11 : 12,
                  letterSpacing: '0.06em',
                  fontStyle:     'italic',
                  fontWeight:    400,
                  marginBottom:  18,
                  ...immerseFadeUp(visible, 220),
                }}
              >
                {itineraryStage}
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