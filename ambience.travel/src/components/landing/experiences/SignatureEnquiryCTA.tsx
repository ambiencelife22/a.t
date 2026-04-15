// SignatureEnquiryCTA.tsx — enquiry CTA section for signature experience pages
// Owns the bottom call-to-action only.
// Last updated: S9

import { C, DARK } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type ExperienceTheme = {
  gradientLayers: string[]
  borderColor:    string
}

type Props = {
  eyebrow:        string
  title:          string
  body:           string
  primaryLabel:   string
  secondaryLabel: string
  theme:          ExperienceTheme
}

export default function SignatureEnquiryCTA({ eyebrow, title, body, primaryLabel, secondaryLabel, theme }: Props) {
  const { ref, visible } = useVisible(0.12)

  return (
    <section
      ref={ref}
      id='enquire'
      style={{
        padding:            'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        backgroundImage:    theme.gradientLayers.join(', '),
        backgroundSize:     '100% 100%, 240% 240%, 200% 200%',
        backgroundPosition: '0 0, 100% 0%, 0% 100%',
        animation:          'icelandAurora 28s ease-in-out infinite alternate',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            ...fadeUp(visible, 0),
            background:     'rgba(255,255,255,0.06)',
            border:         '1px solid rgba(247,242,234,0.14)',
            borderRadius:   34,
            padding:        'clamp(32px,5vw,56px)',
            boxShadow:      '0 20px 60px rgba(0,0,0,0.20)',
            textAlign:      'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#DEC694', marginBottom: 16 }}>
            {eyebrow}
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,50px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.04, color: DARK.text, marginBottom: 16 }}>
            {title}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.82, color: DARK.body, maxWidth: 680, margin: '0 auto 28px' }}>
            {body}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              disabled
              aria-disabled='true'
              style={{
                padding: '13px 28px', borderRadius: 12, background: C.gold, color: '#1F1D18',
                fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                border: 'none', cursor: 'default', opacity: 0.88, minWidth: 160,
              }}
            >
              {primaryLabel}
            </button>
            <button
              disabled
              aria-disabled='true'
              style={{
                padding: '13px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.10)',
                color: DARK.text, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', border: '1px solid rgba(247,242,234,0.22)',
                cursor: 'default', opacity: 0.88, minWidth: 160,
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