// adminStyles.ts — Canonical shared style objects for all admin tabs.
//
// Single source for input, button, and label styles across AmbienceAdmin.
// Import from here; never define these locally in a tab component.
//
// All values derived from A tokens (adminTokens.ts). If A tokens change,
// styles here update automatically.
//
// Last updated: S43 — Phase 5 forms pass.
//   - labelStyle: color A.faint -> A.muted (spec: 9pt tracked caps, dim).
//   - inputStyle: padding bumped to 14px.
//   - applyFocusRing / removeFocusRing helpers: gold 30% focus ring via
//     onFocus/onBlur, since React CSSProperties cannot express :focus.
//     Use on any <input> or <textarea> that needs spec-compliant focus state.
//   - inputWithFocus: spreads inputStyle + onFocus/onBlur for convenience.
// Prior: S40D — extracted from HouseTab, GuidesDiningTab, LibraryDiningTab.

import { A } from './adminTokens'

export const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   A.bgInput,
  border:       `1px solid ${A.border}`,
  borderRadius: 8,
  padding:      '9px 14px',
  fontSize:     12,
  color:        A.text,
  fontFamily:   A.font,
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 120ms ease, box-shadow 120ms ease',
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize:     'vertical',
  lineHeight: 1.7,
  minHeight:  80,
}

export const labelStyle: React.CSSProperties = {
  fontSize:      9,
  fontWeight:    700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color:         A.muted,
  fontFamily:    A.font,
  marginBottom:  4,
  display:       'block',
}

// ── Focus ring helpers ────────────────────────────────────────────────────────
// React CSSProperties cannot express :focus pseudo-class, so focus state is
// applied imperatively via onFocus/onBlur handlers.
//
// Usage:
//   <input
//     style={inputStyle}
//     onFocus={e => applyFocusRing(e.currentTarget)}
//     onBlur={e  => removeFocusRing(e.currentTarget)}
//   />
//
// Or spread inputFocusHandlers for brevity:
//   <input style={inputStyle} {...inputFocusHandlers} />

const FOCUS_BORDER    = 'rgba(216,181,106,0.6)'
const FOCUS_SHADOW    = '0 0 0 3px rgba(216,181,106,0.15)'
const DEFAULT_BORDER  = A.border
const DEFAULT_SHADOW  = 'none'

export function applyFocusRing(el: HTMLElement) {
  el.style.borderColor = FOCUS_BORDER
  el.style.boxShadow   = FOCUS_SHADOW
}

export function removeFocusRing(el: HTMLElement) {
  el.style.borderColor = DEFAULT_BORDER
  el.style.boxShadow   = DEFAULT_SHADOW
}

export const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    applyFocusRing(e.currentTarget),
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    removeFocusRing(e.currentTarget),
}

// ── Buttons ───────────────────────────────────────────────────────────────────

export const btnPrimary: React.CSSProperties = {
  padding:       '7px 16px',
  background:    'rgba(216,181,106,0.10)',
  color:         A.gold,
  border:        '1px solid rgba(216,181,106,0.28)',
  borderRadius:  8,
  fontSize:      11,
  fontWeight:    700,
  fontFamily:    A.font,
  cursor:        'pointer',
  letterSpacing: '0.04em',
}

export const btnGhost: React.CSSProperties = {
  padding:      '6px 14px',
  background:   'transparent',
  color:        A.muted,
  border:       `1px solid ${A.border}`,
  borderRadius: 8,
  fontSize:     11,
  fontWeight:   600,
  fontFamily:   A.font,
  cursor:       'pointer',
}

export const btnDanger: React.CSSProperties = {
  padding:      '5px 10px',
  background:   'transparent',
  color:        '#f87171',
  border:       'none',
  borderRadius: 6,
  fontSize:     11,
  fontWeight:   600,
  fontFamily:   A.font,
  cursor:       'pointer',
  flexShrink:   0,
}