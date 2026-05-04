// GuideHero.tsx — two-column hero for guide pages
// What it owns: eyebrow, h1, intro copy, image panel + overlay caption.
// What it does not own: page chrome, filters, grid, variant-specific data,
//   image source resolution (caller passes the resolved URL or null).
//
// Shared across all guide variants (dining, experiences, hotels). The hero
// chrome — gold eyebrow, serif h1, intro paragraph, paneled overlay — is
// identical across variants; only the copy + image change. Each route
// passes variant-specific strings + image as props.
//
// Image rendering:
//   - imageSrc populated → renders <img> with overlay caption on top
//   - imageSrc null → renders the gradient panel fallback (decorative, no <img>)
//
// Last updated: S35 — Added imageSrc + imageAlt props for overlay-driven
//   hero image. NULL imageSrc preserves the original gradient panel render.

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'

interface GuideHeroProps {
  /** Gold eyebrow above the headline. e.g. "Curated dining" / "Curated experiences" */
  eyebrow: string
  /** Serif h1. e.g. "New York City, Curated Dining" — page knows the destination. */
  headline: string
  /** Body paragraph below the headline. */
  intro: string
  /** Right-panel hero image URL. null = render gradient fallback panel. */
  imageSrc?: string | null
  /** Alt text for the hero image. Falls back to headline if not provided. */
  imageAlt?: string | null
  /** Right-panel overlay title. Optional — defaults to a guide-neutral phrase. */
  panelTitle?: string
  /** Right-panel overlay body. Optional — defaults to a guide-neutral phrase. */
  panelBody?: string
}

const DEFAULT_PANEL_TITLE = 'Considered for you.'
const DEFAULT_PANEL_BODY  = 'Curated by ambience for clients who travel deliberately. Reservations and on-trip concierge handled by your travel designer.'

export function GuideHero({
  eyebrow,
  headline,
  intro,
  imageSrc,
  imageAlt,
  panelTitle = DEFAULT_PANEL_TITLE,
  panelBody  = DEFAULT_PANEL_BODY,
}: GuideHeroProps) {
  const hasImage = !!imageSrc && imageSrc.trim().length > 0

  return (
    <section style={heroStyle}>
      <div style={heroCopyStyle}>
        <div style={labelStyle}>
          <span style={labelDashStyle} />
          {eyebrow}
        </div>
        <h1 style={heroTitleStyle}>{headline}</h1>
        <p style={introStyle}>{intro}</p>
      </div>

      <div style={heroPanelStyle}>
        {hasImage && (
          <>
            <img
              src={imageSrc!}
              alt={imageAlt ?? headline}
              style={heroImageStyle}
              loading="eager"
            />
            <div style={heroImageOverlayStyle} />
          </>
        )}
        <div style={heroPanelOverlayStyle}>
          <h2 style={heroPanelTitleStyle}>{panelTitle}</h2>
          <p style={heroPanelTextStyle}>{panelBody}</p>
        </div>
      </div>
    </section>
  )
}

const heroStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '0.95fr 1.05fr',
  gap: 34,
  alignItems: 'stretch',
  marginBottom: 34,
}

const heroCopyStyle: React.CSSProperties = {
  padding: '46px 44px',
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 34,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))',
  boxShadow: '0 24px 100px rgba(0,0,0,0.28)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

const labelStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 10,
  alignItems: 'center',
  color: ID.gold,
  fontSize: 12,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  marginBottom: 22,
}

const labelDashStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 28,
  height: 1,
  background: ID.gold,
  opacity: 0.75,
}

const heroTitleStyle: React.CSSProperties = {
  fontFamily: FONTS.serif,
  fontSize: 'clamp(52px, 7vw, 100px)',
  lineHeight: 0.92,
  letterSpacing: '-0.06em',
  margin: '0 0 24px',
  fontWeight: 400,
  color: ID.text,
}

const introStyle: React.CSSProperties = {
  maxWidth: 650,
  color: '#d8d0c0',
  fontSize: 18,
  lineHeight: 1.65,
  margin: 0,
}

const heroPanelStyle: React.CSSProperties = {
  borderRadius: 34,
  minHeight: 475,
  position: 'relative',
  overflow: 'hidden',
  border: `1px solid ${IMMERSE.tableBorder}`,
  background: `linear-gradient(135deg, ${IMMERSE.goldTint}, rgba(154,169,120,0.12)), ${ID.panel2}`,
}

const heroImageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const heroImageOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: IMMERSE.imageOverlayStrong,
  pointerEvents: 'none',
}

const heroPanelOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  left: 24,
  right: 24,
  bottom: 24,
  padding: 24,
  borderRadius: 24,
  background: 'rgba(17,19,15,0.72)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(247,241,231,0.13)',
  zIndex: 2,
}

const heroPanelTitleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: FONTS.serif,
  fontWeight: 400,
  fontSize: 32,
  letterSpacing: '-0.04em',
  color: ID.text,
}

const heroPanelTextStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  lineHeight: 1.55,
  fontSize: 15,
}