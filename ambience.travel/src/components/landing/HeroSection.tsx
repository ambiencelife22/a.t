import { useEffect, useState } from 'react'
import { C, OVERLAY } from '../../lib/landingTypes'
import { fadeUp, Section, useVisible } from './LandingComponents'

export default function HeroSection() {
  const { ref, visible } = useVisible(0.1)
  const [ready, setReady] = useState(false)
  const [scribble, setScribble] = useState(false)

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setReady(true), 180)
      return () => clearTimeout(t)
    }
  }, [visible])

  useEffect(() => {
    if (!ready) return
    const first = setTimeout(() => {
      setScribble(true)
      setTimeout(() => setScribble(false), 22000)
    }, 2000)

    const loop = setInterval(() => {
      setScribble(true)
      setTimeout(() => setScribble(false), 22000)
    }, 44000)

    return () => {
      clearTimeout(first)
      clearInterval(loop)
    }
  }, [ready])

  const chips = [
    'Highly tailored, never formulaic',
    'Discreet support with exacting care',
    'Shaped by taste, privacy, and rhythm',
    'Designed around you, not the itinerary',
  ]

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        overflow: 'hidden',
        padding: 'clamp(64px,9vw,120px) clamp(20px,5vw,48px)',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <Section>
          <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
            <p
              style={{
                fontSize: 11,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: C.faint,
                marginBottom: 20,
                ...fadeUp(ready, 0),
              }}
            >
              Private travel design
            </p>

            <h1
              style={{
                fontSize: 'clamp(34px,5vw,68px)',
                fontWeight: 700,
                letterSpacing: '-0.045em',
                lineHeight: 1.04,
                marginBottom: 24,
                color: C.text,
                ...fadeUp(ready, 120),
              }}
            >
              Meaningful travel,
              <br />
              <span
                style={{
                  color: C.gold,
                  animation: ready ? 'warmBreath 5s ease-in-out 1.4s infinite' : 'none',
                  display: 'inline-block',
                }}
              >
                thoughtfully{' '}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  designed.
                  <svg
                    viewBox='0 0 202 18'
                    style={{
                      position:      'absolute',
                      bottom:        '-12px',
                      left:          '-2%',
                      width:         '104%',
                      height:        '18px',
                      overflow:      'visible',
                      pointerEvents: 'none',
                    }}
                  >
                    <path
                      d='M2,4 C28,1 52,8 78,3 C104,-1 128,7 154,3 C170,1 184,6 200,3'
                      fill='none'
                      stroke='#C9B88E'
                      strokeWidth='5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      style={{
                        strokeDasharray:  220,
                        strokeDashoffset: scribble ? 0 : 220,
                        animation:        scribble
                          ? 'scribbleLine1 1.1s ease both, scribbleIn 22s ease both, scribbleOut 22s ease both'
                          : 'none',
                        opacity: scribble ? undefined : 0,
                      }}
                    />
                    <path
                      d='M2,12 C28,9 52,16 78,12 C104,8 128,15 154,11 C170,8 184,14 200,11'
                      fill='none'
                      stroke='#C9B88E'
                      strokeWidth='5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      style={{
                        strokeDasharray:  225,
                        strokeDashoffset: scribble ? 0 : 225,
                        animation:        scribble
                          ? 'scribbleLine2 1.1s ease 1.1s both, scribbleIn 21s ease 1.1s both, scribbleOut 22s ease 0s both'
                          : 'none',
                        opacity: scribble ? undefined : 0,
                      }}
                    />
                  </svg>
                </span>
              </span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(15px,1.5vw,20px)',
                lineHeight: 1.85,
                color: C.muted,
                maxWidth: 720,
                margin: '0 auto 34px',
                ...fadeUp(ready, 280),
              }}
            >
              Private journeys shaped with discretion, care, and a highly tailored standard of service.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 40,
                ...fadeUp(ready, 420),
              }}
            >
              <button
                disabled
                aria-disabled='true'
                style={{
                  padding: '12px 28px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: '#171917',
                  color: '#F7F4EE',
                  border: 'none',
                  borderRadius: 100,
                  cursor: 'default',
                  letterSpacing: '0.02em',
                  opacity: 0.22,
                }}
              >
                Begin the Conversation
              </button>

              {/* <button
                disabled
                aria-disabled='true'
                style={{
                  padding: '12px 24px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'transparent',
                  color: '#556055',
                  border: '1px solid #D8D1C5',
                  borderRadius: 100,
                  cursor: 'default',
                  letterSpacing: '0.02em',
                  opacity: .44,
                }}
              >
                Explore the Experience
              </button> */}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                gap: 12,
                maxWidth: 900,
                margin: '0 auto 52px',
                ...fadeUp(ready, 560),
              }}
            >
              {chips.map(item => (
                <div
                  key={item}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${C.border}`,
                    background: OVERLAY.chipBg,
                    padding: '12px 16px',
                    fontSize: 13,
                    color: C.muted,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              ...fadeUp(ready, 700),
              position: 'relative',
              borderRadius: 36,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              boxShadow: '0 24px 70px rgba(0,0,0,0.10)',
              minHeight: 'clamp(360px, 52vw, 680px)',
              background: '#EDE7DE',
            }}
          >
            <img
              src='https://www.aman.com/sites/default/files/styles/full_size_extra_large/public/2022-12/Aman%20New%20York%2C%20USA%20-%20Corner%20Suite%202_0.jpg?itok=9yk-OWvo'
              alt='Refined private suite interior'
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(23,25,23,0.08) 0%, rgba(23,25,23,0.14) 38%, rgba(23,25,23,0.30) 100%)',
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: 24,
                right: 24,
                bottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 999,
                  background: C.bgCard,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${OVERLAY.pillBorder}`,
                  fontSize: 12,
                  color: '#4F564F',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Quietly remarkable stays
              </div>

              <div
                style={{
                  maxWidth: 340,
                  padding: '16px 18px',
                  borderRadius: 24,
                  background: OVERLAY.cardBg,
                  backdropFilter: 'blur(14px)',
                  border: `1px solid ${OVERLAY.cardBorder}`,
                  color: OVERLAY.cardText,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: OVERLAY.cardLabel,
                    marginBottom: 8,
                  }}
                >
                  Signature feeling
                </div>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.5,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Care for the details. Highly-considered from the very beginning.
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </section>
  )
}