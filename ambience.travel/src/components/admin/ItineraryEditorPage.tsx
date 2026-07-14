/* ItineraryEditorPage.tsx
 * Dedicated full-page itinerary editor for a single trip.
 * Route: #admin/trips/{journeyId}/itinerary
 *
 * Layout:
 *   - Cream background — matches Brief Editor aesthetic
 *   - Top bar: back button + trip code + Save All + Download PDF
 *   - Left panel (42%): day-by-day accordion editor
 *     - Each day: show/hide toggle, day label override, day note override
 *     - Each entry: time, title, subtitle, category, booked_by, guest_label, notes
 *     - Add entry per day, delete entry
 *   - Right panel (58%): live HTML preview, debounced 300ms
 *
 * Days: derived from the trip span (start_date..end_date) by the read EF.
 *   travel_journey_days is overlay-only (show / day_label / day_note). Editing a
 *   day creates its overlay row on first change (upsert keyed by entry_date).
 *
 * Empty days: always shown with "No plans today" unless day_note overrides.
 *   Admin can hide individual days via show toggle.
 *
 * Last updated: S48 — useProgrammeDownload wired. "Download PDF" button added
 *   to top bar. Disabled when days.length === 0 (pre-derive state).
 * Prior: S45 — initial ship.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { fmtTime, formatDateWeekday } from '../../utils/utilsDates'
import {
  fetchJourneyDossierForHouse,
  fetchJourneyDays,
  fetchJourneyDayEntries,
  upsertJourneyDay,
  createJourneyDayEntry,
  updateJourneyDayEntry,
  deleteJourneyDayEntry,
} from '../../queries/queriesAdminJourney'
import type {
  DossierJourney,
  HouseProfile,
  JourneyDay,
  JourneyDayEntry,
  JourneyDayPatch,
  JourneyDayEntryPatch,
} from '../../queries/queriesAdminJourney'
import { supabase } from '../../lib/supabase'
import { useImmerseProgrammePdf } from '../../hooks/useImmerseProgrammePdf'
import type { TimelineItem } from '../../types/typesTimeline'

const PROGRAMME_FN      = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/travel-get-engagement-programme`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ── Constants ─────────────────────────────────────────────────────────────────

const CREAM    = '#F7F5F0'
const CREAM2   = '#EDE9E2'
const INK      = '#1A1D1A'
const GOLD     = '#B49050'
const MUTED    = '#787060'
const FAINT    = '#B4AFA5'
const RULE     = '#DCDBD5'
const CARD_BG  = '#F0EDE6'

const CATEGORIES = ['Flight', 'Transfer', 'Hotel', 'Dining', 'Experience', 'Leisure', 'Note', 'Other']
const BOOKED_BY  = ['ambience', 'self', 'tbc']

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: INK,
  background: 'rgba(255,255,255,0.6)', border: `1px solid ${RULE}`,
  borderRadius: 5, padding: '4px 7px', width: '100%',
  boxSizing: 'border-box' as const, outline: 'none',
}

const labelSt: React.CSSProperties = {
  fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: FAINT,
  fontFamily: A.font, marginBottom: 2, display: 'block',
}

const btnBase: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, fontWeight: 600,
  letterSpacing: '0.04em', borderRadius: 6,
  padding: '5px 14px', cursor: 'pointer',
  transition: 'all 150ms ease', border: 'none',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveHouseIdForTrip(journeyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('travel_bookings')
    .select('house_id')
    .eq('journey_id', journeyId)
    .not('house_id', 'is', null)
    .limit(1)
    .single()
  return data?.house_id ?? null
}

function categoryIcon(cat: string | null): string {
  const map: Record<string, string> = {
    Flight: '✈', Transfer: '🚗', Hotel: '🏨',
    Dining: '🍽', Experience: '⭐', Leisure: '☀',
    Note: '📝', Other: '·',
  }
  return map[cat ?? ''] ?? '·'
}

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    Flight: '#93c5fd', Transfer: '#a3e635', Hotel: GOLD,
    Dining: '#f9a8d4', Experience: '#c4b5fd', Leisure: '#6ee7b7',
    Note: FAINT, Other: FAINT,
  }
  return map[cat ?? ''] ?? FAINT
}

// ── EntryRow ──────────────────────────────────────────────────────────────────

function EntryRow({ entry, onUpdate, onDelete }: {
  entry:    JourneyDayEntry
  onUpdate: (id: string, patch: JourneyDayEntryPatch) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try { await deleteJourneyDayEntry(entry.id); onDelete(entry.id) }
    catch { setDeleting(false) }
  }

  function field(label: string, node: React.ReactNode) {
    return (
      <div>
        <label style={labelSt}>{label}</label>
        {node}
      </div>
    )
  }

  const accentColor = categoryColor(entry.category)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.5)', borderRadius: 7,
      border: `1px solid ${RULE}`, borderLeft: `3px solid ${accentColor}`,
      overflow: 'hidden', marginBottom: 5,
    }}>
      {/* Summary row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>{categoryIcon(entry.category)}</span>
        {entry.start_time && (
          <span style={{ fontSize: 9, color: GOLD, fontFamily: 'DM Mono, monospace', fontWeight: 700, flexShrink: 0 }}>
            {fmtTime(entry.start_time)}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 600, color: INK, fontFamily: A.font, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.title}
        </span>
        {entry.is_auto_derived && (
          <span style={{ fontSize: 8, color: FAINT, fontFamily: A.font, flexShrink: 0, background: CARD_BG, padding: '1px 5px', borderRadius: 3 }}>auto</span>
        )}
        {entry.booked_by === 'self' && (
          <span style={{ fontSize: 8, color: FAINT, fontFamily: A.font, flexShrink: 0 }}>self</span>
        )}
        <span style={{ fontSize: 10, color: FAINT, flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 150ms' }}>›</span>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${RULE}` }}>
          <div style={{ paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {field('Title',
              <input style={inputStyle} value={entry.title}
                onChange={e => onUpdate(entry.id, { title: e.target.value })}
                onBlur={e => updateJourneyDayEntry(entry.id, { title: e.target.value })}
              />
            )}
            {field('Subtitle',
              <input style={inputStyle} value={entry.subtitle ?? ''}
                onChange={e => onUpdate(entry.id, { subtitle: e.target.value })}
                onBlur={e => updateJourneyDayEntry(entry.id, { subtitle: e.target.value || null })}
                placeholder='Optional'
              />
            )}
            {field('Start Time',
              <input style={inputStyle} type='time' value={entry.start_time?.slice(0,5) ?? ''}
                onChange={e => onUpdate(entry.id, { start_time: e.target.value || null })}
                onBlur={e => updateJourneyDayEntry(entry.id, { start_time: e.target.value || null })}
              />
            )}
            {field('End Time',
              <input style={inputStyle} type='time' value={entry.end_time?.slice(0,5) ?? ''}
                onChange={e => onUpdate(entry.id, { end_time: e.target.value || null })}
                onBlur={e => updateJourneyDayEntry(entry.id, { end_time: e.target.value || null })}
              />
            )}
            {field('Category',
              <select style={inputStyle} value={entry.category ?? ''}
                onChange={e => { onUpdate(entry.id, { category: e.target.value || null }); updateJourneyDayEntry(entry.id, { category: e.target.value || null }) }}
              >
                <option value=''>—</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {field('Booked By',
              <select style={inputStyle} value={entry.booked_by}
                onChange={e => { onUpdate(entry.id, { booked_by: e.target.value }); updateJourneyDayEntry(entry.id, { booked_by: e.target.value }) }}
              >
                {BOOKED_BY.map(b => <option key={b} value={b}>{b === 'ambience' ? 'Booked by ambience' : b === 'self' ? 'Self-arranged' : 'TBC'}</option>)}
              </select>
            )}
            {field('Guest',
              <input style={inputStyle} value={entry.guest_label ?? ''}
                onChange={e => onUpdate(entry.id, { guest_label: e.target.value })}
                onBlur={e => updateJourneyDayEntry(entry.id, { guest_label: e.target.value || null })}
                placeholder='All guests'
              />
            )}
            {field('Confirmation #',
              <input style={inputStyle} value={entry.confirmation_number ?? ''}
                onChange={e => onUpdate(entry.id, { confirmation_number: e.target.value })}
                onBlur={e => updateJourneyDayEntry(entry.id, { confirmation_number: e.target.value || null })}
              />
            )}
          </div>
          {field('Notes',
            <input style={inputStyle} value={entry.notes ?? ''}
              onChange={e => onUpdate(entry.id, { notes: e.target.value })}
              onBlur={e => updateJourneyDayEntry(entry.id, { notes: e.target.value || null })}
              placeholder='Optional note for this entry'
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              onClick={handleDelete} disabled={deleting}
              style={{ fontFamily: A.font, fontSize: 10, color: '#f87171', background: 'transparent', border: '1px solid #f8717130', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}
            >{deleting ? '...' : 'Remove Entry'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DayBlock ──────────────────────────────────────────────────────────────────

function DayBlock({ day, entries, onDayUpdate, onEntryUpdate, onEntryDelete, onEntryAdd, journeyId }: {
  day:           JourneyDay
  entries:       JourneyDayEntry[]
  onDayUpdate:   (entryDate: string, patch: JourneyDayPatch) => void
  onEntryUpdate: (id: string, patch: JourneyDayEntryPatch) => void
  onEntryDelete: (id: string) => void
  onEntryAdd:    (entry: JourneyDayEntry) => void
  journeyId:        string
}) {
  const [expanded, setExpanded] = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCat,   setNewCat]   = useState('Leisure')

  async function handleAddEntry() {
    if (!newTitle.trim()) return
    const entry = await createJourneyDayEntry(journeyId, {
      entry_date:          day.entry_date,
      start_time:          null,
      end_time:            null,
      title:               newTitle.trim(),
      subtitle:            null,
      category:            newCat || null,
      booked_by:           'ambience',
      confirmation_number: null,
      guest_label:         null,
      notes:               null,
      brief_show:          true,
      sort_order:          entries.length * 10,
      is_auto_derived:     false,
      source_booking_id:   null,
      source_aux_id:       null,
      journey_id:             journeyId,
    })
    onEntryAdd(entry)
    setNewTitle('')
    setAdding(false)
  }

  const dayLabel = day.day_label || formatDateWeekday(day.entry_date)

  return (
    <div style={{
      background: day.show ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.04)',
      borderRadius: 10, border: `1px solid ${day.show ? RULE : 'transparent'}`,
      marginBottom: 8, overflow: 'hidden',
      opacity: day.show ? 1 : 0.5,
    }}>
      {/* Day header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: expanded ? `1px solid ${RULE}` : 'none' }}>
        {/* Show/hide toggle */}
        <button
          onClick={() => { onDayUpdate(day.entry_date, { show: !day.show }); upsertJourneyDay(journeyId, day.entry_date, { show: !day.show }) }}
          style={{ fontFamily: A.font, fontSize: 9, color: day.show ? GOLD : FAINT, background: 'transparent', border: `1px solid ${day.show ? GOLD + '50' : RULE}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer', flexShrink: 0 }}
        >{day.show ? 'Shown' : 'Hidden'}</button>

        <div onClick={() => setExpanded(e => !e)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: A.font }}>{dayLabel}</span>
          <span style={{ fontSize: 10, color: FAINT, fontFamily: A.font }}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>

        <span style={{ fontSize: 12, color: FAINT, cursor: 'pointer', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }} onClick={() => setExpanded(e => !e)}>›</span>
      </div>

      {expanded && (
        <div style={{ padding: '10px 12px' }}>
          {/* Day label + note overrides */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Day Label Override</label>
              <input
                style={inputStyle} value={day.day_label ?? ''}
                onChange={e => onDayUpdate(day.entry_date, { day_label: e.target.value })}
                onBlur={e => upsertJourneyDay(journeyId, day.entry_date, { day_label: e.target.value || null })}
                placeholder={formatDateWeekday(day.entry_date)}
              />
            </div>
            <div>
              <label style={labelSt}>Empty Day Note</label>
              <input
                style={inputStyle} value={day.day_note ?? ''}
                onChange={e => onDayUpdate(day.entry_date, { day_note: e.target.value })}
                onBlur={e => upsertJourneyDay(journeyId, day.entry_date, { day_note: e.target.value || null })}
                placeholder='No plans today'
              />
            </div>
          </div>

          {/* Entries */}
          {entries.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onUpdate={onEntryUpdate}
              onDelete={onEntryDelete}
            />
          ))}

          {/* Add entry */}
          {adding ? (
            <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 7, border: `1px solid ${RULE}`, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
                placeholder='Entry title...'
                autoFocus
              />
              <select style={{ ...inputStyle, width: 'auto' }} value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={handleAddEntry} style={{ ...btnBase, background: INK, color: CREAM, padding: '4px 10px', fontSize: 10 }}>Add</button>
              <button onClick={() => setAdding(false)} style={{ ...btnBase, background: 'transparent', color: FAINT, border: `1px solid ${RULE}`, padding: '4px 10px', fontSize: 10 }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: GOLD, background: 'transparent', border: `1px dashed ${GOLD}50`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', width: '100%', marginTop: 4, textAlign: 'center' as const }}
            >+ Add Entry</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── ItineraryPreview ──────────────────────────────────────────────────────────

function ItineraryPreview({ days, entriesByDate, trip, house }: {
  days:           JourneyDay[]
  entriesByDate:  Record<string, TimelineItem[]>
  trip:           DossierJourney
  house:          HouseProfile | null
}) {
  const visibleDays = days.filter(d => d.show)
  const destName    = trip.destinations[0]?.name ?? trip.journey_code
  const preparedFor = house?.display_name ?? ''

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: INK, background: CREAM, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ background: INK, padding: '28px 28px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <img src='/emblem.png' alt='' style={{ width: 28, height: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          <img src='/ambience_travel.svg' alt='ambience' style={{ height: 14, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 400, color: '#F7F5F0', lineHeight: 1.2, marginBottom: 6 }}>{destName}</div>
        <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', marginBottom: 4 }}>DAILY PROGRAMME</div>
        {preparedFor && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(247,245,240,0.6)' }}>Prepared for {preparedFor}</div>}
      </div>

      {/* Days */}
      <div style={{ padding: '0 0 32px' }}>
        {visibleDays.map((day, idx) => {
          const entries = (entriesByDate[day.entry_date] ?? []).filter(e => e.brief_show)
          const dayLabel = day.day_label || formatDateWeekday(day.entry_date)

          return (
            <div key={day.entry_date}>
              {/* Day header */}
              <div style={{ padding: '20px 24px 10px', borderBottom: `1px solid ${RULE}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.12em' }}>DAY {idx + 1}</span>
                  <span style={{ fontSize: 16, fontWeight: 400, color: INK }}>{dayLabel}</span>
                </div>
              </div>

              {/* Entries */}
              {entries.length === 0 ? (
                <div style={{ padding: '14px 24px', fontSize: 11, fontStyle: 'italic', color: FAINT, fontFamily: A.font }}>
                  {day.day_note || 'No plans today'}
                </div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {entries.map(entry => {
                    const accentColor = categoryColor(entry.category)
                    const isAmbience  = entry.booked_by === 'ambience'
                    return (
                      <div key={entry.id} style={{ display: 'flex', gap: 0, padding: '6px 24px', alignItems: 'flex-start' }}>
                        {/* Time column */}
                        <div style={{ width: 60, flexShrink: 0, paddingTop: 1 }}>
                          {entry.start_time && (
                            <span style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD }}>
                              {fmtTime(entry.start_time)}
                            </span>
                          )}
                        </div>
                        {/* Accent dot */}
                        <div style={{ width: 8, flexShrink: 0, paddingTop: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, paddingLeft: 10, paddingBottom: 8, borderBottom: `1px solid ${RULE}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 400, color: INK }}>{entry.title}</span>
                            {!isAmbience && (
                              <span style={{ fontSize: 8, fontFamily: A.font, color: FAINT, flexShrink: 0, background: CARD_BG, padding: '1px 6px', borderRadius: 3 }}>
                                {entry.booked_by === 'self' ? 'Self-arranged' : 'TBC'}
                              </span>
                            )}
                          </div>
                          {entry.subtitle && (
                            <div style={{ fontSize: 10, fontFamily: A.font, color: MUTED }}>{entry.subtitle}</div>
                          )}
                          {entry.guest_label && (
                            <div style={{ fontSize: 9, fontFamily: A.font, color: FAINT, fontStyle: 'italic', marginTop: 2 }}>{entry.guest_label}</div>
                          )}
                          {entry.confirmation_number && (
                            <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', color: GOLD, marginTop: 2 }}>#{entry.confirmation_number}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${RULE}`, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src='/ambience_travel.svg' alt='ambience' style={{ height: 10, opacity: 0.4 }} />
        <span style={{ fontSize: 8, fontFamily: A.font, color: FAINT, letterSpacing: '0.1em' }}>
          PRIVATE TRAVEL DESIGN · TAILORED SUPPORT · SEAMLESS EXECUTION
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ItineraryEditorPage({ journeyId }: { journeyId: string }) {
  const [trip,     setTrip]     = useState<DossierJourney | null>(null)
  const [house,    setHouse]    = useState<HouseProfile | null>(null)
  const [days,     setDays]     = useState<JourneyDay[]>([])
  const [entries,  setEntries]  = useState<JourneyDayEntry[]>([])
  const [loadErr,  setLoadErr]  = useState<string | null>(null)

  const { pdfReady, pdfDownloading, handleDownloadProgramme } = useImmerseProgrammePdf()
  const [exportBranding, setExportBranding] = useState<'ambience' | 'alfaone' | 'unbranded'>('ambience')

  // Canonical programme timeline — the SAME EF the guest reads (travel-get-trip-
  // programme via _shared/timeline.ts). The admin must NOT rebuild the programme
  // from stored day-entries (that table holds only standalone overlay rows, not
  // the derived check-ins/flights/dining). One source for "what's in the
  // programme": the EF. Stored day_entries remain for overlay EDITING only.
  const [timelineEntries, setTimelineEntries] = useState<TimelineItem[]>([])
  const [timelineDays,    setTimelineDays]    = useState<JourneyDay[] | null>(null)

  useEffect(() => {
    async function load() {
      const houseId = await resolveHouseIdForTrip(journeyId)
      if (!houseId) { setLoadErr('No house linked to this trip.'); return }

      const [dossier, daysData, entriesData] = await Promise.all([
        fetchJourneyDossierForHouse(houseId),
        fetchJourneyDays(journeyId),
        fetchJourneyDayEntries(journeyId),
      ])

      const found = dossier.engagements.find(t => t.id === journeyId)
      if (!found) { setLoadErr('Trip not found.'); return }

      setTrip(found)
      setHouse(dossier.house)
      setDays(daysData)
      setEntries(entriesData)
    }
    load().catch(err => setLoadErr(err instanceof Error ? err.message : 'Load failed'))
  }, [journeyId])

  // Pull the canonical programme timeline from the guest EF once we know url_id.
  useEffect(() => {
    const urlId = trip?.url_id
    if (!urlId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(PROGRAMME_FN, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body:    JSON.stringify({ url_id: urlId }),
        })
        if (!res.ok) return
        const payload = await res.json()
        if (cancelled) return
        setTimelineEntries((payload?.entries as TimelineItem[]) ?? [])
        setTimelineDays((payload?.days as JourneyDay[]) ?? null)
      } catch { /* preview falls back to stored entries */ }
    })()
    return () => { cancelled = true }
  }, [trip?.url_id])

  function updateDayLocal(entryDate: string, patch: JourneyDayPatch) {
    setDays(prev => prev.map(d => d.entry_date === entryDate ? { ...d, ...patch } : d))
  }

  function updateEntryLocal(id: string, patch: JourneyDayEntryPatch) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } as JourneyDayEntry : e))
  }

  function deleteEntryLocal(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function addEntryLocal(entry: JourneyDayEntry) {
    setEntries(prev => [...prev, entry])
  }

  // Overlay entries (stored day_entries) — used ONLY by the left-panel editor
  // for standalone-entry CRUD. NOT the programme content source.
  const overlayByDate: Record<string, JourneyDayEntry[]> = {}
  for (const e of entries) {
    if (!overlayByDate[e.entry_date]) overlayByDate[e.entry_date] = []
    overlayByDate[e.entry_date].push(e)
  }

  // Programme content — the canonical EF timeline (same as guest). Preview +
  // export read this. Empty until the EF fetch resolves.
  const entriesByDate: Record<string, TimelineItem[]> = {}
  for (const e of timelineEntries) {
    if (!entriesByDate[e.entry_date]) entriesByDate[e.entry_date] = []
    entriesByDate[e.entry_date].push(e)
  }

  // Debounced preview
  const [previewKey, setPreviewKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedulePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setPreviewKey(k => k + 1), 300)
  }, [])
  useEffect(() => { schedulePreview() }, [days, entries, timelineEntries, schedulePreview])

  if (loadErr) {
    return (
      <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#f87171', fontFamily: A.font }}>{loadErr}</div>
        <button onClick={() => navigateAdmin({ product: 'house', tab: 'houses' })} style={{ ...btnBase, background: A.bgCard, color: A.gold, border: `1px solid ${A.border}` }}>
          ← Back to Houses
        </button>
      </div>
    )
  }

  if (!trip) {
    return (
      <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading itinerary…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: A.font, color: INK }}>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#EDE9E2', borderBottom: `1px solid ${RULE}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', height: 50 }}>
        <button
          onClick={() => navigateAdmin({ product: 'house', tab: 'houses' })}
          style={{ ...btnBase, background: 'transparent', color: MUTED, border: `1px solid ${RULE}`, padding: '4px 10px', fontSize: 10 }}
        >← Houses</button>
        <button
          onClick={() => navigateAdmin({ product: 'trips', tab: 'brief', journeyId })}
          style={{ ...btnBase, background: 'transparent', color: MUTED, border: `1px solid ${RULE}`, padding: '4px 10px', fontSize: 10 }}
        >Brief</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK }}>{trip.journey_code}</span>
          <span style={{ fontSize: 10, color: MUTED }}>Daily Programme</span>
        </div>
        <select
          value={exportBranding}
          onChange={e => setExportBranding(e.target.value as 'ambience' | 'alfaone' | 'unbranded')}
          title='Export branding (admin only — guest always sees ambience)'
          style={{ ...inputStyle, width: 'auto', fontSize: 10, padding: '4px 8px' }}
        >
          <option value='ambience'>ambience</option>
          <option value='alfaone'>AlfaOne</option>
          <option value='unbranded'>Unbranded</option>
        </select>
        <button
          onClick={() => handleDownloadProgramme({ journey: trip, brief: trip.brief ?? null, house, days: timelineDays ?? days, entriesByDate, links: [], guestDisplayName: null }, exportBranding)}
          disabled={!pdfReady || pdfDownloading || days.length === 0}
          style={{
            ...btnBase,
            background: 'transparent',
            color:   pdfReady && !pdfDownloading && days.length > 0 ? GOLD  : MUTED,
            border:  `1px solid ${pdfReady && !pdfDownloading && days.length > 0 ? GOLD + '60' : RULE}`,
            opacity: days.length === 0 ? 0.4 : 1,
            cursor:  pdfReady && !pdfDownloading && days.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >{pdfDownloading ? 'Generating...' : 'Download PDF'}</button>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 50px)' }}>

        {/* Editor panel */}
        <div style={{ width: '42%', flexShrink: 0, borderRight: `1px solid ${RULE}`, overflowY: 'auto', background: CREAM2, padding: 20 }}>
          {days.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 8 }}>No days yet</div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 24, lineHeight: 1.6 }}>
                Set the trip's start and end dates on the Brief,<br />and the days will appear here automatically.
              </div>
            </div>
          ) : (
            days.map(day => (
              <DayBlock
                key={day.entry_date}
                day={day}
                entries={(overlayByDate[day.entry_date] ?? []).sort((a, b) => a.sort_order - b.sort_order)}
                onDayUpdate={updateDayLocal}
                onEntryUpdate={updateEntryLocal}
                onEntryDelete={deleteEntryLocal}
                onEntryAdd={addEntryLocal}
                journeyId={journeyId}
              />
            ))
          )}
        </div>

        {/* Preview panel */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#E8E4DC' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${RULE}`, background: '#DDD9D1' }}>
            <span style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live Preview</span>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ maxWidth: 520, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: 4, overflow: 'hidden' }}>
              <ItineraryPreview
                key={previewKey}
                days={timelineDays ?? days}
                entriesByDate={entriesByDate}
                trip={trip}
                house={house}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}