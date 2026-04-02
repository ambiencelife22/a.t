import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

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
    text: 'Thoughtful assistance shaped by trust, discretion, and an understanding that true luxury is rarely one-size-fits-all.',
  },
]

export default function PillarsSection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section ref={ref} style={{ padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)', background: C.bgAlt, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 760, marginBottom: 40 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.faint, marginBottom: 16, ...fadeUp(visible, 0) }}>
            Why ambience.travel
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: 18, color: C.text, ...fadeUp(visible, 100) }}>
            Not merely where you go — how the experience is held.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.muted, ...fadeUp(visible, 200) }}>
            Designed for guests who want more than access alone: taste, discretion, ease, and a level of service that feels quietly assured throughout.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {pillars.map((pillar, i) => (
            <div key={pillar.title} style={{ ...fadeUp(visible, 120 + i * 90), borderRadius: 28, border: `1px solid ${C.border}`, background: '#fff', padding: 28, boxShadow: '0 12px 32px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8A9487', marginBottom: 14 }}>Core pillar</p>
              <h3 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: C.text, marginBottom: 14 }}>{pillar.title}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.75, color: '#5C625C' }}>{pillar.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}