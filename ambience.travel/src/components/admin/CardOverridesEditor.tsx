/* CardOverridesEditor.tsx
 * Editor for travel_immerse_trip_content_card_overrides. Mounts inside
 * EngagementDetailTab below the Destination Section.
 *
 * Pattern mirrors RouteStopsEditor + DestinationRowsEditor:
 *   - Compact list grouped by Dining / Experiences
 *   - is_active toggle per row card
 *   - Edit button → modal with override fields
 *   - Add Override → picker from canonical pool (deduped against existing)
 *   - Delete with confirm
 *
 * Override semantics: NULL = canonical flows through · '' = hide on render ·
 * non-empty = override.
 *
 * No drag-to-reorder (this table has no sort_order — order is canonical-driven).
 *
 * Last updated: S334
 */

import { useEffect, useMemo, useState } from 'react'

import {
  fetchCardOverrides,
  updateCardOverride,
  insertCardOverride,
  deleteCardOverride,
  searchCanonicalCards,
  type CardOverride,
  type CardCanonicalOption,
  type CardKind,
} from '../../lib/adminCardOverrideQueries'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { A } from '../../lib/adminTokens'

// ── Shared styles (mirrors sibling editors) ──────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', lineHeight: 1.7, minHeight: 90,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: A.faint, fontFamily: A.font,
  marginBottom: 6, display: 'block',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(216,181,106,0.12)', color: A.gold,
  border: `1px solid rgba(216,181,106,0.30)`, borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer',
  letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: A.danger,
  border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8,
  fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const PUBLIC_URL_PREFIX =
  'https://rjobcbpnhymuczjhqzmh.supabase.co/storage/v1/object/public/ambience-assets/'

function thumbSrc(value: string | null): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `${PUBLIC_URL_PREFIX}${value}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title:        string
  defaultOpen?: boolean
  children:     React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${A.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 18px', background: 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12, color: A.faint, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>▸</span>
      </button>
      {open && (
        <div style={{
          padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── JSON field (raw textarea — bullets jsonb) ────────────────────────────────

function JsonField({
  value,
  onChange,
}: {
  value:    unknown
  onChange: (next: unknown) => void
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(JSON.stringify(value ?? null, null, 2))
  }, [value])

  function handleChange(next: string) {
    setDraft(next)
    if (next.trim() === '' || next.trim() === 'null') {
      setError(null)
      onChange(null)
      return
    }
    try {
      const parsed = JSON.parse(next)
      setError(null)
      onChange(parsed)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'invalid JSON'
      setError(message)
    }
  }

  return (
    <div>
      <textarea
        style={{ ...textareaStyle, fontFamily: 'DM Mono, monospace', minHeight: 90, fontSize: 12 }}
        value={draft}
        onChange={e => handleChange(e.target.value)}
        placeholder='null  // or  ["bullet 1", "bullet 2"]'
      />
      {error && <div style={{ fontSize: 11, color: A.danger, fontFamily: A.font, marginTop: 4 }}>⚠ {error}</div>}
    </div>
  )
}

// ── Override row card (compact list view) ────────────────────────────────────

function OverrideRowCard({
  row,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  row:            CardOverride
  onEdit:         (row: CardOverride) => void
  onDelete:       (row: CardOverride) => void
  onToggleActive: (row: CardOverride) => void
}) {
  const thumb = thumbSrc(row.image_src_override ?? row.canonical_image_src)
  const overrideCount = [
    row.kicker_override, row.name_override, row.tagline_override,
    row.body_override, row.bullets_heading_override, row.image_src_override,
    row.image_alt_override, row.image_credit_override,
    row.image_credit_url_override, row.image_license_override,
  ].filter(v => v !== null).length + (row.bullets_override !== null ? 1 : 0)

  const style: React.CSSProperties = {
    opacity:    row.is_active ? 1 : 0.5,
    background: A.bgInput,
    border:     `1px solid ${A.border}`,
    borderRadius: 12,
    padding:    '12px 14px',
    display:    'flex',
    alignItems: 'center',
    gap:        12,
  }

  return (
    <div style={style}>
      {/* Thumbnail */}
      <div style={{
        width: 56, height: 40, borderRadius: 6, overflow: 'hidden',
        background: A.bg, border: `1px solid ${A.border}`,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb && (
          <img
            src={thumb}
            alt=''
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
        {!thumb && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>no img</span>}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.name_override ?? row.canonical_name ?? <span style={{ color: A.faint, fontStyle: 'italic' }}>(unknown)</span>}
        </div>
        <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
          {row.canonical_global_dest_slug ?? '—'}
          <span style={{ color: A.faint, marginLeft: 8 }}>· {overrideCount} override{overrideCount === 1 ? '' : 's'}</span>
          {!row.is_active && (
            <span style={{ color: A.danger, marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              inactive
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggleActive(row)} style={btnGhost}>
          {row.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={() => onEdit(row)} style={btnGhost}>Edit</button>
        <button onClick={() => onDelete(row)} style={btnDanger}>Delete</button>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  row,
  onClose,
  onSaved,
  showToast,
}: {
  row:       CardOverride
  onClose:   () => void
  onSaved:   () => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [draft, setDraft]   = useState<CardOverride>(row)
  const [saving, setSaving] = useState(false)

  function patch<K extends keyof CardOverride>(key: K, value: CardOverride[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Partial<CardOverride> = {}
      ;(Object.keys(draft) as (keyof CardOverride)[]).forEach(k => {
        if (JSON.stringify(draft[k]) !== JSON.stringify(row[k])) {
          ;(payload as any)[k] = draft[k]
        }
      })
      if (Object.keys(payload).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }
      await updateCardOverride(row.id, payload)
      showToast(`Saved ${Object.keys(payload).length} field(s).`, 'success')
      onSaved()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
    }
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px', overflowY: 'auto',
    }}>
      <div style={{
        background: A.bg, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 720,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              {row.kind === 'dining' ? 'Dining Override' : 'Experience Override'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {row.canonical_name ?? '(unknown)'}
            </div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>
              {row.canonical_slug}
              {row.canonical_global_dest_slug && (
                <span style={{ color: A.muted, marginLeft: 8, fontFamily: A.font }}>
                  · {row.canonical_global_dest_slug}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: -6 }}>
          NULL = canonical flows through · '' (empty string) = hide on render · non-empty = override
        </div>

        {/* Active toggle */}
        <Field label='is_active'>
          <select
            style={inputStyle}
            value={String(draft.is_active)}
            onChange={e => patch('is_active', e.target.value === 'true')}
          >
            <option value='true'>true (card renders)</option>
            <option value='false'>false (card hidden on this engagement)</option>
          </select>
        </Field>

        {/* Text overrides */}
        <CollapsibleSection title='Text Overrides' defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Kicker'>
              <input
                style={inputStyle}
                value={draft.kicker_override ?? ''}
                onChange={e => patch('kicker_override', e.target.value || null)}
              />
            </Field>
            <Field label='Name'>
              <input
                style={inputStyle}
                value={draft.name_override ?? ''}
                onChange={e => patch('name_override', e.target.value || null)}
              />
            </Field>
          </div>
          <Field label='Tagline'>
            <input
              style={inputStyle}
              value={draft.tagline_override ?? ''}
              onChange={e => patch('tagline_override', e.target.value || null)}
            />
          </Field>
          <Field label='Body'>
            <textarea
              style={textareaStyle}
              value={draft.body_override ?? ''}
              onChange={e => patch('body_override', e.target.value || null)}
            />
          </Field>
          <Field label='Bullets Heading'>
            <input
              style={inputStyle}
              value={draft.bullets_heading_override ?? ''}
              onChange={e => patch('bullets_heading_override', e.target.value || null)}
            />
          </Field>
          <Field label='Bullets (jsonb — array of strings or null)'>
            <JsonField value={draft.bullets_override} onChange={v => patch('bullets_override', v)} />
          </Field>
        </CollapsibleSection>

        {/* Image overrides */}
        <CollapsibleSection title='Image Overrides' defaultOpen={false}>
          <Field label='Image Src'>
            <ImageFieldWithUploader
              value={draft.image_src_override}
              onChange={v => patch('image_src_override', v)}
            />
          </Field>
          <Field label='Image Alt'>
            <input
              style={inputStyle}
              value={draft.image_alt_override ?? ''}
              onChange={e => patch('image_alt_override', e.target.value || null)}
            />
          </Field>
          <Field label='Image Credit'>
            <input
              style={inputStyle}
              value={draft.image_credit_override ?? ''}
              onChange={e => patch('image_credit_override', e.target.value || null)}
            />
          </Field>
          <Field label='Image Credit URL'>
            <input
              style={inputStyle}
              value={draft.image_credit_url_override ?? ''}
              onChange={e => patch('image_credit_url_override', e.target.value || null)}
            />
          </Field>
          <Field label='Image License'>
            <input
              style={inputStyle}
              value={draft.image_license_override ?? ''}
              onChange={e => patch('image_license_override', e.target.value || null)}
            />
          </Field>
        </CollapsibleSection>

        {/* Action bar */}
        <div style={{
          display: 'flex', gap: 10, paddingTop: 8,
          borderTop: `1px solid ${A.border}`,
          position: 'sticky', bottom: 0, background: A.bg,
        }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} disabled={saving} style={btnGhost}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Override picker ──────────────────────────────────────────────────────

function AddOverrideModal({
  engagementId,
  existingKeys,
  onClose,
  onAdded,
  showToast,
}: {
  engagementId: string
  existingKeys: Set<string>  // `${kind}:${id}` for dedupe
  onClose:      () => void
  onAdded:      () => void
  showToast:    (msg: string, type: 'success' | 'error') => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<CardCanonicalOption[]>([])
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      searchCanonicalCards(query).then(setResults).catch(() => setResults([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(
    () => results.filter(r => !existingKeys.has(`${r.kind}:${r.id}`)),
    [results, existingKeys],
  )

  async function addOne(option: CardCanonicalOption) {
    if (adding) return
    setAdding(true)
    try {
      await insertCardOverride({
        trip_id: engagementId,
        kind:    option.kind,
        card_id: option.id,
      })
      showToast(`Added ${option.name}.`, 'success')
      onAdded()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to add: ${message}`, 'error')
    }
    setAdding(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 20px',
    }}>
      <div style={{
        background: A.bg, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 24, width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>
            Add Card Override
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
          Search canonical dining + experiences. Existing overrides are hidden.
        </div>

        <input
          style={inputStyle}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search by name…'
          autoFocus
        />

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          maxHeight: 420, overflowY: 'auto',
        }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 12, textAlign: 'center' }}>
              {query ? 'No matching cards.' : 'Start typing to search.'}
            </div>
          )}
          {filtered.map(c => (
            <button
              key={`${c.kind}:${c.id}`}
              onClick={() => addOne(c)}
              disabled={adding}
              style={{
                textAlign: 'left',
                padding: '10px 14px', borderRadius: 8,
                background: A.bgInput, border: `1px solid ${A.border}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12,
                fontFamily: A.font,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: A.text }}>{c.name}</span>
                <span style={{ fontSize: 11, color: A.faint, fontFamily: "'DM Mono', monospace" }}>
                  {c.slug}
                  {c.global_destination_slug && (
                    <span style={{ marginLeft: 6, color: A.muted, fontFamily: A.font }}>
                      · {c.global_destination_slug}
                    </span>
                  )}
                </span>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: c.kind === 'dining' ? A.gold : A.muted,
                whiteSpace: 'nowrap',
              }}>
                {c.kind}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CardOverridesEditor({
  engagementId,
  showToast,
}: {
  engagementId: string
  showToast:    (msg: string, type: 'success' | 'error') => void
}) {
  const [rows, setRows]       = useState<CardOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CardOverride | null>(null)
  const [adding, setAdding]   = useState(false)

  async function load() {
    if (!engagementId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await fetchCardOverrides(engagementId)
      setRows(list)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to load card overrides: ${message}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  const existingKeys = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => {
      if (r.dining_venue_id) s.add(`dining:${r.dining_venue_id}`)
      if (r.experience_id)   s.add(`experience:${r.experience_id}`)
    })
    return s
  }, [rows])

  const dining     = useMemo(() => rows.filter(r => r.kind === 'dining'),     [rows])
  const experience = useMemo(() => rows.filter(r => r.kind === 'experience'), [rows])

  async function handleDelete(row: CardOverride) {
    const confirmed = window.confirm(
      `Remove override for "${row.canonical_name ?? '(unknown)'}"?\n\n` +
      `This deletes the override row only — the canonical card remains. ` +
      `If the engagement curation includes this card, it will revert to canonical content.\n\n` +
      `Cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteCardOverride(row.id)
      showToast('Override removed.', 'success')
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to delete: ${message}`, 'error')
    }
  }

  async function handleToggleActive(row: CardOverride) {
    try {
      await updateCardOverride(row.id, { is_active: !row.is_active })
      showToast(row.is_active ? 'Deactivated.' : 'Activated.', 'success')
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
    }
  }

  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${A.border}`,
      borderRadius: 14, padding: 24,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          }}>
            Card Overrides
          </div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            Per-engagement copy + image overrides for dining + experiences
          </div>
        </div>
        <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add Override</button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 16, textAlign: 'center' }}>
          No card overrides yet. Add one to override canonical copy or imagery for this engagement.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dining.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                Dining ({dining.length})
              </div>
              {dining.map(row => (
                <OverrideRowCard
                  key={row.id}
                  row={row}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}

          {experience.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                Experiences ({experience.length})
              </div>
              {experience.map(row => (
                <OverrideRowCard
                  key={row.id}
                  row={row}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          showToast={showToast}
        />
      )}

      {adding && (
        <AddOverrideModal
          engagementId={engagementId}
          existingKeys={existingKeys}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); load() }}
          showToast={showToast}
        />
      )}
    </div>
  )
}