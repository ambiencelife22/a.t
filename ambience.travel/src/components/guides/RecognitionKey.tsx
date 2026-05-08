// RecognitionKey.tsx — shared recognition definitions for dining guide
// What it owns:
//   - The single source of truth for what each recognition mark means
//     (★ stars, BIB Gourmand, Green Star, 50 Best)
//   - <RecognitionKeyStrip /> — discreet page-top legend, renders only when
//     at least one venue in scope carries any recognition
//   - <RecognitionMark /> — single-mark pill with hover tooltip, used inside
//     DiningCard so users hovering any pill see the same definition string
//
// What it does not own:
//   - Filter logic (DiningGuidePage decides what's in scope)
//   - Card rendering (DiningCard composes Mark instances)
//   - PDF rendering (guidePdf.ts has its own static key beneath At a Glance)
//
// Last updated: S37 — Initial ship.

import React from 'react'
import { ID, IMMERSE } from '../../lib/landingColors'

// Green Star color — sustainability tone, distinct from gold.
// Slightly darker than IMMERSE.positive so it reads on cream / dark surface mix.
export const GREEN_STAR_COLOR = '#3aa55a'

// ── Definitions (single source of truth) ─────────────────────────────────────

export type RecognitionKind = 'stars' | 'bib' | 'green' | 'fifty_best'

interface RecognitionDef {
  kind: RecognitionKind
  shortLabel: string   // shown beside glyph in key strip + as tooltip header
  description: string  // tooltip body / key strip subtitle
}

const RECOGNITION_DEFS: Record<RecognitionKind, RecognitionDef> = {
  stars: {
    kind: 'stars',
    shortLabel: 'Michelin Stars',
    description: 'Awarded by the Michelin Guide for exceptional cooking. One to three stars.',
  },
  bib: {
    kind: 'bib',
    shortLabel: 'Bib Gourmand',
    description: 'Michelin recognition for high-quality cooking at moderate prices.',
  },
  green: {
    kind: 'green',
    shortLabel: 'Michelin Green Star',
    description: 'Awarded for outstanding commitment to sustainable gastronomy.',
  },
  fifty_best: {
    kind: 'fifty_best',
    shortLabel: 'World\u2019s 50 Best',
    description: 'Listed on The World\u2019s 50 Best Restaurants guide.',
  },
}

// ── Single mark renderer (with hover tooltip) ────────────────────────────────
// Used inside DiningCard for each pill the venue carries.

interface RecognitionMarkProps {
  kind: RecognitionKind
  /** When kind = 'stars', the count (1-3). Ignored for other kinds. */
  starCount?: number
}

export function RecognitionMark({ kind, starCount }: RecognitionMarkProps) {
  const def = RECOGNITION_DEFS[kind]
  const tooltipText = `${def.shortLabel} \u2014 ${def.description}`

  return (
    <span style={markWrapperStyle} title={tooltipText} aria-label={tooltipText}>
      <MarkGlyph kind={kind} starCount={starCount} />
    </span>
  )
}

function MarkGlyph({ kind, starCount }: { kind: RecognitionKind; starCount?: number }) {
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
    return <span style={fiftyPillStyle}>50 Best</span>
  }
  return null
}

// ── Page-top key strip ───────────────────────────────────────────────────────
// Discreet legend renders above filters. Only includes marks that appear in
// the supplied list — no point explaining glyphs the user won't see.

export interface RecognitionKeyStripProps {
  /**
   * The set of recognition kinds present in the current venue list.
   * Strip renders nothing when empty.
   */
  presentKinds: Set<RecognitionKind>
}

export function RecognitionKeyStrip({ presentKinds }: RecognitionKeyStripProps) {
  if (presentKinds.size === 0) return null

  // Order matters — stars first (most prestigious), then Bib, Green, 50 Best.
  const order: RecognitionKind[] = ['stars', 'bib', 'green', 'fifty_best']
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

// ── Helper: derive present kinds from a venue list ───────────────────────────

import type { DiningVenue } from '../../lib/diningGuideQueries'

export function deriveRecognitionKindsFromVenues(venues: DiningVenue[]): Set<RecognitionKind> {
  const set = new Set<RecognitionKind>()
  for (const v of venues) {
    if (v.michelin_award === 'star' && v.michelin_stars) set.add('stars')
    if (v.michelin_award === 'bib_gourmand') set.add('bib')
    if (v.michelin_green_star) set.add('green')
    if (v.worlds_50_best) set.add('fifty_best')
  }
  return set
}

// ── Styles ───────────────────────────────────────────────────────────────────

const markWrapperStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'help',
}

const starsGlyphStyle: React.CSSProperties = {
  color: ID.gold,
  fontSize: 16,
  letterSpacing: '0.05em',
  lineHeight: 1,
}

const bibPillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  border: `1px solid ${IMMERSE.goldBorder}`,
  color: ID.gold,
  background: IMMERSE.goldTint,
  fontWeight: 700,
}

const greenStarGlyphStyle: React.CSSProperties = {
  color: GREEN_STAR_COLOR,
  fontSize: 16,
  lineHeight: 1,
}

const fiftyPillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  border: `1px solid ${IMMERSE.tableBorder}`,
  color: ID.text,
  background: 'rgba(255,255,255,0.04)',
  fontWeight: 600,
}

const keyStripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  padding: '14px 18px',
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.02)',
  marginBottom: 18,
  flexWrap: 'wrap',
}

const keyLabelStyle: React.CSSProperties = {
  color: ID.gold,
  fontSize: 10.5,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 600,
  flexShrink: 0,
}

const keyItemsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 22,
  flexWrap: 'wrap',
}

const keyItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const keyGlyphSlotStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 24,
}

const keyTextStyle: React.CSSProperties = {
  color: ID.muted,
  fontSize: 12,
  letterSpacing: '0.02em',
}