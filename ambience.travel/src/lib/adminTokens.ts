// adminTokens.ts — Admin palette for AmbienceAdmin.
//
// S33 update: A is now a derived view over the canonical immerse tokens
// (ID + IMMERSE in landingColors.ts). The A.foo API stays identical so all
// admin components (AmbienceAdmin, AdminSidebar, EngagementsListTab,
// EngagementDetailTab, ShowcasesListTab) keep working unchanged.
//
// Visual shift is intentional — admin moves from neutral-cool to ID's
// warmer cream cast, aligned with the immerse surface. ProgrammeAdmin still
// uses its own local A constant; the two admins will look slightly different
// side-by-side until ProgrammeAdmin migrates too.
//
// Mapping rationale:
//   A.bg         → ID.bg            (canonical immerse background)
//   A.bgCard     → ID.panel
//   A.bgInput    → ID.panel2
//   A.border     → ID.line
//   A.borderGold → IMMERSE.goldBorder (canonical gold border at 0.34)
//   A.text       → ID.text          (warm cream, not neutral white)
//   A.muted      → ID.muted         (warm muted)
//   A.faint      → ID.dim           (warm dim)
//   A.gold       → ID.gold          (canonical immerse gold)
//   A.danger     → IMMERSE.danger   (added in S33)
//   A.positive   → IMMERSE.positive (added in S33)
//   A.font       → Plus Jakarta Sans (admin sans default — landingColors.FONTS
//                  only carries serif today; sans is admin-only for now)
//
// Last updated: S33

import { ID, IMMERSE } from './landingColors'

export const A = {
  bg:         ID.bg,
  bgCard:     ID.panel,
  bgInput:    ID.panel2,
  border:     ID.line,
  borderGold: IMMERSE.goldBorder,
  text:       ID.text,
  muted:      ID.muted,
  faint:      ID.dim,
  gold:       ID.gold,
  danger:     IMMERSE.danger,
  positive:   IMMERSE.positive,
  font:       "'Plus Jakarta Sans', sans-serif",
} as const