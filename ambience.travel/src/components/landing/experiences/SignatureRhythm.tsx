// SignatureRhythm.tsx — experience rhythm section for signature experience pages
// Owns the day/phase cadence list only.
// Last updated: S9

import { useEffect, useState } from 'react'
import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type RhythmRow = {
  label: string
  title: string
  text:  string
}

type Props = {
  eyebrow: string
  title:   string
  body:    string
  rows:    RhythmRow[]
}

export default function SignatureRhythm({ eyebrow, title, body, rows }: Props) {
  const { ref, visible }        = useVisible(0.10)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <section
      ref={ref}
      style={{
        padding:      'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        background:   `linear-gradient(180deg, ${C.bg}, #EEF3F5)`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          maxWidth:            1280,
          margin:              '0 auto',
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,0.82fr) minmax(0,1.18fr)',
          gap:                 isMobile ? 32 : 34,
          alignItems:          'start',
        }}
      >
        {/* Left — heading */}
        <div>
          <p
            style={{
              fontSize:      11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color:         C.gold,
              marginBottom:  16,
              ...fadeUp(visible, 0),
            }}
          >
            {eyebrow}
          </p>
          <h2
            style={{
              fontSize:      'clamp(28px,4vw,50px)',
              fontWeight:    700,
              letterSpacing: '-0.05em',
              lineHeight:    1.04,
              color:         C.text,
              marginBottom:  16,
              ...fadeUp(visible, 80),
            }}
          >
            {title}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.muted, margin: 0, ...fadeUp(visible, 160) }}>
            {body}
          </p>
        </div>

        {/* Right — rhythm rows */}
        <div
          style={{
            background:   '#FBFAF7',
            border:       `1px solid ${C.border}`,
            borderRadius: 28,
            padding:      '6px 24px 10px',
            boxShadow:    '0 16px 48px rgba(0,0,0,0.06)',
            ...fadeUp(visible, 120),
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display:             'grid',
                gridTemplateColumns: isMobile ? '80px 1fr' : '112px 1fr',
                gap:                 isMobile ? 12 : 18,
                padding:             '18px 0',
                borderTop:           i === 0 ? 'none' : `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  fontSize:      11,
                  fontWeight:    700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color:         C.gold,
                  paddingTop:    4,
                }}
              >
                {row.label}
              </div>
              <div>
                <div
                  style={{
                    fontSize:      isMobile ? 17 : 20,
                    fontWeight:    700,
                    letterSpacing: '-0.03em',
                    color:         C.text,
                    marginBottom:  6,
                  }}
                >
                  {row.title}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: C.muted }}>
                  {row.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}