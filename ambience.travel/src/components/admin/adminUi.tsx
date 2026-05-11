// adminUi.tsx — Shared admin UI primitives for AmbienceAdmin tabs.
//
// What it owns:
//   Field        — label + children wrapper (used in every edit form)
//   SectionLabel — uppercase section divider with optional colour
//   CopyButton   — clipboard copy with confirmation state
//
// Import from here; never define these locally in a tab component.
// Toast system: use useToast() from ../../lib/ToastContext directly —
// the ToastContainer is mounted in main.tsx and covers all admin surfaces.
//
// Last updated: S40D — extracted from HouseTab.

import { useState } from 'react'
import { A } from '../../lib/adminTokens'
import { labelStyle } from '../../lib/adminStyles'

// ── Field ─────────────────────────────────────────────────────────────────────
// Label + children wrapper. Used in every edit form across admin tabs.

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
// Uppercase section divider. Used in HouseTab detail sections.

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
// One-click clipboard copy. Confirms with checkmark for 1.8s.
// Used in SensitiveSection and global search results for PPD fields.

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
        background:  'transparent',
        border:      'none',
        cursor:      'pointer',
        color:       copied ? '#4ade80' : A.faint,
        fontSize:    11,
        fontFamily:  A.font,
        padding:     '2px 8px',
        borderRadius: 6,
        transition:  'color 0.15s',
        flexShrink:  0,
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}