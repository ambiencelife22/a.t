// StudioDashboard.tsx — The first thing you see when you open admin.
// Answers: what needs attention, who's traveling when, what stage things are at,
// how's the money. One screen, no clicks.
//
// Data: fetchPipeline() from queriesAdminFinance — all confirmed engagements
// with financial summary. v1 scope: confirmed+ engagements only. v2 extends to
// full engagement list for proposal/requested stage visibility.
//
// Last updated: S53I — initial ship.

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { fetchPipeline, type PipelineTrip } from '../../queries/queriesAdminFinance'

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
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
  closed_won: { label: 'Closed Won', color: A.muted },
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, color, accent }: {
  label: string; value: string; sub?: string; color?: string; accent?: string
}) {
  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${accent ? accent + '30' : A.border}`,
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
  engagement: PipelineTrip; reason: string; amount: string; color: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
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
    <button onClick={onClick} style={{
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
          {fmtDate(engagement.start_date)}{engagement.end_date ? ` \u2013 ${fmtDate(engagement.end_date)}` : ''}
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

// ── Section ───────────────────────────────────────────────────────────────────

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function StudioDashboard() {
  const [data,    setData]    = useState<PipelineTrip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPipeline()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function goTo(eng: PipelineTrip) {
    navigateAdmin({ product: 'trips', tab: 'overview', urlId: eng.url_id })
  }

  // ── Derived views ─────────────────────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10)

  // Attention: commission outstanding OR balances/billable outstanding
  const attention = data.filter(e =>
    e.commission_outstanding > 0 || e.total_outstanding > 0 || e.total_billable > 0
  )

  // Upcoming: starts within 30 days, sorted by start_date
  const upcoming = data
    .filter(e => e.start_date && e.start_date >= today && daysUntil(e.start_date) <= 30)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  // In service: currently active (start_date <= today <= end_date)
  const inService = data.filter(e =>
    e.start_date && e.start_date <= today && e.end_date && e.end_date >= today
  )

  // Pipeline by stage
  const byStage = new Map<string, PipelineTrip[]>()
  for (const e of data) {
    const slug = e.status_slug ?? 'unknown'
    ;(byStage.get(slug) ?? byStage.set(slug, []).get(slug)!).push(e)
  }

  // Totals
  const totalValue      = data.reduce((s, e) => s + (e.total_rate ?? 0), 0)
  const totalCommission = data.reduce((s, e) => s + e.total_commission, 0)
  const totalReceived   = data.reduce((s, e) => s + e.commission_received, 0)
  const totalOutstanding= data.reduce((s, e) => s + e.commission_outstanding, 0)
  const totalMargin     = data.reduce((s, e) => s + e.net_margin, 0)

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
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 4 }}>
          ambience
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          Dashboard
        </div>
      </div>

      {/* Money strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <Kpi label='Pipeline Value'        value={usd(totalValue)} accent={A.gold} />
        <Kpi label='Total Commission'      value={usd(totalCommission)} sub={`${usd(totalReceived)} received`} accent={A.gold} />
        <Kpi label='Commission Outstanding' value={usd(totalOutstanding)} color={totalOutstanding > 0 ? '#FBBF24' : A.text} accent={totalOutstanding > 0 ? '#FBBF24' : undefined} />
        <Kpi label='Net Margin'            value={usd(totalMargin)} color={totalMargin >= 0 ? '#4ade80' : '#ef4444'} accent={totalMargin >= 0 ? '#4ade80' : '#ef4444'} />
        <Kpi label='Active Engagements'    value={String(data.length)} />
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

      {/* In Service (currently traveling) */}
      {inService.length > 0 && (
        <Section title='Currently Traveling' count={inService.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {inService.map(e => <UpcomingRow key={e.engagement_id} engagement={e} onClick={() => goTo(e)} />)}
          </div>
        </Section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section title='Upcoming' count={upcoming.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {upcoming.map(e => <UpcomingRow key={e.engagement_id} engagement={e} onClick={() => goTo(e)} />)}
          </div>
        </Section>
      )}

      {/* Pipeline by stage */}
      <Section title='Pipeline'>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {['confirmed', 'paid', 'in_service', 'closed_won'].map(slug => {
            const group = byStage.get(slug) ?? []
            if (group.length === 0) return null
            const meta = STAGE_META[slug] ?? { label: slug, color: A.muted }
            const value = group.reduce((s, e) => s + (e.total_rate ?? 0), 0)
            return (
              <Kpi
                key={slug}
                label={meta.label}
                value={String(group.length)}
                sub={usd(value)}
                accent={meta.color}
              />
            )
          })}
        </div>

        {/* Full pipeline list */}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: `1px solid ${A.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 90px', padding: '8px 16px', background: A.bgCard }}>
            {['Engagement', 'Value', 'Comm.', 'Received', 'Margin'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, textAlign: h === 'Engagement' ? 'left' : 'right' }}>{h}</div>
            ))}
          </div>
          {data.map((e, i) => {
            const meta = STAGE_META[e.status_slug ?? ''] ?? { label: e.status_slug ?? '', color: A.faint }
            return (
              <button
                key={e.engagement_id}
                onClick={() => goTo(e)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 90px',
                  padding: '12px 16px', background: i % 2 === 0 ? A.bg : A.bgCard,
                  border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(216,181,106,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? A.bg : A.bgCard}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font, marginBottom: 2 }}>{e.title ?? e.url_id}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {e.trip_code && <span style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>{e.trip_code}</span>}
                    {e.start_date && <span style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{fmtDate(e.start_date)}{e.end_date ? ` \u2013 ${fmtDate(e.end_date)}` : ''}</span>}
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: meta.color, fontFamily: A.font }}>{meta.label}</span>
                  </div>
                </div>
                {[
                  { v: e.total_rate ?? 0, c: A.text },
                  { v: e.total_commission, c: A.text },
                  { v: e.commission_received, c: '#4ade80' },
                  { v: e.net_margin, c: e.net_margin >= 0 ? '#4ade80' : '#ef4444' },
                ].map((col, ci) => (
                  <div key={ci} style={{ fontSize: 13, fontWeight: 700, color: col.c, fontFamily: A.font, textAlign: 'right' }}>
                    {col.v !== 0 ? usd(col.v) : <span style={{ color: A.faint }}>\u2014</span>}
                  </div>
                ))}
              </button>
            )
          })}
        </div>
      </Section>
    </div>
  )
}