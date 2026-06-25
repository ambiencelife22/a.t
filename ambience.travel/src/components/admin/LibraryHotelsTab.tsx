/* LibraryHotelsTab.tsx
 * Canonical hotel library — list + filter + edit modal.
 *
 * Library = canonical travel_accom_hotels pool. Edits here flow to every
 * surface that reads hotel data. The per-destination guide overlay lives
 * in GuidesHotelsTab, not here.
 *
 * Destination scoping:
 *   - Unscoped (#admin/library/hotels): all hotels, dropdown filter active.
 *   - Scoped   (#admin/library/hotels/<dest-uuid>): hotels for one destination,
 *     dropdown disabled, header shows destination name.
 *
 * UUID-keyed throughout. destination_id FK → global_destinations.id.
 * The column is named destination_id on the DB but carried as
 * global_destination_id on AdminHotel for consistency with other types.
 *
 * No JSON ingest — hotels are seeded individually.
 * No recognition pill — stars/michelin_keys/forbes_rating shown in modal.
 *
 * Last updated: S41 — initial build.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useToast } from '../../providers/ToastContext'
import {
  inputStyle, textareaStyle,
  btnPrimary, btnGhost, btnDanger,
} from '../../styles/stylesAdmin'
import { Field } from './adminUi'
import { buildAdminHash } from '../../utils/utilsAdminPath'
import { resolveStoragePath } from '../../utils/utilsStoragePath'
import {
  fetchAllHotels,
  fetchDestinationOptions,
  updateHotel,
  type AdminHotel,
  type DestinationOption,
  type HotelPatch,
} from '../../queries/queriesAdminGuides'
import { supabase } from '../../lib/supabase'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { matchesQuery } from '../../utils/utilsSearch'

// ── Recognition summary ───────────────────────────────────────────────────────

function recognitionLabel(h: AdminHotel): string {
  const parts: string[] = []
  if (h.stars)         parts.push(`${h.stars}★`)
  if (h.michelin_keys) parts.push(`${h.michelin_keys} Key${h.michelin_keys > 1 ? 's' : ''}`)
  if (h.forbes_rating) parts.push(`Forbes ${h.forbes_rating}★`)
  return parts.join(' · ')
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditHotelModal({
  hotel,
  destinationName,
  onClose,
  onSaved,
}: {
  hotel:            AdminHotel
  destinationName:  string
  onClose:          () => void
  onSaved:          () => void
}) {
  const { toast }   = useToast()
  const [draft, setDraft]   = useState<AdminHotel>(hotel)
  const [saving, setSaving] = useState(false)

  // bullets as newline-separated textarea
  const [bulletsText, setBulletsText] = useState(
    (hotel.bullets ?? []).join('\n')
  )

  function patch<K extends keyof AdminHotel>(k: K, v: AdminHotel[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const parsedBullets = bulletsText
        .split('\n').map(s => s.trim()).filter(Boolean)
      const bulletsFinal = parsedBullets.length > 0 ? parsedBullets : null

      const payload: HotelPatch = {}
      const scalarFields: (keyof HotelPatch)[] = [
        'name', 'short_slug',
        'hero_image_src', 'hero_image_alt',
        'image_credit', 'image_credit_url', 'image_license',
        'is_active', 'is_preferred_partner', 'is_supplementary',
        'sort_order', 'stars', 'michelin_keys', 'forbes_rating',
        'description', 'internal_notes',
        'address', 'city', 'zip_code', 'latitude', 'longitude',
        'google_maps_url', 'website_url', 'phone', 'reservations_phone',
        'main_email', 'reservations_email', 'sales_email',
        'concierge_email', 'guest_relations_email', 'front_office_email',
      ]
      for (const f of scalarFields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(hotel[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }
      if (JSON.stringify(bulletsFinal) !== JSON.stringify(hotel.bullets ?? null)) {
        payload.bullets = bulletsFinal
      }

      if (Object.keys(payload).length === 0) {
        toast.success('No changes.')
        setSaving(false)
        return
      }
      await updateHotel(hotel.id, payload)
      toast.success(`Saved ${Object.keys(payload).length} field(s).`)
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

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Edit Hotel · {destinationName}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>{hotel.name}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 3 }}>{hotel.short_slug}</div>
          </div>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>

        {/* Identity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Name'>
            <input style={inputStyle} value={draft.name} onChange={e => patch('name', e.target.value)} />
          </Field>
          <Field label='Short Slug'>
            <input style={inputStyle} value={draft.short_slug} onChange={e => patch('short_slug', e.target.value)} />
          </Field>
        </div>

        {/* Recognition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label='Stars (hotel classification)'>
            <input style={inputStyle} type='number' min={1} max={5}
              value={draft.stars ?? ''}
              onChange={e => {
                const v = e.target.value
                patch('stars', v === '' ? null : parseInt(v, 10) || null)
              }}
            />
          </Field>
          <Field label='Michelin Keys'>
            <input style={inputStyle} type='number' min={1} max={3}
              value={draft.michelin_keys ?? ''}
              onChange={e => {
                const v = e.target.value
                patch('michelin_keys', v === '' ? null : parseInt(v, 10) || null)
              }}
            />
          </Field>
          <Field label='Forbes Rating (stars)'>
            <input style={inputStyle} type='number' min={1} max={5}
              value={draft.forbes_rating ?? ''}
              onChange={e => {
                const v = e.target.value
                patch('forbes_rating', v === '' ? null : parseInt(v, 10) || null)
              }}
            />
          </Field>
        </div>

        {/* Copy */}
        <Field label='Description'>
          <textarea style={textareaStyle} value={draft.description ?? ''} onChange={e => patch('description', e.target.value || null)} />
        </Field>
        <Field label='Bullets (one per line)'>
          <textarea
            style={{ ...textareaStyle, minHeight: 100, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
            value={bulletsText}
            onChange={e => setBulletsText(e.target.value)}
            placeholder={'Complimentary breakfast for 2 guests\n$100 credit per stay'}
          />
        </Field>
        <Field label='Internal Notes'>
          <textarea style={textareaStyle} value={draft.internal_notes ?? ''} onChange={e => patch('internal_notes', e.target.value || null)} />
        </Field>

        {/* Location */}
        <Field label='Address'>
          <input style={inputStyle} value={draft.address ?? ''} onChange={e => patch('address', e.target.value || null)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label='City'>
            <input style={inputStyle} value={draft.city ?? ''} onChange={e => patch('city', e.target.value || null)} />
          </Field>
          <Field label='Zip Code'>
            <input style={inputStyle} value={draft.zip_code ?? ''} onChange={e => patch('zip_code', e.target.value || null)} />
          </Field>
          <Field label='Google Maps URL'>
            <input style={inputStyle} value={draft.google_maps_url ?? ''} onChange={e => patch('google_maps_url', e.target.value || null)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Latitude'>
            <input style={inputStyle} type='number' value={draft.latitude ?? ''}
              onChange={e => patch('latitude', e.target.value === '' ? null : parseFloat(e.target.value) || null)}
            />
          </Field>
          <Field label='Longitude'>
            <input style={inputStyle} type='number' value={draft.longitude ?? ''}
              onChange={e => patch('longitude', e.target.value === '' ? null : parseFloat(e.target.value) || null)}
            />
          </Field>
        </div>

        {/* Contact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Website URL'>
            <input style={inputStyle} value={draft.website_url ?? ''} onChange={e => patch('website_url', e.target.value || null)} />
          </Field>
          <Field label='Phone'>
            <input style={inputStyle} value={draft.phone ?? ''} onChange={e => patch('phone', e.target.value || null)} />
          </Field>
          <Field label='Reservations Phone'>
            <input style={inputStyle} value={draft.reservations_phone ?? ''} onChange={e => patch('reservations_phone', e.target.value || null)} />
          </Field>
          <Field label='Main Email'>
            <input style={inputStyle} value={draft.main_email ?? ''} onChange={e => patch('main_email', e.target.value || null)} />
          </Field>
          <Field label='Reservations Email'>
            <input style={inputStyle} value={draft.reservations_email ?? ''} onChange={e => patch('reservations_email', e.target.value || null)} />
          </Field>
          <Field label='Sales Email'>
            <input style={inputStyle} value={draft.sales_email ?? ''} onChange={e => patch('sales_email', e.target.value || null)} />
          </Field>
          <Field label='Concierge Email'>
            <input style={inputStyle} value={draft.concierge_email ?? ''} onChange={e => patch('concierge_email', e.target.value || null)} />
          </Field>
          <Field label='Guest Relations Email'>
            <input style={inputStyle} value={draft.guest_relations_email ?? ''} onChange={e => patch('guest_relations_email', e.target.value || null)} />
          </Field>
          <Field label='Front Office Email'>
            <input style={inputStyle} value={draft.front_office_email ?? ''} onChange={e => patch('front_office_email', e.target.value || null)} />
          </Field>
        </div>

        {/* Image */}
        <Field label='Hero Image Src'>
          <ImageFieldWithUploader value={draft.hero_image_src} onChange={v => patch('hero_image_src', v)} />
        </Field>
        <Field label='Hero Image Alt'>
          <input style={inputStyle} value={draft.hero_image_alt ?? ''} onChange={e => patch('hero_image_alt', e.target.value || null)} />
        </Field>
        <Field label='Image Credit'>
          <input style={inputStyle} value={draft.image_credit ?? ''} onChange={e => patch('image_credit', e.target.value || null)} />
        </Field>
        <Field label='Image Credit URL'>
          <input style={inputStyle} value={draft.image_credit_url ?? ''} onChange={e => patch('image_credit_url', e.target.value || null)} />
        </Field>
        <Field label='Image License'>
          <input style={inputStyle} value={draft.image_license ?? ''} onChange={e => patch('image_license', e.target.value || null)} />
        </Field>

        {/* Admin */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <Field label='Active'>
            <select style={inputStyle} value={String(draft.is_active)} onChange={e => patch('is_active', e.target.value === 'true')}>
              <option value='true'>Yes</option>
              <option value='false'>No</option>
            </select>
          </Field>
          <Field label='Preferred Partner'>
            <select style={inputStyle} value={String(draft.is_preferred_partner)} onChange={e => patch('is_preferred_partner', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label='Supplementary'>
            <select style={inputStyle} value={String(draft.is_supplementary)} onChange={e => patch('is_supplementary', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label='Sort Order'>
            <input style={inputStyle} type='number' value={draft.sort_order} onChange={e => patch('sort_order', parseInt(e.target.value, 10) || 0)} />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}` }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface LibraryHotelsTabProps {
  destinationId: string | null
}

interface DestinationFull extends DestinationOption {
  storage_path: string | null
}

export default function LibraryHotelsTab({ destinationId }: LibraryHotelsTabProps) {
  const { toast }   = useToast()
  const [hotels, setHotels]           = useState<AdminHotel[]>([])
  const [destinations, setDestinations] = useState<DestinationFull[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [editingHotel, setEditingHotel] = useState<AdminHotel | null>(null)

  const effectiveFilter = destinationId ?? ''

  const destinationsById = useMemo(() => {
    const m = new Map<string, DestinationFull>()
    destinations.forEach(d => m.set(d.id, d))
    return m
  }, [destinations])

  const scopedDest = destinationId ? destinationsById.get(destinationId) ?? null : null

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
      const [h] = await Promise.all([
        fetchAllHotels(effectiveFilter || null),
        destinations.length === 0 ? loadDestinations() : Promise.resolve(),
      ])
      setHotels(h)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [effectiveFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return hotels
    return hotels.filter(h =>
      matchesQuery(q, h.name, h.short_slug, h.city)
    )
  }, [hotels, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>Library</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
            {scopedDest ? `${scopedDest.name} · Hotels` : 'Hotels'}
          </div>
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            {scopedDest
              ? `Editing ${scopedDest.name} hotels only.`
              : 'Canonical pool — edits flow to every surface that reads hotel data.'}
          </div>
          {scopedDest && (
            <a
              href={buildAdminHash({ product: 'library', tab: 'hotels', destinationId: null })}
              style={{ display: 'inline-block', marginTop: 10, fontSize: 11, color: A.gold, textDecoration: 'none', fontFamily: A.font, letterSpacing: '0.04em' }}
            >
              ← All destinations
            </a>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select
          style={{ ...inputStyle, width: 240, opacity: scopedDest ? 0.6 : 1 }}
          value={effectiveFilter}
          disabled={!!scopedDest}
          onChange={e => {
            const next = e.target.value
            window.location.hash = buildAdminHash({ product: 'library', tab: 'hotels', destinationId: next || null })
          }}
        >
          <option value=''>All destinations ({hotels.length} hotels)</option>
          {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          placeholder='Search by name, slug, city…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', borderRadius: 12, background: A.bgCard, border: `1px solid ${A.border}`, color: A.faint, fontSize: 13, fontFamily: A.font }}>
          No hotels match those filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(h => {
            const dest  = destinationsById.get(h.global_destination_id)
            const recog = recognitionLabel(h)
            return (
              <div
                key={h.id}
                onClick={() => setEditingHotel(h)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 80px',
                  gap: 12, padding: '10px 14px',
                  background: A.bgCard, border: `1px solid ${A.border}`,
                  borderRadius: 10, cursor: 'pointer', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{h.short_slug}</div>
                </div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{dest?.name ?? <span style={{ color: A.faint }}>(unknown)</span>}</div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{h.city ?? <span style={{ color: A.faint }}>—</span>}</div>
                <div style={{ fontSize: 11, color: recog ? A.gold : A.faint, fontFamily: A.font, fontWeight: 600 }}>{recog || ''}</div>
                <div style={{ fontSize: 11, color: h.is_active ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                  {h.is_active ? 'Active' : 'Hidden'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingHotel && (
        <EditHotelModal
          hotel={editingHotel}
          destinationName={destinationsById.get(editingHotel.global_destination_id)?.name ?? '(unknown)'}
          onClose={() => setEditingHotel(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}