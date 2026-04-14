// SignatureStay.tsx — accommodation section for signature experience pages
// Owns the stay image + copy + bullet grid only.
// Last updated: S9

import { C } from '../../../lib/landingTypes'
import { fadeUp, useScrollParallax, useVisible } from '../LandingComponents'

type Bullet = {
  label: string
  text:  string
}

type Props = {
  eyebrow:     string
  title:       string
  body:        string
  description: string
  bullets:     Bullet[]
  imageSrc:    string
  imageAlt:    string
}

export default function SignatureStay({
  eyebrow,
  title,
  body,
  description,
  bullets,
  imageSrc,
  imageAlt,
}: Props) {
  const { ref, visible }          = useVisible(0.10)
  const { ref: imgRef, offset }   = useScrollParallax(0.05)

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
        {/* Section header */}
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

        {/* Split grid */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1.05fr 0.95fr',
            gap:                 22,
            alignItems:          'stretch',
          }}
        >
          {/* Image with parallax */}
          <div
            style={{
              ...fadeUp(visible, 200),
              position:     'relative',
              borderRadius: 28,
              overflow:     'hidden',
              border:       `1px solid ${C.border}`,
              boxShadow:    '0 20px 56px rgba(0,0,0,0.08)',
              minHeight:    400,
              background:   '#EDE7DE',
            }}
          >
            <div
              ref={imgRef}
              style={{
                position:   'absolute',
                inset:      '-8% 0',
                transform:  `translateY(${offset}px)`,
                transition: 'transform 0.1s linear',
              }}
            >
              <img
                src={imageSrc}
                alt={imageAlt}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>

          {/* Copy + bullets */}
          <div
            style={{
              ...fadeUp(visible, 260),
              background:   '#FBFAF7',
              border:       `1px solid ${C.border}`,
              borderRadius: 28,
              padding:      28,
              boxShadow:    '0 16px 48px rgba(0,0,0,0.05)',
              display:      'flex',
              flexDirection: 'column',
              gap:          20,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize:      'clamp(22px,2.8vw,32px)',
                  fontWeight:    700,
                  letterSpacing: '-0.03em',
                  color:         C.text,
                  marginBottom:  14,
                }}
              >
                Chosen for atmosphere, privacy, and place.
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.84, color: C.muted, margin: 0 }}>
                {description}
              </p>
            </div>

            {/* Bullet grid */}
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(2,1fr)',
                gap:                 12,
              }}
            >
              {bullets.map(bullet => (
                <div
                  key={bullet.label}
                  style={{
                    background:   'rgba(255,255,255,0.60)',
                    border:       `1px solid ${C.border}`,
                    borderRadius: 14,
                    padding:      '14px 15px',
                    fontSize:     14,
                    lineHeight:   1.65,
                    color:        C.text,
                  }}
                >
                  <strong
                    style={{
                      display:       'block',
                      marginBottom:  4,
                      fontSize:      10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color:         C.gold,
                      fontWeight:    700,
                    }}
                  >
                    {bullet.label}
                  </strong>
                  {bullet.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}