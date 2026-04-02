import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

const items = [
  {
    title: 'Private Family Travel',
    text: 'Well-considered journeys for families who value space, ease, privacy, and a smoother rhythm from start to finish.',
    image:
      'https://www.hilton.com/im/en/LAXWAWA/8005581/wabh-beverly-hills-2-queen-q2dg-room.jpg?ch=3590&cw=5999&gravity=NorthWest&impolicy=crop&rh=900&rw=1400&xposition=0&yposition=204',
  },
  {
    title: 'Couples & Celebrations',
    text: 'Anniversaries, milestone escapes, and romantic journeys designed with taste, atmosphere, and discretion.',
    image:
      'https://www.aman.com/sites/default/files/styles/full_size_extra_large/public/2022-12/Aman%20New%20York%2C%20USA%20-%20Corner%20Suite%202_0.jpg?itok=9yk-OWvo',
  },
  {
    title: 'Wellness-Led Escapes',
    text: 'Travel shaped around restoration, privacy, clean living, and a deeper sense of balance.',
    image:
      'https://img.destination.one/remote/.webp?height=900&mode=crop&quality=90&scale=both&url=https%3A%2F%2Fdam.destination.one%2F2462791%2F8841094f585370451b64cd383cd087feae735518117fefddb06da2eb1aab5c87%2Fcsm_chenot_palace_weggis_restaurant_view_2fd70b472c-jpg.jpg&width=1400',
  },
  {
    title: 'Signature City Stays',
    text: 'Refined urban travel with exceptional hotels, thoughtful access, and a sharper sense of place.',
    image:
      'https://www.hilton.com/im/en/LAXWAWA/1336939/beverly-hills-suite-seating.jpg?ch=4399&cw=7351&gravity=NorthWest&impolicy=crop&rh=900&rw=1400&xposition=0&yposition=167',
  },
  {
    title: 'Extended Private Journeys',
    text: 'Multi-stop itineraries requiring careful coordination, strong judgement, and consistency across every stage.',
    image:
      'https://www.hilton.com/im/en/LAXWAWA/5326855/villa-balcony-315-alt.jpg?ch=4318&cw=7215&gravity=NorthWest&impolicy=crop&rh=900&rw=1400&xposition=0&yposition=164',
  },
  {
    title: 'Suites, Villas & Residential-Style Stays',
    text: 'Exceptional accommodations chosen for how they live — not just how they look on paper.',
    image:
      'https://www.aman.com/sites/default/files/styles/full_size_extra_large/public/2022-08/Aman%20New%20York%2C%20USA%20-%20Accommodation%2C%20Corner%20Suite%2C%20Living%20room.jpg?itok=CJcssJWS',
  },
]

export default function ExperienceTypesSection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section ref={ref} style={{ padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)', background: '#F5F1EA', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 760, marginBottom: 40 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.faint, marginBottom: 16, ...fadeUp(visible, 0) }}>
            How guests may travel
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: 18, color: C.text, ...fadeUp(visible, 100) }}>
            Different journeys, one consistent standard.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.muted, ...fadeUp(visible, 200) }}>
            From refined family travel and milestone escapes to wellness-led stays and complex private itineraries, every journey is shaped around the guest rather than a formula.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {items.map((item, i) => (
            <div key={item.title} style={{ ...fadeUp(visible, 120 + i * 80), overflow: 'hidden', borderRadius: 28, border: '1px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.88)', boxShadow: '0 10px 28px rgba(0,0,0,0.05)' }}>
              <div style={{ position: 'relative', height: 224, overflow: 'hidden' }}>
                <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: 24 }}>
                <h3 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: C.text, marginBottom: 12 }}>{item.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#606760' }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}