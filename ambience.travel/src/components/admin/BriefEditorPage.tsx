/* BriefEditorPage.tsx
 * Dedicated full-page brief editor for a single trip.
 * Route: #admin/trips/{tripId}/brief
 *
 * Last updated: S48 — aux sections grouped by booking_type via auxBookingTypes
 *   registry. BriefFlightEditor booking_type selector uses AUX_BOOKING_TYPES.
 *   Preview renders one section per type with label from getAuxTypeMeta.
 *   "FLIGHTS" hardcode replaced with dynamic grouping.
 * Prior: S48 — flights fully editable, booked_by, AuxDraft type, dark editor.
 * Prior: S47 — booked_by_label added to RoomDraft.
 * Prior: S46 — initial ship.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { A } from '../../lib/adminTokens'
import { navigateAdmin } from '../../lib/adminPath'
import {
  fetchTripDossierForHouse,
  fetchTripAuxBookings,
  upsertTripBrief,
  updateBookingRoom,
  updateTripAuxBooking,
} from '../../lib/adminTripQueries'
import type {
  DossierTrip,
  HouseProfile,
  TripBrief,
  TripBriefPatch,
  TripBooking,
  TripAuxBooking,
} from '../../lib/adminTripQueries'
import { getAuxTypeMeta, AUX_BOOKING_TYPES } from '../../lib/auxBookingTypes'
import { useBriefDownload } from '../../lib/useBriefDownload'
import AssetPicker from './AssetPicker'
import { supabase } from '../../lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const CREAM   = '#F7F5F0'
const INK     = '#1A1D1A'
const GOLD    = '#C9A84C'
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const CARD_BG = '#F0EDE6'

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

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font,
  letterSpacing: '0.1em', textTransform: 'uppercase' as const,
  marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${A.border}`,
}

const fieldStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text,
  background: 'transparent', border: 'none',
  borderBottom: `1px solid ${A.border}`,
  outline: 'none', width: '100%', padding: '2px 0',
  boxSizing: 'border-box' as const,
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, display: 'block', marginBottom: 2,
}

// ── Date / time helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function buildDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  if (!end) return fmtDate(start)
  const s = new Date(start.slice(0, 10) + 'T00:00:00')
  const e = new Date(end.slice(0, 10) + 'T00:00:00')
  const sm = s.toLocaleDateString('en-US', { month: 'long' })
  const em = e.toLocaleDateString('en-US', { month: 'long' })
  if (sm === em && s.getFullYear() === e.getFullYear())
    return `${s.getDate()}\u2013${e.getDate()} ${em} ${e.getFullYear()}`
  return `${fmtDate(start)}\u2013${fmtDate(end)}`
}

async function resolveHouseIdForTrip(tripId: string): Promise<string | null> {
  const { data } = await supabase
    .from('travel_bookings')
    .select('house_id')
    .eq('trip_id', tripId)
    .not('house_id', 'is', null)
    .limit(1)
    .single()
  return data?.house_id ?? null
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RoomDraft = {
  guest_name:        string
  room_name:         string
  party_composition: string
  notes:             string
  additional_guests: string[]
  booked_by_label:   string
}

type AuxDraft = {
  name:                string
  booking_type:        string
  origin:              string
  destination:         string
  start_date:          string
  start_time:          string
  end_date:            string
  end_time:            string
  confirmation_number: string
  guest_label:         string
  booked_by:           string
  notes:               string
}

interface PreviewFields {
  briefTitle:    string
  briefSubtitle: string
  preparedFor:   string
  heroImageSrc:  string
  logoVariant:   string
  trip:          DossierTrip
  house:         HouseProfile | null
  roomImageSrcs: Record<string, string>
  roomDrafts:    Record<string, RoomDraft>
  auxBookings:   TripAuxBooking[]
  auxDrafts:     Record<string, AuxDraft>
}

// ── BriefRoomEditor ───────────────────────────────────────────────────────────

function BriefRoomEditor({ trip, roomImageSrcs, onImageSrcsChange, roomDrafts, onRoomDraftsChange, isMobile }: {
  trip:               DossierTrip
  roomImageSrcs:      Record<string, string>
  onImageSrcsChange:  (srcs: Record<string, string>) => void
  roomDrafts:         Record<string, RoomDraft>
  onRoomDraftsChange: (drafts: Record<string, RoomDraft>) => void
  isMobile:           boolean
}) {
  const allRooms = trip.bookings.flatMap(b => b._rooms.map(r => ({ room: r, booking: b })))

  const [imgInitialized, setImgInitialized] = useState(false)
  if (!imgInitialized && allRooms.length > 0 && Object.keys(roomImageSrcs).length === 0) {
    onImageSrcsChange(Object.fromEntries(
      allRooms.map(({ room, booking }) => [room.id, room.brief_image_src ?? booking._hotel_image_src ?? ''])
    ))
    setImgInitialized(true)
  }

  const [pickerRoomId, setPickerRoomId] = useState<string | null>(null)

  function getDraft(roomId: string, room: typeof allRooms[number]['room']): RoomDraft {
    return roomDrafts[roomId] ?? {
      guest_name:        room.guest_name        ?? '',
      room_name:         room.room_name         ?? '',
      party_composition: room.party_composition ?? '',
      notes:             room.notes             ?? '',
      additional_guests: room.additional_guests ?? [],
      booked_by_label:   (room as any).booked_by_label ?? '',
    }
  }

  function patch(roomId: string, room: typeof allRooms[number]['room'], field: keyof RoomDraft, value: string) {
    const prev = getDraft(roomId, room)
    onRoomDraftsChange({ ...roomDrafts, [roomId]: { ...prev, [field]: value } })
  }

  async function saveField(roomId: string, field: keyof Omit<RoomDraft, 'additional_guests'>, value: string) {
    try { await updateBookingRoom(roomId, { [field]: value || null } as any) }
    catch { /* silent */ }
  }

  async function saveAdditionalGuests(roomId: string, guests: string[]) {
    try { await updateBookingRoom(roomId, { additional_guests: guests.length > 0 ? guests : null }) }
    catch { /* silent */ }
  }

  function addGuest(roomId: string, room: typeof allRooms[number]['room']) {
    const prev = getDraft(roomId, room)
    onRoomDraftsChange({ ...roomDrafts, [roomId]: { ...prev, additional_guests: [...prev.additional_guests, ''] } })
  }

  function patchGuest(roomId: string, room: typeof allRooms[number]['room'], idx: number, value: string) {
    const prev = getDraft(roomId, room)
    const guests = [...prev.additional_guests]
    guests[idx] = value
    onRoomDraftsChange({ ...roomDrafts, [roomId]: { ...prev, additional_guests: guests } })
  }

  function removeGuest(roomId: string, room: typeof allRooms[number]['room'], idx: number) {
    const prev   = getDraft(roomId, room)
    const guests = prev.additional_guests.filter((_, i) => i !== idx)
    onRoomDraftsChange({ ...roomDrafts, [roomId]: { ...prev, additional_guests: guests } })
    saveAdditionalGuests(roomId, guests)
  }

  async function saveImage(roomId: string, src: string | null) {
    try { await updateBookingRoom(roomId, { brief_image_src: src || null }) }
    catch { /* silent */ }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {allRooms.map(({ room }) => {
          const src   = roomImageSrcs[room.id] ?? ''
          const draft = getDraft(room.id, room)
          return (
            <div key={room.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px' }}>
              {room.confirmation_number && (
                <div style={{ fontSize: 10, color: A.gold, fontFamily: 'DM Mono, monospace', fontWeight: 700, marginBottom: 8 }}>
                  #{room.confirmation_number}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 12px', marginBottom: 10 }}>
                <div>
                  <label style={fieldLabelStyle}>Primary Guest</label>
                  <input style={fieldStyle} value={draft.guest_name}
                    onChange={e => patch(room.id, room, 'guest_name', e.target.value)}
                    onBlur={e => saveField(room.id, 'guest_name', e.target.value)}
                    placeholder='HRH Princess Nouf' />
                  {draft.additional_guests.map((g, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <input style={{ ...fieldStyle, flex: 1 }} value={g}
                        onChange={e => patchGuest(room.id, room, idx, e.target.value)}
                        onBlur={() => saveAdditionalGuests(room.id, draft.additional_guests)}
                        placeholder='Additional guest name' />
                      <button onClick={() => removeGuest(room.id, room, idx)}
                        style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addGuest(room.id, room)}
                    style={{ fontFamily: A.font, fontSize: 9, fontWeight: 600, color: A.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0 0', letterSpacing: '0.04em' }}>
                    + Add'l Guest
                  </button>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Party Composition</label>
                  <input style={fieldStyle} value={draft.party_composition}
                    onChange={e => patch(room.id, room, 'party_composition', e.target.value)}
                    onBlur={e => saveField(room.id, 'party_composition', e.target.value)}
                    placeholder='2 Adults, 2 Children' />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Room Name</label>
                  <input style={fieldStyle} value={draft.room_name}
                    onChange={e => patch(room.id, room, 'room_name', e.target.value)}
                    onBlur={e => saveField(room.id, 'room_name', e.target.value)}
                    placeholder='Two-Bedroom Suite Palm View' />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Notes</label>
                  <input style={fieldStyle} value={draft.notes}
                    onChange={e => patch(room.id, room, 'notes', e.target.value)}
                    onBlur={e => saveField(room.id, 'notes', e.target.value)}
                    placeholder='Complimentary rollaway bed' />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabelStyle}>Booked By</label>
                  <input style={fieldStyle} value={draft.booked_by_label}
                    onChange={e => patch(room.id, room, 'booked_by_label', e.target.value)}
                    onBlur={e => saveField(room.id, 'booked_by_label', e.target.value)}
                    placeholder='Booked by Deron' />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                  <button onClick={() => setPickerRoomId(room.id)}
                    style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', textAlign: 'left' as const }}>
                    {src ? 'Change Image' : 'Select from Library'}
                  </button>
                  {src && (
                    <button onClick={() => { onImageSrcsChange({ ...roomImageSrcs, [room.id]: '' }); saveImage(room.id, null) }}
                      style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {pickerRoomId && (
        <AssetPicker
          onClose={() => setPickerRoomId(null)}
          presetPath={trip.destinations[0]?.storage_path ? `${trip.destinations[0].storage_path}/accom` : undefined}
          onSelected={async url => {
            onImageSrcsChange({ ...roomImageSrcs, [pickerRoomId]: url })
            setPickerRoomId(null)
            updateBookingRoom(pickerRoomId, { brief_image_src: url }).catch(() => {})
          }}
        />
      )}
    </>
  )
}

// ── BriefAuxEditor ────────────────────────────────────────────────────────────
// Single component handles all aux booking types — section header derives from
// registry. One instance per type rendered from the parent.

function BriefAuxEditor({ auxBookings, auxDrafts, onAuxDraftsChange, isMobile }: {
  auxBookings:       TripAuxBooking[]
  auxDrafts:         Record<string, AuxDraft>
  onAuxDraftsChange: (drafts: Record<string, AuxDraft>) => void
  isMobile:          boolean
}) {
  // Group by booking_type, ordered by sort_order
  const sorted = [...auxBookings]
    .filter(a => a.brief_show !== false)
    .sort((a, b) => {
      const ma = getAuxTypeMeta(a.booking_type)
      const mb = getAuxTypeMeta(b.booking_type)
      if (ma.sort_order !== mb.sort_order) return ma.sort_order - mb.sort_order
      return a.sort_order - b.sort_order
    })

  const sections: { type: string; label: string; icon: string; items: TripAuxBooking[] }[] = []
  for (const aux of sorted) {
    const type = aux.booking_type ?? 'Other'
    const meta = getAuxTypeMeta(type)
    const last = sections[sections.length - 1]
    if (last && last.type === type) {
      last.items.push(aux)
    } else {
      sections.push({ type, label: meta.label, icon: meta.icon, items: [aux] })
    }
  }

  function getDraft(aux: TripAuxBooking): AuxDraft {
    return auxDrafts[aux.id] ?? {
      name:                aux.name                ?? '',
      booking_type:        aux.booking_type        ?? '',
      origin:              aux.origin              ?? '',
      destination:         aux.destination         ?? '',
      start_date:          aux.start_date          ?? '',
      start_time:          aux.start_time?.slice(0, 5) ?? '',
      end_date:            aux.end_date            ?? '',
      end_time:            aux.end_time?.slice(0, 5) ?? '',
      confirmation_number: aux.confirmation_number ?? '',
      guest_label:         aux.guest_label         ?? '',
      booked_by:           aux.booked_by           ?? '',
      notes:               aux.notes               ?? '',
    }
  }

  function patch(id: string, aux: TripAuxBooking, field: keyof AuxDraft, value: string) {
    const prev = getDraft(aux)
    onAuxDraftsChange({ ...auxDrafts, [id]: { ...prev, [field]: value } })
  }

  async function save(id: string, field: keyof AuxDraft, value: string) {
    try { await updateTripAuxBooking(id, { [field]: value || null } as any) }
    catch { /* silent */ }
  }

  if (sections.length === 0) return (
    <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
      No aux bookings with brief_show enabled for this trip.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map(section => (
        <div key={section.type}>
          {/* Sub-section header */}
          <div style={{ fontSize: 9, fontWeight: 700, color: A.faint, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {section.items.map(aux => {
              const draft = getDraft(aux)
              return (
                <div key={aux.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 12px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Name</label>
                      <input style={fieldStyle} value={draft.name}
                        onChange={e => patch(aux.id, aux, 'name', e.target.value)}
                        onBlur={e => save(aux.id, 'name', e.target.value)}
                        placeholder='Flynas XY 277' />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Type</label>
                      <select
                        style={{ ...fieldStyle, cursor: 'pointer' }}
                        value={draft.booking_type}
                        onChange={e => { patch(aux.id, aux, 'booking_type', e.target.value); save(aux.id, 'booking_type', e.target.value) }}
                      >
                        {AUX_BOOKING_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Origin</label>
                      <input style={fieldStyle} value={draft.origin}
                        onChange={e => patch(aux.id, aux, 'origin', e.target.value)}
                        onBlur={e => save(aux.id, 'origin', e.target.value)}
                        placeholder='RUH' />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Destination</label>
                      <input style={fieldStyle} value={draft.destination}
                        onChange={e => patch(aux.id, aux, 'destination', e.target.value)}
                        onBlur={e => save(aux.id, 'destination', e.target.value)}
                        placeholder='SSH' />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Departure Date</label>
                      <input type='date' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.start_date}
                        onChange={e => patch(aux.id, aux, 'start_date', e.target.value)}
                        onBlur={e => save(aux.id, 'start_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Arrival Date</label>
                      <input type='date' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.end_date}
                        onChange={e => patch(aux.id, aux, 'end_date', e.target.value)}
                        onBlur={e => save(aux.id, 'end_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Departure Time</label>
                      <input type='time' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.start_time}
                        onChange={e => patch(aux.id, aux, 'start_time', e.target.value)}
                        onBlur={e => save(aux.id, 'start_time', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Arrival Time</label>
                      <input type='time' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.end_time}
                        onChange={e => patch(aux.id, aux, 'end_time', e.target.value)}
                        onBlur={e => save(aux.id, 'end_time', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Confirmation #</label>
                      <input style={fieldStyle} value={draft.confirmation_number}
                        onChange={e => patch(aux.id, aux, 'confirmation_number', e.target.value)}
                        onBlur={e => save(aux.id, 'confirmation_number', e.target.value)}
                        placeholder='XY277-...' />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Guest Label</label>
                      <input style={fieldStyle} value={draft.guest_label}
                        onChange={e => patch(aux.id, aux, 'guest_label', e.target.value)}
                        onBlur={e => save(aux.id, 'guest_label', e.target.value)}
                        placeholder='All guests' />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Booked By</label>
                      <input style={fieldStyle} value={draft.booked_by}
                        onChange={e => patch(aux.id, aux, 'booked_by', e.target.value)}
                        onBlur={e => save(aux.id, 'booked_by', e.target.value)}
                        placeholder='Booked by Deron' />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Notes</label>
                      <input style={fieldStyle} value={draft.notes}
                        onChange={e => patch(aux.id, aux, 'notes', e.target.value)}
                        onBlur={e => save(aux.id, 'notes', e.target.value)}
                        placeholder='Any notes...' />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── BriefPreview ──────────────────────────────────────────────────────────────

function BriefPreview({ fields }: { fields: PreviewFields }) {
  const { briefTitle, briefSubtitle, preparedFor, heroImageSrc, logoVariant, trip, house, roomImageSrcs, roomDrafts, auxBookings, auxDrafts } = fields

  const title    = briefTitle || trip.destinations.map(d => d.name).join(' & ') || trip.trip_code
  const subtitle = (briefSubtitle || 'TRIP CONFIRMATION BRIEF').toUpperCase()
  const pfor     = preparedFor || house?.display_name || ''
  const dates    = buildDateRange(trip.start_date, trip.end_date)

  const allRooms: { room: TripBooking['_rooms'][number]; booking: TripBooking }[] = []
  for (const b of trip.bookings.filter(bk => bk.brief_show !== false)) {
    if (b._rooms.length > 0) {
      for (const r of b._rooms) allRooms.push({ room: r, booking: b })
      continue
    }
    allRooms.push({
      room: {
        id: b.id, booking_id: b.id, room_name: b.name,
        confirmation_number: b.confirmation_number,
        guest_name: house?.display_name ?? null,
        party_composition: b.party_composition,
        notes: b.inclusions ?? null, nights: b.nights,
        rate: b.commissionable_rate, tax_pct: b.taxes_and_fees,
        total: null, brief_image_src: b.brief_image_src,
        additional_guests: null, booked_by_label: null,
        sort_order: b.sort_order ?? 0, created_at: b.created_at ?? '', updated_at: b.updated_at ?? '',
      } as any,
      booking: b,
    })
  }

  // Group aux by type, sorted by registry sort_order
  const sortedAux = [...auxBookings]
    .filter(a => a.brief_show !== false)
    .sort((a, b) => {
      const ma = getAuxTypeMeta(a.booking_type)
      const mb = getAuxTypeMeta(b.booking_type)
      if (ma.sort_order !== mb.sort_order) return ma.sort_order - mb.sort_order
      return a.sort_order - b.sort_order
    })

  const auxSections: { type: string; label: string; icon: string; items: TripAuxBooking[] }[] = []
  for (const aux of sortedAux) {
    const type = aux.booking_type ?? 'Other'
    const meta = getAuxTypeMeta(type)
    const last = auxSections[auxSections.length - 1]
    if (last && last.type === type) {
      last.items.push(aux)
    } else {
      auxSections.push({ type, label: meta.label, icon: meta.icon, items: [aux] })
    }
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: INK, background: CREAM, minHeight: '100%', padding: '0 0 40px' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 240, background: CARD_BG, overflow: 'hidden' }}>
        {heroImageSrc && <img src={heroImageSrc} alt='hero' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {logoVariant !== 'unbranded' && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '0.5px solid rgba(200,195,185,0.6)' }}>
            {logoVariant !== 'alfaone' && <img src='/emblem.png' alt='' style={{ width: 36, height: 36, objectFit: 'contain' }} />}
            {logoVariant === 'alfaone'
              ? <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#B49050', letterSpacing: '0.02em' }}>AlfaOne Concierge</span>
              : <img src='/ambience_travel.svg' alt='ambience' style={{ height: 42, objectFit: 'contain' }} />
            }
          </div>
        )}
      </div>

      {/* Cover text */}
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ fontSize: 30, fontWeight: 400, color: INK, lineHeight: 1.2, marginBottom: 10, textAlign: 'center' }}>{title}</div>
        <div style={{ height: 1, background: GOLD, marginBottom: 8 }} />
        <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, textAlign: 'center', letterSpacing: '0.12em', marginBottom: 6 }}>{subtitle}</div>
        {pfor && <div style={{ fontSize: 13, fontStyle: 'italic', color: MUTED, textAlign: 'center', marginBottom: 4 }}>Prepared for {pfor}</div>}
        {dates && <div style={{ fontSize: 11, color: FAINT, textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>{dates}</div>}
      </div>

      {/* Accommodation */}
      {allRooms.length > 0 && (
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ height: 1, background: RULE, marginBottom: 20 }} />
          <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 12 }}>ACCOMMODATION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allRooms.map(({ room, booking }, i) => {
              const d                = roomDrafts[room.id]
              const guestName        = d?.guest_name        ?? room.guest_name        ?? null
              const roomName         = d?.room_name         ?? room.room_name         ?? null
              const partyComposition = d?.party_composition ?? room.party_composition ?? null
              const additionalGuests = d?.additional_guests ?? room.additional_guests ?? []
              const imgSrc           = roomImageSrcs[room.id] || room.brief_image_src
              const isAmbience       = (booking.booked_by ?? 'ambience') === 'ambience'
              const bookedByText     = d?.booked_by_label?.trim() || (room as any).booked_by_label?.trim() || (isAmbience ? 'Booked by ambience' : 'Own Arrangements')
              const pillColor        = isAmbience ? GOLD : FAINT

              const guestParts: string[] = []
              if (guestName) guestParts.push(guestName)
              if (additionalGuests.length) guestParts.push(...additionalGuests)
              if (partyComposition) guestParts.push(partyComposition)
              const guestLine = guestParts.join(' · ')

              return (
                <div key={room.id ?? i} style={{ background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 8, overflow: 'hidden', display: 'flex', minHeight: 90 }}>
                  <div style={{ width: '44%', flexShrink: 0, background: CARD_BG, position: 'relative', overflow: 'hidden' }}>
                    {imgSrc && <img src={imgSrc} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />}
                  </div>
                  <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {roomName && <div style={{ fontSize: 14, color: INK, marginBottom: 3, lineHeight: 1.3 }}>{roomName}</div>}
                      {guestLine && <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>{guestLine}</div>}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      {room.confirmation_number && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${pillColor}`, borderRadius: 4, padding: '2px 8px', marginBottom: 4, background: isAmbience ? '#FAF7F0' : '#F5F5F5' }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: pillColor }}>Conf #:  {room.confirmation_number}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', fontStyle: 'italic', color: FAINT }}>{bookedByText}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Aux sections — one per type */}
      {auxSections.map(section => (
        <div key={section.type} style={{ padding: '20px 28px 0' }}>
          <div style={{ height: 1, background: RULE, marginBottom: 20 }} />
          <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 12 }}>
            {section.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {section.items.map(aux => {
              const d          = auxDrafts[aux.id]
              const name       = d?.name               || aux.name               || ''
              const origin     = d?.origin             || aux.origin             || ''
              const dest       = d?.destination        || aux.destination        || ''
              const confNum    = d?.confirmation_number || aux.confirmation_number || ''
              const guestLbl   = d?.guest_label        || aux.guest_label        || ''
              const bookedBy   = d?.booked_by?.trim()  || aux.booked_by?.trim()  || null
              const startTime  = d?.start_time || aux.start_time?.slice(0, 5) || null
              const endTime    = d?.end_time   || aux.end_time?.slice(0, 5)   || null
              const startDate  = d?.start_date || aux.start_date              || null

              const isAmbience  = !bookedBy || bookedBy.toLowerCase().includes('ambience')
              const bookedByTxt = bookedBy || (isAmbience ? 'Booked by ambience' : 'Own Arrangements')
              const pillColor   = isAmbience ? GOLD : FAINT

              const dep = fmtTime(startTime)
              const arr = fmtTime(endTime)
              const timeStr = dep && arr ? `${dep} – ${arr}` : dep || arr || ''
              const route = [origin, dest].filter(Boolean).join(' → ')

              return (
                <div key={aux.id} style={{ background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 56 }}>
                  <div style={{ fontSize: 18, color: GOLD, flexShrink: 0, lineHeight: 1, paddingTop: 2 }}>{section.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {name && <div style={{ fontSize: 13, color: INK, marginBottom: 2 }}>{name}</div>}
                    {route && <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>{route}</div>}
                    {startDate && <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', color: FAINT, marginTop: 1 }}>{fmtDate(startDate)}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {timeStr && <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK }}>{timeStr}</div>}
                    {guestLbl && <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontStyle: 'italic', color: FAINT, marginTop: 2 }}>{guestLbl}</div>}
                    {confNum && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${pillColor}`, borderRadius: 4, padding: '1px 7px', marginTop: 4, background: isAmbience ? '#FAF7F0' : '#F5F5F5' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: pillColor }}>Conf #:  {confNum}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontStyle: 'italic', color: FAINT, marginTop: 3 }}>{bookedByTxt}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function BriefEditorPage({ tripId }: { tripId: string }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    function onResize() { setWindowWidth(window.innerWidth) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = windowWidth < 768
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const [trip,        setTrip]        = useState<DossierTrip | null>(null)
  const [house,       setHouse]       = useState<HouseProfile | null>(null)
  const [auxBookings, setAuxBookings] = useState<TripAuxBooking[]>([])
  const [loadErr,     setLoadErr]     = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)
  const [pickerOpen,  setPickerOpen]  = useState(false)

  const { pdfReady, pdfDownloading, handleDownloadBrief } = useBriefDownload()

  const [briefTitle,    setBriefTitle]    = useState('')
  const [briefSubtitle, setBriefSubtitle] = useState('')
  const [preparedFor,   setPreparedFor]   = useState('')
  const [logoVariant,   setLogoVariant]   = useState<string>('ambience')
  const [heroImageSrc,  setHeroImageSrc]  = useState('')

  const [roomImageSrcs, setRoomImageSrcs] = useState<Record<string, string>>({})
  const [roomDrafts,    setRoomDrafts]    = useState<Record<string, RoomDraft>>({})
  const [auxDrafts,     setAuxDrafts]     = useState<Record<string, AuxDraft>>({})

  useEffect(() => {
    async function load() {
      const houseId = await resolveHouseIdForTrip(tripId)
      if (!houseId) { setLoadErr('No house linked to this trip. Open the trip from the House tab.'); return }

      const [dossier, auxData] = await Promise.all([
        fetchTripDossierForHouse(houseId),
        fetchTripAuxBookings(tripId),
      ])

      const found = dossier.trips.find(t => t.id === tripId)
      if (!found) { setLoadErr('Trip not found in dossier.'); return }
      setTrip(found)
      setHouse(dossier.house)
      setAuxBookings(auxData)

      const allRooms = found.bookings.flatMap(b => b._rooms)
      setRoomDrafts(Object.fromEntries(allRooms.map(r => [r.id, {
        guest_name:        r.guest_name        ?? '',
        room_name:         r.room_name         ?? '',
        party_composition: r.party_composition ?? '',
        notes:             r.notes             ?? '',
        additional_guests: r.additional_guests ?? [],
        booked_by_label:   (r as any).booked_by_label ?? '',
      }])))

      const br = found.brief
      if (br) {
        setBriefTitle(br.brief_title ?? '')
        setBriefSubtitle(br.brief_subtitle ?? '')
        setPreparedFor(br.prepared_for ?? dossier.house?.display_name ?? '')
        setHeroImageSrc(br.hero_image_src ?? '')
        setLogoVariant(br.logo_variant ?? 'ambience')
        return
      }
      setPreparedFor(dossier.house?.display_name ?? '')
    }
    load().catch(err => setLoadErr(err instanceof Error ? err.message : 'Load failed'))
  }, [tripId])

  async function handleSave() {
    if (!trip || !house) return
    setSaving(true); setSaveErr(null); setSaved(false)
    try {
      const patch: TripBriefPatch = {
        brief_title:    briefTitle    || null,
        brief_subtitle: briefSubtitle || null,
        prepared_for:   preparedFor   || null,
        hero_image_src: heroImageSrc  || null,
        logo_variant:   logoVariant   || null,
      }
      const savedBrief = await upsertTripBrief(trip.id, house.id, patch)
      setTrip(prev => prev ? { ...prev, brief: savedBrief } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    if (!trip) return
    let heroData: string | null = null
    if (heroImageSrc) {
      try {
        const res  = await fetch(heroImageSrc)
        const blob = await res.blob()
        heroData = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { heroData = null }
    }

    const mergedTrip = {
      ...trip,
      bookings: trip.bookings.map(b => ({
        ...b,
        _rooms: b._rooms.map(r => {
          const draft  = roomDrafts[r.id]
          const imgSrc = roomImageSrcs[r.id]
          return {
            ...r,
            ...(draft ? {
              guest_name:        draft.guest_name        || r.guest_name,
              room_name:         draft.room_name         || r.room_name,
              party_composition: draft.party_composition || r.party_composition,
              notes:             draft.notes             || r.notes,
              additional_guests: draft.additional_guests.length ? draft.additional_guests : r.additional_guests,
              booked_by_label:   draft.booked_by_label   || r.booked_by_label,
            } : {}),
            ...(imgSrc ? { brief_image_src: imgSrc } : {}),
          }
        }),
      })),
    }

    const mergedAux = auxBookings.map(aux => {
      const d = auxDrafts[aux.id]
      if (!d) return aux
      return {
        ...aux,
        name:                d.name                || aux.name,
        booking_type:        d.booking_type        || aux.booking_type,
        origin:              d.origin              || aux.origin,
        destination:         d.destination         || aux.destination,
        start_date:          d.start_date          || aux.start_date,
        start_time:          d.start_time          || aux.start_time,
        end_date:            d.end_date            || aux.end_date,
        end_time:            d.end_time            || aux.end_time,
        confirmation_number: d.confirmation_number || aux.confirmation_number,
        guest_label:         d.guest_label         || aux.guest_label,
        booked_by:           d.booked_by           || aux.booked_by,
        notes:               d.notes               || aux.notes,
      }
    })

    handleDownloadBrief({
      trip:            mergedTrip,
      brief:           trip.brief ?? ({ brief_title: briefTitle || null, brief_subtitle: briefSubtitle || null, prepared_for: preparedFor || null, hero_image_src: heroImageSrc || null, logo_variant: logoVariant || null } as any),
      house,
      destinationName: trip.destinations[0]?.name ?? trip.trip_code,
      heroImageData:   heroData,
      auxBookings:     mergedAux,
    })
  }

  const [previewFields, setPreviewFields] = useState<PreviewFields | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePreview = useCallback(() => {
    if (!trip) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreviewFields({ briefTitle, briefSubtitle, preparedFor, heroImageSrc, logoVariant, trip, house, roomImageSrcs, roomDrafts, auxBookings, auxDrafts })
    }, 300)
  }, [briefTitle, briefSubtitle, preparedFor, heroImageSrc, logoVariant, trip, house, roomImageSrcs, roomDrafts, auxBookings, auxDrafts])

  useEffect(() => { schedulePreview() }, [schedulePreview])

  const btnBase: React.CSSProperties = {
    fontFamily: A.font, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', borderRadius: 6, padding: '6px 14px',
    cursor: 'pointer', transition: 'all 150ms ease', border: 'none',
  }

  if (loadErr) return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#f87171', fontFamily: A.font }}>{loadErr}</div>
      <button onClick={() => navigateAdmin({ product: 'house', tab: 'households' })} style={{ ...btnBase, background: A.bgCard, color: A.gold, border: `1px solid ${A.border}` }}>← Back to Houses</button>
    </div>
  )

  if (!trip) return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading brief…</div>
    </div>
  )

  const hasVisibleAux = auxBookings.filter(a => a.brief_show !== false).length > 0

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font, color: A.text }}>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: A.bgCard, borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', height: 50 }}>
        <button onClick={() => navigateAdmin({ product: 'house', tab: 'households' })} style={{ ...btnBase, background: 'transparent', color: A.muted, border: `1px solid ${A.border}`, padding: '4px 10px', fontSize: 10 }}>← Houses</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>{trip.trip_code}</span>
          <span style={{ fontSize: 10, color: A.muted }}>Confirmation Brief</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveErr && <span style={{ fontSize: 10, color: '#f87171' }}>{saveErr}</span>}
          {saved   && <span style={{ fontSize: 10, color: '#4ade80', fontFamily: A.font }}>Saved</span>}
          <button onClick={handleSave} disabled={saving} style={{ ...btnBase, background: A.bgCard, color: A.text, border: `1px solid ${A.border}`, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
          <button onClick={handleDownload} disabled={!pdfReady || pdfDownloading} style={{ ...btnBase, background: A.gold, color: '#0F1110', opacity: pdfReady && !pdfDownloading ? 1 : 0.5, cursor: pdfReady && !pdfDownloading ? 'pointer' : 'not-allowed' }}>
            {pdfDownloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      {isMobile && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${A.border}`, background: A.bgCard }}>
          {(['edit', 'preview'] as const).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)} style={{
              flex: 1, fontFamily: A.font, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              padding: '10px 0', border: 'none', cursor: 'pointer',
              background: mobileTab === tab ? A.bg : A.bgCard,
              color: mobileTab === tab ? A.gold : A.muted,
              borderBottom: mobileTab === tab ? `2px solid ${A.gold}` : `2px solid transparent`,
              transition: 'all 120ms ease',
            }}>
              {tab === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 50px)' }}>

        {/* Editor panel */}
        <div style={{
          width: isMobile ? '100%' : '40%',
          flexShrink: 0,
          borderRight: isMobile ? 'none' : `1px solid ${A.border}`,
          overflowY: 'auto',
          background: A.bg,
          padding: isMobile ? 16 : 24,
          display: isMobile && mobileTab !== 'edit' ? 'none' : 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          <section>
            <div style={sectionHeadStyle}>Cover</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1fr', gap: 10 }}>
                <Field label='Trip Title'>
                  <input style={inputStyle} value={briefTitle} onChange={e => setBriefTitle(e.target.value)} placeholder={trip.destinations.map(d => d.name).join(' & ') || trip.trip_code} />
                </Field>
                <Field label='Subtitle'>
                  <input style={inputStyle} value={briefSubtitle} onChange={e => setBriefSubtitle(e.target.value)} placeholder='Trip Confirmation Brief' />
                </Field>
              </div>
              <Field label='Logo'>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['ambience', 'alfaone', 'unbranded'] as const).map(v => (
                    <button key={v} onClick={() => setLogoVariant(v)} style={{
                      fontFamily: A.font, fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.04em', textTransform: 'capitalize' as const,
                      border: `1px solid ${logoVariant === v ? A.gold : A.border}`,
                      borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                      background: logoVariant === v ? `${A.gold}18` : 'transparent',
                      color: logoVariant === v ? A.gold : A.faint,
                      transition: 'all 120ms ease',
                    }}>
                      {v === 'ambience' ? 'ambience' : v === 'alfaone' ? 'AlfaOne' : 'Unbranded'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label='Prepared For'>
                <input style={inputStyle} value={preparedFor} onChange={e => setPreparedFor(e.target.value)} placeholder={house?.display_name ?? ''} />
              </Field>
              <Field label='Hero Image'>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {heroImageSrc ? (
                    <div style={{ width: 80, height: 52, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: `1px solid ${A.border}` }}>
                      <img src={heroImageSrc} alt='hero' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: 80, height: 52, borderRadius: 6, background: A.bgCard, border: `1px solid ${A.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>No image</span>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <button onClick={() => setPickerOpen(true)} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', textAlign: 'left' as const }}>
                      {heroImageSrc ? 'Change Image' : 'Select from Library'}
                    </button>
                    {heroImageSrc && (
                      <button onClick={() => setHeroImageSrc('')} style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>Remove</button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </section>

          <section>
            <div style={sectionHeadStyle}>Accommodation</div>
            {trip.bookings.every(b => b._rooms.length === 0) ? (
              <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No rooms seeded yet. Add rooms via the booking card in the House tab.</div>
            ) : (
              <BriefRoomEditor trip={trip} roomImageSrcs={roomImageSrcs} onImageSrcsChange={setRoomImageSrcs} roomDrafts={roomDrafts} onRoomDraftsChange={setRoomDrafts} isMobile={isMobile} />
            )}
          </section>

          {hasVisibleAux && (
            <section>
              <div style={sectionHeadStyle}>Transport & Transfers</div>
              <BriefAuxEditor
                auxBookings={auxBookings}
                auxDrafts={auxDrafts}
                onAuxDraftsChange={setAuxDrafts}
                isMobile={isMobile}
              />
            </section>
          )}
        </div>

        {/* Preview panel */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#E8E4DC', display: isMobile && mobileTab !== 'preview' ? 'none' : 'block' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${RULE}`, background: '#DDD9D1' }}>
            <span style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live Preview</span>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ maxWidth: 560, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: 4, overflow: 'hidden' }}>
              {previewFields && <BriefPreview fields={previewFields} />}
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <AssetPicker
          onClose={() => setPickerOpen(false)}
          presetPath={trip.destinations[0]?.storage_path ?? undefined}
          onSelected={async url => {
            setHeroImageSrc(url)
            setPickerOpen(false)
            if (trip && house) {
              try {
                const savedBrief = await upsertTripBrief(trip.id, house.id, {
                  brief_title:    briefTitle    || null,
                  brief_subtitle: briefSubtitle || null,
                  prepared_for:   preparedFor   || null,
                  hero_image_src: url,
                  logo_variant:   logoVariant   || null,
                })
                setTrip(prev => prev ? { ...prev, brief: savedBrief } : prev)
              } catch { /* silent */ }
            }
          }}
        />
      )}
    </div>
  )
}