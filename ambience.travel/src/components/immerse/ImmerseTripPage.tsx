// ImmerseTripPage.tsx — Unified client-facing trip surface for ambience.TRAVEL.
//
// The world's finest travel design platform — one intelligent surface where the
// designer's craft and the guest's experience converge. Every trip lives as one
// object: hero, welcome letter, confirmation, programme, brief, contacts.
//
// What it owns:
//   - ImmerseHero — cinematic full-bleed hero with trip title, dates, guest name
//   - Optional welcome letter between hero and tabs
//   - Four tabs (each admin-toggled via travel_trip_briefs show_tab_* columns):
//       Confirmation — accommodation cards + aux bookings (flights, transfers etc)
//       Programme    — day-by-day with collapsible left sidebar day navigator
//       Trip Brief   — structured summary (flights, hotels, transfers, contacts)
//       Contacts     — advisor + selected house people
//   - Collapsible left sidebar day navigator on Programme tab (desktop + mobile)
//   - Status pills via typesEventStatus (getEventStatusMeta) — single registry
//   - Clickable image gallery on event cards
//   - PDF download (confirmation brief + programme)
//
// What it does not own:
//   - Route resolution (ImmerseEngagementRoute.tsx)
//   - Data fetching primitives (queriesImmerseTrip.ts)
//   - PDF generation (pdfImmerseConfirmation.ts, pdfImmerseProgramme.ts)
//   - Edge Functions (get-trip-confirmation, get-trip-programme)
//
// Last updated:
//   S55 — room + passenger display single-sourced via utilsRoomDisplay
//     (webRoomDisplay / passengerName); no inline guest-name composition left here.
//   S54 — Contacts tab renders selected house people from the EF `contacts` array
//     (brief.contact_person_ids + contact_name_format); falls back to house.display_name.
//   S50 — show_tab_itinerary renamed to show_tab_programme; duplicate Guides block
//     removed from TripBriefTab.
//   S49 — mobile pass: unified nav bar, horizontal-scroll + right-padding fixes,
//     full image overlay chain in ConfirmationTab, Guides section in TripBriefTab.

import { useEffect, useState, useCallback } from 'react'
import ImmerseLayout                          from '../layouts/ImmerseLayout'
import ImmerseHero                            from './ImmerseHero'
import { fetchTripClientData } from '../../queries/queriesImmerseTrip'
import type { TripClientData } from '../../types/typesImmerseClient'
import type {
  ImmerseTripBooking as TripBooking,
  ImmerseTripAuxBooking as TripAuxBooking,
  ImmerseTripDay as TripDay,
  ImmerseTripDayEntry as TripDayEntry,
} from '../../types/typesImmerse'
import type { TimelineItem } from '../../types/typesTimeline'
import { groupAuxBySection, isFlightBooking, isTransferBooking, isHotelBooking, isGroundTransportBooking, isDiningBooking, isMeetGreetBooking } from '../../types/typesAuxBookings'
import { getEventStatusMeta }                 from '../../types/typesEventStatus'
import { useImmerseConfirmationPdf }          from '../../hooks/useImmerseConfirmationPdf'
import { useImmerseProgrammePdf }             from '../../hooks/useImmerseProgrammePdf'
import { isImmerseHost }                      from '../../utils/utilsImmersePath'
import { bookedByLabel, isOwnArrangements, categoryAccentHex } from '../../utils/utilsBooking'
import { webRoomDisplay, passengerName }      from '../../utils/utilsRoomDisplay'
import { fmtTime, localDateStr } from '../../utils/utilsDates'

// ── Edge Function endpoints ───────────────────────────────────────────────────

const CONFIRMATION_FN   = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/travel-get-trip-confirmation`
const PROGRAMME_FN      = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/travel-get-trip-programme`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ── Data types ────────────────────────────────────────────────────────────────

type TripData = {
  clientData: TripClientData
  days:       TripDay[]
  entries:    TimelineItem[]
}

type TabId = 'welcome' | 'confirmation' | 'programme' | 'brief' | 'contacts'

// S54 — resolved house contact (from travel-get-trip-confirmation `contacts`)
type TripContact = {
  id:    string
  name:  string
  role:  string | null
  email: string | null
  phone: string | null
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const CREAM   = '#F7F5F0'
const CARD_BG = '#F0EDE6'
const INK     = '#1A1D1A'
const GOLD    = '#C9A84C'
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const SANS    = "'Plus Jakarta Sans', sans-serif"
const SERIF   = "'Cormorant Garamond', Georgia, serif"
const SIDEBAR_W = 220

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function fmtDateFull(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
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
  return `${fmtDate(start)} \u2013 ${fmtDate(end)}`
}

function sortKey(time: string | null | undefined): number {
  if (!time) return 9999
  const [h, m] = time.split(':')
  return parseInt(h, 10) * 60 + parseInt(m ?? '0', 10)
}

// categoryAccent: single source in utilsBooking.ts → categoryAccentHex

// ── useWindowWidth ────────────────────────────────────────────────────────────

function useWindowWidth(): number {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string | null }) {
  const meta = getEventStatusMeta(status ?? 'recommended')
  return (
    <span style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding:       '3px 10px',
      borderRadius:  100,
      border:        `1px solid ${meta.color}50`,
      color:         meta.color,
      background:    `${meta.color}14`,
      fontFamily:    SANS,
      flexShrink:    0,
      whiteSpace:    'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// Dining cancellation/terms pill — single model, both surfaces.
// active + booking_terms → gold advisory; cancelled + penalty → red; cancelled no-penalty → neutral.
function diningPillModel(opts: {
  showCancellation: boolean | null
  diningStatus:     string | null
  penaltyApplied:   boolean | null
  cancellationNote: string | null
  bookingTerms:     string | null
}): { color: string; label: string } | null {
  if (opts.showCancellation === false) return null
  const cancelled = opts.diningStatus === 'cancelled'
  const penalty   = opts.penaltyApplied === true
  if (cancelled && penalty) return { color: '#B4321F', label: opts.cancellationNote ?? 'Cancelled — penalty applies' }
  if (cancelled)            return { color: MUTED,     label: opts.cancellationNote ?? 'Cancelled' }
  if (opts.bookingTerms)    return { color: GOLD,      label: opts.bookingTerms }
  return null
}

function DiningPillBox({ model }: { model: { color: string; label: string } | null }) {
  if (!model) return null
  return (
    <div style={{
      display: 'inline-block', marginTop: 6, padding: '6px 12px',
      border: `1px solid ${model.color}`, borderRadius: 8,
      background: `${model.color}0F`,
    }}>
      <span style={{ fontSize: 11, fontFamily: SANS, color: model.color, lineHeight: 1.5 }}>{model.label}</span>
    </div>
  )
}

function DiningPill({ aux }: { aux: TripAuxBooking }) {
  return <DiningPillBox model={diningPillModel({
    showCancellation: aux.show_cancellation ?? null,
    diningStatus:     aux.dining_status ?? null,
    penaltyApplied:   aux.cancellation_penalty_applied ?? null,
    cancellationNote: aux.cancellation_note ?? null,
    bookingTerms:     aux.venue?.booking_terms ?? null,
  })} />
}

// ── Image lightbox ────────────────────────────────────────────────────────────

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         200,
        background:     'rgba(10,12,10,0.92)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
        backdropFilter: 'blur(8px)',
      }}
    >
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth:     '92vw',
          maxHeight:    '88vh',
          borderRadius: 12,
          objectFit:    'contain',
          boxShadow:    '0 32px 80px rgba(0,0,0,0.6)',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position:       'absolute',
          top:            20,
          right:          24,
          background:     'rgba(255,255,255,0.1)',
          border:         '1px solid rgba(255,255,255,0.2)',
          borderRadius:   '50%',
          width:          40,
          height:         40,
          color:          '#fff',
          fontSize:       20,
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── Confirmation tab ──────────────────────────────────────────────────────────

function ConfirmationTab({ clientData }: { clientData: TripClientData }) {
  const { trip, brief, house, auxBookings } = clientData
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  const destHero = trip.destinations[0]?.hero_image_src ?? null

  const accomBookings = trip.bookings
    .filter(bk => bk.brief_show !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

const auxSections = groupAuxBySection(auxBookings)

  return (
    <div>
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

{/* Accommodation — one block per hotel, rooms nested beneath */}
      {accomBookings.length > 0 && (
        <TabSection label='ACCOMMODATION'>
          {accomBookings.map(booking => {
            const ownArr       = isOwnArrangements(booking.booked_by)
            const bookedByText = bookedByLabel(booking.booked_by)
            const pillColor    = ownArr ? FAINT : GOLD
            const hotelName    = booking._hotel_name ?? booking.name ?? 'Hotel'
            const dateRange    = buildDateRange(booking.check_in_date ?? booking.start_date, booking.end_date)
            const headerImg    = booking.brief_image_src ?? booking._hotel_image_src ?? destHero
            const rooms        = booking._rooms ?? []

            return (
              <div key={booking.id} style={{
                background: '#fff', border: `0.5px solid ${RULE}`,
                borderRadius: 12, overflow: 'hidden',
                boxSizing: 'border-box',
              }}>
                {/* Hotel header */}
                <div style={{ display: 'flex', minHeight: 100 }}>
                  <div
                    style={{
                      width: 'clamp(100px,30%,200px)', flexShrink: 0,
                      background: CARD_BG, position: 'relative', overflow: 'hidden',
                      cursor: headerImg ? 'zoom-in' : 'default',
                    }}
                    onClick={() => headerImg && setLightbox({ src: headerImg, alt: hotelName })}
                  >
                    {headerImg && <img src={headerImg} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 16, fontFamily: SERIF, color: INK, marginBottom: 4, lineHeight: 1.3 }}>{hotelName}</div>
                      {dateRange && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED }}>{dateRange}</div>}
                      {booking.check_in_note && <div style={{ fontSize: 10, fontFamily: SANS, color: GOLD, fontStyle: 'italic', marginTop: 2 }}>{booking.check_in_note}</div>}
                      {booking.check_out_note && <div style={{ fontSize: 10, fontFamily: SANS, color: GOLD, fontStyle: 'italic', marginTop: 2 }}>{booking.check_out_note}</div>}
                      {booking.start_time && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{`Check-in ${fmtTime(booking.start_time)}`}</div>}
                      {booking.party_composition && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{booking.party_composition}</div>}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {booking.payment_exception && (
                        <div style={{
                          display: 'inline-block', marginBottom: 6, padding: '3px 10px',
                          border: '1px solid #B4321F', borderRadius: 5, background: '#B4321F0F',
                        }}>
                          <span style={{ fontSize: 10, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B4321F' }}>Payment Outstanding</span>
                        </div>
                      )}
                      {/* Booking-level conf shows only when there are no rooms (each room carries its own) */}
                      {rooms.length === 0 && booking.confirmation_number && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center',
                          border: `1px solid ${pillColor}`, borderRadius: 5,
                          padding: '3px 10px', marginBottom: 6,
                          background: ownArr ? '#F5F5F5' : '#FAF7F0',
                        }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: pillColor }}>
                            Conf #: {booking.confirmation_number}
                          </span>
                        </div>
                      )}
                      {ownArr ? (
                        <span style={{
                          display: 'inline-block', fontFamily: SANS, fontSize: 9,
                          letterSpacing: '0.12em', color: MUTED,
                          border: `0.5px solid ${FAINT}`, borderRadius: 999,
                          padding: '3px 10px', whiteSpace: 'nowrap',
                        }}>Own Arrangements</span>
                      ) : (
                        <div style={{ fontSize: 11, fontFamily: SANS, fontStyle: 'italic', color: FAINT }}>{bookedByText}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nested rooms */}
                {rooms.length > 0 && (
                  <div style={{ borderTop: `0.5px solid ${RULE}` }}>
                    {rooms.map((room, ri) => {
                      const guests = webRoomDisplay(room).guestLine
                      return (
                        <div key={room.id ?? ri} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          gap: 16, padding: '12px 20px',
                          borderTop: ri > 0 ? `0.5px solid ${RULE}` : 'none',
                          flexWrap: 'wrap',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {room.room_name && <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{room.room_name}</div>}
                            {guests && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{guests}</div>}
                            {room.check_in_time && <div style={{ fontSize: 11, fontFamily: SANS, color: GOLD, marginTop: 2 }}>{`Check-in ${fmtTime(room.check_in_time)}`}</div>}
                          </div>
                          {room.confirmation_number && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                              border: `1px solid ${pillColor}`, borderRadius: 5,
                              padding: '3px 10px',
                              background: ownArr ? '#F5F5F5' : '#FAF7F0',
                            }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: pillColor }}>
                                Conf #: {room.confirmation_number}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </TabSection>
      )}

      {/* Aux sections */}
      {auxSections.map(section => (
        <TabSection key={section.type} label={section.label}>
          {section.items.map(aux => {
            const ownArr    = isOwnArrangements(aux.booked_by)
            const pillColor = ownArr ? FAINT : GOLD
            const timeStr    = [fmtTime(aux.start_time), fmtTime(aux.end_time)].filter(Boolean).join(' – ')
            const route      = [aux.origin, aux.destination].filter(Boolean).join(' \u2192 ')

            return (
              <div key={aux.id} style={{
                background: '#fff', border: `0.5px solid ${RULE}`,
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 16,
                boxSizing: 'border-box',
              }}>
                <div style={{ fontSize: 22, color: GOLD, flexShrink: 0, lineHeight: 1, paddingTop: 2 }}>{section.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {aux.name && <div style={{ fontSize: 16, fontFamily: SERIF, color: aux.dining_status === 'cancelled' ? FAINT : INK, marginBottom: 3, textDecoration: aux.dining_status === 'cancelled' ? 'line-through' : 'none' }}>{aux.name}</div>}
                  {route && <div style={{ fontSize: 12, fontFamily: SANS, color: MUTED, wordBreak: 'break-word' }}>{route}</div>}
                  {aux.start_date && <div style={{ fontSize: 11, fontFamily: SANS, color: FAINT, marginTop: 2 }}>{fmtDate(aux.start_date)}</div>}
                  {timeStr && <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 700, color: INK, marginTop: 4 }}>{timeStr}</div>}
                  {[aux.cabin_class, aux.aircraft_type].filter(Boolean).length > 0 && (
                    <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 4 }}>
                      {[aux.cabin_class, aux.aircraft_type].filter(Boolean).join(' \u00b7 ')}
                    </div>
                  )}
                  {ownArr && (
                    <span style={{
                      display: 'inline-block', marginTop: 6, fontFamily: SANS, fontSize: 9,
                      letterSpacing: '0.12em', color: MUTED,
                      border: `0.5px solid ${FAINT}`, borderRadius: 999,
                      padding: '3px 10px', whiteSpace: 'nowrap',
                    }}>Own Arrangements</span>
                  )}
                  {(() => {
                    const pax = (aux.passengers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
                    if (pax.length === 0) return null
                    return (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pax.map(p => {
                          const detail = [
                            p.confirmation_number ? `Conf ${p.confirmation_number}` : null,
                            p.seat_numbers ? `Seats ${p.seat_numbers}` : null,
                          ].filter(Boolean).join('  \u00b7  ')
                          return (
                            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: SANS }}>{passengerName(p)}</span>
                              {detail && <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>{detail}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  {(() => {
                    const isGroundCar = isGroundTransportBooking(aux.booking_type)
                    const veh = isGroundCar ? (aux.driver_details ?? []).slice().sort((a, b) => a.sort_order - b.sort_order) : []
                    if (veh.length === 0) return null
                    return (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {veh.map(v => (
                          <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: SANS }}>{v.driver_name || 'Driver'}</span>
                            {v.vehicle_role && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD, fontFamily: SANS }}>{v.vehicle_role}</span>}
                            <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>
                              {[v.driver_phone, v.car_model, v.plate].filter(Boolean).join('  \u00b7  ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {isMeetGreetBooking(aux.booking_type) && (aux.contact_name || aux.contact_phone) && (
                    <div style={{ marginTop: 8 }}>
                      {aux.contact_name && <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK }}>{aux.contact_name}</div>}
                      {aux.contact_phone && (
                        <a href={`tel:${aux.contact_phone.replace(/\s+/g, '')}`} style={{ display: 'inline-block', fontSize: 12, fontFamily: SANS, color: GOLD, textDecoration: 'none', marginTop: 2 }}>{aux.contact_phone}</a>
                      )}
                      {aux.notes && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, fontStyle: 'italic', marginTop: 2 }}>{aux.notes}</div>}
                    </div>
                  )}
                  {isDiningBooking(aux.booking_type) && (() => {
                    const v = aux.venue
                    const guestLine = [aux.guest_name, aux.guest_count ? `${aux.guest_count} guests` : null].filter(Boolean).join('  \u00b7  ')
                    const rows: { label: string; value: string }[] = []
                    if (v?.address)         rows.push({ label: 'Address',  value: v.address })
                    if (v?.phone)           rows.push({ label: 'Phone',    value: v.phone })
                    if (v?.dress_code)      rows.push({ label: 'Dress',    value: v.dress_code })
                    if (v?.children_policy) rows.push({ label: 'Children', value: v.children_policy })
                    if (v?.table_hold_note) rows.push({ label: 'Table',    value: v.table_hold_note })
                    return (
                      <div style={{ marginTop: 8 }}>
                        {guestLine && <div style={{ fontSize: 12, fontFamily: SANS, color: MUTED, marginBottom: rows.length ? 8 : 0 }}>{guestLine}</div>}
                        {rows.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: i ? 4 : 0, flexWrap: 'wrap' }}>
                            <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT }}>{r.label}</div>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: SANS, color: INK, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {r.label === 'Address' && v?.maps_url
                                ? <a href={v.maps_url} target='_blank' rel='noopener noreferrer' style={{ color: GOLD, textDecoration: 'none' }}>{r.value}</a>
                                : r.value}
                            </div>
                          </div>
                        ))}
                        <DiningPill aux={aux} />
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </TabSection>
      ))}
    </div>
  )
}

// ── Programme tab ─────────────────────────────────────────────────────────────

function ProgrammeTab({ days, entries, onActiveDayChange, brief }: {
  days:               TripDay[]
  entries:            TimelineItem[]
  brief:              any
  onActiveDayChange?: (label: string, openSidebar: () => void) => void
}) {
  const visibleDays = days.filter(d => d.show)
  const defaultDate = visibleDays.find(d => d.entry_date === localDateStr())?.entry_date ?? visibleDays[0]?.entry_date ?? null
  const [activeDate,  setActiveDate]  = useState(defaultDate)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lightbox,    setLightbox]    = useState<{ src: string; alt: string } | null>(null)
  const width    = useWindowWidth()
  const isMobile = width < 768

  const activeDay = visibleDays.find(d => d.entry_date === activeDate) ?? null

  useEffect(() => {
    if (!onActiveDayChange) return
    const idx      = visibleDays.findIndex(d => d.entry_date === activeDate)
    const dayN     = idx >= 0 ? `Day ${idx + 1}` : null
    const label    = activeDay
      ? (activeDay.day_label || fmtDateShort(activeDay.entry_date))
      : 'Select day'
    const combined = dayN ? `${dayN} · ${label}` : label
    onActiveDayChange(combined, () => setSidebarOpen(true))
  }, [activeDate, onActiveDayChange])

  type CardItem = {
    id: string; category: string | null; categoryLabel: string | null; start_time: string | null
    end_time: string | null; title: string; subtitle: string | null
    notes: string | null; confirmation_number: string | null
    guest_label: string | null; booked_by: string | null
    image_src: string | null; status: string | null
    checkInNote:  string | null
    checkOutNote: string | null
    description: string | null
    bookingType:   string | null
    contactName:   string | null
    contactPhone:  string | null
    guestName:     string | null
    guestCount:    number | null
    diningStatus:  string | null
    cancellationPenaltyApplied: boolean | null
    cancellationNote: string | null
    showCancellation: boolean | null
    venue: { address: string | null; maps_url: string | null; phone: string | null; dress_code: string | null; children_policy: string | null; table_hold_note: string | null; booking_terms: string | null } | null
    flightOrigin:      string | null
    flightDestination: string | null
    flightDepartTime:  string | null
    flightArriveTime:  string | null
    seatNumbers:       string | null
    cabinClass:        string | null
    passengers:        { id: string; passenger_label: string | null; resolved_passenger_label?: string | null; confirmation_number: string | null; seat_numbers: string | null; sort_order: number }[]
    rooms:             { id: string; guest: string | null; room_name: string | null; party_composition: string | null; confirmation_number: string | null; notes: string | null; check_in_time: string | null }[]
    driverDetails:     { id: string; driver_name: string | null; driver_phone: string | null; car_model: string | null; plate: string | null; vehicle_role: string | null; sort_order: number }[]
  }

// The EF (_shared/timeline.ts) already merged + ordered the stream. Filter by
  // active day and map each TimelineItem to the card shape. No client derivation.
  const cards: CardItem[] = activeDay
    ? entries
        .filter(e => e.entry_date === activeDay.entry_date && e.brief_show)
        .map(e => {
          const isFlight = (e.category === 'flight' || e.category === 'private_jet') && e.kind === 'aux'
          let flightOrigin:      string | null = null
          let flightDestination: string | null = null
          if (isFlight && e.subtitle) {
            const parts = e.subtitle.split('\u2192').map(s => s.trim())
            if (parts.length >= 2) {
              flightOrigin      = parts[0] || null
              // subtitle may carry extra " · cabin · aircraft" after the arrow; take up to the first ·
              flightDestination = (parts[1].split('\u00b7')[0] || '').trim() || null
            }
          }
          return {
            id:                  e.id,
            category:            e.category,
            categoryLabel:       e.categoryLabel,
            start_time:          e.start_time,
            end_time:            e.end_time,
            title:               e.title,
            subtitle:            isFlight ? null : e.subtitle,
            notes:               e.notes,
            confirmation_number: e.confirmation_number,
            guest_label:         e.guest_label,
            booked_by:           e.booked_by,
            image_src:           e.image_src,
            status:              e.status,
            checkInNote:         e.check_in_note ?? null,
            checkOutNote:        e.check_out_note ?? null,
            description:         null,
            bookingType:         e.category,
            contactName:         e.contact_name ?? null,
            contactPhone:        e.contact_phone ?? null,
            guestName:           e.guest_name ?? null,
            guestCount:          e.guest_count ?? null,
            diningStatus:        e.dining_status ?? null,
            cancellationPenaltyApplied: e.cancellation_penalty_applied ?? null,
            cancellationNote:    e.cancellation_note ?? null,
            showCancellation:    e.show_cancellation ?? null,
            venue:               e.venue ?? null,
            flightOrigin,
            flightDestination,
            flightDepartTime:    isFlight ? e.start_time : null,
            flightArriveTime:    isFlight ? e.end_time   : null,
            seatNumbers:         null,
            cabinClass:          null,
            passengers:          e.passengers.map(p => ({
              id:                       p.id,
              passenger_label:          p.passenger_label,
              resolved_passenger_label: p.resolved_passenger_label,
              confirmation_number:      p.confirmation_number,
              seat_numbers:             p.seat_numbers,
              sort_order:               p.sort_order,
            })),
            rooms:               e.rooms.map(r => ({
              id:                  r.id,
              guest:               r.guest,
              room_name:           r.room_name,
              party_composition:   r.party_composition,
              confirmation_number: r.confirmation_number,
              notes:               r.notes,
              check_in_time:       r.check_in_time,
            })),
            driverDetails:       (e.driver_details ?? []).map(d => ({
              id:           d.id,
              driver_name:  d.driver_name,
              driver_phone: d.driver_phone,
              car_model:    d.car_model,
              plate:        d.plate,
              vehicle_role: d.vehicle_role,
              sort_order:   d.sort_order,
            })),
          }
        })
    : []

  return (
    <div style={{ display: 'flex', minHeight: '60vh', position: 'relative' }}>
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {(!isMobile || sidebarOpen) && (
        <div style={{
          width:         sidebarOpen ? SIDEBAR_W : 48,
          flexShrink:    0,
          borderRight:   `1px solid ${RULE}`,
          background:    CREAM,
          position:      isMobile ? 'fixed' : 'sticky',
          top:           isMobile ? 0 : 0,
          left:          isMobile ? 0 : 'auto',
          height:        isMobile ? '100vh' : 'auto',
          zIndex:        isMobile ? 100 : 1,
          overflowY:     'auto',
          transition:    'width 200ms ease',
          display:       'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            padding:        sidebarOpen ? '14px 16px 10px' : '14px 0 10px',
            borderBottom:   `1px solid ${RULE}`,
            flexShrink:     0,
          }}>
            {sidebarOpen && (
              <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT }}>
                Days
              </span>
            )}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     'transparent',
                border:         'none',
                cursor:         'pointer',
                color:          GOLD,
                fontSize:       16,
                fontWeight:     700,
                padding:        '4px 8px',
                lineHeight:     1,
                transition:     'opacity 150ms',
                flexShrink:     0,
              }}
              title={sidebarOpen ? 'Collapse' : 'Expand'}
            >
              {sidebarOpen ? '\u2039' : '\u203a'}
            </button>
          </div>

          {sidebarOpen && (
            <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
              {visibleDays.map((day, i) => {
                const isActive = day.entry_date === activeDate
                return (
                  <button
                    key={day.entry_date}
                    onClick={() => { setActiveDate(day.entry_date); if (isMobile) setSidebarOpen(false) }}
                    style={{
                      width:      '100%',
                      textAlign:  'left',
                      padding:    '10px 16px',
                      border:     'none',
                      borderLeft: `3px solid ${isActive ? GOLD : 'transparent'}`,
                      background: isActive ? `${GOLD}0A` : 'transparent',
                      cursor:     'pointer',
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isActive ? GOLD : FAINT, marginBottom: 2 }}>
                      Day {i + 1}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: SANS, fontWeight: isActive ? 700 : 400, color: isActive ? INK : MUTED, lineHeight: 1.3 }}>
                      {day.day_label || fmtDateShort(day.entry_date)}
                    </div>
                  </button>
                )
              })}
            </nav>
          )}
        </div>
      )}

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.3)' }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {activeDay ? (
          <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,5vw,56px)' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
                {activeDay.day_label || ''}
              </div>
              <div style={{ fontSize: 'clamp(22px,3vw,32px)', fontFamily: SERIF, color: INK, lineHeight: 1.2, marginBottom: 14 }}>
                {fmtDateFull(activeDay.entry_date)}
              </div>
              {activeDay.day_note && (
                <div style={{ fontSize: 13, fontFamily: SANS, color: MUTED, fontStyle: 'italic', marginBottom: 12 }}>
                  {activeDay.day_note}
                </div>
              )}
              <div style={{ height: 1, background: RULE }} />
            </div>

            {cards.length === 0 ? (
              <div style={{ fontSize: 13, fontFamily: SANS, color: FAINT, fontStyle: 'italic' }}>Nothing planned today.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cards.map(item => {
                  const accent      = categoryAccentHex(item.category)
                  const dep         = fmtTime(item.start_time)
                  const arr         = fmtTime(item.end_time)
                  const isFlight    = !!(item.flightOrigin || item.flightDestination || item.flightDepartTime || item.flightArriveTime)
                  const timeStr     = isFlight ? null : (dep && arr ? `${dep} \u2013 ${arr}` : dep || arr || null)
                  const isMobileW   = width < 600
                  const stackLayout = isMobileW && !!item.image_src

                  // Hotel stays render in the Confirmation card style (concise image
                  // header + clean nested rooms), not the generic programme card.
                  const isHotelStay = item.category === 'stay' && item.rooms.length > 0
                  if (isHotelStay) {
                    return (
                      <div key={item.id} style={{
                        background: '#fff', border: `0.5px solid ${RULE}`,
                        borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box',
                      }}>
                        <div style={{ display: 'flex', minHeight: 100 }}>
                          {item.image_src && (
                            <div
                              style={{
                                width: 'clamp(100px,30%,200px)', flexShrink: 0,
                                background: CARD_BG, position: 'relative', overflow: 'hidden',
                                cursor: 'zoom-in',
                              }}
                              onClick={() => setLightbox({ src: item.image_src!, alt: item.title })}
                            >
                              <img src={item.image_src} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>
                                  {item.categoryLabel ?? 'Hotel'}
                                </span>
                                {item.status && <StatusPill status={item.status} />}
                              </div>
                              <div style={{ fontSize: 16, fontFamily: SERIF, color: INK, lineHeight: 1.3 }}>{item.title}</div>
                              {item.checkInNote && <div style={{ fontSize: 10, fontFamily: SANS, color: GOLD, fontStyle: 'italic', marginTop: 2 }}>{item.checkInNote}</div>}
                              {item.checkOutNote && <div style={{ fontSize: 10, fontFamily: SANS, color: GOLD, fontStyle: 'italic', marginTop: 2 }}>{item.checkOutNote}</div>}
                              {item.start_time && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{`Check-in ${fmtTime(item.start_time)}`}</div>}
                            </div>
                            {bookedByLabel(item.booked_by) && (
                              <div style={{ fontSize: 11, fontFamily: SANS, fontStyle: 'italic', color: FAINT, marginTop: 8 }}>{bookedByLabel(item.booked_by)}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ borderTop: `0.5px solid ${RULE}` }}>
                          {item.rooms.map((room, ri) => {
                            const rd = webRoomDisplay({ guest_name: room.guest, party_composition: room.party_composition, room_name: room.room_name })
                            return (
                              <div key={room.id} style={{
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                                gap: 16, padding: '12px 20px',
                                borderTop: ri > 0 ? `0.5px solid ${RULE}` : 'none',
                                flexWrap: 'wrap',
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {rd.roomName && <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{rd.roomName}</div>}
                                  {rd.guestLine && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{rd.guestLine}</div>}
                                  {room.check_in_time && <div style={{ fontSize: 11, fontFamily: SANS, color: GOLD, marginTop: 2 }}>{`Check-in ${fmtTime(room.check_in_time)}`}</div>}
                                  {room.notes && <div style={{ fontSize: 11, fontFamily: SANS, color: FAINT, fontStyle: 'italic', marginTop: 2 }}>{room.notes}</div>}
                                </div>
                                {room.confirmation_number && (
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                                    border: `1px solid ${GOLD}`, borderRadius: 5, padding: '3px 10px', background: '#FAF7F0',
                                  }}>
                                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: GOLD }}>Conf #: {room.confirmation_number}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  // Airport greeter — concise card: who's meeting, phone, flight ref, time.
                  if (isMeetGreetBooking(item.bookingType) && (item.contactName || item.contactPhone)) {
                    return (
                      <div key={item.id} style={{
                        background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 12,
                        overflow: 'hidden', borderLeft: `3px solid ${accent}`,
                        padding: '16px 20px', boxSizing: 'border-box',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>
                            {item.categoryLabel ?? 'Airport Meet & Greet'}
                          </span>
                          {timeStr && <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK }}>{timeStr}</span>}
                        </div>
                        <div style={{ fontSize: 'clamp(14px,1.8vw,17px)', fontFamily: SERIF, color: INK, lineHeight: 1.3, marginBottom: 6 }}>{item.title}</div>
                        {item.contactName && <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK }}>{item.contactName}</div>}
                        {item.contactPhone && (
                          <a href={`tel:${item.contactPhone.replace(/\s+/g, '')}`} style={{ display: 'inline-block', fontSize: 12, fontFamily: SANS, color: GOLD, textDecoration: 'none', marginTop: 2 }}>{item.contactPhone}</a>
                        )}
                        {item.notes && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, fontStyle: 'italic', marginTop: 4 }}>{item.notes}</div>}
                      </div>
                    )
                  }

                  // Dining — essentials inline + pill + collapsible reservation details.
                  if (item.bookingType === 'dining') {
                    const pill = diningPillModel({
                      showCancellation: item.showCancellation,
                      diningStatus:     item.diningStatus,
                      penaltyApplied:   item.cancellationPenaltyApplied,
                      cancellationNote: item.cancellationNote,
                      bookingTerms:     item.venue?.booking_terms ?? null,
                    })
                    const cancelled = item.diningStatus === 'cancelled'
                    const essentials = [item.guestName, item.guestCount ? `${item.guestCount} guests` : null].filter(Boolean).join('  \u00b7  ')
                    const v = item.venue
                    const hasDetails = !!(v?.address || v?.phone || v?.dress_code || v?.children_policy || v?.table_hold_note)
                    return (
                      <div key={item.id} style={{
                        background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 12,
                        overflow: 'hidden', display: 'flex',
                        flexDirection: stackLayout ? 'column' : 'row',
                        minHeight: (!stackLayout && item.image_src) ? 140 : 'auto',
                        boxSizing: 'border-box',
                      }}>
                        {item.image_src && (
                          <div
                            style={{ width: stackLayout ? '100%' : 'clamp(120px,28%,200px)', height: stackLayout ? 200 : 'auto', flexShrink: 0, background: CARD_BG, position: 'relative', overflow: 'hidden', cursor: 'zoom-in' }}
                            onClick={() => setLightbox({ src: item.image_src!, alt: item.title })}
                          >
                            <img src={item.image_src} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent }} />
                          </div>
                        )}
                        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', minWidth: 0, borderLeft: (!stackLayout && !item.image_src) ? `3px solid ${accent}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>{item.categoryLabel ?? 'Dining'}</span>
                            </div>
                            {timeStr && <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK }}>{timeStr}</span>}
                          </div>
                          <div style={{ fontSize: 'clamp(14px,1.8vw,17px)', fontFamily: SERIF, color: cancelled ? FAINT : INK, lineHeight: 1.3, marginBottom: 4, textDecoration: cancelled ? 'line-through' : 'none' }}>{item.title}</div>
                          {essentials && <div style={{ fontSize: 12, fontFamily: SANS, color: MUTED }}>{essentials}</div>}
                          <DiningPillBox model={pill} />
                          {hasDetails && (
                            <details style={{ marginTop: 10 }}>
                              <summary style={{ fontSize: 10, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD, cursor: 'pointer', listStyle: 'none' }}>Reservation details</summary>
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {v?.address && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT }}>Address</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: SANS, color: INK, lineHeight: 1.5, wordBreak: 'break-word' }}>
                                      {v.maps_url ? <a href={v.maps_url} target='_blank' rel='noopener noreferrer' style={{ color: GOLD, textDecoration: 'none' }}>{v.address}</a> : v.address}
                                    </div>
                                  </div>
                                )}
                                {v?.phone && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT }}>Phone</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: SANS, color: INK }}>{v.phone}</div>
                                  </div>
                                )}
                                {v?.dress_code && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT }}>Dress</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: SANS, color: INK, lineHeight: 1.5 }}>{v.dress_code}</div>
                                  </div>
                                )}
                                {v?.children_policy && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT }}>Children</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: SANS, color: INK, lineHeight: 1.5 }}>{v.children_policy}</div>
                                  </div>
                                )}
                                {v?.table_hold_note && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT }}>Table</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: SANS, color: INK, lineHeight: 1.5 }}>{v.table_hold_note}</div>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                          {item.notes && <div style={{ fontSize: 11, fontFamily: SANS, color: FAINT, fontStyle: 'italic', lineHeight: 1.5, marginTop: 6 }}>{item.notes}</div>}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={item.id} style={{
                      background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 12,
                      overflow: 'hidden', display: 'flex',
                      flexDirection: stackLayout ? 'column' : 'row',
                      minHeight: (!stackLayout && item.image_src) ? 140 : 'auto',
                      boxSizing: 'border-box',
                    }}>
                      {item.image_src && (
                        <div
                          style={{
                            width: stackLayout ? '100%' : 'clamp(120px,28%,200px)',
                            height: stackLayout ? 200 : 'auto',
                            flexShrink: 0, background: CARD_BG,
                            position: 'relative', overflow: 'hidden', cursor: 'zoom-in',
                          }}
                          onClick={() => setLightbox({ src: item.image_src!, alt: item.title })}
                        >
                          <img src={item.image_src} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent }} />
                        </div>
                      )}

                      <div style={{
                        flex: 1, padding: '16px 20px', display: 'flex',
                        flexDirection: 'column', minWidth: 0,
                        borderLeft: (!stackLayout && !item.image_src) ? `3px solid ${accent}` : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>
                              {item.categoryLabel ?? item.category ?? 'Other'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {item.status && <StatusPill status={item.status} />}
                            {timeStr && <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK }}>{timeStr}</span>}
                          </div>
                        </div>

                        <div style={{ fontSize: 'clamp(14px,1.8vw,17px)', fontFamily: SERIF, color: INK, lineHeight: 1.3, marginBottom: 4 }}>
                          {item.title}
                        </div>

                        {item.rooms.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {item.rooms.map(room => {
                              const rd = webRoomDisplay({ guest_name: room.guest, party_composition: room.party_composition, room_name: room.room_name })
                              return (
                                <div key={room.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      {rd.roomName && <span style={{ display: 'block', fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{rd.roomName}</span>}
                                      {rd.guestLine && <span style={{ display: 'block', fontSize: 12, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{rd.guestLine}</span>}
                                    </div>
                                    {room.confirmation_number && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                                        border: `1px solid ${GOLD}`, borderRadius: 4, padding: '1px 8px', background: '#FAF7F0',
                                      }}>
                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: GOLD }}>Conf #: {room.confirmation_number}</span>
                                      </span>
                                    )}
                                  </div>
                                  {room.notes && <span style={{ fontSize: 11, fontFamily: SANS, color: FAINT, fontStyle: 'italic' }}>{room.notes}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {isFlight && (item.flightOrigin || item.flightDestination) && (
                          <div style={{
                            marginTop: 10, marginBottom: 8,
                            padding: '10px 12px',
                            background: CARD_BG,
                            borderRadius: 6,
                            display: 'flex', flexDirection: 'column', gap: 6,
                          }}>
                            {item.flightOrigin && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{
                                  width: 64, flexShrink: 0,
                                  fontSize: 9, fontFamily: SANS, fontWeight: 700,
                                  letterSpacing: '0.12em', textTransform: 'uppercase',
                                  color: FAINT,
                                }}>
                                  Departure
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: SANS, color: INK, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {item.flightOrigin}
                                </div>
                                {item.flightDepartTime && (
                                  <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK, flexShrink: 0 }}>
                                    {fmtTime(item.flightDepartTime)}
                                  </div>
                                )}
                              </div>
                            )}
                            {item.flightDestination && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{
                                  width: 64, flexShrink: 0,
                                  fontSize: 9, fontFamily: SANS, fontWeight: 700,
                                  letterSpacing: '0.12em', textTransform: 'uppercase',
                                  color: FAINT,
                                }}>
                                  Arrival
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: SANS, color: INK, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {item.flightDestination}
                                </div>
                                {item.flightArriveTime && (
                                  <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK, flexShrink: 0 }}>
                                    {fmtTime(item.flightArriveTime)}
                                  </div>
                                )}
                              </div>
                            )}
                            {item.cabinClass && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{
                                  width: 64, flexShrink: 0,
                                  fontSize: 9, fontFamily: SANS, fontWeight: 700,
                                  letterSpacing: '0.12em', textTransform: 'uppercase',
                                  color: FAINT,
                                }}>
                                  Cabin
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: SANS, color: INK, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {item.cabinClass}
                                </div>
                              </div>
                            )}
                            {item.passengers.length > 0 ? (
                              item.passengers.map(p => {
                                const detail = [
                                  p.confirmation_number ? `Conf ${p.confirmation_number}` : null,
                                  p.seat_numbers ? `Seats ${p.seat_numbers}` : null,
                                ].filter(Boolean).join('  \u00b7  ')
                                return (
                                  <div key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT }}>
                                      Guest
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: SANS, color: INK, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                      <span style={{ fontWeight: 600 }}>{p.resolved_passenger_label || p.passenger_label || 'Guest'}</span>
                                      {detail && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: MUTED }}>{`  ${detail}`}</span>}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              item.seatNumbers && (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                  <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT }}>
                                    Seats
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: SANS, color: INK, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                    {item.seatNumbers}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {item.subtitle && <div style={{ fontSize: 12, fontFamily: SANS, color: MUTED, marginBottom: 4 }}>{item.subtitle}</div>}
                        {item.notes && <div style={{ fontSize: 11, fontFamily: SANS, color: FAINT, fontStyle: 'italic', lineHeight: 1.5 }}>{item.notes}</div>}

                        {item.driverDetails.length > 0 && (
                          <div style={{ marginTop: 10, marginBottom: 8, padding: '10px 12px', background: CARD_BG, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {item.driverDetails.map(v => (
                              <div key={v.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT }}>
                                  {v.vehicle_role || 'Driver'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: SANS, color: INK, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  <span style={{ fontWeight: 600 }}>{v.driver_name || 'Driver'}</span>
                                  {[v.driver_phone, v.car_model, v.plate].filter(Boolean).length > 0 && (
                                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: MUTED }}>{`  ${[v.driver_phone, v.car_model, v.plate].filter(Boolean).join('  \u00b7  ')}`}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.passengers.length === 0 && item.confirmation_number && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${RULE}` }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${GOLD}`, borderRadius: 4, padding: '1px 8px', background: '#FAF7F0' }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: GOLD }}>Conf #: {item.confirmation_number}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,5vw,56px)', fontSize: 13, fontFamily: SANS, color: FAINT, fontStyle: 'italic' }}>
            No programme days available yet.
          </div>
        )}

        {brief?.programme_notes?.trim() && (
          <div style={{
            padding:   'clamp(20px,4vw,36px) clamp(20px,5vw,56px)',
            borderTop: `1px solid ${RULE}`,
          }}>
            <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
              Notes
            </div>
            <div style={{ fontSize: 13, fontFamily: SANS, color: MUTED, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {brief.programme_notes}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Trip Brief tab ────────────────────────────────────────────────────────────

function TripBriefTab({ clientData }: {
  clientData: TripClientData
}) {
  const { trip, house, auxBookings } = clientData

  const flights   = auxBookings.filter(a => isFlightBooking(a.booking_type))
  const transfers = auxBookings.filter(a => isTransferBooking(a.booking_type))
  const hotels    = trip.bookings.filter(b => isHotelBooking(b.booking_type) && b.brief_show !== false)

  function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD, fontFamily: SANS, marginBottom: 14 }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  function BriefRow({ label, value, sub, bookedBy, cancelled, cancellationNote }: { label: string; value: string; sub?: string; bookedBy?: string; cancelled?: boolean; cancellationNote?: string | null }) {
    return (
      <div style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
        <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: FAINT, fontFamily: SANS }}>{label}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: cancelled ? FAINT : INK, fontFamily: SANS, wordBreak: 'break-word', textDecoration: cancelled ? 'line-through' : 'none' }}>{value}</span>
            {cancelled && <span style={{ fontSize: 8, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B4321F', border: '1px solid #B4321F', borderRadius: 4, padding: '1px 6px' }}>Cancelled</span>}
          </div>
          {sub      && <div style={{ fontSize: 11, color: MUTED, fontFamily: SANS, marginTop: 2, wordBreak: 'break-word' }}>{sub}</div>}
          {cancelled && cancellationNote && <div style={{ fontSize: 11, color: '#B4321F', fontFamily: SANS, marginTop: 2, wordBreak: 'break-word' }}>{cancellationNote}</div>}
          {bookedBy && <div style={{ fontSize: 11, color: FAINT, fontFamily: SANS, marginTop: 2, fontStyle: 'italic' }}>{bookedBy}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,6vw,80px)' }}>
      <BriefSection title='Overview'>
        <BriefRow label='Guest'        value={house?.display_name ?? trip.destinations[0]?.name ?? ''} />
        <BriefRow label='Trip'         value={clientData.brief?.brief_title ?? trip.destinations[0]?.name ?? ''} />
        {trip.start_date      && <BriefRow label='Departure'    value={fmtDate(trip.start_date)} />}
        {trip.end_date        && <BriefRow label='Return'       value={fmtDate(trip.end_date)} />}
        {trip.duration_nights && <BriefRow label='Duration'     value={`${trip.duration_nights} nights`} />}
        {trip.destinations.length > 0 && <BriefRow label='Destinations' value={trip.destinations.map(d => d.name).join(', ')} />}
      </BriefSection>

      {hotels.length > 0 && (
        <BriefSection title='Accommodation'>
          {hotels.map(h => {
            const rooms = h._rooms ?? []
            // Group room categories with counts (e.g. "Deluxe King Terrace ×4")
            const catCounts = rooms.reduce((acc: Record<string, number>, r: any) => {
              const name = r.room_name ?? 'Room'
              acc[name] = (acc[name] ?? 0) + 1
              return acc
            }, {})
            const categories = Object.entries(catCounts)
              .map(([name, n]) => (n > 1 ? `${name} \u00d7${n}` : name))
            return (
              <div key={h.id} style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: FAINT, fontFamily: SANS }}>
                  {buildDateRange(h.check_in_date ?? h.start_date, h.end_date) || '\u2014'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: SANS, wordBreak: 'break-word' }}>
                    {h._hotel_name ?? h.name ?? 'Hotel'}
                  </div>
                  {h.nights && <div style={{ fontSize: 11, color: MUTED, fontFamily: SANS, marginTop: 2 }}>{`${h.nights} nights`}</div>}
                  {h.check_in_note && <div style={{ fontSize: 11, color: GOLD, fontFamily: SANS, fontStyle: 'italic', marginTop: 2, wordBreak: 'break-word' }}>{h.check_in_note}</div>}
                  {categories.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {categories.map((c, i) => (
                        <div key={i} style={{ fontSize: 11, color: MUTED, fontFamily: SANS, wordBreak: 'break-word' }}>{c}</div>
                      ))}
                    </div>
                  )}
                  {bookedByLabel(h.booked_by) && (
                    <div style={{ fontSize: 11, color: FAINT, fontFamily: SANS, marginTop: 2, fontStyle: 'italic' }}>{bookedByLabel(h.booked_by)}</div>
                  )}
                </div>
              </div>
            )
          })}
        </BriefSection>
      )}

      {flights.length > 0 && (
        <BriefSection title='Flights'>
          {flights.map(f => {
            const route = [f.origin, f.destination].filter(Boolean).join(' \u2192 ')
            const cabin = f.cabin_class ?? null
            const aircraft = f.aircraft_type ?? null
            const flightMeta = [route, cabin, aircraft].filter(Boolean).join('  \u00b7  ')
            const pax = (f.passengers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)

            return (
              <div key={f.id} style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: FAINT, fontFamily: SANS }}>
                  {f.start_date ? fmtDate(f.start_date) : '\u2014'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: SANS, wordBreak: 'break-word' }}>
                    {f.name ?? 'Flight'}
                  </div>
                  {flightMeta && (
                    <div style={{ fontSize: 11, color: MUTED, fontFamily: SANS, marginTop: 2, wordBreak: 'break-word' }}>
                      {flightMeta}
                    </div>
                  )}

                  {pax.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {pax.map(p => {
                        const detail = [
                          p.confirmation_number ? `Conf ${p.confirmation_number}` : null,
                          p.seat_numbers ? `Seats ${p.seat_numbers}` : null,
                        ].filter(Boolean).join('  \u00b7  ')
                        return (
                          <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: SANS }}>
                              {passengerName(p)}
                            </div>
                            {detail && (
                              <div style={{ fontSize: 11, color: MUTED, fontFamily: 'DM Mono, monospace' }}>
                                {detail}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {bookedByLabel(f.booked_by) && (
                    <div style={{ fontSize: 11, color: FAINT, fontFamily: SANS, marginTop: 4, fontStyle: 'italic' }}>
                      {bookedByLabel(f.booked_by)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </BriefSection>
      )}

      {transfers.length > 0 && (
        <BriefSection title='Transfers'>
          {transfers.map(t => {
            const route = [t.origin, t.destination].filter(Boolean).join(' \u2192 ')
            const veh = (t.driver_details ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
            return (
              <div key={t.id} style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: FAINT, fontFamily: SANS }}>
                  {t.start_date ? fmtDate(t.start_date) : '\u2014'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: SANS, wordBreak: 'break-word' }}>
                    {t.name ?? 'Transfer'}
                  </div>
                  {route && <div style={{ fontSize: 11, color: MUTED, fontFamily: SANS, marginTop: 2, wordBreak: 'break-word' }}>{route}</div>}

                  {veh.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {veh.map(v => (
                        <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: SANS }}>{v.driver_name || 'Driver'}</span>
                          {v.vehicle_role && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD, fontFamily: SANS }}>{v.vehicle_role}</span>}
                          {[v.driver_phone, v.car_model, v.plate].filter(Boolean).length > 0 && (
                            <span style={{ fontSize: 11, color: MUTED, fontFamily: 'DM Mono, monospace' }}>
                              {[v.driver_phone, v.car_model, v.plate].filter(Boolean).join('  \u00b7  ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {bookedByLabel(t.booked_by) && (
                    <div style={{ fontSize: 11, color: FAINT, fontFamily: SANS, marginTop: 4, fontStyle: 'italic' }}>
                      {bookedByLabel(t.booked_by)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </BriefSection>
      )}

      {(() => {
        const greeters = auxBookings.filter(a => isMeetGreetBooking(a.booking_type) && a.brief_show !== false)
        return greeters.length > 0 ? (
          <BriefSection title='Airport Meet & Greet'>
            {greeters.map(g => (
              <BriefRow
                key={g.id}
                label={g.start_date ? fmtDate(g.start_date) : '\u2014'}
                value={g.name ?? 'Airport Meet & Greet'}
                sub={[
                  g.start_time ? fmtTime(g.start_time) : null,
                  g.contact_name ?? null,
                  g.contact_phone ?? null,
                  g.notes ?? null,
                ].filter(Boolean).join('  \u00b7  ')}
                bookedBy={bookedByLabel(g.booked_by)}
              />
            ))}
          </BriefSection>
        ) : null
      })()}

      {(() => {
        const dining = auxBookings.filter(a => isDiningBooking(a.booking_type) && a.brief_show !== false)
        return dining.length > 0 ? (
          <BriefSection title='Dining'>
            {dining.map(d => {
              const cancelled = d.dining_status === 'cancelled' && d.show_cancellation !== false
              return (
              <BriefRow
                key={d.id}
                label={d.start_date ? fmtDate(d.start_date) : '\u2014'}
                value={d.name ?? 'Dining'}
                sub={[
                  d.start_time ? fmtTime(d.start_time) : null,
                  d.guest_name ?? null,
                  d.guest_count ? `${d.guest_count} guests` : null,
                  d.confirmation_number ? `Ref: ${d.confirmation_number}` : null,
                ].filter(Boolean).join('  \u00b7  ')}
                bookedBy={bookedByLabel(d.booked_by)}
                cancelled={cancelled}
                cancellationNote={d.cancellation_penalty_applied ? d.cancellation_note : null}
              />
              )
            })}
          </BriefSection>
        ) : null
      })()}

      {clientData.brief?.important_notes && (clientData.brief.important_notes as string[]).length > 0 && (
        <BriefSection title='Important Notes'>
          {(clientData.brief.important_notes as string[]).map((note, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, fontFamily: SANS, color: MUTED, lineHeight: 1.6, paddingTop: 6, paddingBottom: 6 }}>
              <img src='/emblem.png' alt='' style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 3, opacity: 0.35 }} />
              <span>{note}</span>
            </div>
          ))}
        </BriefSection>
      )}

      {(clientData.links?.length ?? 0) > 0 && (
        <BriefSection title='Links'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clientData.links.map(link => {
              const content = link.travel_engagement_link_content ?? null
              return (
                <div key={link.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <a
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      padding:        '14px 18px',
                      borderRadius:   content ? '10px 10px 0 0' : 10,
                      border:         `1px solid ${RULE}`,
                      borderBottom:   content ? 'none' : `1px solid ${RULE}`,
                      background:     '#fff',
                      cursor:         'pointer',
                      transition:     'border-color 150ms',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>
                          {link.link_type === 'guide' ? '\u2736' : '\U0001f517'}
                        </span>
                        <div style={{ fontSize: 13, fontFamily: SERIF, color: INK, lineHeight: 1.3 }}>
                          {link.label}
                        </div>
                      </div>
                      <svg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ flexShrink: 0, opacity: 0.4 }}>
                        <path d='M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8' stroke={INK} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                        <path d='M9 1h4m0 0v4m0-4L7 7' stroke={INK} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                      </svg>
                    </div>
                  </a>
                  {content && (
                    <div style={{
                      padding:      '14px 18px',
                      borderRadius: '0 0 10px 10px',
                      border:       `1px solid ${RULE}`,
                      borderTop:    'none',
                      background:   CARD_BG,
                    }}>
                      {content.kicker && (
                        <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
                          {content.kicker}
                        </div>
                      )}
                      {content.image_src && (
                        <img
                          src={content.image_src ?? undefined}
                          alt={content.image_alt ?? ''}
                          style={{ width: '100%', borderRadius: 6, marginBottom: 10, objectFit: 'cover', maxHeight: 180 }}
                        />
                      )}
                      <div style={{ fontSize: 12, fontFamily: SANS, color: MUTED, lineHeight: 1.7 }}>
                        {content.body}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </BriefSection>
      )}
    </div>
  )
}

// ── Contacts tab ──────────────────────────────────────────────────────────────
// S54 — renders advisor + selected house people (clientData.contacts), resolved
// server-side from brief.contact_person_ids + contact_name_format. Falls back to
// house.display_name when no people are selected.

function ContactsTab({ clientData }: { clientData: TripClientData }) {
  const { brief, house, contacts } = clientData

  function ContactCard({ name, role, email, phone }: { name: string; role: string; email?: string | null; phone?: string | null }) {
    return (
      <div style={{ padding: '20px 24px', borderRadius: 12, border: `0.5px solid ${RULE}`, background: '#fff', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, marginBottom: 8, fontFamily: SANS }}>{role}</div>
        <div style={{ fontSize: 18, fontFamily: SERIF, color: INK, marginBottom: 8 }}>{name}</div>
        {phone && <a href={`tel:${phone}`} style={{ display: 'block', fontSize: 13, color: GOLD, textDecoration: 'none', fontFamily: SANS, marginBottom: 3 }}>{phone}</a>}
        {email && <a href={`mailto:${email}`} style={{ display: 'block', fontSize: 12, color: MUTED, textDecoration: 'none', fontFamily: SANS, wordBreak: 'break-all' }}>{email}</a>}
      </div>
    )
  }

  const roleLabel = (role: string | null): string => (role === 'staff' ? 'Staff' : 'Guest')

  const all      = contacts ?? []
  const guests   = all.filter(c => c.role !== 'staff')
  const staff    = all.filter(c => c.role === 'staff')
  const hasAny   = all.length > 0

  function ContactBlock({ label, people }: { label: string; people: TripContact[] }) {
    if (people.length === 0) return null
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, marginBottom: 12 }}>
          {label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {people.map(c => (
            <ContactCard key={c.id} name={c.name} role={roleLabel(c.role)} email={c.email} phone={c.phone} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,6vw,80px)' }}>
      {/* Advisor */}
      {brief?.advisor_name && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, marginBottom: 12 }}>
            Travel Advisor
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            <ContactCard
              name={brief.advisor_name}
              role='Travel Advisor'
              email={(brief as any).show_advisor_email ? brief.advisor_email : null}
              phone={(brief as any).show_advisor_phone ? (brief as any).advisor_phone : null}
            />
          </div>
        </div>
      )}

      {/* Guests */}
      <ContactBlock label={guests.length === 1 ? 'Guest' : 'Guests'} people={guests} />

      {/* Staff (only if any selected) */}
      <ContactBlock label={staff.length === 1 ? 'Staff' : 'Staff'} people={staff} />

      {/* Fallback: no people selected -> house display name */}
      {!hasAny && house?.display_name && (
        <div>
          <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, marginBottom: 12 }}>
            Guest
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            <ContactCard name={house.display_name} role='Guest' />
          </div>
        </div>
      )}

      {brief?.hotel_contact_note && (
        <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 10, background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
          <div style={{ fontSize: 9, fontFamily: SANS, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 8 }}>Hotel Contact Note</div>
          <div style={{ fontSize: 13, fontFamily: SANS, color: MUTED, lineHeight: 1.7 }}>{brief.hotel_contact_note}</div>
        </div>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function TabSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding:   'clamp(20px,4vw,36px) clamp(20px,5vw,48px) clamp(20px,4vw,36px)',
      boxSizing: 'border-box',
      width:     '100%',
      overflow:  'hidden',
    }}>
      <div style={{ height: 1, background: RULE, marginBottom: 18 }} />
      <div style={{ fontSize: 10, fontFamily: SANS, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

// ── Loading / not found ───────────────────────────────────────────────────────

function TripLoading() {
  return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <img src='/emblem.png' alt='' style={{ width: 48, height: 48, opacity: 0.5 }} />
      <div style={{ fontSize: 11, fontFamily: SANS, color: FAINT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Preparing Your Journey
      </div>
    </div>
  )
}

function TripNotFound() {
  return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: '0 24px', textAlign: 'center' }}>
      <img src='/emblem.png' alt='' style={{ width: 40, height: 40, opacity: 0.35 }} />
      <div style={{ fontSize: 22, fontFamily: SERIF, color: INK, maxWidth: 480, lineHeight: 1.5 }}>
        This page is not publicly visible.
      </div>
      <div style={{ fontSize: 15, fontFamily: SANS, color: MUTED, maxWidth: 420, lineHeight: 1.7 }}>
        Please reach out to your travel designer to pick things back up — they will be glad to share what&apos;s next.
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ImmerseTripPage({ urlId, initialTab }: { urlId: string; initialTab?: TabId }) {
  const [tripData,    setTripData]    = useState<TripData | null>(null)
  const [notFound,    setNotFound]    = useState(false)
  const [activeTab,   setActiveTab]   = useState<TabId | null>(null)
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const [activeDayLabel, setActiveDayLabel] = useState<string>('')
  const [openDayNav,     setOpenDayNav]     = useState<(() => void) | null>(null)
  const width = useWindowWidth()

  const handleActiveDayChange = useCallback((label: string, opener: () => void) => {
    setActiveDayLabel(label)
    setOpenDayNav(() => opener)
  }, [])

  const { pdfReady: briefPdfReady, pdfDownloading: briefPdfDownloading, handleDownloadBrief, handleDownloadTripBrief } = useImmerseConfirmationPdf()
  const { pdfReady: progPdfReady, pdfDownloading: progPdfDownloading, handleDownloadProgramme } = useImmerseProgrammePdf()

  useEffect(() => {
    async function load() {
      try {
        const [confRes, progRes] = await Promise.all([
          fetch(CONFIRMATION_FN, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body:    JSON.stringify({ url_id: urlId }),
          }),
          fetch(PROGRAMME_FN, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body:    JSON.stringify({ url_id: urlId }),
          }),
        ])

        if (!confRes.ok) { setNotFound(true); return }
        const confPayload = await confRes.json()
        if (confPayload.error || !confPayload.trip) { setNotFound(true); return }

        const progPayload = progRes.ok ? await progRes.json() : null

        const clientData: TripClientData = {
          trip:            confPayload.trip,
          brief:           confPayload.brief,
          house:           confPayload.house,
          contacts:        confPayload.contacts ?? [],
          destinationName: confPayload.destinationName,
          auxBookings:     confPayload.auxBookings ?? [],
          guides:          { hasDining: false, hasExperiences: false, destinationSlug: null },
          links:           confPayload.links ?? [],
          urlId,
        } as TripClientData

        const data: TripData = {
          clientData,
          days:    progPayload?.days    ?? [],
          entries: progPayload?.entries ?? [],
        }

        setTripData(data)

        const brief = confPayload.brief
        const hasProgramme = brief?.show_tab_programme !== false && (progPayload?.days?.length ?? 0) > 0

        // Explicit initial tab (e.g. /programme route) wins when that tab is enabled.
        if (initialTab === 'programme' && hasProgramme)                                  { setActiveTab('programme');    return }
        if (initialTab === 'confirmation' && brief?.show_tab_confirmation !== false)     { setActiveTab('confirmation'); return }
        if (initialTab === 'contacts' && brief?.show_tab_contacts !== false)             { setActiveTab('contacts');     return }
        if (initialTab === 'brief' && brief?.show_tab_brief !== false)                   { setActiveTab('brief');        return }

        if ((brief as any)?.show_tab_welcome === true && (brief as any)?.welcome_letter) { setActiveTab('welcome'); return }
        if (brief?.show_tab_brief !== false)    { setActiveTab('brief');        return }
        if (hasProgramme)                        { setActiveTab('programme');    return }
        if (brief?.show_tab_confirmation !== false) { setActiveTab('confirmation'); return }
        setActiveTab('contacts')
      } catch {
        setNotFound(true)
      }
    }
    load()
  }, [urlId])

  if (notFound)  return <TripNotFound />
  if (!tripData) return <TripLoading />

  const { clientData, days, entries } = tripData
  const { trip, brief, house } = clientData

  const welcomeLetter = (brief as any)?.welcome_letter ?? null
  const welcomeAsTab  = (brief as any)?.show_tab_welcome === true && !!welcomeLetter

  const tabs: { id: TabId; label: string }[] = []
  if (welcomeAsTab) tabs.push({ id: 'welcome', label: 'Welcome' })
  if (brief?.show_tab_brief        !== false) tabs.push({ id: 'brief',        label: 'Trip Brief' })
  if (brief?.show_tab_programme    !== false) tabs.push({ id: 'programme',    label: 'Programme' })
  if (brief?.show_tab_confirmation !== false) tabs.push({ id: 'confirmation', label: 'Confirmation' })
  if (brief?.show_tab_contacts     !== false) tabs.push({ id: 'contacts',     label: 'Contacts' })

  const heroTitle = brief?.brief_title ?? clientData.destinationName ?? trip.destinations[0]?.name ?? ''
  const heroSubtitle = brief?.brief_subtitle ?? trip.destinations.map(d => d.name).join(' \u00b7 ')
  const heroImage    = brief?.hero_image_src || trip.destinations[0]?.hero_image_src || ''
  const guestName    = brief?.prepared_for ?? ''
  const dateLabel    = buildDateRange(trip.start_date, trip.end_date) || undefined

  return (
    <ImmerseLayout>
      <ImmerseHero
        guestName={guestName}
        title={heroTitle}
        subtitle={heroSubtitle}
        dateLabel={dateLabel}
        heroImageSrc={heroImage}
        heroImageAlt={heroTitle}
        primaryHref={tabs[0] ? `#${tabs[0].id}` : '#'}
        primaryLabel={tabs[0]?.label ?? 'View Trip'}
        secondaryHref={tabs[1] ? `#${tabs[1].id}` : undefined}
        secondaryLabel={tabs[1]?.label}
      />

      {welcomeLetter && !welcomeAsTab && (
        <section style={{ padding: 'clamp(48px,7vw,88px) clamp(20px,5vw,48px)', background: CREAM }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: FAINT, marginBottom: 28, fontFamily: SANS }}>Welcome</p>
            {(welcomeLetter as string).split('\n\n').filter(Boolean).map((p: string, i: number, arr: string[]) => (
              <p key={i} style={{
                fontSize:      i === 0 ? 'clamp(18px,2vw,26px)' : 15,
                fontFamily:    i === 0 ? SERIF : SANS,
                lineHeight:    1.85,
                color:         i === 0 ? INK : MUTED,
                marginBottom:  i === arr.length - 1 ? 0 : 20,
                letterSpacing: i === 0 ? '-0.01em' : 'normal',
              }}>
                {p}
              </p>
            ))}
          </div>
        </section>
      )}

      <div style={{ background: CREAM }} id='tabs'>
        <div style={{
          position:       'sticky',
          top:            60,
          zIndex:         49,
          background:     'rgba(247,245,240,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom:   width < 640 ? 'none' : `1px solid ${RULE}`,
          padding:        '0 clamp(20px,5vw,48px)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            16,
        }}>
          {width < 640 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setTabMenuOpen(o => !o)}
                  aria-label='Open tab menu'
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           8,
                    padding:       '10px 0',
                    border:        'none',
                    background:    'transparent',
                    cursor:        'pointer',
                    fontFamily:    SANS,
                    fontSize:      10,
                    fontWeight:    700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color:         GOLD,
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>☰</span>
                  <span>{tabs.find(t => t.id === activeTab)?.label ?? 'Menu'}</span>
                </button>

                {tabMenuOpen && (
                  <>
                    <div
                      onClick={() => setTabMenuOpen(false)}
                      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }}
                    />
                    <div style={{
                      position:      'absolute',
                      top:           'calc(100% + 6px)',
                      left:          0,
                      minWidth:      200,
                      zIndex:        70,
                      background:    '#fff',
                      border:        `1px solid ${RULE}`,
                      borderRadius:  8,
                      boxShadow:     '0 8px 24px rgba(0,0,0,0.12)',
                      padding:       '6px',
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           2,
                    }}>
                      {tabs.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setActiveTab(t.id); setTabMenuOpen(false) }}
                          style={{
                            textAlign:     'left',
                            padding:       '12px 14px',
                            border:        'none',
                            borderRadius:  6,
                            background:    activeTab === t.id ? `${GOLD}14` : 'transparent',
                            color:         activeTab === t.id ? GOLD : INK,
                            fontSize:      12,
                            fontWeight:    activeTab === t.id ? 700 : 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            fontFamily:    SANS,
                            cursor:        'pointer',
                            transition:    'background 120ms',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {activeTab === 'programme' && activeDayLabel && (
                <button
                  onClick={() => openDayNav?.()}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           6,
                    padding:       '6px 10px',
                    border:        `1px solid ${GOLD}55`,
                    borderRadius:  20,
                    background:    `${GOLD}0D`,
                    cursor:        'pointer',
                    fontFamily:    SANS,
                    fontSize:      10,
                    fontWeight:    600,
                    letterSpacing: '0.04em',
                    color:         MUTED,
                    maxWidth:      200,
                    flexShrink:    0,
                    whiteSpace:    'nowrap',
                    transition:    'border-color 150ms, background 150ms',
                  }}
                >
                  <span style={{ fontSize: 11, color: GOLD, flexShrink: 0, lineHeight: 1 }}>☰</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeDayLabel}</span>
                  <span style={{ fontSize: 12, color: GOLD, flexShrink: 0, lineHeight: 1, marginLeft: 2 }}>{'\u203a'}</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 0 }}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  id={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding:       '16px 20px',
                    border:        'none',
                    borderBottom:  `2px solid ${activeTab === t.id ? GOLD : 'transparent'}`,
                    background:    'transparent',
                    color:         activeTab === t.id ? GOLD : FAINT,
                    fontSize:      11,
                    fontWeight:    activeTab === t.id ? 700 : 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily:    SANS,
                    cursor:        'pointer',
                    transition:    'all 150ms ease',
                    whiteSpace:    'nowrap',
                    flexShrink:    0,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {(activeTab === 'confirmation' || activeTab === 'brief') && (
              <button
                disabled={!briefPdfReady || briefPdfDownloading}
                onClick={async () => {
                  let heroData: string | null = null
                  const heroSrc = brief?.hero_image_src || trip.destinations[0]?.hero_image_src || null
                  if (heroSrc) {
                    try {
                      const blob = await fetch(heroSrc).then(r => r.blob())
                      heroData = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob) })
                    } catch {}
                  }
                  if (activeTab === 'brief') {
                    handleDownloadTripBrief({ trip, brief, house, destinationName: clientData.destinationName, heroImageData: heroData, auxBookings: clientData.auxBookings })
                    return
                  }
                  handleDownloadBrief({ trip, brief, house, destinationName: clientData.destinationName, heroImageData: heroData, auxBookings: clientData.auxBookings, contacts: clientData.contacts })
                }}
                style={{
                  fontFamily:    SANS, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', border: 'none', borderRadius: 6,
                  padding:       '5px 12px', cursor: briefPdfReady ? 'pointer' : 'not-allowed',
                  background:    GOLD, color: INK,
                  opacity:       briefPdfReady && !briefPdfDownloading ? 1 : 0.45,
                  transition:    'opacity 150ms',
                }}
              >
                {briefPdfDownloading ? 'Generating\u2026' : activeTab === 'confirmation' ? 'Confirmation PDF' : 'Brief PDF'}
              </button>
            )}
            {activeTab === 'programme' && (
              <button
                disabled={!progPdfReady || progPdfDownloading}
                onClick={() => {
                  const entriesByDate: Record<string, TimelineItem[]> = {}
                  for (const e of entries) {
                    if (!entriesByDate[e.entry_date]) entriesByDate[e.entry_date] = []
                    entriesByDate[e.entry_date].push(e)
                  }
                  handleDownloadProgramme({ trip, brief, house, days, entriesByDate })
                }}
                style={{
                  fontFamily:    SANS, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', border: 'none', borderRadius: 6,
                  padding:       '5px 12px', cursor: progPdfReady ? 'pointer' : 'not-allowed',
                  background:    GOLD, color: INK,
                  opacity:       progPdfReady && !progPdfDownloading ? 1 : 0.45,
                  transition:    'opacity 150ms',
                }}
              >
                {progPdfDownloading ? 'Generating\u2026' : 'Programme PDF'}
              </button>
            )}
          </div>
        </div>

        <div style={{ background: CREAM, minHeight: '60vh' }}>
          {activeTab === 'welcome' && (
            <div style={{ padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,48px)' }}>
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: FAINT, marginBottom: 28, fontFamily: SANS }}>Welcome</p>
                {(welcomeLetter as string).split('\n\n').filter(Boolean).map((p: string, i: number, arr: string[]) => (
                  <p key={i} style={{
                    fontSize:      i === 0 ? 'clamp(18px,2vw,26px)' : 15,
                    fontFamily:    i === 0 ? SERIF : SANS,
                    lineHeight:    1.85,
                    color:         i === 0 ? INK : MUTED,
                    marginBottom:  i === arr.length - 1 ? 0 : 20,
                    letterSpacing: i === 0 ? '-0.01em' : 'normal',
                  }}>{p}</p>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'confirmation' && <ConfirmationTab clientData={clientData} />}
          {activeTab === 'programme'    && <ProgrammeTab days={days} entries={entries} brief={brief} onActiveDayChange={handleActiveDayChange} />}
          {activeTab === 'brief'        && <TripBriefTab clientData={clientData} />}
          {activeTab === 'contacts'     && <ContactsTab clientData={clientData} />}
        </div>

        <div style={{ padding: '40px clamp(20px,6vw,80px)', textAlign: 'center', borderTop: `1px solid ${RULE}` }}>
          <div style={{ fontSize: 10, fontFamily: SANS, color: FAINT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Tailored Travel Design &nbsp;&middot;&nbsp; Concierge Support &nbsp;&middot;&nbsp;
            <a href='https://ambience.travel' style={{ color: FAINT, textDecoration: 'none' }}> ambience.travel</a>
          </div>
        </div>
      </div>
    </ImmerseLayout>
  )
}