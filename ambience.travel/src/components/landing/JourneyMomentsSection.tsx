/* JourneyMomentsSection.tsx
 * Four journey moment cards — dark themed to match DarkCTASection pattern.
 * bg: C.bgDark (#171917), cards: rgba(255,255,255,0.05) / border rgba(255,255,255,0.12)
 * Text hierarchy mirrors DarkCTASection: #F7F4EE / 0.72 / 0.46
 */

import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

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

export default function JourneyMomentsSection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section
      ref={ref}
      style={{
        padding:    'clamp(56px,8vw,104px) clamp(20px,5vw,48px)',
        background: C.bgDark,
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
        {/* Left — section header */}
        <div style={{ maxWidth: 520 }}>
          <p
            style={{
              fontSize:      11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color:         'rgba(255,255,255,0.46)',
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
              color:         '#F7F4EE',
              ...fadeUp(visible, 100),
            }}
          >
            Well-designed travel starts long before arrival.
          </h2>
          <p
            style={{
              fontSize:   16,
              lineHeight: 1.8,
              color: C.lightText,
              ...fadeUp(visible, 200),
            }}
          >
            The best journeys do not need to announce themselves. They feel calm, supported, and well-judged from the very beginning.
          </p>
        </div>

        {/* Right — moment cards */}
        <div
          style={{
            display:             'grid',
            gap:                 16,
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          }}
        >
          {items.map((item, i) => (
            <div
              key={item.title}
              style={{
                ...fadeUp(visible, 120 + i * 90),
                borderRadius: 28,
                border:       '1px solid rgba(255,255,255,0.12)',
                background:   'rgba(255,255,255,0.05)',
                padding:      24,
              }}
            >
              <p
                style={{
                  fontSize:      11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color:         'rgba(255,255,255,0.46)',
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
                  color:         '#F7F4EE',
                  marginBottom:  12,
                }}
              >
                {item.title}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.lightText }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}