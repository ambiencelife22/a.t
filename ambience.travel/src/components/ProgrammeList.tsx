/* ProgrammeList.tsx
 * Lists all programmes linked to the authenticated guest.
 * Shown when navigating to "My Programme" in the Layout nav.
 * Each card links to the full-page programme URL — no in-app rendering.
 *
 * Card shows: property name, location, type, dates, status pill.
 * Clicking navigates to /stays/:id or /journeys/:id (full page, no Layout).
 */

import { useEffect, useState } from 'react'
import { C } from '../lib/theme'
import { getGuestProgrammes, type GuestProgramme } from '../lib/queries'

function programmeUrl(p: GuestProgramme): string {
  const hostname = window.location.hostname
  const base     = hostname === 'programme.ambience.travel'
    ? 'https://programme.ambience.travel'
    : `${window.location.protocol}//${window.location.host}/programme`
  return `${base}/${p.subPath}/${p.urlId}`
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function statusPill(p: GuestProgramme): { label: string; color: string } {
  const now   = new Date(); now.setHours(0, 0, 0, 0)

  if (p.checkIn && p.checkOut) {
    const cin  = new Date(p.checkIn);  cin.setHours(0, 0, 0, 0)
    const cout = new Date(p.checkOut); cout.setHours(0, 0, 0, 0)
    if (now >= cin && now <= cout) return { label: 'Active',   color: C.positive }
    if (now < cin)                 return { label: 'Upcoming', color: C.gold }
    return                                { label: 'Past',     color: C.faint }
  }

  if (p.status === 'confirmed') return { label: 'Confirmed', color: C.gold }
  if (p.status === 'draft')     return { label: 'Draft',     color: C.faint }
  return                               { label: p.status,    color: C.faint }
}

function SkeletonCard() {
  return (
    <div style={{
      background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`,
      padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {[120, 80, 60].map((w, i) => (
        <div key={i} style={{ height: 13, width: w, borderRadius: 6, background: C.border, opacity: 1 - i * 0.25 }} />
      ))}
    </div>
  )
}

export default function ProgrammeList() {
  const [programmes, setProgrammes] = useState<GuestProgramme[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    getGuestProgrammes()
      .then(data => { setProgrammes(data); setLoading(false) })
      .catch(() => { setError('Failed to load programmes.'); setLoading(false) })
  }, [])

  return (
    <div style={{ maxWidth: 760, width: '100%', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          {!loading && !error && (
            programmes.length === 0
              ? 'No programmes are linked to this account yet.'
              : `${programmes.length} programme${programmes.length !== 1 ? 's' : ''} linked to your account.`
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px 20px', background: `${C.negative}14`, border: `1px solid ${C.negative}40`, borderRadius: 12, fontSize: 13, color: C.negative }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && !error && programmes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
          {programmes.map(p => {
            const pill = statusPill(p)
            const url  = programmeUrl(p)

            return (
              <div
                key={p.id}
                onClick={() => { window.location.href = url }}
                style={{
                  display:       'flex',
                  flexDirection: 'column',
                  background:    C.bgCard,
                  borderRadius:  16,
                  border:        `1px solid ${C.border}`,
                  padding:       24,
                  transition:    'border-color 0.15s, transform 0.15s',
                  cursor:        'pointer',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = C.borderGold
                  ;(e.currentTarget as HTMLDivElement).style.transform  = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = C.border
                  ;(e.currentTarget as HTMLDivElement).style.transform  = 'translateY(0)'
                }}
              >
                {/* Type + status row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: C.gold,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>
                    {p.programmeType === 'journey' ? 'Journey' : 'Stay'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: pill.color,
                    background: `${pill.color}18`,
                    border: `1px solid ${pill.color}40`,
                    borderRadius: 20, padding: '2px 8px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>
                    {pill.label}
                  </span>
                </div>

                {/* Property name */}
                <div style={{
                  fontSize: 18, fontWeight: 800, color: C.text,
                  letterSpacing: '-0.02em', marginBottom: 4,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {p.property.name}
                </div>

                {/* Location */}
                {(p.property.city || p.property.country) && (
                  <div style={{
                    fontSize: 13, color: C.muted, marginBottom: 20,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>
                    {[p.property.city, p.property.country].filter(Boolean).join(', ')}
                  </div>
                )}

                {/* Dates */}
                {(p.checkIn || p.checkOut) && (
                  <div style={{
                    display: 'flex', gap: 20, flexWrap: 'wrap',
                    paddingTop: 16, borderTop: `1px solid ${C.border}`,
                    marginTop: 'auto',
                  }}>
                    {p.checkIn && (
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Check-in</div>
                        <div style={{ fontSize: 12, color: C.text, fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>{formatDateShort(p.checkIn)}</div>
                      </div>
                    )}
                    {p.checkOut && (
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Check-out</div>
                        <div style={{ fontSize: 12, color: C.text, fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>{formatDateShort(p.checkOut)}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={e => { e.stopPropagation(); window.location.href = url }}
                  style={{
                    marginTop:     16,
                    padding:       '10px 20px',
                    fontSize:      13,
                    fontWeight:    700,
                    background:    C.gold,
                    color:         C.bgSidebar,
                    border:        'none',
                    borderRadius:  10,
                    cursor:        'pointer',
                    fontFamily:    "'Plus Jakarta Sans', sans-serif",
                    letterSpacing: '0.02em',
                    transition:    'opacity 0.15s',
                    alignSelf:     'flex-start',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                >
                  Open guide →
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}