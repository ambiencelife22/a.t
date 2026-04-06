// lib/colors.ts — semantic colour constants
// Single source of truth for all non-theme colours used across the app.
// Import from here instead of hardcoding hex strings in components.
//
// Theme colours (bg, text, border, gold, blue, positive, negative, muted, faint)
// still live in theme.ts / C.* — do not duplicate those here.
// This file covers colours that are FIXED regardless of light/dark mode:
//   bet type colours, geo zone colours, status colours, transaction type colours,
//   destructive UI, branding, landing widget chrome.

import { C } from './theme'

// ── Destructive / Danger ──────────────────────────────────────────────────────
// Stronger red used for irreversible actions (delete, restore, account removal).
// Distinct from C.negative (#f87171) which is for P&L loss display.

export const DANGER  = '#ef4444'  // destructive action buttons, confirmation flows
export const WARNING = '#f97316'  // caution tone — same hue as Parlay/unfavorable

// ── Branding ──────────────────────────────────────────────────────────────────

export const BRAND_SPORTS_TINT = '#b5a06e'  // ".SPORTS" wordmark tint in AmbienceLogo
export const BRAND_COPYRIGHT   = '#C0B8AE'  // footer copyright text

// ── Landing Widget Chrome ─────────────────────────────────────────────────────
// Dark surface colours used inside landing demo widgets (SignalSizer, Arb, etc).
// These are intentionally fixed — the widgets always render dark regardless of
// the app's light/dark mode, because they are illustrative UI mockups.

export const WIDGET = {
  bg:        '#141814',  // outermost widget background
  bgDeep:    '#181C18',  // sportsbooks/open positions widget bg
  bgInset:   '#1A1E1A',  // card/row inset background
  bgSunken:  '#0E110E',  // deeply sunken input/empty state bg
  border:    '#252A25',  // primary widget border
  borderMid: '#2A312A',  // slightly lighter border, grid separators
  borderRow: '#1E221E',  // row divider
  text:      '#8A9A8A',  // primary widget text
  textMid:   '#5A6A5A',  // section labels
  textDim:   '#4A5A4A',  // secondary labels
  textFaint: '#3A4A3A',  // tertiary / placeholder text
  textGhost: '#2A3A2A',  // nearly invisible hint text
} as const

// ── Geo Zone ─────────────────────────────────────────────────────────────────
// Non-semantic: blue/purple/orange intentionally chosen to avoid implying
// good/bad and to avoid conflict with P/L colour semantics.
// Matches bet type colours (Live/Own = blue, LowHold = purple, Parlay = orange).

export const GEO_ZONE_COLORS = {
  favorable:   '#7FDEFF',  // blue   — same as Live/Own bet type
  mediocre:    '#a78bfa',  // purple — same as Low Hold bet type
  unfavorable: '#f97316',  // orange — same as Parlay bet type
} as const

export type GeoZone = keyof typeof GEO_ZONE_COLORS

export function geoZoneColor(zone: string | null | undefined): string {
  if (!zone) return C.muted
  return GEO_ZONE_COLORS[zone as GeoZone] ?? C.muted
}

// ── Bet Type ──────────────────────────────────────────────────────────────────

export const BET_TYPE_COLORS: Record<string, string> = {
  PWins:          '#E8C547',  // gold
  'PWins Parlay': '#B8971F',  // darker gold
  Live:           '#7FDEFF',  // blue
  Own:            '#7FDEFF',  // blue
  Arb:            '#4ade80',  // green / C.positive
  'Low Hold':     '#a78bfa',  // purple
  'Multi-Book':   '#4A9ECC',  // darker blue — same hue as Live/Own
  'Player Prop':  '#7FDEFF',  // blue
  'Team Prop':    '#7FDEFF',  // blue
  Parlay:         '#f97316',  // orange
  Complex:        '#7C5CC4',  // darker purple — same hue as Low Hold
  Other:          '#8A9A8A',  // muted
  System:         '#e879f9',  // fuchsia — distinct from all existing types
}

export function betTypeColor(type: string): string {
  return BET_TYPE_COLORS[type] ?? C.muted
}

// Convenience: badge background = colour at ~15% opacity
export function betTypeBg(type: string): string {
  return `${betTypeColor(type)}26`
}

// ── Feature Colors ────────────────────────────────────────────────────────────
// Page/feature level concepts — not bet types, but need a canonical color.

export const FEATURE_COLORS = {
  'Signal Sizer':  '#E8C547',  // gold  — matches C.gold / PWins tone
  'BB Efficiency': '#7FDEFF',  // blue  — matches BB transaction color in app
  'Performance':   '#E8C547',  // gold  — matches Analytics SectionLabel
  'Reports':       '#E8C547',  // gold  — matches Reports SectionLabel
  'Geo Zone':      '#7FDEFF',  // blue  — favorable zone = blue
} as const

export type FeatureKey = keyof typeof FEATURE_COLORS

export function featureColor(key: FeatureKey): string {
  return FEATURE_COLORS[key]
}

// ── Bet Status ────────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  pending: '#E8C547',  // gold
  win:     '#4ade80',  // green / C.positive
  loss:    '#f87171',  // red   / C.negative
  push:    '#8A9A8A',  // muted
}

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? C.muted
}

// ── Transaction Type ──────────────────────────────────────────────────────────
// Maps to theme values at runtime so they respect light/dark mode.

export function transactionTypeColor(type: string): string {
  switch (type) {
    case 'deposit':
    case 'adjustment_positive':
    case 'reconciliation_adjustment_plus':
      return C.positive
    case 'withdrawal':
    case 'adjustment_negative':
    case 'reconciliation_adjustment_minus':
      return C.negative
    case 'signup_bonus':
    case 'reload_bonus':
    case 'activity_bonus':
    case 'cash_bonus':
    case 'casino_cash':
      return C.gold
    case 'bonus_bet_added':
      return C.blue
    case 'bonus_bet_withdrawn':
      return C.muted
    default:
      return C.muted
  }
}