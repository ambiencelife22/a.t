/* EngagementDossierSection.tsx
 * Engagement dossier surface for ClientsTab.
 *
 * Last updated: S48 - Copy Link buttons added to EngagementActionPanel for
 *   /confirmation and /programme client URLs. url_id now on DossierJourney.
 *   buildClientUrl + copyLink helpers. copied state with 2s feedback.
 * Prior: S48 - fetchAdminEngagementElements imported. handleDownload fetches aux.
 * Prior: S47 - navigateAdmin imported from adminPath. EngagementActionPanel
 *   onBriefSaved prop removed. trips local state removed.
 * Prior: S46 - Edit Brief navigates to BriefEditorPage.
 * Prior: S45 - EngagementActionPanel; confirmationBriefPdf; RoomsEditor.
 * Prior: S44 - initial ship.
 */

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { AdminEmptyState, useAdminToast } from './_adminPrimitives'
import { formatDateShort, formatDateShortRange, formatDateRange } from '../../utils/utilsDates'
import { moneyDec as fmt } from '../../utils/utilsCurrency'
import type {
  EngagementDossierData, DossierJourney, EngagementBooking, EngagementPartner,
  HouseProfile,
} from '../../queries/queriesAdminJourney'
import { getEventStatusMeta } from '../../types/typesEventStatus'
import { updateBookingBriefFields, createBooking, fetchAdminEngagementElements, createAdminEngagementElement, updateAdminEngagementElement, deleteAdminEngagementElement } from '../../queries/queriesAdminJourney'
import type { AdminEngagementElement, AdminEngagementElementPatch, EngagementTypeOption } from '../../queries/queriesAdminJourney'
import { fetchEngagementTypes, fetchRateReference, type RateReference } from '../../queries/queriesAdminJourney'
import { isFlightElement, isHotelElement, isGroundTransportElement } from '../../types/typesElements'
import { useDossierClientPdf } from '../../hooks/useDossierClientPdf'
import { useImmerseConfirmationPdf } from '../../hooks/useImmerseConfirmationPdf'
import type { ClientDossierData } from '../../pdf/pdfDossierClient'
import { AuxPassengersEditor } from './AuxPassengersEditor'
import { AuxDriverDetailsEditor } from './AuxDriverDetailsEditor'
import { BookingRoomsEditor } from './BookingRoomsEditor'
import { AirlinePicker } from './AirlinePicker'
import { HotelPicker } from './HotelPicker'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapBookingToDossier(b: EngagementBooking, house: HouseProfile | null): ClientDossierData {
  const hotelName = b._hotel_name ?? b.supplierNameOverride ?? b.name ?? 'Supplier'
  const checkIn   = b.startDate ? formatDateShort(b.startDate) : '--'
  const checkOut  = b.endDate   ? formatDateShort(b.endDate)   : '--'
  const duration  = b.nights     ? `${b.nights} night${b.nights !== 1 ? 's' : ''}` : '--'
  const dateRange = (() => {
    if (!b.startDate || !b.endDate) return checkIn
    return formatDateRange(b.startDate, b.endDate)
  })()
  const salutation = house?.salutationRule ?? null
  return {
    guestDisplayName:   house?.displayName ?? '',
    guestDescription:   salutation ? 'This VVIP guest will require attentive service and discreet security awareness.' : '',
    partyIntro:         b.partyComposition ? `${salutation ? 'They are' : 'The guest is'} arriving with ${b.partyComposition}.` : '',
    arrivalNote:        undefined,
    hotelName,
    destination:        '',
    dateRange,
    roomName:           b.name ?? hotelName,
    checkIn, checkOut, duration,
    rateType:           b.rateLabel?.displayName ?? '--',
    inclusions:         b.inclusions           ?? undefined,
    confirmationNumber: b.confirmationNumber  ?? undefined,
    primaryContactName: b.primaryContactName ?? undefined,
    primaryContactRole: b.primaryContactRole ?? undefined,
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

// ── EngagementActionPanel ───────────────────────────────────────────────────────────

function EngagementActionPanel({ trip, house }: {
  trip:  DossierJourney
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
    if (!trip.urlId) return null
    return `https://immerse.ambience.travel/${trip.urlId}/${surface}`
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
    const heroSrc = trip.brief?.heroImageSrc
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

    const elements = await fetchAdminEngagementElements(trip.id).catch(() => [])

    handleDownloadBrief({
      trip,
      brief:           trip.brief,
      house,
      destinationName: trip.destinations[0]?.name ?? trip.journeyCode,
      heroImageData:   heroData,
      elements,
      guestDisplayName: null,
    })
  }

  return (
    <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={() => navigateAdmin({ product: 'trips', tab: 'brief', journeyId: trip.id })}
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
        onClick={() => navigateAdmin({ product: 'trips', tab: 'programme', journeyId: trip.id })}
        style={{ ...btnBase, background: A.bgCard, color: A.muted, border: `1px solid ${A.border}` }}
      >
        Daily Programme
      </button>
      {trip.urlId && (
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
      {paid ? 'Paid' : `Due ${formatDateShort(dueDate)}`}
    </span>
  )
}

function BookingStatusPip({ status }: { status: string | null }) {
  const meta  = getEventStatusMeta(status)
  return (
    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: A.font, letterSpacing: '0.06em', color: meta.color, padding: '2px 8px', borderRadius: 12, background: meta.color + '12', border: `1px solid ${meta.color}30` }}>
      {meta.label}
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

// ── AuxBookingsEditor ─────────────────────────────────────────────────────────
// Trip-level flights / transfers / car services. Sibling to RoomsEditor.
// Writes every editable column on travel_engagement_aux_bookings (supplierId
// deferred - needs a supplier picker, airlineName covers display).

type AuxDraft = {
  engagementTypeId:  string
  bookingTypeSlug:   string  // derived from registry for predicate checks
  name:                string
  startDate:          string
  startTime:          string
  endDate:            string
  endTime:            string
  origin:              string
  destination:         string
  supplierId: string
  airlineName:        string
  flightNumber:       string
  departAirport:      string
  arriveAirport:      string
  cabinClass:         string
  aircraftType:       string
  bookedBy:           string
  notes:               string
  briefShow:          boolean
  sortOrder:          number
}

function emptyAuxDraft(sortOrder: number, defaultTypeId = '', defaultSlug = 'flight'): AuxDraft {
  return {
    engagementTypeId: defaultTypeId, bookingTypeSlug: defaultSlug, name: '',
    startDate: '', startTime: '', endDate: '', endTime: '',
    origin: '', destination: '', supplierId: '', airlineName: '', flightNumber: '',
    departAirport: '', arriveAirport: '', cabinClass: '',
    aircraftType: '', bookedBy: '', notes: '',
    briefShow: true, sortOrder: sortOrder,
  }
}

function auxToDraft(a: AdminEngagementElement): AuxDraft {
  return {
    engagementTypeId:  a.engagementTypeId  ?? '',
    bookingTypeSlug:   a.elementType        ?? 'flight',
    name:                a.name                ?? '',
    startDate:          a.startDate          ?? '',
    startTime:          a.startTime          ?? '',
    endDate:            a.endDate            ?? '',
    endTime:            a.endTime            ?? '',
    origin:              a.origin              ?? '',
    destination:         a.destination         ?? '',
    supplierId: a.supplierId ?? '',
    airlineName:        a.airlineName        ?? '',
    flightNumber:       a.flightNumber       ?? '',
    departAirport:      a.departAirport      ?? '',
    arriveAirport:      a.arriveAirport      ?? '',
    cabinClass:         a.cabinClass         ?? '',
    aircraftType:       a.aircraftType       ?? '',
    bookedBy:           a.bookedBy           ?? '',
    notes:               a.notes               ?? '',
    briefShow:          a.briefShow,
    sortOrder:          a.sortOrder,
  }
}

// Map draft -> patch. Empty strings on nullable text columns become null.
function draftToPatch(d: AuxDraft): AdminEngagementElementPatch {
  const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  return {
    engagementTypeId:  d.engagementTypeId ?? null,
    name:                orNull(d.name),
    startDate:          orNull(d.startDate),
    startTime:          orNull(d.startTime),
    endDate:            orNull(d.endDate),
    endTime:            orNull(d.endTime),
    origin:              orNull(d.origin),
    destination:         orNull(d.destination),
    supplierId: orNull(d.supplierId),
    airlineName:        orNull(d.airlineName),
    flightNumber:       orNull(d.flightNumber),
    departAirport:      orNull(d.departAirport),
    arriveAirport:      orNull(d.arriveAirport),
    cabinClass:         orNull(d.cabinClass),
    aircraftType:       orNull(d.aircraftType),
    bookedBy:           orNull(d.bookedBy),
    notes:               orNull(d.notes),
    briefShow:          d.briefShow,
    sortOrder:          d.sortOrder,
  }
}

function AuxField({ label, value, onChange, placeholder, type = 'text', span }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; span?: boolean
}) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

type EngagementType = EngagementTypeOption

function AuxForm({ draft, setDraft, onSave, onCancel, saving, saveLabel, engagementTypes }: {
  draft: AuxDraft; setDraft: (d: AuxDraft) => void
  onSave: () => void; onCancel: () => void; saving: boolean; saveLabel: string
  engagementTypes: EngagementType[]
}) {
  const set = <K extends keyof AuxDraft>(k: K, v: AuxDraft[K]) => setDraft({ ...draft, [k]: v })
  const isFlight = isFlightElement(draft.bookingTypeSlug)

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Core */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} value={draft.engagementTypeId} onChange={e => {
            const et = engagementTypes.find(t => t.id === e.target.value)
            setDraft({ ...draft, engagementTypeId: e.target.value, bookingTypeSlug: et?.slug ?? '' })
          }}>
            <option value=''>Select type</option>
            {engagementTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <AuxField label='Name' value={draft.name} onChange={v => set('name', v)} placeholder='Emirates EK 824' />
        <AuxField label='Booked By' value={draft.bookedBy} onChange={v => set('bookedBy', v)} placeholder='ambience' />
        <AuxField label='Start Date' type='date' value={draft.startDate} onChange={v => set('startDate', v)} />
        <AuxField label='Start Time' type='time' value={draft.startTime} onChange={v => set('startTime', v)} />
        <AuxField label='End Date' type='date' value={draft.endDate} onChange={v => set('endDate', v)} />
        <AuxField label='End Time' type='time' value={draft.endTime} onChange={v => set('endTime', v)} />
        <AuxField label='Origin' value={draft.origin} onChange={v => set('origin', v)} placeholder='Riyadh' />
        <AuxField label='Destination' value={draft.destination} onChange={v => set('destination', v)} placeholder='Salzburg' />
      </div>

      {/* Flight detail - only for Flight type */}
      {isFlight && (
        <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Flight Detail</div>
          <div style={{ gridColumn: '1 / -1', marginBottom: 8 }}>
            <AirlinePicker
              supplierId={draft.supplierId}
              airlineNameFallback={draft.airlineName}
              bookingType={engagementTypes.find(t => t.id === draft.engagementTypeId)?.label ?? ''}
              variant='boxed'
              onChange={value => {
                // Pick a supplier; clear the free-text override so the supplier wins.
                setDraft({ ...draft, supplierId: value, airlineName: value ? '' : draft.airlineName })
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <AuxField label='Flight #' value={draft.flightNumber} onChange={v => set('flightNumber', v)} placeholder='EK 824' />
            <AuxField label='Depart Airport' value={draft.departAirport} onChange={v => set('departAirport', v)} placeholder='RUH' />
            <AuxField label='Arrive Airport' value={draft.arriveAirport} onChange={v => set('arriveAirport', v)} placeholder='SZG' />
            <AuxField label='Cabin Class' value={draft.cabinClass} onChange={v => set('cabinClass', v)} placeholder='Business' />
            <AuxField label='Aircraft' value={draft.aircraftType} onChange={v => set('aircraftType', v)} placeholder='Boeing 777-300ER' />
          </div>
        </div>
      )}

      {/* Display */}
      <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Display</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <AuxField label='Sort Order' type='number' value={String(draft.sortOrder)} onChange={v => set('sortOrder', parseInt(v, 10) || 0)} />
          <AuxField label='Notes' value={draft.notes} onChange={v => set('notes', v)} span />
        </div>
        <label style={{ ...labelStyle, marginTop: 10, marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type='checkbox' checked={draft.briefShow} onChange={e => set('briefShow', e.target.checked)} />
          Show in brief
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.faint, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={saving} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: '#0F1110', background: A.gold, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )
}

function AuxBookingsEditor({ journeyId }: { journeyId: string }) {
  const [aux,             setAux]             = useState<AdminEngagementElement[] | null>(null)
  const [engagementTypes, setEngagementTypes] = useState<EngagementType[]>([])
  const [loading,         setLoading]         = useState(false)
  const [adding,          setAdding]          = useState(false)
  const [editId,          setEditId]          = useState<string | null>(null)
  const [draft,           setDraft]           = useState<AuxDraft>(emptyAuxDraft(0))
  const [saving,          setSaving]          = useState(false)
  const { success, error } = useAdminToast()

  function load() {
    setLoading(true)
    Promise.all([
      fetchAdminEngagementElements(journeyId),
      fetchEngagementTypes(),
    ])
      .then(([rows, types]) => {
        setAux(rows.sort((a, b) => a.sortOrder - b.sortOrder))
        setEngagementTypes(types)
        if (types.length > 0) {
          const defaultType = types.find(t => t.slug === 'flight') ?? types[0]
          setDraft(emptyAuxDraft(0, defaultType.id, defaultType.slug))
        }
      })
      .catch(e => { setAux([]); error(e instanceof Error ? e.message : 'Failed to load flights') })
      .finally(() => setLoading(false))
  }

  function beginAdd() {
    setEditId(null)
    const defaultType = engagementTypes.find(t => t.slug === 'flight') ?? engagementTypes[0]
    setDraft(emptyAuxDraft(aux?.length ?? 0, defaultType?.id ?? '', defaultType?.slug ?? 'flight'))
    setAdding(true)
  }

  function beginEdit(a: AdminEngagementElement) {
    setAdding(false)
    setEditId(a.id)
    setDraft(auxToDraft(a))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const patch = draftToPatch(draft)
      if (editId) {
        const updated = await updateAdminEngagementElement(editId, patch)
        setAux(prev => (prev ?? []).map(a => a.id === editId ? updated : a).sort((x, y) => x.sortOrder - y.sortOrder))
        setEditId(null)
        success('Flight updated')
        return
      }
      const created = await createAdminEngagementElement(journeyId, patch)
      setAux(prev => [...(prev ?? []), created].sort((x, y) => x.sortOrder - y.sortOrder))
      setAdding(false)
      success('Flight added')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to save flight') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteAdminEngagementElement(id)
      setAux(prev => (prev ?? []).filter(a => a.id !== id))
      success('Flight removed')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to delete flight') }
    finally { setSaving(false) }
  }

  // Load once on mount (editor only mounts when the trip block is expanded)
  useEffect(() => { load() }, [journeyId])

  const rowLine = (a: AdminEngagementElement): string => {
    const route = [a.origin, a.destination].filter(Boolean).join(' \u2192 ')
    const seats = a.cabinClass ?? ''
    return [route, seats].filter(Boolean).join('  \u00b7  ')
  }

  return (
    <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
          Flights & Transfers ({aux?.length ?? 0})
        </div>
        {!adding && !editId && (
          <button onClick={beginAdd} style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
            + Add Flight / Transfer
          </button>
        )}
      </div>

      {loading && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Loading...</div>}

      {(aux ?? []).map(a => (
        editId === a.id ? (
          <div key={a.id} style={{ marginBottom: 8 }}>
            <AuxForm draft={draft} setDraft={setDraft} onSave={handleSave} onCancel={() => setEditId(null)} saving={saving} saveLabel='Save Changes' engagementTypes={engagementTypes} />
          </div>
        ) : (
          <div key={a.id} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{a.elementTypeLabel ?? a.elementType ?? 'Other'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{a.name ?? 'Booking'}</span>
                {!a.briefShow && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>hidden</span>}
              </div>
              {rowLine(a) && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{rowLine(a)}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                {a.startDate && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{a.startDate}{a.startTime ? ` ${a.startTime.slice(0, 5)}` : ''}</span>}
              </div>
              {isFlightElement(a.elementType) && (
                <AuxPassengersEditor auxBookingId={a.id} initial={a.passengers ?? []} />
              )}
              {isGroundTransportElement(a.elementType) && (
                <AuxDriverDetailsEditor auxBookingId={a.id} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => beginEdit(a)} style={{ fontFamily: A.font, fontSize: 10, color: A.gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Edit</button>
              <button onClick={() => handleDelete(a.id)} disabled={saving} style={{ fontFamily: A.font, fontSize: 10, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>×</button>
            </div>
          </div>
        )
      ))}

      {adding && (
        <div style={{ marginTop: 4 }}>
          <AuxForm draft={draft} setDraft={setDraft} onSave={handleSave} onCancel={() => setAdding(false)} saving={saving} saveLabel='Add' engagementTypes={engagementTypes} />
        </div>
      )}
    </div>
  )
}

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking: b, partners, mobile, house, partyLabel }: {
  booking:   EngagementBooking
  partners:  Record<string, EngagementPartner>
  mobile:    boolean
  house:     HouseProfile | null
  partyLabel: string | null
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [briefCat,  setBriefCat]  = useState(b.briefCategory ?? '')
  const [bookedBy,  setBookedBy]  = useState(b.bookedBy ?? '')
  const [briefShow, setBriefShow] = useState(b.briefShow ?? true)
  const [saving,    setSaving]    = useState(false)

  const { pdfReady, pdfDownloading, handleDownloadDossier } = useDossierClientPdf()

  const iataPartner  = b.iataPartnerId    ? partners[b.iataPartnerId]    : null
  const refPartner   = b.referralPartnerId ? partners[b.referralPartnerId] : null
  const indivPartner = b.individualId       ? partners[b.individualId]       : null
  const supplierName = b._hotel_name ?? b.supplierNameOverride ?? null
  const currency     = b.currency ?? 'USD'
  const depositPaid  = !!b.depositPaidAt
  const balancePaid  = !!b.balancePaidAt
  const commTotal    = b.commissionableRate != null && b.nights != null ? b.commissionableRate * b.nights : null
  const typeColor    = A.gold

  async function saveBriefFields() {
    setSaving(true)
    try { await updateBookingBriefFields(b.id, { briefCategory: briefCat || null, bookedBy: bookedBy, briefShow: briefShow }) }
    catch { /* silent */ }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderLeft: `3px solid ${typeColor}`, borderRadius: 8, overflow: 'hidden' }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{b.name ?? supplierName ?? 'Booking'}</span>
            <BookingStatusPip status={b.status} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {supplierName && b.name !== supplierName && <span style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{supplierName}</span>}
            {b.startDate && (
              <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                {formatDateShortRange(b.startDate, b.endDate)}{b.nights ? ` \u00b7 ${b.nights}N` : ''}
              </span>
            )}
            {b.confirmationNumber && <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{b.confirmationNumber}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {b.commissionAmount != null && <span style={{ fontSize: 12, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(b.commissionAmount, currency)}</span>}
          <span style={{ fontSize: 10, color: A.faint, display: 'inline-block', transition: 'transform 150ms ease', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {(b.commissionableRate != null || b.totalRate != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
              {b.commissionableRate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Comm. Rate{b.nights && b.nights > 1 ? '/N' : ''}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.commissionableRate, currency)}</div>
                  {b.rateLabel?.displayName && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.rateLabel.displayName}</div>}
                </div>
              )}
              {commTotal != null && b.nights != null && b.nights > 1 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Comm. Total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(commTotal, currency)}</div>
                </div>
              )}
              {b.totalRate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Total Rate/N</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.totalRate, currency)}</div>
                  {b.taxesAndFees != null && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.taxesAndFees}% taxes + fees</div>}
                </div>
              )}
              {b.commissionPct != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Commission</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(b.commissionAmount, currency)}</div>
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.commissionPct}% gross</div>
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

          {(b.depositAmount != null || b.balanceAmount != null) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Payment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.depositAmount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Deposit </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.depositAmount, currency)}</span>
                      {depositPaid && b.depositPaidAt && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}> \u00b7 paid {formatDateShort(b.depositPaidAt)}</span>}
                    </div>
                    <PaymentBadge paid={depositPaid} amount={b.depositAmount} dueDate={b.depositDueDate} currency={currency} />
                  </div>
                )}
                {b.balanceAmount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Balance </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.balanceAmount, currency)}</span>
                    </div>
                    <PaymentBadge paid={balancePaid} amount={b.balanceAmount} dueDate={b.balanceDueDate} currency={currency} />
                  </div>
                )}
              </div>
            </div>
          )}

          {(iataPartner || refPartner || indivPartner) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Commission Splits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {iataPartner   && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{iataPartner.name} <span style={{ fontSize: 10, color: A.faint }}>IATA</span></span><span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.iataSharePct}% \u00b7 {fmt(b.iataShareAmt, currency)}</span></div>}
                {refPartner    && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{refPartner.name} <span style={{ fontSize: 10, color: A.faint }}>Referral</span></span><span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.referralSharePct}% \u00b7 {fmt(b.referralShareAmt, currency)}</span></div>}
                {indivPartner  && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{indivPartner.name}</span><span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{b.individualSharePct}% \u00b7 {fmt(b.individualShareAmt, currency)}</span></div>}
              </div>
            </div>
          )}

          {(b.cancellationPolicy || b.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {b.cancellationPolicy && (
                <div style={{ padding: '7px 10px', background: '#f8717108', border: '1px solid #f8717118', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f87171', fontFamily: A.font, marginBottom: 3 }}>Cancellation</div>
                  <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{b.cancellationPolicy}</div>
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

          <BookingRoomsEditor booking={b} partyLabel={partyLabel} />

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

// ── BookingCreator ────────────────────────────────────────────────────────────
// Create a new travel_bookings row on a trip. Closes the SQL-only booking gap.
// Core identity + dates + the validated rate fields; commission internals are
// editable after creation via the booking card (update_booking_brief is
// generic-patch). Hotel link via HotelPicker when type === 'Hotel'.

const BOOKING_TYPES  = ['Hotel', 'Flight', 'Transfer', 'Restaurant', 'Experience', 'Other']
const BOOKING_STATUS = ['quoted', 'confirmed', 'pending', 'cancelled', 'recommended', 'requested', 'awaiting_decision', 'paid']

type BookingDraft = {
  elementType:        string
  name:                string
  status:              string
  confirmationNumber: string
  accomHotelId:      string
  startDate:          string
  endDate:            string
  nights:              string
  currency:            string
  commissionableRate: string
  totalRate:          string
  taxesAndFees:      string
  boardBasisId:      string
  paymentTermsId:    string
  pricingBasisId:    string
  rateLabelId:       string
  bookedBy:           string
  briefCategory:      string
  cancellationPolicy: string
  inclusions:          string
  notes:               string
}

function emptyBookingDraft(): BookingDraft {
  return {
    elementType: 'Hotel', name: '', status: 'confirmed', confirmationNumber: '',
    accomHotelId: '', startDate: '', endDate: '', nights: '',
    currency: 'EUR', commissionableRate: '', totalRate: '', taxesAndFees: '',
    boardBasisId: '', paymentTermsId: '', pricingBasisId: '', rateLabelId: '', bookedBy: 'ambience', briefCategory: '', cancellationPolicy: '',
    inclusions: '', notes: '',
  }
}

function bookingDraftToPatch(d: BookingDraft): Record<string, unknown> {
  const orNull    = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  const numOrNull = (s: string): number | null => {
    const t = s.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return {
    elementType:        orNull(d.elementType),
    name:                orNull(d.name),
    status:              orNull(d.status),
    confirmationNumber: orNull(d.confirmationNumber),
    accomHotelId:      isHotelElement(d.elementType) ? orNull(d.accomHotelId) : null,
    startDate:          orNull(d.startDate),
    endDate:            orNull(d.endDate),
    nights:              numOrNull(d.nights),
    currency:            orNull(d.currency),
    commissionableRate: numOrNull(d.commissionableRate),
    totalRate:          numOrNull(d.totalRate),
    taxesAndFees:      numOrNull(d.taxesAndFees),
    boardBasisId:      orNull(d.boardBasisId),
    paymentTermsId:    orNull(d.paymentTermsId),
    pricingBasisId:    orNull(d.pricingBasisId),
    rateLabelId:       orNull(d.rateLabelId),
    bookedBy:           orNull(d.bookedBy),
    briefCategory:      orNull(d.briefCategory),
    cancellationPolicy: orNull(d.cancellationPolicy),
    inclusions:          orNull(d.inclusions),
    notes:               orNull(d.notes),
  }
}

function BookingCreator({ journeyId, onCreated }: {
  journeyId:    string
  onCreated: (booking: EngagementBooking) => void
}) {
  const [open,   setOpen]   = useState(false)
  const [draft,  setDraft]  = useState<BookingDraft>(emptyBookingDraft())
  const [saving, setSaving] = useState(false)
  const [rateRef, setRateRef] = useState<RateReference>({ boardBases: [], paymentTerms: [], pricingBases: [], rateLabels: [] })
  useEffect(() => { fetchRateReference().then(setRateRef).catch(() => {}) }, [])
  const { success, error } = useAdminToast()

  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setDraft({ ...draft, [k]: v })
  const isHotel = isHotelElement(draft.elementType)

  async function handleCreate() {
    setSaving(true)
    try {
      const raw = await createBooking(journeyId, bookingDraftToPatch(draft))
      const hydrated: EngagementBooking = { ...raw, _hotel_name: null, _hotel_image_src: null, _rooms: [] }
      onCreated(hydrated)
      setOpen(false)
      setDraft(emptyBookingDraft())
      success('Booking created')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to create booking') }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 6, padding: '6px 14px', cursor: 'pointer', alignSelf: 'flex-start', marginTop: 6 }}>
        + New Booking
      </button>
    )
  }

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, padding: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>New Booking</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} value={draft.elementType} onChange={e => set('elementType', e.target.value)}>
            {BOOKING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={draft.status} onChange={e => set('status', e.target.value)}>
            {BOOKING_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {isHotel && (
        <HotelPicker
          hotelId={draft.accomHotelId}
          onChange={(id, hotel) => setDraft({ ...draft, accomHotelId: id, name: draft.name || (hotel?.name ?? '') })}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><label style={labelStyle}>Name</label><input style={inputStyle} value={draft.name} onChange={e => set('name', e.target.value)} placeholder={isHotel ? 'Hotel Goldener Hirsch' : 'Booking name'} /></div>
        <div><label style={labelStyle}>Confirmation #</label><input style={inputStyle} value={draft.confirmationNumber} onChange={e => set('confirmationNumber', e.target.value)} placeholder='74373105' /></div>
        <div><label style={labelStyle}>Start Date</label><input style={inputStyle} type='date' value={draft.startDate} onChange={e => set('startDate', e.target.value)} /></div>
        <div><label style={labelStyle}>End Date</label><input style={inputStyle} type='date' value={draft.endDate} onChange={e => set('endDate', e.target.value)} /></div>
        <div><label style={labelStyle}>Nights</label><input style={inputStyle} type='number' value={draft.nights} onChange={e => set('nights', e.target.value)} placeholder='3' /></div>
        <div><label style={labelStyle}>Currency</label><input style={inputStyle} value={draft.currency} onChange={e => set('currency', e.target.value)} placeholder='EUR' /></div>
      </div>

      <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Rate Detail</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label style={labelStyle}>Commissionable Rate / night</label><input style={inputStyle} type='number' value={draft.commissionableRate} onChange={e => set('commissionableRate', e.target.value)} placeholder='1305.00' /></div>
          <div><label style={labelStyle}>Total Rate / night</label><input style={inputStyle} type='number' value={draft.totalRate} onChange={e => set('totalRate', e.target.value)} placeholder='' /></div>
          <div><label style={labelStyle}>Taxes & Fees %</label><input style={inputStyle} type='number' value={draft.taxesAndFees} onChange={e => set('taxesAndFees', e.target.value)} placeholder='' /></div>
          <div><label style={labelStyle}>Board Basis</label><select style={inputStyle} value={draft.boardBasisId} onChange={e => set('boardBasisId', e.target.value)}><option value=''>-</option>{rateRef.boardBases.map(o => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select></div>
          <div><label style={labelStyle}>Payment Terms</label><select style={inputStyle} value={draft.paymentTermsId} onChange={e => set('paymentTermsId', e.target.value)}><option value=''>-</option>{rateRef.paymentTerms.map(o => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select></div>
          <div><label style={labelStyle}>Pricing Basis</label><select style={inputStyle} value={draft.pricingBasisId} onChange={e => set('pricingBasisId', e.target.value)}><option value=''>-</option>{rateRef.pricingBases.map(o => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select></div>
          <div><label style={labelStyle}>Rate Label</label><select style={inputStyle} value={draft.rateLabelId} onChange={e => set('rateLabelId', e.target.value)}><option value=''>-</option>{rateRef.rateLabels.map(o => <option key={o.id} value={o.id}>{o.displayName}{o.clientVisible ? '' : ' (internal)'}</option>)}</select></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><label style={labelStyle}>Booked By</label><input style={inputStyle} value={draft.bookedBy} onChange={e => set('bookedBy', e.target.value)} placeholder='ambience' /></div>
        <div><label style={labelStyle}>Brief Category</label><input style={inputStyle} value={draft.briefCategory} onChange={e => set('briefCategory', e.target.value)} placeholder='Accommodation' /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Inclusions</label><input style={inputStyle} value={draft.inclusions} onChange={e => set('inclusions', e.target.value)} placeholder='Breakfast included' /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Cancellation Policy</label><input style={inputStyle} value={draft.cancellationPolicy} onChange={e => set('cancellationPolicy', e.target.value)} placeholder='Free cancellation until 30 days prior' /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><input style={inputStyle} value={draft.notes} onChange={e => set('notes', e.target.value)} placeholder='Internal notes' /></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={() => { setOpen(false); setDraft(emptyBookingDraft()) }} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.faint, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleCreate} disabled={saving} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: '#0F1110', background: A.gold, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Creating...' : 'Create Booking'}
        </button>
      </div>
    </div>
  )
}

// ── EngagementBlock ─────────────────────────────────────────────────────────────────

function EngagementBlock({ trip, partners, mobile, expanded, onToggle, house }: {
  trip:     DossierJourney
  partners: Record<string, EngagementPartner>
  mobile:   boolean
  expanded: boolean
  onToggle: () => void
  house:    HouseProfile | null
}) {
  const [bookings, setBookings] = useState<EngagementBooking[]>(trip.bookings)
  // Stage-based pill (S53G+): derived from the winning engagement, not a
  // free-text trip column. 5 stages; null winner → "Pre-confirmation".
  const stageColor: Record<string, string> = { trip: '#4ade80', completed: '#86efac', proposal: '#E8C547', draft: A.faint, cancelled: '#f87171' }
  const stageLabel: Record<string, string> = { trip: 'In Progress', completed: 'Completed', proposal: 'Proposal', draft: 'Draft', cancelled: 'Cancelled' }
  const tripColor       = trip.stage ? (stageColor[trip.stage] ?? A.gold) : A.faint
  const tripStageText   = trip.stage ? (stageLabel[trip.stage] ?? trip.stage) : 'Pre-confirmation'
  const totalCommission = bookings.reduce((s, b) => s + (b.commissionAmount ?? 0), 0)
  const totalGross      = bookings.reduce((s, b) => s + (b.commissionableRate ?? b.price ?? 0) * (b.nights ?? 1), 0)

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${expanded ? A.gold + '40' : A.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 150ms ease' }}>
      <div onClick={onToggle} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>{trip.journeyCode}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: tripColor, fontFamily: A.font, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tripStageText}</span>
          {trip.startDate && (
            <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {formatDateShortRange(trip.startDate, trip.endDate)}{trip.durationNights ? ` \u00b7 ${trip.durationNights}N` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {totalCommission > 0 && <span style={{ fontSize: 12, color: A.gold, fontFamily: A.font, fontWeight: 600 }}>{fmt(totalCommission)} commission</span>}
          <span style={{ fontSize: 14, color: A.faint, display: 'inline-block', transition: 'transform 150ms ease', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', gap: 20, padding: '12px 0', flexWrap: 'wrap', borderBottom: `1px solid ${A.border}`, marginBottom: 14 }}>
            {trip.destinations && trip.destinations.length > 0 && <MetaCell label='Destinations' value={trip.destinations.map(d => d.name).join(', ')} />}
            {(trip.guestCountAdults || trip.guestCountChildren) && (
              <MetaCell label='Guests' value={`${trip.guestCountAdults ?? 0} adult${(trip.guestCountAdults ?? 0) !== 1 ? 's' : ''}${trip.guestCountChildren ? `, ${trip.guestCountChildren} child${trip.guestCountChildren !== 1 ? 'ren' : ''}` : ''}`} />
            )}
            {trip.tripType && <MetaCell label='Type' value={<span style={{ textTransform: 'capitalize' }}>{trip.tripType}</span>} />}
            {trip.brief && <MetaCell label='Brief' value={<span style={{ color: A.gold }}>Ready</span>} />}
            {totalCommission > 0 && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Total Commission</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(totalCommission)}</div>
                {totalGross > 0 && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>on {fmt(totalGross)} gross</div>}
              </div>
            )}
          </div>

          <EngagementActionPanel trip={trip} house={house} />

          {bookings.length === 0
            ? <AdminEmptyState message='No bookings on this trip yet.' />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bookings.map(b => <BookingCard key={b.id} booking={b} partners={partners} mobile={mobile} house={house} partyLabel={trip.brief?.preparedFor ?? null} />)}
              </div>
            )
          }

          <BookingCreator journeyId={trip.id} onCreated={b => setBookings(prev => [...prev, b])} />

          <AuxBookingsEditor journeyId={trip.id} />
        </div>
      )}
    </div>
  )
}

// ── EngagementDossierSection ────────────────────────────────────────────────────────

export function EngagementDossierSection({ dossier, mobile }: {
  dossier: EngagementDossierData
  mobile:  boolean
}) {
  const [expandedTrip, setExpandedTrip] = useState<string | null>(
    dossier.engagements.length === 1 ? dossier.engagements[0].id : null
  )

  if (dossier.engagements.length === 0) return <AdminEmptyState message='No engagements linked to this client yet.' />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dossier.engagements.map(trip => (
        <EngagementBlock
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