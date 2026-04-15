// SignatureElements.tsx — four-element pillar cards for signature experience pages
// Owns the element grid section only. Does not own rhythm or stay sections.
// Last updated: S9

import { useState } from 'react'
import { C, DARK } from '../../../lib/landingTypes'
import { fadeUp, useVisible } from '../LandingComponents'

type ExperienceTheme = {
  gradientLayers: string[]
  borderColor:    string
}

type ElementItem = {
  tag:      string
  text:     string
  imageSrc: string
  imageAlt: string
}

type Props = {
  eyebrow: string
  title:   string
  body:    string
  items:   ElementItem[]
  theme:   ExperienceTheme
}

function ElementCard({ item, delay, visible }: { item: ElementItem; delay: number; visible: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity:       visible ? 1 : 0,
        borderRadius:  24,
        boxShadow:     hovered ? '0 20px 52px rgba(0,0,0,0.40)' : '0 10px 28px rgba(0,0,0,0.24)',
        transform:     hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition:    `opacity 0.9s ease ${delay}ms, box-shadow 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)`,
        cursor:        'default',
        willChange:    'transform',
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
      }}
    >
      <div
        style={{
          overflow:      'hidden',
          borderRadius:  24,
          border:        `1px solid ${hovered ? 'rgba(201,184,142,0.40)' : DARK.cardBorder}`,
          background:    DARK.cardBg,
          transition:    'border-color 0.3s ease',
          display:       'flex',
          flexDirection: 'column',
          flex:          1,
        }}
      >
        <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
          <img
            src={item.imageSrc}
            alt={item.imageAlt}
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              display:    'block',
              transform:  hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
          <div
            style={{
              position:   'absolute',
              inset:      0,
              background: 'linear-gradient(180deg, rgba(12,14,12,0.02), rgba(12,14,12,0.32))',
            }}
          />
        </div>
        <div style={{ padding: '20px 20px 24px' }}>
          <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: DARK.text, marginBottom: 10 }}>
            {item.tag}
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: DARK.body, margin: 0 }}>
            {item.text}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignatureElements({ eyebrow, title, body, items, theme }: Props) {
  const { ref, visible } = useVisible(0.10)

  return (
    <section
      ref={ref}
      style={{
        padding:            'clamp(56px,7vw,96px) clamp(20px,5vw,48px)',
        borderBottom:       `1px solid ${theme.borderColor}`,
        backgroundColor:    C.bgDark,
        backgroundImage:    theme.gradientLayers.slice(1).join(', '),
        backgroundSize:     '240% 240%, 200% 200%',
        backgroundPosition: '100% 0%, 0% 100%',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
          {items.map((item, i) => (
            <ElementCard key={item.tag} item={item} delay={100 + i * 100} visible={visible} />
          ))}
        </div>
      </div>
    </section>
  )
}