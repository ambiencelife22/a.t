/* adminUi.tsx - Shared admin UI primitives for AmbienceAdmin tabs.
 *
 * What it owns:
 *   Field          -- label + children wrapper (used in every edit form)
 *   SectionLabel   -- uppercase section divider with optional colour
 *   CopyButton     -- clipboard copy with confirmation state
 *   PillToggle     -- boolean pill toggle (replaces boolean <select> elements)
 *   SectionDivider -- thin horizontal rule for form section breaks
 *
 * Import from here; never define these locally in a tab component.
 * Toast system: use useAdminToast() from adminPrimitives directly.
 *
 * Last updated: S43 - Phase 5: PillToggle + SectionDivider added.
 * Prior: S40D - extracted from HouseTab.
 */

import { useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { labelStyle } from '../../styles/stylesAdmin'

// ── Field ─────────────────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

export function SectionLabel({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color:         color ?? A.faint,
      fontFamily:    A.font,
      marginBottom:  8,
    }}>
      {label}
    </div>
  )
}

// ── CopyButton ────────────────────────────────────────────────────────────────

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title='Copy to clipboard'
      style={{
        background:   'transparent',
        border:       'none',
        cursor:       'pointer',
        color:        copied ? '#4ade80' : A.faint,
        fontSize:     11,
        fontFamily:   A.font,
        padding:      '2px 8px',
        borderRadius: 6,
        transition:   'color 0.15s',
        flexShrink:   0,
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

// ── PillToggle ────────────────────────────────────────────────────────────────
// Boolean pill toggle. Replaces boolean <select> elements per Phase 5 spec.
//
// Usage:
//   <PillToggle
//     value={draft.isPublic}
//     onChange={v => setDraft(d => ({ ...d, isPublic: v }))}
//     labelTrue='Public'
//     labelFalse='Private'
//   />

export function PillToggle({
  value,
  onChange,
  labelTrue  = 'Yes',
  labelFalse = 'No',
  disabled,
}: {
  value:       boolean
  onChange:    (v: boolean) => void
  labelTrue?:  string
  labelFalse?: string
  disabled?:   boolean
}) {
  return (
    <div style={{
      display:       'inline-flex',
      borderRadius:  20,
      border:        `1px solid ${A.border}`,
      overflow:      'hidden',
      opacity:       disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    }}>
      {[false, true].map(v => {
        const active = value === v
        const label  = v ? labelTrue : labelFalse
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            style={{
              padding:       '5px 14px',
              fontSize:      11,
              fontWeight:    active ? 700 : 500,
              fontFamily:    A.font,
              color:         active ? (v ? A.gold : A.text) : A.muted,
              background:    active
                ? v
                  ? 'rgba(216,181,106,0.12)'
                  : 'rgba(255,255,255,0.04)'
                : 'transparent',
              border:        'none',
              borderRight:   v ? 'none' : `1px solid ${A.border}`,
              cursor:        'pointer',
              transition:    'background 120ms ease, color 120ms ease',
              whiteSpace:    'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── SectionDivider ────────────────────────────────────────────────────────────
// Thin horizontal rule for form section breaks.
// Replaces Section wrapper cards as visual dividers between form groups.
//
// Usage:
//   <SectionDivider />
//   <SectionDivider label='Advanced' />  -- optional label floated left

export function SectionDivider({ label }: { label?: string }) {
  if (!label) {
    return (
      <div style={{
        height:     1,
        background: A.border,
        margin:     '4px 0',
      }} />
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: A.border }} />
    </div>
  )
}