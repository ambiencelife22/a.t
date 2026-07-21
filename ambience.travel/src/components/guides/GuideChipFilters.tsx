/* GuideChipFilters.tsx - shared chip-based filter row.
 *
 * Renders a horizontal row of pill chips: one "All" chip followed by one
 * chip per option. Used by ShoppingGuidePage (shop_type) and
 * ExperiencesGuidePage (experience_category).
 *
 * Extracted from those two page files, which each shipped an identical
 * Chip component, filtersStyle, and CategoryFilters/ShopTypeFilters shell.
 * DiningGuideFilters is more complex (cuisine set + michelin toggle +
 * highlighted toggle) and stays in its own file.
 *
 * What it owns:
 *   - GuideChipFilters component
 *   - Chip subcomponent + style
 *
 * What it does not own:
 *   - Filter state (per-page filter shape stays per-page)
 *   - The complex dining filter row (DiningGuideFilters)
 */

import React from 'react'
import { ID, IMMERSE } from '../../tokens/tokensLanding'

interface GuideChipFiltersProps {
  options:    string[]
  active:     string | null
  onChange:   (option: string | null) => void
  ariaLabel:  string
}

export function GuideChipFilters({ options, active, onChange, ariaLabel }: GuideChipFiltersProps) {
  if (options.length <= 1) return null
  return (
    <nav style={rowStyle} aria-label={ariaLabel}>
      <Chip active={active === null} onClick={() => onChange(null)}>All</Chip>
      {options.map(o => (
        <Chip key={o} active={active === o} onClick={() => onChange(o)}>{o}</Chip>
      ))}
    </nav>
  )
}

interface ChipProps {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius:  999,
        padding:       '10px 14px',
        fontSize:      13,
        fontFamily:    'inherit',
        cursor:        'pointer',
        transition:    'background 180ms ease, color 180ms ease, border-color 180ms ease',
        letterSpacing: '0.005em',
        ...(active ? {
          border:     `1px solid ${ID.text}`,
          background: ID.text,
          color:      '#141610',
          fontWeight: 600,
        } : {
          border:     `1px solid ${IMMERSE.tableBorder}`,
          color:      '#d7cfbf',
          background: 'rgba(255,255,255,0.025)',
        }),
      }}
    >
      {children}
    </button>
  )
}

const rowStyle: React.CSSProperties = {
  display:      'flex',
  gap:          10,
  flexWrap:     'wrap',
  padding:      16,
  border:       `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 26,
  background:   'rgba(255,255,255,0.03)',
  marginBottom: 26,
}