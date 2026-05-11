// DiningGuideFilters.tsx — pill row of filter chips for the dining guide
// What it owns: chip rendering, multi-select cuisine state, Michelin toggle.
// What it does not own: filtered-result computation (parent owns that).
//
// Last updated: S40 — Neighborhoods removed entirely from FilterState and
//   render. Cuisine + Michelin only.
// Prior: S35 — Initial ship.

import React from 'react'
import { ID, IMMERSE } from '../../lib/landingColors'

export interface FilterState {
  cuisines: Set<string>
  michelinOnly: boolean
}

export interface FilterChipsProps {
  state: FilterState
  onChange: (next: FilterState) => void
  availableCuisines: string[]
  hasMichelinItems: boolean
}

export function DiningGuideFilters({
  state,
  onChange,
  availableCuisines,
  hasMichelinItems,
}: FilterChipsProps) {
  const isAllActive = state.cuisines.size === 0 && !state.michelinOnly

  function handleAll() {
    onChange({ cuisines: new Set(), michelinOnly: false })
  }

  function toggleCuisine(c: string) {
    const next = new Set(state.cuisines)
    if (next.has(c)) {
      next.delete(c)
    } else {
      next.add(c)
    }
    onChange({ ...state, cuisines: next })
  }

  function toggleMichelin() {
    onChange({ ...state, michelinOnly: !state.michelinOnly })
  }

  return (
    <nav style={filtersStyle} aria-label="Filter dining venues">
      <Chip active={isAllActive} onClick={handleAll}>All</Chip>
      {availableCuisines.map((c) => (
        <Chip
          key={c}
          active={state.cuisines.has(c)}
          onClick={() => toggleCuisine(c)}
        >
          {c}
        </Chip>
      ))}
      {hasMichelinItems && (
        <Chip active={state.michelinOnly} onClick={toggleMichelin}>
          Michelin
        </Chip>
      )}
    </nav>
  )
}

interface ChipProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...chipBaseStyle,
        ...(active ? chipActiveStyle : chipInactiveStyle),
      }}
    >
      {children}
    </button>
  )
}

const filtersStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  padding: 16,
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 26,
  background: 'rgba(255,255,255,0.03)',
  marginBottom: 26,
}

const chipBaseStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '10px 14px',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
  letterSpacing: '0.005em',
}

const chipInactiveStyle: React.CSSProperties = {
  border: `1px solid ${IMMERSE.tableBorder}`,
  color: '#d7cfbf',
  background: 'rgba(255,255,255,0.025)',
}

const chipActiveStyle: React.CSSProperties = {
  border: `1px solid ${ID.text}`,
  background: ID.text,
  color: '#141610',
  fontWeight: 600,
}