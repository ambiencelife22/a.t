// ImmerseConfirmedSections.tsx — Section components for the confirmed engagement surface.
//
// Owns the four section components rendered when an engagement is in the
// 'trip' or 'completed' stage (Collapse A · A2). Each component is self-contained
// and accepts only the data it needs — no page-level state leaks in.
//
// Sections:
//   ConfirmationTab  — accommodation cards + aux bookings
//   ProgrammeTab     — day-by-day with collapsible sidebar
//   TripBriefTab     — structured summary (flights, hotels, transfers, contacts)
//   ContactsTab      — advisor + selected house people
//
// Shared helpers (used only by these sections):
//   useWindowWidth, StatusPill, diningPillModel, DiningPillBox, DiningPill,
//   Lightbox, TabSection
//
// Theme tokens (CREAM, INK, GOLD etc) are re-declared here — they will move to
// a shared token file in A3 when the unified surface is built.
//
// Last updated: S53H · A2 — extracted from ImmerseTripPage.tsx.

import { useEffect, useState } from 'react'
import type { TripClientData, TripContact } from '../../types/typesImmerseClient'
import type { BookingInvoice } from '../../types/typesImmerse'
import { moneyDec } from '../../utils/utilsCurrency'
import type {
  ImmerseTripAuxBooking as TripAuxBooking,
  ImmerseTripDay as TripDay,
} from '../../types/typesImmerse'
import type { TimelineItem } from '../../types/typesTimeline'
import { groupAuxBySection, isFlightBooking, isTransferBooking, isHotelBooking, isGroundTransportBooking, isDiningBooking, isMeetGreetBooking } from '../../types/typesAuxBookings'
import { getEventStatusMeta }            from '../../types/typesEventStatus'
import { bookedByLabel, isOwnArrangements, categoryAccentHex } from '../../utils/utilsBooking'
import { webRoomDisplay, passengerName } from '../../utils/utilsRoomDisplay'
import { fmtTime, localDateStr, formatDate, formatDateRange, formatDateWeekday, formatDateShortWeekday } from '../../utils/utilsDates'
import { ID } from '../../tokens/tokensLanding'

// ── Theme ─────────────────────────────────────────────────────────────────────
const CREAM   = '#F7F5F0'
const CARD_BG = '#F0EDE6'
const INK     = '#1A1D1A'
const GOLD    = ID.gold   // #d8b56a — canonical (was drifted #C9A84C)
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const SANS    = "'Plus Jakarta Sans', sans-serif"
const SERIF   = "'Cormorant Garamond', Georgia, serif"
const SIDEBAR_W = 220

// ── useWindowWidth ────────────────────────────────────────────────────────────

export function useWindowWidth(): number {
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
  if (cancelled && penalty) return { color: '#B4321F', label: opts.cancellationNote ?? 'Cancelled - penalty applies' }
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

export function ConfirmationTab({ clientData }: { clientData: TripClientData }) {
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
            const dateRange    = formatDateRange(booking.check_in_date ?? booking.start_date, booking.end_date)
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
                      {booking.start_time && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{`Check-In: ${fmtTime(booking.start_time)}`}</div>}
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
                      {ownArr && (
                        <span style={{
                          display: 'inline-block', fontFamily: SANS, fontSize: 9,
                          letterSpacing: '0.12em', color: MUTED,
                          border: `0.5px solid ${FAINT}`, borderRadius: 999,
                          padding: '3px 10px', whiteSpace: 'nowrap',
                        }}>Own Arrangements</span>
                      )}
                      {!ownArr && (
                        <div style={{ fontSize: 11, fontFamily: SANS, fontStyle: 'italic', color: FAINT }}>{bookedByText}</div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Inclusions, cancellation policy, invoices — full width below header */}
                {(booking.inclusions_override && (booking.inclusions_override as {heading:string;bullets:string[]}[]).length > 0) && (
                  <div style={{ padding: '16px 20px', borderTop: `0.5px solid ${RULE}` }}>
                    {(booking.inclusions_override as {heading:string;bullets:string[]}[]).map((group, gi) => (
                      <div key={gi} style={{ marginTop: gi > 0 ? 12 : 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD, fontFamily: SANS, marginBottom: 6 }}>{group.heading}</div>
                        {group.bullets.map((b, bi) => (
                          <div key={bi} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: SANS, color: MUTED, lineHeight: 1.7 }}>
                            <span style={{ color: GOLD, flexShrink: 0 }}>·</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {booking.cancellation_policy && (
                  <div style={{ padding: '12px 20px', borderTop: `0.5px solid ${RULE}`, background: CARD_BG }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 4 }}>Cancellation Policy</div>
                    <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{booking.cancellation_policy}</div>
                  </div>
                )}
                {(booking._invoices ?? []).length > 0 && (
                  <div style={{ padding: '12px 20px', borderTop: `0.5px solid ${RULE}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 6 }}>Invoices</div>
                    {(booking._invoices as BookingInvoice[]).map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6, paddingBottom: 6, borderTop: `0.5px solid ${RULE}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontFamily: SANS, fontWeight: 600, color: INK }}>{inv.description ?? `Invoice ${inv.invoice_number}`}</div>
                          <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 1 }}>
                            {inv.invoice_date ? formatDate(inv.invoice_date) : ''}
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: FAINT, marginLeft: 8 }}>#{inv.invoice_number}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK, flexShrink: 0 }}>
                          {moneyDec(inv.amount ?? 0, inv.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                            {room.check_in_time && <div style={{ fontSize: 11, fontFamily: SANS, color: GOLD, marginTop: 2 }}>{`Check-In: ${fmtTime(room.check_in_time)}`}</div>}
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
            const timeStr    = [fmtTime(aux.start_time), fmtTime(aux.end_time)].filter(Boolean).join(' - ')
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
                  {aux.start_date && <div style={{ fontSize: 11, fontFamily: SANS, color: FAINT, marginTop: 2 }}>{formatDate(aux.start_date)}</div>}
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

export function ProgrammeTab({ days, entries, onActiveDayChange, brief }: {
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
      ? (activeDay.day_label || formatDateShortWeekday(activeDay.entry_date))
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
                      {day.day_label || formatDateShortWeekday(day.entry_date)}
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
                {formatDateWeekday(activeDay.entry_date)}
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
                  const timeStr     = isFlight ? null : (dep && arr ? `${dep} - ${arr}` : dep || arr || null)
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
                              {item.start_time && <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 2 }}>{`Check-In: ${fmtTime(item.start_time)}`}</div>}
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
                                  {room.check_in_time && <div style={{ fontSize: 11, fontFamily: SANS, color: GOLD, marginTop: 2 }}>{`Check-In: ${fmtTime(room.check_in_time)}`}</div>}
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

export function TripBriefTab({ clientData }: {
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
        {trip.start_date      && <BriefRow label='Departure'    value={formatDate(trip.start_date)} />}
        {trip.end_date        && <BriefRow label='Return'       value={formatDate(trip.end_date)} />}
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
                  {formatDateRange(h.check_in_date ?? h.start_date, h.end_date) || ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: SANS, wordBreak: 'break-word' }}>
                    {h._hotel_name ?? h.name ?? 'Hotel'}
                  </div>
                  {h.nights && <div style={{ fontSize: 11, color: MUTED, fontFamily: SANS, marginTop: 2 }}>{`${h.nights} nights`}</div>}
                  {h.check_in_note && <div style={{ fontSize: 11, color: GOLD, fontFamily: SANS, fontStyle: 'italic', marginTop: 2, wordBreak: 'break-word' }}>{h.check_in_note}</div>}
                  {h.cancellation_policy && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: CARD_BG, borderRadius: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 3 }}>Cancellation Policy</div>
                      <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{h.cancellation_policy}</div>
                    </div>
                  )}
                  {(h._invoices ?? []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, fontFamily: SANS, marginBottom: 4 }}>Invoices</div>
                      {(h._invoices as BookingInvoice[]).map(inv => (
                        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 5, paddingBottom: 5, borderTop: `0.5px solid ${RULE}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontFamily: SANS, fontWeight: 600, color: INK }}>{inv.description ?? `Invoice ${inv.invoice_number}`}</div>
                            <div style={{ fontSize: 11, fontFamily: SANS, color: MUTED, marginTop: 1 }}>
                              {inv.invoice_date ? formatDate(inv.invoice_date) : ''}
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: FAINT, marginLeft: 8 }}>#{inv.invoice_number}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 600, color: INK, flexShrink: 0 }}>
                            {moneyDec(inv.amount ?? 0, inv.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {h.inclusions_override && (h.inclusions_override as {heading:string;bullets:string[]}[]).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {(h.inclusions_override as {heading:string;bullets:string[]}[]).map((group, gi) => (
                        <div key={gi} style={{ marginTop: gi > 0 ? 6 : 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD, fontFamily: SANS, marginBottom: 3 }}>{group.heading}</div>
                          {group.bullets.map((b, bi) => (
                            <div key={bi} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: SANS, color: MUTED, lineHeight: 1.6 }}>
                              <span style={{ color: GOLD, flexShrink: 0 }}>·</span>
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
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
                  {f.start_date ? formatDate(f.start_date) : ''}
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
                  {t.start_date ? formatDate(t.start_date) : ''}
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
                label={g.start_date ? formatDate(g.start_date) : ''}
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
                label={d.start_date ? formatDate(d.start_date) : ''}
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
                      border:         link.is_highlighted ? `1.5px solid ${GOLD}` : `1px solid ${RULE}`,
                      borderBottom:   content ? 'none' : link.is_highlighted ? `1.5px solid ${GOLD}` : `1px solid ${RULE}`,
                      background:     link.is_highlighted ? `${GOLD}08` : '#fff',
                      cursor:         'pointer',
                      transition:     'border-color 150ms',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {link.link_type === 'guide' ? (
                          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ flexShrink: 0 }}>
                            <rect x='3' y='1' width='9' height='12' rx='1' stroke={GOLD} strokeWidth='1.2'/>
                            <line x1='3' y1='13' x2='12' y2='13' stroke={GOLD} strokeWidth='1.2'/>
                            <line x1='5' y1='4' x2='10' y2='4' stroke={GOLD} strokeWidth='1' strokeLinecap='round'/>
                            <line x1='5' y1='6.5' x2='10' y2='6.5' stroke={GOLD} strokeWidth='1' strokeLinecap='round'/>
                            <line x1='5' y1='9' x2='8' y2='9' stroke={GOLD} strokeWidth='1' strokeLinecap='round'/>
                            <rect x='1' y='2' width='2' height='11' rx='0.5' fill={GOLD} opacity='0.3'/>
                          </svg>
                        ) : (
                          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ flexShrink: 0, opacity: 0.45 }}>
                            <path d='M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9' stroke={INK} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                            <path d='M9 1h6m0 0v6m0-6L8 8' stroke={INK} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                          </svg>
)}
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

export function ContactsTab({ clientData }: { clientData: TripClientData }) {
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

export function TabSection({ label, children }: { label: string; children: React.ReactNode }) {
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
