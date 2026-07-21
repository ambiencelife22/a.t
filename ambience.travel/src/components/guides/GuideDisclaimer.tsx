/* GuideDisclaimer.tsx - accuracy disclaimer block for guide pages.
 *
 * Single source of truth for the disclaimer rendered below each guide's
 * venue grid. Variant-specific subject noun comes from GUIDE_COPY.
 * Date renders via formatMonthYear (Month YYYY) - never raw ISO.
 *
 * What it owns:
 *   - Disclaimer prose (subject noun + accuracy date + caveats)
 *   - Date formatting via formatMonthYear
 *   - Wrapper + text styles
 *
 * What it does not own:
 *   - Whether to render (caller gates on overlay?.accuracyDate)
 *   - Overlay fetch (each GuidePage<X> owns this)
 *   - Style tokens (stylesGuidePage)
 *
 * Subject noun per variant (from GUIDE_COPY.disclaimerSubject):
 *   dining      - "The venues and recognition"
 *   experiences - "The experiences"
 *   hotels      - "The hotels"
 *   shopping    - "The shops"
 *
 * Last updated: S53 - Extracted from four guide pages. Previously each page
 *   inlined its own disclaimer prose with a raw accuracy_date render.
 *   Now one component, one formatter, one source of truth.
 */

import React from 'react'
import { formatMonthYear } from '../../utils/utilsDates'
import type { GuideVariant } from '../../types/typesGuides'
import { disclaimerStyle, disclaimerTextStyle } from '../../styles/stylesGuidePage'

// ── Subject noun per variant ─────────────────────────────────────────────────

const DISCLAIMER_SUBJECT: Record<GuideVariant, string> = {
  dining:      'The venues and recognition listed in this guide',
  experiences: 'The experiences listed in this guide',
  hotels:      'The hotels listed in this guide',
  shopping:    'The shops listed in this guide',
}

const DISCLAIMER_CAVEAT: Record<GuideVariant, string> = {
  dining:      'The dining industry evolves continuously; restaurants close, chefs move, and accolades are reassigned. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.',
  experiences: 'Availability, pricing, and operators change. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading.',
  hotels:      'Availability, rates, and ownership change. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.',
  shopping:    'Availability and operators change. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading.',
}

// ── Props ────────────────────────────────────────────────────────────────────

interface GuideDisclaimerProps {
  variant:      GuideVariant
  accuracyDate: string  // ISO YYYY-MM-DD - caller gates on non-null
}

// ── Component ────────────────────────────────────────────────────────────────

export function GuideDisclaimer({ variant, accuracyDate }: GuideDisclaimerProps) {
  return (
    <div style={disclaimerStyle}>
      <p style={disclaimerTextStyle}>
        {DISCLAIMER_SUBJECT[variant]} reflect our knowledge as of {formatMonthYear(accuracyDate)}. {DISCLAIMER_CAVEAT[variant]}
      </p>
    </div>
  )
}