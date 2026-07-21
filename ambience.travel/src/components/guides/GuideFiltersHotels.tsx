/* GuideFiltersHotels.tsx - chip filters for the hotels guide page.
 *
 * Filters: minimum stars (4+ / 5+), Forbes-rated only, Preferred Partners only.
 * Chips hide when no hotels in the result set carry the relevant flag.
 *
 * What it owns: filter row chrome, chip components + styling, clear-all button.
 * What it does not own: filter state (parent owns HotelFilterState).
 *
 * Last updated: S53 - Renamed to convention. Behaviour unchanged.
 * Prior: S37 - initial.
 */

import React from 'react'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'

export interface HotelFilterState {
  minStars:     number | null
  forbesOnly:   boolean
  partnersOnly: boolean
}

interface GuideFiltersHotelsProps {
  state:       HotelFilterState
  onChange:    (next: HotelFilterState) => void
  hasForbes:   boolean
  hasPartners: boolean
}

export function GuideFiltersHotels({ state, onChange, hasForbes, hasPartners }: GuideFiltersHotelsProps) {
  function setMinStars(v: number | null) {
    onChange({ ...state, minStars: v })
  }
  function toggleForbes() {
    onChange({ ...state, forbesOnly: !state.forbesOnly })
  }
  function togglePartners() {
    onChange({ ...state, partnersOnly: !state.partnersOnly })
  }
  function clear() {
    onChange({ minStars: null, forbesOnly: false, partnersOnly: false })
  }

  const hasAny = state.minStars !== null || state.forbesOnly || state.partnersOnly

  return (
    <div style={wrapStyle}>
      <div style={groupStyle}>
        <span style={groupLabelStyle}>Stars</span>
        <Chip active={state.minStars === 5} onClick={() => setMinStars(state.minStars === 5 ? null : 5)}>
          5{'\u2605'} only
        </Chip>
        <Chip active={state.minStars === 4} onClick={() => setMinStars(state.minStars === 4 ? null : 4)}>
          4{'\u2605'} +
        </Chip>
      </div>

      {hasForbes && (
        <div style={groupStyle}>
          <Chip active={state.forbesOnly} onClick={toggleForbes}>
            Forbes-rated
          </Chip>
        </div>
      )}

      {hasPartners && (
        <div style={groupStyle}>
          <Chip active={state.partnersOnly} onClick={togglePartners}>
            Preferred Partners
          </Chip>
        </div>
      )}

      {hasAny && (
        <button type="button" onClick={clear} style={clearStyle}>
          Clear all
        </button>
      )}
    </div>
  )
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...chipStyle,
        background:  active ? IMMERSE.goldTint    : 'rgba(255,255,255,0.04)',
        borderColor: active ? IMMERSE.goldBorder  : IMMERSE.tableBorder,
        color:       active ? ID.gold             : '#d8d1c1',
      }}
    >
      {children}
    </button>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  display:      'flex',
  flexWrap:     'wrap',
  gap:          18,
  alignItems:   'center',
  margin:       '0 4px 28px',
  padding:      '18px 20px',
  border:       `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 22,
  background:   'rgba(255,255,255,0.025)',
}

const groupStyle: React.CSSProperties = {
  display:    'flex',
  flexWrap:   'wrap',
  alignItems: 'center',
  gap:        8,
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily:    FONTS.serif,
  fontSize:      13,
  color:         ID.muted,
  letterSpacing: '0.04em',
  marginRight:   4,
}

const chipStyle: React.CSSProperties = {
  borderRadius:  999,
  padding:       '8px 14px',
  fontSize:      12,
  letterSpacing: '0.04em',
  border:        '1px solid transparent',
  cursor:        'pointer',
  transition:    'background 200ms ease, color 200ms ease, border-color 200ms ease',
  fontFamily:    "'Plus Jakarta Sans', sans-serif",
}

const clearStyle: React.CSSProperties = {
  marginLeft:     'auto',
  background:     'transparent',
  border:         'none',
  color:          ID.muted,
  fontSize:       12,
  letterSpacing:  '0.04em',
  cursor:         'pointer',
  textDecoration: 'underline',
  fontFamily:     "'Plus Jakarta Sans', sans-serif",
}