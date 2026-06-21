/* BriefEditorPage.tsx
 * Dedicated full-page brief editor for a single trip.
 * Route: #admin/trips/{tripId}/brief
 *
 * Last updated: S54 — Tabs section added. Four show_tab_* booleans
 *   (confirmation, programme, brief, contacts) now wired into the admin UI
 *   with inline-save toggles, mirroring the public_view + advisor visibility
 *   pattern. Each toggle gates whether the corresponding tab renders on the
 *   public ImmerseTripPage. persistContactsToggle generalised to persistToggle
 *   to handle both advisor and tab visibility fields.
 * Prior: S50 — Contacts section added. Editable advisor_name,
 *   advisor_email, advisor_phone with inline show_advisor_email +
 *   show_advisor_phone visibility toggles. Each toggle gates whether
 *   the corresponding field renders on the public Contacts tab via
 *   ImmerseTripPage.tsx ContactsTab.
 * Prior: S48 — public_view toggle in Cover section. Controls visibility
 *   of the engagement to public anon clients via the get-engagement-stage
 *   Edge Function. Default false; admin flips on per engagement.
 * Prior: S48 — fetchTripAuxBookings + updateTripAuxBooking wired in.
 *   auxBookings fetched in parallel with dossier. auxDrafts state added.
 *   mergedAux built in handleDownload and passed to handleDownloadBrief.
 *   Design, BriefPreview, BriefAuxEditor — all untouched.
 * Prior: S48 — aux sections grouped by booking_type via auxBookingTypes
 *   registry. BriefAuxEditor. Transport & Transfers section label.
 * Prior: S48 — flights fully editable, booked_by, AuxDraft type, dark editor.
 * Prior: S47 — booked_by_label added to RoomDraft.
 * Prior: S46 — initial ship.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import {
  fetchTripDossierForHouse,
  fetchTripAuxBookings,
  upsertTripBrief,
  updateBookingRoom,
  updateTripAuxBooking,
  fetchEngagementPublicView,
  setEngagementPublicView,
} from '../../queries/queriesAdminTrip'
import type {
  DossierTrip,
  HouseProfile,
  TripBrief,
  TripBriefPatch,
  TripBooking,
  TripAuxBooking,
} from '../../queries/queriesAdminTrip'
import { getAuxTypeMeta, AUX_BOOKING_TYPES, isFlightType, CABIN_CLASSES, SEAT_TYPES, AIRCRAFT_TYPE_GROUPS } from '../../types/typesAuxBookings'
import { AirlinePicker } from './AirlinePicker'
import { useImmerseConfirmationPdf } from '../../hooks/useImmerseConfirmationPdf'
import AssetPicker from './AssetPicker'
import { bookedByLabel } from '../../utils/utilsBooking'
import { supabase } from '../../lib/supabase'
import { AuxPassengersEditor } from './AuxPassengersEditor'
import { BookingRoomsEditor, roomToDraft, type RoomDraft } from './BookingRoomsEditor'
import { WelcomeLettersEditor } from './WelcomeLettersEditor'
import { roomGuestName } from '../../utils/utilsRoomDisplay'

// ── Constants ────────────────────────────────────────────────────────────────

const CREAM   = '#F7F5F0'
const INK     = '#1A1D1A'
const GOLD    = '#C9A84C'
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const CARD_BG = '#F0EDE6'

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

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font,
  letterSpacing: '0.1em', textTransform: 'uppercase' as const,
  marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${A.border}`,
}

const fieldStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text,
  background: 'transparent', border: 'none',
  borderBottom: `1px solid ${A.border}`,
  outline: 'none', width: '100%', padding: '2px 0',
  boxSizing: 'border-box' as const,
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, display: 'block', marginBottom: 2,
}

// ── Date / time helpers ───────────────────────────────────────────────────────

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

async function resolveHouseIdForTrip(tripId: string): Promise<string | null> {
  const { data } = await supabase
    .from('travel_bookings')
    .select('house_id')
    .eq('trip_id', tripId)
    .not('house_id', 'is', null)
    .limit(1)
    .single()
  return data?.house_id ?? null
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AuxDraft = {
  name:                string
  booking_type:        string
  origin:              string
  destination:         string
  start_date:          string
  start_time:          string
  end_date:            string
  end_time:            string
  booked_by:           string
  notes:               string
  // Flight-specific (rendered only when isFlightType(booking_type))
  airline_supplier_id: string
  airline_name:        string
  flight_number:       string
  depart_airport:      string
  arrive_airport:      string
  cabin_class:         string
  seat_numbers:        string
  seat_type:           string
  aircraft_type:       string
}

interface PreviewFields {
  briefTitle:    string
  briefSubtitle: string
  preparedFor:   string
  heroImageSrc:  string
  logoVariant:   string
  trip:          DossierTrip
  house:         HouseProfile | null
  roomImageSrcs: Record<string, string>
  roomDrafts:    Record<string, RoomDraft>
  auxBookings:   TripAuxBooking[]
  auxDrafts:     Record<string, AuxDraft>
}

// ── VisibilityToggle ──────────────────────────────────────────────────────────
// Small inline toggle used in the Contacts section. Matches the public_view
// toggle pattern but at a more compact scale to sit beside a text input.

function VisibilityToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '2px 0', flexShrink: 0,
      }}
    >
      <span style={{
        width: 28, height: 16, borderRadius: 999,
        border: `1px solid ${on ? A.gold : A.border}`,
        background: on ? A.gold : 'transparent',
        position: 'relative', flexShrink: 0,
        transition: 'all 150ms ease',
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: on ? '#0F1110' : A.faint,
          position: 'absolute', top: 2,
          left: on ? 15 : 2,
          transition: 'left 150ms ease',
        }} />
      </span>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', fontFamily: A.font,
        color: on ? A.gold : A.faint,
      }}>
        {on ? 'Shown' : 'Hidden'}
      </span>
    </button>
  )
}

// ── FlightDetailsSubsection ───────────────────────────────────────────────────
// Rendered inside the aux card when booking_type is a flight type
// (Flight or Private Jet / Charter). Provides:
//   - Airline picker (filtered to Commercial Airline + Private Jet / Charter
//     supplier types). Inline supplier creation if airline not yet in registry.
//   - Validated flight_number (uppercase auto-transform, regex hint)
//   - Validated depart/arrive airports (3 or 4 letter IATA/ICAO)
//   - Cabin class dropdown (locked to CABIN_CLASSES)
//   - Seat numbers (free text — formats vary too widely to validate)
//   - Seat type dropdown (locked to SEAT_TYPES including 'Mixed')
//   - Aircraft type grouped dropdown (locked to AIRCRAFT_TYPE_GROUPS)

const FLIGHT_NUMBER_REGEX = /^[A-Z]{2,3}\d{1,4}[A-Z]?$/
const AIRPORT_REGEX       = /^[A-Z]{3,4}$/

function FlightDetailsSubsection({ aux, draft, patch, save, isMobile }: {
  aux:    TripAuxBooking
  draft:  AuxDraft
  patch:  (id: string, aux: TripAuxBooking, field: keyof AuxDraft, value: string) => void
  save:   (id: string, field: keyof AuxDraft, value: string) => Promise<void>
  isMobile: boolean
}) {
  // Validation states for inline indicators (non-blocking)
  const flightNumberValid = !draft.flight_number || FLIGHT_NUMBER_REGEX.test(draft.flight_number)
  const departValid       = !draft.depart_airport || AIRPORT_REGEX.test(draft.depart_airport)
  const arriveValid       = !draft.arrive_airport || AIRPORT_REGEX.test(draft.arrive_airport)

  return (
    <div style={{
      marginTop: 12, paddingTop: 12,
      borderTop: `1px dashed ${A.border}`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: A.gold, fontFamily: A.font,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{'\u2708'}</span>
        <span>Flight Details</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 12px' }}>

        {/* Airline supplier picker — shared with the dossier AuxForm */}
        <div style={{ gridColumn: '1 / -1' }}>
          <AirlinePicker
            supplierId={draft.airline_supplier_id}
            airlineNameFallback={draft.airline_name}
            bookingType={draft.booking_type}
            variant='field'
            onChange={value => {
              patch(aux.id, aux, 'airline_supplier_id', value)
              save(aux.id, 'airline_supplier_id', value)
              // Clear free-text override when a supplier is picked.
              if (value && draft.airline_name) {
                patch(aux.id, aux, 'airline_name', '')
                save(aux.id, 'airline_name', '')
              }
            }}
          />
        </div>

        {/* Flight number */}
        <div>
          <label style={fieldLabelStyle}>Flight Number</label>
          <input
            style={{ ...fieldStyle, textTransform: 'uppercase', borderBottomColor: flightNumberValid ? A.border : '#f87171' }}
            value={draft.flight_number}
            onChange={e => patch(aux.id, aux, 'flight_number', e.target.value.toUpperCase())}
            onBlur={e => save(aux.id, 'flight_number', e.target.value.toUpperCase())}
            placeholder='BA123'
          />
          {!flightNumberValid && (
            <div style={{ fontSize: 9, color: '#f87171', fontFamily: A.font, marginTop: 2 }}>
              Format: 2{'\u2013'}3 letter code + 1{'\u2013'}4 digits (e.g. BA123, EK201)
            </div>
          )}
        </div>

        {/* Aircraft type — grouped dropdown */}
        <div>
          <label style={fieldLabelStyle}>Aircraft Type</label>
          <select
            style={{ ...fieldStyle, cursor: 'pointer' }}
            value={draft.aircraft_type}
            onChange={e => { patch(aux.id, aux, 'aircraft_type', e.target.value); save(aux.id, 'aircraft_type', e.target.value) }}
          >
            <option value=''>{'\u2014 Select aircraft \u2014'}</option>
            {AIRCRAFT_TYPE_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Depart airport */}
        <div>
          <label style={fieldLabelStyle}>Depart Airport</label>
          <input
            style={{ ...fieldStyle, textTransform: 'uppercase', borderBottomColor: departValid ? A.border : '#f87171' }}
            value={draft.depart_airport}
            onChange={e => patch(aux.id, aux, 'depart_airport', e.target.value.toUpperCase())}
            onBlur={e => save(aux.id, 'depart_airport', e.target.value.toUpperCase())}
            placeholder='LAX or KLAX'
            maxLength={4}
          />
          {!departValid && (
            <div style={{ fontSize: 9, color: '#f87171', fontFamily: A.font, marginTop: 2 }}>
              IATA (3) or ICAO (4) letters
            </div>
          )}
        </div>

        {/* Arrive airport */}
        <div>
          <label style={fieldLabelStyle}>Arrive Airport</label>
          <input
            style={{ ...fieldStyle, textTransform: 'uppercase', borderBottomColor: arriveValid ? A.border : '#f87171' }}
            value={draft.arrive_airport}
            onChange={e => patch(aux.id, aux, 'arrive_airport', e.target.value.toUpperCase())}
            onBlur={e => save(aux.id, 'arrive_airport', e.target.value.toUpperCase())}
            placeholder='JFK or KJFK'
            maxLength={4}
          />
          {!arriveValid && (
            <div style={{ fontSize: 9, color: '#f87171', fontFamily: A.font, marginTop: 2 }}>
              IATA (3) or ICAO (4) letters
            </div>
          )}
        </div>

        {/* Cabin class */}
        <div>
          <label style={fieldLabelStyle}>Cabin Class</label>
          <select
            style={{ ...fieldStyle, cursor: 'pointer' }}
            value={draft.cabin_class}
            onChange={e => { patch(aux.id, aux, 'cabin_class', e.target.value); save(aux.id, 'cabin_class', e.target.value) }}
          >
            <option value=''>{'\u2014 Select cabin \u2014'}</option>
            {CABIN_CLASSES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Seat type */}
        <div>
          <label style={fieldLabelStyle}>Seat Type</label>
          <select
            style={{ ...fieldStyle, cursor: 'pointer' }}
            value={draft.seat_type}
            onChange={e => { patch(aux.id, aux, 'seat_type', e.target.value); save(aux.id, 'seat_type', e.target.value) }}
          >
            <option value=''>{'\u2014 Select seat type \u2014'}</option>
            {SEAT_TYPES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Seat numbers */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={fieldLabelStyle}>Seat Numbers</label>
          <input style={fieldStyle} value={draft.seat_numbers}
            onChange={e => patch(aux.id, aux, 'seat_numbers', e.target.value)}
            onBlur={e => save(aux.id, 'seat_numbers', e.target.value)}
            placeholder='12A, 12B, 12C' />
        </div>

      </div>
    </div>
  )
}

// ── BriefAuxEditor ────────────────────────────────────────────────────────────

function BriefAuxEditor({ auxBookings, auxDrafts, onAuxDraftsChange, isMobile }: {
  auxBookings:       TripAuxBooking[]
  auxDrafts:         Record<string, AuxDraft>
  onAuxDraftsChange: (drafts: Record<string, AuxDraft>) => void
  isMobile:          boolean
}) {
  const sorted = [...auxBookings]
    .filter(a => a.brief_show !== false)
    .sort((a, b) => {
      const ma = getAuxTypeMeta(a.booking_type)
      const mb = getAuxTypeMeta(b.booking_type)
      if (ma.sort_order !== mb.sort_order) return ma.sort_order - mb.sort_order
      return a.sort_order - b.sort_order
    })

  const sections: { type: string; label: string; icon: string; items: TripAuxBooking[] }[] = []
  for (const aux of sorted) {
    const type = aux.booking_type ?? 'Other'
    const meta = getAuxTypeMeta(type)
    const last = sections[sections.length - 1]
    if (last && last.type === type) {
      last.items.push(aux)
      continue
    }
    sections.push({ type, label: meta.label, icon: meta.icon, items: [aux] })
  }

  function getDraft(aux: TripAuxBooking): AuxDraft {
    return auxDrafts[aux.id] ?? {
      name:                aux.name                ?? '',
      booking_type:        aux.booking_type        ?? '',
      origin:              aux.origin              ?? '',
      destination:         aux.destination         ?? '',
      start_date:          aux.start_date          ?? '',
      start_time:          aux.start_time?.slice(0, 5) ?? '',
      end_date:            aux.end_date            ?? '',
      end_time:            aux.end_time?.slice(0, 5) ?? '',
      booked_by:           aux.booked_by           ?? '',
      notes:               aux.notes               ?? '',
      airline_supplier_id: aux.airline_supplier_id ?? '',
      airline_name:        aux.airline_name        ?? '',
      flight_number:       aux.flight_number       ?? '',
      depart_airport:      aux.depart_airport      ?? '',
      arrive_airport:      aux.arrive_airport      ?? '',
      cabin_class:         aux.cabin_class         ?? '',
      seat_numbers:        (aux as any).seat_numbers        ?? '',
      seat_type:           aux.seat_type           ?? '',
      aircraft_type:       aux.aircraft_type       ?? '',
    }
  }

  function patch(id: string, aux: TripAuxBooking, field: keyof AuxDraft, value: string) {
    const prev = getDraft(aux)
    onAuxDraftsChange({ ...auxDrafts, [id]: { ...prev, [field]: value } })
  }

  async function save(id: string, field: keyof AuxDraft, value: string) {
    try { await updateTripAuxBooking(id, { [field]: value || null } as any) }
    catch { /* silent */ }
  }

  if (sections.length === 0) return (
    <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
      No aux bookings with brief_show enabled for this trip.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map(section => (
        <div key={section.type}>
          <div style={{ fontSize: 9, fontWeight: 700, color: A.faint, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {section.items.map(aux => {
              const draft = getDraft(aux)
              return (
                <div key={aux.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 12px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Name</label>
                      <input style={fieldStyle} value={draft.name}
                        onChange={e => patch(aux.id, aux, 'name', e.target.value)}
                        onBlur={e => save(aux.id, 'name', e.target.value)}
                        placeholder='Flynas XY 277' />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Type</label>
                      <select
                        style={{ ...fieldStyle, cursor: 'pointer' }}
                        value={draft.booking_type}
                        onChange={e => { patch(aux.id, aux, 'booking_type', e.target.value); save(aux.id, 'booking_type', e.target.value) }}
                      >
                        {AUX_BOOKING_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Origin</label>
                      <input style={fieldStyle} value={draft.origin}
                        onChange={e => patch(aux.id, aux, 'origin', e.target.value)}
                        onBlur={e => save(aux.id, 'origin', e.target.value)}
                        placeholder='RUH' />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Destination</label>
                      <input style={fieldStyle} value={draft.destination}
                        onChange={e => patch(aux.id, aux, 'destination', e.target.value)}
                        onBlur={e => save(aux.id, 'destination', e.target.value)}
                        placeholder='SSH' />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Departure Date</label>
                      <input type='date' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.start_date}
                        onChange={e => patch(aux.id, aux, 'start_date', e.target.value)}
                        onBlur={e => save(aux.id, 'start_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Arrival Date</label>
                      <input type='date' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.end_date}
                        onChange={e => patch(aux.id, aux, 'end_date', e.target.value)}
                        onBlur={e => save(aux.id, 'end_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Departure Time</label>
                      <input type='time' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.start_time}
                        onChange={e => patch(aux.id, aux, 'start_time', e.target.value)}
                        onBlur={e => save(aux.id, 'start_time', e.target.value)} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Arrival Time</label>
                      <input type='time' style={{ ...fieldStyle, colorScheme: 'dark' }} value={draft.end_time}
                        onChange={e => patch(aux.id, aux, 'end_time', e.target.value)}
                        onBlur={e => save(aux.id, 'end_time', e.target.value)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Booked By</label>
                      <input style={fieldStyle} value={draft.booked_by}
                        onChange={e => patch(aux.id, aux, 'booked_by', e.target.value)}
                        onBlur={e => save(aux.id, 'booked_by', e.target.value)}
                        placeholder='Booked by Deron' />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={fieldLabelStyle}>Notes</label>
                      <input style={fieldStyle} value={draft.notes}
                        onChange={e => patch(aux.id, aux, 'notes', e.target.value)}
                        onBlur={e => save(aux.id, 'notes', e.target.value)}
                        placeholder='Any notes...' />
                    </div>
                  </div>

                  {/* S50 — Flight Details subsection — rendered only for flight types */}
                  {isFlightType(draft.booking_type) && (
                    <FlightDetailsSubsection
                      aux={aux}
                      draft={draft}
                      patch={patch}
                      save={save}
                      isMobile={isMobile}
                    />
                  )}

                  {/* S54b — Per-passenger conf + seats. Shared with the dossier editor. */}
                  {isFlightType(draft.booking_type) && (
                    <AuxPassengersEditor auxBookingId={aux.id} initial={aux.passengers ?? []} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── BriefPreview ──────────────────────────────────────────────────────────────

function BriefPreview({ fields }: { fields: PreviewFields }) {
  const { briefTitle, briefSubtitle, preparedFor, heroImageSrc, logoVariant, trip, house, roomImageSrcs, roomDrafts, auxBookings, auxDrafts } = fields

  const title    = briefTitle || trip.destinations.map(d => d.name).join(' & ') || trip.trip_code
  const subtitle = (briefSubtitle || 'TRIP CONFIRMATION BRIEF').toUpperCase()
  const pfor     = preparedFor || house?.display_name || ''
  const dates    = buildDateRange(trip.start_date, trip.end_date)

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
    <div style={{ fontFamily: 'Georgia, serif', color: INK, background: CREAM, minHeight: '100%', padding: '0 0 40px' }}>
      <div style={{ position: 'relative', height: 240, background: CARD_BG, overflow: 'hidden' }}>
        {heroImageSrc && <img src={heroImageSrc} alt='hero' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {logoVariant !== 'unbranded' && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '0.5px solid rgba(200,195,185,0.6)' }}>
            {logoVariant !== 'alfaone' && <img src='/emblem.png' alt='' style={{ width: 36, height: 36, objectFit: 'contain' }} />}
            {logoVariant === 'alfaone'
              ? <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#B49050', letterSpacing: '0.02em' }}>AlfaOne Concierge</span>
              : <img src='/ambience_travel.svg' alt='ambience' style={{ height: 42, objectFit: 'contain' }} />
            }
          </div>
        )}
      </div>

      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ fontSize: 30, fontWeight: 400, color: INK, lineHeight: 1.2, marginBottom: 10, textAlign: 'center' }}>{title}</div>
        <div style={{ height: 1, background: GOLD, marginBottom: 8 }} />
        <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, textAlign: 'center', letterSpacing: '0.12em', marginBottom: 6 }}>{subtitle}</div>
        {pfor && <div style={{ fontSize: 13, fontStyle: 'italic', color: MUTED, textAlign: 'center', marginBottom: 4 }}>Prepared for {pfor}</div>}
        {dates && <div style={{ fontSize: 11, color: FAINT, textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>{dates}</div>}
      </div>

      {accomBookings.length > 0 && (
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ height: 1, background: RULE, marginBottom: 20 }} />
          <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 12 }}>ACCOMMODATION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accomBookings.map(booking => {
              const isAmbience   = (booking.booked_by ?? 'ambience') === 'ambience'
              const bookedByText = bookedByLabel(booking.booked_by)
              const pillColor    = isAmbience ? GOLD : FAINT
              const hotelName    = booking._hotel_name ?? booking.name ?? 'Hotel'
              const dateRange    = buildDateRange(booking.start_date, booking.end_date)
              const headerImg    = booking.brief_image_src ?? booking._hotel_image_src ?? null
              const rooms        = booking._rooms ?? []

              return (
                <div key={booking.id} style={{ background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', minHeight: 90 }}>
                    <div style={{ width: '44%', flexShrink: 0, background: CARD_BG, position: 'relative', overflow: 'hidden' }}>
                      {headerImg && <img src={headerImg} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />}
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, color: INK, marginBottom: 3, lineHeight: 1.3 }}>{hotelName}</div>
                        {dateRange && <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>{dateRange}</div>}
                        {booking.party_composition && <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED, marginTop: 1 }}>{booking.party_composition}</div>}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {rooms.length === 0 && booking.confirmation_number && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${pillColor}`, borderRadius: 4, padding: '2px 8px', marginBottom: 4, background: isAmbience ? '#FAF7F0' : '#F5F5F5' }}>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: pillColor }}>Conf #:  {booking.confirmation_number}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', fontStyle: 'italic', color: FAINT }}>{bookedByText}</div>
                      </div>
                    </div>
                  </div>
                  {rooms.length > 0 && (
                    <div style={{ borderTop: `0.5px solid ${RULE}` }}>
                      {rooms.map((room, ri) => {
                        const d                = roomDrafts[room.id]
                        const roomName         = d?.room_name         ?? room.room_name         ?? null
                        // guest_name is an OVERRIDE field: empty draft string = "no override, use resolved"
                        // hence || (fall through on empty), not ?? — matches BookingRoomsEditor's override model.
                        const guestName        = d?.guest_name || roomGuestName(room) || null
                        const partyComposition = d?.party_composition ?? room.party_composition ?? null
                        const additionalGuests = d?.additional_guests ?? room.additional_guests ?? []
                        const guestParts: string[] = []
                        if (guestName) guestParts.push(guestName)
                        if (additionalGuests.length) guestParts.push(...additionalGuests)
                        if (partyComposition) guestParts.push(partyComposition)
                        const guestLine = guestParts.join(' · ')
                        return (
                          <div key={room.id ?? ri} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderTop: ri > 0 ? `0.5px solid ${RULE}` : 'none', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {roomName && <div style={{ fontSize: 12, color: INK, lineHeight: 1.3 }}>{roomName}</div>}
                              {guestLine && <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED, marginTop: 2 }}>{guestLine}</div>}
                            </div>
                            {room.confirmation_number && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, border: `1px solid ${pillColor}`, borderRadius: 4, padding: '2px 8px', background: isAmbience ? '#FAF7F0' : '#F5F5F5' }}>
                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: pillColor }}>Conf #:  {room.confirmation_number}</span>
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
          </div>
        </div>
      )}

      {auxSections.map(section => (
        <div key={section.type} style={{ padding: '20px 28px 0' }}>
          <div style={{ height: 1, background: RULE, marginBottom: 20 }} />
          <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 12 }}>
            {section.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {section.items.map(aux => {
              const d          = auxDrafts[aux.id]
              const name       = d?.name               || aux.name               || ''
              const origin     = d?.origin             || aux.origin             || ''
              const dest       = d?.destination        || aux.destination        || ''
              const bookedBy   = d?.booked_by?.trim()  || aux.booked_by?.trim()  || null
              const startTime  = d?.start_time || aux.start_time?.slice(0, 5) || null
              const endTime    = d?.end_time   || aux.end_time?.slice(0, 5)   || null
              const startDate  = d?.start_date || aux.start_date              || null

              const isAmbience  = !bookedBy || bookedBy === 'ambience'
              const bookedByTxt = bookedByLabel(bookedBy)
              const pillColor   = isAmbience ? GOLD : FAINT

              const dep = fmtTime(startTime)
              const arr = fmtTime(endTime)
              const timeStr = dep && arr ? `${dep} \u2013 ${arr}` : dep || arr || ''
              const route = [origin, dest].filter(Boolean).join(' \u2192 ')

              return (
                <div key={aux.id} style={{ background: '#fff', border: `0.5px solid ${RULE}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 56 }}>
                  <div style={{ fontSize: 18, color: GOLD, flexShrink: 0, lineHeight: 1, paddingTop: 2 }}>{section.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {name && <div style={{ fontSize: 13, color: INK, marginBottom: 2 }}>{name}</div>}
                    {route && <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: MUTED }}>{route}</div>}
                    {startDate && <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', color: FAINT, marginTop: 1 }}>{fmtDate(startDate)}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {timeStr && <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK }}>{timeStr}</div>}
                    <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', fontStyle: 'italic', color: FAINT, marginTop: 3 }}>{bookedByTxt}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function BriefEditorPage({ tripId }: { tripId: string }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    function onResize() { setWindowWidth(window.innerWidth) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = windowWidth < 768
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const [trip,        setTrip]        = useState<DossierTrip | null>(null)
  const [house,       setHouse]       = useState<HouseProfile | null>(null)
  const [auxBookings, setAuxBookings] = useState<TripAuxBooking[]>([])
  const [loadErr,     setLoadErr]     = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)
  const [pickerOpen,  setPickerOpen]  = useState(false)

  // S48 — engagement public_view toggle
  const [publicView,       setPublicView]       = useState(false)
  const [publicViewSaving, setPublicViewSaving] = useState(false)

  const { pdfReady, pdfDownloading, handleDownloadBrief } = useImmerseConfirmationPdf()

  const [briefTitle,    setBriefTitle]    = useState('')
  const [briefSubtitle, setBriefSubtitle] = useState('')
  const [preparedFor,   setPreparedFor]   = useState('')
  const [logoVariant,   setLogoVariant]   = useState<string>('ambience')
  const [heroImageSrc,  setHeroImageSrc]  = useState('')

  // S50 — Contacts section
  const [advisorName,      setAdvisorName]      = useState('')
  const [advisorEmail,     setAdvisorEmail]     = useState('')
  const [advisorPhone,     setAdvisorPhone]     = useState('')
  const [showAdvisorEmail, setShowAdvisorEmail] = useState(false)
  const [showAdvisorPhone, setShowAdvisorPhone] = useState(false)

  // S54 — Tab visibility toggles. Defaults match DB (all true).
  const [showTabConfirmation, setShowTabConfirmation] = useState(true)
  const [showTabProgramme,    setShowTabProgramme]    = useState(true)
  const [showTabBrief,        setShowTabBrief]        = useState(true)
  const [showTabContacts,     setShowTabContacts]     = useState(true)
  const [showTabWelcome,      setShowTabWelcome]      = useState(false)

  const [roomImageSrcs, setRoomImageSrcs] = useState<Record<string, string>>({})
  const [roomDrafts,    setRoomDrafts]    = useState<Record<string, RoomDraft>>({})
  const [auxDrafts,     setAuxDrafts]     = useState<Record<string, AuxDraft>>({})

  useEffect(() => {
    async function load() {
      const houseId = await resolveHouseIdForTrip(tripId)
      if (!houseId) { setLoadErr('No house linked to this trip. Open the trip from the House tab.'); return }

      const [dossier, auxData, isPublic] = await Promise.all([
        fetchTripDossierForHouse(houseId),
        fetchTripAuxBookings(tripId),
        fetchEngagementPublicView(tripId),
      ])

      const found = dossier.trips.find(t => t.id === tripId)
      if (!found) { setLoadErr('Trip not found in dossier.'); return }
      setTrip(found)
      setHouse(dossier.house)
      setAuxBookings(auxData)
      setPublicView(isPublic)

      const allRooms = found.bookings.flatMap(b => b._rooms)
      setRoomDrafts(Object.fromEntries(allRooms.map(r => [r.id, roomToDraft(r)])))

      const br = found.brief
      if (br) {
        setBriefTitle(br.brief_title ?? '')
        setBriefSubtitle(br.brief_subtitle ?? '')
        setPreparedFor(br.prepared_for ?? dossier.house?.display_name ?? '')
        setHeroImageSrc(br.hero_image_src ?? '')
        setLogoVariant(br.logo_variant ?? 'ambience')
        setAdvisorName(br.advisor_name ?? '')
        setAdvisorEmail(br.advisor_email ?? '')
        setAdvisorPhone(br.advisor_phone ?? '')
        setShowAdvisorEmail((br as any).show_advisor_email ?? false)
        setShowAdvisorPhone((br as any).show_advisor_phone ?? false)
        setShowTabConfirmation(br.show_tab_confirmation ?? true)
        setShowTabProgramme(br.show_tab_programme       ?? true)
        setShowTabBrief(br.show_tab_brief               ?? true)
        setShowTabContacts(br.show_tab_contacts         ?? true)
        setShowTabWelcome((br as any).show_tab_welcome  ?? false)
        return
      }
      setPreparedFor(dossier.house?.display_name ?? '')
      setBriefTitle(found.destinations[0]?.name ?? '')
    }
    load().catch(err => setLoadErr(err instanceof Error ? err.message : 'Load failed'))
  }, [tripId])

  async function handleTogglePublicView() {
    if (!trip) return
    const next = !publicView
    setPublicViewSaving(true)
    setPublicView(next)  // optimistic
    try {
      await setEngagementPublicView(trip.id, next)
    } catch {
      setPublicView(!next)  // revert
    } finally {
      setPublicViewSaving(false)
    }
  }

  // S50 — Inline-save toggle on change. Mirrors public_view pattern.
  // S54 — Generalised to handle tab visibility toggles alongside advisor visibility.
  async function persistToggle(
    field: 'show_advisor_email' | 'show_advisor_phone'
         | 'show_tab_confirmation' | 'show_tab_programme'
         | 'show_tab_brief'        | 'show_tab_contacts'
         | 'show_tab_welcome',
    value: boolean,
  ) {
    if (!trip || !house) return
    try {
      await upsertTripBrief(trip.id, house.id, { [field]: value } as any)
    } catch { /* silent — UI already updated optimistically */ }
  }

  async function handleSave() {
    if (!trip || !house) return
    setSaving(true); setSaveErr(null); setSaved(false)
    try {
      const patch: TripBriefPatch = {
        brief_title:           briefTitle    || null,
        brief_subtitle:        briefSubtitle || null,
        prepared_for:          preparedFor   || null,
        hero_image_src:        heroImageSrc  || null,
        logo_variant:          logoVariant   || null,
        advisor_name:          advisorName   || null,
        advisor_email:         advisorEmail  || null,
        advisor_phone:         advisorPhone  || null,
        show_advisor_email:    showAdvisorEmail,
        show_advisor_phone:    showAdvisorPhone,
        show_tab_confirmation: showTabConfirmation,
        show_tab_programme:    showTabProgramme,
        show_tab_brief:        showTabBrief,
        show_tab_contacts:     showTabContacts,
      }
      const savedBrief = await upsertTripBrief(trip.id, house.id, patch)
      setTrip(prev => prev ? { ...prev, brief: savedBrief } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    if (!trip) return
    let heroData: string | null = null
    if (heroImageSrc) {
      try {
        const res  = await fetch(heroImageSrc)
        const blob = await res.blob()
        heroData = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { heroData = null }
    }

    const mergedTrip = {
      ...trip,
      bookings: trip.bookings.map(b => ({
        ...b,
        _rooms: b._rooms.map(r => {
          const draft  = roomDrafts[r.id]
          const imgSrc = roomImageSrcs[r.id]
          return {
            ...r,
            ...(draft ? {
              guest_name:        draft.guest_name        || r.guest_name,
              room_name:         draft.room_name         || r.room_name,
              party_composition: draft.party_composition || r.party_composition,
              notes:             draft.notes             || r.notes,
              additional_guests: draft.additional_guests.length ? draft.additional_guests : r.additional_guests,
            } : {}),
            ...(imgSrc ? { brief_image_src: imgSrc } : {}),
          }
        }),
      })),
    }

    const mergedAux = auxBookings.map(aux => {
      const d = auxDrafts[aux.id]
      if (!d) return aux
      return {
        ...aux,
        name:                d.name                || aux.name,
        booking_type:        d.booking_type        || aux.booking_type,
        origin:              d.origin              || aux.origin,
        destination:         d.destination         || aux.destination,
        start_date:          d.start_date          || aux.start_date,
        start_time:          d.start_time          || aux.start_time,
        end_date:            d.end_date            || aux.end_date,
        end_time:            d.end_time            || aux.end_time,
        booked_by:           d.booked_by           || aux.booked_by,
        notes:               d.notes               || aux.notes,
        airline_supplier_id: d.airline_supplier_id || aux.airline_supplier_id,
        airline_name:        d.airline_name        || aux.airline_name,
        flight_number:       d.flight_number       || aux.flight_number,
        depart_airport:      d.depart_airport      || aux.depart_airport,
        arrive_airport:      d.arrive_airport      || aux.arrive_airport,
        cabin_class:         d.cabin_class         || aux.cabin_class,
        seat_numbers:        d.seat_numbers        || (aux as any).seat_numbers,
        seat_type:           d.seat_type           || aux.seat_type,
        aircraft_type:       d.aircraft_type       || aux.aircraft_type,
      }
    })

    handleDownloadBrief({
      trip:            mergedTrip,
      brief:           trip.brief ?? ({
        brief_title:    briefTitle    || null,
        brief_subtitle: briefSubtitle || null,
        prepared_for:   preparedFor   || null,
        hero_image_src: heroImageSrc  || null,
        logo_variant:   logoVariant   || null,
        advisor_name:   advisorName   || null,
        advisor_email:  advisorEmail  || null,
        advisor_phone:  advisorPhone  || null,
        show_advisor_email: showAdvisorEmail,
        show_advisor_phone: showAdvisorPhone,
      } as any),
      house,
      destinationName: trip.destinations[0]?.name ?? trip.trip_code,
      heroImageData:   heroData,
      auxBookings:     mergedAux,
    })
  }

  const [previewFields, setPreviewFields] = useState<PreviewFields | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePreview = useCallback(() => {
    if (!trip) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreviewFields({ briefTitle, briefSubtitle, preparedFor, heroImageSrc, logoVariant, trip, house, roomImageSrcs, roomDrafts, auxBookings, auxDrafts })
    }, 300)
  }, [briefTitle, briefSubtitle, preparedFor, heroImageSrc, logoVariant, trip, house, roomImageSrcs, roomDrafts, auxBookings, auxDrafts])

  useEffect(() => { schedulePreview() }, [schedulePreview])

  const btnBase: React.CSSProperties = {
    fontFamily: A.font, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', borderRadius: 6, padding: '6px 14px',
    cursor: 'pointer', transition: 'all 150ms ease', border: 'none',
  }

  if (loadErr) return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#f87171', fontFamily: A.font }}>{loadErr}</div>
      <button onClick={() => navigateAdmin({ product: 'house', tab: 'houses' })} style={{ ...btnBase, background: A.bgCard, color: A.gold, border: `1px solid ${A.border}` }}>← Back to Houses</button>
    </div>
  )

  if (!trip) return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading brief…</div>
    </div>
  )

  const hasVisibleAux = auxBookings.filter(a => a.brief_show !== false).length > 0

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font, color: A.text }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: A.bgCard, borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', height: 50 }}>
        <button onClick={() => navigateAdmin({ product: 'house', tab: 'houses' })} style={{ ...btnBase, background: 'transparent', color: A.muted, border: `1px solid ${A.border}`, padding: '4px 10px', fontSize: 10 }}>← Houses</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>{trip.trip_code}</span>
          <span style={{ fontSize: 10, color: A.muted }}>Confirmation Brief</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveErr && <span style={{ fontSize: 10, color: '#f87171' }}>{saveErr}</span>}
          {saved   && <span style={{ fontSize: 10, color: '#4ade80', fontFamily: A.font }}>Saved</span>}
          <button onClick={handleSave} disabled={saving} style={{ ...btnBase, background: A.bgCard, color: A.text, border: `1px solid ${A.border}`, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
          <button onClick={handleDownload} disabled={!pdfReady || pdfDownloading} style={{ ...btnBase, background: A.gold, color: '#0F1110', opacity: pdfReady && !pdfDownloading ? 1 : 0.5, cursor: pdfReady && !pdfDownloading ? 'pointer' : 'not-allowed' }}>
            {pdfDownloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {isMobile && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${A.border}`, background: A.bgCard }}>
          {(['edit', 'preview'] as const).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)} style={{
              flex: 1, fontFamily: A.font, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              padding: '10px 0', border: 'none', cursor: 'pointer',
              background: mobileTab === tab ? A.bg : A.bgCard,
              color: mobileTab === tab ? A.gold : A.muted,
              borderBottom: mobileTab === tab ? `2px solid ${A.gold}` : `2px solid transparent`,
              transition: 'all 120ms ease',
            }}>
              {tab === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 50px)' }}>

        <div style={{
          width: isMobile ? '100%' : '40%',
          flexShrink: 0,
          borderRight: isMobile ? 'none' : `1px solid ${A.border}`,
          overflowY: 'auto',
          background: A.bg,
          padding: isMobile ? 16 : 24,
          display: isMobile && mobileTab !== 'edit' ? 'none' : 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          <section>
            <div style={sectionHeadStyle}>Cover</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1fr', gap: 10 }}>
                <Field label='Client-Facing Title'>
                  <input style={inputStyle} value={briefTitle} onChange={e => setBriefTitle(e.target.value)} placeholder={trip.destinations.map(d => d.name).join(' & ') || 'e.g. Maldives Family Escape'} />
                </Field>
                <Field label='Subtitle'>
                  <input style={inputStyle} value={briefSubtitle} onChange={e => setBriefSubtitle(e.target.value)} placeholder='Trip Confirmation Brief' />
                </Field>
              </div>
              <Field label='Logo'>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['ambience', 'alfaone', 'unbranded'] as const).map(v => (
                    <button key={v} onClick={() => setLogoVariant(v)} style={{
                      fontFamily: A.font, fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.04em', textTransform: 'capitalize' as const,
                      border: `1px solid ${logoVariant === v ? A.gold : A.border}`,
                      borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                      background: logoVariant === v ? `${A.gold}18` : 'transparent',
                      color: logoVariant === v ? A.gold : A.faint,
                      transition: 'all 120ms ease',
                    }}>
                      {v === 'ambience' ? 'ambience' : v === 'alfaone' ? 'AlfaOne' : 'Unbranded'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label='Prepared For'>
                <input style={inputStyle} value={preparedFor} onChange={e => setPreparedFor(e.target.value)} placeholder={house?.display_name ?? ''} />
              </Field>
              <Field label='Public View'>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={handleTogglePublicView}
                    disabled={publicViewSaving}
                    style={{
                      width: 38, height: 20, borderRadius: 999,
                      border: `1px solid ${publicView ? A.gold : A.border}`,
                      background: publicView ? A.gold : 'transparent',
                      cursor: publicViewSaving ? 'wait' : 'pointer',
                      position: 'relative', flexShrink: 0,
                      transition: 'all 150ms ease', padding: 0,
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: publicView ? '#0F1110' : A.faint,
                      position: 'absolute', top: 2,
                      left: publicView ? 20 : 2,
                      transition: 'left 150ms ease',
                    }} />
                  </button>
                  <div style={{ flex: 1, fontSize: 10, color: publicView ? A.gold : A.faint, fontFamily: A.font, letterSpacing: '0.04em' }}>
                    {publicView ? 'Client URL is live' : 'Hidden — client URL returns not found'}
                  </div>
                </div>
              </Field>
              <Field label='Hero Image'>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {heroImageSrc ? (
                    <div style={{ width: 80, height: 52, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: `1px solid ${A.border}` }}>
                      <img src={heroImageSrc} alt='hero' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: 80, height: 52, borderRadius: 6, background: A.bgCard, border: `1px solid ${A.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>No image</span>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <button onClick={() => setPickerOpen(true)} style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', textAlign: 'left' as const }}>
                      {heroImageSrc ? 'Change Image' : 'Select from Library'}
                    </button>
                    {heroImageSrc && (
                      <button onClick={() => setHeroImageSrc('')} style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}>Remove</button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </section>

          {/* S54 — Tabs section. Per-trip control of which tabs render on the
              public ImmerseTripPage. All default to true (visible). */}
          <section>
            <div style={sectionHeadStyle}>Tabs</div>
            <p style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>
              Controls which tabs are visible on the public trip page. Hide any tab that's not yet ready or not relevant for this trip.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'welcome',      label: 'Welcome Letter', value: showTabWelcome,      setter: setShowTabWelcome,      field: 'show_tab_welcome'      as const },
                { key: 'confirmation', label: 'Confirmation', value: showTabConfirmation, setter: setShowTabConfirmation, field: 'show_tab_confirmation' as const },
                { key: 'programme',    label: 'Programme',    value: showTabProgramme,    setter: setShowTabProgramme,    field: 'show_tab_programme'    as const },
                { key: 'brief',        label: 'Brief',        value: showTabBrief,        setter: setShowTabBrief,        field: 'show_tab_brief'        as const },
                { key: 'contacts',     label: 'Contacts',     value: showTabContacts,     setter: setShowTabContacts,     field: 'show_tab_contacts'     as const },
              ]).map(t => (
                <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>{t.label}</label>
                  <VisibilityToggle
                    on={t.value}
                    onChange={v => { t.setter(v); persistToggle(t.field, v) }}
                    label={`Show ${t.label} tab on the public trip page`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* S50 — Contacts section. advisor_* fields with inline visibility toggles. */}
          <section>
            <div style={sectionHeadStyle}>Contacts</div>
            <p style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>
              Travel advisor details shown on the public Contacts tab. Each field can be hidden independently — the name remains visible but email and phone are gated.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label='Advisor Name'>
                <input
                  style={inputStyle}
                  value={advisorName}
                  onChange={e => setAdvisorName(e.target.value)}
                  placeholder='Deron'
                />
              </Field>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <label style={labelStyle}>Advisor Email</label>
                  <VisibilityToggle
                    on={showAdvisorEmail}
                    onChange={v => { setShowAdvisorEmail(v); persistToggle('show_advisor_email', v) }}
                    label='Show advisor email on Contacts tab'
                  />
                </div>
                <input
                  style={inputStyle}
                  type='email'
                  value={advisorEmail}
                  onChange={e => setAdvisorEmail(e.target.value)}
                  placeholder='advisor@ambience.travel'
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <label style={labelStyle}>Advisor Phone</label>
                  <VisibilityToggle
                    on={showAdvisorPhone}
                    onChange={v => { setShowAdvisorPhone(v); persistToggle('show_advisor_phone', v) }}
                    label='Show advisor phone on Contacts tab'
                  />
                </div>
                <input
                  style={inputStyle}
                  type='tel'
                  value={advisorPhone}
                  onChange={e => setAdvisorPhone(e.target.value)}
                  placeholder='+1 555 0100'
                />
              </div>
            </div>
          </section>

          <section>
            <div style={sectionHeadStyle}>Accommodation</div>
            {trip.bookings.every(b => b._rooms.length === 0) ? (
              <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No rooms seeded yet. Add rooms via the booking card in the House tab.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {trip.bookings.filter(b => b._rooms.length > 0).map(b => (
                  <div key={b.id}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.muted, fontFamily: A.font, marginBottom: 8 }}>
                      {b._hotel_name ?? b.name ?? 'Hotel'}
                    </div>
                    <BookingRoomsEditor
                      booking={b}
                      partyLabel={preparedFor || house?.display_name || null}
                      imagePresetPath={trip.destinations[0]?.storage_path ? `${trip.destinations[0].storage_path}/accom` : undefined}
                      roomDrafts={roomDrafts}
                      onRoomDraftsChange={setRoomDrafts}
                      roomImageSrcs={roomImageSrcs}
                      onImageSrcsChange={setRoomImageSrcs}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div style={sectionHeadStyle}>Welcome Letters</div>
            <p style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>
              A personal arrival letter per room guest, per accommodation. Download all as one PDF for the hotel to print.
            </p>
            <WelcomeLettersEditor trip={trip} />
          </section>

          {hasVisibleAux && (
            <section>
              <div style={sectionHeadStyle}>Transport & Transfers</div>
              <BriefAuxEditor
                auxBookings={auxBookings}
                auxDrafts={auxDrafts}
                onAuxDraftsChange={setAuxDrafts}
                isMobile={isMobile}
              />
            </section>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#E8E4DC', display: isMobile && mobileTab !== 'preview' ? 'none' : 'block' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${RULE}`, background: '#DDD9D1' }}>
            <span style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live Preview</span>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ maxWidth: 560, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: 4, overflow: 'hidden' }}>
              {previewFields && <BriefPreview fields={previewFields} />}
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <AssetPicker
          onClose={() => setPickerOpen(false)}
          presetPath={trip.destinations[0]?.storage_path ?? undefined}
          onSelected={async url => {
            setHeroImageSrc(url)
            setPickerOpen(false)
            if (trip && house) {
              try {
                const savedBrief = await upsertTripBrief(trip.id, house.id, {
                  brief_title:    briefTitle    || null,
                  brief_subtitle: briefSubtitle || null,
                  prepared_for:   preparedFor   || null,
                  hero_image_src: url,
                  logo_variant:   logoVariant   || null,
                })
                setTrip(prev => prev ? { ...prev, brief: savedBrief } : prev)
              } catch { /* silent */ }
            }
          }}
        />
      )}
    </div>
  )
}