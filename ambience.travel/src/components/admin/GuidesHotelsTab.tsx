/* GuidesHotelsTab.tsx
 * Per-destination hotel guide overlay editor.
 * Mirrors GuidesDiningTab — overlay only, no access/grants tab (no hotel
 * grant system exists).
 *
 * Shows two sections:
 *   - Active guides (destinations with travel_hotel_guides row)
 *   - Destinations without overlay (offers "Create guide" action)
 *
 * Click an active guide row → modal: hero, eyebrow, headline, intro, is_active.
 * No accuracy_date — travel_hotel_guides does not have that column.
 * No access tab — no hotel_guide_grants table.
 *
 * UUID-keyed throughout. Slug for display + URL only.
 *
 * Last updated: S41 — initial build.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useToast } from '../../lib/ToastContext'
import {
  inputStyle, textareaStyle,
  btnPrimary, btnGhost, btnDanger,
} from '../../styles/stylesAdmin'
import { Field } from './adminUi'
import { buildGuideUrl } from '../../utils/utilsAdminPath'
import {
  fetchHotelGuides,
  fetchDestinationsWithHotels,
  fetchDestinationOptions,
  updateHotelGuide,
  createHotelGuide,
  deleteHotelGuide,
  type AdminHotelGuide,
  type DestinationWithHotelCounts,
  type DestinationOption,
  type HotelGuidePatch,
} from '../../lib/queriesAdminGuides'
import ImageFieldWithUploader from './ImageFieldWithUploader'

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditGuideModal({
  guide,
  destinationName,
  destinationSlug,
  onClose,
  onSaved,
}: {
  guide:           AdminHotelGuide
  destinationName: string
  destinationSlug: string
  onClose:         () => void
  onSaved:         () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft]   = useState<AdminHotelGuide>(guide)
  const [saving, setSaving] = useState(false)

  function patch<K extends keyof AdminHotelGuide>(k: K, v: AdminHotelGuide[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: HotelGuidePatch = {}
      const fields: (keyof HotelGuidePatch)[] = [
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
        toast.success('No changes.')
        setSaving(false)
        return
      }
      await updateHotelGuide(guide.id, payload)
      toast.success(`Saved ${Object.keys(payload).length} field(s).`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the hotel guide overlay for ${destinationName}? Hotels remain; only the overlay is removed.`)) return
    setSaving(true)
    try {
      await deleteHotelGuide(guide.id)
      toast.success('Overlay deleted.')
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
        width: 'min(800px, 100%)', background: A.bg, border: `1px solid ${A.border}`,
        borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Hotel Guide
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>{destinationName}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>{destinationSlug}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={buildGuideUrl(destinationSlug, 'hotels')}
              target='_blank'
              rel='noopener noreferrer'
              style={{ ...btnGhost, color: A.gold, borderColor: A.borderGold, textDecoration: 'none' }}
            >
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
        <Field label='Eyebrow override (NULL = "Curated Hotels" default)'>
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GuidesHotelsTab() {
  const { toast } = useToast()
  const [guides,                 setGuides]                 = useState<AdminHotelGuide[]>([])
  const [destinationsWithCounts, setDestinationsWithCounts] = useState<DestinationWithHotelCounts[]>([])
  const [destinationOptions,     setDestinationOptions]     = useState<DestinationOption[]>([])
  const [loading,                setLoading]                = useState(true)
  const [editing,                setEditing]                = useState<AdminHotelGuide | null>(null)
  const [creating,               setCreating]               = useState(false)

  const destinationsById = useMemo(() => {
    const m = new Map<string, DestinationOption>()
    destinationOptions.forEach(d => m.set(d.id, d))
    return m
  }, [destinationOptions])

  async function load() {
    setLoading(true)
    try {
      const [g, d, opts] = await Promise.all([
        fetchHotelGuides(),
        fetchDestinationsWithHotels(),
        fetchDestinationOptions(),
      ])
      setGuides(g)
      setDestinationsWithCounts(d)
      setDestinationOptions(opts)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(destId: string) {
    setCreating(true)
    try {
      await createHotelGuide(destId)
      const name = destinationsById.get(destId)?.name ?? '(destination)'
      toast.success(`Guide created for ${name}. Click to edit.`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
    setCreating(false)
  }

  const guideByDestId              = new Map(guides.map(g => [g.global_destination_id, g]))
  const destinationsWithoutOverlay = destinationsWithCounts.filter(d => !guideByDestId.has(d.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Guides
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          Hotel Guides
        </div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
          Per-destination overlay (hero, eyebrow, headline, intro).
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
                  const dest       = destinationsById.get(g.global_destination_id)
                  const hotelCount = destinationsWithCounts.find(d => d.id === g.global_destination_id)?.hotel_count ?? 0
                  return (
                    <div
                      key={g.id}
                      onClick={() => setEditing(g)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 2fr 100px 80px',
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
                        {hotelCount} {hotelCount === 1 ? 'hotel' : 'hotels'}
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
                These have hotels but no per-destination guide row. Create one to set hero / eyebrow / headline / intro.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {destinationsWithoutOverlay.map(d => {
                  const dest = destinationsById.get(d.id)
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 120px',
                        gap: 12, padding: '10px 14px',
                        background: A.bgCard, border: `1px solid ${A.border}`,
                        borderRadius: 10, alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                        {dest?.name ?? '(unknown)'}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {d.hotel_count} {d.hotel_count === 1 ? 'hotel' : 'hotels'}
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
        />
      )}
    </div>
  )
}