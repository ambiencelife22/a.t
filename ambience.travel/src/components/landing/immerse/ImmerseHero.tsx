// ImmerseHero.tsx — hero section for all /immerse/ proposal pages
// Owns the full-bleed glass-card hero. Used by both journey overview and destination subpages.
// Hero image is the first element — no brand strip above it.
// Last updated: S10

import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmersePill } from './ImmerseComponents'

type Props = {
  eyebrow:         string
  title:           string
  subtitle:        string
  pills:           string[]
  heroImageSrc:    string
  heroImageAlt:    string
  primaryHref?:    string
  primaryLabel?:   string
  secondaryHref?:  string
  secondaryLabel?: string
}

export default function ImmerseHero({
  eyebrow,
  title,
  subtitle,
  pills,
  heroImageSrc,
  primaryHref    = '#destinations',
  primaryLabel   = 'View destinations',
  secondaryHref  = '#pricing',
  secondaryLabel = 'Pricing',
}: Props) {
  const { ref, visible } = useImmerseVisible(0.05)
  const isMobile         = useImmerseMobile()

  const shellBg = [
    `linear-gradient(90deg, rgba(6,6,6,0.80) 0%, rgba(6,6,6,0.66) 36%, rgba(6,6,6,0.34) 62%, rgba(6,6,6,0.18) 100%)`,
    `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.44) 100%)`,
    `url('${heroImageSrc}') center/cover no-repeat`,
  ].join(', ')

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      style={{ borderTop: 'none', padding: 0, margin: 0 }}
    >
      <div
        style={{
          position:     'relative',
          minHeight:    isMobile ? 620 : 740,
          background:   shellBg,
          display:      'flex',
          alignItems:   'center',
        }}
      >
        <div style={{ width: 'min(1220px, calc(100% - 36px))', margin: '0 auto', padding: '44px 0' }}>
          <div
            style={{
              width:          `min(760px, 100%)`,
              padding:        isMobile ? 22 : 38,
              border:         '1px solid rgba(255,255,255,0.08)',
              borderRadius:   30,
              background:     'linear-gradient(180deg, rgba(12,12,12,0.38), rgba(12,12,12,0.18))',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                color:         ID.gold,
                fontSize:      11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight:    700,
                marginBottom:  14,
                ...immerseFadeUp(visible, 0),
              }}
            >
              {eyebrow}
            </div>

            <div
              style={{
                fontSize:      isMobile ? 38 : 'clamp(48px,6.2vw,88px)',
                lineHeight:    0.93,
                letterSpacing: '-0.075em',
                fontWeight:    800,
                marginBottom:  16,
                color:         ID.text,
                ...immerseFadeUp(visible, 60),
              }}
            >
              {title}
            </div>

            <p
              style={{
                color:      ID.muted,
                fontSize:   18,
                lineHeight: 1.84,
                maxWidth:   700,
                margin:     0,
                ...immerseFadeUp(visible, 120),
              }}
            >
              {subtitle}
            </p>

            <div
              style={{
                display:   'flex',
                flexWrap:  'wrap',
                gap:       10,
                marginTop: 24,
                ...immerseFadeUp(visible, 180),
              }}
            >
              {pills.map(p => (
                <ImmersePill key={p}>{p}</ImmersePill>
              ))}
            </div>

            <div
              style={{
                display:       'flex',
                flexWrap:      'wrap',
                gap:           12,
                marginTop:     28,
                flexDirection: isMobile ? 'column' : 'row',
                ...immerseFadeUp(visible, 240),
              }}
            >
              <a
                href={primaryHref}
                style={{
                  minHeight:      46,
                  padding:        '0 18px',
                  borderRadius:   12,
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize:       12,
                  letterSpacing:  '0.08em',
                  textTransform:  'uppercase',
                  fontWeight:     800,
                  background:     ID.gold,
                  color:          '#090909',
                  border:         `1px solid ${ID.gold}`,
                }}
              >
                {primaryLabel}
              </a>
              <a
                href={secondaryHref}
                style={{
                  minHeight:      46,
                  padding:        '0 18px',
                  borderRadius:   12,
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize:       12,
                  letterSpacing:  '0.08em',
                  textTransform:  'uppercase',
                  fontWeight:     800,
                  background:     'transparent',
                  color:          ID.text,
                  border:         '1px solid rgba(255,255,255,0.14)',
                }}
              >
                {secondaryLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}