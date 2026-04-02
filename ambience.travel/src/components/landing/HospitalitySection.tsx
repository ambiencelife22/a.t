import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

const items = [
  {
    title: 'Hotels, Villas & Residences',
    text: 'Selected for privacy, service, atmosphere, and the overall quality of the guest experience — never reputation alone.',
    image:
      'https://www.aman.com/sites/default/files/styles/full_size_extra_large/public/2022-08/Aman%20New%20York%2C%20USA%20-%20Accommodation%2C%20Corner%20Suite%2C%20Living%20room.jpg?itok=CJcssJWS',
  },
  {
    title: 'Dining, Rhythm & Preferences',
    text: 'Recommendations shaped around how guests actually like to live, dine, and spend their time.',
    image:
      'https://www.hilton.com/im/en/LAXWAWA/1336939/beverly-hills-suite-seating.jpg?ch=4399&cw=7351&gravity=NorthWest&impolicy=crop&rh=900&rw=1400&xposition=0&yposition=167',
  },
  {
    title: 'Air, Ground & Seamless Support',
    text: 'The movement around the journey is handled with the same care as the stay itself: quietly and well.',
    image:
      'https://www.hilton.com/im/en/LAXWAWA/5326855/villa-balcony-315-alt.jpg?ch=4318&cw=7215&gravity=NorthWest&impolicy=crop&rh=900&rw=1400&xposition=0&yposition=164',
  },
]

export default function HospitalitySection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section ref={ref} style={{ padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)', background: C.bg }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 760, marginBottom: 40 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.faint, marginBottom: 16, ...fadeUp(visible, 0) }}>
            Chosen with discernment
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: 18, color: C.text, ...fadeUp(visible, 100) }}>
            A quieter kind of luxury — rooted in taste, fit, and how the experience lands.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.muted, ...fadeUp(visible, 200) }}>
            Recommendations are made for more than reputation alone. Privacy, atmosphere, service, pace, and the way a guest prefers to live all matter.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
          {items.map((item, i) => (
            <div key={item.title} style={{ ...fadeUp(visible, 120 + i * 90), overflow: 'hidden', borderRadius: 30, border: `1px solid ${C.border}`, background: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,0.05)' }}>
              <div style={{ height: 288, overflow: 'hidden' }}>
                <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: 28 }}>
                <h3 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: C.text, marginBottom: 14 }}>{item.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: '#5C625C' }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}