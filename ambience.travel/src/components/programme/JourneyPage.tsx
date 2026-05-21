/* JourneyPage.tsx
 * Guest-facing journey programme page for ambience.travel.
 * Renders PropertyIntroSection + WelcomeLetter (shared with stays),
 * then a sticky three-tab shell: Itinerary · Trip Brief · Contacts.
 *
 * Visual language upgraded to match ambience.TRAVEL immerse standard:
 *   — Cream/gold/ink token set (mirrors TripProgrammePage)
 *   — Georgia serif titles, Plus Jakarta Sans labels
 *   — Category accent dots replacing emoji icons
 *   — Cream cards with accent left border (no dark cards)
 *   — Day headers matching pdfImmerseProgramme aesthetic
 *   — Image panel on check_in events (side layout desktop, stacked mobile)
 *   — Tab bar on cream background
 *
 * Last updated: S48 — visual upgrade to immerse standard.
 * Prior: S23 — date helpers, formatDateOnly / formatDateWithWeekday.
 */

import { useState, useEffect } from 'react'
import type { Booking, Property }                from '../../types/typesProgramme'
import type { JourneyDay, JourneyEvent, EventStatus } from '../../types/typesJourney'
import { formatDateOnly, formatDateWithWeekday }  from '../../utils/utilsDates'

// ── Tokens — mirrors TripProgrammePage exactly ────────────────────────────────

const CREAM   = '#F7F5F0'
const CARD_BG = '#F0EDE6'
const INK     = '#1A1D1A'
const GOLD    = '#C9A84C'
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const SANS    = "'Plus Jakarta Sans', sans-serif"
const SERIF   = "'Cormorant Garamond', Georgia, serif"

// ── Category accents — mirrors categoryAccent() in TripProgrammePage ──────────

function categoryAccent(eventType: JourneyEvent['event_type']): string {
  switch (eventType) {
    case 'flight':     return '#93C5FD'
    case 'transfer':   return '#A3E635'
    case 'check_in':   return '#C9A84C'
    case 'check_out':  return '#C9A84C'
    case 'experience': return '#C4B5FD'
    case 'dining':     return '#F9A8D4'
    default:           return '#B4AFA5'
  }
}

function categoryLabel(eventType: JourneyEvent['event_type']): string {
  switch (eventType) {
    case 'flight':     return 'Flight'
    case 'transfer':   return 'Transfer'
    case 'check_in':   return 'Hotel'
    case 'check_out':  return 'Check-out'
    case 'experience': return 'Experience'
    case 'dining':     return 'Dining'
    default:           return 'Other'
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

function statusColor(status: EventStatus): string {
  if (status === 'confirmed')   return '#4ade80'
  if (status === 'recommended') return FAINT
  return '#f87171'
}

function statusLabel(status: EventStatus): string {
  if (status === 'confirmed')   return 'Confirmed'
  if (status === 'recommended') return 'Recommended'
  return 'Cancelled'
}

// ── useWindowWidth ────────────────────────────────────────────────────────────

function useWindowWidth(): number {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    function onResize() { setWidth(window.innerWidth) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EventStatus }) {
  const color = statusColor(status)
  return (
    <span style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding:       '3px 10px',
      borderRadius:  100,
      border:        `1px solid ${color}50`,
      color,
      background:    `${color}14`,
      fontFamily:    SANS,
      flexShrink:    0,
    }}>
      {statusLabel(status)}
    </span>
  )
}

// ── Contact pill ──────────────────────────────────────────────────────────────

function ContactPill({ name, role, phone }: { name: string; role: string; phone: string | null }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '6px 14px',
      borderRadius: 100,
      border:       `1px solid ${RULE}`,
      background:   CARD_BG,
    }}>
      <span style={{ fontSize: 9, color: FAINT, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: SANS }}>{role}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: SANS }}>{name}</span>
      {phone && (
        <a href={`tel:${phone}`} style={{ fontSize: 11, color: GOLD, textDecoration: 'none', fontFamily: SANS }}>{phone}</a>
      )}
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: JourneyEvent }) {
  const accent      = categoryAccent(event.event_type)
  const catLabel    = categoryLabel(event.event_type)
  const isCancelled = event.status === 'cancelled'
  const hasImage    = !!(event as any).image_src
  const width       = useWindowWidth()
  const isMobile    = width < 600
  const stackLayout = isMobile && hasImage

  return (
    <div style={{
      background:    '#fff',
      border:        `0.5px solid ${RULE}`,
      borderRadius:  12,
      overflow:      'hidden',
      display:       'flex',
      flexDirection: stackLayout ? 'column' : 'row',
      opacity:       isCancelled ? 0.5 : 1,
      minHeight:     (!stackLayout && hasImage) ? 140 : 'auto',
    }}>
      {/* Image panel — check_in only */}
      {hasImage && (
        <div style={{
          width:      stackLayout ? '100%' : 'clamp(120px, 28%, 200px)',
          height:     stackLayout ? 200 : 'auto',
          flexShrink: 0,
          background: CARD_BG,
          position:   'relative',
          overflow:   'hidden',
        }}>
          <img
            src={(event as any).image_src}
            alt=''
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 3, background: accent,
          }} />
        </div>
      )}

      {/* Content */}
      <div style={{
        flex:          1,
        padding:       '16px 20px',
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        minWidth:      0,
        borderLeft:    (!stackLayout && !hasImage) ? `3px solid ${accent}` : 'none',
      }}>
        {/* Category row + status badge */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   8, gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
            <span style={{
              fontSize: 9, fontFamily: SANS, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED,
            }}>
              {catLabel}
            </span>
          </div>
          <StatusBadge status={event.status} />
        </div>

        {/* Time */}
        {event.time_local && (
          <div style={{
            fontSize: 11, fontFamily: 'DM Mono, monospace',
            fontWeight: 700, color: INK, marginBottom: 4,
          }}>
            {event.time_local}
            {event.duration ? ` · ${event.duration}` : ''}
          </div>
        )}

        {/* Title */}
        <div style={{
          fontSize:       'clamp(14px,1.8vw,18px)',
          fontFamily:     SERIF,
          color:          isCancelled ? FAINT : INK,
          lineHeight:     1.3,
          marginBottom:   4,
          textDecoration: isCancelled ? 'line-through' : 'none',
        }}>
          {event.title}
        </div>

        {/* Location / supplier */}
        {(event.location || event.supplier_name) && (
          <div style={{ fontSize: 12, fontFamily: SANS, color: MUTED, marginBottom: 6 }}>
            {[event.supplier_name, event.location].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p style={{
            fontSize: 12, lineHeight: 1.75, color: MUTED,
            fontFamily: SANS, margin: '8px 0 0', fontStyle: 'italic',
          }}>
            {event.description}
          </p>
        )}

        {/* Flight detail grid */}
        {event.event_type === 'flight' && (event.airline || event.flight_number || event.departure_airport) && (
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap:                 10,
            marginTop:           12,
            padding:             '12px 14px',
            borderRadius:        8,
            background:          CARD_BG,
            border:              `1px solid ${RULE}`,
          }}>
            {[
              { label: 'Airline',  value: event.airline },
              { label: 'Flight',   value: event.flight_number },
              { label: 'From',     value: event.departure_airport },
              { label: 'To',       value: event.arrival_airport },
              { label: 'Departs',  value: event.time_local },
              { label: 'Arrives',  value: event.arrival_time },
              { label: 'Class',    value: event.flight_class },
              { label: 'Seats',    value: event.seats },
              { label: 'Terminal', value: event.terminal },
              { label: 'Gate',     value: event.gate },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: SANS }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Hotel detail grid */}
        {(event.event_type === 'check_in' || event.event_type === 'check_out') && (event.room_type || event.check_in_date || event.inclusions) && (
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap:                 10,
            marginTop:           12,
            padding:             '12px 14px',
            borderRadius:        8,
            background:          CARD_BG,
            border:              `1px solid ${RULE}`,
          }}>
            {[
              { label: 'Confirmation', value: event.confirmation_number },
              { label: 'Room',         value: event.room_type },
              { label: 'Check-in',     value: event.check_in_date  ? formatDateOnly(event.check_in_date)  : null },
              { label: 'Check-out',    value: event.check_out_date ? formatDateOnly(event.check_out_date) : null },
              { label: 'Inclusions',   value: event.inclusions },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: SANS }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Transfer driver */}
        {event.event_type === 'transfer' && event.driver_name && (
          <div style={{
            marginTop:    10,
            padding:      '10px 14px',
            borderRadius: 8,
            background:   CARD_BG,
            border:       `1px solid ${RULE}`,
            display:      'flex',
            gap:          24,
          }}>
            <div>
              <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 3 }}>Driver</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: SANS }}>{event.driver_name}</div>
            </div>
            {event.driver_phone && (
              <div>
                <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 3 }}>Phone</div>
                <a href={`tel:${event.driver_phone}`} style={{ fontSize: 12, fontWeight: 700, color: GOLD, textDecoration: 'none', fontFamily: SANS }}>{event.driver_phone}</a>
              </div>
            )}
          </div>
        )}

        {/* Inclusions — experience / dining */}
        {(event.event_type === 'experience' || event.event_type === 'dining') && event.inclusions && (
          <div style={{
            marginTop:    10,
            padding:      '10px 14px',
            borderRadius: 8,
            background:   `${GOLD}0A`,
            border:       `1px solid ${GOLD}30`,
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, fontFamily: SANS, marginBottom: 4 }}>Inclusions</div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: SANS, lineHeight: 1.6 }}>{event.inclusions}</div>
          </div>
        )}

        {/* Confirmation — non-accommodation */}
        {event.confirmation_number && event.event_type !== 'check_in' && event.event_type !== 'check_out' && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              display:      'inline-flex',
              alignItems:   'center',
              border:       `1px solid ${GOLD}`,
              borderRadius: 4,
              padding:      '2px 8px',
              background:   '#FAF7F0',
            }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: GOLD }}>
                Conf #: {event.confirmation_number}
              </span>
            </div>
          </div>
        )}

        {/* Contacts */}
        {event.contacts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {event.contacts.map(c => (
              <ContactPill key={c.id} name={c.name} role={c.role} phone={c.phone} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Day block ─────────────────────────────────────────────────────────────────

function DayBlock({ day }: { day: JourneyDay }) {
  const dateLabel = day.date ? formatDateWithWeekday(day.date) : null

  return (
    <div style={{ marginBottom: 56 }}>
      {/* Day header — mirrors pdfImmerseProgramme day header */}
      <div style={{ marginBottom: 24 }}>
        {dateLabel && (
          <div style={{
            fontSize:      10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color:         GOLD,
            fontFamily:    SANS,
            fontWeight:    700,
            marginBottom:  6,
          }}>
            {dateLabel}
          </div>
        )}
        {day.title && (
          <div style={{
            fontSize:   'clamp(20px,2.5vw,28px)',
            fontFamily: SERIF,
            color:      INK,
            lineHeight: 1.2,
            marginBottom: 14,
          }}>
            {day.title}
          </div>
        )}
        <div style={{ height: 1, background: RULE }} />
      </div>

      {/* Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {day.events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}

// ── Tab: Itinerary ────────────────────────────────────────────────────────────

function ItineraryTab({ days }: { days: JourneyDay[] }) {
  if (days.length === 0) {
    return (
      <div style={{ padding: '48px 0', fontSize: 13, color: FAINT, fontFamily: SANS, textAlign: 'center', fontStyle: 'italic' }}>
        No itinerary days yet.
      </div>
    )
  }
  return (
    <div>
      {days.map(day => <DayBlock key={day.id} day={day} />)}
    </div>
  )
}

// ── Tab: Trip Brief ───────────────────────────────────────────────────────────

function TripBriefTab({ booking, days }: { booking: Booking; days: JourneyDay[] }) {
  const allEvents  = days.flatMap(d => d.events)
  const flights    = allEvents.filter(e => e.event_type === 'flight'     && e.status !== 'cancelled')
  const hotels     = allEvents.filter(e => e.event_type === 'check_in'   && e.status !== 'cancelled')
  const transfers  = allEvents.filter(e => e.event_type === 'transfer'   && e.status === 'confirmed')
  const experiences = allEvents.filter(e => e.event_type === 'experience' && e.status === 'confirmed')

  function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 36 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: GOLD, fontFamily: SANS, marginBottom: 14,
        }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  function BriefRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div style={{
        display:       'flex',
        gap:           16,
        paddingTop:    10,
        paddingBottom: 10,
        borderBottom:  `1px solid ${RULE}`,
      }}>
        <div style={{ width: 140, flexShrink: 0, fontSize: 11, color: FAINT, fontFamily: SANS }}>{label}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: SANS }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: MUTED, fontFamily: SANS, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <BriefSection title='Overview'>
        <BriefRow label='Guests'   value={booking.guestNames} />
        {booking.checkIn  && <BriefRow label='Departure' value={formatDateWithWeekday(booking.checkIn)} />}
        {booking.checkOut && <BriefRow label='Return'    value={formatDateWithWeekday(booking.checkOut)} />}
        <BriefRow label='Duration' value={`${days.length} day${days.length !== 1 ? 's' : ''}`} />
      </BriefSection>

      {flights.length > 0 && (
        <BriefSection title='Flights'>
          {flights.map(f => (
            <BriefRow
              key={f.id}
              label={f.time_local ?? '—'}
              value={[f.airline, f.flight_number, f.departure_airport && f.arrival_airport ? `${f.departure_airport} \u2192 ${f.arrival_airport}` : null].filter(Boolean).join(' \u00b7 ')}
              sub={[f.flight_class, f.seats, f.confirmation_number ? `Conf: ${f.confirmation_number}` : null].filter(Boolean).join(' \u00b7 ')}
            />
          ))}
        </BriefSection>
      )}

      {hotels.length > 0 && (
        <BriefSection title='Accommodation'>
          {hotels.map(h => (
            <BriefRow
              key={h.id}
              label={h.check_in_date ? formatDateOnly(h.check_in_date) : '—'}
              value={h.title}
              sub={[h.room_type, h.check_out_date ? `Until ${formatDateOnly(h.check_out_date)}` : null, h.confirmation_number ? `Conf: ${h.confirmation_number}` : null].filter(Boolean).join(' \u00b7 ')}
            />
          ))}
        </BriefSection>
      )}

      {transfers.length > 0 && (
        <BriefSection title='Transfers'>
          {transfers.map(t => (
            <BriefRow
              key={t.id}
              label={t.time_local ?? '—'}
              value={t.title}
              sub={[t.driver_name, t.driver_phone].filter(Boolean).join(' \u00b7 ')}
            />
          ))}
        </BriefSection>
      )}

      {experiences.length > 0 && (
        <BriefSection title='Confirmed Activities'>
          {experiences.map(a => (
            <BriefRow
              key={a.id}
              label={a.time_local ?? '—'}
              value={a.title}
              sub={[a.location, a.confirmation_number ? `Conf: ${a.confirmation_number}` : null].filter(Boolean).join(' \u00b7 ')}
            />
          ))}
        </BriefSection>
      )}

      {(() => {
        const allContacts = allEvents.flatMap(e => e.contacts)
        const unique = Array.from(new Map(allContacts.map(c => [c.id, c])).values())
        if (unique.length === 0) return null
        return (
          <BriefSection title='Key Contacts'>
            {unique.map(c => (
              <BriefRow key={c.id} label={c.role} value={c.name} sub={c.phone ?? undefined} />
            ))}
          </BriefSection>
        )
      })()}
    </div>
  )
}

// ── Tab: Contacts ─────────────────────────────────────────────────────────────

function ContactsTab({ property }: { property: Property }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12, marginBottom: 32 }}>
        {[property.owner, property.manager].map(contact => (
          <div key={contact.name} style={{
            padding:      '20px 24px',
            borderRadius: 12,
            border:       `0.5px solid ${RULE}`,
            background:   '#fff',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, marginBottom: 8, fontFamily: SANS }}>{contact.role}</div>
            <div style={{ fontSize: 16, fontFamily: SERIF, color: INK, marginBottom: 6 }}>{contact.name}</div>
            <a href={`tel:${contact.phone}`} style={{ fontSize: 13, color: GOLD, textDecoration: 'none', fontFamily: SANS }}>{contact.phone}</a>
          </div>
        ))}
      </div>

      {property.emergencies.length > 0 && (
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 24 }}>
          <div style={{ fontSize: 9, color: FAINT, marginBottom: 14, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: SANS }}>Emergencies</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {property.emergencies.map(e => (
              <div key={e.label}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 3, fontFamily: SANS }}>{e.label}</div>
                <a href={`tel:${e.phone}`} style={{ fontSize: 14, fontWeight: 600, color: INK, textDecoration: 'none', fontFamily: SANS }}>{e.phone}</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Welcome letter ────────────────────────────────────────────────────────────

function WelcomeLetter({ booking }: { booking: Booking }) {
  const paragraphs = booking.welcomeLetter.split('\n\n').filter(Boolean)
  return (
    <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: CREAM }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: FAINT, marginBottom: 28, fontFamily: SANS }}>Welcome</p>
        {paragraphs.map((p: string, i: number) => (
          <p key={i} style={{
            fontSize:      i === 0 ? 'clamp(18px,2vw,26px)' : 15,
            fontFamily:    i === 0 ? SERIF : SANS,
            lineHeight:    1.85,
            color:         i === 0 ? INK : MUTED,
            fontWeight:    i === 0 ? 400 : 400,
            marginBottom:  i === paragraphs.length - 1 ? 0 : 20,
            letterSpacing: i === 0 ? '-0.01em' : 'normal',
          }}>
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type JourneyTab = 'itinerary' | 'brief' | 'contacts'

const TABS: { id: JourneyTab; label: string }[] = [
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'brief',     label: 'Trip Brief' },
  { id: 'contacts',  label: 'Contacts' },
]

// ── JourneyPage ───────────────────────────────────────────────────────────────

export type JourneyPageProps = {
  booking:      Booking
  property:     Property
  days:         JourneyDay[]
  isPublic?:    boolean
  activeTab?:   JourneyTab
  onTabChange?: (tab: JourneyTab) => void
}

export default function JourneyPage({ booking, property, days, activeTab, onTabChange }: JourneyPageProps) {
  const [localTab, setLocalTab] = useState<JourneyTab>('itinerary')
  const tab    = activeTab    ?? localTab
  const setTab = onTabChange ?? setLocalTab

  return (
    <>
      {/* Cream tabbed shell */}
      <section style={{ background: CREAM, minHeight: '60vh' }}>
        {/* Sticky tab bar */}
        <div style={{
          position:     'sticky',
          top:          0,
          zIndex:       50,
          background:   'rgba(247,245,240,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${RULE}`,
          padding:      '0 clamp(20px,5vw,48px)',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding:       '18px 24px',
                  border:        'none',
                  borderBottom:  tab === t.id ? `2px solid ${GOLD}` : '2px solid transparent',
                  background:    'transparent',
                  color:         tab === t.id ? GOLD : FAINT,
                  fontSize:      11,
                  fontWeight:    tab === t.id ? 700 : 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily:    SANS,
                  cursor:        'pointer',
                  transition:    'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(20px,5vw,48px)' }}>
          {tab === 'itinerary' && <ItineraryTab days={days} />}
          {tab === 'brief'     && <TripBriefTab booking={booking} days={days} />}
          {tab === 'contacts'  && <ContactsTab property={property} />}
        </div>

        {/* Footer */}
        <div style={{ padding: '40px clamp(20px,5vw,48px)', textAlign: 'center', borderTop: `1px solid ${RULE}` }}>
          <div style={{ fontSize: 10, fontFamily: SANS, color: FAINT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            TAILORED TRAVEL DESIGN &nbsp;&middot;&nbsp; CONCIERGE SUPPORT &nbsp;&middot;&nbsp;{' '}
            <a href='https://ambience.travel' style={{ color: FAINT, textDecoration: 'none' }}>ambience.travel</a>
          </div>
        </div>
      </section>
    </>
  )
}