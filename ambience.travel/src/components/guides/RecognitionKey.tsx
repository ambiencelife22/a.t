// RecognitionKey.tsx — shared recognition definitions for dining guide
// What it owns:
//   - The single source of truth for what each recognition mark means
//     (★ stars, BIB Gourmand, Green Star, 50 Best, ambience Pick)
//   - <RecognitionKeyStrip /> — discreet page-top legend
//   - <RecognitionMark /> — single-mark pill with hover tooltip
//
// Last updated: S40B — Added 'highlighted' kind. ambience Pick pill renders
//   for venues where is_highlighted = true. Serif italic 'a' glyph, gold border.
// Prior: S37 — Initial ship.

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'

export const GREEN_STAR_COLOR = '#3aa55a'

// ── Definitions ───────────────────────────────────────────────────────────────

export type RecognitionKind = 'highlighted' | 'stars' | 'bib' | 'green' | 'fifty_best'

interface RecognitionDef {
  kind:        RecognitionKind
  shortLabel:  string
  description: string
}

const RECOGNITION_DEFS: Record<RecognitionKind, RecognitionDef> = {
  highlighted: {
    kind:        'highlighted',
    shortLabel:  'Highlighted',
    description: 'Selected by the ambience team as a standout table for this destination.',
  },
  stars: {
    kind:        'stars',
    shortLabel:  'Michelin Stars',
    description: 'Awarded by the Michelin Guide for exceptional cooking. One to three stars.',
  },
  bib: {
    kind:        'bib',
    shortLabel:  'Bib Gourmand',
    description: 'Michelin recognition for high-quality cooking at moderate prices.',
  },
  green: {
    kind:        'green',
    shortLabel:  'Michelin Green Star',
    description: 'Awarded for outstanding commitment to sustainable gastronomy.',
  },
  fifty_best: {
    kind:        'fifty_best',
    shortLabel:  'World\u2019s 50 Best',
    description: 'Listed on The World\u2019s 50 Best Restaurants guide.',
  },
}

// ── Single mark renderer ──────────────────────────────────────────────────────

interface RecognitionMarkProps {
  kind:       RecognitionKind
  starCount?: number
}

export function RecognitionMark({ kind, starCount }: RecognitionMarkProps) {
  const def         = RECOGNITION_DEFS[kind]
  const tooltipText = `${def.shortLabel}: ${def.description}`

  return (
    <span style={markWrapperStyle} title={tooltipText} aria-label={tooltipText}>
      <MarkGlyph kind={kind} starCount={starCount} />
    </span>
  )
}

function MarkGlyph({ kind, starCount }: { kind: RecognitionKind; starCount?: number }) {
  if (kind === 'highlighted') {
    return <span style={ambiencePillStyle}>◆</span>
  }
  if (kind === 'stars') {
    const count = Math.max(1, Math.min(3, starCount ?? 1))
    return <span style={starsGlyphStyle}>{'\u2605'.repeat(count)}</span>
  }
  if (kind === 'bib') {
    return <span style={bibPillStyle}>BIB</span>
  }
  if (kind === 'green') {
    return <span style={greenStarGlyphStyle}>{'\u2605'}</span>
  }
  if (kind === 'fifty_best') {
    return <span style={fiftyPillStyle}>50 BEST</span>
  }
  return null
}

// ── Page-top key strip ────────────────────────────────────────────────────────

export interface RecognitionKeyStripProps {
  presentKinds: Set<RecognitionKind>
}

export function RecognitionKeyStrip({ presentKinds }: RecognitionKeyStripProps) {
  if (presentKinds.size === 0) return null

  const order: RecognitionKind[] = ['highlighted', 'stars', 'bib', 'green', 'fifty_best']
  const items = order.filter((k) => presentKinds.has(k))

  return (
    <div style={keyStripStyle} role="region" aria-label="Recognition key">
      <span style={keyLabelStyle}>Recognition</span>
      <div style={keyItemsStyle}>
        {items.map((kind) => {
          const def = RECOGNITION_DEFS[kind]
          return (
            <div key={kind} style={keyItemStyle}>
              <span style={keyGlyphSlotStyle}>
                <MarkGlyph kind={kind} starCount={kind === 'stars' ? 1 : undefined} />
              </span>
              <span style={keyTextStyle}>{def.shortLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

import type { DiningVenue } from '../../lib/queriesGuidesDining'

export function deriveRecognitionKindsFromVenues(venues: DiningVenue[]): Set<RecognitionKind> {
  const set = new Set<RecognitionKind>()
  for (const v of venues) {
    if (v.is_highlighted)                                   set.add('highlighted')
    if (v.michelin_award === 'star' && v.michelin_stars)    set.add('stars')
    if (v.michelin_award === 'bib_gourmand')                set.add('bib')
    if (v.michelin_green_star)                              set.add('green')
    if (v.worlds_50_best)                                   set.add('fifty_best')
  }
  return set
}

// ── Styles ────────────────────────────────────────────────────────────────────

const markWrapperStyle: React.CSSProperties = {
  display:     'inline-flex',
  alignItems:  'center',
  cursor:      'help',
}

const ambiencePillStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '5px 10px',
  fontSize:      10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  border:        `1px solid ${IMMERSE.goldBorder}`,
  color:         ID.gold,
  background:    IMMERSE.goldTint,
  fontWeight:    700,
}

const starsGlyphStyle: React.CSSProperties = {
  color:          ID.gold,
  fontSize:       16,
  letterSpacing:  '0.05em',
  lineHeight:     1,
}

const bibPillStyle: React.CSSProperties = {
  borderRadius:    999,
  padding:         '5px 10px',
  fontSize:        10,
  letterSpacing:   '0.18em',
  textTransform:   'uppercase',
  border:          `1px solid ${IMMERSE.goldBorder}`,
  color:           ID.gold,
  background:      IMMERSE.goldTint,
  fontWeight:      700,
}

const greenStarGlyphStyle: React.CSSProperties = {
  color:    GREEN_STAR_COLOR,
  fontSize: 16,
  lineHeight: 1,
}

const fiftyPillStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '5px 10px',
  fontSize:      10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  border:        `1px solid ${IMMERSE.tableBorder}`,
  color:         ID.text,
  background:    'rgba(255,255,255,0.04)',
  fontWeight:    600,
}

const keyStripStyle: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        24,
  padding:    '14px 18px',
  border:     `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 22,
  background:  'rgba(255,255,255,0.02)',
  marginBottom: 18,
  flexWrap:    'wrap',
}

const keyLabelStyle: React.CSSProperties = {
  color:         ID.gold,
  fontSize:      10.5,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight:    600,
  flexShrink:    0,
}

const keyItemsStyle: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        22,
  flexWrap:   'wrap',
}

const keyItemStyle: React.CSSProperties = {
  display:    'inline-flex',
  alignItems: 'center',
  gap:        8,
}

const keyGlyphSlotStyle: React.CSSProperties = {
  display:    'inline-flex',
  alignItems: 'center',
  minWidth:   24,
}

const keyTextStyle: React.CSSProperties = {
  color:         ID.muted,
  fontSize:      12,
  letterSpacing: '0.02em',
}