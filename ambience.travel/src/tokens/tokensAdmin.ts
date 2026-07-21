// adminTokens.ts - Admin palette for AmbienceAdmin.
//
// S33 update: A is now a derived view over the canonical immerse tokens
// (ID + IMMERSE in landingColors.ts). The A.foo API stays identical so all
// admin components (AmbienceAdmin, AdminSidebar, EngagementsListTab,
// EngagementDetailTab, ShowcasesListTab) keep working unchanged.
//
// Visual shift is intentional - admin moves from neutral-cool to ID's
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
//   A.font       → Plus Jakarta Sans (admin sans default - landingColors.FONTS
//                  only carries serif today; sans is admin-only for now)
//
// Last updated: S33

import { ID, IMMERSE } from './tokensLanding'

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

  // Task status axis - semantic, so status colour reads as status and stays
  // distinct from A.gold (the brand accent, used for links/actions). Tints are
  // the base colour at low alpha for subtle borders. Single source: both task
  // surfaces (TasksSection, GlobalTasksTab) reference these, never raw hex.
  statusOpen:        IMMERSE.warning,      // canonical amber - "needs action"
  statusDone:        IMMERSE.positive,     // '#4ade80'
  statusDismissed:   ID.dim,               // muted / set aside (same as A.faint)
  statusOverdue:     IMMERSE.danger,       // '#ef4444'
  statusOpenTint:    '#fbbf2440',          // amber @ 25% - button borders
  statusDoneTint:    '#4ade8040',
  statusDismissedTint: '#938c8140',   // ID.dim @ 25%
  statusOverdueTint: '#ef444433',          // danger @ 20% - overdue row border
} as const