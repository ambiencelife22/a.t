import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

const cards = [
  {
    title: 'Suites, Villas & Private Stays',
    subtitle:
      'Places chosen for privacy, comfort, character, and how well they support the overall rhythm of the stay.',
    image:
      'https://www.aman.com/sites/default/files/styles/full_size_extra_large/public/2022-08/Aman%20New%20York%2C%20USA%20-%20Accommodation%2C%20Corner%20Suite%2C%20Living%20room.jpg?itok=CJcssJWS',
  },
  {
    title: 'Private Air & Seamless Arrivals',
    subtitle:
      'A seamless private air experience, with each journey arranged for comfort, discretion, and smooth coordination from FBO to FBO.',
    image:
      'https://images.prismic.io/flexjet-marketing/aRdKe7pReVYa4fls_post-67346-image-1.jpg',
  },
  {
    title: 'Dining with Taste',
    subtitle:
      'Dining recommendations shaped around personal preference, setting, and the tone of the trip.',
    image:
      'https://hide.co.uk/wp-content/uploads/2026/03/Easter-egg-3.jpg',
  },
  {
    title: 'Wellness & Restorative Travel',
    subtitle:
      'Time away designed to feel calm and balancing, with space for rest, privacy, and a more grounded pace.',
    image:
      'https://img.destination.one/remote/.webp?height=900&mode=crop&quality=90&scale=both&url=https%3A%2F%2Fdam.destination.one%2F2462791%2F8841094f585370451b64cd383cd087feae735518117fefddb06da2eb1aab5c87%2Fcsm_chenot_palace_weggis_restaurant_view_2fd70b472c-jpg.jpg&width=1400',
  },
]

export default function EditorialSection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section
      ref={ref}
      style={{
        padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)',
        background: C.bgAlt,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 720, marginBottom: 40 }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: C.faint,
              marginBottom: 16,
              ...fadeUp(visible, 0),
            }}
          >
            A quieter standard
          </p>

          <h2
            style={{
              fontSize: 'clamp(28px,4vw,52px)',
              fontWeight: 600,
              letterSpacing: '-0.04em',
              marginBottom: 18,
              color: C.text,
              ...fadeUp(visible, 100),
            }}
          >
            Exceptional stays, seamless movement, and experiences tailored to your preferences. 
          </h2>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.8,
              color: C.muted,
              ...fadeUp(visible, 200),
            }}
          >
            A private standard of travel shaped around comfort, discretion, and the details that make a journey feel effortless.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
            gap: 24,
          }}
        >
          {cards.map((item, i) => (
            <div
              key={item.title}
              style={{
                ...fadeUp(visible, 120 + i * 90),
                overflow: 'hidden',
                borderRadius: 28,
                border: `1px solid ${C.border}`,
                background: '#fff',
                boxShadow: '0 12px 32px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
                <img
                  src={item.image}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div style={{ padding: 24 }}>
                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    color: C.text,
                    marginBottom: 12,
                  }}
                >
                  {item.title}
                </h3>

                <p style={{ fontSize: 14, lineHeight: 1.75, color: C.muted }}>
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}