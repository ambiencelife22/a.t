// ImmerseConfirmedSections.tsx - Section components for the confirmed engagement surface.
//
// Owns the four section components rendered when an engagement is in the
// 'delivery' or 'completed' stage (Collapse A · A2). Each component is self-contained
// and accepts only the data it needs - no page-level state leaks in.
//
// Sections:
//   ConfirmationTab  - accommodation cards + aux bookings
//   ProgrammeTab     - day-by-day with collapsible sidebar
//   EngagementBriefTab     - structured summary (flights, hotels, transfers, contacts)
//   ContactsTab      - advisor + selected house people
//
// Shared helpers (used only by these sections):
//   StatusPill, diningPillModel, DiningPillBox, DiningPill, Lightbox, TabSection
// Viewport width comes from the canonical useWindowWidth hook (src/hooks), A5.
//
// Theme tokens (c.surface, c.ink, c.gold etc) are re-declared here - they will move to
// a shared token file in A3 when the unified surface is built.
//
// Last updated: S53H · A2 - extracted from ImmerseTripPage.tsx.

import { useEffect, useState } from 'react'
import type { DeliveryData, EngagementContact } from '../../queries/queriesImmerseEngagement'
import { moneyDec } from '../../utils/utilsCurrency'
import { scheduleAlert } from '../../utils/utilsScheduleAlert'
import type {
  BookingInvoice,
  EngagementElementView,
  EngagementElement as AdminEngagementElement,
  ImmerseJourneyDay as JourneyDay,
} from '../../types/typesImmerse'
import type { TimelineItemView } from '../../types/typesImmerseDelivery'
import { groupElementsBySection, isFlightElement, isTransferElement, isGroundTransportElement, isDiningElement, isMeetGreetElement } from '../../types/typesElements'
import { getEventStatusMeta }            from '../../types/typesEventStatus'
import { bookedByLabel, isOwnArrangements, categoryAccentHex, toTelHref, toWhatsAppHref, beddingLabel } from '../../utils/utilsBooking'
import { webRoomDisplay, passengerName } from '../../utils/utilsRoomDisplay'
import { fmtTime, localDateStr, formatDate, formatDateRange, formatDateWeekday, formatDateShortWeekday } from '../../utils/utilsDates'
import { useWindowWidth } from '../../hooks/useWindowWidth'
import { AMBIENCE, TYPE } from '../../tokens/tokensAmbienceTravel'

// ── Theme ─────────────────────────────────────────────────────────────────────
const c = AMBIENCE.light
const SIDEBAR_W = 220

// ── Alert pill ────────────────────────────────────────────────────────────────
// One alert primitive for client-facing element/booking alerts (payment
// outstanding, tentatively scheduled, ...). Tone sets the colour; the mechanism
// is shared so alerts never drift into parallel one-off pills.
function AlertPill({ label, tone }: { label: string; tone: 'danger' | 'caution' }) {
  const color = tone === 'danger' ? '#B4321F' : '#B07D2A'
  return (
    <div style={{
      display: 'inline-block', marginBottom: 6, padding: '3px 10px',
      border: `1px solid ${color}`, borderRadius: 5, background: `${color}0F`,
    }}>
      <span style={{ fontSize: 10, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>{label}</span>
    </div>
  )
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
      fontFamily:    TYPE.sans,
      flexShrink:    0,
      whiteSpace:    'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// Dining cancellation/terms pill - single model, both surfaces.
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
  if (cancelled)            return { color: c.muted,     label: opts.cancellationNote ?? 'Cancelled' }
  if (opts.bookingTerms)    return { color: c.gold,      label: opts.bookingTerms }
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
      <span style={{ fontSize: 11, fontFamily: TYPE.sans, color: model.color, lineHeight: 1.5 }}>{model.label}</span>
    </div>
  )
}

function DiningPill({ aux }: { aux: AdminEngagementElement }) {
  return <DiningPillBox model={diningPillModel({
    showCancellation: aux.showCancellation ?? null,
    diningStatus:     aux.diningStatus ?? null,
    penaltyApplied:   aux.cancellationPenaltyApplied ?? null,
    cancellationNote: aux.cancellationNote ?? null,
    bookingTerms:     aux.venue?.bookingTerms ?? null,
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

export function ConfirmationTab({ clientData }: { clientData: DeliveryData}) {
 const { journey: trip, elements } = clientData
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  const destHero = trip.destinations[0]?.heroImageSrc ?? null

  const accomBookings = trip.bookings
    .filter(bk => bk.briefShow !== false)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

const auxSections = groupElementsBySection(elements)

  const experiences = (clientData.entries ?? []).filter(e => e.category === 'experience' && e.briefShow !== false)

  return (
    <div>
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

{/* Accommodation - one block per hotel, rooms nested beneath */}
      {accomBookings.length > 0 && (
        <TabSection label='ACCOMMODATION'>
          {accomBookings.map(booking => {
            const ownArr       = isOwnArrangements(booking.bookedBy)
            const bookedByText = bookedByLabel(booking.bookedBy)
            const pillColor    = ownArr ? c.faint : c.gold
            const hotelName    = booking._hotel_name ?? booking.name ?? 'Hotel'
            const dateRange    = formatDateRange(booking.checkInDate ?? booking.startDate, booking.endDate)
            const stayAlert    = scheduleAlert(booking)
            const headerImg    = booking.briefImageSrc ?? booking._hotel_image_src ?? destHero
            const rooms        = booking._rooms ?? []

            return (
              <div key={booking.id} style={{
                background: '#fff', border: `0.5px solid ${c.lineStrong}`,
                borderRadius: 12, overflow: 'hidden',
                boxSizing: 'border-box',
              }}>
                {/* Hotel header */}
                <div style={{ display: 'flex', minHeight: 100 }}>
                  <div
                    style={{
                      width: 'clamp(100px,30%,200px)', flexShrink: 0,
                      background: c.surfaceSunken, position: 'relative', overflow: 'hidden',
                      cursor: headerImg ? 'zoom-in' : 'default',
                    }}
                    onClick={() => headerImg && setLightbox({ src: headerImg, alt: hotelName })}
                  >
                    {headerImg && <img src={headerImg} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 16, fontFamily: TYPE.serif, color: stayAlert.struck ? c.faint : c.ink, marginBottom: 4, lineHeight: 1.3, textDecoration: stayAlert.struck ? 'line-through' : 'none' }}>{hotelName}</div>
                      {dateRange && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, textDecoration: stayAlert.struck ? 'line-through' : 'none' }}>{dateRange}</div>}
                      {stayAlert.pillLabel && (
                        <div style={{ marginTop: 6 }}>
                          <AlertPill label={stayAlert.pillLabel} tone={stayAlert.tone ?? 'danger'} />
                        </div>
                      )}
                      {booking.checkInNote && <div style={{ fontSize: 10, fontFamily: TYPE.sans, color: c.ink, fontStyle: 'italic', marginTop: 2 }}>{booking.checkInNote}</div>}
                      {booking.checkOutNote && <div style={{ fontSize: 10, fontFamily: TYPE.sans, color: c.ink, fontStyle: 'italic', marginTop: 2 }}>{booking.checkOutNote}</div>}
                      {booking.standardCheckinTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Check-in: ${fmtTime(booking.standardCheckinTime)}`}</div>}
{booking.approvedCheckinTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Early check-in approved: ${fmtTime(booking.approvedCheckinTime)}`}</div>}
{booking.expectedArrivalTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Expected arrival: ${fmtTime(booking.expectedArrivalTime)}`}</div>}
                      {booking.lateCheckoutApprovedTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Late checkout approved: ${fmtTime(booking.lateCheckoutApprovedTime)}`}</div>}
                      {booking.requestedCheckoutTime && !booking.lateCheckoutApprovedTime && (
                        <div style={{ marginTop: 4 }}><AlertPill label={`Check-Out Time Requested · ${fmtTime(booking.requestedCheckoutTime)}`} tone="caution" /></div>
                      )}
                      {(booking.extras ?? []).map((x, xi) => (
                        <div key={xi} style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>
                          {`${x.label}: ${moneyDec(x.amount, x.currency)}${x.charge_to === 'room' ? ' (charged to room)' : ''}`}
                          {x.note ? <span style={{ color: c.faint }}>{`  ·  ${x.note}`}</span> : null}
                        </div>
                      ))}
                      {booking.partyComposition && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{booking.partyComposition}</div>}
                      </div>
                    <div style={{ marginTop: 12 }}>
                      {booking.paymentException && <AlertPill label="Payment Outstanding" tone="danger" />}
                      {rooms.length === 0 && booking.confirmationNumber && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center',
                          border: `1px solid ${pillColor}`, borderRadius: 5,
                          padding: '3px 10px', marginBottom: 6,
                          background: ownArr ? '#F5F5F5' : '#FAF7F0',
                        }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: pillColor }}>
                            Conf #: {booking.confirmationNumber}
                          </span>
                        </div>
                      )}
                      {ownArr && (
                        <span style={{
                          display: 'inline-block', fontFamily: TYPE.sans, fontSize: 9,
                          letterSpacing: '0.12em', color: c.muted,
                          border: `0.5px solid ${c.faint}`, borderRadius: 999,
                          padding: '3px 10px', whiteSpace: 'nowrap',
                        }}>Own Arrangements</span>
                      )}
                      {!ownArr && (
                        <div style={{ fontSize: 11, fontFamily: TYPE.sans, fontStyle: 'italic', color: c.faint }}>{bookedByText}</div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Inclusions, cancellation policy, invoices - full width below header */}
                {(booking.inclusionsOverride && (booking.inclusionsOverride as {heading:string;bullets:string[]}[]).length > 0) && (
                  <div style={{ padding: '16px 20px', borderTop: `0.5px solid ${c.lineStrong}` }}>
                    {(booking.inclusionsOverride as {heading:string;bullets:string[]}[]).map((group, gi) => (
                      <div key={gi} style={{ marginTop: gi > 0 ? 12 : 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.gold, fontFamily: TYPE.sans, marginBottom: 6 }}>{group.heading}</div>
                        {group.bullets.map((b, bi) => (
                          <div key={bi} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: TYPE.sans, color: c.muted, lineHeight: 1.7 }}>
                            <span style={{ color: c.gold, flexShrink: 0 }}>·</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {booking.cancellationPolicy && (
                  <div style={{ padding: '12px 20px', borderTop: `0.5px solid ${c.lineStrong}`, background: c.surfaceSunken }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, fontFamily: TYPE.sans, marginBottom: 4 }}>Cancellation Policy</div>
                    <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{booking.cancellationPolicy}</div>
                  </div>
                )}
                {(booking._invoices ?? []).length > 0 && (
                  <div style={{ padding: '12px 20px', borderTop: `0.5px solid ${c.lineStrong}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, fontFamily: TYPE.sans, marginBottom: 6 }}>Invoices</div>
                    {(booking._invoices as BookingInvoice[]).map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6, paddingBottom: 6, borderTop: `0.5px solid ${c.lineStrong}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink }}>{inv.description ?? `Invoice ${inv.invoiceNumber}`}</div>
                          <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 1 }}>
                            {inv.invoiceDate ? formatDate(inv.invoiceDate) : ''}
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: c.faint, marginLeft: 8 }}>#{inv.invoiceNumber}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink, flexShrink: 0 }}>
                          {moneyDec(inv.amount ?? 0, inv.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Nested rooms */}
                {rooms.length > 0 && (
                  <div style={{ borderTop: `0.5px solid ${c.lineStrong}` }}>
                    {rooms.map((room, ri) => {
                      const guests = webRoomDisplay(room).guestLine
                      return (
                        <div key={room.id ?? ri} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          gap: 16, padding: '12px 20px',
                          borderTop: ri > 0 ? `0.5px solid ${c.lineStrong}` : 'none',
                          flexWrap: 'wrap',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {room.roomName && <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink, lineHeight: 1.3 }}>{room.roomName}</div>}
                            {guests && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{guests}</div>}
                            {beddingLabel(room.beddingType) && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{beddingLabel(room.beddingType)}</div>}
                          </div>
                          {room.confirmationNumber && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                              border: `1px solid ${pillColor}`, borderRadius: 5,
                              padding: '3px 10px',
                              background: ownArr ? '#F5F5F5' : '#FAF7F0',
                            }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: pillColor }}>
                                Conf #: {room.confirmationNumber}
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
            const ownArr    = isOwnArrangements(aux.bookedBy)
            const pillColor = ownArr ? c.faint : c.gold
            const alert      = scheduleAlert(aux)
            const timeStr    = [fmtTime(aux.startTime), fmtTime(aux.endTime)].filter(Boolean).join(' - ')
            const route      = [aux.origin, aux.destination].filter(Boolean).join(' \u2192 ')

            return (
              <div key={aux.id} style={{
                background: '#fff', border: `0.5px solid ${c.lineStrong}`,
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 16,
                boxSizing: 'border-box',
              }}>
                {aux.imageSrc ? (
                  <div
                    style={{
                      width: 72, height: 72, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                      background: c.surfaceSunken, position: 'relative', cursor: 'zoom-in',
                    }}
                    onClick={() => setLightbox({ src: aux.imageSrc!, alt: aux.name ?? '' })}
                  >
                    <img src={aux.imageSrc} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 22, color: c.gold, flexShrink: 0, lineHeight: 1, paddingTop: 2 }}>{section.icon}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {aux.name && <div style={{ fontSize: 16, fontFamily: TYPE.serif, color: aux.diningStatus === 'cancelled' ? c.faint : c.ink, marginBottom: 3, textDecoration: aux.diningStatus === 'cancelled' ? 'line-through' : 'none' }}>{aux.name}</div>}
                  {route && <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.muted, wordBreak: 'break-word' }}>{route}</div>}
                  {aux.startDate && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.faint, marginTop: 2 }}>{formatDate(aux.startDate)}</div>}
                  {alert.originalStart || alert.originalEnd ? (
                    <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 700, color: c.ink, marginTop: 4 }}>
                      <span style={{ textDecoration: 'line-through', color: c.faint, fontWeight: 400 }}>{fmtTime(alert.originalStart)}</span> {fmtTime(aux.startTime)}
                      {aux.endTime && <> - <span style={{ textDecoration: 'line-through', color: c.faint, fontWeight: 400 }}>{fmtTime(alert.originalEnd)}</span> {fmtTime(aux.endTime)}</>}
                    </div>
                  ) : alert.struck ? (
                    <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 400, color: c.faint, textDecoration: 'line-through', marginTop: 4 }}>{timeStr}</div>
                  ) : (timeStr && <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 700, color: c.ink, marginTop: 4 }}>{timeStr}</div>)}
                  {[aux.cabinClass, aux.aircraftType, aux.tailNumber, aux.flightTime ? `${aux.flightTime} flight time` : null, aux.distanceNm ? `${aux.distanceNm} NM` : null].filter(Boolean).length > 0 && (
                    <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 4 }}>
                      {[aux.cabinClass, aux.aircraftType, aux.tailNumber, aux.flightTime ? `${aux.flightTime} flight time` : null, aux.distanceNm ? `${aux.distanceNm} NM` : null].filter(Boolean).join(' \u00b7 ')}
                    </div>
                  )}
                  {aux.crew && aux.crew.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 4 }}>Crew</div>
                      {aux.crew.map((m, i) => (
                        <div key={i} style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink, marginTop: i ? 2 : 0 }}>
                          <span style={{ fontWeight: 600 }}>{m.name}</span>
                          <span style={{ color: c.muted }}>{`  \u00b7  ${m.role}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(aux.departFboName || aux.arriveFboName) && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {aux.departFboName && (
                        <div>
                          <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 2 }}>Departure FBO</div>
                          <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink }}>{aux.departFboName}</div>
                          {aux.departFboAddress && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 1 }}>{aux.departFboAddress}</div>}
                          {aux.departFboPhone && <a href={toTelHref(aux.departFboPhone) ?? '#'} style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.gold, textDecoration: 'none', marginTop: 1, display: 'inline-block' }}>{aux.departFboPhone}</a>}
                        </div>
                      )}
                      {aux.arriveFboName && (
                        <div>
                          <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 2 }}>Arrival FBO</div>
                          <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink }}>{aux.arriveFboName}</div>
                          {aux.arriveFboAddress && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 1 }}>{aux.arriveFboAddress}</div>}
                          {aux.arriveFboPhone && <a href={toTelHref(aux.arriveFboPhone) ?? '#'} style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.gold, textDecoration: 'none', marginTop: 1, display: 'inline-block' }}>{aux.arriveFboPhone}</a>}
                        </div>
                      )}
                    </div>
                  )}
                  {alert.pillLabel && (
                    <div style={{ marginTop: 8 }}><AlertPill label={alert.pillLabel} tone={alert.tone ?? 'caution'} /></div>
                  )}
                  {ownArr && (
                    <span style={{
                      display: 'inline-block', marginTop: 6, fontFamily: TYPE.sans, fontSize: 9,
                      letterSpacing: '0.12em', color: c.muted,
                      border: `0.5px solid ${c.faint}`, borderRadius: 999,
                      padding: '3px 10px', whiteSpace: 'nowrap',
                    }}>Own Arrangements</span>
                  )}
                  {(() => {
                    const pax = (aux.passengers ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
                    if (pax.length === 0) return null
                    return (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {pax.map(p => {
                          const detail = [
                            p.confirmationNumber ? `Conf ${p.confirmationNumber}` : null,
                            p.seatNumbers ? `Seats ${p.seatNumbers}` : null,
                          ].filter(Boolean).join('  \u00b7  ')
                          return (
                            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans }}>{passengerName(p)}</span>
                              {detail && <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: c.muted }}>{detail}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  {(() => {
                    const isGroundCar = isGroundTransportElement(aux.elementType)
                    const veh = isGroundCar ? (aux.driverDetails ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder) : []
                    if (veh.length === 0) return null
                    return (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {veh.map(v => (
                          <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans }}>{v.driverName || 'Driver'}</span>
                            {v.vehicleRole && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.gold, fontFamily: TYPE.sans }}>{v.vehicleRole}</span>}
                            <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: c.muted }}>
                              {[v.driverPhone, v.carModel, v.plate].filter(Boolean).join('  \u00b7  ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {isMeetGreetElement(aux.elementType) && (aux.contactName || aux.contactPhone) && (
                    <div style={{ marginTop: 8 }}>
                      {aux.contactName && <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink }}>{aux.contactName}</div>}
                      {aux.contactPhone && (
                        <a href={toTelHref(aux.contactPhone) ?? '#'} style={{ display: 'inline-block', fontSize: 12, fontFamily: TYPE.sans, color: c.gold, textDecoration: 'none', marginTop: 2 }}>{aux.contactPhone}</a>
                      )}
                      {aux.notes && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, fontStyle: 'italic', marginTop: 2 }}>{aux.notes}</div>}
                    </div>
                  )}
                  {(aux.venue || aux.guestName || aux.guestCount) && (() => {
                    const v = aux.venue
                    const guestLine = [aux.guestName, aux.guestCount ? `${aux.guestCount} guests` : null].filter(Boolean).join('  \u00b7  ')
                    const rows: { label: string; value: string }[] = []
                    if (v?.address)         rows.push({ label: 'Address',  value: v.address })
                    if (v?.phone)           rows.push({ label: 'Phone',    value: v.phone })
                    if (v?.dressCode)      rows.push({ label: 'Dress',    value: v.dressCode })
                    if (v?.childrenPolicy) rows.push({ label: 'Children', value: v.childrenPolicy })
                    if (v?.tableHoldNote) rows.push({ label: 'Table',    value: v.tableHoldNote })
                    return (
                      <div style={{ marginTop: 8 }}>
                        {guestLine && <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.muted, marginBottom: rows.length ? 8 : 0 }}>{guestLine}</div>}
                        {(aux.packageName || aux.pricePerPerson || (aux.packageInclusions?.length ?? 0) > 0 || (aux.menu?.length ?? 0) > 0) && (
                          <div style={{ marginBottom: rows.length ? 8 : 0, paddingBottom: 8, borderBottom: rows.length ? `0.5px solid ${c.lineStrong}` : 'none' }}>
                            {(aux.packageName || aux.pricePerPerson) && (
                              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: (aux.packageInclusions?.length || aux.menu?.length) ? 8 : 0 }}>
                                {aux.packageName && <span style={{ fontSize: 13, fontFamily: TYPE.serif, color: c.ink }}>{aux.packageName}</span>}
                                {aux.pricePerPerson != null && <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: c.muted }}>{`${moneyDec(aux.pricePerPerson, aux.currency ?? 'EUR')} per person`}</span>}
                              </div>
                            )}
                            {(aux.packageInclusions?.length ?? 0) > 0 && (
                              <div style={{ marginBottom: (aux.menu?.length ?? 0) > 0 ? 8 : 0 }}>
                                <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 4 }}>Includes</div>
                                {aux.packageInclusions!.map((line, i) => (
                                  <div key={i} style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.6 }}>{line}</div>
                                ))}
                              </div>
                            )}
                            {(aux.menu?.length ?? 0) > 0 && (
                              <div>
                                <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 4 }}>Menu</div>
                                {aux.menu!.map((line, i) => (
                                  <div key={i} style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.6 }}>{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {rows.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: i ? 4 : 0, flexWrap: 'wrap' }}>
                            <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint }}>{r.label}</div>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {r.label === 'Address' && v?.mapsUrl
                                ? <a href={v.mapsUrl} target='_blank' rel='noopener noreferrer' style={{ color: c.gold, textDecoration: 'none' }}>{r.value}</a>
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
      {experiences.length > 0 && (
        <TabSection label='EXPERIENCES'>
          {experiences.map(x => (
            <div key={x.id} style={{ background: '#fff', border: `0.5px solid ${c.lineStrong}`, borderRadius: 12, overflow: 'hidden', padding: '16px 20px' }}>
              formatDate(x.entryDate)
              <div style={{ fontSize: 16, fontFamily: TYPE.serif, color: c.ink, marginTop: 2 }}>{x.title}</div>
              {x.notes && <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.muted, marginTop: 4 }}>{x.notes}</div>}
            </div>
          ))}
        </TabSection>
      )}
    </div>
  )
}

// ── Programme tab ─────────────────────────────────────────────────────────────

export function ProgrammeTab({ days, entries, onActiveDayChange, brief }: {
  days:               JourneyDay[]
  entries:            TimelineItemView[]
  brief:              any
  onActiveDayChange?: (label: string, openSidebar: () => void) => void
}) {
  const visibleDays = days.filter(d => d.show)
  const defaultDate = visibleDays.find(d => d.entryDate === localDateStr())?.entryDate ?? visibleDays[0]?.entryDate ?? null
  const [activeDate,  setActiveDate]  = useState(defaultDate)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lightbox,    setLightbox]    = useState<{ src: string; alt: string } | null>(null)
  const width    = useWindowWidth()
  const isMobile = width < 768

  const activeDay = visibleDays.find(d => d.entryDate === activeDate) ?? null

  useEffect(() => {
    if (!onActiveDayChange) return
    const idx      = visibleDays.findIndex(d => d.entryDate === activeDate)
    const dayN     = idx >= 0 ? `Day ${idx + 1}` : null
    const label    = activeDay
      ? (activeDay.dayLabel || formatDateShortWeekday(activeDay.entryDate))
      : 'Select day'
    const combined = dayN ? `${dayN} · ${label}` : label
    onActiveDayChange(combined, () => setSidebarOpen(true))
  }, [activeDate, onActiveDayChange])

// The EF (_shared/timeline.ts) already merged + ordered the stream. Filter by
  // active day and map each TimelineItem to the card shape. No client derivation.
  const cards: EngagementElementView[] = activeDay
    ? entries
        .filter(e => e.entryDate === activeDay.entryDate && e.briefShow)
        .map((e): EngagementElementView => {
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
            ...e,
            subtitle:          isFlight ? null : e.subtitle,
            flightOrigin,
            flightDestination,
            flightDepartTime:  isFlight ? e.startTime : null,
            flightArriveTime:  isFlight ? e.endTime   : null,
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
          borderRight:   `1px solid ${c.lineStrong}`,
          background:    c.surface,
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
            borderBottom:   `1px solid ${c.lineStrong}`,
            flexShrink:     0,
          }}>
            {sidebarOpen && (
              <span style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.faint }}>
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
                color:          c.gold,
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
                const isActive = day.entryDate === activeDate
                return (
                  <button
                    key={day.entryDate}
                    onClick={() => { setActiveDate(day.entryDate); if (isMobile) setSidebarOpen(false) }}
                    style={{
                      width:      '100%',
                      textAlign:  'left',
                      padding:    '10px 16px',
                      border:     'none',
                      borderLeft: `3px solid ${isActive ? c.gold : 'transparent'}`,
                      background: isActive ? `${c.gold}0A` : 'transparent',
                      cursor:     'pointer',
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isActive ? c.gold : c.faint, marginBottom: 2 }}>
                      Day {i + 1}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: TYPE.sans, fontWeight: isActive ? 700 : 400, color: isActive ? c.ink : c.muted, lineHeight: 1.3 }}>
                      {day.dayLabel || formatDateShortWeekday(day.entryDate)}
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
              <div style={{ fontSize: 10, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: c.gold, marginBottom: 6 }}>
                {activeDay.dayLabel || ''}
              </div>
              <div style={{ fontSize: 'clamp(22px,3vw,32px)', fontFamily: TYPE.serif, color: c.ink, lineHeight: 1.2, marginBottom: 14 }}>
                {formatDateWeekday(activeDay.entryDate)}
              </div>
              {activeDay.dayNote && (
                <div style={{ fontSize: 13, fontFamily: TYPE.sans, color: c.muted, fontStyle: 'italic', marginBottom: 12 }}>
                  {activeDay.dayNote}
                </div>
              )}
              <div style={{ height: 1, background: c.lineStrong }} />
            </div>

            {cards.length === 0 ? (
              <div style={{ fontSize: 13, fontFamily: TYPE.sans, color: c.faint, fontStyle: 'italic' }}>Nothing planned today.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cards.map(item => {
                  const accent      = categoryAccentHex(item.category)
                  const dep         = fmtTime(item.startTime)
                  const arr         = fmtTime(item.endTime)
                  const isFlight    = !!(item.flightOrigin || item.flightDestination || item.flightDepartTime || item.flightArriveTime)
                  const timeStr     = isFlight ? null : (dep && arr ? `${dep} - ${arr}` : dep || arr || null)
                  const isMobileW   = width < 600
                  const stackLayout = isMobileW && !!item.imageSrc

                  // Hotel stays render in the Confirmation card style (concise image
                  // header + clean nested rooms), not the generic programme card.
                  const isHotelStay = item.category === 'stay' && item.rooms.length > 0
                  const alert = scheduleAlert({ scheduleStatus: item.scheduleStatus, scheduleNote: item.scheduleNote, status: item.status, statusNote: null, originalStartTime: item.originalStartTime, originalEndTime: item.originalEndTime })
                  if (isHotelStay) {
                    return (
                      <div key={item.id} style={{
                        background: '#fff', border: `0.5px solid ${c.lineStrong}`,
                        borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box',
                      }}>
                        <div style={{ display: 'flex', minHeight: 100 }}>
                          {item.imageSrc && (
                            <div
                              style={{
                                width: 'clamp(100px,30%,200px)', flexShrink: 0,
                                background: c.surfaceSunken, position: 'relative', overflow: 'hidden',
                                cursor: 'zoom-in',
                              }}
                              onClick={() => setLightbox({ src: item.imageSrc!, alt: item.title })}
                            >
                              <img src={item.imageSrc} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.muted }}>
                                  {item.categoryLabel ?? 'Hotel'}
                                </span>
                                {item.status && item.status !== 'cancelled' && item.kind !== 'hotel_checkout' && <StatusPill status={item.status} />}
                              </div>
                              <div style={{ fontSize: 16, fontFamily: TYPE.serif, color: alert.struck ? c.faint : c.ink, lineHeight: 1.3, textDecoration: alert.struck ? 'line-through' : 'none' }}>{item.title}</div>
                              {alert.pillLabel && <div style={{ marginTop: 6 }}><AlertPill label={alert.pillLabel} tone={alert.tone ?? 'danger'} /></div>}
                              {item.checkInNote && <div style={{ fontSize: 10, fontFamily: TYPE.sans, color: c.ink, fontStyle: 'italic', marginTop: 2 }}>{item.checkInNote}</div>}
                              {item.checkOutNote && <div style={{ fontSize: 10, fontFamily: TYPE.sans, color: c.ink, fontStyle: 'italic', marginTop: 2 }}>{item.checkOutNote}</div>}
                              {item.lateCheckoutApprovedTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Late Checkout Approved: ${fmtTime(item.lateCheckoutApprovedTime)}`}</div>}
                              {item.requestedCheckoutTime && <div style={{ marginTop: 4 }}><AlertPill label={`Check-Out TimeRequested · ${fmtTime(item.requestedCheckoutTime)}`} tone="caution" /></div>}
                              {item.standardCheckinTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Check-in: ${fmtTime(item.standardCheckinTime)}`}</div>}
{item.approvedCheckinTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Early check-in approved: ${fmtTime(item.approvedCheckinTime)}`}</div>}
{item.expectedArrivalTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Expected arrival: ${fmtTime(item.expectedArrivalTime)}`}</div>}
                            </div>
                            {bookedByLabel(item.bookedBy) && (
                              <div style={{ fontSize: 11, fontFamily: TYPE.sans, fontStyle: 'italic', color: c.faint, marginTop: 8 }}>{bookedByLabel(item.bookedBy)}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ borderTop: `0.5px solid ${c.lineStrong}` }}>
                          {item.rooms.map((room, ri) => {
                            const rd = webRoomDisplay({ guestName: room.guest, resolvedAdditionalGuests: room.additionalGuests, partyComposition: room.partyComposition, roomName: room.roomName })
                            return (
                              <div key={room.id} style={{
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                                gap: 16, padding: '12px 20px',
                                borderTop: ri > 0 ? `0.5px solid ${c.lineStrong}` : 'none',
                                flexWrap: 'wrap',
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {rd.roomName && <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink, lineHeight: 1.3 }}>{rd.roomName}</div>}
                                  {rd.guestLine && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{rd.guestLine}</div>}
                                  {beddingLabel(room.beddingType) && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{beddingLabel(room.beddingType)}</div>}
                                  {room.notes && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.faint, fontStyle: 'italic', marginTop: 2 }}>{room.notes}</div>}
                                </div>
                                {room.confirmationNumber && (
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                                    border: `1px solid ${c.gold}`, borderRadius: 5, padding: '3px 10px', background: '#FAF7F0',
                                  }}>
                                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: c.ink }}>Conf #: {room.confirmationNumber}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  // Airport greeter - concise card: who's meeting, phone, flight ref, time.
                  if (isMeetGreetElement(item.category) && (item.contactName || item.contactPhone)) {
                    return (
                      <div key={item.id} style={{
                        background: '#fff', border: `0.5px solid ${c.lineStrong}`, borderRadius: 12,
                        overflow: 'hidden', borderLeft: `3px solid ${accent}`,
                        padding: '16px 20px', boxSizing: 'border-box',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.muted }}>
                            {item.categoryLabel ?? 'Airport Meet & Greet'}
                          </span>
                          {timeStr && <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: c.ink }}>{timeStr}</span>}
                        </div>
                        <div style={{ fontSize: 'clamp(14px,1.8vw,17px)', fontFamily: TYPE.serif, color: c.ink, lineHeight: 1.3, marginBottom: 6 }}>{item.title}</div>
                        {item.contactName && <div style={{ fontSize: 13, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink }}>{item.contactName}</div>}
                        {item.contactPhone && (
                          <a href={toTelHref(item.contactPhone) ?? '#'} style={{ display: 'inline-block', fontSize: 12, fontFamily: TYPE.sans, color: c.gold, textDecoration: 'none', marginTop: 2 }}>{item.contactPhone}</a>
                        )}
                        {item.notes && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, fontStyle: 'italic', marginTop: 4 }}>{item.notes}</div>}
                      </div>
                    )
                  }

                  // Venue reservation (dining, reservation, or any shape with a venue/party)
                  // - essentials inline + pill + collapsible reservation details.
                  if (item.venue || item.guestName || item.guestCount) {
                    const pill = diningPillModel({
                      showCancellation: item.showCancellation,
                      diningStatus:     item.diningStatus,
                      penaltyApplied:   item.cancellationPenaltyApplied,
                      cancellationNote: item.cancellationNote,
                      bookingTerms:     item.venue?.bookingTerms ?? null,
                    })
                    const cancelled = item.diningStatus === 'cancelled'
                    const essentials = [item.guestName, item.guestCount ? `${item.guestCount} guests` : null].filter(Boolean).join('  \u00b7  ')
                    const v = item.venue
                    const hasDetails = !!(v?.address || v?.phone || v?.dressCode || v?.childrenPolicy || v?.tableHoldNote)
                    return (
                      <div key={item.id} style={{
                        background: '#fff', border: `0.5px solid ${c.lineStrong}`, borderRadius: 12,
                        overflow: 'hidden', display: 'flex',
                        flexDirection: stackLayout ? 'column' : 'row',
                        minHeight: (!stackLayout && item.imageSrc) ? 140 : 'auto',
                        boxSizing: 'border-box',
                      }}>
                        {item.imageSrc && (
                          <div
                            style={{ width: stackLayout ? '100%' : 'clamp(120px,28%,200px)', height: stackLayout ? 200 : 'auto', flexShrink: 0, background: c.surfaceSunken, position: 'relative', overflow: 'hidden', cursor: 'zoom-in' }}
                            onClick={() => setLightbox({ src: item.imageSrc!, alt: item.title })}
                          >
                            <img src={item.imageSrc} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent }} />
                          </div>
                        )}
                        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', minWidth: 0, borderLeft: (!stackLayout && !item.imageSrc) ? `3px solid ${accent}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.muted }}>{item.categoryLabel ?? 'Dining'}</span>
                            </div>
                            {timeStr && <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: c.ink }}>{timeStr}</span>}
                          </div>
                          <div style={{ fontSize: 'clamp(14px,1.8vw,17px)', fontFamily: TYPE.serif, color: cancelled ? c.faint : c.ink, lineHeight: 1.3, marginBottom: 4, textDecoration: cancelled ? 'line-through' : 'none' }}>{item.title}</div>
                          {essentials && <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.muted }}>{essentials}</div>}
                          {(item.packageName || item.pricePerPerson || (item.packageInclusions?.length ?? 0) > 0 || (item.menu?.length ?? 0) > 0) && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${c.lineStrong}` }}>
                              {(item.packageName || item.pricePerPerson) && (
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: (item.packageInclusions?.length || item.menu?.length) ? 8 : 0 }}>
                                  {item.packageName && <span style={{ fontSize: 13, fontFamily: TYPE.serif, color: c.ink }}>{item.packageName}</span>}
                                  {item.pricePerPerson != null && <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: c.muted }}>{`${moneyDec(item.pricePerPerson, item.currency ?? 'EUR')} per person`}</span>}
                                </div>
                              )}
                              {(item.packageInclusions?.length ?? 0) > 0 && (
                                <div style={{ marginBottom: (item.menu?.length ?? 0) > 0 ? 8 : 0 }}>
                                  <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 4 }}>Includes</div>
                                  {item.packageInclusions!.map((line, i) => (
                                    <div key={i} style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.6 }}>{line}</div>
                                  ))}
                                </div>
                              )}
                              {(item.menu?.length ?? 0) > 0 && (
                                <div>
                                  <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint, marginBottom: 4 }}>Menu</div>
                                  {item.menu!.map((line, i) => (
                                    <div key={i} style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.6 }}>{line}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <DiningPillBox model={pill} />
                          {hasDetails && (
                            <details style={{ marginTop: 10 }}>
                              <summary style={{ fontSize: 10, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.gold, cursor: 'pointer', listStyle: 'none' }}>Venue Details</summary>
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {v?.address && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint }}>Address</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.5, wordBreak: 'break-word' }}>
                                      {v.mapsUrl ? <a href={v.mapsUrl} target='_blank' rel='noopener noreferrer' style={{ color: c.gold, textDecoration: 'none' }}>{v.address}</a> : v.address}
                                    </div>
                                  </div>
                                )}
                                {v?.phone && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint }}>Phone</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: TYPE.sans, color: c.ink }}>{v.phone}</div>
                                  </div>
                                )}
                                {v?.dressCode && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint }}>Dress</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.5 }}>{v.dressCode}</div>
                                  </div>
                                )}
                                {v?.childrenPolicy && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint }}>Children</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.5 }}>{v.childrenPolicy}</div>
                                  </div>
                                )}
                                {v?.tableHoldNote && (
                                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.faint }}>Table</div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.5 }}>{v.tableHoldNote}</div>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                          {item.notes && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.faint, fontStyle: 'italic', lineHeight: 1.5, marginTop: 6 }}>{item.notes}</div>}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={item.id} style={{
                      background: '#fff', border: `0.5px solid ${c.lineStrong}`, borderRadius: 12,
                      overflow: 'hidden', display: 'flex',
                      flexDirection: stackLayout ? 'column' : 'row',
                      minHeight: (!stackLayout && item.imageSrc) ? 140 : 'auto',
                      boxSizing: 'border-box',
                    }}>
                      {item.imageSrc && (
                        <div
                          style={{
                            width: stackLayout ? '100%' : 'clamp(120px,28%,200px)',
                            height: stackLayout ? 200 : 'auto',
                            flexShrink: 0, background: c.surfaceSunken,
                            position: 'relative', overflow: 'hidden', cursor: 'zoom-in',
                          }}
                          onClick={() => setLightbox({ src: item.imageSrc!, alt: item.title })}
                        >
                          <img src={item.imageSrc} alt='' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent }} />
                        </div>
                      )}

                      <div style={{
                        flex: 1, padding: '16px 20px', display: 'flex',
                        flexDirection: 'column', minWidth: 0,
                        borderLeft: (!stackLayout && !item.imageSrc) ? `3px solid ${accent}` : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.muted }}>
                              {item.categoryLabel ?? item.category ?? 'Other'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {item.status && item.status !== 'cancelled' && item.kind !== 'hotel_checkout' && <StatusPill status={item.status} />}
                            {timeStr && <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: c.ink }}>{timeStr}</span>}
                          </div>
                        </div>

                        <div style={{ fontSize: 'clamp(14px,1.8vw,17px)', fontFamily: TYPE.serif, color: c.ink, lineHeight: 1.3, marginBottom: 4 }}>
                          {item.title}
                        </div>

                        {item.scheduleStatus === 'tentative' && (
                          <div style={{ marginTop: 4 }}><AlertPill label="Tentatively Scheduled" tone="caution" /></div>
                        )}
                        {item.lateCheckoutApprovedTime && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{`Late Checkout Approved: ${fmtTime(item.lateCheckoutApprovedTime)}`}</div>}
                        {item.requestedCheckoutTime && <div style={{ marginTop: 4 }}><AlertPill label={`Check-Out Time Requested · ${fmtTime(item.requestedCheckoutTime)}`} tone="caution" /></div>}
                        {item.rooms.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {item.rooms.map(room => {
                              const rd = webRoomDisplay({ guestName: room.guest, resolvedAdditionalGuests: room.additionalGuests, partyComposition: room.partyComposition, roomName: room.roomName })
                              return (
                                <div key={room.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      {rd.roomName && <span style={{ display: 'block', fontSize: 13, fontFamily: TYPE.sans, fontWeight: 600, color: c.ink, lineHeight: 1.3 }}>{rd.roomName}</span>}
                                      {rd.guestLine && <span style={{ display: 'block', fontSize: 12, fontFamily: TYPE.sans, color: c.muted, marginTop: 2 }}>{rd.guestLine}</span>}
                                    </div>
                                    {room.confirmationNumber && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                                        border: `1px solid ${c.gold}`, borderRadius: 4, padding: '1px 8px', background: '#FAF7F0',
                                      }}>
                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: c.ink }}>Conf #: {room.confirmationNumber}</span>
                                      </span>
                                    )}
                                  </div>
                                  {room.notes && <span style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.faint, fontStyle: 'italic' }}>{room.notes}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {isFlight && (item.flightOrigin || item.flightDestination) && (
                          <div style={{
                            marginTop: 10, marginBottom: 8,
                            padding: '10px 12px',
                            background: c.surfaceSunken,
                            borderRadius: 6,
                            display: 'flex', flexDirection: 'column', gap: 6,
                          }}>
                            {alert.pillLabel && (
                              <div><AlertPill label={alert.pillLabel} tone={alert.tone ?? 'danger'} /></div>
                            )}
                            {item.flightOrigin && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{
                                  width: 64, flexShrink: 0,
                                  fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700,
                                  letterSpacing: '0.12em', textTransform: 'uppercase',
                                  color: c.faint,
                                }}>
                                  Departure
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {item.flightOrigin}
                                </div>
                                {item.flightDepartTime && (
                                  <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: alert.struck ? 400 : 700, color: alert.struck ? c.faint : c.ink, textDecoration: alert.struck ? 'line-through' : 'none', flexShrink: 0 }}>
                                    {alert.originalStart && (
                                      <span style={{ textDecoration: 'line-through', color: c.faint, fontWeight: 400, marginRight: 5 }}>{fmtTime(alert.originalStart)}</span>
                                    )}
                                    {fmtTime(item.flightDepartTime)}
                                  </div>
                                )}
                              </div>
                            )}
                            {item.flightDestination && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{
                                  width: 64, flexShrink: 0,
                                  fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700,
                                  letterSpacing: '0.12em', textTransform: 'uppercase',
                                  color: c.faint,
                                }}>
                                  Arrival
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {item.flightDestination}
                                </div>
                                {item.flightArriveTime && (
                                  <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: alert.struck ? 400 : 700, color: alert.struck ? c.faint : c.ink, textDecoration: alert.struck ? 'line-through' : 'none', flexShrink: 0 }}>
                                    {alert.originalEnd && (
                                      <span style={{ textDecoration: 'line-through', color: c.faint, fontWeight: 400, marginRight: 5 }}>{fmtTime(alert.originalEnd)}</span>
                                    )}
                                    {fmtTime(item.flightArriveTime)}
                                  </div>
                                )}
                              </div>
                            )}
                            {false && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{
                                  width: 64, flexShrink: 0,
                                  fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700,
                                  letterSpacing: '0.12em', textTransform: 'uppercase',
                                  color: c.faint,
                                }}>
                                  Cabin
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {null}
                                </div>
                              </div>
                            )}
                            {item.passengers.length > 0 ? (
                              item.passengers.map(p => {
                                const detail = [
                                  p.confirmationNumber ? `Conf ${p.confirmationNumber}` : null,
                                  p.seatNumbers ? `Seats ${p.seatNumbers}` : null,
                                ].filter(Boolean).join('  \u00b7  ')
                                return (
                                  <div key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.faint }}>
                                      Guest
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                      <span style={{ fontWeight: 600 }}>{p.resolvedPassengerLabel || p.passengerLabel || 'Guest'}</span>
                                      {detail && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: c.muted }}>{`  ${detail}`}</span>}
                                    </div>
                                  </div>
                                )
                              })
                            ) : null}
                          </div>
                        )}

                        {item.subtitle && <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.muted, marginBottom: 4 }}>{item.subtitle}</div>}
                        {item.notes && <div style={{ fontSize: 11, fontFamily: TYPE.sans, color: c.faint, fontStyle: 'italic', lineHeight: 1.5 }}>{item.notes}</div>}

                        {item.driverDetails.length > 0 && (
                          <div style={{ marginTop: 10, marginBottom: 8, padding: '10px 12px', background: c.surfaceSunken, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {item.driverDetails.map(v => (
                              <div key={v.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ width: 64, flexShrink: 0, fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.faint }}>
                                  {v.vehicleRole || 'Driver'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: TYPE.sans, color: c.ink, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  <span style={{ fontWeight: 600 }}>{v.driverName || 'Driver'}</span>
                                  {[v.driverPhone, v.carModel, v.plate].filter(Boolean).length > 0 && (
                                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: c.muted }}>{`  ${[v.driverPhone, v.carModel, v.plate].filter(Boolean).join('  \u00b7  ')}`}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.passengers.length === 0 && item.confirmationNumber && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${c.lineStrong}` }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${c.gold}`, borderRadius: 4, padding: '1px 8px', background: '#FAF7F0' }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: c.ink }}>Conf #: {item.confirmationNumber}</span>
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
          <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,5vw,56px)', fontSize: 13, fontFamily: TYPE.sans, color: c.faint, fontStyle: 'italic' }}>
            No programme days available yet.
          </div>
        )}

        {brief?.programmeNotes?.trim() && (
          <div style={{
            padding:   'clamp(20px,4vw,36px) clamp(20px,5vw,56px)',
            borderTop: `1px solid ${c.lineStrong}`,
          }}>
            <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: c.gold, marginBottom: 12 }}>
              Notes
            </div>
            <div style={{ fontSize: 13, fontFamily: TYPE.sans, color: c.muted, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {brief.programmeNotes}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Trip Brief tab ────────────────────────────────────────────────────────────

export function EngagementBriefTab({ clientData }: {
  clientData: DeliveryData
}) {
  const { journey: trip, house, elements } = clientData

  const flights   = elements.filter(a => isFlightElement(a.elementType))
  const transfers = elements.filter(a => isTransferElement(a.elementType))
  const hotels    = trip.bookings.filter(b => (b._rooms?.length ?? 0) > 0 && b.briefShow !== false)
  const experiences = (clientData.entries ?? []).filter(e => e.category === 'experience' && e.briefShow !== false)

  function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: c.gold, fontFamily: TYPE.sans, marginBottom: 14 }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  function BriefRow({ label, value, sub, bookedBy, cancelled, cancellationNote }: { label: string; value: string; sub?: string; bookedBy?: string; cancelled?: boolean; cancellationNote?: string | null }) {
    return (
      <div style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
        <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: c.faint, fontFamily: TYPE.sans }}>{label}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: cancelled ? c.faint : c.ink, fontFamily: TYPE.sans, wordBreak: 'break-word', textDecoration: cancelled ? 'line-through' : 'none' }}>{value}</span>
            {cancelled && <span style={{ fontSize: 8, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B4321F', border: '1px solid #B4321F', borderRadius: 4, padding: '1px 6px' }}>Cancelled</span>}
          </div>
          {sub      && <div style={{ fontSize: 11, color: c.muted, fontFamily: TYPE.sans, marginTop: 2, wordBreak: 'break-word' }}>{sub}</div>}
          {cancelled && cancellationNote && <div style={{ fontSize: 11, color: '#B4321F', fontFamily: TYPE.sans, marginTop: 2, wordBreak: 'break-word' }}>{cancellationNote}</div>}
          {bookedBy && <div style={{ fontSize: 11, color: c.faint, fontFamily: TYPE.sans, marginTop: 2, fontStyle: 'italic' }}>{bookedBy}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,6vw,80px)' }}>
      <BriefSection title='Overview'>
        <BriefRow label='Guest'        value={clientData.guestDisplayName ?? ''} />
        <BriefRow label='Trip'         value={clientData.brief?.briefTitle ?? trip.destinations[0]?.name ?? ''} />
        {trip.startDate      && <BriefRow label='Departure'    value={formatDate(trip.startDate)} />}
        {trip.endDate        && <BriefRow label='Return'       value={formatDate(trip.endDate)} />}
        {trip.durationNights && <BriefRow label='Duration'     value={`${trip.durationNights} nights`} />}
        {trip.destinations.length > 0 && <BriefRow label='Destinations' value={trip.destinations.map(d => d.name).join(', ')} />}
      </BriefSection>

      {hotels.length > 0 && (
        <BriefSection title='Accommodation'>
          {hotels.map(h => {
            const rooms = h._rooms ?? []
            // Room categories with counts + per-room confirmation numbers.
            // Names are deliberately omitted here - guest names live on the
            // Confirmation tab. The brief is an at-a-glance index: category,
            // count, conf. Party composition (counts, not names) shows once
            // at booking level.
            const catGroups = rooms.reduce((acc: Record<string, { count: number; confs: string[] }>, r: any) => {
              const name = r.roomName ?? 'Room'
              if (!acc[name]) acc[name] = { count: 0, confs: [] }
              acc[name].count += 1
              if (r.confirmationNumber) acc[name].confs.push(r.confirmationNumber)
              return acc
            }, {})
            const categories = Object.entries(catGroups).map(([name, g]) => ({
              label: g.count > 1 ? `${name} \u00d7${g.count}` : name,
              confs: g.confs,
            }))
            return (
              <div key={h.id} style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: c.faint, fontFamily: TYPE.sans }}>
                  {formatDateRange(h.checkInDate ?? h.startDate, h.endDate) || ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans, wordBreak: 'break-word' }}>
                    {h._hotel_name ?? h.name ?? 'Hotel'}
                  </div>
                  {h.nights && <div style={{ fontSize: 11, color: c.muted, fontFamily: TYPE.sans, marginTop: 2 }}>{`${h.nights} nights`}</div>}
                  {h.partyComposition && <div style={{ fontSize: 11, color: c.muted, fontFamily: TYPE.sans, marginTop: 2, wordBreak: 'break-word' }}>{h.partyComposition}</div>}
                  {categories.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {categories.map((cat, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: c.muted, fontFamily: TYPE.sans, wordBreak: 'break-word' }}>{cat.label}</span>
                          {cat.confs.length > 0 && (
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: c.ink }}>
                              {cat.confs.map(cn => `Conf #: ${cn}`).join('   ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {bookedByLabel(h.bookedBy) && (
                    <div style={{ fontSize: 11, color: c.faint, fontFamily: TYPE.sans, marginTop: 4, fontStyle: 'italic' }}>{bookedByLabel(h.bookedBy)}</div>
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
            const cabin = f.cabinClass ?? null
            const aircraft = f.aircraftType ?? null
            const flightMeta = [route, cabin, aircraft].filter(Boolean).join('  \u00b7  ')
            const pax = (f.passengers ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)

            return (
              <div key={f.id} style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: c.faint, fontFamily: TYPE.sans }}>
                  {f.startDate ? formatDate(f.startDate) : ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans, wordBreak: 'break-word' }}>
                    {f.name ?? 'Flight'}
                  </div>
                  {flightMeta && (
                    <div style={{ fontSize: 11, color: c.muted, fontFamily: TYPE.sans, marginTop: 2, wordBreak: 'break-word' }}>
                      {flightMeta}
                    </div>
                  )}

                  {pax.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {pax.map(p => {
                        const detail = [
                          p.confirmationNumber ? `Conf ${p.confirmationNumber}` : null,
                          p.seatNumbers ? `Seats ${p.seatNumbers}` : null,
                        ].filter(Boolean).join('  \u00b7  ')
                        return (
                          <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans }}>
                              {passengerName(p)}
                            </div>
                            {detail && (
                              <div style={{ fontSize: 11, color: c.muted, fontFamily: 'DM Mono, monospace' }}>
                                {detail}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {bookedByLabel(f.bookedBy) && (
                    <div style={{ fontSize: 11, color: c.faint, fontFamily: TYPE.sans, marginTop: 4, fontStyle: 'italic' }}>
                      {bookedByLabel(f.bookedBy)}
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
            const veh = (t.driverDetails ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
            return (
              <div key={t.id} style={{ display: 'flex', gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                <div style={{ width: 'clamp(80px,30%,140px)', flexShrink: 0, fontSize: 11, color: c.faint, fontFamily: TYPE.sans }}>
                  {t.startDate ? formatDate(t.startDate) : ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans, wordBreak: 'break-word' }}>
                    {t.name ?? 'Transfer'}
                  </div>
                  {route && <div style={{ fontSize: 11, color: c.muted, fontFamily: TYPE.sans, marginTop: 2, wordBreak: 'break-word' }}>{route}</div>}

                  {veh.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {veh.map(v => (
                        <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: c.ink, fontFamily: TYPE.sans }}>{v.driverName || 'Driver'}</span>
                          {v.vehicleRole && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.gold, fontFamily: TYPE.sans }}>{v.vehicleRole}</span>}
                          {[v.driverPhone, v.carModel, v.plate].filter(Boolean).length > 0 && (
                            <span style={{ fontSize: 11, color: c.muted, fontFamily: 'DM Mono, monospace' }}>
                              {[v.driverPhone, v.carModel, v.plate].filter(Boolean).join('  \u00b7  ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {bookedByLabel(t.bookedBy) && (
                    <div style={{ fontSize: 11, color: c.faint, fontFamily: TYPE.sans, marginTop: 4, fontStyle: 'italic' }}>
                      {bookedByLabel(t.bookedBy)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </BriefSection>
      )}

      {(() => {
        const greeters = elements.filter(a => isMeetGreetElement(a.elementType) && a.briefShow !== false)
        return greeters.length > 0 ? (
          <BriefSection title='Airport Meet & Greet'>
            {greeters.map(g => (
              <BriefRow
                key={g.id}
                label={g.startDate ? formatDate(g.startDate) : ''}
                value={g.name ?? 'Airport Meet & Greet'}
                sub={[
                  g.startTime ? fmtTime(g.startTime) : null,
                  g.contactName ?? null,
                  g.contactPhone ?? null,
                  g.notes ?? null,
                ].filter(Boolean).join('  \u00b7  ')}
                bookedBy={bookedByLabel(g.bookedBy)}
              />
            ))}
          </BriefSection>
        ) : null
      })()}

      {(() => {
        const dining = elements.filter(a => isDiningElement(a.elementType) && a.briefShow !== false)
        return dining.length > 0 ? (
          <BriefSection title='Dining'>
            {dining.map(d => {
              const cancelled = d.diningStatus === 'cancelled' && d.showCancellation !== false
              return (
              <BriefRow
                key={d.id}
                label={d.startDate ? formatDate(d.startDate) : ''}
                value={d.name ?? 'Dining'}
                sub={[
                  d.startTime ? fmtTime(d.startTime) : null,
                  d.guestName ?? null,
                  d.guestCount ? `${d.guestCount} guests` : null,
                  d.confirmationNumber ? `Ref: ${d.confirmationNumber}` : null,
                ].filter(Boolean).join('  \u00b7  ')}
                bookedBy={bookedByLabel(d.bookedBy)}
                cancelled={cancelled}
                cancellationNote={d.cancellationPenaltyApplied ? d.cancellationNote : null}
              />
              )
            })}
          </BriefSection>
        ) : null
      })()}

      {experiences.length > 0 && (
        <BriefSection title='Experiences'>
          {experiences.map(x => (
              formatDate(x.entryDate)
            ))}
        </BriefSection>
      )}
      {clientData.brief?.importantNotes && (clientData.brief.importantNotes as string[]).length > 0 && (
        <BriefSection title='Important Notes'>
          {(clientData.brief.importantNotes as string[]).map((note, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, fontFamily: TYPE.sans, color: c.muted, lineHeight: 1.6, paddingTop: 6, paddingBottom: 6 }}>
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
              const content = link.travelEngagementLinkContent ?? null
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
                      border:         link.isHighlighted ? `1.5px solid ${c.gold}` : `1px solid ${c.lineStrong}`,
                      borderBottom:   content ? 'none' : link.isHighlighted ? `1.5px solid ${c.gold}` : `1px solid ${c.lineStrong}`,
                      background:     link.isHighlighted ? `${c.gold}08` : '#fff',
                      cursor:         'pointer',
                      transition:     'border-color 150ms',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {link.linkType === 'guide' ? (
                          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ flexShrink: 0 }}>
                            <rect x='3' y='1' width='9' height='12' rx='1' stroke={c.gold} strokeWidth='1.2'/>
                            <line x1='3' y1='13' x2='12' y2='13' stroke={c.gold} strokeWidth='1.2'/>
                            <line x1='5' y1='4' x2='10' y2='4' stroke={c.gold} strokeWidth='1' strokeLinecap='round'/>
                            <line x1='5' y1='6.5' x2='10' y2='6.5' stroke={c.gold} strokeWidth='1' strokeLinecap='round'/>
                            <line x1='5' y1='9' x2='8' y2='9' stroke={c.gold} strokeWidth='1' strokeLinecap='round'/>
                            <rect x='1' y='2' width='2' height='11' rx='0.5' fill={c.gold} opacity='0.3'/>
                          </svg>
                        ) : (
                          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ flexShrink: 0, opacity: 0.45 }}>
                            <path d='M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9' stroke={c.ink} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                            <path d='M9 1h6m0 0v6m0-6L8 8' stroke={c.ink} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                          </svg>
)}
                        <div style={{ fontSize: 13, fontFamily: TYPE.serif, color: c.ink, lineHeight: 1.3 }}>
                          {link.label}
                        </div>
                      </div>
                      <svg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ flexShrink: 0, opacity: 0.4 }}>
                        <path d='M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8' stroke={c.ink} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                        <path d='M9 1h4m0 0v4m0-4L7 7' stroke={c.ink} strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/>
                      </svg>
                    </div>
                  </a>
                  {content && (
                    <div style={{
                      padding:      '14px 18px',
                      borderRadius: '0 0 10px 10px',
                      border:       `1px solid ${c.lineStrong}`,
                      borderTop:    'none',
                      background:   c.surfaceSunken,
                    }}>
                      {content.kicker && (
                        <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.gold, marginBottom: 6 }}>
                          {content.kicker}
                        </div>
                      )}
                      {content.imageSrc && (
                        <img
                          src={content.imageSrc ?? undefined}
                          alt={content.imageAlt ?? ''}
                          style={{ width: '100%', borderRadius: 6, marginBottom: 10, objectFit: 'cover', maxHeight: 180 }}
                        />
                      )}
                      <div style={{ fontSize: 12, fontFamily: TYPE.sans, color: c.muted, lineHeight: 1.7 }}>
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
// S54 - renders advisor + selected house people (clientData.contacts), resolved
// server-side from brief.contact_person_ids + contact_name_format. Falls back to
// house.displayName when no people are selected.

export function ContactsTab({ clientData }: { clientData: DeliveryData }){
  const { brief, house, contacts, supplierContacts } = clientData

  function ContactCard({ name, role, email, phone, whatsapp }: { name: string; role: string; email?: string | null; phone?: string | null; whatsapp?: string | null }) {
    return (
      <div style={{ padding: '20px 24px', borderRadius: 12, border: `0.5px solid ${c.lineStrong}`, background: '#fff', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.faint, marginBottom: 8, fontFamily: TYPE.sans }}>{role}</div>
        <div style={{ fontSize: 18, fontFamily: TYPE.serif, color: c.ink, marginBottom: 8 }}>{name}</div>
        {phone && <a href={toTelHref(phone) ?? '#'} target='_blank' rel='noopener noreferrer' style={{ display: 'block', fontSize: 13, color: c.gold, textDecoration: 'none', fontFamily: TYPE.sans, marginBottom: 3 }}>{phone}</a>}
        {whatsapp && toWhatsAppHref(whatsapp) && <a href={toWhatsAppHref(whatsapp)!} target='_blank' rel='noopener noreferrer' style={{ display: 'block', fontSize: 12, color: c.muted, textDecoration: 'none', fontFamily: TYPE.sans, marginBottom: 3 }}>WhatsApp {whatsapp}</a>}
        {email && <a href={`mailto:${email}`} target='_blank' rel='noopener noreferrer' style={{ display: 'block', fontSize: 12, color: c.muted, textDecoration: 'none', fontFamily: TYPE.sans, wordBreak: 'break-all' }}>{email}</a>}
      </div>
    )
  }

  const roleLabel = (role: string | null): string => (role === 'staff' ? 'Staff' : 'Guest')

  const all      = contacts ?? []
  const guests   = all.filter(c => c.role !== 'staff')
  const staff    = all.filter(c => c.role === 'staff')

  function ContactBlock({ label, people }: { label: string; people: EngagementContact[] }) {
    if (people.length === 0) return null
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.faint, marginBottom: 12 }}>
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
      {brief?.advisorName && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.faint, marginBottom: 12 }}>
            Travel Advisor
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            <ContactCard
              name={brief.advisorName}
              role='Travel Advisor'
              email={(brief as any).showAdvisorEmail ? brief.advisorEmail : null}
              phone={(brief as any).showAdvisorPhone ? (brief as any).advisorPhone : null}
            />
          </div>
        </div>
      )}

      {/* Supplier contacts (hotel concierge, DMC, etc.) - above guests */}
      {(supplierContacts ?? []).length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.faint, marginBottom: 12 }}>
            {supplierContacts.length === 1 ? 'On-Site Contact' : 'On-Site Contacts'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {supplierContacts.map(sc => (
              <ContactCard key={sc.id} name={sc.name} role={sc.role ?? 'Contact'} email={sc.email} phone={sc.phone} whatsapp={sc.whatsapp} />
            ))}
          </div>
        </div>
      )}
      {/* Guests */}
      <ContactBlock label={guests.length === 1 ? 'Guest' : 'Guests'} people={guests} />

      {/* Staff (only if any selected) */}
      <ContactBlock label={staff.length === 1 ? 'Staff' : 'Staff'} people={staff} />
      
      {brief?.hotelContactNote && (
        <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 10, background: `${c.gold}08`, border: `1px solid ${c.gold}25` }}>
          <div style={{ fontSize: 9, fontFamily: TYPE.sans, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.gold, marginBottom: 8 }}>Hotel Contact Note</div>
          <div style={{ fontSize: 13, fontFamily: TYPE.sans, color: c.muted, lineHeight: 1.7 }}>{brief.hotelContactNote}</div>
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
      <div style={{ height: 1, background: c.lineStrong, marginBottom: 18 }} />
      <div style={{ fontSize: 10, fontFamily: TYPE.sans, fontWeight: 700, color: c.gold, letterSpacing: '0.14em', marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}
