/* GuideComingUpSection.tsx — "Coming up in {destination}" section.
 *
 * Rendered inside every guide page (dining, experiences, shopping, hotels)
 * to surface time-bound content (pop-ups, chef residencies, capsule
 * launches, hotel takeovers, seasonal openings).
 *
 * What it owns: section title, count, grid of GuideCardHappening.
 * What it does not own: happenings fetch (each GuidePage<X> owns this),
 *   whether the section is mounted (caller decides via shouldShowAdvisorExtras).
 *
 * Renders silently when the happenings array is empty.
 *
 * Last updated: S53 — Renamed to convention (was ComingUpSection). Imports
 *   GuideCardHappening. Behaviour unchanged.
 * Prior: S52 — extracted for shared use across variants.
 */

import React from 'react'
import {
  sectionTitleStyle,
  sectionTitleH2Style,
  sectionTitleCountStyle,
  gridStyle,
} from '../../styles/stylesGuidePage'
import { GuideCardHappening } from './GuideCardHappening'
import type { Happening } from '../../queries/queriesGuidesHappenings'

interface GuideComingUpSectionProps {
  happenings:      Happening[]
  hasFullAccess:   boolean
  destinationName: string
}

export function GuideComingUpSection({
  happenings,
  hasFullAccess,
  destinationName,
}: GuideComingUpSectionProps) {
  if (happenings.length === 0) return null

  return (
    <section
      style={{ marginBottom: 40 }}
      aria-label={`Time-bound happenings in ${destinationName}`}
    >
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
          <GuideCardHappening
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