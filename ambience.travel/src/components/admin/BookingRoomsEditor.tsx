/* BookingRoomsEditor.tsx
 * THE single editor for travel_booking_rooms. One write surface for room
 * identity (person_id link + guest_name override), images, names, rates.
 *
 * Replaces two prior editors that both wrote guest_name as free text:
 *   - RoomsEditor      (inline in TripDossierSection) — full create/edit/delete
 *   - BriefRoomEditor  (in BriefEditorPage)           — names + images + preview
 * Two surfaces editing one column was the drift. This is the one place.
 *
 * Name single-source (S53G): a room guest resolves person_id → guest_name
 * override → trip party label (prepared_for), server-side in the EF. This
 * editor links person_id via PersonLinkPicker and frames guest_name as a
 * visible-default OVERRIDE — placeholder shows what it resolves to, typed
 * only for genuine exceptions (e.g. "Ms. Sayegh" pre-registry).
 *
 * Two mount modes, one component:
 *   - Uncontrolled (dossier): owns its room state; create/edit/delete with
 *     save-on-submit. No external preview.
 *   - Controlled (brief): drafts + image srcs lifted via callbacks so the
 *     page's live BriefPreview and PDF merge stay in sync; blur-saves per field.
 *   Mode is chosen by presence of the controlled props (roomDrafts + handlers).
 *
 * Always per-booking: receives one booking, renders its rooms. The brief page
 * loops bookings and mounts one instance each, sharing the global draft maps
 * (keyed by roomId) so every instance reads/writes only its own rooms' keys.
 */

import { useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { roomGuestName } from '../../utils/utilsRoomDisplay'
import { useAdminToast } from './_adminPrimitives'
import { PersonLinkPicker } from './PersonLinkPicker'
import AssetPicker from './AssetPicker'
import {
  createBookingRoom, updateBookingRoom, deleteBookingRoom,
} from '../../queries/queriesAdminJourney'
import type { EngagementBooking, BookingRoom, BookingRoomPatch } from '../../queries/queriesAdminJourney'

// ── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

// ── Public controlled-draft shape ───────────────────────────────────────────
// The brief page lifts this per room (keyed by roomId). guest_name is the
// override; person_id is the link. image_src is the per-room brief image.

export type RoomDraft = {
  person_id:           string | null
  guest_name:          string
  room_name:           string
  confirmation_number: string
  party_composition:   string
  notes:               string
  nights:              string
  rate:                string
  total:               string
  extra_person_fee:    string
  additional_guests:   string[]
}

export function roomToDraft(r: BookingRoom): RoomDraft {
  const numStr = (n: number | null): string => (n == null ? '' : String(n))
  return {
    person_id:           r.person_id            ?? null,
    guest_name:          r.guest_name           ?? '',
    room_name:           r.room_name            ?? '',
    confirmation_number: r.confirmation_number  ?? '',
    party_composition:   r.party_composition    ?? '',
    notes:               r.notes                ?? '',
    nights:              numStr(r.nights),
    rate:                numStr(r.rate),
    total:               numStr(r.total),
    extra_person_fee:    numStr(r.extra_person_fee),
    additional_guests:   r.additional_guests    ?? [],
  }
}

function emptyDraft(): RoomDraft {
  return {
    person_id: null, guest_name: '', room_name: '', confirmation_number: '',
    party_composition: '', notes: '', nights: '', rate: '', total: '',
    extra_person_fee: '', additional_guests: [],
  }
}

function draftToPatch(d: RoomDraft): BookingRoomPatch {
  const orNull    = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  const numOrNull = (s: string): number | null => {
    const t = s.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  const guests = d.additional_guests.filter(Boolean)  // person uuids; drop empty slots
  return {
    person_id:           d.person_id,
    guest_name:          orNull(d.guest_name),
    room_name:           orNull(d.room_name),
    confirmation_number: orNull(d.confirmation_number),
    party_composition:   orNull(d.party_composition),
    notes:               orNull(d.notes),
    nights:              numOrNull(d.nights),
    rate:                numOrNull(d.rate),
    total:               numOrNull(d.total),
    extra_person_fee:    numOrNull(d.extra_person_fee),
    additional_guests:   guests.length > 0 ? guests : null,
  }
}

// Single-field → patch coercion for blur-save. additional_guests is excluded —
// it has its own saver — so the switch is exhaustive over every remaining key.
// The default is unreachable by construction and throws rather than silently
// returning a no-op patch (no silent fallbacks).
type SavableField = Exclude<keyof RoomDraft, 'additional_guests'>

function fieldToPatch<K extends SavableField>(k: K, v: RoomDraft[K]): BookingRoomPatch {
  const orNull    = (s: string) => (s.trim() === '' ? null : s.trim())
  const numOrNull = (s: string) => { const t = s.trim(); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : null }
  switch (k) {
    case 'person_id':           return { person_id: v as string | null }
    case 'guest_name':          return { guest_name: orNull(v as string) }
    case 'room_name':           return { room_name: orNull(v as string) }
    case 'confirmation_number': return { confirmation_number: orNull(v as string) }
    case 'party_composition':   return { party_composition: orNull(v as string) }
    case 'notes':               return { notes: orNull(v as string) }
    case 'nights':              return { nights: numOrNull(v as string) }
    case 'rate':                return { rate: numOrNull(v as string) }
    case 'total':               return { total: numOrNull(v as string) }
    case 'extra_person_fee':    return { extra_person_fee: numOrNull(v as string) }
  }
  throw new Error(`fieldToPatch: unhandled field ${String(k)}`)
}

// ── Field atom ──────────────────────────────────────────────────────────────

function RoomField({ label, value, onChange, onBlur, placeholder, type = 'text', span }: {
  label: string; value: string; onChange: (v: string) => void
  onBlur?: () => void; placeholder?: string; type?: string; span?: boolean
}) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} onBlur={onBlur} />
    </div>
  )
}

// ── The shared room form body ───────────────────────────────────────────────
// Reused by both the uncontrolled add/edit form and each controlled row.

function RoomFormBody({ draft, setField, setPerson, onResolved, linkedName, partyLabel, addGuest, patchGuest, removeGuest, blurField }: {
  draft:      RoomDraft
  setField:   <K extends keyof RoomDraft>(k: K, v: RoomDraft[K]) => void
  setPerson:  (pid: string | null) => void
  onResolved: (name: string | null) => void
  linkedName: string | null
  partyLabel: string | null
  addGuest:   () => void
  patchGuest: (idx: number, v: string) => void
  removeGuest:(idx: number) => void
  blurField?: (k: keyof RoomDraft) => void
}) {
  const guestPlaceholder = draft.person_id
    ? `Using: ${linkedName ?? 'linked person'}`
    : (partyLabel ? `Resolves to: ${partyLabel}` : 'e.g. Ms. Sayegh')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PersonLinkPicker
        label='Room guest (global registry)'
        personId={draft.person_id}
        onChange={setPerson}
        onResolved={onResolved}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RoomField label='Guest Name (override)' value={draft.guest_name} onChange={v => setField('guest_name', v)} onBlur={() => blurField?.('guest_name')} placeholder={guestPlaceholder} />
        <RoomField label='Confirmation #' value={draft.confirmation_number} onChange={v => setField('confirmation_number', v)} onBlur={() => blurField?.('confirmation_number')} placeholder='4375602759' />
        <RoomField label='Party Composition' value={draft.party_composition} onChange={v => setField('party_composition', v)} onBlur={() => blurField?.('party_composition')} placeholder='2 Adults, 2 Children' />
        <RoomField label='Room Name' value={draft.room_name} onChange={v => setField('room_name', v)} onBlur={() => blurField?.('room_name')} placeholder='Two-Bedroom Suite' />
      </div>

      {/* Additional guests — repeatable, person-linked (uuid). Each slot is a
          PersonLinkPicker writing a global_people id; no free text. */}
      <div>
        <label style={labelStyle}>Additional Guests</label>
        {draft.additional_guests.map((pid, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <PersonLinkPicker
                label=''
                personId={pid || null}
                onChange={next => patchGuest(idx, next ?? '')}
              />
            </div>
            <button onClick={() => removeGuest(idx)}
              style={{ fontFamily: A.font, fontSize: 10, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
          </div>
        ))}
        <button onClick={addGuest}
          style={{ fontFamily: A.font, fontSize: 9, fontWeight: 600, color: A.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0 0', letterSpacing: '0.04em' }}>+ Add'l Guest</button>
      </div>

      {/* Rate detail */}
      <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Rate Detail</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <RoomField label='Nights' type='number' value={draft.nights} onChange={v => setField('nights', v)} onBlur={() => blurField?.('nights')} placeholder='3' />
          <RoomField label='Rate / night' type='number' value={draft.rate} onChange={v => setField('rate', v)} onBlur={() => blurField?.('rate')} placeholder='1305.00' />
          <RoomField label='Total' type='number' value={draft.total} onChange={v => setField('total', v)} onBlur={() => blurField?.('total')} placeholder='4347.60' />
          <RoomField label='Extra Person Fee' type='number' value={draft.extra_person_fee} onChange={v => setField('extra_person_fee', v)} onBlur={() => blurField?.('extra_person_fee')} placeholder='390.00' />
        </div>
      </div>

      <RoomField label='Notes' value={draft.notes} onChange={v => setField('notes', v)} onBlur={() => blurField?.('notes')} placeholder='Includes rollaway bed' span />
    </div>
  )
}

// ── Image strip (per room) ──────────────────────────────────────────────────

function RoomImageStrip({ roomId, src, presetPath, onPick, onClear }: {
  roomId:     string
  src:        string
  presetPath: string | undefined
  onPick:     (url: string) => void
  onClear:    () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        {src ? (
          <div style={{ width: 80, height: 52, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: `1px solid ${A.border}` }}>
            <img src={src} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ width: 80, height: 52, borderRadius: 6, background: A.bg, border: `1px solid ${A.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>No image</span>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <button onClick={() => setOpen(true)}
            style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', textAlign: 'left' as const }}>
            {src ? 'Change Image' : 'Select from Library'}
          </button>
          {src && (
            <button onClick={onClear}
              style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>Remove</button>
          )}
        </div>
      </div>
      {open && (
        <AssetPicker
          onClose={() => setOpen(false)}
          presetPath={presetPath}
          onSelected={url => { onPick(url); setOpen(false) }}
        />
      )}
    </>
  )
}

// ── Props ───────────────────────────────────────────────────────────────────

interface BookingRoomsEditorProps {
  booking:            EngagementBooking
  partyLabel?:        string | null
  imagePresetPath?:   string
  // Controlled (brief) mode — when present, drafts/images are lifted.
  roomDrafts?:        Record<string, RoomDraft>
  onRoomDraftsChange?: (drafts: Record<string, RoomDraft>) => void
  roomImageSrcs?:     Record<string, string>
  onImageSrcsChange?: (srcs: Record<string, string>) => void
}

// ── Component ───────────────────────────────────────────────────────────────

export function BookingRoomsEditor(props: BookingRoomsEditorProps) {
  const { booking, partyLabel = null, imagePresetPath } = props
  const controlled = !!(props.roomDrafts && props.onRoomDraftsChange)

  return controlled
    ? <ControlledRooms {...props} partyLabel={partyLabel} imagePresetPath={imagePresetPath} />
    : <UncontrolledRooms booking={booking} partyLabel={partyLabel} imagePresetPath={imagePresetPath} />
}

// ── Controlled (brief) — lifted drafts, blur-save per field ─────────────────

function ControlledRooms({ booking, partyLabel, imagePresetPath, roomDrafts, onRoomDraftsChange, roomImageSrcs, onImageSrcsChange }: BookingRoomsEditorProps) {
  const { error } = useAdminToast()
  const rooms = booking._rooms ?? []
  const drafts = roomDrafts!
  const setDrafts = onRoomDraftsChange!
  const imgs = roomImageSrcs ?? {}
  const setImgs = onImageSrcsChange ?? (() => {})
  const [linkedNames, setLinkedNames] = useState<Record<string, string | null>>({})

  function getDraft(r: BookingRoom): RoomDraft {
    return drafts[r.id] ?? roomToDraft(r)
  }

  function setField<K extends keyof RoomDraft>(r: BookingRoom, k: K, v: RoomDraft[K]) {
    const prev = getDraft(r)
    setDrafts({ ...drafts, [r.id]: { ...prev, [k]: v } })
  }

  async function saveField(r: BookingRoom, k: SavableField) {
    const d = getDraft(r)
    const patch = fieldToPatch(k, d[k])
    try { await updateBookingRoom(r.id, patch) }
    catch (e) { error(e instanceof Error ? e.message : 'Failed to save room') }
  }

  async function setPerson(r: BookingRoom, pid: string | null) {
    setField(r, 'person_id', pid)
    try { await updateBookingRoom(r.id, { person_id: pid }) }
    catch (e) { error(e instanceof Error ? e.message : 'Failed to link person') }
  }

  async function saveGuests(r: BookingRoom, guests: string[]) {
    try { await updateBookingRoom(r.id, { additional_guests: guests.length ? guests : null }) }
    catch (e) { error(e instanceof Error ? e.message : 'Failed to save guests') }
  }

  async function saveImage(r: BookingRoom, src: string | null) {
    try { await updateBookingRoom(r.id, { brief_image_src: src || null }) }
    catch (e) { error(e instanceof Error ? e.message : 'Failed to save image') }
  }

  if (rooms.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rooms.map(r => {
        const d = getDraft(r)
        const src = imgs[r.id] ?? r.brief_image_src ?? booking._hotel_image_src ?? ''
        return (
          <div key={r.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px' }}>
            {r.confirmation_number && (
              <div style={{ fontSize: 10, color: A.gold, fontFamily: 'DM Mono, monospace', fontWeight: 700, marginBottom: 8 }}>#{r.confirmation_number}</div>
            )}
            <RoomFormBody
              draft={d}
              setField={(k, v) => setField(r, k, v)}
              setPerson={pid => setPerson(r, pid)}
              onResolved={name => setLinkedNames(prev => ({ ...prev, [r.id]: name }))}
              linkedName={linkedNames[r.id] ?? null}
              partyLabel={partyLabel ?? null}
              addGuest={() => setField(r, 'additional_guests', [...d.additional_guests, ''])}
              patchGuest={(idx, v) => { const g = [...d.additional_guests]; g[idx] = v; setField(r, 'additional_guests', g) }}
              removeGuest={idx => { const g = d.additional_guests.filter((_, i) => i !== idx); setField(r, 'additional_guests', g); saveGuests(r, g) }}
              blurField={k => {
                if (k === 'additional_guests') { saveGuests(r, d.additional_guests); return }
                saveField(r, k as SavableField)
              }}
            />
            <RoomImageStrip
              roomId={r.id}
              src={src}
              presetPath={imagePresetPath}
              onPick={url => { setImgs({ ...imgs, [r.id]: url }); saveImage(r, url) }}
              onClear={() => { setImgs({ ...imgs, [r.id]: '' }); saveImage(r, null) }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Uncontrolled (dossier) — own state, save-on-submit ──────────────────────

function UncontrolledRooms({ booking, partyLabel, imagePresetPath }: { booking: EngagementBooking; partyLabel: string | null; imagePresetPath?: string }) {
  const [rooms,  setRooms]  = useState<BookingRoom[]>(booking._rooms ?? [])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft,  setDraft]  = useState<RoomDraft>(emptyDraft())
  const [linkedName, setLinkedName] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const { success, error } = useAdminToast()

  const setField = <K extends keyof RoomDraft>(k: K, v: RoomDraft[K]) => setDraft(prev => ({ ...prev, [k]: v }))

  function beginAdd() { setEditId(null); setDraft(emptyDraft()); setLinkedName(null); setAdding(true) }
  function beginEdit(r: BookingRoom) { setAdding(false); setEditId(r.id); setDraft(roomToDraft(r)); setLinkedName(null) }

  async function handleAdd() {
    setSaving('add')
    try {
      const r = await createBookingRoom(booking.id, { ...draftToPatch(draft), sort_order: rooms.length })
      setRooms(prev => [...prev, r]); setAdding(false); setDraft(emptyDraft()); success('Room added')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to add room') }
    finally { setSaving(null) }
  }

  async function handleSaveEdit() {
    if (!editId) return
    setSaving(editId)
    try {
      const updated = await updateBookingRoom(editId, draftToPatch(draft))
      setRooms(prev => prev.map(r => r.id === editId ? updated : r)); setEditId(null); setDraft(emptyDraft()); success('Room updated')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to update room') }
    finally { setSaving(null) }
  }

  async function handleDelete(roomId: string) {
    setSaving(roomId)
    try { await deleteBookingRoom(roomId); setRooms(prev => prev.filter(r => r.id !== roomId)); success('Room removed') }
    catch (e) { error(e instanceof Error ? e.message : 'Failed to delete room') }
    finally { setSaving(null) }
  }

  const form = (saveLabel: string, onSave: () => void, onCancel: () => void, busy: boolean) => (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <RoomFormBody
        draft={draft}
        setField={setField}
        setPerson={pid => setField('person_id', pid)}
        onResolved={setLinkedName}
        linkedName={linkedName}
        partyLabel={partyLabel}
        addGuest={() => setField('additional_guests', [...draft.additional_guests, ''])}
        patchGuest={(idx, v) => { const g = [...draft.additional_guests]; g[idx] = v; setField('additional_guests', g) }}
        removeGuest={idx => setField('additional_guests', draft.additional_guests.filter((_, i) => i !== idx))}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.faint, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={busy} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: '#0F1110', background: A.gold, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>Rooms ({rooms.length})</div>
        {!adding && !editId && (
          <button onClick={beginAdd} style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>+ Add Room</button>
        )}
      </div>

      {rooms.map(r => (
        editId === r.id ? (
          <div key={r.id} style={{ marginBottom: 6 }}>{form('Save Changes', handleSaveEdit, () => { setEditId(null); setDraft(emptyDraft()) }, saving === r.id)}</div>
        ) : (
          <div key={r.id} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {r.confirmation_number && <div style={{ fontSize: 11, fontWeight: 700, color: A.gold, fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>#{r.confirmation_number}</div>}
              <div style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily:A.font }}>{roomGuestName(r) ?? 'Guest'}</div>
              {r.additional_guests?.length ? <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>+{r.additional_guests.length} additional guest{r.additional_guests.length === 1 ? '' : 's'}</div> : null}
              {r.party_composition  && <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{r.party_composition}</div>}
              {r.room_name          && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{r.room_name}</div>}
              {(r.total != null || r.rate != null) && (
                <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                  {r.rate != null ? `${r.rate}/night` : ''}{r.rate != null && r.total != null ? '  ·  ' : ''}{r.total != null ? `${r.total} total` : ''}{r.extra_person_fee != null ? `  ·  +${r.extra_person_fee} extra person` : ''}
                </div>
              )}
              {r.notes              && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{r.notes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => beginEdit(r)} style={{ fontFamily: A.font, fontSize: 10, color: A.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Edit</button>
              <button onClick={() => handleDelete(r.id)} disabled={saving === r.id} style={{ fontFamily: A.font, fontSize: 10, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>{saving === r.id ? '...' : '×'}</button>
            </div>
          </div>
        )
      ))}

      {adding && form('Add Room', handleAdd, () => { setAdding(false); setDraft(emptyDraft()) }, saving === 'add')}
    </div>
  )
}