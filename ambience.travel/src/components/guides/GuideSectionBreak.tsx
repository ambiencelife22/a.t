// GuideSectionBreak.tsx - editorial section break for grouped guide venues
// What it owns: visual chapter break between primary, supplementary, and
//   recently closed venue groups. Sits between groups in the dining guide
//   grid via gridColumn '1 / -1'.
// What it does not own: which venues belong where (DiningGuidePage owns
//   the grouping), the styling tokens (stylesGuidePage owns those).
//
// Visual treatment:
//   - Generous vertical breathing room (announces the chapter)
//   - Gold top rule across full content width
//   - Eyebrow + serif heading (same register as the main "Selected tables")
//   - Descriptor line below explaining the section's role
//
// Used by: DiningGuidePage for "Also nearby" + "Recently closed" sections.
//
// Last updated: S52 - Created to replace the lightweight inline divider.
//   Treats supplementary + recently closed as deliberate editorial sections
//   rather than row separators.

import React from 'react'
import {
  sectionBreakStyle,
  sectionBreakEyebrowStyle,
  sectionBreakHeadingStyle,
  sectionBreakDescriptorStyle,
} from '../../styles/stylesGuidePage'

interface GuideSectionBreakProps {
  eyebrow:    string
  heading:    string
  descriptor: string
}

export function GuideSectionBreak({ eyebrow, heading, descriptor }: GuideSectionBreakProps) {
  return (
    <div style={sectionBreakStyle}>
      <div style={sectionBreakEyebrowStyle}>{eyebrow}</div>
      <h2 style={sectionBreakHeadingStyle}>{heading}</h2>
      <p style={sectionBreakDescriptorStyle}>{descriptor}</p>
    </div>
  )
}