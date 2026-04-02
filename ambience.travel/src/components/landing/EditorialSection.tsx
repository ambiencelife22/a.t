/* EditorialSection.tsx
 * Four editorial cards — warm light bg.
 * Animations:
 * - Staggered fade-in reveal — opacity only, no translate
 * - Hover: lift + image scale + border darken + shadow deepen
 * Note: outer wrapper owns shadow; inner wrapper clips image.
 */

import { useState } from 'react'
import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

const cards = [
  {
    title:    'Suites, Villas & Private Stays',
    subtitle: 'Places chosen for privacy, comfort, character, and how well they support the overall rhythm of the stay.',
    image:    'https://assets.hyatt.com/content/dam/hyatt/hyattdam/images/2020/08/14/1631/Park-Hyatt-Niseko-Hanazono-P095-Three-Bedroom-Residence.jpg/Park-Hyatt-Niseko-Hanazono-P095-Three-Bedroom-Residence.16x9.jpg?imwidth=1100',
  },
  {
    title:    'Private Air & Seamless Arrivals',
    subtitle: 'A seamless private air experience, with each journey arranged for comfort, discretion, and smooth coordination from FBO to FBO.',
    image:    'https://images.prismic.io/flexjet-marketing/aRdKe7pReVYa4fls_post-67346-image-1.jpg',
  },
  {
    title:    'Dining with Taste',
    subtitle: 'Dining recommendations shaped around personal preference, setting, and the tone of the trip.',
    image:    'https://hide.co.uk/wp-content/uploads/2026/03/Easter-egg-3.jpg',
  },
  {
    title:    'Wellness & Restorative Travel',
    subtitle: 'Time away designed to feel calm and balancing, with space for rest, privacy, and a more grounded pace.',
    image:    'https://www.thedoldergrand.com/app/uploads/2020/08/HIBR_D_00198529_send_web.jpg',
  },
]

function EditorialCard({ item, delay, visible }: { item: typeof cards[0], delay: number, visible: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    // Outer — shadow, no overflow clip
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity:      visible ? 1 : 0,
        borderRadius: 28,
        boxShadow:    hovered
          ? '0 24px 56px rgba(0,0,0,0.11)'
          : '0 12px 32px rgba(0,0,0,0.05)',
        transform:    hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition:   `opacity 0.9s ease ${delay}ms, box-shadow 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)`,
        cursor:       'default',
        willChange:   'transform',
        height:       '100%',
        display:      'flex',
        flexDirection: 'column',
      }}
    >
      {/* Inner — clips image, owns border, stretches full height */}
      <div
        style={{
          overflow:      'hidden',
          borderRadius:  28,
          border:        `1px solid ${hovered ? C.border : 'rgba(0,0,0,0.07)'}`,
          background:    '#fff',
          transition:    'border-color 0.3s ease',
          display:       'flex',
          flexDirection: 'column',
          flex:          1,
        }}
      >
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
          <img
            src={item.image}
            alt={item.title}
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              transform:  hovered ? 'scale(1.04)' : 'scale(1)',
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
          <p style={{ fontSize: 14, lineHeight: 1.75, color: C.muted }}>
            {item.subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function EditorialSection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section
      ref={ref}
      style={{
        padding:    'clamp(56px,8vw,104px) clamp(20px,5vw,48px)',
        background: C.bgAlt,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 720, marginBottom: 40 }}>
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
            A quieter standard
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
            Exceptional stays, seamless movement, and experiences tailored to your preferences.
          </h2>

          <p
            style={{
              fontSize:   16,
              lineHeight: 1.8,
              color:      C.muted,
              ...fadeUp(visible, 200),
            }}
          >
            A private standard of travel shaped around comfort, discretion, and the details that make a journey feel effortless.
          </p>
        </div>

        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
            gap:                 24,
          }}
        >
          {cards.map((item, i) => (
            <EditorialCard key={item.title} item={item} delay={120 + i * 110} visible={visible} />
          ))}
        </div>
      </div>
    </section>
  )
}