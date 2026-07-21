/* GuidePlanYourVisit.tsx - Plan Your Visit section for guide pages.
 *
 * What it owns:
 *   - Full-width section render below the venue grid
 *   - Fallback copy by guide variant (dining, experiences, hotels, shopping)
 *     when overlay fields are null, always renders if mounted
 *   - Entrance animation via useVisible + fadeUp from utilsAnimations
 *
 * What it does not own:
 *   - Overlay data fetching (each GuidePage<X> owns this)
 *   - Gate logic - caller decides whether to render
 *   - Style objects (stylesGuidePage.ts)
 *   - Variant union (typesGuides.GuideVariant is the single source of truth)
 *   - Overlay shape (typesGuides.GuideOverlay is the single source of truth)
 *
 * Fallback copy per variant (extend FALLBACK_COPY when a new variant ships):
 *   dining        - reservation + planning tips
 *   experiences   - booking + timing tips
 *   hotels        - check-in + property tips
 *   shopping      - maison + atelier tips
 *
 * Override vs suppress vs fallback for heading, intro, bullets:
 *   null          - use fallback copy (no override set)
 *   ""            - suppress entirely (intentional hide)
 *   "some text"   - use override content
 *
 * Last updated: S53 - Renamed to convention (was PlanYourVisit).
 *   Consumers updated to import GuidePlanYourVisit.
 * Prior: S53 - Consumes canonical GuideVariant + GuideOverlay from
 *   typesGuides. Fallback key 'accommodation' renamed to 'hotels' to
 *   match canonical variant naming.
 * Prior: S49 - empty-string-hide convention applied to heading, intro,
 *   and bullets. null = fallback, "" = suppress, content = use content.
 * Prior: S40 - Created.
 */

import React from 'react'
import { useVisible, fadeUp } from '../../utils/utilsAnimations'
import type { GuideOverlay, GuideVariant } from '../../types/typesGuides'
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

// ── Fallback copy ────────────────────────────────────────────────────────────
// Used when overlay fields are null. Destination-agnostic.
// Keys match the GuideVariant union from typesGuides - add a block here
// when a new guide variant ships.

const FALLBACK_COPY: Record<GuideVariant, {
  heading: string
  intro:   string
  bullets: string[]
}> = {
  dining: {
    heading: 'Plan Your Visit',
    intro:   'A few notes on how these tables work.',
    bullets: [
      'The most sought-after tables book weeks out. Worth deciding which tables matter to you before the trip.',
      'Tasting menus typically hold a card on file with strict cancellation windows. Be mindful when committing to a long evening.',
      'Sundays and Mondays are quiet across most of the fine-dining circuit. The week tends to shape itself around that pattern.',
      'Lunch service at the chef-led rooms often runs as the more relaxed window, with the same kitchen at a different rhythm.',
      'Cancellation lists are worth a quiet word with the ma\u00EEtre d\'. Tables open more often than the booking site suggests.',
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
  hotels: {
    heading: 'Plan Your Visit',
    intro:   'A few notes to help you settle in smoothly.',
    bullets: [
      'Check-in times vary. If you are arriving early or late, inform the property in advance. Most will accommodate with notice.',
      'Confirm what is included in your stay. Breakfast, transfers, and resort fees are often handled separately.',
      'For properties with limited connectivity, download any offline maps or reading material before you arrive.',
      'Concierge teams at smaller properties can arrange things that are not listed anywhere. Ask early in your stay, not the night before.',
      'Late check-out is often available if the room is not needed immediately. A quiet word the evening before is usually enough.',
    ],
  },
  shopping: {
    heading: 'Plan Your Visit',
    intro:   'A few notes to help you get the most from these venues.',
    bullets: [
      'Several maisons offer private viewings or after-hours appointments. Pre-arrange where the visit warrants it. The experience is markedly different from a walk-in.',
      'Stock rotates with the season. If a specific piece matters, call ahead to confirm availability before making the journey.',
      'For ateliers offering made-to-measure or private fittings (sandals, jewellery, tailoring), book ahead. Workshop schedules fill weeks in advance during peak season.',
      'Mid-week mornings are calmer than weekend afternoons in any luxury village. Staff have more time and the room is yours.',
      'For purchases made outside your home country, ask about tax refund schemes at the till. Most require paperwork and a stamp at departure.',
    ],
  },
}

// ── Override resolution ──────────────────────────────────────────────────────
// null    → use fallback (no override set)
// ""      → suppress (intentional hide, renders nothing)
// content → use override

function resolveField(override: string | null | undefined, fallback: string): string | null {
  if (override === '')  return null       // explicit suppress
  if (override == null) return fallback   // no override - use fallback
  return override.trim() || fallback      // whitespace-only treated as no override
}

function resolveBullets(override: string[] | null | undefined, fallback: string[]): string[] {
  if (override === null)                               return fallback  // no override - use fallback
  if (override !== undefined && override.length === 0) return []        // explicit empty array = suppress
  return override ?? fallback
}

// ── Props ────────────────────────────────────────────────────────────────────

interface GuidePlanYourVisitProps {
  overlay: GuideOverlay | null
  variant: GuideVariant
}

// ── Component ────────────────────────────────────────────────────────────────

export function GuidePlanYourVisit({ overlay, variant }: GuidePlanYourVisitProps) {
  const { ref, visible } = useVisible(0.12)
  const fallback = FALLBACK_COPY[variant]

  const heading = resolveField(overlay?.planYourVisitHeading, fallback.heading)
  const intro   = resolveField(overlay?.planYourVisitIntro,   fallback.intro)
  const bullets = resolveBullets(overlay?.planYourVisitBullets, fallback.bullets)

  // Nothing to render - all fields suppressed
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
                <span style={pyvDotStyle} aria-hidden>{'\u00B7'}</span>
                <span style={pyvItemTextStyle}>{b}</span>
              </li>
            ))}
          </ul>
        )}

      </div>
    </section>
  )
}