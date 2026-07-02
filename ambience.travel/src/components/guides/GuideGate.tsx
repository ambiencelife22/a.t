// GuideGate.tsx — inline gate screen for guide pages.
//
// Rendered inside GuideLayout when useGuideRoute returns phase='notPublic'
// for any guide variant. The hero renders above this block; the guest sees
// destination context before hitting the gate.
//
// Single source of truth for all four guide gate screens. Variant label
// comes from GUIDE_COPY so it stays in sync with the rest of the guide layer.
//
// What it owns: the gate message block (eyebrow + heading + body + rule + link).
// What it does not own: layout shell (GuideLayout), hero (GuideHero),
//   whether to render (GuideRoute* gates on notPublic phase).
//
// Created: S53 — P0 gate screen. One component for all four variants.

import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import { GUIDE_COPY, type GuideVariant } from '../../types/typesGuides'

interface GuideGateProps {
  variant:         GuideVariant
  destinationName: string
}

export function GuideGate({ variant, destinationName }: GuideGateProps) {
  const label = GUIDE_COPY[variant].sectionLabel

  return (
    <div style={wrapStyle}>
      <div style={innerStyle}>
        <div style={eyebrowStyle}>{label}</div>
        <h2 style={headingStyle}>
          The {destinationName} {label} is not publicly visible.
        </h2>
        <p style={bodyStyle}>
          Please reach out to your travel designer for more information.
        </p>
        <div style={ruleStyle} />
        <a href='https://ambience.travel' style={linkStyle}>
          Return to ambience.travel {'\u2192'}
        </a>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  minHeight:      '50vh',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  padding:        '80px 24px',
}

const innerStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'center',
  gap:           20,
  textAlign:     'center',
  maxWidth:      520,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize:      10,
  fontFamily:    "'Plus Jakarta Sans', sans-serif",
  fontWeight:    700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color:         ID.dim,
}

const headingStyle: React.CSSProperties = {
  margin:        0,
  fontSize:      'clamp(22px, 3vw, 30px)',
  fontFamily:    FONTS.serif,
  fontWeight:    400,
  letterSpacing: '-0.02em',
  color:         ID.text,
  lineHeight:    1.25,
}

const bodyStyle: React.CSSProperties = {
  margin:     0,
  fontSize:   14,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  color:      ID.muted,
  lineHeight: 1.7,
  maxWidth:   400,
}

const ruleStyle: React.CSSProperties = {
  width:      40,
  height:     1,
  background: IMMERSE.tableBorder,
  opacity:    0.6,
}

const linkStyle: React.CSSProperties = {
  fontSize:       13,
  fontFamily:     "'Plus Jakarta Sans', sans-serif",
  color:          ID.gold,
  textDecoration: 'none',
  letterSpacing:  '0.02em',
}