/* TripDossierSection.tsx
 * Trip Dossier surface for HouseTab.
 *
 * Last updated: S48 — Copy Link buttons added to TripActionPanel for
 *   /confirmation and /programme client URLs. url_id now on DossierTrip.
 *   buildClientUrl + copyLink helpers. copied state with 2s feedback.
 * Prior: S48 — fetchTripAuxBookings imported. handleDownload fetches aux.
 * Prior: S47 — navigateAdmin imported from adminPath. TripActionPanel
 *   onBriefSaved prop removed. trips local state removed.
 * Prior: S46 — Edit Brief navigates to BriefEditorPage.
 * Prior: S45 — TripActionPanel; confirmationBriefPdf; RoomsEditor.
 * Prior: S44 — initial ship.
 */

import { useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { AdminEmptyState } from './_adminPrimitives'
import type {
  TripDossierData, DossierTrip, TripBooking, TripPartner,
  HouseProfile,
} from '../../lib/queriesAdminTrip'
import { updateBookingBriefFields, createBookingRoom, deleteBookingRoom, fetchTripAuxBookings } from '../../lib/queriesAdminTrip'
import type { BookingRoom } from '../../lib/queriesAdminTrip'
import { useDossierClientPdf } from '../../hooks/useDossierClientPdf'
import { useImmerseConfirmationPdf } from '../../hooks/useImmerseConfirmationPdf'
import type { ClientDossierData } from '../../pdf/pdfDossierClient'

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

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

// ── TripActionPanel ───────────────────────────────────────────────────────────

function TripActionPanel({ trip, house }: {
  trip:  DossierTrip
  house: HouseProfile | null
}) {
  const { pdfReady, pdfDownloading, handleDownloadBrief } = useImmerseConfirmationPdf()
  const [copied, setCopied] = useState<'confirmation' | 'programme' | null>(null)

  const btnBase: React.CSSProperties = {
    fontFamily: A.font, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', borderRadius: 6, padding: '5px 12px',
    cursor: 'pointer', transition: 'all 150ms ease', border: 'none',
  }

  function buildClientUrl(surface: 'confirmation' | 'programme'): string | null {
    if (!trip.url_id) return null
    return `https://immerse.ambience.travel/${trip.url_id}/${surface}`
  }

  async function copyLink(surface: 'confirmation' | 'programme') {
    const url = buildClientUrl(surface)
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(surface)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleDownload() {
    let heroData: string | null = null
    const heroSrc = trip.brief?.hero_image_src
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

    const auxBookings = await fetchTripAuxBookings(trip.id).catch(() => [])

    handleDownloadBrief({
      trip,
      brief:           trip.brief,
      house,
      destinationName: trip.destinations[0]?.name ?? trip.trip_code,
      heroImageData:   heroData,
      auxBookings,
    })
  }

  return (
    <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={() => navigateAdmin({ product: 'trips', tab: 'brief', tripId: trip.id })}
        style={{ ...btnBase, background: A.bgCard, color: A.gold, border: `1px solid ${A.gold}40` }}
      >
        {trip.brief ? 'Edit Brief' : 'Create Brief'}
      </button>
      <button
        onClick={handleDownload}
        disabled={!pdfReady || pdfDownloading}
        style={{
          ...btnBase, background: 'transparent',
          color:   pdfReady && !pdfDownloading ? A.gold  : A.faint,
          border:  `1px solid ${pdfReady && !pdfDownloading ? A.gold + '50' : A.border}`,
          cursor:  pdfReady && !pdfDownloading ? 'pointer' : 'not-allowed',
        }}
      >
        {pdfDownloading ? 'Generating...' : 'Download Confirmation Brief'}
      </button>
      <button
        onClick={() => navigateAdmin({ product: 'trips', tab: 'itinerary', tripId: trip.id })}
        style={{ ...btnBase, background: A.bgCard, color: A.muted, border: `1px solid ${A.border}` }}
      >
        Daily Programme
      </button>
      {trip.url_id && (
        <>
          <button
            onClick={() => copyLink('confirmation')}
            style={{ ...btnBase, background: 'transparent', color: copied === 'confirmation' ? '#4ade80' : A.faint, border: `1px solid ${copied === 'confirmation' ? '#4ade8050' : A.border}` }}
          >
            {copied === 'confirmation' ? 'Copied!' : 'Copy Confirmation Link'}
          </button>
          <button
            onClick={() => copyLink('programme')}
            style={{ ...btnBase, background: 'transparent', color: copied === 'programme' ? '#4ade80' : A.faint, border: `1px solid ${copied === 'programme' ? '#4ade8050' : A.border}` }}
          >
            {copied === 'programme' ? 'Copied!' : 'Copy Programme Link'}
          </button>
        </>
      )}
    </div>
  )
}

// ── Small atoms ───────────────────────────────────────────────────────────────

function PaymentBadge({ paid, amount, dueDate, currency }: {
  paid: boolean; amount: number | null; dueDate: string | null; currency: string | null
}) {
  if (amount == null) return null
  const color = paid ? '#4ade80' : '#fbbf24'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: A.font, color, padding: '2px 7px', borderRadius: 12, background: color + '15', border: `1px solid ${color}30`, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {paid ? 'Paid' : `Due ${fmtDate(dueDate)}`}
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

// ── RoomsEditor ───────────────────────────────────────────────────────────────

function RoomsEditor({ booking }: { booking: TripBooking }) {
  const [rooms,  setRooms]  = useState<BookingRoom[]>(booking._rooms)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [newRoomName,  setNewRoomName]  = useState('')
  const [newConfNum,   setNewConfNum]   = useState('')
  const [newGuestName, setNewGuestName] = useState('')
  const [newPartyComp, setNewPartyComp] = useState('')
  const [newNotes,     setNewNotes]     = useState('')

  async function handleAdd() {
    setSaving('add')
    try {
      const r = await createBookingRoom(booking.id, {
        room_name: newRoomName || null, confirmation_number: newConfNum || null,
        guest_name: newGuestName || null, party_composition: newPartyComp || null,
        notes: newNotes || null, sort_order: rooms.length,
      })
      setRooms(prev => [...prev, r])
      setAdding(false)
      setNewRoomName(''); setNewConfNum(''); setNewGuestName(''); setNewPartyComp(''); setNewNotes('')
    } catch { /* silent */ }
    finally { setSaving(null) }
  }

  async function handleDelete(roomId: string) {
    setSaving(roomId)
    try { await deleteBookingRoom(roomId); setRooms(prev => prev.filter(r => r.id !== roomId)) }
    catch { /* silent */ }
    finally { setSaving(null) }
  }

  return (
    <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>Rooms ({rooms.length})</div>
        <button onClick={() => setAdding(o => !o)} style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
          {adding ? 'Cancel' : '+ Add Room'}
        </button>
      </div>

      {rooms.map(r => (
        <div key={r.id} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {r.confirmation_number && <div style={{ fontSize: 11, fontWeight: 700, color: A.gold, fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>#{r.confirmation_number}</div>}
            {r.guest_name         && <div style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{r.guest_name}</div>}
            {r.party_composition  && <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{r.party_composition}</div>}
            {r.room_name          && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{r.room_name}</div>}
            {r.notes              && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{r.notes}</div>}
          </div>
          <button onClick={() => handleDelete(r.id)} disabled={saving === r.id} style={{ fontFamily: A.font, fontSize: 10, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>
            {saving === r.id ? '...' : '\u2715'}
          </button>
        </div>
      ))}

      {adding && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>Guest Name</label><input style={inputStyle} value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder='Princess Nouf' /></div>
            <div><label style={labelStyle}>Confirmation #</label><input style={inputStyle} value={newConfNum} onChange={e => setNewConfNum(e.target.value)} placeholder='4375602759' /></div>
            <div><label style={labelStyle}>Party Composition</label><input style={inputStyle} value={newPartyComp} onChange={e => setNewPartyComp(e.target.value)} placeholder='2 Adults, 2 Children' /></div>
            <div><label style={labelStyle}>Room Name</label><input style={inputStyle} value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder='Two-Bedroom Suite' /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><input style={inputStyle} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder='Includes rollaway bed' /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleAdd} disabled={saving === 'add'} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: '#0F1110', background: A.gold, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}>
              {saving === 'add' ? 'Adding...' : 'Add Room'}
            </button>
          </div>
        </div>
      )}
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
  const [expanded,  setExpanded]  = useState(false)
  const [briefCat,  setBriefCat]  = useState(b.brief_category ?? '')
  const [bookedBy,  setBookedBy]  = useState(b.booked_by ?? '')
  const [briefShow, setBriefShow] = useState(b.brief_show ?? true)
  const [saving,    setSaving]    = useState(false)

  const { pdfReady, pdfDownloading, handleDownloadDossier } = useDossierClientPdf()

  const iataPartner  = b.iata_partner_id    ? partners[b.iata_partner_id]    : null
  const refPartner   = b.referral_partner_id ? partners[b.referral_partner_id] : null
  const indivPartner = b.individual_id       ? partners[b.individual_id]       : null
  const supplierName = b._hotel_name ?? b.supplier_name_override ?? null
  const currency     = b.currency ?? 'USD'
  const depositPaid  = !!b.deposit_paid_at
  const balancePaid  = !!b.balance_paid_at
  const commTotal    = b.commissionable_rate != null && b.nights != null ? b.commissionable_rate * b.nights : null
  const typeColor    = b.booking_type === 'Hotel' ? A.gold : b.booking_type === 'Flight' ? '#93c5fd' : A.border

  async function saveBriefFields() {
    setSaving(true)
    try { await updateBookingBriefFields(b.id, { brief_category: briefCat || null, booked_by: bookedBy, brief_show: briefShow }) }
    catch { /* silent */ }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderLeft: `3px solid ${typeColor}`, borderRadius: 8, overflow: 'hidden' }}>
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
          <span style={{ fontSize: 10, color: A.faint, display: 'inline-block', transition: 'transform 150ms ease', transform: expanded ? 'rotate(90deg)' : 'none' }}>\u203a</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

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

          {b.inclusions && (
            <div style={{ padding: '8px 10px', background: `${A.gold}08`, border: `1px solid ${A.gold}20`, borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Inclusions</div>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>{b.inclusions}</div>
            </div>
          )}

          {(b.deposit_amount != null || b.balance_amount != null) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Payment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.deposit_amount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Deposit </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.deposit_amount, currency)}</span>
                      {depositPaid && b.deposit_paid_at && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}> \u00b7 paid {fmtDate(b.deposit_paid_at)}</span>}
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

          {(iataPartner || refPartner || indivPartner) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Commission Splits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {iataPartner   && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{iataPartner.name} <span style={{ fontSize: 10, color: A.faint }}>IATA</span></span><span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.iata_share_pct}% \u00b7 {fmt(b.iata_share_amt, currency)}</span></div>}
                {refPartner    && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{refPartner.name} <span style={{ fontSize: 10, color: A.faint }}>Referral</span></span><span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.referral_share_pct}% \u00b7 {fmt(b.referral_share_amt, currency)}</span></div>}
                {indivPartner  && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{indivPartner.name}</span><span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.individual_share_pct}% \u00b7 {fmt(b.individual_share_amt, currency)}</span></div>}
              </div>
            </div>
          )}

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

          <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Brief Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <input style={inputStyle} value={briefCat} onChange={e => setBriefCat(e.target.value)} placeholder='Accommodation, Dining...' />
              </div>
              <div>
                <label style={labelStyle}>Booked By</label>
                <input style={inputStyle} value={bookedBy} onChange={e => setBookedBy(e.target.value)} placeholder='Booked by Deron' />
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

          <RoomsEditor booking={b} />

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

function TripBlock({ trip, partners, mobile, expanded, onToggle, house }: {
  trip:     DossierTrip
  partners: Record<string, TripPartner>
  mobile:   boolean
  expanded: boolean
  onToggle: () => void
  house:    HouseProfile | null
}) {
  const statusColor: Record<string, string> = { active: '#4ade80', completed: '#86efac', cancelled: '#f87171', draft: A.faint }
  const tripColor       = statusColor[trip.status ?? ''] ?? A.gold
  const totalCommission = trip.bookings.reduce((s, b) => s + (b.commission_amount ?? 0), 0)
  const totalGross      = trip.bookings.reduce((s, b) => s + (b.commissionable_rate ?? b.price ?? 0) * (b.nights ?? 1), 0)

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${expanded ? A.gold + '40' : A.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 150ms ease' }}>
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
          <span style={{ fontSize: 14, color: A.faint, display: 'inline-block', transition: 'transform 150ms ease', transform: expanded ? 'rotate(90deg)' : 'none' }}>\u203a</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', gap: 20, padding: '12px 0', flexWrap: 'wrap', borderBottom: `1px solid ${A.border}`, marginBottom: 14 }}>
            {trip.destinations && trip.destinations.length > 0 && <MetaCell label='Destinations' value={trip.destinations.map(d => d.name).join(', ')} />}
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

          <TripActionPanel trip={trip} house={house} />

          {trip.bookings.length === 0
            ? <AdminEmptyState message='No bookings on this trip yet.' />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trip.bookings.map(b => <BookingCard key={b.id} booking={b} partners={partners} mobile={mobile} house={house} />)}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

// ── TripDossierSection ────────────────────────────────────────────────────────

export function TripDossierSection({ dossier, mobile }: {
  dossier: TripDossierData
  mobile:  boolean
}) {
  const [expandedTrip, setExpandedTrip] = useState<string | null>(
    dossier.trips.length === 1 ? dossier.trips[0].id : null
  )

  if (dossier.trips.length === 0) return <AdminEmptyState message='No trips linked to this household yet.' />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dossier.trips.map(trip => (
        <TripBlock
          key={trip.id}
          trip={trip}
          partners={dossier.partners}
          mobile={mobile}
          expanded={expandedTrip === trip.id}
          onToggle={() => setExpandedTrip(prev => prev === trip.id ? null : trip.id)}
          house={dossier.house}
        />
      ))}
    </div>
  )
}