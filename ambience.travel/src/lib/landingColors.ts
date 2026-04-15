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
  borderFaint:    'rgba(255,255,255,0.04)',
  shimmer:        'rgba(255,235,180,0.95)',
  goldBorder:     'rgba(216,181,106,0.34)',
  goldBorderSoft: 'rgba(216,181,106,0.28)',
  goldTint:       'rgba(216,181,106,0.08)',
  pillBg:         'rgba(255,255,255,0.02)',
  panelGradient:  'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
} as const