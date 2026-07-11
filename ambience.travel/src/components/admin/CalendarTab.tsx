// CalendarTab.tsx — Admin Calendar (Stage 1, rebuilt S55 for span integrity).
//
// Derives entirely from the `calendar` mode of travel-read-journey-admin — confirmed/
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
import { bookedByLabel, flightDetail } from '../../utils/utilsBooking'
import { fmtTime } from '../../utils/utilsDates'

const L = {
  surface: IMMERSE.lightSurface, panel: IMMERSE.panelOnLight, ink: IMMERSE.textOnLight,
  muted: IMMERSE.mutedOnLight, line: IMMERSE.lineOnLight, goldBorder: IMMERSE.goldBorderOnLight,
  goldTint: IMMERSE.goldTintOnLight, gold: ID.gold, serif: FONTS.serif,
  sans: "'Plus Jakarta Sans', sans-serif", band: '#6f5528',
  // State-band palette (single source for the calendar bar color axis):
  // completed = muted grey-green; pending = lighter, dashed; confirmed = gold (default).
  completedBand: '#5a6b58', completedTint: '#E8ECE6', completedBorder: '#C2CDBE',
  pendingBand:   '#8a7d5e', pendingTint:   '#F4F0E6', pendingBorder: '#D8CFB8',
} as const

// ── Marker icon set ──────────────────────────────────────────────────────────
// One coherent inline-SVG set (stay / flight / car) at a shared 14px, 1.4 stroke,
// currentColor — so every marker reads as one designed family and inherits the
// surface color. Single source: TransportMark, WeekStay, and the legend all render
// <MarkerIcon kind=…/>, so the legend can never advertise a marker the grid omits.
type MarkerKind = 'stay' | 'flight' | 'car' | 'dining' | 'event'

// Category (engagement registry slug) → marker kind. Flights/jets fly; ground cars
// (transfer/airport_transfer/car_service/heli) drive; stays reside. Mirrors the
// SPAN/MOMENT taxonomy but discriminates car-from-flight (the old code drew ✈ for all).
const CAR_CATEGORIES = new Set(['airport_transfer', 'transfer', 'car_service', 'car_rental', 'heli_transfer', 'public_transport'])
const FLIGHT_CATEGORIES = new Set(['flight', 'private_jet'])
const DINING_CATEGORIES  = new Set(['dining', 'reservation'])
const EVENT_CATEGORIES   = new Set(['experience', 'tour', 'acquisition', 'arrangement'])
function markerKindFor(category: string | null): MarkerKind {
  if (!category) return 'event'
  if (CAR_CATEGORIES.has(category))    return 'car'
  if (FLIGHT_CATEGORIES.has(category)) return 'flight'
  if (category === 'stay')             return 'stay'
  if (DINING_CATEGORIES.has(category)) return 'dining'
  if (EVENT_CATEGORIES.has(category))  return 'event'
  return 'event'
}

function MarkerIcon({ kind, size = 14, color = 'currentColor' }: { kind: MarkerKind; size?: number; color?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, style: { flexShrink: 0, display: 'block' } }
  if (kind === 'stay') {
    // House: roof + body
    return (<svg {...common}><path d="M2.5 7.2 8 2.8l5.5 4.4" /><path d="M3.7 6.4v6.3h8.6V6.4" /><path d="M6.6 12.7V9.4h2.8v3.3" /></svg>)
  }
  if (kind === 'car') {
    // Sedan: body + roof curve + two wheels
    return (<svg {...common}><path d="M2 9.5h12l-1.2-3.1a1.4 1.4 0 0 0-1.3-.9H4.5a1.4 1.4 0 0 0-1.3.9L2 9.5Z" /><path d="M2 9.5v2.2h1.2M14 9.5v2.2h-1.2" /><circle cx="4.7" cy="11.7" r="1.1" /><circle cx="11.3" cy="11.7" r="1.1" /></svg>)
  }
  // Flight: plane
  if (kind === 'dining') {
    // Fork and knife
    return (<svg {...common}><path d="M5 2v5a2 2 0 0 0 2 2v5M5 2c0 2.5 2 3.5 2 5" /><line x1="11" y1="2" x2="11" y2="14" /><path d="M9 2v3.5c0 .8.9 1.5 2 1.5s2-.7 2-1.5V2" /></svg>)
  }
  if (kind === 'event') {
    // Star / sparkle
    return (<svg {...common}><path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M4.1 4.1l1.8 1.8M10.1 10.1l1.8 1.8M4.1 11.9l1.8-1.8M10.1 5.9l1.8-1.8" /></svg>)
  }
  return (<svg {...common}><path d="M8 1.6c.6 0 1 .9 1 2.4v2.3l4.4 2.6v1.4L9 9.1v2.7l1.4 1v1.1L8 13.2l-2.4.7v-1.1l1.4-1V9.1l-4.4 2.2V8.9L7 6.3V4c0-1.5.4-2.4 1-2.4Z" /></svg>)
}

// One source for a trip's bar styling, keyed off the EF-derived state. Confirmed is
// the gold default; completed reads muted grey-green; pending is lighter + dashed.
function stateBandStyle(state: TripState): { bg: string; fg: string; border: string; dashed: boolean } {
  if (state === 'completed') return { bg: L.completedTint, fg: L.completedBand, border: L.completedBorder, dashed: false }
  if (state === 'pending')   return { bg: L.pendingTint,   fg: L.pendingBand,   border: L.pendingBorder,   dashed: true }
  return { bg: L.goldTint, fg: L.band, border: L.goldBorder, dashed: false }
}

type ConfirmationState = 'confirmed' | 'partially_confirmed' | 'designing'
type CalendarStay = {
  id: string; name: string | null; status: string | null; booking_type: string | null
  check_in: string | null; check_out: string | null; hotel_id: string | null; hotel_name: string | null
  confirmation: ConfirmationState; rooms_confirmed: number; rooms_total: number
}
// A typed child engagement (from the engagement spine). category is the registry slug
// ('stay' | 'transport' | dining/experience/etc. as they're created) — never hardcoded.
type CalendarActivity = {
  id: string; category: string | null; label: string | null; title: string | null
  date: string | null; end_date: string | null; time: string | null
  source_booking_id: string | null; source_aux_booking_id: string | null
  // Flight detail (movement activities; null for stays/others)
  booked_by: string | null; origin: string | null; destination: string | null
  depart_airport: string | null; arrive_airport: string | null
  flight_number: string | null; airline_name: string | null; end_time: string | null
}
type TripState = 'completed' | 'confirmed' | 'pending'
type CalendarTrip = {
  id: string; trip_code: string; title: string | null
  start_date: string | null; end_date: string | null
  status_slug: string | null; state: TripState; primary_client_id: string | null
  stays: CalendarStay[]; activities: CalendarActivity[]
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
// Confirmation is DERIVED upstream (EF, via _shared/confirmation.ts) — the calendar
// renders the three honest states, never re-deriving from status. 'designing' = not
// yet confirmed (still in the design phase); shown tentative. partially_confirmed =
// some rooms locked, some pending — its own state, not flattened.
function confLabel(s: CalendarStay): string {
  if (s.confirmation === 'confirmed') return 'Confirmed'
  if (s.confirmation === 'partially_confirmed') return `Partial · ${s.rooms_confirmed}/${s.rooms_total} rooms`
  return 'In design'
}
function confIsTentative(s: CalendarStay): boolean { return s.confirmation === 'designing' }
function confIsPartial(s: CalendarStay): boolean { return s.confirmation === 'partially_confirmed' }

// flightDetail: single source in utilsBooking.ts
function flightLine(a: CalendarActivity): string {
  return flightDetail(a, fmtTime)
}
// "self" = Own Arrangements (client self-booked). The subtle indicator axis.
function isOwnArrangements(bookedBy: string | null): boolean { return bookedBy === 'self' }


// Engagement types render as a SPAN (held across dates, like a stay) or a MOMENT
// (a point with a departure time). Single source for the shape — mirrors the
// ENGAGEMENT_TAXONOMY span/moment classification.
const SPAN_CATEGORIES = new Set(['stay', 'car_service', 'car_rental', 'cruise', 'yacht_charter'])
const MOMENT_CATEGORIES = new Set(['flight', 'private_jet', 'airport_transfer', 'transfer', 'heli_transfer', 'public_transport'])

function activityIsSpan(a: CalendarActivity): boolean {
  if (a.category && SPAN_CATEGORIES.has(a.category)) return true
  if (a.category && MOMENT_CATEGORIES.has(a.category)) return false
  // tour / unknown: span if it covers more than one day, otherwise a moment.
  return !!(a.end_date && a.date && a.end_date !== a.date)
}

// 6C drill-down shapes (from the activity_detail EF mode).
type RoomDetail = { id: string; room_name: string | null; guest_name: string | null; resolved_additional_guests?: string[] | null; confirmation_number: string | null; party_composition: string | null }
type PassengerDetail = { id: string; passenger_name: string | null; seat_numbers: string | null; confirmation_number: string | null }
type VehicleDetail = { id: string; driver_name: string | null; driver_phone: string | null; car_model: string | null; plate: string | null; company: string | null; vehicle_role: string | null }
type ActivityDetail =
  | { kind: 'stay'; rooms: RoomDetail[] }
  | { kind: 'transport'; passengers: PassengerDetail[] }
  | { kind: 'ground_transport'; vehicles: VehicleDetail[] }

export default function CalendarTab() {
  const [trips, setTrips] = useState<CalendarTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [selectedjourneyId, setSelectedjourneyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      const { data, error } = await supabase.functions.invoke('travel-read-journey-admin', { body: { mode: 'calendar' } })
      if (cancelled) return
      if (error) { setError('Could not load the calendar. Try again.'); setLoading(false); return }
      setTrips((data?.trips ?? []) as CalendarTrip[]); setLoading(false)
    }
    load(); return () => { cancelled = true }
  }, [])

  const selectedTrip = useMemo(() => trips.find(t => t.id === selectedjourneyId) ?? null, [trips, selectedjourneyId])
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
          <div style={{ textTransform:'uppercase', letterSpacing:'0.14em', fontSize:11, fontWeight:700, color:L.muted, marginBottom:8 }}>All trips</div>
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
        <Centered>No trips to show. All confirmed trips — past, current, and upcoming — appear here.</Centered>
      )}

      {!loading && !error && trips.length > 0 && (
        <>
          {view !== 'agenda' && <CalendarKey view={view} />}
          <div style={{ display:'grid', gridTemplateColumns: selectedTrip ? 'minmax(0,1fr) 320px' : '1fr', gap:18, alignItems:'start' }}>
            <div style={{ minWidth: 0 }}>
              {view === 'month'  && <MonthView  cursor={cursor} trips={trips} onSelect={setSelectedjourneyId} />}
              {view === 'week'   && <WeekView   cursor={cursor} trips={trips} onSelect={setSelectedjourneyId} />}
              {view === 'agenda' && <AgendaView trips={trips} onSelect={setSelectedjourneyId} />}
            </div>
            {selectedTrip && <TripPanel trip={selectedTrip} onClose={() => setSelectedjourneyId(null)} />}
          </div>
        </>
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

// Subtle legend — context-aware: trip-state trio always; stay/flight/car markers
// only on week view (where they render). Renders the SAME MarkerIcon set the grid
// uses, so it can never advertise a marker that isn't on screen.
function CalendarKey({ view }: { view: ViewMode }) {
  const item = (swatch: React.ReactNode, label: string) => (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
      {swatch}
      <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:L.muted }}>{label}</span>
    </span>
  )
  const bar = (s: TripState) => {
    const sb = stateBandStyle(s)
    return <span style={{ width:18, height:11, borderRadius:3, background:sb.bg, border:`1px ${sb.dashed?'dashed':'solid'} ${sb.border}`, flexShrink:0 }} />
  }
  const mark = (kind: MarkerKind) => <span style={{ color:L.gold, width:18, display:'flex', justifyContent:'center' }}><MarkerIcon kind={kind} size={13} /></span>
  return (
    <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap', rowGap:8, marginBottom:16 }}>
      {item(bar('confirmed'), 'Confirmed')}
      {item(bar('completed'), 'Completed')}
      {item(bar('pending'),   'Securing')}
      {view === 'week' && item(mark('stay'),   'Stay')}
      {view === 'week' && item(mark('flight'), 'Flight')}
      {view === 'week' && item(mark('car'),    'Car')}
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

  return (
    <div style={{ position:'relative', borderBottom:`1px solid ${L.line}` }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))' }}>
        {week.map((day, col) => {
          const inMonth = day.getMonth() === cursorMonth
          const isToday = sameDay(day, today)
          return (
            <div key={col} style={{ minHeight: 96 + barsAreaH, padding:'8px 8px 8px', borderRight: col!==6 ? `1px solid ${L.line}` : 'none',
              background: inMonth ? L.panel : L.surface, opacity: inMonth ? 1 : 0.55 }}>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: barsAreaH ? barsAreaH+4 : 4 }}>
                <span style={{ fontSize:12, fontWeight:600, color: isToday?L.panel:L.muted, background: isToday?L.ink:'transparent', width:24, height:24, borderRadius:'50%', display:'inline-grid', placeItems:'center' }}>{day.getDate()}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ position:'absolute', top:38, left:0, right:0, pointerEvents:'none',
                    display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))',
                    gridAutoRows:`${BAR_H + BAR_GAP}px`, padding:'0 6px', boxSizing:'border-box' }}>
        {bars.map((b, i) => {
          const label = b.trip.title || b.trip.trip_code
          const sb = stateBandStyle(b.trip.state)
          return (
            <button key={i} onClick={() => onSelect(b.trip.id)} title={`${label}${b.trip.state==='completed'?' · Completed':b.trip.state==='pending'?' · Securing':''}`} style={{
              gridColumn: `${b.startCol+1} / ${b.endCol+2}`, gridRow: b.lane+1,
              height: BAR_H, margin:'0 2px', boxSizing:'border-box', minWidth:0,
              pointerEvents:'auto', cursor:'pointer', textAlign:'left', background:sb.bg, color:sb.fg,
              border:`1px ${sb.dashed?'dashed':'solid'} ${sb.border}`,
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

// Transport mark — a connector, not a destination. Lighter than a stay marker: a gold
// departure time + flight name, no border fill. Click selects the trip (the panel
// itinerary carries the detail; 6C day-detail will carry per-passenger fine-print).
function TransportMark({ trip, activity, onSelect }: { trip: CalendarTrip; activity: CalendarActivity; onSelect:(id:string)=>void }) {
  const time = fmtTime(activity.time)
  const name = activity.title || 'Transport'
  return (
    <button onClick={() => onSelect(trip.id)} title={`${time ? time + ' · ' : ''}${name}`} style={{
      display:'flex', alignItems:'baseline', gap:5, width:'100%', textAlign:'left', cursor:'pointer', margin:'3px 0',
      background:'transparent', border:'none', padding:'1px 2px', fontFamily:L.sans, minWidth:0 }}>
      <span style={{ color:L.gold, flex:'0 0 auto', display:'flex' }}><MarkerIcon kind={markerKindFor(activity.category)} size={12} /></span>
      <span style={{ color:L.gold, fontSize:10, fontWeight:700, fontVariantNumeric:'tabular-nums', flex:'0 0 auto' }}>{time}</span>
      <span style={{ color:L.muted, fontSize:10, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</span>
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
          // Deduplicate by hotel_id + date — one marker per distinct hotel per day
          const seenIn = new Set<string>(); const seenOut = new Set<string>()
          for (const t of trips) for (const s of t.stays) {
            const inKey = `${t.id}::${s.hotel_id ?? s.name}::${s.check_in}`
            const outKey = `${t.id}::${s.hotel_id ?? s.name}::${s.check_out}`
            if (s.check_in===iso && !seenIn.has(inKey)) { checkins.push({trip:t,stay:s}); seenIn.add(inKey) }
            if (s.check_out===iso && !seenOut.has(outKey)) { checkouts.push({trip:t,stay:s}); seenOut.add(outKey) }
          }
          const transport: {trip:CalendarTrip;activity:CalendarActivity}[] = []
          for (const t of trips) for (const a of t.activities) { if (a.category !== 'stay' && a.date===iso) transport.push({trip:t,activity:a}) }
          transport.sort((x,y) => (x.activity.time ?? '') < (y.activity.time ?? '') ? -1 : 1)
          const empty = spanning.length===0 && checkins.length===0 && checkouts.length===0 && transport.length===0
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
                    borderRadius:10, padding:'6px 9px', marginBottom:6, fontFamily:L.sans, border:`1px ${stateBandStyle(t.state).dashed?'dashed':'solid'} ${stateBandStyle(t.state).border}`, background:stateBandStyle(t.state).bg, opacity: (isStart||isEnd)?1:0.86, boxSizing:'border-box', minWidth:0 }}>
                    <strong style={{ display:'block', fontSize:11.5, color:stateBandStyle(t.state).fg, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title||t.trip_code}</strong>
                    <span style={{ fontSize:10, color:L.muted }}>{phase}</span>
                  </button>
                )
              })}
              {checkins.map((c,j) => <WeekStay key={`in-${j}`} trip={c.trip} stay={c.stay} kind="in" onSelect={onSelect} />)}
              {checkouts.map((c,j) => <WeekStay key={`out-${j}`} trip={c.trip} stay={c.stay} kind="out" onSelect={onSelect} />)}
              {transport.map((c,j) => <TransportMark key={`tr-${j}`} trip={c.trip} activity={c.activity} onSelect={onSelect} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
function WeekStay({ trip, stay, kind, onSelect }: { trip:CalendarTrip; stay:CalendarStay; kind:'in'|'out'; onSelect:(id:string)=>void }) {
  const tentative = confIsTentative(stay); const partial = confIsPartial(stay)
  const hotel = stay.hotel_name||stay.name||'Stay'
  const verb = kind==='in'?'Check-in':'Check-out'
  return (
    <button onClick={()=>onSelect(trip.id)} title={`${verb}: ${hotel} · ${confLabel(stay)}`} style={{ display:'block', width:'100%', textAlign:'left', cursor:'pointer',
      borderRadius:10, padding:'6px 9px', marginBottom:6, fontFamily:L.sans, border:`1px solid ${partial?L.gold:L.line}`, background:L.panel, borderStyle: tentative?'dashed':'solid', opacity: tentative?0.82:1, boxSizing:'border-box', minWidth:0 }}>
      <strong style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:L.ink }}>
        <span style={{ color:L.gold, display:'flex' }}><MarkerIcon kind="stay" size={12} /></span>{verb}
      </strong>
      <span style={{ display:'block', fontSize:10, color:L.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{hotel} · {confLabel(stay)}</span>
    </button>
  )
}

type DayEvent =
  | { kind:'trip-start'|'trip-end'; trip: CalendarTrip }
  | { kind:'stay-checkin'|'stay-checkout'; trip: CalendarTrip; stay: CalendarStay }
  | { kind:'transport'; trip: CalendarTrip; activity: CalendarActivity }
type AgendaItem = { date: string; sort: number; node: DayEvent }

function AgendaView({ trips, onSelect }: { trips: CalendarTrip[]; onSelect:(id:string)=>void }) {
  const groups = useMemo(() => {
    const start = todayISO(); const acc: AgendaItem[] = []
    for (const t of trips) {
      if (t.start_date && t.start_date >= start) acc.push({ date:t.start_date, sort:0, node:{kind:'trip-start',trip:t} })
      if (t.end_date && t.end_date >= start) acc.push({ date:t.end_date, sort:3, node:{kind:'trip-end',trip:t} })
      const seenAgendaIn = new Set<string>(); const seenAgendaOut = new Set<string>()
      for (const s of t.stays) {
        const inKey = `${t.id}::${s.hotel_id ?? s.name}::${s.check_in}`
        const outKey = `${t.id}::${s.hotel_id ?? s.name}::${s.check_out}`
        if (s.check_in && s.check_in >= start && !seenAgendaIn.has(inKey)) {
          acc.push({ date:s.check_in, sort:1, node:{kind:'stay-checkin',trip:t,stay:s} }); seenAgendaIn.add(inKey)
        }
        if (s.check_out && s.check_out >= start && !seenAgendaOut.has(outKey)) {
          acc.push({ date:s.check_out, sort:2, node:{kind:'stay-checkout',trip:t,stay:s} }); seenAgendaOut.add(outKey)
        }
      }
      // Transport (flights/movements) — the agenda previously omitted these entirely.
      // sort:1.5 places a flight between check-out (2) and the next day's check-in.
      for (const a of t.activities) {
        if (a.category === 'stay') continue
        if (a.date && a.date >= start) acc.push({ date:a.date, sort:1.5, node:{kind:'transport',trip:t,activity:a} })
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
  if (groups.length===0) return <Centered>No milestones to show.</Centered>
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
    const tentative = confIsTentative(ev.stay); const partial = confIsPartial(ev.stay)
    const sub = `Stay · ${confLabel(ev.stay)}`
    return (
      <button onClick={()=>onSelect(ev.trip.id)} style={{ ...ROW_STYLE, border:`1px solid ${partial?L.gold:L.line}`, borderStyle: tentative?'dashed':'solid', opacity: tentative?0.85:1 }}>
        <span style={{ fontSize:13, color:L.muted }}>{timeLabel}</span>
        <span>
          <strong style={{ display:'block', fontSize:14, color:L.ink, marginBottom:3 }}>{hotel}</strong>
          <span style={{ fontSize:12, color:L.muted }}>{sub}</span>
        </span>
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:L.gold, alignSelf:'center' }}>Stay</span>
      </button>
    )
  }

  // Transport branch — flight detail + Own Arrangements indicator.
  if (ev.kind === 'transport') {
    const a = ev.activity
    const own = isOwnArrangements(a.booked_by)
    const detail = flightLine(a)
    return (
      <button onClick={()=>onSelect(ev.trip.id)} style={{ ...ROW_STYLE, border:`1px solid ${L.line}` }}>
        <span style={{ fontSize:13, color:L.gold, fontWeight:700 }}>{fmtTime(a.time) || 'Flight'}</span>
        <span>
          <strong style={{ display:'block', fontSize:14, color:L.ink, marginBottom:3 }}>{a.title || 'Flight'}</strong>
          <span style={{ fontSize:12, color:L.muted }}>{detail}</span>
        </span>
        <span style={{ alignSelf:'center', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
          <span style={{ color:L.gold, display:'flex' }}><MarkerIcon kind={markerKindFor(a.category)} size={13} /></span>
          {own && <span style={{ fontSize:8.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:L.muted, border:`1px solid ${L.line}`, borderRadius:999, padding:'2px 6px', whiteSpace:'nowrap' }}>{bookedByLabel(a.booked_by)}</span>}
        </span>
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
        <Info label="Stays" value={`${new Set(trip.stays.map(s => s.hotel_id).filter(Boolean)).size || trip.stays.length}`} />
      </div>
      <div style={{ textTransform:'uppercase', letterSpacing:'0.12em', fontSize:10, fontWeight:700, color:L.muted, marginBottom:8 }}>Itinerary</div>
      <div style={{ display:'grid', gap:8 }}>
        {trip.activities.length===0 && <div style={{ fontSize:13, color:L.muted }}>No itinerary recorded.</div>}
        {trip.activities.map(a => <ItineraryRow key={a.id} activity={a} stays={trip.stays} />)}
      </div>
      <div style={{ marginTop:16, borderTop:`1px solid ${L.line}`, paddingTop:12, fontSize:12, color:L.muted, lineHeight:1.45 }}>
        To-do list and welcome-prep tasks appear here once task scheduling is enabled.
      </div>
    </div>
  )
}
// One itinerary line. Transport = a departure time + flight name (a moment). Stay =
// a hotel held across nights + its derived confirmation (a span). The stay's
// confirmation comes from the matching CalendarStay (same source_booking_id), so the
// itinerary shows the same honest confirmed/partial/designing state as everywhere otherwise.
function ItineraryRow({ activity, stays }: { activity: CalendarActivity; stays: CalendarStay[] }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const span = activityIsSpan(activity)
  const canExpand = span ? !!activity.source_booking_id : !!activity.source_aux_booking_id

  async function toggle() {
    if (!canExpand) return
    const next = !open
    setOpen(next)
    if (next && !detail && !loadingDetail) {
      setLoadingDetail(true)
      const body = span
        ? { mode: 'activity_detail', booking_id: activity.source_booking_id, category: activity.category }
        : { mode: 'activity_detail', aux_booking_id: activity.source_aux_booking_id, category: activity.category }
      const { data } = await supabase.functions.invoke('travel-read-journey-admin', { body })
      setDetail((data ?? null) as ActivityDetail | null)
      setLoadingDetail(false)
    }
  }

  const stay = stays.find(s => s.id === activity.source_booking_id) ?? null
  const tentative = stay ? confIsTentative(stay) : false
  const partial = stay ? confIsPartial(stay) : false
  const confText = stay ? confLabel(stay) : ''
  const time = fmtTime(activity.time)
  const moment = !span

  return (
    <div style={{ border:`1px solid ${partial?L.gold:L.line}`, borderRadius:14, borderStyle: (span && tentative)?'dashed':'solid', background:L.panel, overflow:'hidden' }}>
      <button onClick={toggle} disabled={!canExpand} style={{ appearance:'none', display:'block', width:'100%', textAlign:'left',
        cursor: canExpand?'pointer':'default', background:'transparent', border:'none', padding:moment?'10px 12px':12, fontFamily:L.sans }}>
        {moment ? (
          <span style={{ display:'grid', gridTemplateColumns:time ? 'auto 1fr auto' : '1fr auto', gap:10, alignItems:'baseline' }}>
            {time && <span style={{ fontFamily:L.serif, fontSize:15, fontWeight:600, color:L.gold, fontVariantNumeric:'tabular-nums' }}>{time}</span>}
            <span style={{ minWidth:0 }}>
              <strong style={{ display:'block', fontSize:13.5, color:L.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{activity.title || 'Transport'}</strong>
              <span style={{ fontSize:11, color:L.muted }}>
                {flightLine(activity) || (activity.label || 'Transport')}
                {isOwnArrangements(activity.booked_by) ? `  ·  ${bookedByLabel(activity.booked_by)}` : ''}
              </span>
            </span>
            {canExpand && <span style={{ color:L.muted, fontSize:12 }}>{open?'▾':'▸'}</span>}
          </span>
        ) : (
          <span style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'start' }}>{time && <span style={{ fontFamily:L.serif, fontSize:15, fontWeight:600, color:L.gold, fontVariantNumeric:'tabular-nums' }}>{time}</span>}
            <span style={{ minWidth:0 }}>
              <strong style={{ display:'block', fontSize:14, color:L.ink, marginBottom:4 }}>{activity.title || 'Stay'}</strong>
              <span style={{ display:'block', fontSize:12, color:L.muted, lineHeight:1.45 }}>{fmtRange(activity.date, activity.end_date)}{confText ? ` · ${confText}` : ''}</span>
            </span>
            {canExpand && <span style={{ color:L.muted, fontSize:12 }}>{open?'▾':'▸'}</span>}
          </span>
        )}
      </button>
      {open && (
        <div style={{ borderTop:`1px solid ${L.line}`, padding:'10px 12px', background:L.surface }}>
          {loadingDetail && <div style={{ fontSize:12, color:L.muted }}>Loading…</div>}
          {!loadingDetail && detail?.kind === 'stay' && <RoomList rooms={detail.rooms} />}
          {!loadingDetail && detail?.kind === 'transport' && (
            <div style={{ display:'grid', gap:10 }}>
              {(flightLine(activity) || activity.flight_number || isOwnArrangements(activity.booked_by)) && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, paddingBottom:8, borderBottom:`1px solid ${L.line}` }}>
                  <span style={{ fontSize:11.5, color:L.muted, fontVariantNumeric:'tabular-nums' }}>
                    {flightLine(activity)}
                  </span>
                  {isOwnArrangements(activity.booked_by) && (
                    <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:L.muted, border:`1px solid ${L.line}`, borderRadius:999, padding:'2px 7px', whiteSpace:'nowrap' }}>{bookedByLabel(activity.booked_by)}</span>
                  )}
                </div>
              )}
              <PassengerList passengers={detail.passengers} />
            </div>
          )}
          {!loadingDetail && detail?.kind === 'ground_transport' && <VehicleList vehicles={detail.vehicles} />}
          {!loadingDetail && !detail && <div style={{ fontSize:12, color:L.muted }}>No detail available.</div>}
        </div>
      )}
    </div>
  )
}

function RoomList({ rooms }: { rooms: RoomDetail[] }) {
  if (rooms.length === 0) return <div style={{ fontSize:12, color:L.muted }}>No rooms recorded.</div>
  return (
    <div style={{ display:'grid', gap:8 }}>
      {rooms.map(r => (
        <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'baseline' }}>
          <span style={{ minWidth:0 }}>
            <strong style={{ display:'block', fontSize:12.5, color:L.ink }}>{r.room_name || 'Room'}</strong>
            <span style={{ fontSize:11.5, color:L.muted }}>{r.guest_name || '—'}</span>
          </span>
          {r.confirmation_number && (
            <span style={{ fontSize:10.5, fontWeight:700, color:L.gold, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>Conf {r.confirmation_number}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function PassengerList({ passengers }: { passengers: PassengerDetail[] }) {
  if (passengers.length === 0) return <div style={{ fontSize:12, color:L.muted }}>No passengers recorded.</div>
  return (
    <div style={{ display:'grid', gap:8 }}>
      {passengers.map(p => (
        <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'baseline' }}>
          <span style={{ minWidth:0 }}>
            <strong style={{ display:'block', fontSize:12.5, color:L.ink }}>{p.passenger_name || '—'}</strong>
            {p.seat_numbers && <span style={{ fontSize:11.5, color:L.muted }}>Seat {p.seat_numbers}</span>}
          </span>
          {p.confirmation_number && (
            <span style={{ fontSize:10.5, fontWeight:700, color:L.gold, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{p.confirmation_number}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Driver vehicles for a ground-car service (transfer / airport transfer / car service).
// This is the ADMIN ops surface, so company IS shown (operator-internal context). The
// CLIENT confirmation/programme pages omit company. vehicle_role labels the 5-car case
// (Principal / Staff / Luggage). Empty until the driver details come back ~24-36h prior.
function VehicleList({ vehicles }: { vehicles: VehicleDetail[] }) {
  if (vehicles.length === 0) return <div style={{ fontSize:12, color:L.muted }}>Driver details not yet recorded.</div>
  return (
    <div style={{ display:'grid', gap:10 }}>
      {vehicles.map(v => (
        <div key={v.id} style={{ display:'grid', gap:2 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'baseline' }}>
            <strong style={{ fontSize:12.5, color:L.ink }}>{v.driver_name || 'Driver'}</strong>
            {v.vehicle_role && (
              <span style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:L.gold }}>{v.vehicle_role}</span>
            )}
          </div>
          <div style={{ fontSize:11.5, color:L.muted, display:'flex', gap:8, flexWrap:'wrap' }}>
            {v.driver_phone && <span style={{ fontVariantNumeric:'tabular-nums' }}>{v.driver_phone}</span>}
            {v.car_model && <span>{v.car_model}</span>}
            {v.plate && <span style={{ fontVariantNumeric:'tabular-nums' }}>{v.plate}</span>}
          </div>
          {v.company && <div style={{ fontSize:10.5, color:L.muted, opacity:0.7 }}>{v.company}</div>}
        </div>
      ))}
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