// TripConfirmationPage.tsx — Client-facing trip confirmation page.
//
// What it owns:
//   - Standalone confirmation layout: slim top bar (logo + PDF download),
//     cream document body — accommodation, flights, transfers, car services.
//   - Data fetch mode: when urlId provided, fetches via fetchTripClientData.
//   - Preview mode: when data provided directly (BriefEditorPage preview panel),
//     renders immediately with no fetch.
//   - PDF download: calls exportConfirmationBriefPdf with current data.
//
// Two render modes — same component, one source of truth:
//   1. Live route:   <TripConfirmationPage urlId='NfXkQ2mRp7B' />
//   2. Editor preview: <TripConfirmationPage data={previewData} />
//
// What it does not own:
//   - Route resolution (ImmerseEngagementRoute.tsx)
//   - Data fetching primitives (tripClientQueries.ts, adminTripQueries.ts)
//   - PDF generation (pdfImmerseConfirmation.ts)
//   - Programme page (TripProgrammePage.tsx)
//
// Last updated: S43 Add 2 — "Paid in Full" badge on accommodation cards.
//   Reads booking.balance_paid_at ?? booking.deposit_paid_at. Faint green
//   pill rendered below bookedByText when either field is non-null. Requires
//   EF to pass through payment fields (also updated this session).
// Prior: S50 — bookedByLabel() canonical helper imported from utilsBooking.

import { useEffect, useState } from 'react'
import { getAuxTypeMeta } from '../../types/typesAuxBookings'
import { fetchTripClientData, type TripClientData } from '../../queries/queriesImmerseTrip'
import type { TripAuxBooking } from '../../queries/queriesAdminTrip'
import { useImmerseConfirmationPdf } from '../../hooks/useImmerseConfirmationPdf'
import { bookedByLabel } from '../../utils/utilsBooking'

// ── Theme ─────────────────────────────────────────────────────────────────────

const CREAM   = '#F7F5F0'
const INK     = '#1A1D1A'
const GOLD    = '#C9A84C'
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const CARD_BG = '#F0EDE6'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
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
  return `${fmtDate(start)}\u2013${fmtDate(end)}`
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props =
  | { urlId: string;  data?: never }
  | { data: TripClientData; urlId?: never }

// ── Top bar ───────────────────────────────────────────────────────────────────

function ConfirmationTopBar({ clientData, programmeUrl }: {
  clientData: TripClientData | null
  programmeUrl: string | null
}) {
  const { pdfReady, pdfDownloading, handleDownloadBrief } = useImmerseConfirmationPdf()

  async function handlePdf() {
    if (!clientData) return
    const { trip, brief, house, destinationName, auxBookings } = clientData

    let heroData: string | null = null
    const heroSrc = brief?.hero_image_src
    if (heroSrc) {
      try {
        const res  = await fetch(heroSrc)
        const blob = await res.blob()
        heroData = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { heroData = null }
    }

    handleDownloadBrief({ trip, brief, house, destinationName, heroImageData: heroData, auxBookings })
  }

  return (
    <div style={{
      position:       'sticky',
      top:            0,
      zIndex:         50,
      height:         56,
      background:     'rgba(250,247,242,0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom:   `1px solid ${RULE}`,
      display:        'flex',
      alignItems:     'center',
      padding:        '0 clamp(16px,5vw,48px)',
      gap:            12,
    }}>
      <a href='https://ambience.travel' style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
        <img src='/emblem.png' alt='' style={{ width: 24, height: 24, borderRadius: '50%' }} />
        <img src='/ambience_travel.svg' alt='ambience travel' style={{ height: 32, objectFit: 'contain' }} />
      </a>

      <div style={{ flex: 1 }} />

      {programmeUrl && (
        <a
          href={programmeUrl}
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 11, fontWeight: 600, color: MUTED,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            textDecoration: 'none', padding: '5px 10px',
            border: `1px solid ${RULE}`, borderRadius: 6,
            transition: 'color 150ms, border-color 150ms',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = GOLD
            ;(e.currentTarget as HTMLAnchorElement).style.borderColor = GOLD
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = MUTED
            ;(e.currentTarget as HTMLAnchorElement).style.borderColor = RULE
          }}
        >
          Daily Programme \u2192
        </a>
      )}

      <button
        onClick={handlePdf}
        disabled={!pdfReady || pdfDownloading || !clientData}
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', border: 'none', borderRadius: 6,
          padding: '5px 14px', cursor: pdfReady && clientData ? 'pointer' : 'not-allowed',
          background: GOLD, color: INK,
          opacity: pdfReady && !pdfDownloading && clientData ? 1 : 0.45,
          transition: 'opacity 150ms',
        }}
      >
        {pdfDownloading ? 'Generating\u2026' : 'Download PDF'}
      </button>
    </div>
  )
}

// ── Document body ─────────────────────────────────────────────────────────────

export function TripConfirmationDocument({ clientData }: { clientData: TripClientData }) {
  const { trip, brief, house, auxBookings } = clientData

  const logoVariant = brief?.logo_variant ?? 'ambience'
  const title       = brief?.brief_title ?? clientData.destinationName
  const subtitle    = (brief?.brief_subtitle ?? 'TRIP CONFIRMATION BRIEF').toUpperCase()
  const pfor        = brief?.prepared_for ?? house?.display_name ?? ''
  const heroSrc     = brief?.hero_image_src ?? ''
  const dates       = buildDateRange(trip.start_date, trip.end_date)

  const accomBookings = trip.bookings
    .filter(bk => bk.brief_show !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const sortedAux = [...auxBookings]
    .filter(a => a.brief_show !== false)
    .sort((a, b) => {
      const ma = getAuxTypeMeta(a.booking_type)
      const mb = getAuxTypeMeta(b.booking_type)
      if (ma.sort_order !== mb.sort_order) return ma.sort_order - mb.sort_order
      return a.sort_order - b.sort_order
    })

  const auxSections: { type: string; label: string; icon: string; items: TripAuxBooking[] }[] = []
  for (const aux of sortedAux) {
    const type = aux.booking_type ?? 'Other'
    const meta = getAuxTypeMeta(type)
    const last = auxSections[auxSections.length - 1]
    if (last && last.type === type) {
      last.items.push(aux)
      continue
    }
    auxSections.push({ type, label: meta.label, icon: meta.icon, items: [aux] })
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: INK, background: CREAM, minHeight: '100vh', paddingBottom: 80 }}>

      {/* Hero */}
      <div style={{ position: 'relative', height: 'clamp(220px, 38vw, 360px)', background: CARD_BG, overflow: 'hidden' }}>
        {heroSrc && <img src={heroSrc} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {logoVariant !== 'unbranded' && (
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(8px)',
            borderRadius: 10, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            border: '0.5px solid rgba(200,195,185,0.6)',
          }}>
            {logoVariant !== 'alfaone' && (
              <img src='/emblem.png' alt='' style={{ width: 36, height: 36, objectFit: 'contain' }} />
            )}
            {logoVariant === 'alfaone'
              ? <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#B49050', letterSpacing: '0.02em' }}>AlfaOne Concierge</span>
              : <img src='/ambience_travel.svg' alt='ambience' style={{ height: 40, objectFit: 'contain' }} />
            }
          </div>
        )}
      </div>

      {/* Cover text */}
      <div style={{ padding: 'clamp(24px,5vw,48px) clamp(20px,8vw,120px) 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 400, color: INK, lineHeight: 1.15, margin: '0 0 16px' }}>
          {title}
        </h1>
        <div style={{ height: 1, background: GOLD, margin: '0 auto 12px', maxWidth: 480 }} />
        <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: GOLD, letterSpacing: '0.14em', marginBottom: 8 }}>
          {subtitle}
        </div>
        {pfor && (
          <div style={{ fontSize: 15, fontStyle: 'italic', color: MUTED, marginBottom: 6 }}>
            Prepared for {pfor}
          </div>
        )}
        {dates && (
          <div style={{ fontSize: 13, color: FAINT, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {dates}
          </div>
        )}
      </div>

      {/* Accommodation — one block per hotel, rooms nested beneath */}
      {accomBookings.length > 0 && (
        <Section label='ACCOMMODATION'>
          {accomBookings.map(booking => {
            const isAmbience   = (booking.booked_by ?? 'ambience') === 'ambience'
            const bookedByText = bookedByLabel(booking.booked_by)
            const pillColor    = isAmbience ? GOLD : FAINT
            const hotelName    = booking._hotel_name ?? booking.name ?? 'Hotel'
            const dateRange    = buildDateRange(booking.start_date, booking.end_date)
            const headerImg    = booking.brief_image_src ?? booking._hotel_image_src ?? null
            const rooms        = booking._rooms ?? []
            const paidInFull   = !!(booking.balance_paid_at ?? booking.deposit_paid_at)

            return (
              <div key={booking.id} style={{
                background: '#fff', border: `0.5px solid ${RULE}`,
                borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                {/* Hotel header */}
                <div style={{ display: 'flex', minHeight: 100 }}>
                  <div style={{ width: 'clamp(120px,35%,220px)', flexShrink: 0, background: CARD_BG, position: 'relative', overflow: 'hidden' }}>
                    {headerImg && <img src={headerImg} alt={hotelName} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />}
                  </div>
                  <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 16, color: INK, marginBottom: 4, lineHeight: 1.3 }}>{hotelName}</div>
                      {dateRange && <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED }}>{dateRange}</div>}
                      {booking.party_composition && <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED, marginTop: 2 }}>{booking.party_composition}</div>}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {rooms.length === 0 && booking.confirmation_number && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center',
                          border: `1px solid ${pillColor}`, borderRadius: 5,
                          padding: '3px 10px', marginBottom: 6,
                          background: isAmbience ? '#FAF7F0' : '#F5F5F5',
                        }}>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: pillColor }}>
                            Conf #:  {booking.confirmation_number}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: 'italic', color: FAINT }}>
                        {bookedByText}
                      </div>
                      {paidInFull && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          marginTop: 6, padding: '3px 10px',
                          background: 'rgba(74,222,128,0.08)',
                          border: '1px solid rgba(74,222,128,0.25)',
                          borderRadius: 5,
                        }}>
                          <span style={{ fontSize: 10, color: '#4ade80', lineHeight: 1 }}>✓</span>
                          <span style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#4ade80', fontWeight: 600, letterSpacing: '0.06em' }}>
                            Paid in Full
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nested rooms */}
                {rooms.length > 0 && (
                  <div style={{ borderTop: `0.5px solid ${RULE}` }}>
                    {rooms.map((room, ri) => {
                      const guestParts: string[] = []
                      if (room.guest_name)                guestParts.push(room.guest_name)
                      if (room.additional_guests?.length) guestParts.push(...room.additional_guests)
                      if (room.party_composition)         guestParts.push(room.party_composition)
                      const guestLine = guestParts.join(' \u00b7 ')
                      return (
                        <div key={room.id ?? ri} style={{
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          gap: 16, padding: '12px 20px',
                          borderTop: ri > 0 ? `0.5px solid ${RULE}` : 'none',
                          flexWrap: 'wrap',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {room.room_name && <div style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: INK, lineHeight: 1.3 }}>{room.room_name}</div>}
                            {guestLine && <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED, marginTop: 2 }}>{guestLine}</div>}
                          </div>
                          {room.confirmation_number && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                              border: `1px solid ${pillColor}`, borderRadius: 5,
                              padding: '3px 10px',
                              background: isAmbience ? '#FAF7F0' : '#F5F5F5',
                            }}>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: pillColor }}>
                                Conf #:  {room.confirmation_number}
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
        </Section>
      )}

      {/* Aux sections */}
      {auxSections.map(section => (
        <Section key={section.type} label={section.label}>
          {section.items.map(aux => {
            const bookedByTxt = bookedByLabel(aux.booked_by)
            const isAmbience  = !aux.booked_by || aux.booked_by === 'ambience'
            const pillColor   = isAmbience ? GOLD : FAINT
            const dep         = fmtTime(aux.start_time)
            const arr         = fmtTime(aux.end_time)
            const timeStr     = dep && arr ? `${dep} \u2013 ${arr}` : dep || arr || ''
            const route       = [aux.origin, aux.destination].filter(Boolean).join(' \u2192 ')

            return (
              <div key={aux.id} style={{
                background: '#fff', border: `0.5px solid ${RULE}`,
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 22, color: GOLD, flexShrink: 0, lineHeight: 1, paddingTop: 2 }}>
                  {section.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {aux.name && <div style={{ fontSize: 16, color: INK, marginBottom: 4 }}>{aux.name}</div>}
                  {route && <div style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED }}>{route}</div>}
                  {aux.start_date && (
                    <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, marginTop: 2 }}>
                      {fmtDate(aux.start_date)}
                    </div>
                  )}
                  {[aux.cabin_class, aux.aircraft_type].filter(Boolean).length > 0 && (
                    <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED, marginTop: 4 }}>
                      {[aux.cabin_class, aux.aircraft_type].filter(Boolean).join(' \u00b7 ')}
                    </div>
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
                              <span style={{ fontSize: 12, fontWeight: 600, color: INK, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                {p.passenger_label ?? 'Guest'}
                              </span>
                              {detail && (
                                <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>
                                  {detail}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {timeStr && (
                    <div style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: INK }}>
                      {timeStr}
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: 'italic', color: FAINT, marginTop: 4 }}>
                    {bookedByTxt}
                  </div>
                </div>
              </div>
            )
          })}
        </Section>
      ))}

      {/* Footer */}
      <div style={{ padding: '40px clamp(20px,8vw,120px) 0', textAlign: 'center' }}>
        <div style={{ height: 1, background: RULE, marginBottom: 20 }} />
        <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, letterSpacing: '0.08em' }}>
          TAILORED TRAVEL DESIGN \u00b7 CONCIERGE SUPPORT \u00b7{' '}
          <a href='https://ambience.travel' style={{ color: FAINT, textDecoration: 'none' }}>ambience.travel</a>
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 'clamp(24px,4vw,40px) clamp(20px,8vw,120px) 0' }}>
      <div style={{ height: 1, background: RULE, marginBottom: 20 }} />
      <div style={{
        fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 700, color: GOLD, letterSpacing: '0.14em',
        marginBottom: 16,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

// ── Loading / error states ────────────────────────────────────────────────────

function ConfirmationLoading() {
  return (
    <div style={{
      minHeight: '100vh', background: CREAM,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
    }}>
      <img src='/emblem.png' alt='' style={{ width: 48, height: 48, opacity: 0.6 }} />
      <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Preparing Your Confirmation
      </div>
    </div>
  )
}

function ConfirmationNotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: CREAM,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '0 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, color: INK, fontFamily: 'Georgia, serif' }}>This confirmation is not available.</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: GOLD, fontFamily: "'Plus Jakarta Sans', sans-serif", textDecoration: 'none' }}>
        Return to ambience.travel \u2192
      </a>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TripConfirmationPage({ urlId, data }: Props) {
  const [clientData, setClientData] = useState<TripClientData | null>(data ?? null)
  const [notFound,   setNotFound]   = useState(false)

  useEffect(() => {
    if (data || !urlId) return
    fetchTripClientData(urlId)
      .then(d => { if (d) setClientData(d); else setNotFound(true) })
      .catch(() => setNotFound(true))
  }, [urlId, data])

  const programmeUrl = clientData
    ? (typeof window !== 'undefined' && window.location.hostname === 'immerse.ambience.travel'
        ? `/${clientData.urlId}/programme`
        : `/immerse/${clientData.urlId}/programme`)
    : null

  if (notFound) return <ConfirmationNotFound />
  if (!clientData) return <ConfirmationLoading />

  if (data) return <TripConfirmationDocument clientData={clientData} />

  return (
    <div style={{ minHeight: '100vh', background: CREAM }}>
      <ConfirmationTopBar clientData={clientData} programmeUrl={programmeUrl} />
      <TripConfirmationDocument clientData={clientData} />
    </div>
  )
}