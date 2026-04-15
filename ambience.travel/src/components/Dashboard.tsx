/* Dashboard.tsx
 * Authenticated dashboard for ambience.travel programme product.
 * Default page after sign-in. Shows programme status and key contacts.
 *
 * Sections:
 *   — Greeting row (name, date context)
 *   — Active programme card (if currently checked in)
 *   — Next programme card (upcoming, with countdown)
 *   — Key contact card (owner/manager from nearest programme)
 *   — Past programmes list (completed stays/journeys)
 *
 * No P&L, no financial data of any kind.
 * Data sourced via getGuestProgrammes() from queries.ts.
 */

import { useEffect, useState } from 'react'
import { C } from '../lib/theme'
import { getGuestProgrammes, type GuestProgramme } from '../lib/queries'

interface DashboardProps {
  displayName?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function greeting(name?: string): string {
  const hour = new Date().getHours()
  const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${salutation}, ${name.split(' ')[0]}.` : `${salutation}.`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function daysUntil(iso: string): number {
  const now   = new Date()
  const then  = new Date(iso)
  now.setHours(0, 0, 0, 0)
  then.setHours(0, 0, 0, 0)
  return Math.round((then.getTime() - now.getTime()) / 86400000)
}

function isActive(p: GuestProgramme): boolean {
  if (!p.checkIn || !p.checkOut) return false
  const now  = new Date()
  const cin  = new Date(p.checkIn)
  const cout = new Date(p.checkOut)
  now.setHours(0, 0, 0, 0)
  cin.setHours(0, 0, 0, 0)
  cout.setHours(0, 0, 0, 0)
  return now >= cin && now <= cout
}

function isUpcoming(p: GuestProgramme): boolean {
  if (!p.checkIn) return false
  return daysUntil(p.checkIn) > 0
}

function isPast(p: GuestProgramme): boolean {
  if (!p.checkOut) return false
  return daysUntil(p.checkOut) < 0
}

function programmeProgrammeUrl(p: GuestProgramme): string {
  const hostname = window.location.hostname
  const base     = hostname === 'programme.ambience.travel'
    ? 'https://programme.ambience.travel'
    : `${window.location.protocol}//${window.location.host}/programme`
  return `${base}/${p.subPath}/${p.urlId}`
}

function typeLabel(p: GuestProgramme): string {
  return p.programmeType === 'journey' ? 'Journey' : 'Stay'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize:      11,
      fontWeight:    700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color:         C.muted,
      fontFamily:    "'Plus Jakarta Sans', sans-serif",
      marginBottom:  12,
    }}>
      {children}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      background:   C.bgCard,
      borderRadius: 16,
      border:       `1px solid ${C.border}`,
      padding:      28,
      marginBottom: 12,
    }}>
      {[80, 140, 60].map((w, i) => (
        <div key={i} style={{
          height:       14,
          width:        w,
          borderRadius: 6,
          background:   C.border,
          marginBottom: i < 2 ? 12 : 0,
          opacity:      1 - i * 0.2,
        }} />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding:      '28px 24px',
      background:   C.bgCard,
      borderRadius: 16,
      border:       `1px solid ${C.border}`,
      fontSize:     14,
      color:        C.muted,
      fontFamily:   "'Plus Jakarta Sans', sans-serif",
    }}>
      {message}
    </div>
  )
}

// Active programme — currently checked in
function ActiveCard({ p }: { p: GuestProgramme }) {
  const daysLeft = p.checkOut ? Math.max(0, daysUntil(p.checkOut)) : null

  return (
    <div style={{
      background:   C.bgCard,
      borderRadius: 16,
      border:       `1px solid ${C.borderGold}`,
      padding:      28,
      marginBottom: 12,
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Gold accent bar */}
      <div style={{
        position:   'absolute',
        top:        0,
        left:       0,
        right:      0,
        height:     3,
        background: `linear-gradient(90deg, ${C.gold}, transparent)`,
      }} />

      {/* Type + status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color:         C.gold,
          fontFamily:    "'Plus Jakarta Sans', sans-serif",
        }}>
          {typeLabel(p)}
        </span>
        <span style={{
          fontSize:      10,
          fontWeight:    600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color:         C.positive,
          background:    `${C.positive}18`,
          padding:       '2px 8px',
          borderRadius:  20,
          fontFamily:    "'Plus Jakarta Sans', sans-serif",
        }}>
          Active now
        </span>
      </div>

      {/* Property name */}
      <div style={{
        fontSize:      22,
        fontWeight:    800,
        color:         C.text,
        letterSpacing: '-0.02em',
        fontFamily:    "'Plus Jakarta Sans', sans-serif",
        marginBottom:  4,
      }}>
        {p.property.name}
      </div>

      {/* Location */}
      {(p.property.city || p.property.country) && (
        <div style={{
          fontSize:   13,
          color:      C.muted,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginBottom: 20,
        }}>
          {[p.property.city, p.property.country].filter(Boolean).join(', ')}
        </div>
      )}

      {/* Dates row */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           24,
        flexWrap:      'wrap',
        marginBottom:  20,
        paddingTop:    16,
        borderTop:     `1px solid ${C.border}`,
      }}>
        {p.checkIn && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Check-in</div>
            <div style={{ fontSize: 13, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{formatDateShort(p.checkIn)}</div>
          </div>
        )}
        {p.checkOut && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Check-out</div>
            <div style={{ fontSize: 13, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{formatDateShort(p.checkOut)}</div>
          </div>
        )}
        {daysLeft !== null && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Remaining</div>
            <div style={{ fontSize: 13, color: C.gold, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
              {daysLeft === 0 ? 'Last day' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => { window.location.href = programmeProgrammeUrl(p) }}
        style={{
          padding:        '10px 20px',
          fontSize:       13,
          fontWeight:     700,
          background:     C.gold,
          color:          C.bgSidebar,
          border:         'none',
          borderRadius:   10,
          cursor:         'pointer',
          fontFamily:     "'Plus Jakarta Sans', sans-serif",
          letterSpacing:  '0.02em',
          transition:     'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
      >
        Open guide →
      </button>
    </div>
  )
}

// Next programme — upcoming
function NextCard({ p }: { p: GuestProgramme }) {
  const days      = p.checkIn ? daysUntil(p.checkIn) : null
  const url       = programmeProgrammeUrl(p)

  return (
    <div style={{
      background:   C.bgCard,
      borderRadius: 16,
      border:       `1px solid ${C.border}`,
      padding:      28,
      marginBottom: 12,
    }}>
      {/* Type label */}
      <div style={{
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color:         C.gold,
        fontFamily:    "'Plus Jakarta Sans', sans-serif",
        marginBottom:  12,
      }}>
        {typeLabel(p)}
      </div>

      {/* Property name */}
      <div style={{
        fontSize:      20,
        fontWeight:    800,
        color:         C.text,
        letterSpacing: '-0.02em',
        fontFamily:    "'Plus Jakarta Sans', sans-serif",
        marginBottom:  4,
      }}>
        {p.property.name}
      </div>

      {/* Location */}
      {(p.property.city || p.property.country) && (
        <div style={{
          fontSize:     13,
          color:        C.muted,
          fontFamily:   "'Plus Jakarta Sans', sans-serif",
          marginBottom: 20,
        }}>
          {[p.property.city, p.property.country].filter(Boolean).join(', ')}
        </div>
      )}

      {/* Countdown + dates */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          24,
        flexWrap:     'wrap',
        paddingTop:   16,
        borderTop:    `1px solid ${C.border}`,
        marginBottom: 20,
      }}>
        {days !== null && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>In</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.gold, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
              {days}
              <span style={{ fontSize: 13, fontWeight: 400, color: C.muted, marginLeft: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {days === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
        )}
        {p.checkIn && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Check-in</div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{formatDate(p.checkIn)}</div>
          </div>
        )}
        {p.checkOut && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 3 }}>Check-out</div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{formatDate(p.checkOut)}</div>
          </div>
        )}
      </div>

      {/* Link to programme guide */}
      <a
        href={url}
        style={{
          display:      'inline-block',
          padding:      '10px 20px',
          fontSize:     13,
          fontWeight:   700,
          background:   'transparent',
          color:        C.gold,
          border:       `1px solid ${C.borderGold}`,
          borderRadius: 10,
          textDecoration: 'none',
          fontFamily:   "'Plus Jakarta Sans', sans-serif",
          letterSpacing:'0.02em',
          transition:   'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.background   = `${C.gold}14`
          ;(e.currentTarget as HTMLAnchorElement).style.borderColor = C.gold
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.background   = 'transparent'
          ;(e.currentTarget as HTMLAnchorElement).style.borderColor = C.borderGold
        }}
      >
        View guide →
      </a>
    </div>
  )
}

// Past programme row
function PastRow({ p }: { p: GuestProgramme }) {
  const url = programmeProgrammeUrl(p)
  return (
    <a
      href={url}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            12,
        padding:        '14px 20px',
        background:     C.bgCard,
        borderRadius:   12,
        border:         `1px solid ${C.border}`,
        textDecoration: 'none',
        transition:     'border-color 0.15s',
        flexWrap:       'wrap',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = C.borderGold}
      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 2 }}>
          {p.property.name}
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {[p.property.city, p.property.country].filter(Boolean).join(', ')}
          {p.checkIn && ` · ${formatDateShort(p.checkIn)}`}
          {p.checkOut && ` - ${formatDateShort(p.checkOut)}`}
        </div>
      </div>
      <div style={{
        fontSize:      10,
        fontWeight:    600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color:         C.faint,
        fontFamily:    "'Plus Jakarta Sans', sans-serif",
        flexShrink:    0,
      }}>
        {typeLabel(p)} →
      </div>
    </a>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard({ displayName }: DashboardProps) {
  const [programmes, setProgrammes] = useState<GuestProgramme[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    getGuestProgrammes()
      .then(data => {
        setProgrammes(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Dashboard load error:', err)
        setError('Failed to load programmes.')
        setLoading(false)
      })
  }, [])

  const active   = programmes.filter(isActive)
  const upcoming = programmes.filter(isUpcoming).sort((a, b) =>
    new Date(a.checkIn!).getTime() - new Date(b.checkIn!).getTime()
  )
  const past     = programmes.filter(isPast).sort((a, b) =>
    new Date(b.checkOut!).getTime() - new Date(a.checkOut!).getTime()
  )

  return (
    <div style={{ maxWidth: 760, width: '100%', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize:      26,
          fontWeight:    800,
          color:         C.text,
          letterSpacing: '-0.02em',
          marginBottom:  4,
        }}>
          {greeting(displayName)}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
          {programmes.length > 0
            ? `You have ${programmes.length} programme${programmes.length !== 1 ? 's' : ''} linked to this account.`
            : loading ? '' : 'No programmes linked to this account yet.'
          }
        </div>
      </div>

      {loading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {error && (
        <div style={{
          padding:      '16px 20px',
          background:   `${C.negative}14`,
          border:       `1px solid ${C.negative}40`,
          borderRadius: 12,
          fontSize:     13,
          color:        C.negative,
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Active programme */}
          {active.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SectionLabel>Currently active</SectionLabel>
              {active.map(p => (
                <ActiveCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* Next programme */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SectionLabel>Coming up</SectionLabel>
              <NextCard p={upcoming[0]} />
              {/* Additional upcoming — smaller treatment */}
              {upcoming.slice(1).map(p => (
                <PastRow key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* Empty state — no active or upcoming */}
          {active.length === 0 && upcoming.length === 0 && past.length === 0 && (
            <EmptyState message='No programmes are linked to this account. Your travel adviser will add them when your itinerary is confirmed.' />
          )}

          {/* Past programmes */}
          {past.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SectionLabel>Past programmes</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map(p => (
                  <PastRow key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}