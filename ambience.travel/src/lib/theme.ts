/* theme.ts — dual-mode palette for ambience.travel programme product.
 * Identical to ambience.SPORTS theme.ts — one palette across all products.
 * Landing page colours remain in landingTypes.ts — do not merge.
 *
 * C is a stable mutable object. _setPalette() swaps values in place.
 * All C.* references in render functions pick up the current palette automatically.
 */

export interface Palette {
  bg:              string
  bgCard:          string
  bgSidebar:       string
  bgTrader:        string
  gold:            string
  blue:            string
  positive:        string
  negative:        string
  text:            string
  muted:           string
  faint:           string
  border:          string
  borderGold:      string
  borderGoldFaint: string
}

export const darkPalette: Palette = {
  bg:              '#1A1D1A',
  bgCard:          '#222622',
  bgSidebar:       '#161916',
  bgTrader:        'linear-gradient(135deg, #1e211e, #252a25)',
  gold:            '#E8C547',
  blue:            '#7FDEFF',
  positive:        '#4ade80',
  negative:        '#f87171',
  text:            '#FAF8F6',
  muted:           '#8A9A8A',
  faint:           '#5A6A5A',
  border:          'rgba(255,255,255,0.07)',
  borderGold:      'rgba(232,197,71,0.25)',
  borderGoldFaint: 'rgba(232,197,71,0.12)',
}

export const lightPalette: Palette = {
  bg:              '#FAF8F6',
  bgCard:          '#FFFFFF',
  bgSidebar:       '#F3EEE8',
  bgTrader:        'linear-gradient(135deg, #F3EEE8, #EDE8E0)',
  gold:            '#B8960C',
  blue:            '#0A7EA4',
  positive:        '#1A7A3F',
  negative:        '#C0392B',
  text:            '#1A1D1A',
  muted:           '#5A6A5A',
  faint:           '#8A9A8A',
  border:          'rgba(26,29,26,0.10)',
  borderGold:      'rgba(184,150,12,0.30)',
  borderGoldFaint: 'rgba(184,150,12,0.14)',
}

export const C: Palette = { ...darkPalette }

export function _setPalette(p: Palette): void {
  (Object.keys(p) as (keyof Palette)[]).forEach(k => { C[k] = p[k] })
}

export function useC(): Palette { return C }