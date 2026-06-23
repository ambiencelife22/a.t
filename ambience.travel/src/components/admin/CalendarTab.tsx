// CalendarTab.tsx — Admin Calendar (Stage 1, rebuilt S55 for span integrity).
//
// Derives entirely from the `calendar` mode of travel-read-trip-admin — confirmed/
// upcoming trips + stays. The calendar owns NO dates; it renders what the EF returns.
//
// S55 rebuild — span integrity (live clients travelling; this is an ops surface):
//   - Month view uses WEEK-SEGMENTED SPANNING BARS: a trip is one continuous band
//     across the days it covers, name shown once, clamped to each week row and
//     resumed on the next (multi-week trips like the Alps Jul19–Aug2 segment).
//   - Stays render as check-in / check-out markers under the trip bands.
//   - Week view: clear stacked event list per day.
//   - Tooltip always carries the full text; bars ellipsis when narrow.
//
// Light surface = canonical light-context tokens (IMMERSE.*OnLight + lightSurface/
// panelOnLight) + ID.gold + FONTS.serif. No new palette, no hardcoded hex.
// Per-stay status carried through: a quoted stay renders tentative, not flattened.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'

const L = {
  surface: IMMERSE.lightSurface, panel: IMMERSE.panelOnLight, ink: IMMERSE.textOnLight,
  muted: IMMERSE.mutedOnLight, line: IMMERSE.lineOnLight, goldBorder: IMMERSE.goldBorderOnLight,
  goldTint: IMMERSE.goldTintOnLight, gold: ID.gold, serif: FONTS.serif,
  sans: "'Plus Jakarta Sans', sans-serif", band: '#6f5528',
} as const

type CalendarStay = {
  id: string; name: string | null; status: string | null; booking_type: string | null
  check_in: string | null; check_out: string | null; hotel_id: string | null; hotel_name: string | null
}
type CalendarTrip = {
  id: string; trip_code: string; title: string | null
  start_date: string | null; end_date: string | null
  status_slug: string | null; primary_client_id: string | null; stays: CalendarStay[]
}
type ViewMode = 'month' | 'week' | 'agenda'

function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function parseISO(s: string): Date { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
function fmtISO(d: Date): string {
  const y = d.getFullYear(); const m = `${d.getMonth()+1}`.padStart(2,'0'); const day = `${d.getDate()}`.padStart(2,'0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth()+1, 0) }
function mondayIndex(d: Date): number { return (d.getDay()+6)%7 }
function startOfWeek(d: Date): Date { return addDays(d, -mondayIndex(d)) }
function sameDay(a: Date, b: Date): boolean { return fmtISO(a) === fmtISO(b) }
function maxISO(a: string, b: string): string { return a >= b ? a : b }
function minISO(a: string, b: string): string { return a <= b ? a : b }
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WD = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
function fmtRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const s = parseISO(start); const label = `${s.getDate()} ${MONTHS[s.getMonth()].slice(0,3)}`
  if (!end || end === start) return label
  const e = parseISO(end); return `${label} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0,3)}`
}
const SLUG_LABEL: Record<string,string> = { confirmed:'Confirmed', paid:'Paid', in_service:'In service' }
function tripStatusLabel(slug: string | null): string { return slug ? (SLUG_LABEL[slug] ?? slug) : '—' }
function isTentative(stay: CalendarStay): boolean { return (stay.status ?? '') !== 'confirmed' }

export default function CalendarTab() {
  const [trips, setTrips] = useState<CalendarTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      const { data, error } = await supabase.functions.invoke('travel-read-trip-admin', { body: { mode: 'calendar' } })
      if (cancelled) return
      if (error) { setError('Could not load the calendar. Try again.'); setLoading(false); return }
      setTrips((data?.trips ?? []) as CalendarTrip[]); setLoading(false)
    }
    load(); return () => { cancelled = true }
  }, [])

  const selectedTrip = useMemo(() => trips.find(t => t.id === selectedTripId) ?? null, [trips, selectedTripId])
  const headingTitle = useMemo(() => {
    if (view === 'agenda') return 'Upcoming'
    if (view === 'week') {
      const ws = startOfWeek(cursor), we = addDays(ws, 6)
      return `${ws.getDate()} ${MONTHS[ws.getMonth()].slice(0,3)} – ${we.getDate()} ${MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
  }, [view, cursor])

  function nav(dir: -1 | 1) {
    if (view === 'month') { setCursor(c => new Date(c.getFullYear(), c.getMonth()+dir, 1)); return }
    if (view === 'week')  { setCursor(c => addDays(c, dir*7)); return }
    // agenda has no paging
  }

  return (
    <div style={{ background: L.surface, color: L.ink, fontFamily: L.sans, borderRadius: ID.radiusLg,
                  border: `1px solid ${L.line}`, padding: 'clamp(18px,3vw,28px)', minHeight: 600 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:18 }}>
        <div>
          <div style={{ textTransform:'uppercase', letterSpacing:'0.14em', fontSize:11, fontWeight:700, color:L.muted, marginBottom:8 }}>Confirmed and upcoming</div>
          <h1 style={{ margin:0, fontFamily:L.serif, fontWeight:500, fontSize:'clamp(28px,4vw,40px)', lineHeight:1.05, letterSpacing:'-0.01em', color:L.ink }}>{headingTitle}</h1>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {view !== 'agenda' && (
            <div style={{ display:'flex', gap:4 }}>
              <NavBtn label="‹" onClick={() => nav(-1)} />
              <NavBtn label="Today" onClick={() => setCursor(new Date())} wide />
              <NavBtn label="›" onClick={() => nav(1)} />
            </div>
          )}
          <Segmented view={view} onChange={setView} />
        </div>
      </div>

      {loading && <Centered>Loading the calendar…</Centered>}
      {error && !loading && <Centered tone="danger">{error}</Centered>}
      {!loading && !error && trips.length === 0 && (
        <Centered>No confirmed trips ahead. Confirmed engagements with upcoming dates appear here.</Centered>
      )}

      {!loading && !error && trips.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: selectedTrip ? 'minmax(0,1fr) 320px' : '1fr', gap:18, alignItems:'start' }}>
          <div style={{ minWidth: 0 }}>
            {view === 'month'  && <MonthView  cursor={cursor} trips={trips} onSelect={setSelectedTripId} />}
            {view === 'week'   && <WeekView   cursor={cursor} trips={trips} onSelect={setSelectedTripId} />}
            {view === 'agenda' && <AgendaView trips={trips} onSelect={setSelectedTripId} />}
          </div>
          {selectedTrip && <TripPanel trip={selectedTrip} onClose={() => setSelectedTripId(null)} />}
        </div>
      )}
    </div>
  )
}

function NavBtn({ label, onClick, wide }: { label: string; onClick: () => void; wide?: boolean }) {
  return (
    <button onClick={onClick} style={{ appearance:'none', cursor:'pointer', fontFamily:L.sans, fontWeight:650, fontSize:13, color:L.ink,
      background:L.panel, border:`1px solid ${L.line}`, borderRadius:999, padding: wide?'8px 14px':'8px 12px', minWidth: wide?0:34 }}>{label}</button>
  )
}
function Segmented({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: ViewMode[] = ['month','week','agenda']
  return (
    <div style={{ display:'flex', gap:4, padding:4, borderRadius:999, background:L.goldTint, border:`1px solid ${L.line}` }}>
      {opts.map(o => {
        const active = o === view
        return (
          <button key={o} onClick={() => onChange(o)} style={{ appearance:'none', cursor:'pointer', fontFamily:L.sans, fontWeight:700, fontSize:12,
            textTransform:'capitalize', padding:'7px 13px', borderRadius:999, border:'none', color: active?L.ink:L.muted,
            background: active?L.panel:'transparent', boxShadow: active?'0 6px 14px rgba(26,29,26,0.08)':'none' }}>{o}</button>
        )
      })}
    </div>
  )
}
function Centered({ children, tone }: { children: React.ReactNode; tone?: 'danger' }) {
  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:280, textAlign:'center', color: tone==='danger'?IMMERSE.danger:L.muted, fontSize:14, padding:24, fontFamily:L.sans, lineHeight:1.5 }}>
      <div style={{ maxWidth:360 }}>{children}</div>
    </div>
  )
}

type WeekBar = { trip: CalendarTrip; startCol: number; endCol: number; continuesLeft: boolean; continuesRight: boolean; lane: number }

function MonthView({ cursor, trips, onSelect }: { cursor: Date; trips: CalendarTrip[]; onSelect: (id: string)=>void }) {
  const first = startOfMonth(cursor), last = endOfMonth(cursor)
  const gridStart = startOfWeek(first)
  const weeks: Date[][] = []
  let d = new Date(gridStart)
  while (d <= last || mondayIndex(d) !== 0) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) { week.push(new Date(d)); d = addDays(d, 1) }
    weeks.push(week)
    if (weeks.length > 6) break
  }
  const today = new Date()
  return (
    <div style={{ border:`1px solid ${L.line}`, borderRadius:ID.radiusMd, overflow:'hidden', background:L.panel }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', borderBottom:`1px solid ${L.line}`, background:L.goldTint }}>
        {WD.map(w => (<div key={w} style={{ padding:'10px 12px', textAlign:'right', textTransform:'uppercase', letterSpacing:'0.12em', fontSize:10, fontWeight:700, color:L.muted }}>{w}</div>))}
      </div>
      {weeks.map((week, wi) => (<WeekRow key={wi} week={week} cursorMonth={cursor.getMonth()} today={today} trips={trips} onSelect={onSelect} />))}
    </div>
  )
}

function WeekRow({ week, cursorMonth, today, trips, onSelect }: { week: Date[]; cursorMonth: number; today: Date; trips: CalendarTrip[]; onSelect: (id: string)=>void }) {
  const weekStartISO = fmtISO(week[0]); const weekEndISO = fmtISO(week[6])
  const bars = useMemo<WeekBar[]>(() => {
    const overlapping = trips.filter(t => t.start_date && t.end_date && t.start_date <= weekEndISO && t.end_date >= weekStartISO)
    overlapping.sort((a,b) => (a.start_date! < b.start_date! ? -1 : 1))
    const laneEnds: number[] = []; const result: WeekBar[] = []
    for (const t of overlapping) {
      const segStart = maxISO(t.start_date!, weekStartISO); const segEnd = minISO(t.end_date!, weekEndISO)
      const startCol = mondayIndex(parseISO(segStart)); const endCol = mondayIndex(parseISO(segEnd))
      const foundLane = laneEnds.findIndex(end => end < startCol)
      const lane = foundLane === -1 ? laneEnds.length : foundLane
      laneEnds[lane] = endCol
      result.push({ trip: t, startCol, endCol, lane, continuesLeft: t.start_date! < weekStartISO, continuesRight: t.end_date! > weekEndISO })
    }
    return result
  }, [trips, weekStartISO, weekEndISO])

  const laneCount = bars.reduce((m,b) => Math.max(m, b.lane+1), 0)
  const BAR_H = 22, BAR_GAP = 3
  const barsAreaH = laneCount > 0 ? laneCount*(BAR_H+BAR_GAP) + 2 : 0

  const dayStays = week.map((day) => {
    const iso = fmtISO(day)
    const checkins: {trip:CalendarTrip;stay:CalendarStay}[] = []
    const checkouts: {trip:CalendarTrip;stay:CalendarStay}[] = []
    for (const t of trips) for (const s of t.stays) {
      if (s.check_in === iso) checkins.push({ trip:t, stay:s })
      if (s.check_out === iso) checkouts.push({ trip:t, stay:s })
    }
    return { checkins, checkouts }
  })

  return (
    <div style={{ position:'relative', borderBottom:`1px solid ${L.line}` }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))' }}>
        {week.map((day, col) => {
          const inMonth = day.getMonth() === cursorMonth
          const isToday = sameDay(day, today)
          const ds = dayStays[col]
          return (
            <div key={col} style={{ minHeight: 96 + barsAreaH, padding:'8px 8px 8px', borderRight: col!==6 ? `1px solid ${L.line}` : 'none',
              background: inMonth ? L.panel : L.surface, opacity: inMonth ? 1 : 0.55 }}>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: barsAreaH ? barsAreaH+4 : 4 }}>
                <span style={{ fontSize:12, fontWeight:600, color: isToday?L.panel:L.muted, background: isToday?L.ink:'transparent', width:24, height:24, borderRadius:'50%', display:'inline-grid', placeItems:'center' }}>{day.getDate()}</span>
              </div>
              {ds.checkins.map((c, i) => <StayMarker key={`in-${i}`} trip={c.trip} stay={c.stay} kind="in" onSelect={onSelect} />)}
              {ds.checkouts.map((c, i) => <StayMarker key={`out-${i}`} trip={c.trip} stay={c.stay} kind="out" onSelect={onSelect} />)}
            </div>
          )
        })}
      </div>
      <div style={{ position:'absolute', top:38, left:0, right:0, pointerEvents:'none',
                    display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))',
                    gridAutoRows:`${BAR_H + BAR_GAP}px`, padding:'0 6px', boxSizing:'border-box' }}>
        {bars.map((b, i) => {
          const label = b.trip.title || b.trip.trip_code
          return (
            <button key={i} onClick={() => onSelect(b.trip.id)} title={label} style={{
              gridColumn: `${b.startCol+1} / ${b.endCol+2}`, gridRow: b.lane+1,
              height: BAR_H, margin:'0 2px', boxSizing:'border-box', minWidth:0,
              pointerEvents:'auto', cursor:'pointer', textAlign:'left', background:L.goldTint, color:L.band, border:`1px solid ${L.goldBorder}`,
              borderTopLeftRadius: b.continuesLeft?0:999, borderBottomLeftRadius: b.continuesLeft?0:999,
              borderTopRightRadius: b.continuesRight?0:999, borderBottomRightRadius: b.continuesRight?0:999,
              padding:'0 10px', fontSize:11, fontWeight:700, lineHeight:`${BAR_H-2}px`, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:L.sans }}>
              {b.continuesLeft ? '‹ ' : ''}{label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StayMarker({ trip, stay, kind, onSelect }: { trip: CalendarTrip; stay: CalendarStay; kind:'in'|'out'; onSelect:(id:string)=>void }) {
  const tentative = isTentative(stay); const hotel = stay.hotel_name || stay.name || 'Stay'
  const verb = kind==='in' ? 'Check-in' : 'Check-out'
  return (
    <button onClick={() => onSelect(trip.id)} title={`${verb}: ${hotel}${tentative?' (tentative)':''}`} style={{
      display:'block', width:'100%', textAlign:'left', cursor:'pointer', margin:'3px 0', background:L.panel, color:L.ink,
      border:`1px solid ${L.line}`, borderStyle: tentative?'dashed':'solid', borderRadius:8, padding:'3px 7px', fontSize:10.5, fontWeight:700,
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:L.sans, opacity: tentative?0.8:1 }}>
      <span style={{ color:L.gold }}>{kind==='in'?'→':'←'}</span> {hotel}
    </button>
  )
}

function WeekView({ cursor, trips, onSelect }: { cursor: Date; trips: CalendarTrip[]; onSelect:(id:string)=>void }) {
  const ws = startOfWeek(cursor); const days = Array.from({length:7}, (_,i) => addDays(ws,i)); const today = new Date()
  return (
    <div style={{ border:`1px solid ${L.line}`, borderRadius:ID.radiusMd, overflow:'hidden', background:L.panel }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))' }}>
        {days.map((day, i) => {
          const iso = fmtISO(day); const isToday = sameDay(day, today)
          const spanning = trips.filter(t => t.start_date && t.end_date && t.start_date <= iso && t.end_date >= iso)
          const checkins: {trip:CalendarTrip;stay:CalendarStay}[] = []; const checkouts: {trip:CalendarTrip;stay:CalendarStay}[] = []
          for (const t of trips) for (const s of t.stays) { if (s.check_in===iso) checkins.push({trip:t,stay:s}); if (s.check_out===iso) checkouts.push({trip:t,stay:s}) }
          const empty = spanning.length===0 && checkins.length===0 && checkouts.length===0
          return (
            <div key={i} style={{ minHeight:420, padding:'12px 10px', borderRight: i!==6?`1px solid ${L.line}`:'none', background: isToday?L.goldTint:L.panel }}>
              <div style={{ marginBottom:10 }}>
                <div style={{ textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, fontWeight:700, color:L.muted }}>{WD[i]}</div>
                <div style={{ fontFamily:L.serif, fontSize:20, fontWeight:500, color: isToday?L.ink:L.muted }}>{day.getDate()}</div>
              </div>
              {empty && <div style={{ fontSize:11, color:L.muted, opacity:0.5 }}>—</div>}
              {spanning.map((t, j) => {
                const isStart = t.start_date===iso, isEnd = t.end_date===iso
                const phase = isStart?'Begins':isEnd?'Ends':'In progress'
                return (
                  <button key={`t-${j}`} onClick={()=>onSelect(t.id)} title={`${t.title||t.trip_code} · ${phase}`} style={{ display:'block', width:'100%', textAlign:'left', cursor:'pointer',
                    borderRadius:10, padding:'6px 9px', marginBottom:6, fontFamily:L.sans, border:`1px solid ${L.goldBorder}`, background:L.goldTint, opacity: (isStart||isEnd)?1:0.86, boxSizing:'border-box', minWidth:0 }}>
                    <strong style={{ display:'block', fontSize:11.5, color:L.band, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title||t.trip_code}</strong>
                    <span style={{ fontSize:10, color:L.muted }}>{phase}</span>
                  </button>
                )
              })}
              {checkins.map((c,j) => <WeekStay key={`in-${j}`} trip={c.trip} stay={c.stay} kind="in" onSelect={onSelect} />)}
              {checkouts.map((c,j) => <WeekStay key={`out-${j}`} trip={c.trip} stay={c.stay} kind="out" onSelect={onSelect} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
function WeekStay({ trip, stay, kind, onSelect }: { trip:CalendarTrip; stay:CalendarStay; kind:'in'|'out'; onSelect:(id:string)=>void }) {
  const tentative = isTentative(stay); const hotel = stay.hotel_name||stay.name||'Stay'
  const verb = kind==='in'?'Check-in':'Check-out'
  return (
    <button onClick={()=>onSelect(trip.id)} title={`${verb}: ${hotel}${tentative?' (tentative)':''}`} style={{ display:'block', width:'100%', textAlign:'left', cursor:'pointer',
      borderRadius:10, padding:'6px 9px', marginBottom:6, fontFamily:L.sans, border:`1px solid ${L.line}`, background:L.panel, borderStyle: tentative?'dashed':'solid', opacity: tentative?0.82:1, boxSizing:'border-box', minWidth:0 }}>
      <strong style={{ display:'block', fontSize:11.5, color:L.ink }}>{verb}</strong>
      <span style={{ display:'block', fontSize:10, color:L.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{hotel}{tentative?' · tentative':''}</span>
    </button>
  )
}

type DayEvent =
  | { kind:'trip-start'|'trip-end'; trip: CalendarTrip }
  | { kind:'stay-checkin'|'stay-checkout'; trip: CalendarTrip; stay: CalendarStay }
type AgendaItem = { date: string; sort: number; node: DayEvent }

function AgendaView({ trips, onSelect }: { trips: CalendarTrip[]; onSelect:(id:string)=>void }) {
  const groups = useMemo(() => {
    const start = todayISO(); const acc: AgendaItem[] = []
    for (const t of trips) {
      if (t.start_date && t.start_date >= start) acc.push({ date:t.start_date, sort:0, node:{kind:'trip-start',trip:t} })
      if (t.end_date && t.end_date >= start) acc.push({ date:t.end_date, sort:3, node:{kind:'trip-end',trip:t} })
      for (const s of t.stays) {
        if (s.check_in && s.check_in >= start) acc.push({ date:s.check_in, sort:1, node:{kind:'stay-checkin',trip:t,stay:s} })
        if (s.check_out && s.check_out >= start) acc.push({ date:s.check_out, sort:2, node:{kind:'stay-checkout',trip:t,stay:s} })
      }
    }
    acc.sort((a,b) => a.date===b.date ? a.sort-b.sort : (a.date<b.date?-1:1))
    const g: { date:string; items:AgendaItem[] }[] = []
    for (const it of acc) {
      const last = g[g.length-1]
      if (last && last.date===it.date) { last.items.push(it); continue }
      g.push({date:it.date, items:[it]})
    }
    return g
  }, [trips])
  if (groups.length===0) return <Centered>No upcoming milestones.</Centered>
  return (
    <div style={{ border:`1px solid ${L.line}`, borderRadius:ID.radiusMd, background:L.panel, padding:'4px 18px 18px' }}>
      {groups.map((grp, gi) => {
        const d = parseISO(grp.date)
        return (
          <div key={gi} style={{ borderTop: gi===0?'none':`1px solid ${L.line}`, display:'grid', gridTemplateColumns:'92px 1fr', gap:18, padding:'16px 0' }}>
            <div style={{ color:L.muted }}>
              <div style={{ fontFamily:L.serif, fontSize:24, fontWeight:500, color:L.ink, lineHeight:1 }}>{d.getDate()}</div>
              <div style={{ fontSize:12, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:3 }}>{WD[mondayIndex(d)]} {MONTHS[d.getMonth()].slice(0,3)}</div>
            </div>
            <div style={{ display:'grid', gap:10 }}>{grp.items.map((it, ii) => <AgendaRow key={ii} ev={it.node} onSelect={onSelect} />)}</div>
          </div>
        )
      })}
    </div>
  )
}
const ROW_STYLE = { display:'grid', gridTemplateColumns:'110px 1fr auto', gap:12, alignItems:'start' as const, textAlign:'left' as const,
  cursor:'pointer', fontFamily:L.sans, borderRadius:14, background:L.panel, padding:'12px 14px', width:'100%' }

function AgendaRow({ ev, onSelect }: { ev: DayEvent; onSelect:(id:string)=>void }) {
  // Stay milestone branch — early return narrows ev to the stay-bearing variant.
  if (ev.kind==='stay-checkin' || ev.kind==='stay-checkout') {
    const hotel = ev.stay.hotel_name||ev.stay.name||'Stay'
    const timeLabel = ev.kind==='stay-checkin'?'Check-in':'Check-out'
    const tentative = isTentative(ev.stay)
    const sub = tentative?'Stay · tentative (quoted)':'Stay · confirmed'
    return (
      <button onClick={()=>onSelect(ev.trip.id)} style={{ ...ROW_STYLE, border:`1px solid ${L.line}`, borderStyle: tentative?'dashed':'solid', opacity: tentative?0.85:1 }}>
        <span style={{ fontSize:13, color:L.muted }}>{timeLabel}</span>
        <span>
          <strong style={{ display:'block', fontSize:14, color:L.ink, marginBottom:3 }}>{hotel}</strong>
          <span style={{ fontSize:12, color:L.muted }}>{sub}</span>
        </span>
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:L.gold, alignSelf:'center' }}>Stay</span>
      </button>
    )
  }

  // Trip start/end branch.
  const timeLabel = ev.kind==='trip-start'?'Starts':'Ends'
  const title = ev.trip.title || ev.trip.trip_code
  const sub = `${tripStatusLabel(ev.trip.status_slug)} · ${fmtRange(ev.trip.start_date, ev.trip.end_date)}`
  return (
    <button onClick={()=>onSelect(ev.trip.id)} style={{ ...ROW_STYLE, border:`1px solid ${L.line}` }}>
      <span style={{ fontSize:13, color:L.muted }}>{timeLabel}</span>
      <span>
        <strong style={{ display:'block', fontSize:14, color:L.ink, marginBottom:3 }}>{title}</strong>
        <span style={{ fontSize:12, color:L.muted }}>{sub}</span>
      </span>
      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:L.band, alignSelf:'center' }}>Trip</span>
    </button>
  )
}

function TripPanel({ trip, onClose }: { trip: CalendarTrip; onClose: ()=>void }) {
  return (
    <div style={{ border:`1px solid ${L.line}`, borderRadius:ID.radiusMd, background:L.panel, padding:18, position:'sticky', top:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, borderBottom:`1px solid ${L.line}`, paddingBottom:14, marginBottom:14 }}>
        <div>
          <div style={{ textTransform:'uppercase', letterSpacing:'0.12em', fontSize:10, fontWeight:700, color:L.muted, marginBottom:6 }}>Selected trip</div>
          <h2 style={{ margin:0, fontFamily:L.serif, fontWeight:500, fontSize:22, lineHeight:1.15, color:L.ink }}>{trip.title||trip.trip_code}</h2>
          <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, background:L.goldTint, border:`1px solid ${L.goldBorder}`, borderRadius:999, padding:'5px 10px', fontSize:11, fontWeight:700, color:L.band }}>{tripStatusLabel(trip.status_slug)}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ appearance:'none', cursor:'pointer', border:`1px solid ${L.line}`, background:L.panel, borderRadius:'50%', width:30, height:30, color:L.muted, fontSize:16, lineHeight:1 }}>×</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        <Info label="Trip dates" value={fmtRange(trip.start_date, trip.end_date)} />
        <Info label="Stays" value={`${trip.stays.length}`} />
      </div>
      <div style={{ textTransform:'uppercase', letterSpacing:'0.12em', fontSize:10, fontWeight:700, color:L.muted, marginBottom:8 }}>Stays</div>
      <div style={{ display:'grid', gap:8 }}>
        {trip.stays.length===0 && <div style={{ fontSize:13, color:L.muted }}>No stays recorded.</div>}
        {trip.stays.map(stay => {
          const tentative = isTentative(stay)
          return (
            <div key={stay.id} style={{ border:`1px solid ${L.line}`, borderRadius:14, padding:12, borderStyle: tentative?'dashed':'solid', background:L.panel }}>
              <strong style={{ display:'block', fontSize:14, color:L.ink, marginBottom:4 }}>{stay.hotel_name||stay.name||'Stay'}</strong>
              <p style={{ margin:0, fontSize:12, color:L.muted, lineHeight:1.45 }}>{fmtRange(stay.check_in, stay.check_out)}{tentative?' · tentative (quoted)':' · confirmed'}</p>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop:16, borderTop:`1px solid ${L.line}`, paddingTop:12, fontSize:12, color:L.muted, lineHeight:1.45 }}>
        To-do list and welcome-prep tasks appear here once task scheduling is enabled.
      </div>
    </div>
  )
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border:`1px solid ${L.line}`, borderRadius:12, padding:11, background:L.surface }}>
      <div style={{ textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, fontWeight:700, color:L.muted }}>{label}</div>
      <div style={{ marginTop:3, fontSize:14, fontWeight:600, color:L.ink }}>{value||'—'}</div>
    </div>
  )
}