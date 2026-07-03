// StudioDashboard.tsx — The first thing you see when you open admin.
// Answers: what needs attention, who's traveling when, what stage things are at,
// how's the money. One screen, no clicks.
//
// Data: fetchPipeline() from queriesAdminFinance — confirmed + closed_won engagements.
// Active pipeline (confirmed/paid/in_service) shown in Pipeline section.
// Closed Won shown separately, filtered to fiscal year, sortable.
//
// Last updated: S53I — closed_won separated, native + USD commission columns.

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { fetchPipeline, type PipelineTrip } from '../../queries/queriesAdminFinance'
import { formatDateShortRange } from '../../utils/utilsDates'

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtNative(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(0)}`
  }
}

function daysUntil(iso: string): number {
  const target = new Date(iso.slice(0, 10) + 'T00:00:00')
  const today  = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  confirmed:  { label: 'Confirmed',  color: '#4ade80' },
  paid:       { label: 'Paid',       color: '#86efac' },
  in_service: { label: 'In Service', color: '#22d3ee' },
}

const FISCAL_YEAR_START = '2026-01-01'
const FISCAL_YEAR_END   = '2026-12-31'

type SortKey = 'start_date' | 'total_rate' | 'net_margin' | 'total_commission'

// Grid: Engagement | Value | Comm. (native) | Comm. (USD) | Received | Margin
const GRID = '1fr 90px 100px 90px 90px 90px'
const HEADERS = ['Engagement', 'Value', 'Comm. (native)', 'Comm. (USD)', 'Received', 'Margin']

// ── KPI Card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, color, accent }: {
  label: string; value: string; sub?: string; color?: string; accent?: string
}) {
  return (
    <div style={{
      background: A.bgCard,
      border: `1px solid ${accent ? accent + '30' : A.border}`,
      borderTop: accent ? `2px solid ${accent}` : `1px solid ${A.border}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{sub}</div>}
    </div>
  )
}

// ── Attention item ────────────────────────────────────────────────────────────

function AttentionItem({ engagement, reason, amount, color, onClick }: {
  engagement: PipelineTrip; reason: string; amount: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '12px 16px', background: A.bgCard,
        border: `1px solid ${A.border}`, borderLeft: `3px solid ${color}`,
        borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(216,181,106,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = A.bgCard}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>{engagement.title ?? engagement.url_id}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          {engagement.trip_code && <span style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>{engagement.trip_code}</span>}
          <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: A.font, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{reason}</span>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: A.font, flexShrink: 0 }}>{amount}</div>
    </button>
  )
}

// ── Upcoming row ──────────────────────────────────────────────────────────────

function UpcomingRow({ engagement, onClick }: { engagement: PipelineTrip; onClick: () => void }) {
  const days = engagement.start_date ? daysUntil(engagement.start_date) : null
  const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days != null && days > 0 ? `${days} days` : null

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 16px', background: A.bgCard,
        border: `1px solid ${A.border}`, borderRadius: 8,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(216,181,106,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = A.bgCard}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>{engagement.title ?? engagement.url_id}</div>
        <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginTop: 2 }}>
          {formatDateShortRange(engagement.start_date, engagement.end_date)}
        </div>
      </div>
      {dayLabel && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          color: days != null && days <= 3 ? '#f87171' : days != null && days <= 7 ? '#FBBF24' : A.gold,
          fontFamily: A.font, flexShrink: 0,
        }}>
          {dayLabel}
        </span>
      )}
    </button>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
        {title}{count != null ? ` \u00b7 ${count}` : ''}
      </div>
      {children}
    </div>
  )
}

// ── Pipeline table row ────────────────────────────────────────────────────────

function PipelineRow({ e, i, stageMeta, onClick }: {
  e: PipelineTrip; i: number; stageMeta?: { label: string; color: string }; onClick: () => void
}) {
  const bg = i % 2 === 0 ? A.bg : A.bgCard
  const isSameNative = e.currency === 'USD' || e.currency === 'MIXED' || !e.currency
  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: GRID,
        padding: '12px 16px', background: bg,
        border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 120ms',
      }}
      onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(216,181,106,0.04)'}
      onMouseLeave={ev => ev.currentTarget.style.background = bg}
    >
      {/* Engagement name + meta */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font, marginBottom: 2 }}>
          {e.title ?? e.url_id}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {e.trip_code && <span style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>{e.trip_code}</span>}
          {e.start_date && (
            <span style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>
              {formatDateShortRange(e.start_date, e.end_date)}
            </span>
          )}
          {stageMeta && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: stageMeta.color, fontFamily: A.font }}>
              {stageMeta.label}
            </span>
          )}
        </div>
      </div>

      {/* Value (USD) */}
      <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, textAlign: 'right' }}>
        {e.total_rate ? usd(e.total_rate) : <span style={{ color: A.faint }}>—</span>}
      </div>

      {/* Comm. native currency */}
      <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, textAlign: 'right' }}>
        {e.total_commission_native > 0
          ? isSameNative
            ? <span style={{ color: A.faint }}>—</span>
            : fmtNative(e.total_commission_native, e.currency)
          : <span style={{ color: A.faint }}>—</span>
        }
      </div>

      {/* Comm. USD */}
      <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, textAlign: 'right' }}>
        {e.total_commission > 0 ? usd(e.total_commission) : <span style={{ color: A.faint }}>—</span>}
      </div>

      {/* Received */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', fontFamily: A.font, textAlign: 'right' }}>
        {e.commission_received > 0 ? usd(e.commission_received) : <span style={{ color: A.faint }}>—</span>}
      </div>

      {/* Margin */}
      <div style={{ fontSize: 13, fontWeight: 700, color: e.net_margin >= 0 ? '#4ade80' : '#ef4444', fontFamily: A.font, textAlign: 'right' }}>
        {e.net_margin !== 0 ? usd(e.net_margin) : <span style={{ color: A.faint }}>—</span>}
      </div>
    </button>
  )
}

function TableHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 16px', background: A.bgCard }}>
      {HEADERS.map(h => (
        <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, textAlign: h === 'Engagement' ? 'left' : 'right' }}>
          {h}
        </div>
      ))}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function StudioDashboard() {
  const [data,    setData]    = useState<PipelineTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [closedSort, setClosedSort] = useState<SortKey>('start_date')

  useEffect(() => {
    fetchPipeline()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function goTo(eng: PipelineTrip) {
    if (!eng.url_id) return
    navigateAdmin({ product: 'trips', tab: 'bookings', urlId: eng.url_id })
  }

  const today = new Date().toISOString().slice(0, 10)

  const active    = data.filter(e => e.status_slug !== 'closed_won')
  const closedWon = data.filter(e =>
    e.status_slug === 'closed_won' &&
    e.start_date != null &&
    e.start_date >= FISCAL_YEAR_START &&
    e.start_date <= FISCAL_YEAR_END
  )

  const attention = active.filter(e =>
    e.commission_outstanding > 0 || e.total_outstanding > 0 || e.total_billable > 0
  )

  const upcoming = active
    .filter(e => e.start_date && e.start_date >= today && daysUntil(e.start_date) <= 30)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  const inService = active.filter(e =>
    e.start_date && e.start_date <= today && e.end_date && e.end_date >= today
  )

  const byStage = new Map<string, PipelineTrip[]>()
  for (const e of active) {
    const slug = e.status_slug ?? 'unknown'
    ;(byStage.get(slug) ?? byStage.set(slug, []).get(slug)!).push(e)
  }

  const totalValue       = active.reduce((s, e) => s + (e.total_rate ?? 0), 0)
  const totalCommission  = active.reduce((s, e) => s + e.total_commission, 0)
  const totalReceived    = active.reduce((s, e) => s + e.commission_received, 0)
  const totalOutstanding = active.reduce((s, e) => s + e.commission_outstanding, 0)
  const totalMargin      = active.reduce((s, e) => s + e.net_margin, 0)

  const closedSorted = [...closedWon].sort((a, b) => {
    if (closedSort === 'start_date')     return (a.start_date ?? '').localeCompare(b.start_date ?? '')
    if (closedSort === 'total_rate')     return (b.total_rate ?? 0) - (a.total_rate ?? 0)
    if (closedSort === 'net_margin')     return b.net_margin - a.net_margin
    return b.total_commission - a.total_commission
  })

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 4 }}>ambience</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>Dashboard</div>
      </div>

      {/* Money strip — active only */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <Kpi label='Pipeline Value'         value={usd(totalValue)}         accent={A.gold} />
        <Kpi label='Total Commission'       value={usd(totalCommission)}    sub={`${usd(totalReceived)} received`} accent={A.gold} />
        <Kpi label='Commission Outstanding' value={usd(totalOutstanding)}   color={totalOutstanding > 0 ? '#FBBF24' : A.text} accent={totalOutstanding > 0 ? '#FBBF24' : undefined} />
        <Kpi label='Net Margin'             value={usd(totalMargin)}        color={totalMargin >= 0 ? '#4ade80' : '#ef4444'} accent={totalMargin >= 0 ? '#4ade80' : '#ef4444'} />
        <Kpi label='Active Engagements'     value={String(active.length)} />
      </div>

      {/* Attention */}
      {attention.length > 0 && (
        <Section title='Needs Attention' count={attention.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attention.map(e => {
              const reasons: { reason: string; amount: string; color: string }[] = []
              if (e.commission_outstanding > 0) reasons.push({ reason: 'Commission outstanding', amount: usd(e.commission_outstanding), color: '#FBBF24' })
              if (e.total_outstanding > 0)      reasons.push({ reason: 'Balance outstanding',    amount: usd(e.total_outstanding),      color: '#f87171' })
              if (e.total_billable > 0)         reasons.push({ reason: 'Billable expenses',      amount: usd(e.total_billable),         color: '#93C5FD' })
              return reasons.map((r, i) => (
                <AttentionItem key={`${e.engagement_id}-${i}`} engagement={e} {...r} onClick={() => goTo(e)} />
              ))
            })}
          </div>
        </Section>
      )}

      {/* Currently traveling */}
      {inService.length > 0 && (
        <Section title='Currently Traveling' count={inService.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {inService.map(e => <UpcomingRow key={e.engagement_id} engagement={e} onClick={() => goTo(e)} />)}
          </div>
        </Section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section title='Upcoming · 30 days' count={upcoming.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {upcoming.map(e => <UpcomingRow key={e.engagement_id} engagement={e} onClick={() => goTo(e)} />)}
          </div>
        </Section>
      )}

      {/* Active pipeline */}
      <Section title='Pipeline'>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {['confirmed', 'paid', 'in_service'].map(slug => {
            const group = byStage.get(slug) ?? []
            if (group.length === 0) return null
            const meta  = STAGE_META[slug]
            const value = group.reduce((s, e) => s + (e.total_rate ?? 0), 0)
            return <Kpi key={slug} label={meta.label} value={String(group.length)} sub={usd(value)} accent={meta.color} />
          })}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: `1px solid ${A.border}` }}>
          <TableHeader />
          {active.map((e, i) => (
            <PipelineRow
              key={e.engagement_id}
              e={e} i={i}
              stageMeta={STAGE_META[e.status_slug ?? ''] ?? { label: e.status_slug ?? '', color: A.faint }}
              onClick={() => goTo(e)}
            />
          ))}
        </div>
      </Section>

      {/* Closed Won — fiscal year */}
      {closedSorted.length > 0 && (
        <Section title={`Closed · Won — FY${FISCAL_YEAR_START.slice(0, 4)}`} count={closedSorted.length}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {(['start_date', 'total_rate', 'net_margin', 'total_commission'] as SortKey[]).map(k => (
              <button key={k} onClick={() => setClosedSort(k)} style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: A.font, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                background: closedSort === k ? 'rgba(216,181,106,0.12)' : 'transparent',
                color: closedSort === k ? A.gold : A.faint,
                border: `1px solid ${closedSort === k ? 'rgba(216,181,106,0.3)' : A.border}`,
              }}>
                {{ start_date: 'Date', total_rate: 'Value', net_margin: 'Margin', total_commission: 'Commission (USD)' }[k]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: `1px solid ${A.border}` }}>
            <TableHeader />
            {closedSorted.map((e, i) => (
              <PipelineRow key={e.engagement_id} e={e} i={i} onClick={() => goTo(e)} />
            ))}
          </div>
        </Section>
      )}

    </div>
  )
}