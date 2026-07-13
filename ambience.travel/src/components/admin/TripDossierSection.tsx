/* TripDossierSection.tsx
 * Trip Dossier surface for HouseTab.
 *
 * Last updated: S48 — Copy Link buttons added to TripActionPanel for
 *   /confirmation and /programme client URLs. url_id now on DossierJourney.
 *   buildClientUrl + copyLink helpers. copied state with 2s feedback.
 * Prior: S48 — fetchTripAuxBookings imported. handleDownload fetches aux.
 * Prior: S47 — navigateAdmin imported from adminPath. TripActionPanel
 *   onBriefSaved prop removed. trips local state removed.
 * Prior: S46 — Edit Brief navigates to BriefEditorPage.
 * Prior: S45 — TripActionPanel; confirmationBriefPdf; RoomsEditor.
 * Prior: S44 — initial ship.
 */

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { AdminEmptyState, useAdminToast } from './_adminPrimitives'
import { formatDateShort, formatDateShortRange, formatDateRange } from '../../utils/utilsDates'
import { moneyDec as fmt } from '../../utils/utilsCurrency'
import type {
  TripDossierData, DossierJourney, EngagementBooking, TripPartner,
  HouseProfile,
} from '../../queries/queriesAdminJourney'
import { getEventStatusMeta } from '../../types/typesEventStatus'
import { updateBookingBriefFields, createBooking, fetchTripAuxBookings, createTripAuxBooking, updateTripAuxBooking, deleteTripAuxBooking } from '../../queries/queriesAdminJourney'
import type { TripAuxBooking, TripAuxBookingPatch, EngagementTypeOption } from '../../queries/queriesAdminJourney'
import { fetchEngagementTypes } from '../../queries/queriesAdminJourney'
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
  const hotelName = b._hotel_name ?? b.supplier_name_override ?? b.name ?? 'Supplier'
  const checkIn   = b.start_date ? formatDateShort(b.start_date) : '--'
  const checkOut  = b.end_date   ? formatDateShort(b.end_date)   : '--'
  const duration  = b.nights     ? `${b.nights} night${b.nights !== 1 ? 's' : ''}` : '--'
  const dateRange = (() => {
    if (!b.start_date || !b.end_date) return checkIn
    return formatDateRange(b.start_date, b.end_date)
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

    const elements = await fetchTripAuxBookings(trip.id).catch(() => [])

    handleDownloadBrief({
      trip,
      brief:           trip.brief,
      house,
      destinationName: trip.destinations[0]?.name ?? trip.trip_code,
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
// Writes every editable column on travel_engagement_aux_bookings (airline_supplier_id
// deferred — needs a supplier picker, airline_name covers display).

type AuxDraft = {
  engagementTypeId:  string
  bookingTypeSlug:   string  // derived from registry for predicate checks
  name:                string
  start_date:          string
  start_time:          string
  end_date:            string
  end_time:            string
  origin:              string
  destination:         string
  airline_supplier_id: string
  airline_name:        string
  flight_number:       string
  depart_airport:      string
  arrive_airport:      string
  cabin_class:         string
  aircraft_type:       string
  booked_by:           string
  notes:               string
  brief_show:          boolean
  sort_order:          number
}

function emptyAuxDraft(sortOrder: number, defaultTypeId = '', defaultSlug = 'flight'): AuxDraft {
  return {
    engagementTypeId: defaultTypeId, bookingTypeSlug: defaultSlug, name: '',
    start_date: '', start_time: '', end_date: '', end_time: '',
    origin: '', destination: '', airline_supplier_id: '', airline_name: '', flight_number: '',
    depart_airport: '', arrive_airport: '', cabin_class: '',
    aircraft_type: '', booked_by: '', notes: '',
    brief_show: true, sort_order: sortOrder,
  }
}

function auxToDraft(a: TripAuxBooking): AuxDraft {
  return {
    engagementTypeId:  a.engagement_type_id  ?? '',
    bookingTypeSlug:   a.element_type        ?? 'flight',
    name:                a.name                ?? '',
    start_date:          a.start_date          ?? '',
    start_time:          a.start_time          ?? '',
    end_date:            a.end_date            ?? '',
    end_time:            a.end_time            ?? '',
    origin:              a.origin              ?? '',
    destination:         a.destination         ?? '',
    airline_supplier_id: a.airline_supplier_id ?? '',
    airline_name:        a.airline_name        ?? '',
    flight_number:       a.flight_number       ?? '',
    depart_airport:      a.depart_airport      ?? '',
    arrive_airport:      a.arrive_airport      ?? '',
    cabin_class:         a.cabin_class         ?? '',
    aircraft_type:       a.aircraft_type       ?? '',
    booked_by:           a.booked_by           ?? '',
    notes:               a.notes               ?? '',
    brief_show:          a.brief_show,
    sort_order:          a.sort_order,
  }
}

// Map draft -> patch. Empty strings on nullable text columns become null.
function draftToPatch(d: AuxDraft): TripAuxBookingPatch {
  const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim())
  return {
    engagement_type_id:  d.engagementTypeId ?? null,
    name:                orNull(d.name),
    start_date:          orNull(d.start_date),
    start_time:          orNull(d.start_time),
    end_date:            orNull(d.end_date),
    end_time:            orNull(d.end_time),
    origin:              orNull(d.origin),
    destination:         orNull(d.destination),
    airline_supplier_id: orNull(d.airline_supplier_id),
    airline_name:        orNull(d.airline_name),
    flight_number:       orNull(d.flight_number),
    depart_airport:      orNull(d.depart_airport),
    arrive_airport:      orNull(d.arrive_airport),
    cabin_class:         orNull(d.cabin_class),
    aircraft_type:       orNull(d.aircraft_type),
    booked_by:           orNull(d.booked_by),
    notes:               orNull(d.notes),
    brief_show:          d.brief_show,
    sort_order:          d.sort_order,
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
        <AuxField label='Booked By' value={draft.booked_by} onChange={v => set('booked_by', v)} placeholder='ambience' />
        <AuxField label='Start Date' type='date' value={draft.start_date} onChange={v => set('start_date', v)} />
        <AuxField label='Start Time' type='time' value={draft.start_time} onChange={v => set('start_time', v)} />
        <AuxField label='End Date' type='date' value={draft.end_date} onChange={v => set('end_date', v)} />
        <AuxField label='End Time' type='time' value={draft.end_time} onChange={v => set('end_time', v)} />
        <AuxField label='Origin' value={draft.origin} onChange={v => set('origin', v)} placeholder='Riyadh' />
        <AuxField label='Destination' value={draft.destination} onChange={v => set('destination', v)} placeholder='Salzburg' />
      </div>

      {/* Flight detail — only for Flight type */}
      {isFlight && (
        <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Flight Detail</div>
          <div style={{ gridColumn: '1 / -1', marginBottom: 8 }}>
            <AirlinePicker
              supplierId={draft.airline_supplier_id}
              airlineNameFallback={draft.airline_name}
              bookingType={engagementTypes.find(t => t.id === draft.engagementTypeId)?.label ?? ''}
              variant='boxed'
              onChange={value => {
                // Pick a supplier; clear the free-text override so the supplier wins.
                setDraft({ ...draft, airline_supplier_id: value, airline_name: value ? '' : draft.airline_name })
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <AuxField label='Flight #' value={draft.flight_number} onChange={v => set('flight_number', v)} placeholder='EK 824' />
            <AuxField label='Depart Airport' value={draft.depart_airport} onChange={v => set('depart_airport', v)} placeholder='RUH' />
            <AuxField label='Arrive Airport' value={draft.arrive_airport} onChange={v => set('arrive_airport', v)} placeholder='SZG' />
            <AuxField label='Cabin Class' value={draft.cabin_class} onChange={v => set('cabin_class', v)} placeholder='Business' />
            <AuxField label='Aircraft' value={draft.aircraft_type} onChange={v => set('aircraft_type', v)} placeholder='Boeing 777-300ER' />
          </div>
        </div>
      )}

      {/* Display */}
      <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Display</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <AuxField label='Sort Order' type='number' value={String(draft.sort_order)} onChange={v => set('sort_order', parseInt(v, 10) || 0)} />
          <AuxField label='Notes' value={draft.notes} onChange={v => set('notes', v)} span />
        </div>
        <label style={{ ...labelStyle, marginTop: 10, marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type='checkbox' checked={draft.brief_show} onChange={e => set('brief_show', e.target.checked)} />
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
  const [aux,             setAux]             = useState<TripAuxBooking[] | null>(null)
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
      fetchTripAuxBookings(journeyId),
      fetchEngagementTypes(),
    ])
      .then(([rows, types]) => {
        setAux(rows.sort((a, b) => a.sort_order - b.sort_order))
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

  function beginEdit(a: TripAuxBooking) {
    setAdding(false)
    setEditId(a.id)
    setDraft(auxToDraft(a))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const patch = draftToPatch(draft)
      if (editId) {
        const updated = await updateTripAuxBooking(editId, patch)
        setAux(prev => (prev ?? []).map(a => a.id === editId ? updated : a).sort((x, y) => x.sort_order - y.sort_order))
        setEditId(null)
        success('Flight updated')
        return
      }
      const created = await createTripAuxBooking(journeyId, patch)
      setAux(prev => [...(prev ?? []), created].sort((x, y) => x.sort_order - y.sort_order))
      setAdding(false)
      success('Flight added')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to save flight') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      await deleteTripAuxBooking(id)
      setAux(prev => (prev ?? []).filter(a => a.id !== id))
      success('Flight removed')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to delete flight') }
    finally { setSaving(false) }
  }

  // Load once on mount (editor only mounts when the trip block is expanded)
  useEffect(() => { load() }, [journeyId])

  const rowLine = (a: TripAuxBooking): string => {
    const route = [a.origin, a.destination].filter(Boolean).join(' \u2192 ')
    const seats = a.cabin_class ?? ''
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
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{a.element_type_label ?? a.element_type ?? 'Other'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{a.name ?? 'Booking'}</span>
                {!a.brief_show && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>hidden</span>}
              </div>
              {rowLine(a) && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{rowLine(a)}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                {a.start_date && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{a.start_date}{a.start_time ? ` ${a.start_time.slice(0, 5)}` : ''}</span>}
              </div>
              {isFlightElement(a.element_type) && (
                <AuxPassengersEditor auxBookingId={a.id} initial={a.passengers ?? []} />
              )}
              {isGroundTransportElement(a.element_type) && (
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
  partners:  Record<string, TripPartner>
  mobile:    boolean
  house:     HouseProfile | null
  partyLabel: string | null
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
  const typeColor    = A.gold

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
            <span style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{b.name ?? supplierName ?? 'Booking'}</span>
            <BookingStatusPip status={b.status} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {supplierName && b.name !== supplierName && <span style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{supplierName}</span>}
            {b.start_date && (
              <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                {formatDateShortRange(b.start_date, b.end_date)}{b.nights ? ` \u00b7 ${b.nights}N` : ''}
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
                      {depositPaid && b.deposit_paid_at && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}> \u00b7 paid {formatDateShort(b.deposit_paid_at)}</span>}
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
  element_type:        string
  name:                string
  status:              string
  confirmation_number: string
  accom_hotel_id:      string
  start_date:          string
  end_date:            string
  nights:              string
  currency:            string
  commissionable_rate: string
  total_rate:          string
  taxes_and_fees:      string
  rate_type:           string
  booked_by:           string
  brief_category:      string
  cancellation_policy: string
  inclusions:          string
  notes:               string
}

function emptyBookingDraft(): BookingDraft {
  return {
    element_type: 'Hotel', name: '', status: 'confirmed', confirmation_number: '',
    accom_hotel_id: '', start_date: '', end_date: '', nights: '',
    currency: 'EUR', commissionable_rate: '', total_rate: '', taxes_and_fees: '',
    rate_type: '', booked_by: 'ambience', brief_category: '', cancellation_policy: '',
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
    element_type:        orNull(d.element_type),
    name:                orNull(d.name),
    status:              orNull(d.status),
    confirmation_number: orNull(d.confirmation_number),
    accom_hotel_id:      isHotelElement(d.element_type) ? orNull(d.accom_hotel_id) : null,
    start_date:          orNull(d.start_date),
    end_date:            orNull(d.end_date),
    nights:              numOrNull(d.nights),
    currency:            orNull(d.currency),
    commissionable_rate: numOrNull(d.commissionable_rate),
    total_rate:          numOrNull(d.total_rate),
    taxes_and_fees:      numOrNull(d.taxes_and_fees),
    rate_type:           orNull(d.rate_type),
    booked_by:           orNull(d.booked_by),
    brief_category:      orNull(d.brief_category),
    cancellation_policy: orNull(d.cancellation_policy),
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
  const { success, error } = useAdminToast()

  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setDraft({ ...draft, [k]: v })
  const isHotel = isHotelElement(draft.element_type)

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
          <select style={inputStyle} value={draft.element_type} onChange={e => set('element_type', e.target.value)}>
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
          hotelId={draft.accom_hotel_id}
          onChange={(id, hotel) => setDraft({ ...draft, accom_hotel_id: id, name: draft.name || (hotel?.name ?? '') })}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><label style={labelStyle}>Name</label><input style={inputStyle} value={draft.name} onChange={e => set('name', e.target.value)} placeholder={isHotel ? 'Hotel Goldener Hirsch' : 'Booking name'} /></div>
        <div><label style={labelStyle}>Confirmation #</label><input style={inputStyle} value={draft.confirmation_number} onChange={e => set('confirmation_number', e.target.value)} placeholder='74373105' /></div>
        <div><label style={labelStyle}>Start Date</label><input style={inputStyle} type='date' value={draft.start_date} onChange={e => set('start_date', e.target.value)} /></div>
        <div><label style={labelStyle}>End Date</label><input style={inputStyle} type='date' value={draft.end_date} onChange={e => set('end_date', e.target.value)} /></div>
        <div><label style={labelStyle}>Nights</label><input style={inputStyle} type='number' value={draft.nights} onChange={e => set('nights', e.target.value)} placeholder='3' /></div>
        <div><label style={labelStyle}>Currency</label><input style={inputStyle} value={draft.currency} onChange={e => set('currency', e.target.value)} placeholder='EUR' /></div>
      </div>

      <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Rate Detail</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label style={labelStyle}>Commissionable Rate / night</label><input style={inputStyle} type='number' value={draft.commissionable_rate} onChange={e => set('commissionable_rate', e.target.value)} placeholder='1305.00' /></div>
          <div><label style={labelStyle}>Total Rate / night</label><input style={inputStyle} type='number' value={draft.total_rate} onChange={e => set('total_rate', e.target.value)} placeholder='' /></div>
          <div><label style={labelStyle}>Taxes & Fees %</label><input style={inputStyle} type='number' value={draft.taxes_and_fees} onChange={e => set('taxes_and_fees', e.target.value)} placeholder='' /></div>
          <div><label style={labelStyle}>Rate Type</label><input style={inputStyle} value={draft.rate_type} onChange={e => set('rate_type', e.target.value)} placeholder='Per night, per room' /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><label style={labelStyle}>Booked By</label><input style={inputStyle} value={draft.booked_by} onChange={e => set('booked_by', e.target.value)} placeholder='ambience' /></div>
        <div><label style={labelStyle}>Brief Category</label><input style={inputStyle} value={draft.brief_category} onChange={e => set('brief_category', e.target.value)} placeholder='Accommodation' /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Inclusions</label><input style={inputStyle} value={draft.inclusions} onChange={e => set('inclusions', e.target.value)} placeholder='Breakfast included' /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Cancellation Policy</label><input style={inputStyle} value={draft.cancellation_policy} onChange={e => set('cancellation_policy', e.target.value)} placeholder='Free cancellation until 30 days prior' /></div>
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

// ── TripBlock ─────────────────────────────────────────────────────────────────

function TripBlock({ trip, partners, mobile, expanded, onToggle, house }: {
  trip:     DossierJourney
  partners: Record<string, TripPartner>
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
  const totalCommission = bookings.reduce((s, b) => s + (b.commission_amount ?? 0), 0)
  const totalGross      = bookings.reduce((s, b) => s + (b.commissionable_rate ?? b.price ?? 0) * (b.nights ?? 1), 0)

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${expanded ? A.gold + '40' : A.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 150ms ease' }}>
      <div onClick={onToggle} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>{trip.trip_code}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: tripColor, fontFamily: A.font, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tripStageText}</span>
          {trip.start_date && (
            <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {formatDateShortRange(trip.start_date, trip.end_date)}{trip.duration_nights ? ` \u00b7 ${trip.duration_nights}N` : ''}
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

          {bookings.length === 0
            ? <AdminEmptyState message='No bookings on this trip yet.' />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bookings.map(b => <BookingCard key={b.id} booking={b} partners={partners} mobile={mobile} house={house} partyLabel={trip.brief?.prepared_for ?? null} />)}
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