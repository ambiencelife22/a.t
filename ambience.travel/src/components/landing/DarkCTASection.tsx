/* DarkCTASection.tsx
 * Final CTA — dark card on light section bg.
 * Ambient: slow gradient shift on the card background — 12s cycle,
 * warm gold-tinted radial drifts from corner to corner.
 * Understated — visible only if you're watching.
 */

import { C, DARK } from '../../lib/landingTypes'
import { fadeUp, useVisible } from './LandingComponents'

export default function DarkCTASection() {
  const { ref, visible } = useVisible(0.12)

  return (
    <section ref={ref} style={{ padding: 'clamp(56px,8vw,104px) clamp(20px,5vw,48px)', background: C.bg }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            borderRadius:         36,
            border:               `1px solid ${DARK.cardBorder}`,
            color:                DARK.text,
            padding:              'clamp(24px,4vw,56px)',
            boxShadow:            '0 24px 70px rgba(0,0,0,0.22)',
            overflowX:            'hidden',
            position:             'relative',
            // Gradient shift: warm gold-tinted orb drifts slowly across the dark bg
            backgroundImage:      'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(201,184,142,0.14) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 80% 70%, rgba(127,222,255,0.08) 0%, transparent 70%)',
            backgroundColor:      C.bgDark,
            backgroundSize:       '200% 200%',
            backgroundPosition:   '0% 0%',
            animation:            'ctaGradientShift 12s ease-in-out infinite alternate',
          }}
        >
          <div style={{ display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, ...fadeUp(visible, 0) }}>
                <img src='/emblem.png' alt='ambience emblem' style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.gold }}>
                  Begin with ambience.travel
                </p>
              </div>

              <h2 style={{ fontSize: 'clamp(26px,4.5vw,54px)', fontWeight: 600, letterSpacing: '-0.04em', marginBottom: 18, color: DARK.text, ...fadeUp(visible, 100) }}>
                Give your next getaway the care it deserves.
              </h2>

              <p style={{ fontSize: 'clamp(15px,1.4vw,18px)', lineHeight: 1.8, color: DARK.body, marginBottom: 28, ...fadeUp(visible, 220) }}>
                From private travel planning to discreet on-the-ground support, ambience.travel is built for those who value privacy, taste, ease, and a highly personalised level of care.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', ...fadeUp(visible, 340) }}>
                {/* <button
                  disabled
                  aria-disabled='true'
                  style={{
                    padding:      '12px 28px',
                    fontSize:     13,
                    fontWeight:   700,
                    background:   C.gold,
                    color:        C.bgDark,
                    border:       'none',
                    borderRadius: 100,
                    cursor:       'default',
                    opacity:      0.22,
                  }}
                >
                  Begin the Conversation
                </button> */}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ ...fadeUp(visible, 180), borderRadius: 28, border: `1px solid ${DARK.cardBorder}`, background: DARK.cardBg, padding: 24 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: DARK.label, marginBottom: 14 }}>
                  What guests can expect
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: DARK.body, lineHeight: 1.8, fontSize: 14 }}>
                  <li>Travel shaped around personal preferences and pace</li>
                  <li>Calm, discreet support before and during travel</li>
                  <li>Recommendations guided by taste, fit, and discernment</li>
                </ul>
              </div>

              <div style={{ ...fadeUp(visible, 280), borderRadius: 28, border: `1px solid ${DARK.cardBorder}`, background: DARK.cardBg, padding: 24 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: DARK.label, marginBottom: 14 }}>
                  Brand tone
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: DARK.body, margin: 0 }}>
                  Understated, assured, and highly personal; premium in feel, but never performative.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ctaGradientShift {
          0%   { background-position: 0% 0% }
          100% { background-position: 100% 100% }
        }
      `}</style>
    </section>
  )
}