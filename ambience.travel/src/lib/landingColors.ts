export const WIDGET = {
  bg: '#141814',
  bgDeep: '#181C18',
  bgInset: '#1A1E1A',
  bgSunken: '#0E110E',
  border: '#252A25',
  borderMid: '#2A312A',
  borderRow: '#1E221E',
  text: '#8A9A8A',
  textMid: '#5A6A5A',
  textDim: '#4A5A4A',
  textFaint: '#3A4A3A',
  textGhost: '#2A3A2A',
} as const

export const TRAVEL_MOMENT_COLORS: Record<string, string> = {
  'Private Family Travel': '#7FDEFF',
  'Couples & Celebrations': '#a78bfa',
  'Wellness Escape': '#4ade80',
  'Signature City Stay': '#E8C547',
  'Extended Journey': '#f97316',
  'Suites & Villas': '#C9B88E',
  'Private Aviation': '#93c5fd',
  'Yacht & Sea': '#38bdf8',
  'Signature Dining': '#fb923c',
}

// ── Immerse proposal system ───────────────────────────────────────────────────
// Fixed dark palette for /immerse/ proposal pages. Always dark regardless of mode.
// Base hex tokens live here (ID) alongside derived rgba tokens (IMMERSE).

export const ID = {
  bg:       '#060606',
  panel:    '#101010',
  panel2:   '#151515',
  line:     '#272727',
  lineSoft: '#343434',
  text:     '#f5f2ec',
  muted:    '#c9c3b9',
  dim:      '#938c81',
  gold:     '#d8b56a',
  shadow:   '0 24px 64px rgba(0,0,0,0.36)',
  radiusXl: 30,
  radiusLg: 22,
  radiusMd: 16,
} as const

export const IMMERSE = {
  // ── Existing dark-context tokens ─────────────────────────────────────────
  borderFaint:    'rgba(255,255,255,0.04)',
  shimmer:        'rgba(255,235,180,0.95)',
  goldBorder:     'rgba(216,181,106,0.34)',
  goldBorderSoft: 'rgba(216,181,106,0.28)',
  goldTint:       'rgba(216,181,106,0.08)',
  pillBg:         'rgba(255,255,255,0.02)',
  panelGradient:  'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',

  // ── Shadow / depth tokens (S19) ──────────────────────────────────────────
  // Lighter than ID.shadow — used on brick-style cards inside immerse sections
  brickDepth:        '0 8px 24px rgba(15,18,22,0.045)',
  brickDepthHover:   '0 12px 28px rgba(15,18,22,0.065)',
  ctaDepth:          '0 4px 14px rgba(15,18,22,0.05)',
  ctaDepthHover:     '0 8px 16px rgba(15,18,22,0.08)',

  // ── Image overlays (S19) ─────────────────────────────────────────────────
  // Bottom-weighted gradients that darken imagery enough for overlaid text
  imageOverlayStrong: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.46) 100%)',
  imageOverlaySoft:   'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.22) 100%)',

  // ── Table chrome (S19) ───────────────────────────────────────────────────
  tableBorder:        'rgba(255,255,255,0.08)',
  tableBorderSoft:    'rgba(255,255,255,0.06)',
  goldBorderStrong:   'rgba(216,181,106,0.45)',

  // ── Light-surface context (S19) ──────────────────────────────────────────
  // For sections that render on cream (destinations). Mirrors theme.ts
  // lightPalette so immerse light-context stays aligned with rest of app.
  lightSurface:       '#F6F1E8',
  lightSurfaceDepth:  '0 24px 56px rgba(15,18,22,0.14), 0 2px 6px rgba(15,18,22,0.06)',
  panelOnLight:       '#FFFFFF',
  textOnLight:        '#1A1D1A',
  mutedOnLight:       '#5A6A5A',
  lineOnLight:        'rgba(26,29,26,0.10)',
  goldBorderOnLight:  'rgba(184,150,12,0.30)',
  goldTintOnLight:    'rgba(184,150,12,0.08)',
} as const