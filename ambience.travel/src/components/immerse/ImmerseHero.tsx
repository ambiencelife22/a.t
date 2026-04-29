// ImmerseHero.tsx — hero section for all /immerse/ proposal pages
// Owns the full-bleed glass-card hero. Used by both journey overview and destination subpages.
// Hero image is the first element — no brand strip above it.
//
// Last updated: S32F — Token + style extraction. All hardcoded rgba/hex
//   literals lifted to IMMERSE_HERO + FONTS tokens in landingColors.ts per
//   Dev Standards §II "no hardcoded hex strings in component files". Layout-
//   shape constants (heights, parallax magnitude, image overscan) consolidated
//   into HERO_LAYOUT config block at top of file. No visual change — same
//   hex values, sourced from tokens. Cormorant Garamond fontFamily promoted
//   to FONTS.serif (used here + ImmerseDestComponents). PARALLAX_MAGNITUDE
//   moved into HERO_LAYOUT alongside related layout constants.
// Prior: S32E (Add 1 perf fix) — Path A refactor: hero image now renders as
//   real <img> with fetchpriority="high" instead of CSS background-image stack.
//   3 gradient layers become absolutely-positioned overlay divs sitting between
//   image and glass card. Parallax preserved via JS transform on the <img>
//   (PARALLAX_MAGNITUDE constant — tune as needed). Targets LCP fix from 5.3s.
//   Visual output preserved; paint pipeline fundamentally different.
// Prior: S32 (Add 1) — Optional itinerary status line. Renders below
//   the date+nights label as small italic dim text. Subtle marker for guests
//   so they understand which stage of the proposal lifecycle they're seeing.

import { useEffect, useRef, useState } from 'react'
import { ID, IMMERSE_HERO, FONTS } from '../../lib/landingColors'
import { useImmerseMobile, useImmerseVisible, immerseFadeUp } from './ImmerseComponents'

// ─── Layout config ───────────────────────────────────────────────────────────
// All hero shape/motion constants live here. Visual chrome (colors, gradients,
// borders) lives in IMMERSE_HERO tokens. Typography fontFamily is FONTS.serif.

const HERO_LAYOUT = {
  // Section minimum height — desktop is taller for cinematic effect.
  minHeightMobile:   640,
  minHeightDesktop:  820,

  // Parallax tuning. 0.8 is closer to true background-attachment:fixed feel.
  // Image overscan (height 180% / top -40%) accommodates magnitudes up to 0.8.
  parallaxMagnitude: 0.8,
  imageHeightDesktop: '180%',
  imageHeightMobile:  '100%',
  imageTopDesktop:    '-40%',
  imageTopMobile:     0,

  // Card opacity fade — progress is 0..1 over (height * fadeWindow) of scroll.
  // fadeMax = 0.82 means card fades from 1.0 to 0.18 across the scroll window.
  cardFadeWindow: 0.7,
  cardFadeMax:    0.82,
} as const

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
      const progress = Math.max(0, Math.min(1, (-top) / (height * HERO_LAYOUT.cardFadeWindow)))
      setCardOpacity(1 - progress * HERO_LAYOUT.cardFadeMax)

      // Parallax — desktop only. Translate <img> against scroll direction.
      // top is positive when section is below viewport, negative when scrolled past.
      if (!isMobile && imgRef.current) {
        const translateY = -top * HERO_LAYOUT.parallaxMagnitude
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
          minHeight:  isMobile ? HERO_LAYOUT.minHeightMobile : HERO_LAYOUT.minHeightDesktop,
          overflow:   'hidden',                // contain the overscanned <img>
          display:    'flex',
          alignItems: 'center',
        }}
      >
        {/* Hero image — real <img> for LCP prioritization. */}
        {/* Overscanned so parallax translation never reveals edges. */}
        <img
          ref={imgRef}
          src={heroImageSrc}
          alt={heroImageAlt}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          style={{
            position:       'absolute',
            top:            isMobile ? HERO_LAYOUT.imageTopMobile : HERO_LAYOUT.imageTopDesktop,
            left:           0,
            width:          '100%',
            height:         isMobile ? HERO_LAYOUT.imageHeightMobile : HERO_LAYOUT.imageHeightDesktop,
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
            position:      'absolute',
            inset:         0,
            background:    IMMERSE_HERO.vignette,
            zIndex:        1,
            pointerEvents: 'none',
          }}
        />

        {/* Overlay layer 2 — vertical gradient */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            background:    IMMERSE_HERO.overlayVertical,
            zIndex:        2,
            pointerEvents: 'none',
          }}
        />

        {/* Overlay layer 3 — side gradient (left-biased darken) */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            background:    IMMERSE_HERO.overlaySide,
            zIndex:        3,
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
              border:               IMMERSE_HERO.glassBorder,
              borderRadius:         IMMERSE_HERO.glassRadius,
              background:           IMMERSE_HERO.glassBackground,
              backdropFilter:       IMMERSE_HERO.glassBlur,
              WebkitBackdropFilter: IMMERSE_HERO.glassBlur,
              boxShadow:            IMMERSE_HERO.glassShadow,
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
                  fontFamily:   FONTS.serif,
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
                fontFamily:    FONTS.serif,
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
                    transition: `opacity 0.7s ease ${100 + i * 55}ms, transform 0.7s ${IMMERSE_HERO.titleStaggerEasing} ${100 + i * 55}ms`,
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
                  color:          IMMERSE_HERO.ctaPrimaryFg,
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
                    border:         `1px solid ${IMMERSE_HERO.ctaGhostBorder}`,
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
                  border:         `1px solid ${IMMERSE_HERO.ctaGhostBorderStrong}`,
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