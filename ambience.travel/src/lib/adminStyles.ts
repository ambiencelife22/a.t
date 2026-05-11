// adminStyles.ts — Canonical shared style objects for all admin tabs.
//
// Single source for input, button, and label styles across AmbienceAdmin.
// Import from here; never define these locally in a tab component.
//
// All values derived from A tokens (adminTokens.ts). If A tokens change,
// styles here update automatically.
//
// Last updated: S40D — extracted from HouseTab, GuidesDiningTab, LibraryDiningTab.

import { A } from './adminTokens'

export const inputStyle: React.CSSProperties = {
  width:       '100%',
  background:  A.bgInput,
  border:      `1px solid ${A.border}`,
  borderRadius: 8,
  padding:     '9px 12px',
  fontSize:    12,
  color:       A.text,
  fontFamily:  A.font,
  outline:     'none',
  boxSizing:   'border-box',
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize:     'vertical',
  lineHeight:  1.7,
  minHeight:   80,
}

export const labelStyle: React.CSSProperties = {
  fontSize:      9,
  fontWeight:    700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color:         A.faint,
  fontFamily:    A.font,
  marginBottom:  4,
  display:       'block',
}

export const btnPrimary: React.CSSProperties = {
  padding:     '7px 16px',
  background:  'rgba(216,181,106,0.10)',
  color:       A.gold,
  border:      '1px solid rgba(216,181,106,0.28)',
  borderRadius: 8,
  fontSize:    11,
  fontWeight:  700,
  fontFamily:  A.font,
  cursor:      'pointer',
  letterSpacing: '0.04em',
}

export const btnGhost: React.CSSProperties = {
  padding:     '6px 14px',
  background:  'transparent',
  color:       A.muted,
  border:      `1px solid ${A.border}`,
  borderRadius: 8,
  fontSize:    11,
  fontWeight:  600,
  fontFamily:  A.font,
  cursor:      'pointer',
}

export const btnDanger: React.CSSProperties = {
  padding:     '5px 10px',
  background:  'transparent',
  color:       '#f87171',
  border:      'none',
  borderRadius: 6,
  fontSize:    11,
  fontWeight:  600,
  fontFamily:  A.font,
  cursor:      'pointer',
  flexShrink:  0,
}