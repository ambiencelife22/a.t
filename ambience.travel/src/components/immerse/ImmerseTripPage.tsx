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
import type { ExportBranding }                from '../../pdf/pdfShared'
import { bookedByLabel, isOwnArrangements, categoryAccentHex } from '../../utils/utilsBooking'
import { webRoomDisplay, passengerName }      from '../../utils/utilsRoomDisplay'
import { fmtTime, localDateStr, formatDate, formatDateRange, formatDateWeekday, formatDateShortWeekday } from '../../utils/utilsDates'
import {
  ConfirmationTab,
  ProgrammeTab,
  TripBriefTab,
  ContactsTab,
  TabSection,
  useWindowWidth,
} from './ImmerseConfirmedSections'

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

// categoryAccent: single source in utilsBooking.ts → categoryAccentHex


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
        Please reach out to your travel designer to pick things back up, and they will be glad to share what's next.
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
  const dateLabel    = formatDateRange(trip.start_date, trip.end_date) || undefined

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
                    handleDownloadTripBrief({ trip, brief, house, destinationName: clientData.destinationName, heroImageData: heroData, auxBookings: clientData.auxBookings }, (brief?.logo_variant ?? 'ambience') as ExportBranding)
                    return
                  }
                  handleDownloadBrief({ trip, brief, house, destinationName: clientData.destinationName, heroImageData: heroData, auxBookings: clientData.auxBookings, contacts: clientData.contacts }, (brief?.logo_variant ?? 'ambience') as ExportBranding)
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