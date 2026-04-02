/* ExperienceTypesSection.tsx
 * Six experience type cards with images.
 * Animations:
 * - Cards dealt from a hand — scroll-progress driven
 * - Each card starts rotated ~0.6deg + slightly high, unwinds and drops flat as it lands
 * - Motion is rotation-led, not slide-led (subtle horizontal, more angular)
 * - Hover: image scale + lift + border darken
 * Note: outer wrapper owns shadow; inner wrapper clips image.
 */

import { useState } from 'react'
import { C } from '../../lib/landingTypes'
import { fadeUp, useScrollProgress, useVisible } from './LandingComponents'

const items = [
  {
    title: 'Private Family Travel',
    text:  'Well-considered journeys for families who value space, ease, privacy, and a smoother rhythm from start to finish.',
    image: 'https://cache.marriott.com/is/image/marriotts7prod/rz-mlera-welcome-to-the-maldives-29354:Wide-Hor?wid=1100&fit=constrain',
  },
  {
    title: 'Extended Private Journeys',
    text:  'Multi-stop itineraries requiring careful coordination, strong judgement, and consistency across every stage.',
    image: 'https://www.fourseasons.com/alt/img-opt/~80.1860.0,0000-156,2500-3000,0000-1687,5000/publish/content/dam/fourseasons/images/web/SBT/SBT_407_original.jpg',
  },
  {
    title: 'Wellness-Led Escapes',
    text:  'Travel shaped around restoration, privacy, clean living, and a deeper sense of balance.',
    image: 'https://burgenstockresort.com/uploads/media/2880x1800-cover-page/00/1430-Alpine%20Spa_Exterior_Infinity%20Edge%20Pool%203_web.jpg?v=2-5',
  },
  {
    title: 'Suites, Villas & Residential-Style Stays',
    text:  'Accommodations chosen for how they live and feel, not just how they appear on paper.',
    image: 'https://images.prismic.io/lvmh-chevalblanc/Z-vdqXdAxsiBwLEY_WebRGB-ChevalBlancParis_SuiteEiffel_VincentLeroux.jpg?auto=format%2Ccompress&fit=max&w=1100',
  },
  {
    title: 'Signature City Stays',
    text:  'Refined urban travel with standout hotels, well-managed access, and a sharper sense of place.',
    image: 'https://symphony.cdn.tambourine.com/the-setai-miami-beach/media/the-setai-miami-beach-penthouse-bedroom-62ad0d35f1eac.jpg',
  },
  {
    title: 'Couples & Celebrations',
    text:  'Anniversaries, milestone escapes, and romantic journeys designed with taste, atmosphere, and discretion.',
    image: 'https://www.fourseasons.com/alt/img-opt/~80.1860.0,0000-312,5000-3000,0000-1687,5000/publish/content/dam/fourseasons/images/web/KOH/KOH_1422_original.jpg',
  },
]

const CARD_THRESHOLDS = [0.15, 0.27, 0.39, 0.51, 0.63, 0.75]

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function ExperienceCard({
  item,
  index,
  progress,
}: {
  item:     typeof items[0]
  index:    number
  progress: number
}) {
  const [hovered, setHovered] = useState(false)

  const threshold    = CARD_THRESHOLDS[index]
  const cardProgress = Math.min(1, Math.max(0, (progress - threshold) / 0.433))
  const eased        = easeOut(cardProgress)
  const arrived      = cardProgress >= 1

  // Rotation-led deal: starts ~14deg, unwinds to 0
  // Small horizontal (30px) + slight upward start (-18px) that drops to 0
  const rotate     = (1 - eased) * 0.4
  const translateX = (1 - eased) * 30
  const translateY = (1 - eased) * -18
  const opacity    = Math.min(1, eased * 1.4) // fade in slightly faster than motion

  const dealTransform  = `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg)`
  const hoverTransform = 'translateX(0px) translateY(-4px) rotate(0deg)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity,
        transform:     arrived && hovered ? hoverTransform : dealTransform,
        boxShadow:     hovered && arrived
          ? '0 20px 48px rgba(0,0,0,0.12)'
          : '0 10px 28px rgba(0,0,0,0.05)',
        borderRadius:  28,
        transition:    arrived
          ? 'box-shadow 0.3s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)'
          : 'none',
        cursor:        'default',
        willChange:    'transform, opacity',
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          overflow:      'hidden',
          borderRadius:  28,
          border:        `1px solid ${hovered && arrived ? C.border : C.lightCardBorder}`,
          background:    C.lightCardBg,
          transition:    'border-color 0.3s ease',
          display:       'flex',
          flexDirection: 'column',
          flex:          1,
        }}
      >
        <div style={{ position: 'relative', height: 224, overflow: 'hidden' }}>
          <img
            src={item.image}
            alt={item.title}
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              transform:  hovered && arrived ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>
        <div style={{ padding: 24 }}>
          <h3
            style={{
              fontSize:      22,
              fontWeight:    600,
              letterSpacing: '-0.03em',
              color:         C.text,
              marginBottom:  12,
            }}
          >
            {item.title}
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: C.muted }}>{item.text}</p>
        </div>
      </div>
    </div>
  )
}

export default function ExperienceTypesSection() {
  const { ref: sectionRef, visible } = useVisible(0.05)
  const { ref: gridRef, progress }   = useScrollProgress()

  return (
    <section
      ref={sectionRef}
      style={{
        padding:      'clamp(56px,8vw,104px) clamp(20px,5vw,48px)',
        background:   C.bgAlt,
        borderTop:    `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
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
            How guests may travel
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
            Different journeys, one consistent standard.
          </h2>
          <p
            style={{
              fontSize:   16,
              lineHeight: 1.8,
              color:      C.muted,
              ...fadeUp(visible, 200),
            }}
          >
            From refined family travel and milestone escapes to wellness-led stays and complex private itineraries, every journey is shaped around the guest rather than a formula.
          </p>
        </div>

        <div
          ref={gridRef}
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
            gap:                 24,
          }}
        >
          {items.map((item, i) => (
            <ExperienceCard
              key={item.title}
              item={item}
              index={i}
              progress={progress}
            />
          ))}
        </div>
      </div>
    </section>
  )
}