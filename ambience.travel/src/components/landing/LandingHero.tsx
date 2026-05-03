// src/components/landing/LandingHero.tsx
// Full-bleed hero for the travel landing page.
// Mirrors the immerse hero pattern (parallax <img>, three overlay layers, glass card)
// but scoped down — no guest name, no nights label, no CTAs.
//
// Image: Soneva Jani Maldives.

import { useEffect, useRef, useState } from 'react'
import { ID, IMMERSE_HERO, FONTS } from '../../lib/landingColors'
import { useImmerseMobile, useImmerseVisible, immerseFadeUp } from '../immerse/ImmerseComponents'

const HERO_LAYOUT = {
  minHeightMobile:    640,
  minHeightDesktop:   820,
  parallaxMagnitude:  0.8,
  imageHeightDesktop: '110%',
  imageHeightMobile:  '100%',
  imageTopDesktop:    '-10%',
  imageTopMobile:     0,
  cardFadeWindow:     0.7,
  cardFadeMax:        0.82,
} as const

const HERO_IMAGE_SRC = 'https://rjobcbpnhymuczjhqzmh.supabase.co/storage/v1/object/public/ambience-assets/immerse/io/maldives/sonevajani1.webp'
const HERO_IMAGE_ALT = 'Soneva Jani, Maldives — overwater villa at twilight'

export default function LandingHero() {
  const { ref, visible } = useImmerseVisible(0.05)
  const isMobile         = useImmerseMobile()
  const sectionRef       = useRef<HTMLElement>(null)
  const imgRef           = useRef<HTMLImageElement>(null)
  const [cardOpacity, setCardOpacity] = useState(1)

  useEffect(() => {
    let rafId = 0
    let ticking = false

    function update() {
      const el = sectionRef.current
      if (!el) { ticking = false; return }
      const { top, height } = el.getBoundingClientRect()

      const progress = Math.max(0, Math.min(1, (-top) / (height * HERO_LAYOUT.cardFadeWindow)))
      setCardOpacity(1 - progress * HERO_LAYOUT.cardFadeMax)

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

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMobile])

    const titleLine1 = 'Private Travel.'
    const titleLine2 = 'Well Designed.'

  return (
    <section ref={sectionRef} style={{ borderTop: 'none', padding: 0, margin: 0 }}>
      <div
        style={{
          position:   'relative',
          minHeight:  isMobile ? HERO_LAYOUT.minHeightMobile : HERO_LAYOUT.minHeightDesktop,
          overflow:   'hidden',
          display:    'flex',
          alignItems: 'center',
        }}
      >
        <img
          ref={imgRef}
          src={HERO_IMAGE_SRC}
          alt={HERO_IMAGE_ALT}
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
            objectPosition: 'center 30%',
            zIndex:         0,
            willChange:     isMobile ? 'auto' : 'transform',
          }}
        />

        <div aria-hidden style={{ position: 'absolute', inset: 0, background: IMMERSE_HERO.vignette,        zIndex: 1, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: IMMERSE_HERO.overlayVertical, zIndex: 2, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: IMMERSE_HERO.overlaySide,     zIndex: 3, pointerEvents: 'none' }} />

        <div
          style={{
            position: 'relative',
            zIndex:   4,
            width:    'min(1220px, calc(100% - 36px))',
            margin:   '0 auto',
            padding:  '44px 0',
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
            {/* Eyebrow */}
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
              A better way to experience the world
            </div>

            {/* Headline */}
            <div
              style={{
                fontSize:      isMobile ? 44 : 'clamp(50px,6vw,86px)',
                lineHeight:    0.98,
                letterSpacing: '-0.02em',
                fontWeight:    400,
                fontFamily:    FONTS.serif,
                marginBottom:  22,
                color:         ID.text,
              }}
            >
              {/* Line 1 — Private Travel. */}
                <div>
                    {titleLine1.split(' ').map((word, i) => (
                    <span
                        key={`l1-${i}`}
                        style={{
                        display:     'inline-block',
                        marginRight: '0.22em',
                        opacity:     visible ? 1 : 0,
                        transform:   visible ? 'translateY(0)' : 'translateY(14px)',
                        transition:  `opacity 0.7s ease ${100 + i * 55}ms, transform 0.7s ${IMMERSE_HERO.titleStaggerEasing} ${100 + i * 55}ms`,
                        willChange:  'opacity, transform',
                        }}
                    >
                        {word}
                    </span>
                    ))}
                </div>

                {/* Line 2 — Well Designed. (continues stagger from line 1) */}
                <div>
                    {titleLine2.split(' ').map((word, i) => {
                    const delay = 100 + (titleLine1.split(' ').length + i) * 55
                    return (
                        <span
                        key={`l2-${i}`}
                        style={{
                            display:     'inline-block',
                            marginRight: '0.22em',
                            opacity:     visible ? 1 : 0,
                            transform:   visible ? 'translateY(0)' : 'translateY(14px)',
                            transition:  `opacity 0.7s ease ${delay}ms, transform 0.7s ${IMMERSE_HERO.titleStaggerEasing} ${delay}ms`,
                            willChange:  'opacity, transform',
                        }}
                        >
                        {word}
                        </span>
                    )
                    })}
                </div>
            </div>

            {/* Subheadline */}
            <p
              style={{
                color:      ID.muted,
                fontSize:   isMobile ? 16 : 18,
                lineHeight: 1.84,
                maxWidth:   640,
                margin:     0,
                ...immerseFadeUp(visible, 240),
              }}
            >
                Shaped for how you live, not for how things sell.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}