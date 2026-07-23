/* LibraryHotelsTab.tsx
 * Canonical hotel library - list + filter + edit modal.
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
 * No JSON ingest - hotels are seeded individually.
 * No recognition pill - stars/michelin_keys/forbes_rating shown in modal.
 *
 * Last updated: S41 - initial build.
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
import { camelizeKeys } from '@shared/camelize'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { matchesQuery } from '../../utils/utilsSearch'
import { fetchAllDestinationsFull } from '../../queries/queriesGuides'

// ── Recognition summary ───────────────────────────────────────────────────────

function recognitionLabel(h: AdminHotel): string {
  const parts: string[] = []
  if (h.stars)         parts.push(`${h.stars}★`)
  if (h.michelinKeys) parts.push(`${h.michelinKeys} Key${h.michelinKeys > 1 ? 's' : ''}`)
  if (h.forbesRating) parts.push(`Forbes ${h.forbesRating}★`)
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
        'name', 'shortSlug',
        'heroImageSrc', 'heroImageAlt',
        'imageCredit', 'imageCreditUrl', 'imageLicense',
        'isActive', 'isPreferredPartner', 'isSupplementary',
        'sortOrder', 'stars', 'michelinKeys', 'forbesRating',
        'description', 'internalNotes',
        'address', 'city', 'zipCode', 'latitude', 'longitude',
        'googleMapsUrl', 'website', 'phone', 'reservationsPhone',
        'mainEmail', 'reservationsEmail', 'salesEmail',
        'conciergeEmail', 'guestRelationsEmail', 'frontOfficeEmail',
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
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 3 }}>{hotel.shortSlug}</div>
          </div>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>

        {/* Identity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Name'>
            <input style={inputStyle} value={draft.name} onChange={e => patch('name', e.target.value)} />
          </Field>
          <Field label='Short Slug'>
            <input style={inputStyle} value={draft.shortSlug} onChange={e => patch('shortSlug', e.target.value)} />
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
              value={draft.michelinKeys ?? ''}
              onChange={e => {
                const v = e.target.value
                patch('michelinKeys', v === '' ? null : parseInt(v, 10) || null)
              }}
            />
          </Field>
          <Field label='Forbes Rating (stars)'>
            <input style={inputStyle} type='number' min={1} max={5}
              value={draft.forbesRating ?? ''}
              onChange={e => {
                const v = e.target.value
                patch('forbesRating', v === '' ? null : parseInt(v, 10) || null)
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
          <textarea style={textareaStyle} value={draft.internalNotes ?? ''} onChange={e => patch('internalNotes', e.target.value || null)} />
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
            <input style={inputStyle} value={draft.zipCode ?? ''} onChange={e => patch('zipCode', e.target.value || null)} />
          </Field>
          <Field label='Google Maps URL'>
            <input style={inputStyle} value={draft.googleMapsUrl ?? ''} onChange={e => patch('googleMapsUrl', e.target.value || null)} />
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
            <input style={inputStyle} value={draft.website ?? ''} onChange={e => patch('website', e.target.value || null)} />
          </Field>
          <Field label='Phone'>
            <input style={inputStyle} value={draft.phone ?? ''} onChange={e => patch('phone', e.target.value || null)} />
          </Field>
          <Field label='Reservations Phone'>
            <input style={inputStyle} value={draft.reservationsPhone ?? ''} onChange={e => patch('reservationsPhone', e.target.value || null)} />
          </Field>
          <Field label='Main Email'>
            <input style={inputStyle} value={draft.mainEmail ?? ''} onChange={e => patch('mainEmail', e.target.value || null)} />
          </Field>
          <Field label='Reservations Email'>
            <input style={inputStyle} value={draft.reservationsEmail ?? ''} onChange={e => patch('reservationsEmail', e.target.value || null)} />
          </Field>
          <Field label='Sales Email'>
            <input style={inputStyle} value={draft.salesEmail ?? ''} onChange={e => patch('salesEmail', e.target.value || null)} />
          </Field>
          <Field label='Concierge Email'>
            <input style={inputStyle} value={draft.conciergeEmail ?? ''} onChange={e => patch('conciergeEmail', e.target.value || null)} />
          </Field>
          <Field label='Guest Relations Email'>
            <input style={inputStyle} value={draft.guestRelationsEmail ?? ''} onChange={e => patch('guestRelationsEmail', e.target.value || null)} />
          </Field>
          <Field label='Front Office Email'>
            <input style={inputStyle} value={draft.frontOfficeEmail ?? ''} onChange={e => patch('frontOfficeEmail', e.target.value || null)} />
          </Field>
        </div>

        {/* Image */}
        <Field label='Hero Image Src'>
          <ImageFieldWithUploader value={draft.heroImageSrc} onChange={v => patch('heroImageSrc', v)} />
        </Field>
        <Field label='Hero Image Alt'>
          <input style={inputStyle} value={draft.heroImageAlt ?? ''} onChange={e => patch('heroImageAlt', e.target.value || null)} />
        </Field>
        <Field label='Image Credit'>
          <input style={inputStyle} value={draft.imageCredit ?? ''} onChange={e => patch('imageCredit', e.target.value || null)} />
        </Field>
        <Field label='Image Credit URL'>
          <input style={inputStyle} value={draft.imageCreditUrl ?? ''} onChange={e => patch('imageCreditUrl', e.target.value || null)} />
        </Field>
        <Field label='Image License'>
          <input style={inputStyle} value={draft.imageLicense ?? ''} onChange={e => patch('imageLicense', e.target.value || null)} />
        </Field>

        {/* Admin */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <Field label='Active'>
            <select style={inputStyle} value={String(draft.isActive)} onChange={e => patch('isActive', e.target.value === 'true')}>
              <option value='true'>Yes</option>
              <option value='false'>No</option>
            </select>
          </Field>
          <Field label='Preferred Partner'>
            <select style={inputStyle} value={String(draft.isPreferredPartner)} onChange={e => patch('isPreferredPartner', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label='Supplementary'>
            <select style={inputStyle} value={String(draft.isSupplementary)} onChange={e => patch('isSupplementary', e.target.value === 'true')}>
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label='Sort Order'>
            <input style={inputStyle} type='number' value={draft.sortOrder} onChange={e => patch('sortOrder', parseInt(e.target.value, 10) || 0)} />
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
  storagePath: string | null
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
    setDestinations(await fetchAllDestinationsFull() as DestinationFull[])
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
      matchesQuery(q, h.name, h.shortSlug, h.city)
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
              : 'Canonical pool - edits flow to every surface that reads hotel data.'}
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
            const dest  = destinationsById.get(h.globalDestinationId)
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
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{h.shortSlug}</div>
                </div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{dest?.name ?? <span style={{ color: A.faint }}>(unknown)</span>}</div>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{h.city ?? <span style={{ color: A.faint }}>-</span>}</div>
                <div style={{ fontSize: 11, color: recog ? A.gold : A.faint, fontFamily: A.font, fontWeight: 600 }}>{recog || ''}</div>
                <div style={{ fontSize: 11, color: h.isActive ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                  {h.isActive ? 'Active' : 'Hidden'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingHotel && (
        <EditHotelModal
          hotel={editingHotel}
          destinationName={destinationsById.get(editingHotel.globalDestinationId)?.name ?? '(unknown)'}
          onClose={() => setEditingHotel(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}