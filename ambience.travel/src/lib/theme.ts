/* theme.ts — dual-mode palette for ambience.travel programme product.
 * Identical pattern to ambience.SPORTS theme.ts.
 * Landing page colours remain in landingTypes.ts — do not merge.
 *
 * C is a stable mutable object. _setPalette() swaps values in place.
 * All C.* references in render functions pick up the current palette automatically.
 */

export interface Palette {
  bg:              string
  bgCard:          string
  bgSidebar:       string
  gold:            string
  text:            string
  muted:           string
  faint:           string
  border:          string
  borderGold:      string
  borderGoldFaint: string
  positive:        string
  negative:        string
}

export const darkPalette: Palette = {
  bg:              '#171917',
  bgCard:          '#1F221F',
  bgSidebar:       '#131513',
  gold:            '#C9B88E',
  text:            '#F3F4F3',
  muted:           '#838383',
  faint:           '#555D55',
  border:          'rgba(255,255,255,0.07)',
  borderGold:      'rgba(201,184,142,0.28)',
  borderGoldFaint: 'rgba(201,184,142,0.12)',
  positive:        '#4ade80',
  negative:        '#f87171',
}

export const lightPalette: Palette = {
  bg:              '#F7F4EE',
  bgCard:          '#FFFFFF',
  bgSidebar:       '#EDE8E0',
  gold:            '#9A7C3A',
  text:            '#171917',
  muted:           '#5A6257',
  faint:           '#8A9086',
  border:          'rgba(26,29,26,0.10)',
  borderGold:      'rgba(154,124,58,0.30)',
  borderGoldFaint: 'rgba(154,124,58,0.14)',
  positive:        '#1A7A3F',
  negative:        '#C0392B',
}

export const C: Palette = { ...darkPalette }

export function _setPalette(p: Palette): void {
  (Object.keys(p) as (keyof Palette)[]).forEach(k => { C[k] = p[k] })
}

export function useC(): Palette { return C }