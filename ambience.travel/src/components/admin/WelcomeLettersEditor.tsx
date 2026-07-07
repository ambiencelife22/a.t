/* WelcomeLettersEditor.tsx
 * Per-trip arrival welcome letters. ONE letter per room-guest per accommodation.
 *
 * Single-source model:
 *   - Recipients DERIVE from the trip's bookings -> rooms (guest already lives on
 *     the room as resolved_guest_name ?? guest_name). Never re-typed here.
 *   - The authored body is the only new content; stored in
 *     travel_engagement_welcome_letters keyed by (booking_id, room_id).
 *   - Letters that have no stored row yet show an empty body; first edit creates
 *     the row (upsert). A room with no letter simply has no row.
 *
 * Output: exportWelcomeLetterPdf -> one PDF, one page per guest, for the hotel
 *   to print on arrival. Grouped by accommodation in the editor; flat page list
 *   in the PDF (trip order).
 *
 * Self-contained surface: reads bookings (with _rooms) + writes letters. Mounts
 * on the trip admin surface that already has the booking list. Slots into the
 * unified trip workspace (#7) without rework.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useAdminToast } from './_adminPrimitives'
import {
  fetchTripWelcomeLetters,
  upsertTripWelcomeLetter,
  deleteTripWelcomeLetter,
} from '../../queries/queriesAdminTrip'
import type {
  DossierTrip, TripBooking, BookingRoom, TripWelcomeLetter,
} from '../../queries/queriesAdminTrip'
import { exportWelcomeLetterPdf } from '../../pdf/pdfImmerseWelcome'
import { roomGuestName } from '../../utils/utilsRoomDisplay'

// ── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

const taStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 12, lineHeight: 1.55, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '8px 10px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
  minHeight: 120, resize: 'vertical' as const,
}

// ── Row identity: a letter targets a specific room of a specific booking ──────

type LetterRow = {
  booking_id:  string
  room_id:     string
  guest_name:  string
  hotel_name:  string
  check_in:    string | null   // booking start_date — for the filename
  letter_id:   string | null
  body:        string
}

function roomGuest(r: BookingRoom): string {
  return (roomGuestName(r) ?? 'Guest').trim() || 'Guest'
}

// Bookings that are accommodations (have rooms). Flights/aux have none.
function buildRows(bookings: TripBooking[], letters: TripWelcomeLetter[]): LetterRow[] {
  const byRoom = new Map<string, TripWelcomeLetter>()
  for (const l of letters) if (l.room_id) byRoom.set(l.room_id, l)

  const rows: LetterRow[] = []
  for (const b of bookings) {
    const rooms = b._rooms ?? []
    for (const r of rooms) {
      const existing = byRoom.get(r.id) ?? null
      rows.push({
        booking_id: b.id,
        room_id:    r.id,
        guest_name: roomGuest(r),
        hotel_name: b._hotel_name ?? b.name ?? 'Accommodation',
        check_in:   b.start_date ?? null,
        letter_id:  existing?.id ?? null,
        body:       existing?.body ?? '',
      })
    }
  }
  return rows
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WelcomeLettersEditor({ trip }: { trip: DossierTrip }) {
  const { success, error } = useAdminToast()
  const [rows,    setRows]    = useState<LetterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const letters = await fetchTripWelcomeLetters(trip.id)
        if (!alive) return
        setRows(buildRows(trip.bookings ?? [], letters))
      } catch (e) {
        error(e instanceof Error ? e.message : 'Failed to load welcome letters')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [trip, error])

  // Debounced autosave per row.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const saveRow = useCallback(async (row: LetterRow, body: string) => {
    try {
      const saved = await upsertTripWelcomeLetter(trip.id, {
        ...(row.letter_id ? { id: row.letter_id } : {}),
        booking_id: row.booking_id,
        room_id:    row.room_id,
        guest_name: row.guest_name,
        body,
      })
      setRows(prev => prev.map(r => r.room_id === row.room_id ? { ...r, letter_id: saved.id, body } : r))
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to save letter')
    }
  }, [trip.id, error])

  function onBody(row: LetterRow, body: string) {
    setRows(prev => prev.map(r => r.room_id === row.room_id ? { ...r, body } : r))
    const key = row.room_id
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => saveRow({ ...row, body }, body), 600)
  }

  function onName(row: LetterRow, guest_name: string) {
    setRows(prev => prev.map(r => r.room_id === row.room_id ? { ...r, guest_name } : r))
    const key = `name:${row.room_id}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => saveRow({ ...row, guest_name }, row.body), 600)
  }

  async function saveGroup(group: LetterRow[]): Promise<void> {
    // Flush pending debounce timers, then persist every row in the group.
    for (const r of group) {
      const bk = r.room_id
      const nk = `name:${r.room_id}`
      if (timers.current[bk]) { clearTimeout(timers.current[bk]); delete timers.current[bk] }
      if (timers.current[nk]) { clearTimeout(timers.current[nk]); delete timers.current[nk] }
    }
    setSaving(group[0].booking_id)
    try {
      for (const r of group) {
        const saved = await upsertTripWelcomeLetter(trip.id, {
          ...(r.letter_id ? { id: r.letter_id } : {}),
          booking_id: r.booking_id,
          room_id:    r.room_id,
          guest_name: r.guest_name,
          body:       r.body,
        })
        setRows(prev => prev.map(x => x.room_id === r.room_id ? { ...x, letter_id: saved.id } : x))
      }
      success('Letters saved')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to save letters')
    } finally {
      setSaving(null)
    }
  }

  async function handleDownloadGroup(group: LetterRow[]) {
    await saveGroup(group)  // flush + persist before generating, so the PDF is never stale
    const recipients = group
      .filter(r => r.body.trim())
      .map(r => ({ guest_name: r.guest_name, body: r.body }))
    if (recipients.length === 0) { error('No letters written for this accommodation yet'); return }
    setDownloading(group[0].booking_id)
    try {
      await exportWelcomeLetterPdf({
        trip,
        brief:       trip.brief ?? null,
        recipients,
        accomName:   group[0].hotel_name,
        groupName:   trip.brief?.prepared_for ?? '',
        checkInDate: group[0].check_in,
      })
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 16 }}>Loading welcome letters…</div>
  }

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 16, lineHeight: 1.6 }}>
        No rooms on this trip yet. Add accommodations and rooms first — each room's
        guest becomes a welcome letter here.
      </div>
    )
  }

  // Group rows by accommodation for display.
  const byHotel = new Map<string, LetterRow[]>()
  for (const r of rows) {
    const k = `${r.booking_id}`
    if (!byHotel.has(k)) byHotel.set(k, [])
    byHotel.get(k)!.push(r)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
        Welcome Letters ({rows.length})
      </div>

      {[...byHotel.values()].map(group => (
        <div key={group[0].booking_id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{group[0].hotel_name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => saveGroup(group)}
                disabled={saving === group[0].booking_id}
                style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.text, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 12px', cursor: saving === group[0].booking_id ? 'not-allowed' : 'pointer', opacity: saving === group[0].booking_id ? 0.6 : 1 }}
              >{saving === group[0].booking_id ? 'Saving…' : 'Save'}</button>
              <button
                onClick={() => handleDownloadGroup(group)}
                disabled={downloading === group[0].booking_id || saving === group[0].booking_id}
                style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: '#0F1110', background: A.gold, border: 'none', borderRadius: 6, padding: '5px 12px', cursor: (downloading === group[0].booking_id || saving === group[0].booking_id) ? 'not-allowed' : 'pointer', opacity: (downloading === group[0].booking_id || saving === group[0].booking_id) ? 0.6 : 1 }}
              >{downloading === group[0].booking_id ? 'Generating…' : 'Download'}</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.map(row => (
              <div key={row.room_id}>
                <label style={labelStyle}>Recipient name (filename only — not the greeting)</label>
                <input
                  style={{ fontFamily: A.font, fontSize: 12, color: A.text, background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: '6px 10px', width: '100%', boxSizing: 'border-box', outline: 'none', marginBottom: 6 }}
                  value={row.guest_name}
                  onChange={e => onName(row, e.target.value)}
                  placeholder='Guest name'
                />
                <label style={labelStyle}>Letter — write the full text including the greeting (Dear / Greetings / Welcome…). Use {'{{guest_name}}'} to insert the name.</label>
                <textarea
                  style={taStyle}
                  value={row.body}
                  onChange={e => onBody(row, e.target.value)}
                  placeholder={'Dear ' + (row.guest_name || '{{guest_name}}') + ',\n\nWelcome to ' + group[0].hotel_name + '!\n\nI hope you arrived well...\n\nMy best,\nDeron'}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}