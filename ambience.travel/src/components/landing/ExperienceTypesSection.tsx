import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

const items = [
  {
    title: 'Private Family Travel',
    text: 'Well-considered journeys for families who value space, ease, privacy, and a smoother rhythm from start to finish.',
    image:
      'https://cache.marriott.com/is/image/marriotts7prod/rz-mlera-welcome-to-the-maldives-29354:Wide-Hor?wid=1100&fit=constrain',
  },
  {
    title: 'Extended Private Journeys',
    text: 'Multi-stop itineraries requiring careful coordination, strong judgement, and consistency across every stage.',
    image:
      'https://www.fourseasons.com/alt/img-opt/~80.1860.0,0000-156,2500-3000,0000-1687,5000/publish/content/dam/fourseasons/images/web/SBT/SBT_407_original.jpg',
  },
  {
    title: 'Wellness-Led Escapes',
    text: 'Travel shaped around restoration, privacy, clean living, and a deeper sense of balance.',
    image:
      'https://burgenstockresort.com/uploads/media/2880x1800-cover-page/00/1430-Alpine%20Spa_Exterior_Infinity%20Edge%20Pool%203_web.jpg?v=2-5',
  },
    {
    title: 'Suites, Villas & Residential-Style Stays',
    text: 'Accommodations chosen for how they live and feel, not just how they appear on paper.',
    image:
      'https://images.prismic.io/lvmh-chevalblanc/Z-vdqXdAxsiBwLEY_WebRGB-ChevalBlancParis_SuiteEiffel_VincentLeroux.jpg?auto=format%2Ccompress&fit=max&w=1100',
  },
  {
    title: 'Signature City Stays',
    text: 'Refined urban travel with standout hotels, well-managed access, and a sharper sense of place.',
    image:
      'https://symphony.cdn.tambourine.com/the-setai-miami-beach/media/the-setai-miami-beach-penthouse-bedroom-62ad0d35f1eac.jpg',
  },
  {
    title: 'Couples & Celebrations',
    text: 'Anniversaries, milestone escapes, and romantic journeys designed with taste, atmosphere, and discretion.',
    image:
      'https://www.fourseasons.com/alt/img-opt/~80.1860.0,0000-312,5000-3000,0000-1687,5000/publish/content/dam/fourseasons/images/web/KOH/KOH_1422_original.jpg',
  },
]

export default function ExperienceTypesSection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section ref={ref} style={{ padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)', background: C.bgAlt, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
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
                <p style={{ fontSize: 14, lineHeight: 1.7, color: C.muted }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}