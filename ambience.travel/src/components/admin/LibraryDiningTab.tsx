/* LibraryDiningTab.tsx
 * Canonical dining venues library — list + filter + edit modal + JSON ingest.
 *
 * Library = Layer 4 canonical pool. Edits here flow to every guide page that
 * features the venue. The guide overlay (per-destination hero/headline/intro)
 * lives in GuidesDiningTab, not here.
 *
 * Destination scoping:
 *   - Unscoped (#admin/library/dining): all venues, dropdown filter active.
 *   - Scoped   (#admin/library/dining/<dest-uuid>): venues for one destination,
 *     dropdown disabled, header shows destination name + "All destinations" link,
 *     image uploader pre-targets that destination's dining folder.
 *
 * UUID-keyed throughout. Destination name + slug for display only —
 * resolved via destinationsById Map at render time, never carried on
 * query types or used as a key.
 *
 * Last updated: S36 — destinationId prop wired through hash. Image uploads
 *   scoped to destination's dining folder via presetPath.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../lib/adminTokens'
import { buildAdminHash } from '../../lib/adminPath'
import { resolveStoragePath } from '../../lib/storagePath'
import {
  fetchAllDiningVenues,
  fetchDestinationOptions,
  updateDiningVenue,
  deleteDiningVenue,
  ingestDiningJson,
  type AdminDiningVenue,
  type DestinationOption,
  type DiningVenuePatch,
  type IngestPayload,
  type IngestResult,
} from '../../lib/adminGuidesQueries'
import { supabase } from '../../lib/supabase'
import ImageFieldWithUploader from './ImageFieldWithUploader'

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
      padding: '12px 20px', borderRadius: 12,
      background:   type === 'success' ? '#1a2e1a' : '#2e1a1a',
      border:       `1px solid ${type === 'success' ? A.positive + '50' : A.danger + '50'}`,
      color:        type === 'success' ? A.positive : A.danger,
      fontSize: 13, fontFamily: A.font, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>{message}</div>
  )
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }
  return { toast, showToast }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: A.text, fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
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
  border: '1px solid rgba(216,181,106,0.30)', borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer',
  letterSpacing: '0.04em',
}
const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
  padding: '7px 14px', background: 'transparent', color: A.danger,
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
  fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Edit Modal ───────────────────────────────────────────────────────────────

function EditVenueModal({
  venue,
  destinationName,
  uploadPresetPath,
  onClose,
  onSaved,
  showToast,
}: {
  venue:            AdminDiningVenue
  destinationName:  string
  uploadPresetPath: string | null
  onClose:          () => void
  onSaved:          () => void
  showToast:        (m: string, t: 'success' | 'error') => void
}) {
  const [draft, setDraft] = useState<AdminDiningVenue>(venue)
  const [saving, setSaving] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  function patch<K extends keyof AdminDiningVenue>(k: K, v: AdminDiningVenue[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  function addTag() {
    const v = tagDraft.trim()
    if (!v) return
    const next = [...(draft.tags ?? []), v].filter((x, i, a) => a.indexOf(x) === i)
    patch('tags', next)
    setTagDraft('')
  }

  function removeTag(t: string) {
    patch('tags', (draft.tags ?? []).filter(x => x !== t))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: DiningVenuePatch = {}
      const fields: (keyof DiningVenuePatch)[] = [
        'name', 'cuisine_subcategory', 'michelin', 'address', 'maps_url', 'website',
        'ambience_take', 'why_recommend', 'neighborhood', 'price_band',
        'public_preview_rank', 'tags',
        'image_src', 'image_alt', 'image_2_src', 'image_2_alt',
        'is_active', 'sort_order',
      ]
      for (const f of fields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(venue[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }
      if (Object.keys(payload).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }
      await updateDiningVenue(venue.id, payload)
      showToast(`Saved ${Object.keys(payload).length} field(s).`, 'success')
      onSaved()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${msg}`, 'error')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${venue.name}"? This cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteDiningVenue(venue.id)
      showToast('Venue deleted.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${msg}`, 'error')
    }
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 32, overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(900px, 100%)', background: A.bg, border: `1px solid ${A.border}`,
        borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Edit Venue · {destinationName}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>{venue.name}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>{venue.slug}</div>
          </div>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Name'>
            <input style={inputStyle} value={draft.name} onChange={e => patch('name', e.target.value)} />
          </Field>
          <Field label='Cuisine Subcategory'>
            <input style={inputStyle} value={draft.cuisine_subcategory ?? ''} onChange={e => patch('cuisine_subcategory', e.target.value || null)} />
          </Field>
          <Field label='Michelin'>
            <select style={inputStyle} value={String(draft.michelin)} onChange={e => patch('michelin', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label='Neighborhood'>
            <input style={inputStyle} value={draft.neighborhood ?? ''} onChange={e => patch('neighborhood', e.target.value || null)} />
          </Field>
          <Field label='Price Band'>
            <input style={inputStyle} value={draft.price_band ?? ''} onChange={e => patch('price_band', e.target.value || null)} />
          </Field>
          <Field label='Public Preview Rank (1-3 or empty)'>
            <input
              style={inputStyle}
              type='number'
              min={1}
              max={3}
              value={draft.public_preview_rank ?? ''}
              onChange={e => {
                const v = e.target.value
                if (v === '') { patch('public_preview_rank', null); return }
                const n = parseInt(v, 10)
                if (Number.isNaN(n)) return
                patch('public_preview_rank', n)
              }}
            />
          </Field>
        </div>

        <Field label='Address'>
          <input style={inputStyle} value={draft.address ?? ''} onChange={e => patch('address', e.target.value || null)} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Maps URL'>
            <input style={inputStyle} value={draft.maps_url ?? ''} onChange={e => patch('maps_url', e.target.value || null)} />
          </Field>
          <Field label='Website'>
            <input style={inputStyle} value={draft.website ?? ''} onChange={e => patch('website', e.target.value || null)} />
          </Field>
        </div>

        <Field label='Ambience Take (guide page body)'>
          <textarea style={textareaStyle} value={draft.ambience_take ?? ''} onChange={e => patch('ambience_take', e.target.value || null)} />
        </Field>

        <Field label='Why Recommend (advisor framing)'>
          <textarea style={textareaStyle} value={draft.why_recommend ?? ''} onChange={e => patch('why_recommend', e.target.value || null)} />
        </Field>

        <Field label='Tags'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 24 }}>
              {(draft.tags ?? []).map(t => (
                <span key={t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 100,
                  background: 'rgba(216,181,106,0.08)',
                  border: `1px solid ${A.borderGold}`,
                  color: A.gold, fontSize: 11, fontFamily: A.font, fontWeight: 600,
                }}>
                  {t}
                  <span onClick={() => removeTag(t)} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder='Add tag… (Enter)'
              />
              <button onClick={addTag} style={btnGhost}>+ Add</button>
            </div>
          </div>
        </Field>

        <Field label='Image 1 Src'>
          <ImageFieldWithUploader
            value={draft.image_src}
            onChange={v => patch('image_src', v)}
            presetPath={uploadPresetPath ?? undefined}
          />
        </Field>
        <Field label='Image 1 Alt'>
          <input style={inputStyle} value={draft.image_alt ?? ''} onChange={e => patch('image_alt', e.target.value || null)} />
        </Field>

        <Field label='Image 2 Src'>
          <ImageFieldWithUploader
            value={draft.image_2_src}
            onChange={v => patch('image_2_src', v)}
            presetPath={uploadPresetPath ?? undefined}
          />
        </Field>
        <Field label='Image 2 Alt'>
          <input style={inputStyle} value={draft.image_2_alt ?? ''} onChange={e => patch('image_2_alt', e.target.value || null)} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Active'>
            <select style={inputStyle} value={String(draft.is_active)} onChange={e => patch('is_active', e.target.value === 'true')}>
              <option value='true'>Yes</option>
              <option value='false'>No</option>
            </select>
          </Field>
          <Field label='Sort Order'>
            <input
              style={inputStyle}
              type='number'
              value={draft.sort_order}
              onChange={e => patch('sort_order', parseInt(e.target.value, 10) || 0)}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}` }}>
          <button onClick={handleDelete} style={btnDanger} disabled={saving}>Delete venue</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
            <button onClick={handleSave} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Import JSON Modal ────────────────────────────────────────────────────────

function ImportJsonModal({
  destinations,
  scopedDestinationId,
  onClose,
  onImported,
  showToast,
}: {
  destinations:        DestinationOption[]
  scopedDestinationId: string | null
  onClose:             () => void
  onImported:          () => void
  showToast:           (m: string, t: 'success' | 'error') => void
}) {
  const [destId, setDestId] = useState(scopedDestinationId ?? '')
  const [jsonText, setJsonText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)

  async function handleImport() {
    if (!destId) { showToast('Pick a destination.', 'error'); return }
    if (!jsonText.trim()) { showToast('Paste JSON content.', 'error'); return }

    setBusy(true)
    try {
      const payload = JSON.parse(jsonText) as IngestPayload
      if (!payload.restaurants || !Array.isArray(payload.restaurants)) {
        throw new Error('JSON must have a "restaurants" array')
      }
      const dest = destinations.find(d => d.id === destId)
      if (!dest) throw new Error('Destination not found')

      const r = await ingestDiningJson(destId, payload, dest.slug)
      setResult(r)
      showToast(`Inserted ${r.inserted} venues, skipped ${r.skipped.length}.`, 'success')
      onImported()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      showToast(`Import failed: ${msg}`, 'error')
    }
    setBusy(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 32, overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(800px, 100%)', background: A.bg, border: `1px solid ${A.border}`,
        borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Import Dining JSON
            </div>
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
              Slugs that already exist for this destination are skipped (DB is canon).
            </div>
          </div>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>

        <Field label='Destination'>
          <select
            style={inputStyle}
            value={destId}
            onChange={e => setDestId(e.target.value)}
            disabled={!!scopedDestinationId}
          >
            <option value=''>— Select destination —</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>

        <Field label='JSON content'>
          <textarea
            style={{ ...textareaStyle, fontFamily: 'DM Mono, monospace', fontSize: 11, minHeight: 280 }}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder='{ "destination": "...", "restaurants": [ ... ] }'
          />
        </Field>

        {result && (
          <div style={{
            padding: 14, borderRadius: 10,
            background: A.bgInput, border: `1px solid ${A.border}`,
            fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6,
          }}>
            <div style={{ color: A.positive, fontWeight: 700, marginBottom: 4 }}>Inserted: {result.inserted}</div>
            {result.skipped.length > 0 && (
              <div>
                <div style={{ color: A.faint, fontWeight: 700, marginBottom: 4 }}>Skipped ({result.skipped.length}):</div>
                {result.skipped.map(s => (
                  <div key={s.slug} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                    {s.slug} — {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={btnGhost} disabled={busy}>Done</button>
          <button onClick={handleImport} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }} disabled={busy}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface LibraryDiningTabProps {
  destinationId: string | null
}

interface DestinationFull extends DestinationOption {
  storage_path: string | null
}

export default function LibraryDiningTab({ destinationId }: LibraryDiningTabProps) {
  const [venues, setVenues] = useState<AdminDiningVenue[]>([])
  const [destinations, setDestinations] = useState<DestinationFull[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingVenue, setEditingVenue] = useState<AdminDiningVenue | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const { toast, showToast } = useToast()

  // Effective filter is from URL (destinationId), not local state — Library
  // is always either fully scoped (URL has UUID) or fully unscoped (no UUID).
  const effectiveFilter = destinationId ?? ''

  const destinationsById = useMemo(() => {
    const m = new Map<string, DestinationFull>()
    destinations.forEach(d => m.set(d.id, d))
    return m
  }, [destinations])

  const scopedDest = destinationId ? destinationsById.get(destinationId) ?? null : null

  // Storage path for image uploads — only resolves when we have a scoped
  // destination AND it has a storage_path configured. Null means uploader
  // falls back to its default (full GeoCascade picker).
  const uploadPresetPath = useMemo(() => {
    if (!scopedDest || !scopedDest.storage_path) return null
    return resolveStoragePath({
      destinationStoragePath: scopedDest.storage_path,
      category: 'dining',
    })
  }, [scopedDest])

  async function loadDestinations() {
    const { data, error } = await supabase
      .from('global_destinations')
      .select('id, slug, name, storage_path')
      .order('name', { ascending: true })
    if (error) throw new Error(`Failed to fetch destinations: ${error.message}`)
    setDestinations((data ?? []) as DestinationFull[])
  }

  async function load() {
    setLoading(true)
    try {
      const [v] = await Promise.all([
        fetchAllDiningVenues(effectiveFilter || null),
        destinations.length === 0 ? loadDestinations() : Promise.resolve(),
      ])
      setVenues(v)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to load: ${msg}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return venues
    return venues.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.slug.toLowerCase().includes(q) ||
      (v.cuisine_subcategory ?? '').toLowerCase().includes(q) ||
      (v.neighborhood ?? '').toLowerCase().includes(q)
    )
  }, [venues, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
            Library
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
            {scopedDest ? `${scopedDest.name} · Dining` : 'Dining Venues'}
          </div>
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            {scopedDest
              ? `Editing ${scopedDest.name} venues only. Image uploads will go to ${uploadPresetPath ?? '(no storage path configured)'}.`
              : 'Canonical pool — edits flow to every guide page that features the venue.'}
          </div>
          {scopedDest && (
            <a
              href={buildAdminHash({ product: 'library', tab: 'dining', destinationId: null })}
              style={{
                display: 'inline-block', marginTop: 10,
                fontSize: 11, color: A.gold, textDecoration: 'none',
                fontFamily: A.font, letterSpacing: '0.04em',
              }}
            >
              ← All destinations
            </a>
          )}
        </div>
        <button onClick={() => setImportOpen(true)} style={btnPrimary}>+ Import JSON</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select
          style={{ ...inputStyle, width: 240, opacity: scopedDest ? 0.6 : 1 }}
          value={effectiveFilter}
          disabled={!!scopedDest}
          onChange={e => {
            // Unscoped mode — change filter via URL
            const next = e.target.value
            window.location.hash = buildAdminHash({
              product: 'library', tab: 'dining',
              destinationId: next || null,
            })
          }}
        >
          <option value=''>All destinations ({venues.length} venues)</option>
          {destinations.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          placeholder='Search by name, slug, cuisine, neighborhood…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', borderRadius: 12,
          background: A.bgCard, border: `1px solid ${A.border}`,
          color: A.faint, fontSize: 13, fontFamily: A.font,
        }}>
          No venues match those filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(v => {
            const dest = destinationsById.get(v.global_destination_id)
            return (
              <div
                key={v.id}
                onClick={() => setEditingVenue(v)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 80px 80px',
                  gap: 12,
                  padding: '10px 14px',
                  background: A.bgCard,
                  border: `1px solid ${A.border}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{v.name}</div>
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{v.slug}</div>
                </div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
                  {dest?.name ?? <span style={{ color: A.faint }}>(unknown)</span>}
                </div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
                  {v.cuisine_subcategory ?? <span style={{ color: A.faint }}>—</span>}
                </div>
                <div style={{ fontSize: 11, color: v.michelin ? A.gold : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                  {v.michelin ? '★ Michelin' : ''}
                </div>
                <div style={{ fontSize: 11, color: v.is_active ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                  {v.is_active ? 'Active' : 'Hidden'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingVenue && (
        <EditVenueModal
          venue={editingVenue}
          destinationName={destinationsById.get(editingVenue.global_destination_id)?.name ?? '(unknown)'}
          uploadPresetPath={
            // Per-row preset path: resolves from the venue's destination,
            // not the scoped one (so unscoped library can still upload to
            // the right folder when editing a single venue).
            (() => {
              const d = destinationsById.get(editingVenue.global_destination_id)
              if (!d || !d.storage_path) return null
              return resolveStoragePath({
                destinationStoragePath: d.storage_path,
                category: 'dining',
              })
            })()
          }
          onClose={() => setEditingVenue(null)}
          onSaved={load}
          showToast={showToast}
        />
      )}

      {importOpen && (
        <ImportJsonModal
          destinations={destinations}
          scopedDestinationId={destinationId}
          onClose={() => setImportOpen(false)}
          onImported={load}
          showToast={showToast}
        />
      )}
    </div>
  )
}