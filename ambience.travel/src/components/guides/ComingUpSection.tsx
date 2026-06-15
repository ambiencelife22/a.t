// ComingUpSection.tsx — shared "Coming up in {destination}" section
//
// Used by ExperiencesGuidePage AND DiningGuidePage (and any future guide
// page that surfaces time-bound destination content). Extracted from
// ExperiencesGuidePage in S52 once dining-flavored happenings (pop-ups,
// chef residencies) joined the architecture.
//
// What it owns: section title, count, grid of HappeningCards.
// What it does not own: happenings data fetch (caller's job), gating
//   (caller decides whether to mount this component at all).
//
// Renders silently when happenings array is empty.
//
// Last updated: S52 — extracted from ExperiencesGuidePage for shared use.

import React from 'react'
import {
  sectionTitleStyle,
  sectionTitleH2Style,
  sectionTitleCountStyle,
  gridStyle,
} from '../../styles/stylesGuidePage'
import { HappeningCard } from './HappeningCard'
import type { Happening } from '../../queries/queriesGuidesHappenings'

interface ComingUpSectionProps {
  happenings:      Happening[]
  hasFullAccess:   boolean
  destinationName: string
}

export function ComingUpSection({
  happenings, hasFullAccess, destinationName,
}: ComingUpSectionProps) {
  if (happenings.length === 0) return null
  return (
    <section style={{ marginBottom: 40 }} aria-label={`Time-bound happenings in ${destinationName}`}>
      <div style={sectionTitleStyle}>
        <div>
          <h2 style={sectionTitleH2Style}>Coming up in {destinationName}</h2>
          <p style={sectionTitleCountStyle}>
            {happenings.length}{' '}
            {happenings.length === 1 ? 'happening' : 'happenings'}
          </p>
        </div>
      </div>
      <div style={{
        ...gridStyle,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 540px), 1fr))',
      }}>
        {happenings.map(h => (
          <HappeningCard
            key={h.id}
            happening={h}
            hasFullAccess={hasFullAccess}
            destinationName={destinationName}
          />
        ))}
      </div>
    </section>
  )
}