/* CardOverridesEditor.tsx
 * Editor for travel_overlay_engagement_content_card_overrides.
 *
 * Last updated: S38 - Removed canonical_slug display from edit modal header
 *   and add-override picker rows. UUID-only throughout.
 * Prior: S334
 */

import { useEffect, useMemo, useState } from 'react'

import {
  fetchCardOverrides,
  updateCardOverride,
  insertCardOverride,
  deleteCardOverride,
  searchCanonicalCards,
} from '../../queries/queriesAdminCardOverrides'
import type { CardOverride, CardCanonicalOption, CardKind } from '../../types/typesCards'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { A } from '../../tokens/tokensAdmin'

// ── Shared styles ────────────────────────────────────────────────────────────

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
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function JsonField({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const [draft, setDraft] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDraft(JSON.stringify(value ?? null, null, 2)) }, [value])

  function handleChange(next: string) {
    setDraft(next)
    if (next.trim() === '' || next.trim() === 'null') { setError(null); onChange(null); return }
    try {
      const parsed = JSON.parse(next)
      setError(null)
      onChange(parsed)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'invalid JSON')
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
      {error && <div style={{ fontSize: 11, color: A.danger, fontFamily: A.font, marginTop: 4 }}>Error: {error}</div>}
    </div>
  )
}

// ── Override row card ────────────────────────────────────────────────────────

function OverrideRowCard({
  row, onEdit, onDelete, onToggleActive,
}: {
  row:            CardOverride
  onEdit:         (row: CardOverride) => void
  onDelete:       (row: CardOverride) => void
  onToggleActive: (row: CardOverride) => void
}) {
  const thumb = thumbSrc(row.imageSrcOverride ?? row.canonicalImageSrc)
  const overrideCount = [
    row.kickerOverride, row.nameOverride, row.taglineOverride,
    row.bodyOverride, row.bulletsHeadingOverride, row.imageSrcOverride,
    row.imageAltOverride, row.imageCreditOverride,
    row.imageCreditUrlOverride, row.imageLicenseOverride,
  ].filter(v => v !== null).length + (row.bulletsOverride !== null ? 1 : 0)

  return (
    <div style={{
      opacity: row.isActive ? 1 : 0.5,
      background: A.bgInput, border: `1px solid ${A.border}`,
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 56, height: 40, borderRadius: 6, overflow: 'hidden',
        background: A.bg, border: `1px solid ${A.border}`, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb && <img src={thumb} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
        {!thumb && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>no img</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.nameOverride ?? row.canonicalName ?? <span style={{ color: A.faint, fontStyle: 'italic' }}>(unknown)</span>}
        </div>
        <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
          {row.canonicalGlobalDestSlug ?? '-'}
          <span style={{ color: A.faint, marginLeft: 8 }}>· {overrideCount} override{overrideCount === 1 ? '' : 's'}</span>
          {!row.isActive && (
            <span style={{ color: A.danger, marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              inactive
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggleActive(row)} style={btnGhost}>{row.isActive ? 'Deactivate' : 'Activate'}</button>
        <button onClick={() => onEdit(row)} style={btnGhost}>Edit</button>
        <button onClick={() => onDelete(row)} style={btnDanger}>Delete</button>
      </div>
    </div>
  )
}

// ── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  row, onClose, onSaved, showToast,
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
      showToast(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              {row.kind === 'dining' ? 'Dining Override' : 'Experience Override'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {row.canonicalName ?? '(unknown)'}
            </div>
            {row.canonicalGlobalDestSlug && (
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
                {row.canonicalGlobalDestSlug}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: -6 }}>
          NULL = canonical flows through · '' (empty string) = hide on render · non-empty = override
        </div>

        <Field label='isActive'>
          <select style={inputStyle} value={String(draft.isActive)} onChange={e => patch('isActive', e.target.value === 'true')}>
            <option value='true'>true (card renders)</option>
            <option value='false'>false (card hidden on this engagement)</option>
          </select>
        </Field>

        <CollapsibleSection title='Text Overrides' defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Kicker'>
              <input style={inputStyle} value={draft.kickerOverride ?? ''} onChange={e => patch('kickerOverride', e.target.value || null)} />
            </Field>
            <Field label='Name'>
              <input style={inputStyle} value={draft.nameOverride ?? ''} onChange={e => patch('nameOverride', e.target.value || null)} />
            </Field>
          </div>
          <Field label='Tagline'>
            <input style={inputStyle} value={draft.taglineOverride ?? ''} onChange={e => patch('taglineOverride', e.target.value || null)} />
          </Field>
          <Field label='Body'>
            <textarea style={textareaStyle} value={draft.bodyOverride ?? ''} onChange={e => patch('bodyOverride', e.target.value || null)} />
          </Field>
          <Field label='Bullets Heading'>
            <input style={inputStyle} value={draft.bulletsHeadingOverride ?? ''} onChange={e => patch('bulletsHeadingOverride', e.target.value || null)} />
          </Field>
          <Field label='Bullets (jsonb - array of strings or null)'>
            <JsonField value={draft.bulletsOverride} onChange={v => patch('bulletsOverride', v)} />
          </Field>
        </CollapsibleSection>

        <CollapsibleSection title='Image Overrides' defaultOpen={false}>
          <Field label='Image Src'>
            <ImageFieldWithUploader value={draft.imageSrcOverride} onChange={v => patch('imageSrcOverride', v)} />
          </Field>
          <Field label='Image Alt'>
            <input style={inputStyle} value={draft.imageAltOverride ?? ''} onChange={e => patch('imageAltOverride', e.target.value || null)} />
          </Field>
          <Field label='Image Credit'>
            <input style={inputStyle} value={draft.imageCreditOverride ?? ''} onChange={e => patch('imageCreditOverride', e.target.value || null)} />
          </Field>
          <Field label='Image Credit URL'>
            <input style={inputStyle} value={draft.imageCreditUrlOverride ?? ''} onChange={e => patch('imageCreditUrlOverride', e.target.value || null)} />
          </Field>
          <Field label='Image License'>
            <input style={inputStyle} value={draft.imageLicenseOverride ?? ''} onChange={e => patch('imageLicenseOverride', e.target.value || null)} />
          </Field>
        </CollapsibleSection>

        <div style={{
          display: 'flex', gap: 10, paddingTop: 8,
          borderTop: `1px solid ${A.border}`,
          position: 'sticky', bottom: 0, background: A.bg,
        }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} disabled={saving} style={btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Override picker ──────────────────────────────────────────────────────

function AddOverrideModal({
  engagementId, existingKeys, onClose, onAdded, showToast,
}: {
  engagementId: string
  existingKeys: Set<string>
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
      await insertCardOverride({ engagementId: engagementId, kind: option.kind, cardId: option.id })
      showToast(`Added ${option.name}.`, 'success')
      onAdded()
    } catch (e: unknown) {
      showToast(`Failed to add: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
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
          <div style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>Add Card Override</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
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
                textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                background: A.bgInput, border: `1px solid ${A.border}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 12, fontFamily: A.font,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: A.text }}>{c.name}</span>
                {c.globalDestinationSlug && (
                  <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                    {c.globalDestinationSlug}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: c.kind === 'dining' ? A.gold : A.muted, whiteSpace: 'nowrap',
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
  engagementId, showToast,
}: {
  engagementId: string
  showToast:    (msg: string, type: 'success' | 'error') => void
}) {
  const [rows, setRows]       = useState<CardOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CardOverride | null>(null)
  const [adding, setAdding]   = useState(false)

  async function load() {
    if (!engagementId) { setLoading(false); return }
    setLoading(true)
    try {
      setRows(await fetchCardOverrides(engagementId))
    } catch (e: unknown) {
      showToast(`Failed to load card overrides: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  const existingKeys = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => {
      if (r.diningVenueId) s.add(`dining:${r.diningVenueId}`)
      if (r.experienceId)   s.add(`experience:${r.experienceId}`)
    })
    return s
  }, [rows])

  const dining     = useMemo(() => rows.filter(r => r.kind === 'dining'),     [rows])
  const experience = useMemo(() => rows.filter(r => r.kind === 'experience'), [rows])

  async function handleDelete(row: CardOverride) {
    if (!window.confirm(`Remove override for "${row.canonicalName ?? '(unknown)'}"?\n\nThis deletes the override row only. Cannot be undone.`)) return
    try {
      await deleteCardOverride(row.id)
      showToast('Override removed.', 'success')
      load()
    } catch (e: unknown) {
      showToast(`Failed to delete: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    }
  }

  async function handleToggleActive(row: CardOverride) {
    try {
      await updateCardOverride(row.id, { isActive: !row.isActive })
      showToast(row.isActive ? 'Deactivated.' : 'Activated.', 'success')
      load()
    } catch (e: unknown) {
      showToast(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    }
  }

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>
            Card Overrides
          </div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            Per-engagement copy + image overrides for dining + experiences
          </div>
        </div>
        <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add Override</button>
      </div>

      {loading && <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>}

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
                <OverrideRowCard key={row.id} row={row} onEdit={setEditing} onDelete={handleDelete} onToggleActive={handleToggleActive} />
              ))}
            </div>
          )}
          {experience.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                Experiences ({experience.length})
              </div>
              {experience.map(row => (
                <OverrideRowCard key={row.id} row={row} onEdit={setEditing} onDelete={handleDelete} onToggleActive={handleToggleActive} />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} showToast={showToast} />
      )}
      {adding && (
        <AddOverrideModal engagementId={engagementId} existingKeys={existingKeys} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load() }} showToast={showToast} />
      )}
    </div>
  )
}