/* BriefEditorPage.tsx
 * Dedicated full-page brief editor for a single trip.
 * Route: #admin/trips/{tripId}/brief
 *
 * Layout:
 *   - Cream background (#F7F5F0) — matches PDF aesthetic, not dark admin chrome
 *   - Top bar: back button (→ #admin/house) + trip code + Save + Download
 *   - Left panel (40%): section-by-section editor — Cover, Snapshot, Journey,
 *     Contacts, Notes, Rooms, Footer
 *   - Right panel (60%): live HTML preview, debounced 300ms, mirrors PDF layout
 *
 * Data: fetches dossier for the trip's house via fetchTripDossierForHouse.
 *   Uses trip.id to locate the specific trip within the result.
 *   Falls back gracefully if no house is linked to the trip.
 *
 * Entry point: TripActionPanel "Edit Brief" button in TripDossierSection.
 * Back button: navigates to #admin/house (HouseTab Trips section).
 *
 * Save: upsertTripBrief + updateBookingBriefFields for all bookings.
 * Download: exportConfirmationBriefPdf — uses preview state, hero pre-loaded.
 *
 * Last updated: S46 — initial ship.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { A } from '../../lib/adminTokens'
import { navigateAdmin } from '../../lib/adminPath'
import {
  fetchTripDossierForHouse,
  upsertTripBrief,
  updateBookingBriefFields,
} from '../../lib/adminTripQueries'
import type {
  DossierTrip,
  HouseProfile,
  TripBrief,
  TripBriefPatch,
  JourneyStep,
  TripBooking,
} from '../../lib/adminTripQueries'
import { useBriefDownload } from '../../lib/useBriefDownload'
import AssetPicker from './AssetPicker'
import { supabase } from '../../lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const CREAM   = '#F7F5F0'
const INK     = '#1A1D1A'
const GOLD    = '#B49050'
const MUTED   = '#787060'
const FAINT   = '#B4AFA5'
const RULE    = '#DCDBD5'
const CARD_BG = '#F0EDE6'

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily:   A.font,
  fontSize:     11,
  color:        A.text,
  background:   A.bg,
  border:       `1px solid ${A.border}`,
  borderRadius: 6,
  padding:      '5px 8px',
  width:        '100%',
  boxSizing:    'border-box' as const,
  outline:      'none',
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

const sectionHeadStyle: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    700,
  color:         A.muted,
  fontFamily:    A.font,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  marginBottom:  10,
  paddingBottom: 6,
  borderBottom:  `1px solid ${A.border}`,
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  if (!end) return fmtDate(start)
  const s = new Date(start.slice(0, 10) + 'T00:00:00')
  const e = new Date(end.slice(0, 10) + 'T00:00:00')
  const sm = s.toLocaleDateString('en-US', { month: 'long' })
  const em = e.toLocaleDateString('en-US', { month: 'long' })
  if (sm === em && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}\u2013${e.getDate()} ${em} ${e.getFullYear()}`
  }
  return `${fmtDate(start)}\u2013${fmtDate(end)}`
}

// ── Resolve trip's house_id ───────────────────────────────────────────────────
// travel_bookings.house_id is the join anchor per S45 standing rules.

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

// ── Preview component ─────────────────────────────────────────────────────────

interface PreviewFields {
  briefTitle:    string
  briefSubtitle: string
  preparedFor:   string
  snapDest:      string
  snapDates:     string
  snapGuests:    string
  snapStatus:    string
  advisorName:   string
  advisorEmail:  string
  advisorPhone:  string
  hotelNote:     string
  footerTagline: string
  heroImageSrc:  string
  notesRaw:      string
  stepsRaw:      string
  trip:          DossierTrip
  house:         HouseProfile | null
}

function BriefPreview({ fields }: { fields: PreviewFields }) {
  const {
    briefTitle, briefSubtitle, preparedFor, snapDest, snapDates, snapGuests,
    snapStatus, advisorName, advisorEmail, advisorPhone, hotelNote,
    footerTagline, heroImageSrc, notesRaw, stepsRaw, trip, house,
  } = fields

  const title     = briefTitle || trip.destinations.map(d => d.name).join(' & ') || trip.trip_code
  const subtitle  = briefSubtitle || 'TRIP CONFIRMATION BRIEF'
  const pfor      = preparedFor || house?.display_name || ''
  const dates     = snapDates || buildDateRange(trip.start_date, trip.end_date)
  const dest      = snapDest  || trip.destinations[0]?.name || ''
  const guests    = snapGuests || `${trip.guest_count_adults ?? 0} Adults`
  const status    = snapStatus || 'Confirmed'
  const footer    = footerTagline || 'PRIVATE TRAVEL DESIGN  \u00b7  TAILORED SUPPORT  \u00b7  SEAMLESS EXECUTION'
  const notes     = notesRaw.split('\n').map(s => s.trim()).filter(Boolean)
  const steps     = stepsRaw.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const [icon, label, ...rest] = line.split('|')
    return { icon: icon?.trim() ?? '', label: label?.trim() ?? '', detail: rest.join('|').trim() }
  }).filter(s => s.label)

  const snaps = [
    { label: 'DESTINATION', value: dest },
    { label: 'DATES',       value: dates },
    { label: 'GUESTS',      value: guests },
    { label: 'STATUS',      value: status },
  ]

  const allRooms: { room: TripBooking['_rooms'][number]; booking: TripBooking }[] = []
  for (const b of trip.bookings.filter(bk => bk.brief_show !== false)) {
    if (b._rooms.length > 0) {
      for (const r of b._rooms) allRooms.push({ room: r, booking: b })
    } else {
      allRooms.push({
        room: {
          id: b.id, booking_id: b.id,
          room_name: b.name, confirmation_number: b.confirmation_number,
          guest_name: house?.display_name ?? null,
          party_composition: b.party_composition, notes: b.inclusions ?? null,
          nights: b.nights, rate: b.commissionable_rate, tax_pct: b.taxes_and_fees,
          total: null, brief_image_src: b.brief_image_src,
          sort_order: b.sort_order ?? 0, created_at: b.created_at ?? '', updated_at: b.updated_at ?? '',
        },
        booking: b,
      })
    }
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: INK, background: CREAM, minHeight: '100%', padding: '0 0 40px' }}>

      {/* Hero */}
      <div style={{ position: 'relative', height: 220, background: CARD_BG, overflow: 'hidden' }}>
        {heroImageSrc && (
          <img
            src={heroImageSrc}
            alt='hero'
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: `linear-gradient(to bottom, transparent, ${CREAM})`,
        }} />
        {/* Frosted logo card */}
        <div style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(250,247,242,0.85)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: CARD_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: GOLD }}>✦</span>
          </div>
          <span style={{ fontSize: 11, fontFamily: A.font, fontWeight: 700, color: INK, letterSpacing: '0.08em' }}>ambience</span>
        </div>
      </div>

      {/* Title block */}
      <div style={{ padding: '20px 28px 0' }}>
        <div style={{ fontSize: 28, fontWeight: 400, color: INK, lineHeight: 1.2, marginBottom: 6 }}>{title}</div>

        {/* Gold rules + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 1, background: GOLD }} />
          <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
            {subtitle.toUpperCase()}
          </div>
          <div style={{ flex: 1, height: 1, background: GOLD }} />
        </div>

        {pfor && (
          <div style={{ fontSize: 12, fontStyle: 'italic', color: MUTED, textAlign: 'center', marginBottom: 4 }}>
            Prepared for {pfor}
          </div>
        )}
        <div style={{ fontSize: 11, color: FAINT, textAlign: 'center', fontFamily: A.font, marginBottom: 16 }}>{dates}</div>

        <div style={{ height: 1, background: RULE, marginBottom: 16 }} />

        {/* Snapshot pills */}
        <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, textAlign: 'center', letterSpacing: '0.1em', marginBottom: 10 }}>TRIP SNAPSHOT</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
          {snaps.map(s => (
            <div key={s.label} style={{ background: '#fff', border: `1px solid ${RULE}`, borderRadius: 6, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 10, fontFamily: A.font, color: INK }}>{s.value || '--'}</div>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: RULE, marginBottom: 16 }} />

        {/* Journey steps */}
        {steps.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 8 }}>JOURNEY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: CARD_BG, border: `1px solid ${RULE}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, color: GOLD, fontFamily: A.font }}>{s.icon.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <span style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.1em' }}>{s.label}</span>
                    {s.detail && <span style={{ fontSize: 10, color: MUTED, fontFamily: A.font }}> &middot; {s.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: RULE, marginBottom: 16 }} />
          </>
        )}

        {/* Contacts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.08em', marginBottom: 6 }}>PRIMARY CONTACTS</div>
            {advisorName && <div style={{ fontSize: 11, fontFamily: A.font, fontWeight: 700, color: INK, marginBottom: 2 }}>{advisorName}</div>}
            {advisorEmail && <div style={{ fontSize: 10, fontFamily: A.font, color: MUTED }}>{advisorEmail}</div>}
            {advisorPhone && <div style={{ fontSize: 10, fontFamily: A.font, color: MUTED }}>{advisorPhone}</div>}
            {!advisorName && <div style={{ fontSize: 10, fontFamily: A.font, color: FAINT, fontStyle: 'italic' }}>Not set</div>}
          </div>
          <div>
            <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.08em', marginBottom: 6 }}>HOTEL CONTACT</div>
            <div style={{ fontSize: 10, fontFamily: A.font, color: MUTED, fontStyle: 'italic' }}>{hotelNote || 'Shared closer to arrival'}</div>
          </div>
        </div>

        <div style={{ height: 1, background: RULE, marginBottom: 16 }} />

        {/* Important notes */}
        {notes.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 8 }}>IMPORTANT NOTES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {notes.map((n, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: MUTED, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ fontSize: 10, fontFamily: A.font, color: MUTED }}>{n}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: RULE, marginBottom: 16 }} />
          </>
        )}

        {/* Room cards */}
        {allRooms.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: GOLD, letterSpacing: '0.1em', marginBottom: 10 }}>CONFIRMED ARRANGEMENTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {allRooms.map(({ room, booking }, i) => (
                <div key={room.id ?? i} style={{ background: '#fff', border: `1px solid ${RULE}`, borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
                  {/* Image area */}
                  <div style={{ width: 90, flexShrink: 0, background: CARD_BG, position: 'relative', overflow: 'hidden' }}>
                    {room.brief_image_src && (
                      <img src={room.brief_image_src} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                    )}
                    {!room.brief_image_src && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 72 }}>
                        <span style={{ fontSize: 18, color: FAINT, fontFamily: A.font }}>{(room.room_name ?? room.guest_name ?? '?').slice(0, 1).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, padding: '10px 12px' }}>
                    {room.confirmation_number && (
                      <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: GOLD, marginBottom: 2 }}>#{room.confirmation_number}</div>
                    )}
                    {room.guest_name && (
                      <div style={{ fontSize: 13, color: INK, marginBottom: 2 }}>{room.guest_name}</div>
                    )}
                    {room.party_composition && (
                      <div style={{ fontSize: 10, fontFamily: A.font, color: MUTED, marginBottom: 2 }}>{room.party_composition}</div>
                    )}
                    {room.room_name && (
                      <div style={{ fontSize: 10, fontFamily: A.font, fontStyle: 'italic', color: FAINT }}>{room.room_name}</div>
                    )}
                  </div>
                  {/* Booked-by pill */}
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      fontSize: 8, fontFamily: A.font, fontWeight: 700,
                      color: booking.booked_by === 'ambience' ? GOLD : FAINT,
                      border: `1px solid ${booking.booked_by === 'ambience' ? GOLD : FAINT}`,
                      borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                    }}>
                      {booking.booked_by === 'ambience' ? 'BOOKED BY AMBIENCE' : 'SELF-BOOKED'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ height: 1, background: RULE, marginBottom: 10 }} />
        <div style={{ fontSize: 9, fontFamily: A.font, color: FAINT, textAlign: 'center', letterSpacing: '0.06em' }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

// ── Editor panel sections ─────────────────────────────────────────────────────

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
  const [trip,        setTrip]        = useState<DossierTrip | null>(null)
  const [house,       setHouse]       = useState<HouseProfile | null>(null)
  const [loadErr,     setLoadErr]     = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)
  const [pickerOpen,  setPickerOpen]  = useState(false)

  const { pdfReady, pdfDownloading, handleDownloadBrief } = useBriefDownload()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [briefTitle,    setBriefTitle]    = useState('')
  const [briefSubtitle, setBriefSubtitle] = useState('')
  const [preparedFor,   setPreparedFor]   = useState('')
  const [snapDest,      setSnapDest]      = useState('')
  const [snapDates,     setSnapDates]     = useState('')
  const [snapGuests,    setSnapGuests]    = useState('')
  const [snapStatus,    setSnapStatus]    = useState('Confirmed')
  const [advisorName,   setAdvisorName]   = useState('')
  const [advisorEmail,  setAdvisorEmail]  = useState('')
  const [advisorPhone,  setAdvisorPhone]  = useState('')
  const [hotelNote,     setHotelNote]     = useState('Shared closer to arrival')
  const [footerTagline, setFooterTagline] = useState('')
  const [heroImageSrc,  setHeroImageSrc]  = useState('')
  const [notesRaw,      setNotesRaw]      = useState('')
  const [stepsRaw,      setStepsRaw]      = useState('')

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const houseId = await resolveHouseIdForTrip(tripId)
      if (!houseId) {
        setLoadErr('No house linked to this trip. Open the trip from the House tab.')
        return
      }
      const dossier = await fetchTripDossierForHouse(houseId)
      const found   = dossier.trips.find(t => t.id === tripId)
      if (!found) {
        setLoadErr('Trip not found in dossier.')
        return
      }
      setTrip(found)
      setHouse(dossier.house)

      const br = found.brief
      if (br) {
        setBriefTitle(br.brief_title ?? '')
        setBriefSubtitle(br.brief_subtitle ?? '')
        setPreparedFor(br.prepared_for ?? dossier.house?.display_name ?? '')
        setSnapDest(br.snapshot_destination ?? '')
        setSnapDates(br.snapshot_dates ?? buildDateRange(found.start_date, found.end_date))
        setSnapGuests(br.snapshot_guests ?? '')
        setSnapStatus(br.snapshot_status ?? 'Confirmed')
        setAdvisorName(br.advisor_name ?? '')
        setAdvisorEmail(br.advisor_email ?? '')
        setAdvisorPhone(br.advisor_phone ?? '')
        setHotelNote(br.hotel_contact_note ?? 'Shared closer to arrival')
        setFooterTagline(br.footer_tagline ?? '')
        setHeroImageSrc(br.hero_image_src ?? '')
        setNotesRaw((br.important_notes ?? []).join('\n'))
        setStepsRaw((br.journey_steps ?? []).map((s: JourneyStep) => `${s.icon}|${s.label}|${s.detail}`).join('\n'))
        return
      }
      setPreparedFor(dossier.house?.display_name ?? '')
      setSnapDates(buildDateRange(found.start_date, found.end_date))
    }
    load().catch(err => setLoadErr(err instanceof Error ? err.message : 'Load failed'))
  }, [tripId])

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!trip || !house) return
    setSaving(true); setSaveErr(null); setSaved(false)
    try {
      const notes: string[] = notesRaw.split('\n').map(s => s.trim()).filter(Boolean)
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
        hero_image_src:       heroImageSrc    || null,
        important_notes:      notes,
        journey_steps:        steps,
      }
      const saved = await upsertTripBrief(trip.id, house.id, patch)
      setTrip(prev => prev ? { ...prev, brief: saved } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────────
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
    const briefSnapshot: TripBriefPatch & { id?: string; trip_id?: string; created_at?: string; updated_at?: string } = {
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
      hero_image_src:       heroImageSrc    || null,
      important_notes:      notesRaw.split('\n').map(s => s.trim()).filter(Boolean),
      journey_steps:        stepsRaw.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
        const [icon, label, ...rest] = line.split('|')
        return { icon: icon?.trim() ?? 'anchor', label: label?.trim() ?? '', detail: rest.join('|').trim() }
      }),
    }
    handleDownloadBrief({
      trip,
      brief:           trip.brief ?? (briefSnapshot as any),
      house,
      destinationName: trip.destinations[0]?.name ?? trip.trip_code,
      heroImageData:   heroData,
    })
  }

  // ── Preview fields (debounced) ────────────────────────────────────────────────
  const [previewFields, setPreviewFields] = useState<PreviewFields | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePreview = useCallback(() => {
    if (!trip) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreviewFields({
        briefTitle, briefSubtitle, preparedFor, snapDest, snapDates,
        snapGuests, snapStatus, advisorName, advisorEmail, advisorPhone,
        hotelNote, footerTagline, heroImageSrc, notesRaw, stepsRaw,
        trip, house,
      })
    }, 300)
  }, [
    briefTitle, briefSubtitle, preparedFor, snapDest, snapDates,
    snapGuests, snapStatus, advisorName, advisorEmail, advisorPhone,
    hotelNote, footerTagline, heroImageSrc, notesRaw, stepsRaw,
    trip, house,
  ])

  useEffect(() => { schedulePreview() }, [schedulePreview])

  // ── Styles ────────────────────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    fontFamily:    A.font,
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderRadius:  6,
    padding:       '6px 14px',
    cursor:        'pointer',
    transition:    'all 150ms ease',
    border:        'none',
  }

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loadErr) {
    return (
      <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#f87171', fontFamily: A.font }}>{loadErr}</div>
        <button onClick={() => navigateAdmin({ product: 'house', tab: 'households' })} style={{ ...btnBase, background: A.bgCard, color: A.gold, border: `1px solid ${A.border}` }}>
          ← Back to Houses
        </button>
      </div>
    )
  }

  if (!trip) {
    return (
      <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading brief…</div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: A.font, color: INK }}>

      {/* Top bar */}
      <div style={{
        position:     'sticky',
        top:          0,
        zIndex:       100,
        background:   '#EDE9E2',
        borderBottom: `1px solid ${RULE}`,
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '0 24px',
        height:       50,
      }}>
        <button
          onClick={() => navigateAdmin({ product: 'house', tab: 'households' })}
          style={{ ...btnBase, background: 'transparent', color: MUTED, border: `1px solid ${RULE}`, padding: '4px 10px', fontSize: 10 }}
        >
          ← Houses
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: INK, letterSpacing: '0.04em' }}>{trip.trip_code}</span>
          <span style={{ fontSize: 10, color: MUTED }}>Brief Editor</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveErr && <span style={{ fontSize: 10, color: '#f87171' }}>{saveErr}</span>}
          {saved   && <span style={{ fontSize: 10, color: '#4ade80', fontFamily: A.font }}>Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...btnBase, background: INK, color: '#F7F5F0', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Brief'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!pdfReady || pdfDownloading}
            style={{ ...btnBase, background: GOLD, color: '#fff', opacity: pdfReady && !pdfDownloading ? 1 : 0.5, cursor: pdfReady && !pdfDownloading ? 'pointer' : 'not-allowed' }}
          >
            {pdfDownloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 50px)' }}>

        {/* ── Left: editor panel (40%) ──────────────────────────────────────── */}
        <div style={{
          width:      '40%',
          flexShrink: 0,
          borderRight: `1px solid ${RULE}`,
          overflowY:  'auto',
          background: '#EDE9E2',
          padding:    24,
          display:    'flex',
          flexDirection: 'column',
          gap:        24,
        }}>

          {/* Cover */}
          <section>
            <div style={sectionHeadStyle}>Cover</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label='Trip Title'>
                  <input
                    style={inputStyle}
                    value={briefTitle}
                    onChange={e => setBriefTitle(e.target.value)}
                    placeholder={trip.destinations.map(d => d.name).join(' & ') || trip.trip_code}
                  />
                </Field>
                <Field label='Subtitle'>
                  <input
                    style={inputStyle}
                    value={briefSubtitle}
                    onChange={e => setBriefSubtitle(e.target.value)}
                    placeholder='Trip Confirmation Brief'
                  />
                </Field>
              </div>
              <Field label='Prepared For'>
                <input
                  style={inputStyle}
                  value={preparedFor}
                  onChange={e => setPreparedFor(e.target.value)}
                  placeholder={house?.display_name ?? ''}
                />
              </Field>
              <Field label='Hero Image'>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {heroImageSrc ? (
                    <div style={{ width: 80, height: 52, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: `1px solid ${A.border}` }}>
                      <img src={heroImageSrc} alt='hero' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: 80, height: 52, borderRadius: 6, background: A.bg, border: `1px solid ${A.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>No image</span>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <button
                      onClick={() => setPickerOpen(true)}
                      style={{ fontFamily: A.font, fontSize: 11, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', textAlign: 'left' as const }}
                    >
                      {heroImageSrc ? 'Change Image' : 'Select from Library'}
                    </button>
                    {heroImageSrc && (
                      <button
                        onClick={() => setHeroImageSrc('')}
                        style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: 0 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </section>

          {/* Snapshot */}
          <section>
            <div style={sectionHeadStyle}>Snapshot Pills</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label='Destination'>
                <input style={inputStyle} value={snapDest} onChange={e => setSnapDest(e.target.value)} placeholder={trip.destinations[0]?.name ?? ''} />
              </Field>
              <Field label='Dates'>
                <input style={inputStyle} value={snapDates} onChange={e => setSnapDates(e.target.value)} />
              </Field>
              <Field label='Guests'>
                <input style={inputStyle} value={snapGuests} onChange={e => setSnapGuests(e.target.value)} placeholder={`${trip.guest_count_adults ?? 0} Adults`} />
              </Field>
              <Field label='Status'>
                <input style={inputStyle} value={snapStatus} onChange={e => setSnapStatus(e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Journey */}
          <section>
            <div style={sectionHeadStyle}>Journey Steps</div>
            <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginBottom: 6 }}>
              One per line: <span style={{ color: A.gold, fontFamily: 'DM Mono, monospace' }}>icon|LABEL|detail</span>
              {' '}&middot; Icons: flight, car, bed, dining, anchor, yacht, experience, departure, transfer, wellness
            </div>
            <textarea
              style={{ ...inputStyle, height: 88, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 10 }}
              value={stepsRaw}
              onChange={e => setStepsRaw(e.target.value)}
              placeholder={'flight|ARRIVAL|in Nice\ncar|TRANSFER|to St. Tropez\nbed|7 NIGHTS|Cheval Blanc'}
            />
          </section>

          {/* Contacts */}
          <section>
            <div style={sectionHeadStyle}>Contacts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label='Advisor Name'>
                <input style={inputStyle} value={advisorName} onChange={e => setAdvisorName(e.target.value)} />
              </Field>
              <Field label='Advisor Email'>
                <input style={inputStyle} value={advisorEmail} onChange={e => setAdvisorEmail(e.target.value)} />
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label='Advisor Phone'>
                  <input style={inputStyle} value={advisorPhone} onChange={e => setAdvisorPhone(e.target.value)} />
                </Field>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label='Hotel Contact Note'>
                  <input style={inputStyle} value={hotelNote} onChange={e => setHotelNote(e.target.value)} />
                </Field>
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <div style={sectionHeadStyle}>Important Notes</div>
            <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginBottom: 6 }}>One note per line</div>
            <textarea
              style={{ ...inputStyle, height: 72, resize: 'vertical' }}
              value={notesRaw}
              onChange={e => setNotesRaw(e.target.value)}
              placeholder={'Final timings subject to reconfirmation.\nRestaurant reservations may carry cancellation policies.'}
            />
          </section>

          {/* Footer */}
          <section>
            <div style={sectionHeadStyle}>Footer</div>
            <Field label='Footer Tagline (leave blank for default)'>
              <input
                style={inputStyle}
                value={footerTagline}
                onChange={e => setFooterTagline(e.target.value)}
                placeholder='PRIVATE TRAVEL DESIGN  ·  TAILORED SUPPORT  ·  SEAMLESS EXECUTION'
              />
            </Field>
          </section>

          {/* Rooms summary (read-only — edit rooms from BookingCard in HouseTab) */}
          <section>
            <div style={sectionHeadStyle}>Rooms</div>
            {trip.bookings.every(b => b._rooms.length === 0) ? (
              <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
                No rooms seeded yet. Add rooms via the booking card in the House tab.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trip.bookings.flatMap(b => b._rooms).map(r => (
                  <div key={r.id} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: '7px 10px' }}>
                    {r.confirmation_number && (
                      <div style={{ fontSize: 10, color: A.gold, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>#{r.confirmation_number}</div>
                    )}
                    {r.guest_name && <div style={{ fontSize: 11, color: A.text, fontFamily: A.font, fontWeight: 700 }}>{r.guest_name}</div>}
                    {r.room_name  && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{r.room_name}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* ── Right: live preview (60%) ─────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#E8E4DC' }}>
          {/* Preview chrome */}
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${RULE}`, background: '#DDD9D1' }}>
            <span style={{ fontSize: 9, fontFamily: A.font, fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Live Preview
            </span>
          </div>
          {/* Preview frame */}
          <div style={{ padding: 24 }}>
            <div style={{
              maxWidth:     560,
              margin:       '0 auto',
              boxShadow:    '0 4px 24px rgba(0,0,0,0.12)',
              borderRadius: 4,
              overflow:     'hidden',
            }}>
              {previewFields && <BriefPreview fields={previewFields} />}
            </div>
          </div>
        </div>

      </div>

      {/* Asset picker */}
      {pickerOpen && (
        <AssetPicker
          onClose={() => setPickerOpen(false)}
          onSelected={url => { setHeroImageSrc(url); setPickerOpen(false) }}
          presetPath={trip.destinations[0]?.storage_path ?? undefined}
        />
      )}

    </div>
  )
}