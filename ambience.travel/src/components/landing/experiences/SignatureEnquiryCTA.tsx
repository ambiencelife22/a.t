// SignatureEnquiryCTA.tsx — enquiry CTA section for signature experience pages
// Owns the bottom call-to-action only.
// Last updated: S9

import { C } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type Props = {
  eyebrow:        string
  title:          string
  body:           string
  primaryLabel:   string
  secondaryLabel: string
}

export default function SignatureEnquiryCTA({ eyebrow, title, body, primaryLabel, secondaryLabel }: Props) {
  const { ref, visible } = useVisible(0.12)

  return (
    <section
      ref={ref}
      id='enquire'
      style={{
        padding:    'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        background: C.bg,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            ...fadeUp(visible, 0),
            background:   '#FBFAF7',
            border:       `1px solid ${C.border}`,
            borderRadius: 34,
            padding:      'clamp(32px,5vw,56px)',
            boxShadow:    '0 20px 60px rgba(0,0,0,0.06)',
            textAlign:    'center',
          }}
        >
          <p
            style={{
              fontSize:      11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color:         C.gold,
              marginBottom:  16,
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
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize:   16,
              lineHeight: 1.82,
              color:      C.muted,
              maxWidth:   680,
              margin:     '0 auto 28px',
            }}
          >
            {body}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              disabled
              aria-disabled='true'
              style={{
                padding:       '13px 28px',
                borderRadius:  12,
                background:    C.gold,
                color:         C.bgDark,
                fontSize:      12,
                fontWeight:    800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border:        'none',
                cursor:        'default',
                opacity:       0.88,
                minWidth:      160,
              }}
            >
              {primaryLabel}
            </button>
            <button
              disabled
              aria-disabled='true'
              style={{
                padding:       '13px 28px',
                borderRadius:  12,
                background:    'transparent',
                color:         C.text,
                fontSize:      12,
                fontWeight:    700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border:        `1px solid ${C.border}`,
                cursor:        'default',
                opacity:       0.88,
                minWidth:      160,
              }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}