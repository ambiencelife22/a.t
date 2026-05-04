// GuideFilters.tsx — pill row of filter chips for the dining guide
// What it owns: chip rendering, multi-select state, URL param sync.
// What it does not own: filtered-result computation (parent owns that).
// Last updated: S35

import React from 'react'
import { ID, IMMERSE } from '../../lib/landingColors'

export interface FilterState {
  cuisines: Set<string>
  michelinOnly: boolean
  neighborhoods: Set<string>
}

export interface FilterChipsProps {
  state: FilterState
  onChange: (next: FilterState) => void
  availableCuisines: string[]
  availableNeighborhoods: string[]
  hasMichelinItems: boolean
}

export function DiningGuideFilters({
  state,
  onChange,
  availableCuisines,
  availableNeighborhoods,
  hasMichelinItems,
}: FilterChipsProps) {
  const isAllActive =
    state.cuisines.size === 0 &&
    !state.michelinOnly &&
    state.neighborhoods.size === 0

  function handleAll() {
    onChange({
      cuisines: new Set(),
      michelinOnly: false,
      neighborhoods: new Set(),
    })
  }

  function toggleCuisine(c: string) {
    const next = new Set(state.cuisines)
    if (next.has(c)) {
      next.delete(c)
    }
    if (!state.cuisines.has(c)) {
      next.add(c)
    }
    onChange({ ...state, cuisines: next })
  }

  function toggleMichelin() {
    onChange({ ...state, michelinOnly: !state.michelinOnly })
  }

  function toggleNeighborhood(n: string) {
    const next = new Set(state.neighborhoods)
    if (next.has(n)) {
      next.delete(n)
    }
    if (!state.neighborhoods.has(n)) {
      next.add(n)
    }
    onChange({ ...state, neighborhoods: next })
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
      {availableNeighborhoods.map((n) => (
        <Chip
          key={n}
          active={state.neighborhoods.has(n)}
          onClick={() => toggleNeighborhood(n)}
        >
          {n}
        </Chip>
      ))}
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