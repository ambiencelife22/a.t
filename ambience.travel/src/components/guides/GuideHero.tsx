// GuideHero.tsx — full-bleed hero for guide pages
// Mirrors the LandingHero + ImmerseHero pattern: parallax <img>, three
// overlay layers (vignette, overlayVertical, overlaySide), glass card
// with eyebrow + headline + intro.
//
// What it owns: hero chrome, parallax + scroll fade behavior, glass card.
// What it does not own: image source resolution, copy resolution, page chrome.
//   Caller (DiningGuidePage) passes resolved values; it does the overlay
//   override → frontend default ?? chain.
//
// Shared across all guide variants (dining, experiences, hotels). Variant-
// specific copy + image come in as props; the hero shape is identical.
//
// Image rendering:
//   - imageSrc populated → renders <img> with parallax + overlay stack
//   - imageSrc null → renders solid-color hero with glass card on top
//
// Glass card position: lower-third aligned. Guide pages are utilitarian
// content; the hero should set tone without dominating.
//
// Last updated: S36 — Removed negative-margin viewport escape (marginLeft/Right:
//   calc(50% - 50vw)). DiningGuidePage now renders this hero outside its
//   constrained <main> container, so the hero is naturally full-width to its
//   parent (GuideLayout > children). The S35 escape trick assumed a
//   full-width parent that wasn't there. Hero now plays nice as a sibling.
// Prior: S35 — Refactored from two-column gradient-panel layout to full-bleed
//   parallax pattern.

import { useEffect, useRef, useState } from 'react'
import { ID, IMMERSE_HERO, FONTS } from '../../lib/landingColors'
import { useImmerseMobile, useImmerseVisible, immerseFadeUp } from '../immerse/ImmerseComponents'

const HERO_LAYOUT = {
  minHeightMobile:    520,
  minHeightDesktop:   640,
  parallaxMagnitude:  0.6,
  imageHeightDesktop: '110%',
  imageHeightMobile:  '100%',
  imageTopDesktop:    '-10%',
  imageTopMobile:     0,
  cardFadeWindow:     0.7,
  cardFadeMax:        0.82,
} as const

interface GuideHeroProps {
  eyebrow: string
  headline: string
  intro: string
  imageSrc?: string | null
  imageAlt?: string | null
}

export function GuideHero({
  eyebrow,
  headline,
  intro,
  imageSrc,
  imageAlt,
}: GuideHeroProps) {
  const { ref, visible } = useImmerseVisible(0.05)
  const isMobile = useImmerseMobile()
  const sectionRef = useRef<HTMLElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [cardOpacity, setCardOpacity] = useState(1)

  const hasImage = !!imageSrc && imageSrc.trim().length > 0

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

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        marginBottom: 34,
      }}
    >
      <div
        style={{
          position:   'relative',
          minHeight:  isMobile ? HERO_LAYOUT.minHeightMobile : HERO_LAYOUT.minHeightDesktop,
          overflow:   'hidden',
          display:    'flex',
          alignItems: 'flex-end',
          background: hasImage ? 'transparent' : ID.panel2,
        }}
      >
        {hasImage && (
          <img
            ref={imgRef}
            src={imageSrc!}
            alt={imageAlt ?? headline}
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
              objectPosition: 'center 40%',
              zIndex:         0,
              willChange:     isMobile ? 'auto' : 'transform',
            }}
          />
        )}

        <div aria-hidden style={{ position: 'absolute', inset: 0, background: IMMERSE_HERO.vignette,        zIndex: 1, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: IMMERSE_HERO.overlayVertical, zIndex: 2, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: IMMERSE_HERO.overlaySide,     zIndex: 3, pointerEvents: 'none' }} />

        <div
          style={{
            position: 'relative',
            zIndex:   4,
            width:    'min(1220px, calc(100% - 36px))',
            margin:   '0 auto',
            padding:  isMobile ? '0 0 32px' : '0 0 56px',
          }}
        >
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            style={{
              width:                'min(720px, 100%)',
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
            <div
              style={{
                color:         ID.gold,
                fontSize:      isMobile ? 12 : 13,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight:    700,
                marginBottom:  18,
                ...immerseFadeUp(visible, 0),
              }}
            >
              {eyebrow}
            </div>

            <h1
              style={{
                fontSize:      isMobile ? 38 : 'clamp(46px, 5.4vw, 72px)',
                lineHeight:    1.0,
                letterSpacing: '-0.02em',
                fontWeight:    400,
                fontFamily:    FONTS.serif,
                margin:        '0 0 20px',
                color:         ID.text,
                ...immerseFadeUp(visible, 120),
              }}
            >
              {headline}
            </h1>

            <p
              style={{
                color:      ID.muted,
                fontSize:   isMobile ? 15 : 17,
                lineHeight: 1.7,
                maxWidth:   600,
                margin:     0,
                ...immerseFadeUp(visible, 240),
              }}
            >
              {intro}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}