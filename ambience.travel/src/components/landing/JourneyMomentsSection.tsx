/* JourneyMomentsSection.tsx
 * Four journey moment cards — dark themed.
 * Animations:
 * - Cards dealt left-to-right driven by scroll progress
 * - Each card slides from left with slight rotation, settles as it lands
 * - Ambient: subtle gold border rotates around each card in sequence (no label pulse)
 * - Hover: border brighten
 */

import { useEffect, useState } from 'react'
import { C, DARK } from '../../lib/landingTypes'
import { fadeUp, useScrollProgress, useVisible } from './LandingComponents'

const items = [
  {
    title: 'Before Departure',
    text:  'Clear recommendations, thoughtful pacing, and a planning process handled with calm efficiency.',
  },
  {
    title: 'Arrival',
    text:  'Smooth transitions, well-chosen welcomes, and less friction where it matters most.',
  },
  {
    title: 'During the Stay',
    text:  'Responsive, discreet support shaped around the guest\'s preferences, habits, and priorities.',
  },
  {
    title: 'Afterward',
    text:  'Travel remembered not only for where you went, but for how well it all came together.',
  },
]

const CARD_THRESHOLDS = [0.20, 0.38, 0.56, 0.74]
const PULSE_INTERVAL  = 2400

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function MomentCard({
  item,
  index,
  progress,
  glowing,
}: {
  item:     typeof items[0]
  index:    number
  progress: number
  glowing:  boolean
}) {
  const [hovered, setHovered] = useState(false)

  const threshold    = CARD_THRESHOLDS[index]
  const cardProgress = Math.min(1, Math.max(0, (progress - threshold) / 0.18))
  const eased        = easeOut(cardProgress)
  const arrived      = cardProgress >= 1

  const translateX     = (1 - eased) * 30
  const translateY     = (1 - eased) * -18
  const rotate         = (1 - eased) * 14
  const opacity        = Math.min(1, eased * 1.4)
  const baseTransform  = `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg)`
  const hoverTransform = 'translateX(0px) translateY(-3px) rotate(0deg)'

  // Border: gold when glowing, slightly brighter on hover, default otherwise
  const borderColor = glowing
    ? `rgba(201,184,142,0.55)`
    : hovered && arrived
    ? '#4A4D4A'
    : DARK.cardBorder

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 28,
        border:       `1px solid ${borderColor}`,
        background:   hovered && arrived ? '#272927' : DARK.cardBg,
        padding:      24,
        opacity,
        transform:    arrived && hovered ? hoverTransform : baseTransform,
        boxShadow:    glowing
          ? '0 0 0 1px rgba(201,184,142,0.12), 0 16px 40px rgba(0,0,0,0.28)'
          : hovered && arrived
          ? '0 16px 40px rgba(0,0,0,0.35)'
          : 'none',
        transition:   arrived
          ? 'border-color 0.6s ease, background 0.3s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.6s ease'
          : 'none',
        cursor:       'default',
        willChange:   'transform, opacity',
      }}
    >
      <p
        style={{
          fontSize:      11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color:         DARK.label,
          marginBottom:  14,
        }}
      >
        Journey moment
      </p>
      <h3
        style={{
          fontSize:      22,
          fontWeight:    600,
          letterSpacing: '-0.03em',
          color:         DARK.text,
          marginBottom:  12,
        }}
      >
        {item.title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: DARK.body }}>
        {item.text}
      </p>
    </div>
  )
}

export default function JourneyMomentsSection() {
  const { ref: sectionRef, visible } = useVisible(0.05)
  const { ref: gridRef, progress }   = useScrollProgress()
  const [glowIdx, setGlowIdx]        = useState(0)

  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setGlowIdx(i => (i + 1) % items.length), PULSE_INTERVAL)
    return () => clearInterval(t)
  }, [visible])

  return (
    <section
      ref={sectionRef}
      style={{
        padding:    'clamp(56px,8vw,104px) clamp(20px,5vw,48px)',
        backgroundColor:    C.bgDark,
        backgroundImage:    'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(201,184,142,0.04) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 80% 70%, rgba(127,222,255,0.02) 0%, transparent 70%)',
        backgroundSize:     '200% 200%',
        backgroundPosition: '0% 0%',
        animation:          'journeyGradientShift 12s ease-in-out infinite alternate',
      }}
    >
      <div
        style={{
          maxWidth:            1280,
          margin:              '0 auto',
          display:             'grid',
          gap:                 40,
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p
            style={{
              fontSize:      11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color:         DARK.label,
              marginBottom:  16,
              ...fadeUp(visible, 0),
            }}
          >
            The journey is felt in the details
          </p>
          <h2
            style={{
              fontSize:      'clamp(28px,4vw,52px)',
              fontWeight:    600,
              letterSpacing: '-0.04em',
              marginBottom:  18,
              color:         DARK.text,
              ...fadeUp(visible, 100),
            }}
          >
            Well-designed travel starts long before arrival.
          </h2>
          <p
            style={{
              fontSize:   16,
              lineHeight: 1.8,
              color:      DARK.body,
              ...fadeUp(visible, 200),
            }}
          >
            The best journeys do not need to announce themselves. They feel calm, supported, and well-judged from the very beginning.
          </p>
        </div>

        <div
          ref={gridRef}
          style={{
            display:             'grid',
            gap:                 16,
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          }}
        >
          {items.map((item, i) => (
            <MomentCard
              key={item.title}
              item={item}
              index={i}
              progress={progress}
              glowing={glowIdx === i}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes journeyGradientShift {
          0%   { background-position: 0% 0% }
          100% { background-position: 100% 100% }
        }
      `}</style>
    </section>
  )
}