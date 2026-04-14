// SignatureQuote.tsx — guest reflection section for signature experience pages
// Owns the quote + left editorial copy only.
// Last updated: S9

import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type Props = {
  eyebrow: string
  title:   string
  body:    string
  text:    string
  attrib:  string
}

export default function SignatureQuote({ eyebrow, title, body, text, attrib }: Props) {
  const { ref, visible } = useVisible(0.12)

  return (
    <section
      ref={ref}
      style={{
        padding:      'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        background:   `linear-gradient(180deg, ${C.bg}, #F2ECE2)`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          maxWidth:            1280,
          margin:              '0 auto',
          display:             'grid',
          gridTemplateColumns: '0.85fr 1.15fr',
          gap:                 24,
          alignItems:          'center',
        }}
      >
        {/* Left — editorial framing */}
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

        {/* Right — quote card */}
        <div
          style={{
            ...fadeUp(visible, 200),
            background:   '#FFFFFF',
            border:       `1px solid ${C.border}`,
            borderRadius: 28,
            padding:      34,
            boxShadow:    '0 20px 56px rgba(0,0,0,0.07)',
          }}
        >
          <div
            style={{
              fontFamily:  'Georgia, serif',
              fontSize:    52,
              color:       '#D0C3AE',
              lineHeight:  1,
              marginBottom: 4,
            }}
          >
            "
          </div>
          <blockquote
            style={{
              margin:     0,
              fontFamily: 'Georgia, serif',
              fontSize:   20,
              lineHeight: 1.9,
              color:      '#373C37',
            }}
          >
            {text}
          </blockquote>
          <div
            style={{
              marginTop:     18,
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color:         C.muted,
            }}
          >
            {attrib}
          </div>
        </div>
      </div>
    </section>
  )
}