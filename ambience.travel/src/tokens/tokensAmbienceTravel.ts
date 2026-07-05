// tokensAmbienceTravel.ts — Universal branded token spine for the ambience app.
//
// ONE SOURCE. Every color the app renders resolves from the roles below, each
// with a dark and a light value. A mode toggle (future) swaps the active set;
// until it ships, surfaces read their mode explicitly.
//
// LAYERING RULE (hard): this file is the clean root. It imports nothing from
// admin. Admin (tokensAdmin) derives FROM this; public/client surfaces read
// FROM this; NOTHING here reaches into admin. Public never depends on admin.
//
// Provenance: every hex below traces to a pre-existing token in the codebase
// (ID / IMMERSE / theme.ts / WIDGET / tokensProgramme / immerse component
// locals). This file CONSOLIDATES that palette — it introduces no new brand
// color. Where several hexes served one role, one was chosen canonical and the
// merge is marked `// MERGE:`. Genuine cross-product distinctions are kept and
// marked `// DISTINCT:`. Decisions that are D's to ratify are marked
// `// RULING:` with the default applied.
//
// Created: S53N — Branded Token Architecture, pass 1 (the spine).
// Migration onto this spine is staged per-surface (immerse cream = Collapse A7,
// admin = later, programme = later). No component is repointed by this file
// alone; it only establishes the source.

// ── Mode-independent brand truths ─────────────────────────────────────────────
// Values that do NOT change between dark and light. The gold identity, the
// semantic status axis, radii, shadows. Named once, referenced by both modes.

export const BRAND = {
  // Gold — the ambience accent. Immerse/travel gold.
  // MERGE: ID.gold '#d8b56a' is canonical; drifted '#C9A84C' (dead) dropped.
  gold:         '#d8b56a',
  // Light-mode gold — deeper, for contrast on cream. Source: theme.lightPalette.gold.
  goldOnLight:  '#B8960C',
  // DISTINCT: programme/sports product uses its own gold; NOT merged with brand gold.
  goldProgramme: '#E8C547',

  // Semantic status axis — defined HERE (neutral root), so admin no longer pulls
  // danger/positive/warning from the public IMMERSE block. Sources: IMMERSE.*.
  danger:       '#ef4444',   // IMMERSE.danger
  positive:     '#4ade80',   // IMMERSE.positive
  warning:      '#fbbf24',   // IMMERSE.warning
  // P&L-loss / soft-negative (distinct from destructive danger). Source: theme.negative.
  negative:     '#f87171',

  // Radii + shadow — mode-independent. Source: ID.
  radiusXl:     30,
  radiusLg:     22,
  radiusMd:     16,
} as const

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Source: FONTS.serif (canonical) + the sans stack currently inlined across
// immerse components and admin. Unified here.

export const TYPE = {
  serif: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
  sans:  "'Plus Jakarta Sans', sans-serif",
} as const

// ── Role spine ────────────────────────────────────────────────────────────────
// Each role, resolved for both modes. Surfaces read AMBIENCE.dark or
// AMBIENCE.light (the toggle will pick one). Roles are function-named, never
// hex-named — a component asks for `ink`, not `#1A1D1A`.

type Mode = {
  // Backgrounds — three depths.
  surface:       string   // page background
  surfaceRaised: string   // cards, panels sitting above the page
  surfaceSunken: string   // insets, wells below the page
  panel:         string   // pure panel (max contrast card)

  // Text — three weights.
  ink:           string   // primary text
  muted:         string   // secondary text
  faint:         string   // tertiary / labels / captions

  // Lines.
  line:          string   // hairline dividers, card borders
  lineStrong:    string   // emphasized borders

  // Gold, resolved per mode.
  gold:          string
  goldBorder:    string
  goldTint:      string
}

// DARK — sources: ID (immerse dark) + theme.darkPalette.
const dark: Mode = {
  surface:       '#0E110E',   // MERGE: ID.bg '#060606' / theme.dark bg '#1A1D1A' / WIDGET.bgSunken — canonical page dark. RULING: default to a mid-dark; ID.bg pure-black kept as surfaceSunken below.
  surfaceRaised: '#151515',   // ID.panel2
  surfaceSunken: '#060606',   // ID.bg (pure)
  panel:         '#101010',   // ID.panel

  ink:           '#F5F2EC',   // ID.text (warm cream text on dark)
  muted:         '#C9C3B9',   // ID.muted
  faint:         '#938C81',   // ID.dim

  line:          '#272727',   // ID.line
  lineStrong:    '#343434',   // ID.lineSoft

  gold:          '#d8b56a',   // BRAND.gold
  goldBorder:    'rgba(216,181,106,0.34)',   // IMMERSE.goldBorder
  goldTint:      'rgba(216,181,106,0.08)',   // IMMERSE.goldTint
} as const

// LIGHT — sources: IMMERSE.*OnLight + theme.lightPalette + immerse component cream locals.
const light: Mode = {
  // MERGE: six off-whites collapse here. RULING: default cream = '#F6F1E8'
  // (IMMERSE.lightSurface). Collapsed: '#F7F5F0' (component CREAM), '#FAF8F6'
  // (theme light bg), '#F3EEE8' (theme sidebar). If the delivery surface's
  // warmer '#F7F5F0' is intentional vs destinations' '#F6F1E8', say so and
  // this splits into two cream roles.
  surface:       '#F6F1E8',
  surfaceRaised: '#FFFFFF',   // IMMERSE.panelOnLight / theme.light bgCard — MERGE (both #FFFFFF)
  surfaceSunken: '#F0EDE6',   // MERGE: component CARD_BG '#F0EDE6' — the sunken cream well
  panel:         '#FFFFFF',

  ink:           '#1A1D1A',   // MERGE: 7 homes agree — IMMERSE.textOnLight / theme.light text / component INK / tokensProgramme
  // RULING: muted-on-light. Default '#5A6A5A' (IMMERSE.mutedOnLight +
  // theme.light muted + WIDGET.textMid — 3 canonical homes). The immerse
  // components' '#787060' is the outlier and is NOT chosen. This CHANGES the
  // delivery/confirmed surface muted text from '#787060' to '#5A6A5A'.
  muted:         '#5A6A5A',
  faint:         '#8A9A8A',   // MERGE: theme.light faint / WIDGET.text — and component FAINT '#B4AFA5' folds here (RULING: '#B4AFA5' was a lighter immerse-only faint; default to '#8A9A8A' for one-source, flag if the lighter tone is wanted on cream)

  line:          'rgba(26,29,26,0.10)',   // IMMERSE.lineOnLight / theme.light border — MERGE (identical)
  lineStrong:    'rgba(26,29,26,0.18)',   // derived (component RULE '#DCDBD5' opaque equivalent) — MERGE: RULE folds to a stronger line-on-light

  gold:          '#B8960C',   // BRAND.goldOnLight (deeper gold for cream contrast)
  goldBorder:    'rgba(184,150,12,0.30)',   // IMMERSE.goldBorderOnLight / theme.light borderGold — MERGE (identical)
  goldTint:      'rgba(184,150,12,0.08)',   // IMMERSE.goldTintOnLight
} as const

export const AMBIENCE = { dark, light } as const

// ── Convenience: active-mode accessor (pre-toggle) ────────────────────────────
// Until the toggle ships, a surface picks its mode explicitly:
//   const c = AMBIENCE.dark   // immerse proposal (dark-locked today)
//   const c = AMBIENCE.light  // client delivery/cream surface
// When the toggle lands, this resolves from app state instead.

export type AmbienceMode = keyof typeof AMBIENCE
export type AmbienceRoles = Mode