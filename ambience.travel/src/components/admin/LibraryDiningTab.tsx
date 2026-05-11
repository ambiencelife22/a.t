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
 * Toast: useToast() from ToastContext — ToastContainer mounted in main.tsx.
 * Styles: canonical shared objects from adminStyles.ts.
 * UI atoms: Field from adminUi.tsx.
 *
 * Last updated: S40D (refactor) — extracted local Toast/useToast, style objects,
 *   Field to shared modules. No functional changes.
 * Prior: S39 — Removed legacy michelin boolean. Added recognition fields.
 * Prior: S39 — Synced to new AdminDiningVenue shape.
 * Prior: S38 — Removed slug.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../lib/adminTokens'
import { useToast } from '../../lib/ToastContext'
import {
  inputStyle, textareaStyle,
  btnPrimary, btnGhost, btnDanger,
} from '../../lib/adminStyles'
import { Field } from './adminUi'
import { buildAdminHash } from '../../lib/adminPath'
import { resolveStoragePath } from '../../lib/storagePath'
import {
  fetchAllDiningVenues,
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

// ── Recognition label helper ──────────────────────────────────────────────────

function recognitionLabel(v: AdminDiningVenue): string {
  const parts: string[] = []
  if (v.michelin_award === 'star') {
    const stars = v.michelin_stars ?? 1
    parts.push('★'.repeat(stars))
  }
  if (v.michelin_award === 'bib_gourmand') parts.push('Bib')
  if (v.michelin_green_star) parts.push('Green ★')
  if (v.worlds_50_best) parts.push('50 Best')
  return parts.join(' · ')
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditVenueModal({
  venue,
  destinationName,
  uploadPresetPath,
  onClose,
  onSaved,
}: {
  venue:            AdminDiningVenue
  destinationName:  string
  uploadPresetPath: string | null
  onClose:          () => void
  onSaved:          () => void
}) {
  const [draft, setDraft]     = useState<AdminDiningVenue>(venue)
  const [saving, setSaving]   = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const { toast }             = useToast()

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
        'name', 'cuisine_subcategory',
        'michelin_award', 'michelin_stars', 'michelin_green_star', 'worlds_50_best',
        'kicker', 'tagline', 'body', 'bullets_heading', 'bullets',
        'address', 'maps_url', 'website',
        'neighborhood', 'price_band', 'public_preview_rank', 'tags',
        'image_src', 'image_alt', 'image_credit', 'image_credit_url', 'image_license',
        'image_2_src', 'image_2_alt',
        'is_active', 'sort_order',
      ]
      for (const f of fields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(venue[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }
      if (Object.keys(payload).length === 0) {
        toast.success('No changes.')
        setSaving(false)
        return
      }
      await updateDiningVenue(venue.id, payload)
      toast.success(`Saved ${Object.keys(payload).length} field(s).`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${venue.name}"? This cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteDiningVenue(venue.id)
      toast.success('Venue deleted.')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
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
          </div>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>

        {/* Identity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Name'>
            <input style={inputStyle} value={draft.name} onChange={e => patch('name', e.target.value)} />
          </Field>
          <Field label='Cuisine Subcategory'>
            <input style={inputStyle} value={draft.cuisine_subcategory ?? ''} onChange={e => patch('cuisine_subcategory', e.target.value || null)} />
          </Field>
          <Field label='Neighborhood'>
            <input style={inputStyle} value={draft.neighborhood ?? ''} onChange={e => patch('neighborhood', e.target.value || null)} />
          </Field>
          <Field label='Price Band'>
            <input style={inputStyle} value={draft.price_band ?? ''} onChange={e => patch('price_band', e.target.value || null)} />
          </Field>
          <Field label='Public Preview Rank (1-4 or empty)'>
            <input
              style={inputStyle} type='number' min={1} max={4}
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

        {/* Recognition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Michelin Award'>
            <select
              style={inputStyle}
              value={draft.michelin_award ?? ''}
              onChange={e => {
                const v = e.target.value
                if (v === '') { patch('michelin_award', null); patch('michelin_stars', null); return }
                patch('michelin_award', v as 'star' | 'bib_gourmand')
                if (v === 'bib_gourmand') patch('michelin_stars', null)
              }}
            >
              <option value=''>None</option>
              <option value='star'>Star</option>
              <option value='bib_gourmand'>Bib Gourmand</option>
            </select>
          </Field>
          <Field label='Michelin Stars (1-3, when award = Star)'>
            <input
              style={inputStyle} type='number' min={1} max={3}
              disabled={draft.michelin_award !== 'star'}
              value={draft.michelin_stars ?? ''}
              onChange={e => {
                const v = e.target.value
                if (v === '') { patch('michelin_stars', null); return }
                const n = parseInt(v, 10)
                if (Number.isNaN(n)) return
                patch('michelin_stars', n)
              }}
            />
          </Field>
          <Field label='Michelin Green Star'>
            <select style={inputStyle} value={String(draft.michelin_green_star ?? false)} onChange={e => patch('michelin_green_star', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label="World's 50 Best">
            <select style={inputStyle} value={String(draft.worlds_50_best ?? false)} onChange={e => patch('worlds_50_best', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
        </div>

        {/* Copy */}
        <Field label='Kicker'>
          <input style={inputStyle} value={draft.kicker ?? ''} onChange={e => patch('kicker', e.target.value || null)} />
        </Field>
        <Field label='Tagline'>
          <input style={inputStyle} value={draft.tagline ?? ''} onChange={e => patch('tagline', e.target.value || null)} />
        </Field>
        <Field label='Body'>
          <textarea style={textareaStyle} value={draft.body ?? ''} onChange={e => patch('body', e.target.value || null)} />
        </Field>
        <Field label='Bullets Heading'>
          <input style={inputStyle} value={draft.bullets_heading ?? ''} onChange={e => patch('bullets_heading', e.target.value || null)} />
        </Field>
        <Field label='Bullets (one per line)'>
          <textarea
            style={{ ...textareaStyle, minHeight: 100 }}
            value={(draft.bullets ?? []).join('\n')}
            onChange={e => {
              const lines = e.target.value.split('\n').map(l => l.trimEnd()).filter(Boolean)
              patch('bullets', lines.length > 0 ? lines : null)
            }}
          />
        </Field>

        {/* Contact */}
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

        {/* Tags */}
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

        {/* Images */}
        <Field label='Image 1 Src'>
          <ImageFieldWithUploader value={draft.image_src} onChange={v => patch('image_src', v)} presetPath={uploadPresetPath ?? undefined} />
        </Field>
        <Field label='Image 1 Alt'>
          <input style={inputStyle} value={draft.image_alt ?? ''} onChange={e => patch('image_alt', e.target.value || null)} />
        </Field>
        <Field label='Image 1 Credit'>
          <input style={inputStyle} value={draft.image_credit ?? ''} onChange={e => patch('image_credit', e.target.value || null)} />
        </Field>
        <Field label='Image 1 Credit URL'>
          <input style={inputStyle} value={draft.image_credit_url ?? ''} onChange={e => patch('image_credit_url', e.target.value || null)} />
        </Field>
        <Field label='Image 1 License'>
          <input style={inputStyle} value={draft.image_license ?? ''} onChange={e => patch('image_license', e.target.value || null)} />
        </Field>
        <Field label='Image 2 Src'>
          <ImageFieldWithUploader value={draft.image_2_src} onChange={v => patch('image_2_src', v)} presetPath={uploadPresetPath ?? undefined} />
        </Field>
        <Field label='Image 2 Alt'>
          <input style={inputStyle} value={draft.image_2_alt ?? ''} onChange={e => patch('image_2_alt', e.target.value || null)} />
        </Field>

        {/* Admin */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Active'>
            <select style={inputStyle} value={String(draft.is_active)} onChange={e => patch('is_active', e.target.value === 'true')}>
              <option value='true'>Yes</option>
              <option value='false'>No</option>
            </select>
          </Field>
          <Field label='Sort Order'>
            <input style={inputStyle} type='number' value={draft.sort_order} onChange={e => patch('sort_order', parseInt(e.target.value, 10) || 0)} />
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

// ── Import JSON Modal ─────────────────────────────────────────────────────────

function ImportJsonModal({
  destinations,
  scopedDestinationId,
  onClose,
  onImported,
}: {
  destinations:        DestinationOption[]
  scopedDestinationId: string | null
  onClose:             () => void
  onImported:          () => void
}) {
  const [destId, setDestId] = useState(scopedDestinationId ?? '')
  const [jsonText, setJsonText] = useState('')
  const [busy, setBusy]     = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const { toast }           = useToast()

  async function handleImport() {
    if (!destId) { toast.error('Pick a destination.'); return }
    if (!jsonText.trim()) { toast.error('Paste JSON content.'); return }

    setBusy(true)
    try {
      const payload = JSON.parse(jsonText) as IngestPayload
      if (!payload.restaurants || !Array.isArray(payload.restaurants)) {
        throw new Error('JSON must have a "restaurants" array')
      }
      const r = await ingestDiningJson(destId, payload)
      setResult(r)
      toast.success(`Inserted ${r.inserted} venues, skipped ${r.skipped.length}.`)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
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
              Venues with matching names for this destination are skipped.
            </div>
          </div>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>

        <Field label='Destination'>
          <select style={inputStyle} value={destId} onChange={e => setDestId(e.target.value)} disabled={!!scopedDestinationId}>
            <option value=''>— Select destination —</option>
            {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                  <div key={s.name} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                    {s.name} — {s.reason}
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

// ── Main ──────────────────────────────────────────────────────────────────────

interface LibraryDiningTabProps {
  destinationId: string | null
}

interface DestinationFull extends DestinationOption {
  storage_path: string | null
}

export default function LibraryDiningTab({ destinationId }: LibraryDiningTabProps) {
  const [venues, setVenues]           = useState<AdminDiningVenue[]>([])
  const [destinations, setDestinations] = useState<DestinationFull[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [editingVenue, setEditingVenue] = useState<AdminDiningVenue | null>(null)
  const [importOpen, setImportOpen]   = useState(false)
  const { toast }                     = useToast()

  const effectiveFilter = destinationId ?? ''

  const destinationsById = useMemo(() => {
    const m = new Map<string, DestinationFull>()
    destinations.forEach(d => m.set(d.id, d))
    return m
  }, [destinations])

  const scopedDest     = destinationId ? destinationsById.get(destinationId) ?? null : null
  const uploadPresetPath = useMemo(() => {
    if (!scopedDest || !scopedDest.storage_path) return null
    return resolveStoragePath({ destinationStoragePath: scopedDest.storage_path, category: 'dining' })
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
      toast.error(e instanceof Error ? e.message : 'Failed to load')
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
      (v.cuisine_subcategory ?? '').toLowerCase().includes(q) ||
      (v.neighborhood ?? '').toLowerCase().includes(q)
    )
  }, [venues, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>Library</div>
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
              style={{ display: 'inline-block', marginTop: 10, fontSize: 11, color: A.gold, textDecoration: 'none', fontFamily: A.font, letterSpacing: '0.04em' }}
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
            const next = e.target.value
            window.location.hash = buildAdminHash({ product: 'library', tab: 'dining', destinationId: next || null })
          }}
        >
          <option value=''>All destinations ({venues.length} venues)</option>
          {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          placeholder='Search by name, cuisine, neighborhood…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', borderRadius: 12, background: A.bgCard, border: `1px solid ${A.border}`, color: A.faint, fontSize: 13, fontFamily: A.font }}>
          No venues match those filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(v => {
            const dest  = destinationsById.get(v.global_destination_id)
            const recog = recognitionLabel(v)
            return (
              <div
                key={v.id}
                onClick={() => setEditingVenue(v)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 80px',
                  gap: 12, padding: '10px 14px',
                  background: A.bgCard, border: `1px solid ${A.border}`,
                  borderRadius: 10, cursor: 'pointer', alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{v.name}</div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{dest?.name ?? <span style={{ color: A.faint }}>(unknown)</span>}</div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{v.cuisine_subcategory ?? <span style={{ color: A.faint }}>—</span>}</div>
                <div style={{ fontSize: 11, color: recog ? A.gold : A.faint, fontFamily: A.font, fontWeight: 600 }}>{recog || ''}</div>
                <div style={{ fontSize: 11, color: v.is_active ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>{v.is_active ? 'Active' : 'Hidden'}</div>
              </div>
            )
          })}
        </div>
      )}

      {editingVenue && (
        <EditVenueModal
          venue={editingVenue}
          destinationName={destinationsById.get(editingVenue.global_destination_id)?.name ?? '(unknown)'}
          uploadPresetPath={(() => {
            const d = destinationsById.get(editingVenue.global_destination_id)
            if (!d || !d.storage_path) return null
            return resolveStoragePath({ destinationStoragePath: d.storage_path, category: 'dining' })
          })()}
          onClose={() => setEditingVenue(null)}
          onSaved={load}
        />
      )}

      {importOpen && (
        <ImportJsonModal
          destinations={destinations}
          scopedDestinationId={destinationId}
          onClose={() => setImportOpen(false)}
          onImported={load}
        />
      )}
    </div>
  )
}