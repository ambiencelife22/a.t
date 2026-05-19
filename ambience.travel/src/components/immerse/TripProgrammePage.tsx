// TripProgrammePage.tsx — Client-facing daily programme page.
//
// What it owns:
//   - Standalone programme layout: top nav with day tabs, link to confirmation,
//     PDF download. Cream document body.
//   - Data fetch: resolves urlId → TripClientData + TripDayEntries.
//   - PDF download: calls exportDailyProgrammePdf.
//
// Last updated: S48 — load rewritten to call get-trip-programme Edge Function
//   instead of direct fetchTripDays / fetchTripDayEntries queries, which were
//   blocked by RLS on unauthenticated public pages.
// Prior: S48 — initial ship.

import { useEffect, useState } from 'react'
import type { TripClientData } from '../../lib/tripClientQueries'
import type { TripDay, TripDayEntry } from '../../lib/adminTripQueries'
import { useProgrammeDownload } from '../../lib/useProgrammeDownload'
import { isImmerseHost } from '../../lib/immersePath'

const PROGRAMME_FN      = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-trip-programme`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function fetchTripProgrammeData(urlId: string): Promise<{
  clientData: TripClientData
  days:       TripDay[]
  entries:    TripDayEntry[]
} | null> {
  try {
    const res = await fetch(PROGRAMME_FN, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body:    JSON.stringify({ url_id: urlId }),
    })
    if (!res.ok) return null
    const payload = await res.json()
    if (payload.error || !payload.trip) return null
    return {
      clientData: {
        trip:            payload.trip,
        brief:           payload.brief,
        house:           payload.house,
        destinationName: payload.destinationName,
        auxBookings:     payload.auxBookings,
        urlId,
      },
      days:    payload.days    ?? [],
      entries: payload.entries ?? [],
    }
  } catch {
    return null
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const CREAM = '#F7F5F0'
const INK   = '#1A1D1A'
const GOLD  = '#C9A84C'
const MUTED = '#787060'
const FAINT = '#B4AFA5'
const RULE  = '#DCDBD5'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function ProgrammeTopBar({ clientData, confirmationUrl, activeDate, days, entries, onDaySelect }: {
  clientData:      TripClientData | null
  confirmationUrl: string | null
  activeDate:      string | null
  days:            TripDay[]
  entries:         TripDayEntry[]
  onDaySelect:     (date: string) => void
}) {
  const { pdfReady, pdfDownloading, handleDownloadProgramme } = useProgrammeDownload()

  async function handlePdf() {
    if (!clientData) return
    const entriesByDate: Record<string, TripDayEntry[]> = {}
    for (const entry of entries) {
      if (!entriesByDate[entry.entry_date]) entriesByDate[entry.entry_date] = []
      entriesByDate[entry.entry_date].push(entry)
    }
    handleDownloadProgramme({ trip: clientData.trip, house: clientData.house, days, entriesByDate })
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(250,247,242,0.96)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${RULE}`,
    }}>
      {/* Main bar */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center',
        padding: '0 clamp(16px,5vw,48px)', gap: 12,
      }}>
        <a href='https://ambience.travel' style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <img src='/emblem.png' alt='' style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <img src='/ambience_travel.svg' alt='ambience travel' style={{ height: 32, objectFit: 'contain' }} />
        </a>

        <div style={{ flex: 1 }} />

        {/* Confirmation link */}
        {confirmationUrl && (
          <a
            href={confirmationUrl}
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11, fontWeight: 600, color: MUTED,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              textDecoration: 'none', padding: '5px 10px',
              border: `1px solid ${RULE}`, borderRadius: 6,
              transition: 'color 150ms, border-color 150ms',
              flexShrink: 0,
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
            Confirmation →
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
            transition: 'opacity 150ms', flexShrink: 0,
          }}
        >
          {pdfDownloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* Day tab strip */}
      {days.length > 0 && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 2,
          padding: '0 clamp(16px,5vw,48px) 0',
          borderTop: `1px solid ${RULE}`,
          scrollbarWidth: 'none',
        }}>
          {days.filter(d => d.show).map(day => (
            <button
              key={day.entry_date}
              onClick={() => onDaySelect(day.entry_date)}
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 11, fontWeight: activeDate === day.entry_date ? 700 : 500,
                color: activeDate === day.entry_date ? GOLD : MUTED,
                background: 'transparent', border: 'none', borderBottom: `2px solid ${activeDate === day.entry_date ? GOLD : 'transparent'}`,
                padding: '10px 12px', cursor: 'pointer', flexShrink: 0,
                whiteSpace: 'nowrap', transition: 'color 120ms, border-color 120ms',
              }}
            >
              {day.day_label || fmtDayLabel(day.entry_date)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Day content ───────────────────────────────────────────────────────────────

function DayContent({ day, entries }: { day: TripDay; entries: TripDayEntry[] }) {
  const dayEntries = entries
    .filter(e => e.entry_date === day.entry_date && e.brief_show)
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,8vw,120px)' }}>
      {day.day_label && (
        <div style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
          {day.day_label}
        </div>
      )}
      <div style={{ fontSize: 'clamp(20px,3vw,28px)', fontFamily: 'Georgia, serif', color: INK, marginBottom: 4 }}>
        {new Date(day.entry_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
      {day.day_note && (
        <div style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED, fontStyle: 'italic', marginBottom: 20 }}>
          {day.day_note}
        </div>
      )}

      <div style={{ height: 1, background: RULE, margin: '16px 0 24px' }} />

      {dayEntries.length === 0 ? (
        <div style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, fontStyle: 'italic' }}>
          No programme entries for this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {dayEntries.map((entry, i) => (
            <div key={entry.id} style={{ display: 'flex', gap: 20, position: 'relative' }}>
              {/* Time column */}
              <div style={{ width: 64, flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>
                {entry.start_time && (
                  <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, fontWeight: 600 }}>
                    {fmtTime(entry.start_time)}
                  </div>
                )}
              </div>

              {/* Accent dot + line */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, marginTop: 4, flexShrink: 0 }} />
                {i < dayEntries.length - 1 && (
                  <div style={{ width: 1, flex: 1, background: RULE, minHeight: 24, marginTop: 4 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 24 }}>
                <div style={{ fontSize: 15, fontFamily: 'Georgia, serif', color: INK, marginBottom: 2 }}>
                  {entry.title}
                </div>
                {entry.subtitle && (
                  <div style={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", color: MUTED, marginBottom: 4 }}>
                    {entry.subtitle}
                  </div>
                )}
                {entry.confirmation_number && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    border: `1px solid ${GOLD}`, borderRadius: 4,
                    padding: '1px 8px', marginBottom: 4, background: '#FAF7F0',
                  }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: GOLD }}>
                      Conf #:  {entry.confirmation_number}
                    </span>
                  </div>
                )}
                {entry.notes && (
                  <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, fontStyle: 'italic' }}>
                    {entry.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Loading / error ───────────────────────────────────────────────────────────

function ProgrammeLoading() {
  return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <img src='/emblem.png' alt='' style={{ width: 48, height: 48, opacity: 0.6 }} />
      <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Preparing Your Programme
      </div>
    </div>
  )
}

function ProgrammeNotFound() {
  return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, color: INK, fontFamily: 'Georgia, serif' }}>This programme is not available.</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: GOLD, fontFamily: "'Plus Jakarta Sans', sans-serif", textDecoration: 'none' }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TripProgrammePage({ urlId }: { urlId: string }) {
  const [clientData, setClientData] = useState<TripClientData | null>(null)
  const [days,       setDays]       = useState<TripDay[]>([])
  const [entries,    setEntries]    = useState<TripDayEntry[]>([])
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [notFound,   setNotFound]   = useState(false)

  useEffect(() => {
    async function load() {
      const result = await fetchTripProgrammeData(urlId).catch(() => null)
      if (!result) { setNotFound(true); return }
      setClientData(result.clientData)
      setDays(result.days)
      setEntries(result.entries)
      if (result.days.length > 0) setActiveDate(result.days[0].entry_date)
    }
    load()
  }, [urlId])

  const confirmationUrl = clientData
    ? (isImmerseHost() ? `/${urlId}/confirmation` : `/immerse/${urlId}/confirmation`)
    : null

  if (notFound) return <ProgrammeNotFound />
  if (!clientData) return <ProgrammeLoading />

  const activeDay = days.find(d => d.entry_date === activeDate) ?? null

  return (
    <div style={{ minHeight: '100vh', background: CREAM }}>
      <ProgrammeTopBar
        clientData={clientData}
        confirmationUrl={confirmationUrl}
        activeDate={activeDate}
        days={days}
        entries={entries}
        onDaySelect={setActiveDate}
      />

      {activeDay ? (
        <DayContent day={activeDay} entries={entries} />
      ) : (
        <div style={{ padding: 'clamp(24px,4vw,48px) clamp(20px,8vw,120px)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: FAINT, fontStyle: 'italic' }}>
          No programme days available yet.
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '40px clamp(20px,8vw,120px)', textAlign: 'center', borderTop: `1px solid ${RULE}` }}>
        <div style={{ fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", color: FAINT, letterSpacing: '0.08em' }}>
          TAILORED TRAVEL DESIGN · CONCIERGE SUPPORT ·{' '}
          <a href='https://ambience.travel' style={{ color: FAINT, textDecoration: 'none' }}>ambience.travel</a>
        </div>
      </div>
    </div>
  )
}