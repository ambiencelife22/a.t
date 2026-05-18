/* TripDossierSection.tsx
 * Trip Dossier surface for HouseTab.
 *
 * Displays all trips linked to a household via travel_immerse_engagements,
 * with expandable booking cards showing rates, payment status, partner splits,
 * cancellation policy, and Download Dossier button per booking.
 *
 * Trip-level action panel (TripActionPanel) sits above booking cards in each
 * expanded TripBlock. Houses all trip-level actions for the travel designer:
 *   - Edit Brief (inline form for travel_trip_briefs overlay)
 *   - Download Confirmation Brief (exportConfirmationBriefPdf)
 *   - Download Dossier is per-booking (BookingCard level)
 *
 * Data comes from adminTripQueries.fetchTripDossierForHouse — pre-fetched
 * in HouseDetail.loadAll and passed in as TripDossierData.
 *
 * Last updated: S45 — TripActionPanel added; confirmationBriefPdf wired;
 *   TripBrief edit form (inline); brief overlay fields on BookingCard.
 * Prior: S45 — Download Dossier button wired per BookingCard.
 * Prior: S44 — initial ship.
 */

import { useState } from 'react'
import { A } from '../../lib/adminTokens'
import { AdminEmptyState } from './_adminPrimitives'
import type {
  TripDossierData, DossierTrip, TripBooking, TripPartner,
  HouseProfile, TripBrief, TripBriefPatch, JourneyStep,
} from '../../lib/adminTripQueries'
import { upsertTripBrief, updateBookingBriefFields } from '../../lib/adminTripQueries'
import { useDossierDownload } from '../../lib/useDossierDownload'
import { useBriefDownload } from '../../lib/useBriefDownload'
import type { ClientDossierData } from '../../lib/clientDossierPdf'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function buildDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  if (!end) return fmtDate(start)
  const s = new Date(start.slice(0, 10) + 'T00:00:00')
  const e = new Date(end.slice(0, 10) + 'T00:00:00')
  const sm = s.toLocaleDateString('en-US', { month: 'long' })
  const em = e.toLocaleDateString('en-US', { month: 'long' })
  if (sm === em) return `${s.getDate()}\u2013${e.getDate()} ${em} ${e.getFullYear()}`
  return `${fmtDate(start)}\u2013${fmtDate(end)}`
}

// ── mapBookingToDossier ───────────────────────────────────────────────────────

function mapBookingToDossier(b: TripBooking, house: HouseProfile | null): ClientDossierData {
  const hotelName = b._hotel_name ?? b.supplier_name_override ?? b.name ?? 'Supplier'
  const checkIn   = b.start_date ? fmtDate(b.start_date) : '--'
  const checkOut  = b.end_date   ? fmtDate(b.end_date)   : '--'
  const duration  = b.nights     ? `${b.nights} night${b.nights !== 1 ? 's' : ''}` : '--'
  const dateRange = (() => {
    if (!b.start_date || !b.end_date) return checkIn
    const s = new Date(b.start_date.slice(0, 10) + 'T00:00:00')
    const e = new Date(b.end_date.slice(0, 10) + 'T00:00:00')
    return `${s.getDate()}-${e.getDate()} ${e.toLocaleDateString('en-US', { month: 'long' })} ${e.getFullYear()}`
  })()
  const salutation = house?.salutation_rule ?? null
  return {
    guestDisplayName:   house?.display_name ?? '',
    guestDescription:   salutation ? 'This VVIP guest will require attentive service and discreet security awareness.' : '',
    partyIntro:         b.party_composition ? `${salutation ? 'They are' : 'The guest is'} arriving with ${b.party_composition}.` : '',
    arrivalNote:        undefined,
    hotelName,
    destination:        '',
    dateRange,
    roomName:           b.name ?? hotelName,
    checkIn, checkOut, duration,
    rateType:           b.rate_type            ?? '--',
    inclusions:         b.inclusions           ?? undefined,
    confirmationNumber: b.confirmation_number  ?? undefined,
    primaryContactName: b.primary_contact_name ?? undefined,
    primaryContactRole: b.primary_contact_role ?? undefined,
    specialRequests:    [],
    roomArrangements:   [],
  }
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily:    A.font,
  fontSize:      11,
  color:         A.text,
  background:    A.bg,
  border:        `1px solid ${A.border}`,
  borderRadius:  6,
  padding:       '5px 8px',
  width:         '100%',
  boxSizing:     'border-box' as const,
  outline:       'none',
}

const labelStyle: React.CSSProperties = {
  fontSize:      9,
  fontWeight:    700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color:         A.faint,
  fontFamily:    A.font,
  marginBottom:  3,
  display:       'block',
}

// ── TripActionPanel ───────────────────────────────────────────────────────────

function TripActionPanel({ trip, house, onBriefSaved }: {
  trip:         DossierTrip
  house:        HouseProfile | null
  onBriefSaved: (brief: TripBrief) => void
}) {
  const [editOpen, setEditOpen]     = useState(false)
  const [saving,   setSaving]       = useState(false)
  const [saveErr,  setSaveErr]      = useState<string | null>(null)

  const { pdfReady, pdfDownloading, handleDownloadBrief } = useBriefDownload()

  // Brief form state — initialised from existing brief or blank
  const br = trip.brief
  const [briefTitle,      setBriefTitle]      = useState(br?.brief_title      ?? '')
  const [briefSubtitle,   setBriefSubtitle]   = useState(br?.brief_subtitle   ?? '')
  const [preparedFor,     setPreparedFor]     = useState(br?.prepared_for     ?? house?.display_name ?? '')
  const [snapDest,        setSnapDest]        = useState(br?.snapshot_destination ?? '')
  const [snapDates,       setSnapDates]       = useState(br?.snapshot_dates   ?? buildDateRange(trip.start_date, trip.end_date))
  const [snapGuests,      setSnapGuests]      = useState(br?.snapshot_guests  ?? '')
  const [snapStatus,      setSnapStatus]      = useState(br?.snapshot_status  ?? 'Confirmed')
  const [advisorName,     setAdvisorName]     = useState(br?.advisor_name     ?? '')
  const [advisorEmail,    setAdvisorEmail]    = useState(br?.advisor_email    ?? '')
  const [advisorPhone,    setAdvisorPhone]    = useState(br?.advisor_phone    ?? '')
  const [hotelNote,       setHotelNote]       = useState(br?.hotel_contact_note ?? 'Shared closer to arrival')
  const [footerTagline,   setFooterTagline]   = useState(br?.footer_tagline   ?? '')
  const [notesRaw,        setNotesRaw]        = useState((br?.important_notes ?? []).join('\n'))
  const [stepsRaw,        setStepsRaw]        = useState(
    (br?.journey_steps ?? []).map(s => `${s.icon}|${s.label}|${s.detail}`).join('\n')
  )

  async function handleSave() {
    if (!house) return
    setSaving(true); setSaveErr(null)
    try {
      const notes: string[]      = notesRaw.split('\n').map(s => s.trim()).filter(Boolean)
      const steps: JourneyStep[] = stepsRaw.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
        const [icon, label, ...rest] = line.split('|')
        return { icon: icon?.trim() ?? 'anchor', label: label?.trim() ?? '', detail: rest.join('|').trim() }
      })
      const patch: TripBriefPatch = {
        brief_title:          briefTitle      || null,
        brief_subtitle:       briefSubtitle   || null,
        prepared_for:         preparedFor     || null,
        snapshot_destination: snapDest        || null,
        snapshot_dates:       snapDates       || null,
        snapshot_guests:      snapGuests      || null,
        snapshot_status:      snapStatus      || null,
        advisor_name:         advisorName     || null,
        advisor_email:        advisorEmail    || null,
        advisor_phone:        advisorPhone    || null,
        hotel_contact_note:   hotelNote       || null,
        footer_tagline:       footerTagline   || null,
        important_notes:      notes,
        journey_steps:        steps,
      }
      const saved = await upsertTripBrief(trip.id, house.id, patch)
      onBriefSaved(saved)
      setEditOpen(false)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const btnBase: React.CSSProperties = {
    fontFamily:    A.font,
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderRadius:  6,
    padding:       '5px 12px',
    cursor:        'pointer',
    transition:    'all 150ms ease',
    border:        'none',
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: editOpen ? 12 : 0 }}>
        <button
          onClick={() => setEditOpen(o => !o)}
          style={{ ...btnBase, background: editOpen ? A.gold + '20' : A.bgCard, color: A.gold, border: `1px solid ${A.gold}40` }}
        >
          {editOpen ? 'Close Brief Editor' : (br ? 'Edit Brief' : 'Create Brief')}
        </button>
        <button
          onClick={() => handleDownloadBrief({ trip, brief: trip.brief, house, destinationName: trip.destinations?.[0] ?? trip.trip_code, heroImageData: null })}
          disabled={!pdfReady || pdfDownloading}
          style={{ ...btnBase, background: 'transparent', color: pdfReady && !pdfDownloading ? A.gold : A.faint, border: `1px solid ${pdfReady && !pdfDownloading ? A.gold + '50' : A.border}`, cursor: pdfReady && !pdfDownloading ? 'pointer' : 'not-allowed' }}
        >
          {pdfDownloading ? 'Generating...' : 'Download Confirmation Brief'}
        </button>
      </div>

      {/* Inline brief editor */}
      {editOpen && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Cover */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Cover</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Trip Title</label>
                <input style={inputStyle} value={briefTitle} onChange={e => setBriefTitle(e.target.value)} placeholder={trip.destinations?.join(' & ') ?? trip.trip_code} />
              </div>
              <div>
                <label style={labelStyle}>Subtitle</label>
                <input style={inputStyle} value={briefSubtitle} onChange={e => setBriefSubtitle(e.target.value)} placeholder='Trip Confirmation Brief' />
              </div>
              <div>
                <label style={labelStyle}>Prepared For</label>
                <input style={inputStyle} value={preparedFor} onChange={e => setPreparedFor(e.target.value)} placeholder={house?.display_name ?? ''} />
              </div>
            </div>
          </div>

          {/* Snapshot */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Snapshot Pills</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Destination</label><input style={inputStyle} value={snapDest} onChange={e => setSnapDest(e.target.value)} placeholder={trip.destinations?.[0] ?? ''} /></div>
              <div><label style={labelStyle}>Dates</label><input style={inputStyle} value={snapDates} onChange={e => setSnapDates(e.target.value)} /></div>
              <div><label style={labelStyle}>Guests</label><input style={inputStyle} value={snapGuests} onChange={e => setSnapGuests(e.target.value)} placeholder={`${trip.guest_count_adults ?? 0} Adults`} /></div>
              <div><label style={labelStyle}>Status</label><input style={inputStyle} value={snapStatus} onChange={e => setSnapStatus(e.target.value)} /></div>
            </div>
          </div>

          {/* Journey steps */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Journey Steps</div>
            <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginBottom: 6 }}>
              One per line: <span style={{ color: A.gold, fontFamily: 'DM Mono, monospace' }}>icon|LABEL|detail</span>
              {' '}· Icons: flight, car, bed, dining, anchor, yacht, experience, departure, transfer, wellness
            </div>
            <textarea
              style={{ ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 10 }}
              value={stepsRaw}
              onChange={e => setStepsRaw(e.target.value)}
              placeholder={'flight|ARRIVAL|in Nice\ncar|TRANSFER|to St. Tropez\nbed|7 NIGHTS|Cheval Blanc'}
            />
          </div>

          {/* Contacts */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Contacts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Advisor Name</label><input style={inputStyle} value={advisorName} onChange={e => setAdvisorName(e.target.value)} /></div>
              <div><label style={labelStyle}>Advisor Email</label><input style={inputStyle} value={advisorEmail} onChange={e => setAdvisorEmail(e.target.value)} /></div>
              <div><label style={labelStyle}>Advisor Phone</label><input style={inputStyle} value={advisorPhone} onChange={e => setAdvisorPhone(e.target.value)} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Hotel Contact Note</label><input style={inputStyle} value={hotelNote} onChange={e => setHotelNote(e.target.value)} /></div>
            </div>
          </div>

          {/* Important notes */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Important Notes</div>
            <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginBottom: 6 }}>One note per line</div>
            <textarea
              style={{ ...inputStyle, height: 70, resize: 'vertical' }}
              value={notesRaw}
              onChange={e => setNotesRaw(e.target.value)}
              placeholder={'Final timings subject to reconfirmation.\nRestaurant reservations may carry cancellation policies.'}
            />
          </div>

          {/* Footer */}
          <div>
            <label style={labelStyle}>Footer Tagline (leave blank for default)</label>
            <input style={inputStyle} value={footerTagline} onChange={e => setFooterTagline(e.target.value)} placeholder='PRIVATE TRAVEL DESIGN  ·  TAILORED SUPPORT  ·  SEAMLESS EXECUTION' />
          </div>

          {saveErr && <div style={{ fontSize: 11, color: '#f87171', fontFamily: A.font }}>{saveErr}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditOpen(false)} style={{ ...btnBase, background: 'transparent', color: A.faint, border: `1px solid ${A.border}` }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnBase, background: A.gold, color: '#0F1110', border: 'none', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Brief'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small atoms ───────────────────────────────────────────────────────────────

function PaymentBadge({ paid, amount, dueDate, currency }: { paid: boolean; amount: number | null; dueDate: string | null; currency: string | null }) {
  if (amount == null) return null
  const color = paid ? '#4ade80' : '#fbbf24'
  const label = paid ? 'Paid' : `Due ${fmtDate(dueDate)}`
  return (
    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: A.font, color, padding: '2px 7px', borderRadius: 12, background: color + '15', border: `1px solid ${color}30`, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </span>
  )
}

function BookingStatusPip({ status }: { status: string | null }) {
  const map: Record<string, string> = { Confirmed: '#4ade80', Quoted: '#fbbf24', Pending: '#93c5fd', Cancelled: '#f87171', Completed: '#86efac' }
  const color = map[status ?? ''] ?? A.faint
  return (
    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: A.font, letterSpacing: '0.06em', color, padding: '2px 8px', borderRadius: 12, background: color + '12', border: `1px solid ${color}30` }}>
      {status ?? 'Unknown'}
    </span>
  )
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{value}</div>
    </div>
  )
}

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking: b, partners, mobile, house }: {
  booking:  TripBooking
  partners: Record<string, TripPartner>
  mobile:   boolean
  house:    HouseProfile | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [briefCat,  setBriefCat]  = useState(b.brief_category ?? '')
  const [bookedBy,  setBookedBy]  = useState(b.booked_by ?? 'ambience')
  const [briefShow, setBriefShow] = useState(b.brief_show ?? true)
  const [saving,    setSaving]    = useState(false)

  const { pdfReady, pdfDownloading, handleDownloadDossier } = useDossierDownload()

  const iataPartner  = b.iata_partner_id     ? partners[b.iata_partner_id]     : null
  const refPartner   = b.referral_partner_id  ? partners[b.referral_partner_id] : null
  const indivPartner = b.individual_id        ? partners[b.individual_id]       : null
  const supplierName = b._hotel_name ?? b.supplier_name_override ?? null
  const currency     = b.currency ?? 'USD'
  const depositPaid  = !!b.deposit_paid_at
  const balancePaid  = !!b.balance_paid_at
  const commTotal    = b.commissionable_rate != null && b.nights != null ? b.commissionable_rate * b.nights : null
  const typeColor    = b.booking_type === 'Hotel' ? A.gold : b.booking_type === 'Flight' ? '#93c5fd' : A.border

  async function saveBriefFields() {
    setSaving(true)
    try { await updateBookingBriefFields(b.id, { brief_category: briefCat || null, booked_by: bookedBy, brief_show: briefShow }) }
    catch { /* silent — toast could be added */ }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderLeft: `3px solid ${typeColor}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* Summary row */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{b.name ?? supplierName ?? b.booking_type ?? 'Booking'}</span>
            {b.booking_type && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{b.booking_type}</span>}
            <BookingStatusPip status={b.status} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {supplierName && b.name !== supplierName && <span style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{supplierName}</span>}
            {b.start_date && (
              <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                {fmtDate(b.start_date)}{b.end_date ? ` \u2013 ${fmtDate(b.end_date)}` : ''}{b.nights ? ` \u00b7 ${b.nights}N` : ''}
              </span>
            )}
            {b.confirmation_number && <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{b.confirmation_number}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {b.commission_amount != null && <span style={{ fontSize: 12, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(b.commission_amount, currency)}</span>}
          <span style={{ fontSize: 10, color: A.faint, display: 'inline-block', transition: 'transform 150ms ease', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Rate grid */}
          {(b.commissionable_rate != null || b.total_rate != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
              {b.commissionable_rate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Comm. Rate{b.nights && b.nights > 1 ? '/N' : ''}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.commissionable_rate, currency)}</div>
                  {b.rate_type && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.rate_type}</div>}
                </div>
              )}
              {commTotal != null && b.nights != null && b.nights > 1 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Comm. Total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(commTotal, currency)}</div>
                </div>
              )}
              {b.total_rate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Total Rate/N</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.total_rate, currency)}</div>
                  {b.taxes_and_fees != null && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.taxes_and_fees}% taxes + fees</div>}
                </div>
              )}
              {b.commission_pct != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Commission</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(b.commission_amount, currency)}</div>
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.commission_pct}% gross</div>
                </div>
              )}
            </div>
          )}

          {/* Inclusions */}
          {b.inclusions && (
            <div style={{ padding: '8px 10px', background: `${A.gold}08`, border: `1px solid ${A.gold}20`, borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Inclusions</div>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>{b.inclusions}</div>
            </div>
          )}

          {/* Payment */}
          {(b.deposit_amount != null || b.balance_amount != null) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Payment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.deposit_amount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Deposit </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.deposit_amount, currency)}</span>
                      {depositPaid && b.deposit_paid_at && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}> · paid {fmtDate(b.deposit_paid_at)}</span>}
                    </div>
                    <PaymentBadge paid={depositPaid} amount={b.deposit_amount} dueDate={b.deposit_due_date} currency={currency} />
                  </div>
                )}
                {b.balance_amount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Balance </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.balance_amount, currency)}</span>
                    </div>
                    <PaymentBadge paid={balancePaid} amount={b.balance_amount} dueDate={b.balance_due_date} currency={currency} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Partner splits */}
          {(iataPartner || refPartner || indivPartner) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Commission Splits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {iataPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{iataPartner.name} <span style={{ fontSize: 10, color: A.faint }}>IATA</span></span>
                    <span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.iata_share_pct}% · {fmt(b.iata_share_amt, currency)}</span>
                  </div>
                )}
                {refPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{refPartner.name} <span style={{ fontSize: 10, color: A.faint }}>Referral</span></span>
                    <span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.referral_share_pct}% · {fmt(b.referral_share_amt, currency)}</span>
                  </div>
                )}
                {indivPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{indivPartner.name}</span>
                    <span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.individual_share_pct}% · {fmt(b.individual_share_amt, currency)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancellation + notes */}
          {(b.cancellation_policy || b.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {b.cancellation_policy && (
                <div style={{ padding: '7px 10px', background: '#f8717108', border: '1px solid #f8717118', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f87171', fontFamily: A.font, marginBottom: 3 }}>Cancellation</div>
                  <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{b.cancellation_policy}</div>
                </div>
              )}
              {b.notes && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{b.notes}</div>}
            </div>
          )}

          {/* Brief overlay fields */}
          <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Brief Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <input style={inputStyle} value={briefCat} onChange={e => setBriefCat(e.target.value)} placeholder='Accommodation, Dining, Experiences...' />
              </div>
              <div>
                <label style={labelStyle}>Booked By</label>
                <select style={{ ...inputStyle }} value={bookedBy} onChange={e => setBookedBy(e.target.value)}>
                  <option value='ambience'>Booked by ambience</option>
                  <option value='self'>Self-booked</option>
                  <option value='tbc'>TBC</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 1 }}>
                <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input type='checkbox' checked={briefShow} onChange={e => setBriefShow(e.target.checked)} />
                  Show in brief
                </label>
                <button onClick={saveBriefFields} disabled={saving} style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {/* Download Dossier */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 2 }}>
            <button
              onClick={e => { e.stopPropagation(); handleDownloadDossier(mapBookingToDossier(b, house)) }}
              disabled={!pdfReady || pdfDownloading}
              style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: pdfReady && !pdfDownloading ? A.gold : A.faint, background: 'transparent', border: `1px solid ${pdfReady && !pdfDownloading ? A.gold + '50' : A.border}`, borderRadius: 6, padding: '5px 12px', cursor: pdfReady && !pdfDownloading ? 'pointer' : 'not-allowed', transition: 'all 150ms ease' }}
            >
              {pdfDownloading ? 'Generating...' : 'Download Dossier'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TripBlock ─────────────────────────────────────────────────────────────────

function TripBlock({ trip, partners, mobile, expanded, onToggle, house, onBriefSaved }: {
  trip:         DossierTrip
  partners:     Record<string, TripPartner>
  mobile:       boolean
  expanded:     boolean
  onToggle:     () => void
  house:        HouseProfile | null
  onBriefSaved: (tripId: string, brief: TripBrief) => void
}) {
  const statusColor: Record<string, string> = { active: '#4ade80', completed: '#86efac', cancelled: '#f87171', draft: A.faint }
  const tripColor       = statusColor[trip.status ?? ''] ?? A.gold
  const totalCommission = trip.bookings.reduce((s, b) => s + (b.commission_amount ?? 0), 0)
  const totalGross      = trip.bookings.reduce((s, b) => s + (b.commissionable_rate ?? b.price ?? 0) * (b.nights ?? 1), 0)

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${expanded ? A.gold + '40' : A.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 150ms ease' }}>
      {/* Header */}
      <div onClick={onToggle} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>{trip.trip_code}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: tripColor, fontFamily: A.font, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{trip.status ?? 'Unknown'}</span>
          {trip.start_date && (
            <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {fmtDate(trip.start_date)}{trip.end_date ? ` \u2013 ${fmtDate(trip.end_date)}` : ''}{trip.duration_nights ? ` \u00b7 ${trip.duration_nights}N` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {totalCommission > 0 && <span style={{ fontSize: 12, color: A.gold, fontFamily: A.font, fontWeight: 600 }}>{fmt(totalCommission)} commission</span>}
          <span style={{ fontSize: 14, color: A.faint, display: 'inline-block', transition: 'transform 150ms ease', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '0 16px 16px' }}>

          {/* Meta strip */}
          <div style={{ display: 'flex', gap: 20, padding: '12px 0', flexWrap: 'wrap', borderBottom: `1px solid ${A.border}`, marginBottom: 14 }}>
            {trip.destinations && trip.destinations.length > 0 && <MetaCell label='Destinations' value={trip.destinations.join(', ')} />}
            {(trip.guest_count_adults || trip.guest_count_children) && (
              <MetaCell label='Guests' value={`${trip.guest_count_adults ?? 0} adult${(trip.guest_count_adults ?? 0) !== 1 ? 's' : ''}${trip.guest_count_children ? `, ${trip.guest_count_children} child${trip.guest_count_children !== 1 ? 'ren' : ''}` : ''}`} />
            )}
            {trip.trip_type && <MetaCell label='Type' value={<span style={{ textTransform: 'capitalize' }}>{trip.trip_type}</span>} />}
            {trip.brief && <MetaCell label='Brief' value={<span style={{ color: A.gold }}>Ready</span>} />}
            {totalCommission > 0 && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Total Commission</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(totalCommission)}</div>
                {totalGross > 0 && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>on {fmt(totalGross)} gross</div>}
              </div>
            )}
          </div>

          {/* Trip action panel */}
          <TripActionPanel trip={trip} house={house} onBriefSaved={br => onBriefSaved(trip.id, br)} />

          {/* Bookings */}
          {trip.bookings.length === 0 ? (
            <AdminEmptyState message='No bookings on this trip yet.' />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {trip.bookings.map(b => <BookingCard key={b.id} booking={b} partners={partners} mobile={mobile} house={house} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TripDossierSection — exported ─────────────────────────────────────────────

export function TripDossierSection({ dossier, mobile }: {
  dossier: TripDossierData
  mobile:  boolean
}) {
  const [expandedTrip, setExpandedTrip] = useState<string | null>(
    dossier.trips.length === 1 ? dossier.trips[0].id : null
  )
  const [trips, setTrips] = useState<DossierTrip[]>(dossier.trips)

  function handleBriefSaved(tripId: string, brief: TripBrief) {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, brief } : t))
  }

  if (trips.length === 0) return <AdminEmptyState message='No trips linked to this household yet.' />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {trips.map(trip => (
        <TripBlock
          key={trip.id}
          trip={trip}
          partners={dossier.partners}
          mobile={mobile}
          expanded={expandedTrip === trip.id}
          onToggle={() => setExpandedTrip(prev => prev === trip.id ? null : trip.id)}
          house={dossier.house}
          onBriefSaved={handleBriefSaved}
        />
      ))}
    </div>
  )
}