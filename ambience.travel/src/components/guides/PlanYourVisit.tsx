// PlanYourVisit.tsx — Plan Your Visit section for guide pages
// What it owns:
//   - Full-width section render below the venue grid
//   - Fallback copy by guide variant (dining | experiences | accommodation)
//     when overlay fields are null — always renders if mounted
//   - Entrance animation via useVisible + fadeUp from lib/animations
//
// What it does not own:
//   - Overlay data fetching (DiningGuidePage owns this)
//   - Gate logic — caller decides whether to render
//   - Style objects (lib/guidePageStyles.ts)
//
// Fallback copy:
//   dining        — reservation + planning tips, destination-agnostic
//   experiences   — booking + timing tips
//   accommodation — check-in + property tips
//   (extend FALLBACK_COPY as new guide variants ship)
//
// Override vs suppress vs fallback — applies to heading, intro, bullets:
//   null          → use fallback copy (no override set)
//   "" (empty)    → suppress entirely (intentional hide)
//   "some text"   → use override content
//
// Last updated: S49 — empty-string-hide convention applied to heading, intro,
//   and bullets. Matches ?? vs || pattern used across the rest of the codebase.
//   null = fallback, "" = suppress, content = use content.
// Prior: S40 — Created. Full section treatment with gold scan line,
//   serif heading, gold rule, responsive bullet grid. Styles in guidePageStyles.

import React from 'react'
import { useVisible, fadeUp } from '../../utils/utilsAnimations'
import type { DiningGuideOverlay } from '../../queries/queriesGuidesDining'
import {
  pyvSectionStyle,
  pyvScanLineStyle,
  pyvInnerStyle,
  pyvHeaderRowStyle,
  pyvHeaderLeftStyle,
  pyvEyebrowStyle,
  pyvHeadingStyle,
  pyvIntroStyle,
  pyvRuleStyle,
  pyvListStyle,
  pyvItemStyle,
  pyvDotStyle,
  pyvItemTextStyle,
} from '../../styles/stylesGuidePage'

// ── Guide variant type ────────────────────────────────────────────────────────

export type GuideVariant = 'dining' | 'experiences' | 'accommodation'

// ── Fallback copy ─────────────────────────────────────────────────────────────
// Used when overlay fields are null. Destination-agnostic.
// Add a block here when a new guide variant ships.

const FALLBACK_COPY: Record<GuideVariant, {
  heading: string
  intro:   string
  bullets: string[]
}> = {
  dining: {
    heading: 'Plan Your Visit',
    intro:   'A few notes to help you get the most from these tables.',
    bullets: [
      'Reservations at the most considered restaurants open weeks or months ahead. Book before you travel, not after you arrive.',
      'Tasting menus often require a credit card guarantee. Cancellation policies are strict -- treat the booking as a commitment.',
      'Many fine-dining rooms are closed Sunday and Monday. Build flexibility into your week to avoid a blank evening.',
      'Lunch is frequently the better value at high-end establishments -- same kitchen, shorter format, lower price.',
      'If a table is full, ask to be added to a cancellation list. Last-minute spots open more often than you might expect.',
    ],
  },
  experiences: {
    heading: 'Plan Your Visit',
    intro:   'A few notes to help you get the most from these experiences.',
    bullets: [
      'Availability for the most sought-after experiences is limited. Confirm your dates and book in advance.',
      'Weather and seasonality shape what is possible. Check conditions for outdoor or water-based activities before finalising.',
      'Private or small-group formats almost always deliver a better experience than open bookings. Ask about availability.',
      'Arrival time matters. Most experiences reward guests who arrive early, composed, and without other plans pressing.',
      'Confirm what is included and what is not before you arrive. Gratuity, transport, and equipment are often separate.',
    ],
  },
  accommodation: {
    heading: 'Plan Your Visit',
    intro:   'A few notes to help you settle in smoothly.',
    bullets: [
      'Check-in times vary. If you are arriving early or late, inform the property in advance -- most will accommodate with notice.',
      'Confirm what is included in your stay: breakfast, transfers, and resort fees are often handled separately.',
      'For properties with limited connectivity, download any offline maps or reading material before you arrive.',
      'Concierge teams at smaller properties can arrange things that are not listed anywhere. Ask early in your stay, not the night before.',
      'Late check-out is often available if the room is not needed immediately. A quiet word the evening before is usually enough.',
    ],
  },
}

// ── Override resolution ───────────────────────────────────────────────────────
// null    → use fallback (no override set)
// ""      → suppress (intentional hide, renders nothing)
// content → use override

function resolveField(override: string | null | undefined, fallback: string): string | null {
  if (override === '')   return null       // explicit suppress
  if (override == null)  return fallback   // no override — use fallback
  return override.trim() || fallback       // whitespace-only treated as no override
}

function resolveBullets(override: string[] | null | undefined, fallback: string[]): string[] {
  if (override === null)              return fallback   // no override — use fallback
  if (override !== undefined && override.length === 0) return []  // explicit empty array = suppress
  return override ?? fallback
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlanYourVisitProps {
  overlay: DiningGuideOverlay | null
  variant: GuideVariant
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlanYourVisit({ overlay, variant }: PlanYourVisitProps) {
  const { ref, visible } = useVisible(0.12)
  const fallback = FALLBACK_COPY[variant]

  const heading = resolveField(overlay?.plan_your_visit_heading, fallback.heading)
  const intro   = resolveField(overlay?.plan_your_visit_intro,   fallback.intro)
  const bullets = resolveBullets(overlay?.plan_your_visit_bullets, fallback.bullets)

  // Nothing to render — all fields suppressed
  if (!heading && !intro && !bullets.length) return null

  return (
    <section ref={ref} style={pyvSectionStyle}>

      {visible && <div style={pyvScanLineStyle} aria-hidden />}

      <div style={pyvInnerStyle}>

        <div style={{ ...fadeUp(visible, 0), ...pyvHeaderRowStyle }}>
          <div style={pyvHeaderLeftStyle}>
            <p style={pyvEyebrowStyle}>Guide</p>
            {heading && <h2 style={pyvHeadingStyle}>{heading}</h2>}
          </div>
          {intro && <p style={pyvIntroStyle}>{intro}</p>}
        </div>

        <div style={{ ...fadeUp(visible, 80), ...pyvRuleStyle }} aria-hidden />

        {bullets.length > 0 && (
          <ul style={{ ...fadeUp(visible, 140), ...pyvListStyle }}>
            {bullets.map((b, i) => (
              <li key={i} style={pyvItemStyle}>
                <span style={pyvDotStyle} aria-hidden>·</span>
                <span style={pyvItemTextStyle}>{b}</span>
              </li>
            ))}
          </ul>
        )}

      </div>
    </section>
  )
}