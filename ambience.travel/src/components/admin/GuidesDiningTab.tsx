/* GuidesDiningTab.tsx
 * Per-destination dining guide overlay editor.
 *
 * Shows two sections:
 *   - Active guides (destinations with travel_dining_guides row)
 *   - Destinations without overlay (offers "Create guide" action)
 *
 * Click an active guide row → modal edits the overlay (hero, eyebrow, headline, intro).
 *
 * UUID-keyed throughout. Destination name + slug for display only —
 * resolved via destinationsById Map at render time, never carried on
 * query types or used as a key. Slug used only for buildGuideUrl (URL
 * routing, the one allowed slug surface).
 *
 * Last updated: S36 — initial ship.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../lib/adminTokens'
import { buildGuideUrl } from '../../lib/adminPath'
import {
  fetchDiningGuides,
  fetchDestinationsWithDining,
  fetchDestinationOptions,
  updateDiningGuide,
  createDiningGuide,
  deleteDiningGuide,
  type AdminDiningGuide,
  type DestinationWithDiningCounts,
  type DestinationOption,
  type DiningGuidePatch,
} from '../../lib/adminGuidesQueries'
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

function EditGuideModal({
  guide,
  destinationName,
  destinationSlug,
  onClose,
  onSaved,
  showToast,
}: {
  guide:           AdminDiningGuide
  destinationName: string
  destinationSlug: string
  onClose:         () => void
  onSaved:         () => void
  showToast:       (m: string, t: 'success' | 'error') => void
}) {
  const [draft, setDraft] = useState<AdminDiningGuide>(guide)
  const [saving, setSaving] = useState(false)

  function patch<K extends keyof AdminDiningGuide>(k: K, v: AdminDiningGuide[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: DiningGuidePatch = {}
      const fields: (keyof DiningGuidePatch)[] = [
        'hero_image_src', 'hero_image_alt',
        'eyebrow_override', 'headline_override', 'intro_override',
        'is_active',
      ]
      for (const f of fields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(guide[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }
      if (Object.keys(payload).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }
      await updateDiningGuide(guide.id, payload)
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
    if (!window.confirm(`Delete the guide overlay for ${destinationName}? Venues remain; only the per-destination hero/headline/intro is removed.`)) return
    setSaving(true)
    try {
      await deleteDiningGuide(guide.id)
      showToast('Overlay deleted.', 'success')
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
        width: 'min(800px, 100%)', background: A.bg, border: `1px solid ${A.border}`,
        borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Dining Guide
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>{destinationName}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>{destinationSlug}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={buildGuideUrl(destinationSlug)} target='_blank' rel='noopener noreferrer' style={{ ...btnGhost, color: A.gold, borderColor: A.borderGold, textDecoration: 'none' }}>
              View ↗
            </a>
            <button onClick={onClose} style={btnGhost}>Close</button>
          </div>
        </div>

        <Field label='Hero Image Src'>
          <ImageFieldWithUploader value={draft.hero_image_src} onChange={v => patch('hero_image_src', v)} />
        </Field>
        <Field label='Hero Image Alt'>
          <input style={inputStyle} value={draft.hero_image_alt ?? ''} onChange={e => patch('hero_image_alt', e.target.value || null)} />
        </Field>

        <Field label='Eyebrow override (NULL = "Curated dining" default)'>
          <input style={inputStyle} value={draft.eyebrow_override ?? ''} onChange={e => patch('eyebrow_override', e.target.value || null)} />
        </Field>
        <Field label='Headline override (NULL = default)'>
          <input style={inputStyle} value={draft.headline_override ?? ''} onChange={e => patch('headline_override', e.target.value || null)} />
        </Field>
        <Field label='Intro override (NULL = default intro paragraph)'>
          <textarea style={textareaStyle} value={draft.intro_override ?? ''} onChange={e => patch('intro_override', e.target.value || null)} />
        </Field>

        <Field label='Active'>
          <select style={inputStyle} value={String(draft.is_active)} onChange={e => patch('is_active', e.target.value === 'true')}>
            <option value='true'>Yes</option>
            <option value='false'>No</option>
          </select>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}` }}>
          <button onClick={handleDelete} style={btnDanger} disabled={saving}>Delete overlay</button>
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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function GuidesDiningTab() {
  const [guides, setGuides] = useState<AdminDiningGuide[]>([])
  const [destinationsWithCounts, setDestinationsWithCounts] = useState<DestinationWithDiningCounts[]>([])
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminDiningGuide | null>(null)
  const [creating, setCreating] = useState(false)
  const { toast, showToast } = useToast()

  const destinationsById = useMemo(() => {
    const m = new Map<string, DestinationOption>()
    destinationOptions.forEach(d => m.set(d.id, d))
    return m
  }, [destinationOptions])

  async function load() {
    setLoading(true)
    try {
      const [g, d, opts] = await Promise.all([
        fetchDiningGuides(),
        fetchDestinationsWithDining(),
        fetchDestinationOptions(),
      ])
      setGuides(g)
      setDestinationsWithCounts(d)
      setDestinationOptions(opts)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to load: ${msg}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(destId: string) {
    setCreating(true)
    try {
      await createDiningGuide(destId)
      const name = destinationsById.get(destId)?.name ?? '(destination)'
      showToast(`Guide created for ${name}. Click to edit.`, 'success')
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${msg}`, 'error')
    }
    setCreating(false)
  }

  const guideByDestId = new Map(guides.map(g => [g.global_destination_id, g]))
  const destinationsWithoutOverlay = destinationsWithCounts.filter(d => !guideByDestId.has(d.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Guides
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          Dining Guides
        </div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
          Per-destination overlay (hero, eyebrow, headline, intro). Venues themselves live in Library.
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
              Active Guides ({guides.length})
            </div>
            {guides.length === 0 ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>None yet. Create one below.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {guides.map(g => {
                  const dest = destinationsById.get(g.global_destination_id)
                  const venueCount = destinationsWithCounts.find(d => d.id === g.global_destination_id)?.venue_count ?? 0
                  return (
                    <div
                      key={g.id}
                      onClick={() => setEditing(g)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr 100px 80px',
                        gap: 12, padding: '12px 14px',
                        background: A.bgCard, border: `1px solid ${A.border}`,
                        borderRadius: 10, cursor: 'pointer', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                          {dest?.name ?? '(unknown)'}
                        </div>
                        <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                          {dest?.slug ?? ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, fontStyle: 'italic' }}>
                        {g.headline_override ?? <span style={{ color: A.faint, fontStyle: 'normal' }}>(default headline)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {venueCount} {venueCount === 1 ? 'venue' : 'venues'}
                      </div>
                      <div style={{ fontSize: 11, color: g.is_active ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                        {g.is_active ? 'Active' : 'Hidden'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {destinationsWithoutOverlay.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
                Destinations Without Overlay ({destinationsWithoutOverlay.length})
              </div>
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 10 }}>
                These have dining venues but no per-destination guide row. Create one to set hero / eyebrow / headline / intro.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {destinationsWithoutOverlay.map(d => {
                  const dest = destinationsById.get(d.id)
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 120px',
                        gap: 12, padding: '10px 14px',
                        background: A.bgCard, border: `1px solid ${A.border}`,
                        borderRadius: 10, alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                        {dest?.name ?? '(unknown)'}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {d.venue_count} {d.venue_count === 1 ? 'venue' : 'venues'}
                      </div>
                      <button
                        onClick={() => handleCreate(d.id)}
                        style={{ ...btnPrimary, justifySelf: 'end', opacity: creating ? 0.5 : 1 }}
                        disabled={creating}
                      >
                        + Create guide
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {editing && (
        <EditGuideModal
          guide={editing}
          destinationName={destinationsById.get(editing.global_destination_id)?.name ?? '(unknown)'}
          destinationSlug={destinationsById.get(editing.global_destination_id)?.slug ?? ''}
          onClose={() => setEditing(null)}
          onSaved={load}
          showToast={showToast}
        />
      )}
    </div>
  )
}