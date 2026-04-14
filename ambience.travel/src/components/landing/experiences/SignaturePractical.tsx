// SignaturePractical.tsx — practical details section for signature experience pages
// Owns the four-card stat grid only.
// Last updated: S9

import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type PracticalCard = {
  label: string
  big:   string
  small: string
}

type Props = {
  eyebrow: string
  title:   string
  body:    string
  cards:   PracticalCard[]
}

export default function SignaturePractical({ eyebrow, title, body, cards }: Props) {
  const { ref, visible } = useVisible(0.10)

  return (
    <section
      ref={ref}
      style={{
        padding:      'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        background:   C.bg,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 760, marginBottom: 36 }}>
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

        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap:                 16,
            ...fadeUp(visible, 220),
          }}
        >
          {cards.map(card => (
            <div
              key={card.label}
              style={{
                background:   '#FBFAF7',
                border:       `1px solid ${C.border}`,
                borderRadius: 22,
                padding:      '22px 20px',
                boxShadow:    '0 12px 36px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  fontSize:      10,
                  fontWeight:    700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color:         C.gold,
                  marginBottom:  10,
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  fontSize:      22,
                  fontWeight:    700,
                  letterSpacing: '-0.03em',
                  lineHeight:    1.2,
                  color:         C.text,
                  marginBottom:  8,
                }}
              >
                {card.big}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: C.muted }}>
                {card.small}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}