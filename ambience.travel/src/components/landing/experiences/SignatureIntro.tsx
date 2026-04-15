// SignatureIntro.tsx — editorial intro section for signature experience pages
// Owns the two-column "why this exists" framing only.
// Last updated: S9

import { useEffect, useState } from 'react'
import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type Props = {
  eyebrow: string
  title:   string
  body:    string[]
}

export default function SignatureIntro({ eyebrow, title, body }: Props) {
  const { ref, visible }      = useVisible(0.12)
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
        background:   C.bg,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          maxWidth:            1280,
          margin:              '0 auto',
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,0.82fr) minmax(0,1.18fr)',
          gap:                 isMobile ? 24 : 34,
          alignItems:          'start',
        }}
      >
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
              margin:        0,
              ...fadeUp(visible, 80),
            }}
          >
            {title}
          </h2>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {body.map((para, i) => (
            <p
              key={i}
              style={{
                fontSize:   16,
                lineHeight: 1.84,
                color:      C.muted,
                margin:     0,
                ...fadeUp(visible, 120 + i * 80),
              }}
            >
              {para}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}