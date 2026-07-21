/* GuideAtAGlance.tsx - shared "At a Glance" bulleted block for the guide layer.
 *
 * Rendered near the top of a guide page when the overlay carries
 * at_a_glance_bullets. Gold-rule left border, gold eyebrow, diamond
 * glyph bullets.
 *
 * Extracted from three page files (Shopping, Experiences, Hotels) that
 * each shipped a copy of this component. Dining did not use it and will
 * gain it via this extraction if the overlay carries bullets.
 *
 * What it owns:
 *   - GuideAtAGlance component chrome
 *
 * What it does not own:
 *   - Data source (overlay.atAGlanceBullets, resolved by the caller)
 */

import React from 'react'
import { ID } from '../../tokens/tokensLanding'

interface GuideAtAGlanceProps {
  bullets: string[]
}

export function GuideAtAGlance({ bullets }: GuideAtAGlanceProps) {
  if (bullets.length === 0) return null
  return (
    <div style={wrapStyle}>
      <div style={eyebrowStyle}>At a Glance</div>
      <ul style={listStyle}>
        {bullets.map((b, i) => (
          <li key={i} style={itemStyle}>
            <span style={glyphStyle} aria-hidden>{'\u25C6'}</span>
            <span style={textStyle}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  margin:       '0 0 32px',
  padding:      '20px 24px',
  background:   ID.panel,
  borderRadius: 12,
  borderLeft:   `3px solid ${ID.gold}`,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color:         ID.gold,
  marginBottom:  12,
}

const listStyle: React.CSSProperties = {
  margin:        0,
  padding:       0,
  listStyle:     'none',
  display:       'flex',
  flexDirection: 'column',
  gap:           8,
}

const itemStyle: React.CSSProperties = {
  display:    'flex',
  gap:        10,
  alignItems: 'flex-start',
}

const glyphStyle: React.CSSProperties = {
  color:      ID.gold,
  fontSize:   10,
  marginTop:  4,
  flexShrink: 0,
}

const textStyle: React.CSSProperties = {
  fontSize:   14,
  color:      ID.text,
  lineHeight: 1.6,
}