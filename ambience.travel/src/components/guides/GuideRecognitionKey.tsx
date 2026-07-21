/* GuideRecognitionKey.tsx - recognition marks for the guide layer.
 *
 * Single source of truth for what each recognition mark means:
 *   {'\u25C6'} Highlighted
 *   {'\u2605'} Michelin Stars
 *   BIB Bib Gourmand
 *   Green Star
 *   50 Best
 *   Michelin Keys
 *
 * What it owns:
 *   - GuideRecognitionKeyStrip - page-top legend
 *   - GuideRecognitionMark - single-mark pill with hover tooltip
 *   - deriveRecognitionKindsFromVenues - dining-specific helper
 *
 * What it does not own:
 *   - The card that renders a mark (GuideCardDining, GuideCardHotels)
 *   - The recognition data (comes from the venue/hotel row)
 *
 * Cross-variant use: dining cards use every mark except keys. Hotel cards
 * use keys. deriveRecognitionKindsFromVenues is dining-only for now; a
 * hotels equivalent will land when the strip appears on the hotels page.
 *
 * Last updated: S53 - Renamed to convention (was RecognitionKey). Exports
 *   renamed to GuideRecognitionMark, GuideRecognitionKeyStrip. Behaviour
 *   unchanged.
 * Prior: S53C - Added 'keys' kind. Michelin Keys (hotel distinction, 1-3)
 *   render as N gold key glyphs, matching the stars idiom.
 * Prior: S40B - Added 'highlighted' kind.
 * Prior: S37 - initial.
 */

import React from 'react'
import { ID, IMMERSE } from '../../tokens/tokensLanding'
import type { DiningVenue } from '../../queries/queriesGuidesDining'

export const GREEN_STAR_COLOR = '#3aa55a'

// ── Definitions ──────────────────────────────────────────────────────────────

export type RecognitionKind =
  | 'highlighted'
  | 'stars'
  | 'bib'
  | 'green'
  | 'fifty_best'
  | 'keys'

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
  keys: {
    kind:        'keys',
    shortLabel:  'Michelin Keys',
    description: 'The MICHELIN Key distinguishes the most outstanding hotels. One to three Keys.',
  },
}

// ── Single mark renderer ─────────────────────────────────────────────────────

interface GuideRecognitionMarkProps {
  kind:       RecognitionKind
  starCount?: number
  keyCount?:  number
}

export function GuideRecognitionMark({ kind, starCount, keyCount }: GuideRecognitionMarkProps) {
  const def         = RECOGNITION_DEFS[kind]
  const tooltipText = `${def.shortLabel}: ${def.description}`

  return (
    <span style={markWrapperStyle} title={tooltipText} aria-label={tooltipText}>
      <MarkGlyph kind={kind} starCount={starCount} keyCount={keyCount} />
    </span>
  )
}

// ── Michelin Key glyph ───────────────────────────────────────────────────────
// Matched to the connecting-suites svg weight in ImmerseHotelOptions.

function KeyGlyph() {
  return (
    <svg width='13' height='13' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' style={{ display: 'block' }}>
      <circle cx='5' cy='5' r='3.1' stroke={ID.gold} strokeWidth='1.3' />
      <path d='M7.2 7.2L13 13M11 11l1.4-1.4M9.4 9.4l1.2-1.2' stroke={ID.gold} strokeWidth='1.3' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}

// ── Mark glyph dispatch ──────────────────────────────────────────────────────

function MarkGlyph({
  kind,
  starCount,
  keyCount,
}: {
  kind:       RecognitionKind
  starCount?: number
  keyCount?:  number
}) {
  if (kind === 'highlighted') {
    return <span style={ambiencePillStyle}>{'\u25C6'}</span>
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
  if (kind === 'keys') {
    const count = Math.max(1, Math.min(3, keyCount ?? 1))
    return (
      <span style={keysGlyphStyle}>
        {Array.from({ length: count }).map((_, i) => <KeyGlyph key={i} />)}
      </span>
    )
  }
  return null
}

// ── Page-top key strip ───────────────────────────────────────────────────────

export interface GuideRecognitionKeyStripProps {
  presentKinds: Set<RecognitionKind>
}

export function GuideRecognitionKeyStrip({ presentKinds }: GuideRecognitionKeyStripProps) {
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

// ── Helper: dining-specific derivation from venue set ────────────────────────

export function deriveRecognitionKindsFromVenues(venues: DiningVenue[]): Set<RecognitionKind> {
  const set = new Set<RecognitionKind>()
  for (const v of venues) {
    if (v.isHighlighted)                                set.add('highlighted')
    if (v.michelinAward === 'star' && v.michelinStars) set.add('stars')
    if (v.michelinAward === 'bib_gourmand')             set.add('bib')
    if (v.michelinGreenStar)                           set.add('green')
    if (v.worlds50Best)                                set.add('fifty_best')
  }
  return set
}

// ── Styles ───────────────────────────────────────────────────────────────────

const markWrapperStyle: React.CSSProperties = {
  display:    'inline-flex',
  alignItems: 'center',
  cursor:     'help',
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
  color:         ID.gold,
  fontSize:      16,
  letterSpacing: '0.05em',
  lineHeight:    1,
}

const bibPillStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '5px 10px',
  fontSize:      10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  border:        `1px solid ${IMMERSE.goldBorder}`,
  color:         ID.gold,
  background:    IMMERSE.goldTint,
  fontWeight:    700,
}

const greenStarGlyphStyle: React.CSSProperties = {
  color:      GREEN_STAR_COLOR,
  fontSize:   16,
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

const keysGlyphStyle: React.CSSProperties = {
  display:      'inline-flex',
  alignItems:   'center',
  gap:          3,
  borderRadius: 999,
  padding:      '5px 9px',
  border:       `1px solid ${IMMERSE.goldBorder}`,
  background:   IMMERSE.goldTint,
  lineHeight:   1,
}

const keyStripStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          24,
  padding:      '14px 18px',
  border:       `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 22,
  background:   'rgba(255,255,255,0.02)',
  marginBottom: 18,
  flexWrap:     'wrap',
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