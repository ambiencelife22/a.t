import { C } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

export default function DarkCTASection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section ref={ref} style={{ padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)', background: C.bg }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            borderRadius: 36,
            border: '1px solid #2A2D2A',
            background: '#171917',
            color: '#F7F4EE',
            padding: 'clamp(32px,5vw,56px)',
            boxShadow: '0 24px 70px rgba(0,0,0,0.22)',
          }}
        >
          <div style={{ display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, ...fadeUp(visible, 0) }}>
                <img src='/emblem.png' alt='ambience emblem' style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.gold }}>
                  Begin with ambience.travel
                </p>
              </div>

              <h2 style={{ fontSize: 'clamp(30px,4.5vw,54px)', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: 18, color: '#F7F4EE', ...fadeUp(visible, 100) }}>
                Give your next journey a proper home.
              </h2>

              <p style={{ fontSize: 18, lineHeight: 1.8, color: C.lightText, maxWidth: 680, marginBottom: 28, ...fadeUp(visible, 220) }}>
                From private travel planning to discreet on-the-ground support, ambience.travel is built for those who value privacy, taste, ease, and a highly personalised level of care.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', ...fadeUp(visible, 340) }}>
                <button
                  disabled
                  aria-disabled='true'
                  style={{
                    padding: '12px 28px',
                    fontSize: 13,
                    fontWeight: 700,
                    background: C.gold,
                    color: '#171917',
                    border: 'none',
                    borderRadius: 100,
                    cursor: 'default',
                    opacity: 0.86,
                  }}
                >
                  Begin the Conversation
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ ...fadeUp(visible, 180), borderRadius: 28, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', padding: 24 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.46)', marginBottom: 14 }}>
                  What guests can expect
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.78)', lineHeight: 1.8, fontSize: 14 }}>
                  <li>Travel shaped around personal preferences and pace</li>
                  <li>Calm, discreet support before and during the journey</li>
                  <li>Recommendations guided by taste, fit, and discernment</li>
                </ul>
              </div>

              <div style={{ ...fadeUp(visible, 280), borderRadius: 28, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', padding: 24 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.46)', marginBottom: 14 }}>
                  Brand tone
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.78)', margin: 0 }}>
                  Understated, assured, and highly personal; premium in feel, but never performative.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}