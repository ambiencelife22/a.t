/* JourneyPage.tsx
 * Guest-facing journey programme page for ambience.travel.
 * Renders PropertyIntroSection + WelcomeLetter (shared with stays),
 * then a sticky three-tab shell: Itinerary · Trip Brief · Contacts.
 * Dark ambience theme throughout.
 *
 * Last updated: S23 — All date-only ISO strings now route through
 *   shared formatDateOnly / formatDateWithWeekday helpers (lib/dates.ts).
 *   Fixes the -1-day-west-of-UTC bug. Canonical render: DD Month YYYY.
 */

import { useEffect, useState } from 'react'
import type { Booking, Property } from '../../lib/programmeTypes'
import type { JourneyDay, JourneyEvent, EventStatus } from '../../lib/journeyTypes'
import PropertyIntroSection from './PropertyIntroSection'
import { formatDateOnly, formatDateWithWeekday } from '../../lib/dates'

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:          '#F7F4EE',
  bgAlt:       '#F3EEE6',
  bgDark:      '#171917',
  bgCard:      '#FFFFFF',
  text:        '#171917',
  muted:       '#4F564F',
  faint:       '#7A8476',
  border:      '#DED7CC',
  gold:        '#C9B88E',
  darkText:    '#F3F4F3',
  darkBody:    '#BFBFBF',
  darkLabel:   '#838383',
  darkBorder:  '#333533',
  darkCard:    '#232423',
  positive:    '#4ade80',
  danger:      '#ef4444',
  font:        "'Plus Jakarta Sans', sans-serif",
}

// ── Status colours ────────────────────────────────────────────────────────────

function statusColor(status: EventStatus): string {
  if (status === 'confirmed')   return T.gold
  if (status === 'recommended') return T.faint
  return T.danger
}

function statusLabel(status: EventStatus): string {
  if (status === 'confirmed')   return 'Confirmed'
  if (status === 'recommended') return 'Recommended'
  return 'Cancelled'
}

// ── Event type icon + label ───────────────────────────────────────────────────

function eventIcon(type: JourneyEvent['event_type']): string {
  if (type === 'flight')    return '✈'
  if (type === 'transfer')  return '🚗'
  if (type === 'check_in')  return '🏨'
  if (type === 'check_out') return '🏨'
  if (type === 'activity')  return '🗺'
  if (type === 'dining')    return '🍽'
  return '•'
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EventStatus }) {
  const color = statusColor(status)
  return (
    <span style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      padding:       '3px 10px',
      borderRadius:  100,
      border:        `1px solid ${color}50`,
      color,
      background:    `${color}14`,
      fontFamily:    T.font,
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
      padding:      '6px 12px',
      borderRadius: 100,
      border:       `1px solid ${T.darkBorder}`,
      background:   'rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 10, color: T.darkLabel, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: T.font }}>{role}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.darkText, fontFamily: T.font }}>{name}</span>
      {phone && (
        <a href={`tel:${phone}`} style={{ fontSize: 11, color: T.gold, textDecoration: 'none', fontFamily: T.font }}>{phone}</a>
      )}
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: JourneyEvent }) {
  const isCancelled = event.status === 'cancelled'

  return (
    <div style={{
      padding:      '20px 24px',
      borderRadius: 16,
      border:       `1px solid ${isCancelled ? T.darkBorder : event.status === 'confirmed' ? 'rgba(201,184,142,0.2)' : T.darkBorder}`,
      background:   isCancelled ? 'rgba(255,255,255,0.02)' : T.darkCard,
      opacity:      isCancelled ? 0.5 : 1,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: event.description || event.confirmation_number ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
          {/* Icon */}
          <div style={{
            width:          36,
            height:         36,
            borderRadius:   10,
            background:     'rgba(255,255,255,0.06)',
            border:         `1px solid ${T.darkBorder}`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       16,
            flexShrink:     0,
          }}>
            {eventIcon(event.event_type)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Time */}
            {event.time_local && (
              <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.1em', fontFamily: T.font, marginBottom: 3 }}>
                {event.time_local}
                {event.duration ? ` · ${event.duration}` : ''}
              </div>
            )}
            {/* Title */}
            <div style={{
              fontSize:        15,
              fontWeight:      700,
              color:           isCancelled ? T.darkLabel : T.darkText,
              fontFamily:      T.font,
              letterSpacing:   '-0.01em',
              textDecoration:  isCancelled ? 'line-through' : 'none',
              lineHeight:      1.3,
            }}>
              {event.title}
            </div>
            {/* Location / supplier */}
            {(event.location || event.supplier_name) && (
              <div style={{ fontSize: 11, color: T.darkLabel, fontFamily: T.font, marginTop: 3 }}>
                {[event.supplier_name, event.location].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <StatusBadge status={event.status} />
      </div>

      {/* Flight details */}
      {event.event_type === 'flight' && (event.airline || event.flight_number || event.departure_airport) && (
        <div style={{
          display:      'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap:          12,
          marginTop:    14,
          padding:      '14px 16px',
          borderRadius: 12,
          background:   'rgba(255,255,255,0.04)',
          border:       `1px solid ${T.darkBorder}`,
        }}>
          {[
            { label: 'Airline',    value: event.airline },
            { label: 'Flight',     value: event.flight_number },
            { label: 'From',       value: event.departure_airport },
            { label: 'To',         value: event.arrival_airport },
            { label: 'Departs',    value: event.time_local },
            { label: 'Arrives',    value: event.arrival_time },
            { label: 'Class',      value: event.flight_class },
            { label: 'Seats',      value: event.seats },
            { label: 'Terminal',   value: event.terminal },
            { label: 'Gate',       value: event.gate },
          ].filter(f => f.value).map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.darkLabel, fontFamily: T.font, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.darkText, fontFamily: T.font }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Accommodation details */}
      {(event.event_type === 'check_in' || event.event_type === 'check_out') && (event.room_type || event.check_in_date || event.inclusions) && (
        <div style={{
          display:      'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap:          12,
          marginTop:    14,
          padding:      '14px 16px',
          borderRadius: 12,
          background:   'rgba(255,255,255,0.04)',
          border:       `1px solid ${T.darkBorder}`,
        }}>
          {[
            { label: 'Confirmation', value: event.confirmation_number },
            { label: 'Room',         value: event.room_type },
            { label: 'Check-in',     value: event.check_in_date  ? formatDateOnly(event.check_in_date)  : null },
            { label: 'Check-out',    value: event.check_out_date ? formatDateOnly(event.check_out_date) : null },
            { label: 'Inclusions',   value: event.inclusions },
          ].filter(f => f.value).map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.darkLabel, fontFamily: T.font, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.darkText, fontFamily: T.font }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer driver inline */}
      {event.event_type === 'transfer' && event.driver_name && (
        <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.darkLabel, fontFamily: T.font, marginBottom: 3 }}>Driver</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.darkText, fontFamily: T.font }}>{event.driver_name}</div>
          </div>
          {event.driver_phone && (
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.darkLabel, fontFamily: T.font, marginBottom: 3 }}>Phone</div>
              <a href={`tel:${event.driver_phone}`} style={{ fontSize: 13, fontWeight: 600, color: T.gold, textDecoration: 'none', fontFamily: T.font }}>{event.driver_phone}</a>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <p style={{ fontSize: 13, lineHeight: 1.75, color: T.darkBody, fontFamily: T.font, marginTop: 14, marginBottom: 0 }}>
          {event.description}
        </p>
      )}

      {/* Confirmation number (non-accommodation) */}
      {event.confirmation_number && event.event_type !== 'check_in' && event.event_type !== 'check_out' && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.darkLabel, fontFamily: T.font }}>Confirmation · </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.gold, fontFamily: T.font, letterSpacing: '0.04em' }}>{event.confirmation_number}</span>
        </div>
      )}

      {/* Contacts */}
      {event.contacts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {event.contacts.map(c => (
            <ContactPill key={c.id} name={c.name} role={c.role} phone={c.phone} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Day block ─────────────────────────────────────────────────────────────────

function DayBlock({ day }: { day: JourneyDay }) {
  const dateLabel = day.date ? formatDateWithWeekday(day.date) : null

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Day header */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.darkBorder}` }}>
        {dateLabel && (
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.gold, fontFamily: T.font, marginBottom: 4 }}>
            {dateLabel}
          </div>
        )}
        {day.title && (
          <h3 style={{ fontSize: 'clamp(18px,2vw,24px)', fontWeight: 700, color: T.darkText, fontFamily: T.font, letterSpacing: '-0.02em', margin: 0 }}>
            {day.title}
          </h3>
        )}
      </div>

      {/* Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      <div style={{ padding: '48px 0', fontSize: 14, color: T.darkLabel, fontFamily: T.font, textAlign: 'center' }}>
        No itinerary days yet.
      </div>
    )
  }

  return (
    <div>
      {days.map(day => (
        <DayBlock key={day.id} day={day} />
      ))}
    </div>
  )
}

// ── Tab: Trip Brief ───────────────────────────────────────────────────────────

function TripBriefTab({ booking, days }: { booking: Booking; days: JourneyDay[] }) {
  // Collect events by type across all days for structured summary
  const allEvents = days.flatMap(d => d.events)
  const flights    = allEvents.filter(e => e.event_type === 'flight' && e.status !== 'cancelled')
  const hotels     = allEvents.filter(e => e.event_type === 'check_in' && e.status !== 'cancelled')
  const transfers  = allEvents.filter(e => e.event_type === 'transfer' && e.status === 'confirmed')
  const activities = allEvents.filter(e => e.event_type === 'activity' && e.status === 'confirmed')

  function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.gold, fontFamily: T.font, marginBottom: 12 }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  function BriefRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10, borderBottom: `1px solid ${T.darkBorder}` }}>
        <div style={{ width: 140, flexShrink: 0, fontSize: 11, color: T.darkLabel, fontFamily: T.font }}>{label}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.darkText, fontFamily: T.font }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: T.darkLabel, fontFamily: T.font, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Trip overview */}
      <BriefSection title='Overview'>
        <BriefRow label='Guests'    value={booking.guestNames} />
        {booking.checkIn  && <BriefRow label='Departure'  value={formatDateWithWeekday(booking.checkIn)} />}
        {booking.checkOut && <BriefRow label='Return'     value={formatDateWithWeekday(booking.checkOut)} />}
        <BriefRow label='Duration'  value={`${days.length} day${days.length !== 1 ? 's' : ''}`} />
      </BriefSection>

      {/* Flights */}
      {flights.length > 0 && (
        <BriefSection title='Flights'>
          {flights.map(f => (
            <BriefRow
              key={f.id}
              label={f.time_local ?? '—'}
              value={[f.airline, f.flight_number, f.departure_airport && f.arrival_airport ? `${f.departure_airport} → ${f.arrival_airport}` : null].filter(Boolean).join(' · ')}
              sub={[f.flight_class, f.seats, f.confirmation_number ? `Conf: ${f.confirmation_number}` : null].filter(Boolean).join(' · ')}
            />
          ))}
        </BriefSection>
      )}

      {/* Hotels */}
      {hotels.length > 0 && (
        <BriefSection title='Accommodation'>
          {hotels.map(h => (
            <BriefRow
              key={h.id}
              label={h.check_in_date ? formatDateOnly(h.check_in_date) : '—'}
              value={h.title}
              sub={[h.room_type, h.check_out_date ? `Until ${formatDateOnly(h.check_out_date)}` : null, h.confirmation_number ? `Conf: ${h.confirmation_number}` : null].filter(Boolean).join(' · ')}
            />
          ))}
        </BriefSection>
      )}

      {/* Transfers */}
      {transfers.length > 0 && (
        <BriefSection title='Transfers'>
          {transfers.map(t => (
            <BriefRow
              key={t.id}
              label={t.time_local ?? '—'}
              value={t.title}
              sub={[t.driver_name, t.driver_phone].filter(Boolean).join(' · ')}
            />
          ))}
        </BriefSection>
      )}

      {/* Experiencers */}
      {activities.length > 0 && (
        <BriefSection title='Confirmed Activities'>
          {activities.map(a => (
            <BriefRow
              key={a.id}
              label={a.time_local ?? '—'}
              value={a.title}
              sub={[a.location, a.confirmation_number ? `Conf: ${a.confirmation_number}` : null].filter(Boolean).join(' · ')}
            />
          ))}
        </BriefSection>
      )}

      {/* Contacts across all events */}
      {(() => {
        const allContacts = allEvents.flatMap(e => e.contacts)
        const unique = Array.from(new Map(allContacts.map(c => [c.id, c])).values())
        if (unique.length === 0) return null
        return (
          <BriefSection title='Key Contacts'>
            {unique.map(c => (
              <BriefRow
                key={c.id}
                label={c.role}
                value={c.name}
                sub={c.phone ?? undefined}
              />
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
            borderRadius: 16,
            border:       `1px solid ${T.darkBorder}`,
            background:   T.darkCard,
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.darkLabel, marginBottom: 8, fontFamily: T.font }}>{contact.role}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.darkText, marginBottom: 4, fontFamily: T.font }}>{contact.name}</div>
            <a href={`tel:${contact.phone}`} style={{ fontSize: 13, color: T.gold, textDecoration: 'none', fontFamily: T.font }}>{contact.phone}</a>
          </div>
        ))}
      </div>

      {property.emergencies.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.darkBorder}`, paddingTop: 24 }}>
          <p style={{ fontSize: 11, color: T.darkLabel, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: T.font }}>Emergencies</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {property.emergencies.map(e => (
              <div key={e.label}>
                <div style={{ fontSize: 11, color: T.darkLabel, marginBottom: 2, fontFamily: T.font }}>{e.label}</div>
                <a href={`tel:${e.phone}`} style={{ fontSize: 14, fontWeight: 600, color: T.darkBody, textDecoration: 'none', fontFamily: T.font }}>{e.phone}</a>
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
    <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: T.bg }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: T.faint, marginBottom: 24, fontFamily: T.font }}>Welcome</p>
        {paragraphs.map((p: string, i: number) => (
          <p key={i} style={{
            fontSize:      i === 0 ? 'clamp(18px,2vw,24px)' : 16,
            lineHeight:    1.85,
            color:         i === 0 ? T.text : T.muted,
            fontWeight:    i === 0 ? 600 : 400,
            marginBottom:  i === paragraphs.length - 1 ? 0 : 20,
            letterSpacing: i === 0 ? '-0.01em' : 'normal',
            fontFamily:    T.font,
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
  booking:  Booking
  property: Property
  days:     JourneyDay[]
  isPublic?: boolean
}

export default function JourneyPage({ booking, property, days, isPublic = false }: JourneyPageProps) {
  const [heroVis, setHeroVis] = useState(false)
  const [tab, setTab]         = useState<JourneyTab>('itinerary')

  useEffect(() => {
    const t = setTimeout(() => setHeroVis(true), 120)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {/* Hero — identical mechanic to stays */}
      <PropertyIntroSection
        propertyName={property.name}
        location={property.location}
        tagline={property.tagline}
        photos={property.photos}
        heroVis={heroVis}
        checkIn={booking.checkIn}
        checkOut={booking.checkOut}
      />

      {/* Welcome letter */}
      <WelcomeLetter booking={booking} />

      {/* Dark tabbed shell */}
      <section style={{ background: T.bgDark, minHeight: '60vh' }}>
        {/* Sticky tab bar */}
        <div style={{
          position:    'sticky',
          top:         60, // clears ProgrammeLayout nav
          zIndex:      50,
          background:  T.bgDark,
          borderBottom:`1px solid ${T.darkBorder}`,
          padding:     '0 clamp(20px,5vw,48px)',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding:       '18px 24px',
                  border:        'none',
                  borderBottom:  tab === t.id ? `2px solid ${T.gold}` : '2px solid transparent',
                  background:    'transparent',
                  color:         tab === t.id ? T.gold : T.darkLabel,
                  fontSize:      12,
                  fontWeight:    tab === t.id ? 700 : 500,
                  letterSpacing: '0.04em',
                  fontFamily:    T.font,
                  cursor:        'pointer',
                  transition:    'all 0.2s ease',
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
      </section>
    </>
  )
}