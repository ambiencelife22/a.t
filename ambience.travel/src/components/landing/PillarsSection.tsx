/* PillarsSection.tsx
 * Three-pillar explainer + full-bleed editorial image below.
 * Animations:
 * - Scroll-triggered fadeUp on all elements (staggered)
 * - Parallax on pillar grid as a group (scrolls at 60% speed)
 * - Hover: lift + border gold + subtle 3D tilt toward cursor (max 4deg)
 * - Parallax on editorial image (existing)
 */

import { useEffect, useRef, useState } from 'react'
import { C, OVERLAY } from '../../lib/landingTypes'
import { fadeUp, useVisible, useScrollParallax } from './LandingComponents'

const pillars = [
  {
    title: 'Private Travel Design',
    text: 'Journeys composed around personal preferences, pace, and the style of experience each guest values most.',
  },
  {
    title: 'Discreet Coordination',
    text: 'A quieter, more attentive layer of support across planning, movement, stays, and key details throughout the journey.',
  },
  {
    title: 'Personalised Concierge',
    text: 'Tailored assistance shaped by trust, discretion, and an understanding that true luxury is never one-size-fits-all.',
  },
]

function PillarCard({ pillar, delay, visible }: { pillar: typeof pillars[0], delay: number, visible: boolean }) {
  const cardRef                   = useRef<HTMLDivElement>(null)
  const [hovered, setHovered]     = useState(false)
  const [tilt,    setTilt]        = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el   = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx   = rect.left + rect.width  / 2
    const cy   = rect.top  + rect.height / 2
    const dx   = (e.clientX - cx) / (rect.width  / 2)  // -1 → +1
    const dy   = (e.clientY - cy) / (rect.height / 2)  // -1 → +1
    setTilt({ x: dy * -4, y: dx * 4 })                 // max 4deg
  }

  const handleMouseLeave = () => {
    setHovered(false)
    setTilt({ x: 0, y: 0 })
  }

  const tiltTransform = hovered
    ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-4px)`
    : 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)'

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...fadeUp(visible, delay),
        borderRadius:    28,
        border:          `1px solid ${hovered ? C.gold : C.border}`,
        background:      '#fff',
        padding:         28,
        boxShadow:       hovered
          ? '0 20px 48px rgba(0,0,0,0.10), 0 0 0 1px rgba(201,184,142,0.12)'
          : '0 12px 32px rgba(0,0,0,0.05)',
        transform:       tiltTransform,
        transition:      hovered
          ? 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.12s ease'
          : 'border-color 0.35s ease, box-shadow 0.35s ease, transform 0.55s cubic-bezier(0.16,1,0.3,1)',
        cursor:          'default',
        willChange:      'transform',
      }}
    >
      <p
        style={{
          fontSize:      11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color:         hovered ? C.gold : '#8A9487',
          marginBottom:  14,
          transition:    'color 0.3s ease',
        }}
      >
        Core pillar
      </p>
      <h3
        style={{
          fontSize:      28,
          fontWeight:    600,
          letterSpacing: '-0.03em',
          color:         C.text,
          marginBottom:  14,
        }}
      >
        {pillar.title}
      </h3>
      <p style={{ fontSize: 16, lineHeight: 1.75, color: '#5C625C' }}>
        {pillar.text}
      </p>
    </div>
  )
}

export default function PillarsSection() {
  const { ref, visible }              = useVisible(0.12)
  const { ref: imgRef,   offset }     = useScrollParallax(0.06)
  const { ref: gridRef,  offset: go } = useScrollParallax(0.035)

  return (
    <section
      ref={ref}
      style={{
        padding:      'clamp(56px,8vw,104px) clamp(20px,5vw,48px)',
        background:   C.bg,
        borderTop:    `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {/* Section header */}
        <div style={{ maxWidth: 760, marginBottom: 40 }}>
          <p
            style={{
              fontSize:      11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color:         C.faint,
              marginBottom:  16,
              ...fadeUp(visible, 0),
            }}
          >
            Why ambience.travel
          </p>
          <h2
            style={{
              fontSize:      'clamp(28px,4vw,52px)',
              fontWeight:    600,
              letterSpacing: '-0.04em',
              marginBottom:  18,
              color:         C.text,
              ...fadeUp(visible, 100),
            }}
          >
            Not merely where you go... it's how the experience is held.
          </h2>
          <p
            style={{
              fontSize:   16,
              lineHeight: 1.8,
              color:      C.muted,
              ...fadeUp(visible, 200),
            }}
          >
            Designed for guests who want more than access alone: taste, discretion, ease, and a level of service that feels quietly assured throughout.
          </p>
        </div>

        {/* Pillars grid — subtle parallax as a group */}
        <div
          ref={gridRef}
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
            gap:                 24,
            marginBottom:        48,
            transform:           `translateY(${go}px)`,
            transition:          'transform 0.1s linear',
            willChange:          'transform',
          }}
        >
          {pillars.map((pillar, i) => (
            <PillarCard key={pillar.title} pillar={pillar} delay={120 + i * 90} visible={visible} />
          ))}
        </div>

        {/* Editorial image — parallax */}
        <div
          style={{
            ...fadeUp(visible, 420),
            position:     'relative',
            borderRadius: 36,
            overflow:     'hidden',
            border:       `1px solid ${C.border}`,
            boxShadow:    '0 24px 70px rgba(0,0,0,0.10)',
            minHeight:    'clamp(360px, 52vw, 680px)',
            background:   '#0D1A2A',
          }}
        >
          <div
            ref={imgRef}
            style={{
              position:   'absolute',
              inset:      '-8% 0',
              transform:  `translateY(${offset}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            <img
              src='/landing/yacht-charter.webp'
              alt='Private superyacht charter — Mediterranean'
              style={{
                width:     '100%',
                height:    '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Gradient overlay */}
          <div
            style={{
              position:   'absolute',
              inset:      0,
              background: 'linear-gradient(180deg, rgba(23,25,23,0.06) 0%, rgba(23,25,23,0.12) 38%, rgba(23,25,23,0.34) 100%)',
              zIndex:     1,
            }}
          />

          {/* Bottom row — pill left, caption card right */}
          <div
            style={{
              position:       'absolute',
              left:           24,
              right:          24,
              bottom:         24,
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'flex-end',
              gap:            16,
              flexWrap:       'wrap',
              zIndex:         2,
            }}
          >
            <div
              style={{
                padding:        '12px 16px',
                borderRadius:   999,
                background:     C.bgCard,
                backdropFilter: 'blur(10px)',
                border:         `1px solid ${OVERLAY.pillBorder}`,
                fontSize:       12,
                color:          '#4F564F',
                letterSpacing:  '0.08em',
                textTransform:  'uppercase',
              }}
            >
              Yacht &amp; sea
            </div>

            <div
              style={{
                maxWidth:       340,
                padding:        '16px 18px',
                borderRadius:   24,
                background:     OVERLAY.cardBg,
                backdropFilter: 'blur(14px)',
                border:         `1px solid ${OVERLAY.cardBorder}`,
                color:          OVERLAY.cardText,
              }}
            >
              <div
                style={{
                  fontSize:      10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color:         OVERLAY.cardLabel,
                  marginBottom:  8,
                }}
              >
                Private charter
              </div>
              <div
                style={{
                  fontSize:      18,
                  lineHeight:    1.5,
                  letterSpacing: '-0.02em',
                }}
              >
                Every detail arranged before you board. The sea, entirely yours.
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}