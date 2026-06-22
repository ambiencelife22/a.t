// CalendarTab.tsx — Admin Calendar (Stage 1: read / derive).
//
// A light-surface calendar inside the dark admin. Derives entirely from the
// `calendar` mode of travel-read-trip-admin — confirmed/upcoming trips with
// their per-hotel stays. The calendar owns NO dates; it renders what the EF
// returns. No tasks yet (Stage 2/3) — this is the trip + stay milestone layer.
//
// Light surface uses the CANONICAL light-context tokens (IMMERSE.*OnLight +
// lightSurface/panelOnLight) — the same set the immerse destination sections
// render on. No new palette, no hardcoded hex. Display headers use FONTS.serif
// (Cormorant), matching those sections.
//
// Per-stay status is carried through and rendered: a `quoted` stay inside a
// `confirmed` trip shows as tentative, not flattened to firm — the UI tells the
// truth the data carries.
//
// Created: S55. Stage 1 of the Calendar + To-Do build (see CALENDAR_INTEGRATION_BRIEF).

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'

// ── Palette (canonical light-context tokens only) ─────────────────────────────
const L = {
  surface:      IMMERSE.lightSurface,        // #F6F1E8 cream page
  panel:        IMMERSE.panelOnLight,        // #FFFFFF cards
  ink:          IMMERSE.textOnLight,         // #1A1D1A
  muted:        IMMERSE.mutedOnLight,        // #5A6A5A
  line:         IMMERSE.lineOnLight,         // rgba(26,29,26,0.10)
  goldBorder:   IMMERSE.goldBorderOnLight,   // rgba(184,150,12,0.30)
  goldTint:     IMMERSE.goldTintOnLight,     // rgba(184,150,12,0.08)
  gold:         ID.gold,                     // #d8b56a accent
  serif:        FONTS.serif,
  sans:         "'Plus Jakarta Sans', sans-serif",
} as const

// ── Payload shape (verified against the live `calendar` mode) ─────────────────
type CalendarStay = {
  id:           string
  name:         string | null
  status:       string | null   // per-stay: 'confirmed' | 'quoted' | ...
  booking_type: string | null
  check_in:     string | null   // YYYY-MM-DD
  check_out:    string | null
  hotel_id:     string | null
  hotel_name:   string | null
}
type CalendarTrip = {
  id:                string
  trip_code:         string
  title:             string | null
  start_date:        string | null
  end_date:          string | null
  status_slug:       string | null   // engagement status: confirmed | paid | in_service
  primary_client_id: string | null
  stays:             CalendarStay[]
}

type ViewMode = 'month' | 'week' | 'agenda'

// ── Date helpers (local, no libs; declared not inferred) ──────────────────────
function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtISO(d: Date): string {
  const y = d.getFullYear(); const m = `${d.getMonth() + 1}`.padStart(2, '0'); const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
// Monday-first weekday index (0 = Mon ... 6 = Sun)
function mondayIndex(d: Date): number { return (d.getDay() + 6) % 7 }
function startOfWeek(d: Date): Date { return addDays(d, -mondayIndex(d)) }
function sameDay(a: Date, b: Date): boolean { return fmtISO(a) === fmtISO(b) }
function isBetween(day: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) return false
  const t = fmtISO(day)
  return t >= start && t <= end
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WD_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
function fmtRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const s = parseISO(start)
  const label = `${s.getDate()} ${MONTHS[s.getMonth()].slice(0,3)}`
  if (!end || end === start) return label
  const e = parseISO(end)
  return `${label} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0,3)}`
}

// ── Derived calendar events (trip spans + stay check-in/out milestones) ───────
type DayEvent =
  | { kind: 'trip-span';     trip: CalendarTrip; isStart: boolean; isEnd: boolean }
  | { kind: 'stay-checkin';  trip: CalendarTrip; stay: CalendarStay }
  | { kind: 'stay-checkout'; trip: CalendarTrip; stay: CalendarStay }

function eventsForDay(day: Date, trips: CalendarTrip[]): DayEvent[] {
  const out: DayEvent[] = []
  const iso = fmtISO(day)
  for (const trip of trips) {
    if (isBetween(day, trip.start_date, trip.end_date)) {
      out.push({ kind: 'trip-span', trip, isStart: iso === trip.start_date, isEnd: iso === trip.end_date })
    }
    for (const stay of trip.stays) {
      if (stay.check_in === iso)  out.push({ kind: 'stay-checkin',  trip, stay })
      if (stay.check_out === iso) out.push({ kind: 'stay-checkout', trip, stay })
    }
  }
  return out
}

// ── Status presentation (engagement slug → human label) ───────────────────────
const SLUG_LABEL: Record<string, string> = {
  confirmed: 'Confirmed', paid: 'Paid', in_service: 'In service',
}
function tripStatusLabel(slug: string | null): string {
  return slug ? (SLUG_LABEL[slug] ?? slug) : '—'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CalendarTab() {
  const [trips,   setTrips]   = useState<CalendarTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [view,    setView]    = useState<ViewMode>('month')
  const [cursor,  setCursor]  = useState<Date>(() => new Date()) // anchor month/week
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  // Fetch confirmed/upcoming trips + stays from the canonical EF mode.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      const { data, error } = await supabase.functions.invoke('travel-read-trip-admin', {
        body: { mode: 'calendar' },
      })
      if (cancelled) return
      if (error) { setError('Could not load the calendar. Try again.'); setLoading(false); return }
      const rows = (data?.trips ?? []) as CalendarTrip[]
      setTrips(rows)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const selectedTrip = useMemo(
    () => trips.find(t => t.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  )

  // ── Header / navigation ─────────────────────────────────────────────────────
  const headingTitle = useMemo(() => {
    if (view === 'agenda') return 'Upcoming'
    if (view === 'week') {
      const ws = startOfWeek(cursor)
      const we = addDays(ws, 6)
      return `${ws.getDate()} ${MONTHS[ws.getMonth()].slice(0,3)} – ${we.getDate()} ${MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
  }, [view, cursor])

  function nav(dir: -1 | 1) {
    if (view === 'month') setCursor(c => new Date(c.getFullYear(), c.getMonth() + dir, 1))
    else if (view === 'week') setCursor(c => addDays(c, dir * 7))
    // agenda has no paging — it's a forward list
  }
  function goToday() { setCursor(new Date()) }

  return (
    <div style={{ background: L.surface, color: L.ink, fontFamily: L.sans,
                  borderRadius: ID.radiusLg, border: `1px solid ${L.line}`,
                  padding: 'clamp(18px, 3vw, 28px)', minHeight: 600 }}>

      {/* Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11,
                        fontWeight: 700, color: L.muted, marginBottom: 8 }}>
            Confirmed and upcoming
          </div>
          <h1 style={{ margin: 0, fontFamily: L.serif, fontWeight: 500, fontSize: 'clamp(28px, 4vw, 40px)',
                       lineHeight: 1.05, letterSpacing: '-0.01em', color: L.ink }}>
            {headingTitle}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {view !== 'agenda' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <NavBtn label="‹" onClick={() => nav(-1)} />
              <NavBtn label="Today" onClick={goToday} wide />
              <NavBtn label="›" onClick={() => nav(1)} />
            </div>
          )}
          <Segmented view={view} onChange={setView} />
        </div>
      </div>

      {/* Body */}
      {loading && <Centered>Loading the calendar…</Centered>}
      {error && !loading && <Centered tone="danger">{error}</Centered>}
      {!loading && !error && trips.length === 0 && (
        <Centered>No confirmed trips ahead. Confirmed engagements with upcoming dates appear here.</Centered>
      )}

      {!loading && !error && trips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedTrip ? 'minmax(0,1fr) 320px' : '1fr',
                      gap: 18, alignItems: 'start' }}>
          <div>
            {view === 'month'  && <MonthView  cursor={cursor} trips={trips} onSelect={setSelectedTripId} />}
            {view === 'week'   && <WeekView   cursor={cursor} trips={trips} onSelect={setSelectedTripId} />}
            {view === 'agenda' && <AgendaView trips={trips} onSelect={setSelectedTripId} />}
          </div>
          {selectedTrip && (
            <TripPanel trip={selectedTrip} onClose={() => setSelectedTripId(null)} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Controls ──────────────────────────────────────────────────────────────────
function NavBtn({ label, onClick, wide }: { label: string; onClick: () => void; wide?: boolean }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer', fontFamily: L.sans, fontWeight: 650, fontSize: 13,
      color: L.ink, background: L.panel, border: `1px solid ${L.line}`,
      borderRadius: 999, padding: wide ? '8px 14px' : '8px 12px', minWidth: wide ? 0 : 34,
    }}>{label}</button>
  )
}

function Segmented({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: ViewMode[] = ['month', 'week', 'agenda']
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999,
                  background: L.goldTint, border: `1px solid ${L.line}` }}>
      {opts.map(o => {
        const active = o === view
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: L.sans, fontWeight: 700, fontSize: 12,
            textTransform: 'capitalize', padding: '7px 13px', borderRadius: 999, border: 'none',
            color: active ? L.ink : L.muted,
            background: active ? L.panel : 'transparent',
            boxShadow: active ? '0 6px 14px rgba(26,29,26,0.08)' : 'none',
          }}>{o}</button>
        )
      })}
    </div>
  )
}

function Centered({ children, tone }: { children: React.ReactNode; tone?: 'danger' }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 280, textAlign: 'center',
                  color: tone === 'danger' ? IMMERSE.danger : L.muted, fontSize: 14, padding: 24,
                  fontFamily: L.sans, lineHeight: 1.5 }}>
      <div style={{ maxWidth: 360 }}>{children}</div>
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────
function MonthView({ cursor, trips, onSelect }: { cursor: Date; trips: CalendarTrip[]; onSelect: (id: string) => void }) {
  const first = startOfMonth(cursor)
  const last  = endOfMonth(cursor)
  const gridStart = startOfWeek(first)
  const days: Date[] = []
  for (let d = new Date(gridStart); d <= last || mondayIndex(d) !== 0; d = addDays(d, 1)) {
    days.push(new Date(d))
    if (days.length > 42) break
  }
  const today = new Date()

  return (
    <div style={{ border: `1px solid ${L.line}`, borderRadius: ID.radiusMd, overflow: 'hidden', background: L.panel }}>
      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))',
                    borderBottom: `1px solid ${L.line}`, background: L.goldTint }}>
        {WD_SHORT.map(w => (
          <div key={w} style={{ padding: '10px 12px', textAlign: 'right', textTransform: 'uppercase',
                                letterSpacing: '0.12em', fontSize: 10, fontWeight: 700, color: L.muted }}>{w}</div>
        ))}
      </div>
      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
        {days.map((day, i) => {
          const inMonth = day.getMonth() === cursor.getMonth()
          const isToday = sameDay(day, today)
          const evs = eventsForDay(day, trips)
          return (
            <div key={i} style={{
              minHeight: 112, padding: '10px 9px 8px',
              borderRight: (i % 7 !== 6) ? `1px solid ${L.line}` : 'none',
              borderBottom: `1px solid ${L.line}`,
              background: inMonth ? L.panel : L.surface,
              opacity: inMonth ? 1 : 0.55,
            }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: isToday ? L.panel : L.muted,
                  background: isToday ? L.ink : 'transparent',
                  width: 24, height: 24, borderRadius: '50%', display: 'inline-grid', placeItems: 'center',
                }}>{day.getDate()}</span>
              </div>
              {evs.slice(0, 3).map((ev, j) => <DayChip key={j} ev={ev} onSelect={onSelect} />)}
              {evs.length > 3 && (
                <div style={{ fontSize: 10, color: L.muted, marginTop: 3, fontWeight: 600 }}>
                  +{evs.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayChip({ ev, onSelect }: { ev: DayEvent; onSelect: (id: string) => void }) {
  const base = {
    display: 'block', width: '100%', textAlign: 'left' as const, cursor: 'pointer',
    border: '1px solid transparent', borderRadius: 999, padding: '4px 8px', margin: '3px 0',
    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const, overflow: 'hidden',
    textOverflow: 'ellipsis', fontFamily: L.sans,
  }
  if (ev.kind === 'trip-span') {
    const label = ev.trip.title || ev.trip.trip_code
    return (
      <button onClick={() => onSelect(ev.trip.id)} title={label}
        style={{ ...base, background: L.goldTint, color: '#6f5528', borderColor: L.goldBorder }}>
        {ev.isStart ? label : (ev.isEnd ? `${label} ·ends` : '·')}
      </button>
    )
  }
  // stay milestone — tentative (quoted) renders distinct from firm
  const tentative = (ev.stay.status ?? '') !== 'confirmed'
  const hotel = ev.stay.hotel_name || ev.stay.name || 'Stay'
  const verb = ev.kind === 'stay-checkin' ? 'Check-in' : 'Check-out'
  return (
    <button onClick={() => onSelect(ev.trip.id)} title={`${verb}: ${hotel}${tentative ? ' (tentative)' : ''}`}
      style={{
        ...base,
        background: L.panel,
        color: L.ink,
        borderColor: L.line,
        borderStyle: tentative ? 'dashed' : 'solid',
        opacity: tentative ? 0.78 : 1,
      }}>
      <span style={{ color: L.gold }}>•</span> {verb} · {hotel}
    </button>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ cursor, trips, onSelect }: { cursor: Date; trips: CalendarTrip[]; onSelect: (id: string) => void }) {
  const ws = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const today = new Date()
  return (
    <div style={{ border: `1px solid ${L.line}`, borderRadius: ID.radiusMd, overflow: 'hidden', background: L.panel }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          const evs = eventsForDay(day, trips)
          return (
            <div key={i} style={{
              minHeight: 420, padding: '12px 10px',
              borderRight: i !== 6 ? `1px solid ${L.line}` : 'none',
              background: isToday ? L.goldTint : L.panel,
            }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10,
                              fontWeight: 700, color: L.muted }}>{WD_SHORT[i]}</div>
                <div style={{ fontFamily: L.serif, fontSize: 20, fontWeight: 500,
                              color: isToday ? L.ink : L.muted }}>{day.getDate()}</div>
              </div>
              {evs.length === 0 && <div style={{ fontSize: 11, color: L.muted, opacity: 0.5 }}>—</div>}
              {evs.map((ev, j) => <WeekEvent key={j} ev={ev} onSelect={onSelect} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekEvent({ ev, onSelect }: { ev: DayEvent; onSelect: (id: string) => void }) {
  const card = {
    display: 'block', width: '100%', textAlign: 'left' as const, cursor: 'pointer',
    borderRadius: 12, padding: '9px 10px', marginBottom: 7, fontFamily: L.sans,
    border: `1px solid ${L.line}`, background: L.panel,
  }
  if (ev.kind === 'trip-span') {
    const label = ev.trip.title || ev.trip.trip_code
    return (
      <button onClick={() => onSelect(ev.trip.id)}
        style={{ ...card, background: L.goldTint, borderColor: L.goldBorder }}>
        <strong style={{ display: 'block', fontSize: 12, color: '#6f5528' }}>{label}</strong>
        <span style={{ fontSize: 11, color: L.muted }}>
          {ev.isStart ? 'Trip begins' : ev.isEnd ? 'Trip ends' : 'In progress'}
        </span>
      </button>
    )
  }
  const tentative = (ev.stay.status ?? '') !== 'confirmed'
  const hotel = ev.stay.hotel_name || ev.stay.name || 'Stay'
  const verb = ev.kind === 'stay-checkin' ? 'Check-in' : 'Check-out'
  return (
    <button onClick={() => onSelect(ev.trip.id)}
      style={{ ...card, borderStyle: tentative ? 'dashed' : 'solid', opacity: tentative ? 0.82 : 1 }}>
      <strong style={{ display: 'block', fontSize: 12, color: L.ink }}>{verb}</strong>
      <span style={{ fontSize: 11, color: L.muted }}>{hotel}{tentative ? ' · tentative' : ''}</span>
    </button>
  )
}

// ── Agenda view ───────────────────────────────────────────────────────────────
// Forward chronological list of milestones from today: trip starts/ends + stay
// check-ins/check-outs, grouped by date.
type AgendaItem = { date: string; sort: number; node: DayEvent }

function AgendaView({ trips, onSelect }: { trips: CalendarTrip[]; onSelect: (id: string) => void }) {
  const items = useMemo(() => {
    const start = todayISO()
    const acc: AgendaItem[] = []
    for (const trip of trips) {
      if (trip.start_date && trip.start_date >= start)
        acc.push({ date: trip.start_date, sort: 0, node: { kind: 'trip-span', trip, isStart: true, isEnd: false } })
      if (trip.end_date && trip.end_date >= start)
        acc.push({ date: trip.end_date, sort: 3, node: { kind: 'trip-span', trip, isStart: false, isEnd: true } })
      for (const stay of trip.stays) {
        if (stay.check_in && stay.check_in >= start)
          acc.push({ date: stay.check_in, sort: 1, node: { kind: 'stay-checkin', trip, stay } })
        if (stay.check_out && stay.check_out >= start)
          acc.push({ date: stay.check_out, sort: 2, node: { kind: 'stay-checkout', trip, stay } })
      }
    }
    acc.sort((a, b) => a.date === b.date ? a.sort - b.sort : (a.date < b.date ? -1 : 1))
    // group by date
    const groups: { date: string; items: AgendaItem[] }[] = []
    for (const it of acc) {
      const g = groups[groups.length - 1]
      if (g && g.date === it.date) g.items.push(it)
      else groups.push({ date: it.date, items: [it] })
    }
    return groups
  }, [trips])

  if (items.length === 0) return <Centered>No upcoming milestones.</Centered>

  return (
    <div style={{ border: `1px solid ${L.line}`, borderRadius: ID.radiusMd, background: L.panel, padding: '4px 18px 18px' }}>
      {items.map((group, gi) => {
        const d = parseISO(group.date)
        return (
          <div key={gi} style={{ borderTop: gi === 0 ? 'none' : `1px solid ${L.line}`,
                                 display: 'grid', gridTemplateColumns: '92px 1fr', gap: 18, padding: '16px 0' }}>
            <div style={{ color: L.muted }}>
              <div style={{ fontFamily: L.serif, fontSize: 24, fontWeight: 500, color: L.ink, lineHeight: 1 }}>{d.getDate()}</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>
                {WD_SHORT[mondayIndex(d)]} {MONTHS[d.getMonth()].slice(0,3)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {group.items.map((it, ii) => <AgendaRow key={ii} ev={it.node} onSelect={onSelect} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgendaRow({ ev, onSelect }: { ev: DayEvent; onSelect: (id: string) => void }) {
  let timeLabel = ''; let title = ''; let sub = ''; let tone: 'trip' | 'stay' = 'stay'; let tentative = false
  if (ev.kind === 'trip-span') {
    tone = 'trip'
    timeLabel = ev.isStart ? 'Starts' : 'Ends'
    title = ev.trip.title || ev.trip.trip_code
    sub = `${tripStatusLabel(ev.trip.status_slug)} · ${fmtRange(ev.trip.start_date, ev.trip.end_date)}`
  } else {
    const hotel = ev.stay.hotel_name || ev.stay.name || 'Stay'
    timeLabel = ev.kind === 'stay-checkin' ? 'Check-in' : 'Check-out'
    title = hotel
    tentative = (ev.stay.status ?? '') !== 'confirmed'
    sub = tentative ? 'Stay · tentative (quoted)' : 'Stay · confirmed'
  }
  return (
    <button onClick={() => onSelect(ev.trip.id)} style={{
      display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 12, alignItems: 'start',
      textAlign: 'left', cursor: 'pointer', fontFamily: L.sans,
      border: `1px solid ${L.line}`, borderRadius: 14, background: L.panel, padding: '12px 14px',
      borderStyle: tentative ? 'dashed' : 'solid', opacity: tentative ? 0.85 : 1, width: '100%',
    }}>
      <span style={{ fontSize: 13, color: L.muted }}>{timeLabel}</span>
      <span>
        <strong style={{ display: 'block', fontSize: 14, color: L.ink, marginBottom: 3 }}>{title}</strong>
        <span style={{ fontSize: 12, color: L.muted }}>{sub}</span>
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: tone === 'trip' ? '#6f5528' : L.gold, alignSelf: 'center',
      }}>{tone === 'trip' ? 'Trip' : 'Stay'}</span>
    </button>
  )
}

// ── Trip side panel ───────────────────────────────────────────────────────────
function TripPanel({ trip, onClose }: { trip: CalendarTrip; onClose: () => void }) {
  return (
    <div style={{ border: `1px solid ${L.line}`, borderRadius: ID.radiusMd, background: L.panel,
                  padding: 18, position: 'sticky', top: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: 12, borderBottom: `1px solid ${L.line}`, paddingBottom: 14, marginBottom: 14 }}>
        <div>
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 10,
                        fontWeight: 700, color: L.muted, marginBottom: 6 }}>Selected trip</div>
          <h2 style={{ margin: 0, fontFamily: L.serif, fontWeight: 500, fontSize: 22, lineHeight: 1.15, color: L.ink }}>
            {trip.title || trip.trip_code}
          </h2>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: L.goldTint, border: `1px solid ${L.goldBorder}`, borderRadius: 999,
                        padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#6f5528' }}>
            {tripStatusLabel(trip.status_slug)}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          appearance: 'none', cursor: 'pointer', border: `1px solid ${L.line}`, background: L.panel,
          borderRadius: '50%', width: 30, height: 30, color: L.muted, fontSize: 16, lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Info label="Trip dates" value={fmtRange(trip.start_date, trip.end_date)} />
        <Info label="Stays" value={`${trip.stays.length}`} />
      </div>

      <div style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 10,
                    fontWeight: 700, color: L.muted, marginBottom: 8 }}>Stays</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {trip.stays.length === 0 && <div style={{ fontSize: 13, color: L.muted }}>No stays recorded.</div>}
        {trip.stays.map(stay => {
          const tentative = (stay.status ?? '') !== 'confirmed'
          return (
            <div key={stay.id} style={{ border: `1px solid ${L.line}`, borderRadius: 14, padding: 12,
                                        borderStyle: tentative ? 'dashed' : 'solid', background: L.panel }}>
              <strong style={{ display: 'block', fontSize: 14, color: L.ink, marginBottom: 4 }}>
                {stay.hotel_name || stay.name || 'Stay'}
              </strong>
              <p style={{ margin: 0, fontSize: 12, color: L.muted, lineHeight: 1.45 }}>
                {fmtRange(stay.check_in, stay.check_out)}
                {tentative ? ' · tentative (quoted)' : ' · confirmed'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Stage 2/3 placeholder — tasks land here once the task backend exists. */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${L.line}`, paddingTop: 12,
                    fontSize: 12, color: L.muted, lineHeight: 1.45 }}>
        To-do list and welcome-prep tasks appear here once task scheduling is enabled.
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${L.line}`, borderRadius: 12, padding: 11, background: L.surface }}>
      <div style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 700, color: L.muted }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 14, fontWeight: 600, color: L.ink }}>{value || '—'}</div>
    </div>
  )
}