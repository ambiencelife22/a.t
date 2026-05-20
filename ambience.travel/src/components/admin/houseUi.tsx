/* houseUi.tsx
 * Shared UI primitives for HouseTab and its section components.
 *
 * Extracted S44 from HouseTab.tsx to reduce file size and allow
 * section components to import without circular deps.
 *
 * Exports:
 *   StatusFilterBar<T>  — filter pill row with counts
 *   AddFormShell        — gold-bordered form wrapper
 *   EntryCard           — coloured left-border card
 *   SectionHeader       — AdminSection + count + optional add button
 *   FormActions         — cancel / save row
 *   DesigBadge          — designation chip (HRH / HH / VVIP)
 *   SourceSelect        — source dropdown
 *   PPDValueInput       — date-aware value input for PPD fields
 *   formatDOB           — DD MON YYYY formatter
 *   capitalize          — first char upper
 */

import { A } from '../../lib/tokensAdmin'
import { inputStyle, btnPrimary as btnP, btnGhost as btnG } from '../../lib/stylesAdmin'
import { AdminSection } from './_adminPrimitives'

// ── Misc helpers ──────────────────────────────────────────────────────────────

export function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function formatDOB(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}

// ── DesigBadge ────────────────────────────────────────────────────────────────

const DESIG_COLOR: Record<string, string> = {
  HRH:  '#c084fc',
  HH:   '#93c5fd',
  VVIP: '#D8B56A',
}

export function DesigBadge({ designation }: { designation: string }) {
  const color = DESIG_COLOR[designation] ?? A.gold
  return (
    <span style={{
      padding:       '2px 8px',
      borderRadius:  5,
      background:    color + '18',
      border:        `1px solid ${color}35`,
      color,
      fontSize:      9,
      fontWeight:    700,
      fontFamily:    A.font,
      letterSpacing: '0.1em',
      flexShrink:    0,
    }}>
      {designation}
    </span>
  )
}

// ── StatusFilterBar ───────────────────────────────────────────────────────────

export function StatusFilterBar<T extends string>({
  options,
  active,
  onSelect,
  labelFor,
  colorFor,
  counts,
  children,
}: {
  options:   T[]
  active:    T | 'all'
  onSelect:  (v: T | 'all') => void
  labelFor:  (v: T | 'all') => string
  colorFor:  (v: T | 'all') => string
  counts:    Record<string, number>
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {(['all', ...options] as (T | 'all')[]).map(s => {
        const isActive = active === s
        const color    = colorFor(s)
        const count    = counts[s as string] ?? 0
        return (
          <button
            key={s as string}
            onClick={() => onSelect(s)}
            style={{
              padding:      '7px 13px',
              whiteSpace:   'nowrap',
              flexShrink:   0,
              background:   isActive ? color + '12' : 'transparent',
              color:        isActive ? color : A.muted,
              border:       isActive ? `1px solid ${color}30` : `1px solid ${A.border}`,
              borderRadius: 8,
              fontSize:     11,
              fontWeight:   600,
              fontFamily:   A.font,
              cursor:       'pointer',
            }}
          >
            {labelFor(s)}
            {count > 0 && <span style={{ marginLeft: 4, opacity: 0.55 }}>({count})</span>}
          </button>
        )
      })}
      {children && <div style={{ flexShrink: 0, marginLeft: 4 }}>{children}</div>}
    </div>
  )
}

// ── AddFormShell ──────────────────────────────────────────────────────────────

export function AddFormShell({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      padding:       14,
      background:    A.bgCard,
      border:        `1px solid ${danger ? 'rgba(248,113,113,0.25)' : `${A.gold}40`}`,
      borderRadius:  10,
      display:       'flex',
      flexDirection: 'column',
      gap:           10,
    }}>
      {children}
    </div>
  )
}

// ── EntryCard ─────────────────────────────────────────────────────────────────

export function EntryCard({
  accentColor,
  children,
  danger = false,
}: {
  accentColor?: string
  children:     React.ReactNode
  danger?:      boolean
}) {
  const border = danger ? '1px solid rgba(248,113,113,0.12)' : `1px solid ${A.border}`
  return (
    <div style={{
      padding:      '12px 14px',
      background:   A.bgCard,
      border,
      borderLeft:   accentColor ? `3px solid ${accentColor}` : border,
      borderRadius: 8,
    }}>
      {children}
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  color,
  count,
  onAdd,
  adding,
}: {
  title:   string
  color?:  string
  count?:  number
  onAdd?:  () => void
  adding?: boolean
}) {
  const label = count !== undefined ? `${title} · ${count}` : title
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <AdminSection title={label} style={{ borderLeftColor: color ? `${color}50` : undefined }} />
      {onAdd && !adding && (
        <button onClick={onAdd} style={{ ...btnP, padding: '4px 12px', fontSize: 11 }}>+ Add</button>
      )}
    </div>
  )
}

// ── FormActions ───────────────────────────────────────────────────────────────

export function FormActions({
  onCancel,
  onSave,
  saving,
  saveLabel = 'Add',
}: {
  onCancel:   () => void
  onSave:     () => void
  saving:     boolean
  saveLabel?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={btnG}>Cancel</button>
      <button onClick={onSave} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>
        {saving ? 'Saving...' : saveLabel}
      </button>
    </div>
  )
}

// ── SourceSelect ──────────────────────────────────────────────────────────────

export function SourceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
      <option value='direct'>Direct</option>
      <option value='inferred'>Inferred</option>
      <option value='staff_note'>Staff Note</option>
      <option value='profile_summary'>Profile Summary</option>
      <option value='trip'>Trip</option>
      <option value='observation'>Observation</option>
    </select>
  )
}

// ── PPDValueInput ─────────────────────────────────────────────────────────────

export function PPDValueInput({
  dataKey,
  value,
  onChange,
}: {
  dataKey:  string
  value:    string
  onChange: (v: string) => void
}) {
  if (dataKey === 'Date of Birth') {
    const toISO = (stored: string): string => {
      if (!stored) return ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored
      const d = new Date(stored)
      if (isNaN(d.getTime())) return ''
      return d.toISOString().slice(0, 10)
    }
    return (
      <input
        type='date'
        style={{ ...inputStyle, colorScheme: 'dark' }}
        value={toISO(value)}
        onChange={e => onChange(e.target.value ? formatDOB(e.target.value) : '')}
        autoFocus
      />
    )
  }
  return (
    <input
      style={inputStyle}
      placeholder='Enter value...'
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete='off'
      autoFocus
    />
  )
}