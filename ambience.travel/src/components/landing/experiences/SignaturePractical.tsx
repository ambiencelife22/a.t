// SignaturePractical.tsx — practical details section for signature experience pages
// Owns the four-card stat grid only.
// Last updated: S9

import { C, DARK } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type ExperienceTheme = {
  gradientLayers: string[]
  borderColor:    string
}

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
  theme:   ExperienceTheme
}

export default function SignaturePractical({ eyebrow, title, body, cards, theme }: Props) {
  const { ref, visible } = useVisible(0.10)

  return (
    <section
      ref={ref}
      style={{
        padding:            'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        borderBottom:       `1px solid ${theme.borderColor}`,
        backgroundImage:    theme.gradientLayers.join(', '),
        backgroundSize:     '100% 100%, 240% 240%, 200% 200%',
        backgroundPosition: '0 0, 100% 0%, 0% 100%',
        animation:          'icelandAurora 28s ease-in-out infinite alternate',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ maxWidth: 760, marginBottom: 36 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.gold, marginBottom: 16, ...fadeUp(visible, 0) }}>
            {eyebrow}
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,50px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.04, color: DARK.text, marginBottom: 16, ...fadeUp(visible, 80) }}>
            {title}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: DARK.body, margin: 0, ...fadeUp(visible, 160) }}>
            {body}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, ...fadeUp(visible, 220) }}>
          {cards.map(card => (
            <div
              key={card.label}
              style={{
                background:   DARK.cardBg,
                border:       `1px solid ${DARK.cardBorder}`,
                borderRadius: 22,
                padding:      '22px 20px',
                boxShadow:    '0 12px 36px rgba(0,0,0,0.24)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, color: DARK.text, marginBottom: 8 }}>
                {card.big}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: DARK.body }}>
                {card.small}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}