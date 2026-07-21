/* GuideEditorialPrompt.tsx - shared "there is more" prompt for the guide layer.
 *
 * Rendered below the item grid when the viewer is seeing fewer items than
 * exist. Composition:
 *   - eyebrow  : "{DestinationName} · {ProductLabel}"
 *   - italic   : GUIDE_COPY[variant].teaserItalic
 *                (dining: "There is more to this table.", etc.)
 *   - line     : "The full {DestinationName} {productLabel} is available to
 *                 invited guests. Contact your ambience team member to
 *                 request access."
 *
 * Extracted from four page files that shipped an identical prompt in each
 * with only variant-specific words differing. Callers pass the variant.
 *
 * What it owns:
 *   - GuideEditorialPrompt component chrome and copy composition
 *
 * What it does not own:
 *   - Gating logic that decides whether to render it (utilsGuideGating.ts:
 *     shouldShowEditorialPrompt)
 */

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import { GUIDE_COPY, type GuideVariant } from '../../types/typesGuides'

interface GuideEditorialPromptProps {
  variant:         GuideVariant
  destinationName: string
}

export function GuideEditorialPrompt({ variant, destinationName }: GuideEditorialPromptProps) {
  const copy = GUIDE_COPY[variant]
  return (
    <div style={wrapStyle}>
      <div style={eyebrowStyle}>
        {destinationName} {'\u00B7'} {copy.productLabel}
      </div>
      <p style={italicStyle}>{copy.teaserItalic}</p>
      <p style={bodyStyle}>
        The full {destinationName} {copy.productLabel.toLowerCase()} is
        available to invited guests. Contact your ambience team member to
        request access.
      </p>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  marginTop:     48,
  padding:       'clamp(40px, 6vw, 64px) clamp(24px, 6vw, 48px)',
  textAlign:     'center',
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'center',
  gap:           20,
  background:    ID.panel,
  borderTop:     `1px solid ${IMMERSE.tableBorder}`,
  borderBottom:  `1px solid ${IMMERSE.tableBorder}`,
  borderRadius:  24,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize:      11,
  fontWeight:    700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color:         ID.gold,
}

const italicStyle: React.CSSProperties = {
  fontSize:   'clamp(22px, 3.5vw, 32px)',
  fontWeight: 400,
  fontFamily: FONTS.serif,
  color:      ID.text,
  lineHeight: 1.2,
  margin:     0,
  maxWidth:   480,
  fontStyle:  'italic',
}

const bodyStyle: React.CSSProperties = {
  fontSize:   14,
  color:      ID.muted,
  lineHeight: 1.6,
  margin:     0,
  maxWidth:   400,
}