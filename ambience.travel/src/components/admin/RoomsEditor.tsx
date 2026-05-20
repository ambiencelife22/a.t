/* RoomsEditor.tsx
 * Engagement-scoped room overlay editor.
 * Mounts inside EngagementDetailTab between CardsEditor and Pricing Section.
 *
 * Surface: travel_immerse_rooms (overlay) joined to travel_accom_rooms (canon).
 * Pattern: list rows + edit modal — mirrors CardsEditor / DestinationRowsEditor.
 *
 * Modal fields:
 *   Canonical link  — room picker (rooms from hotels featured in this engagement)
 *   Presentation    — level_label, room_basis, room_name_override, is_active, sort_order
 *   Rates           — ambience_nightly_rate, non_negotiated_nightly_rate,
 *                     rate_cadence_id (dropdown), rate_suffix_override, tax_inclusive
 *   Room detail     — sqm/sqft overrides, bed_config_override, room_inclusions
 *   Benefits        — room_benefits (jsonb as newline textarea)
 *   Images          — hero_image_src_override, hero_image_alt_override, floorplan_src_override
 *
 * Last updated: S43 — Phase 5 pass.
 *   - useToast -> useAdminToast throughout. showToast prop dropped.
 *   - EditRoomModal + AddRoomModal -> AdminModal primitive.
 *   - Section headers -> AdminSection.
 *   - Boolean <select> -> PillToggle.
 * Prior: S42 — initial build.
 */

import { useEffect, useState, useMemo } from 'react'
import { A } from '../../lib/tokensAdmin'
import {
  inputStyle, textareaStyle,
  btnPrimary, btnGhost, btnDanger,
} from '../../lib/stylesAdmin'
import { Field } from './adminUi'
import { AdminModal, AdminSection, AdminEmptyState, useAdminToast } from './_adminPrimitives'
import { PillToggle } from './adminUi'
import {
  fetchOverlayRooms,
  fetchCanonicalRoomsForEngagement,
  fetchRateCadences,
  createOverlayRoom,
  updateOverlayRoom,
  deleteOverlayRoom,
  type OverlayRoom,
  type CanonicalRoom,
  type RateCadence,
  type OverlayRoomPatch,
} from '../../lib/queriesAdminRooms'

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayRoomName(room: OverlayRoom): string {
  if (room.room_name_override)  return room.room_name_override
  if (room.canonical_room_name) return room.canonical_room_name
  return '(unnamed room)'
}

function displayHotelName(room: OverlayRoom): string {
  return room.canonical_hotel_name ?? '(no hotel linked)'
}

function benefitsToText(benefits: string[] | null): string {
  return (benefits ?? []).join('\n')
}

function textToBenefits(text: string): string[] | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.length > 0 ? lines : null
}

// ── Edit Room Modal ───────────────────────────────────────────────────────────

interface EditRoomModalProps {
  room:           OverlayRoom
  canonicalRooms: CanonicalRoom[]
  rateCadences:   RateCadence[]
  onClose:        () => void
  onSaved:        () => void
}

function EditRoomModal({ room, canonicalRooms, rateCadences, onClose, onSaved }: EditRoomModalProps) {
  const { success, error }                  = useAdminToast()
  const [draft, setDraft]                   = useState<OverlayRoom>({ ...room })
  const [benefitsText, setBenefitsText]     = useState(benefitsToText(room.room_benefits))
  const [saving, setSaving]                 = useState(false)

  function patch<K extends keyof OverlayRoom>(k: K, v: OverlayRoom[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  function numericPatch(k: keyof OverlayRoom, v: string) {
    patch(k, (v === '' ? null : (parseInt(v, 10) || null)) as any)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const parsedBenefits = textToBenefits(benefitsText)
      const payload: OverlayRoomPatch = {}

      const scalarFields: (keyof OverlayRoomPatch)[] = [
        'room_id', 'level_label', 'room_basis', 'room_name_override',
        'ambience_nightly_rate', 'non_negotiated_nightly_rate', 'public_nightly_rate',
        'rate_cadence_id', 'rate_suffix_override', 'tax_inclusive',
        'room_inclusions', 'bed_config_override',
        'sqft_min', 'sqft_max', 'sqm_min', 'sqm_max',
        'sqft_min_override', 'sqft_max_override', 'sqm_min_override', 'sqm_max_override',
        'hero_image_src_override', 'hero_image_alt_override', 'floorplan_src_override',
        'is_active', 'sort_order',
      ]

      for (const f of scalarFields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(room[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }

      if (JSON.stringify(parsedBenefits) !== JSON.stringify(room.room_benefits ?? null)) {
        payload.room_benefits = parsedBenefits
      }

      if (Object.keys(payload).length === 0) {
        success('No changes.')
        setSaving(false)
        return
      }

      await updateOverlayRoom(room.id, payload)
      success(`Saved ${Object.keys(payload).length} field(s).`)
      onSaved()
      onClose()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to save')
    }
    setSaving(false)
  }

  const selectedCanon = canonicalRooms.find(r => r.id === draft.room_id) ?? null

  return (
    <AdminModal
      title={displayRoomName(room)}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveLabel='Save Changes'
      width={780}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Subheading */}
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: -8 }}>
          {displayHotelName(room)}
        </div>

        {/* Canonical link */}
        <AdminSection title='Canonical Room'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label='Linked Room'>
              <select
                style={inputStyle}
                value={draft.room_id ?? ''}
                onChange={e => patch('room_id', e.target.value || null)}
              >
                <option value=''>No canonical link</option>
                {canonicalRooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.hotel_name} — {r.room_name ?? r.slug ?? r.id}
                  </option>
                ))}
              </select>
            </Field>
            {selectedCanon && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, color: A.faint, fontFamily: A.font }}>
                <div><span style={{ color: A.muted }}>Category</span><br />{selectedCanon.category_slug ?? '—'}</div>
                <div><span style={{ color: A.muted }}>Size</span><br />{selectedCanon.sqm_min ?? '—'} sqm / {selectedCanon.sqft_min ?? '—'} sqft</div>
                <div><span style={{ color: A.muted }}>Bed config</span><br />{selectedCanon.bed_config ?? '—'}</div>
              </div>
            )}
          </div>
        </AdminSection>

        {/* Presentation */}
        <AdminSection title='Presentation'>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label='Level Label'>
              <input style={inputStyle} value={draft.level_label ?? ''} onChange={e => patch('level_label', e.target.value || null)} placeholder='Highlighted, Alternative 1...' />
            </Field>
            <Field label='Room Name Override'>
              <input style={inputStyle} value={draft.room_name_override ?? ''} onChange={e => patch('room_name_override', e.target.value || null)} placeholder='Leave blank to use canonical name' />
            </Field>
            <Field label='Room Basis'>
              <input style={inputStyle} value={draft.room_basis ?? ''} onChange={e => patch('room_basis', e.target.value || null)} placeholder='Bed and Breakfast, Room Only...' />
            </Field>
            <Field label='Sort Order'>
              <input style={inputStyle} type='number' value={draft.sort_order} onChange={e => patch('sort_order', parseInt(e.target.value, 10) || 0)} />
            </Field>
            <Field label='Active'>
              <PillToggle
                value={draft.is_active ?? true}
                onChange={v => patch('is_active', v)}
                labelTrue='Active'
                labelFalse='Hidden'
              />
            </Field>
          </div>
        </AdminSection>

        {/* Rates */}
        <AdminSection title='Rates'>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label='Ambience Rate'>
              <input style={inputStyle} value={draft.ambience_nightly_rate ?? ''} onChange={e => patch('ambience_nightly_rate', e.target.value || null)} placeholder='USD $5,550' />
            </Field>
            <Field label='Non-Negotiated Rate'>
              <input style={inputStyle} value={draft.non_negotiated_nightly_rate ?? ''} onChange={e => patch('non_negotiated_nightly_rate', e.target.value || null)} placeholder='USD $6,200' />
            </Field>
            <Field label='Public Rate'>
              <input style={inputStyle} value={draft.public_nightly_rate ?? ''} onChange={e => patch('public_nightly_rate', e.target.value || null)} placeholder='USD $7,500' />
            </Field>
            <Field label='Rate Cadence'>
              <select style={inputStyle} value={draft.rate_cadence_id ?? ''} onChange={e => patch('rate_cadence_id', e.target.value || null)}>
                <option value=''>None</option>
                {rateCadences.map(rc => (
                  <option key={rc.id} value={rc.id}>{rc.label}</option>
                ))}
              </select>
            </Field>
            <Field label='Rate Suffix Override'>
              <input style={inputStyle} value={draft.rate_suffix_override ?? ''} onChange={e => patch('rate_suffix_override', e.target.value || null)} placeholder='++ Taxes & Fees' />
            </Field>
            <Field label='Tax Inclusive'>
              <PillToggle
                value={draft.tax_inclusive ?? false}
                onChange={v => patch('tax_inclusive', v)}
                labelTrue='Yes'
                labelFalse='No'
              />
            </Field>
          </div>
        </AdminSection>

        {/* Room detail */}
        <AdminSection title='Room Detail'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label='Bed Configuration Override'>
              <input style={inputStyle} value={draft.bed_config_override ?? ''} onChange={e => patch('bed_config_override', e.target.value || null)} />
            </Field>
            <Field label='Room Inclusions'>
              <textarea style={{ ...textareaStyle, minHeight: 72 }} value={draft.room_inclusions ?? ''} onChange={e => patch('room_inclusions', e.target.value || null)} placeholder='Two-Level Residence. Three full marble bathrooms...' />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <Field label='sqm min override'>
                <input style={inputStyle} type='number' value={draft.sqm_min_override ?? ''} onChange={e => numericPatch('sqm_min_override', e.target.value)} />
              </Field>
              <Field label='sqm max override'>
                <input style={inputStyle} type='number' value={draft.sqm_max_override ?? ''} onChange={e => numericPatch('sqm_max_override', e.target.value)} />
              </Field>
              <Field label='sqft min override'>
                <input style={inputStyle} type='number' value={draft.sqft_min_override ?? ''} onChange={e => numericPatch('sqft_min_override', e.target.value)} />
              </Field>
              <Field label='sqft max override'>
                <input style={inputStyle} type='number' value={draft.sqft_max_override ?? ''} onChange={e => numericPatch('sqft_max_override', e.target.value)} />
              </Field>
            </div>
          </div>
        </AdminSection>

        {/* Benefits */}
        <AdminSection title='Benefits'>
          <Field label='Room Benefits (one per line)'>
            <textarea
              style={{ ...textareaStyle, minHeight: 110, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
              value={benefitsText}
              onChange={e => setBenefitsText(e.target.value)}
              placeholder={'Bed and breakfast for up to 8 guests\nHotel and Resort Credit: USD $200 per bedroom per stay'}
            />
          </Field>
        </AdminSection>

        {/* Images */}
        <AdminSection title='Images'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label='Hero Image Src Override'>
              <input style={inputStyle} value={draft.hero_image_src_override ?? ''} onChange={e => patch('hero_image_src_override', e.target.value || null)} />
            </Field>
            <Field label='Hero Image Alt Override'>
              <input style={inputStyle} value={draft.hero_image_alt_override ?? ''} onChange={e => patch('hero_image_alt_override', e.target.value || null)} />
            </Field>
            <Field label='Floorplan Src Override'>
              <input style={inputStyle} value={draft.floorplan_src_override ?? ''} onChange={e => patch('floorplan_src_override', e.target.value || null)} />
            </Field>
          </div>
        </AdminSection>

      </div>
    </AdminModal>
  )
}

// ── Add Room Modal ────────────────────────────────────────────────────────────

interface AddRoomModalProps {
  engagementId:   string
  canonicalRooms: CanonicalRoom[]
  nextSortOrder:  number
  onClose:        () => void
  onSaved:        () => void
}

function AddRoomModal({ engagementId, canonicalRooms, nextSortOrder, onClose, onSaved }: AddRoomModalProps) {
  const { success, error } = useAdminToast()
  const [roomId, setRoomId]         = useState<string>('')
  const [levelLabel, setLevelLabel] = useState('')
  const [saving, setSaving]         = useState(false)

  async function handleAdd() {
    setSaving(true)
    try {
      await createOverlayRoom({
        trip_id:     engagementId,
        room_id:     roomId || null,
        level_label: levelLabel.trim() || null,
        sort_order:  nextSortOrder,
        is_active:   true,
      })
      success('Room added.')
      onSaved()
      onClose()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to add room')
    }
    setSaving(false)
  }

  return (
    <AdminModal
      title='Add Room Overlay'
      onClose={onClose}
      onSave={handleAdd}
      saving={saving}
      saveLabel='Add Room'
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label='Canonical Room'>
          <select style={inputStyle} value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value=''>No canonical link (manual entry)</option>
            {canonicalRooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.hotel_name} — {r.room_name ?? r.slug ?? r.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label='Level Label'>
          <input
            style={inputStyle}
            value={levelLabel}
            onChange={e => setLevelLabel(e.target.value)}
            placeholder='Highlighted, Alternative 1, Alternative 2...'
            autoFocus
          />
        </Field>
      </div>
    </AdminModal>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface RoomsEditorProps {
  engagementId: string
}

export default function RoomsEditor({ engagementId }: RoomsEditorProps) {
  const { success, error }                  = useAdminToast()
  const [rooms, setRooms]                   = useState<OverlayRoom[]>([])
  const [canonicalRooms, setCanonicalRooms] = useState<CanonicalRoom[]>([])
  const [rateCadences, setRateCadences]     = useState<RateCadence[]>([])
  const [loading, setLoading]               = useState(true)
  const [editingRoom, setEditingRoom]       = useState<OverlayRoom | null>(null)
  const [addingRoom, setAddingRoom]         = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [r, cr, rc] = await Promise.all([
        fetchOverlayRooms(engagementId),
        fetchCanonicalRoomsForEngagement(engagementId),
        fetchRateCadences(),
      ])
      setRooms(r)
      setCanonicalRooms(cr)
      setRateCadences(rc)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to load rooms')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  async function handleDelete(room: OverlayRoom) {
    if (!window.confirm(`Remove "${displayRoomName(room)}" from this engagement?`)) return
    try {
      await deleteOverlayRoom(room.id)
      success('Room removed.')
      load()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to remove room')
    }
  }

  const nextSortOrder = useMemo(() => {
    if (rooms.length === 0) return 1
    return Math.max(...rooms.map(r => r.sort_order)) + 1
  }, [rooms])

  const rateCadenceById = useMemo(() => {
    const m = new Map<string, RateCadence>()
    rateCadences.forEach(rc => m.set(rc.id, rc))
    return m
  }, [rateCadences])

  function rateDisplay(room: OverlayRoom): string {
    const rate = room.ambience_nightly_rate ?? room.non_negotiated_nightly_rate ?? null
    if (!rate) return ''
    const cadence = room.rate_cadence_id ? rateCadenceById.get(room.rate_cadence_id)?.label : null
    const suffix  = room.rate_suffix_override ?? ''
    return [rate, cadence ? `/ ${cadence}` : '', suffix].filter(Boolean).join(' ')
  }

  return (
    <div style={{
      background:   A.bgCard,
      border:       `1px solid ${A.border}`,
      borderRadius: 14,
      padding:      24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <AdminSection
          title={`Rooms${rooms.length > 0 ? ` · ${rooms.length}` : ''}`}
          style={{ marginBottom: 0 }}
        />
        {!loading && (
          <button onClick={() => setAddingRoom(true)} style={btnPrimary}>+ Add Room</button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading...</div>
      ) : rooms.length === 0 ? (
        <AdminEmptyState message='No room overlays for this engagement.' ctaLabel='+ Add Room' onCta={() => setAddingRoom(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rooms.map(room => (
            <div
              key={room.id}
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 160px 140px 80px 80px',
                gap:                 12,
                padding:             '10px 14px',
                background:          A.bgInput,
                border:              `1px solid ${A.border}`,
                borderRadius:        10,
                alignItems:          'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                  {displayRoomName(room)}
                </div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 2 }}>
                  {displayHotelName(room)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                {room.level_label ?? <span style={{ color: A.faint }}>No label</span>}
              </div>
              <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rateDisplay(room) || <span style={{ color: A.faint }}>No rate</span>}
              </div>
              <div style={{ fontSize: 11, color: room.is_active !== false ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                {room.is_active !== false ? 'Active' : 'Hidden'}
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingRoom(room)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>Edit</button>
                <button onClick={() => handleDelete(room)} style={{ ...btnDanger, padding: '4px 8px' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          canonicalRooms={canonicalRooms}
          rateCadences={rateCadences}
          onClose={() => setEditingRoom(null)}
          onSaved={load}
        />
      )}

      {addingRoom && (
        <AddRoomModal
          engagementId={engagementId}
          canonicalRooms={canonicalRooms}
          nextSortOrder={nextSortOrder}
          onClose={() => setAddingRoom(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}