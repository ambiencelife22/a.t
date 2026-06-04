/* TimeAnalyticsTab.tsx
 * Analytics surface for time tracking (#admin/time/analytics).
 * Filter bar -> summary tiles -> grouped breakdown -> date-desc entry list.
 * All aggregation is server-side (travel-read-timetracking 'analytics' mode);
 * this component only displays. Prop-driven sub-components so BreakdownTable can
 * later embed in EngagementEditorPage.
 *
 * S53C — initial ship.
 */

import { useEffect, useState, useCallback } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { AdminSection, AdminCard, AdminEmptyState } from './_adminPrimitives'
import {
  fetchTimeAnalytics, fetchHouses, fetchEngagementsForHouse, fetchTimeActivities,
  type TimeAnalyticsResult, type TimeAnalyticsFilters, type AnalyticsGroupBy,
  type HouseOption, type EngagementOption, type TimeActivity,
} from '../../queries/queriesTime'
import { fetchTeamMembers, type TeamMember } from '../../queries/queriesTeam'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 8, color: A.text, padding: '8px 10px', fontSize: 13,
  fontFamily: A.font, outline: 'none', colorScheme: 'dark',
}

const GROUP_LABELS: Record<AnalyticsGroupBy, string> = {
  house: 'House', engagement: 'Engagement', team: 'Team member', activity: 'Activity',
}
const GROUP_ORDER: AnalyticsGroupBy[] = ['house', 'engagement', 'team', 'activity']

// ── Summary tiles ─────────────────────────────────────────────────────────────

function SummaryTiles({ data }: { data: TimeAnalyticsResult | null }) {
  const s = data?.summary
  const tiles = [
    { label: 'Hours',        value: s ? s.hours.toLocaleString() : '—' },
    { label: 'Effort value', value: s ? money(s.effort_value) : '—' },
    { label: 'Invoiced',     value: s ? money(s.invoiced) : '—' },
    { label: 'Absorbed',     value: s ? money(s.absorbed) : '—', accent: true },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
      {tiles.map(t => (
        <div key={t.label} style={{
          background: A.bgCard, border: `1px solid ${t.accent ? A.borderGold : A.border}`,
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: A.muted, fontFamily: A.font }}>
            {t.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.accent ? A.gold : A.text, fontFamily: A.font, marginTop: 4 }}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Breakdown table ───────────────────────────────────────────────────────────

function BreakdownTable({ data, groupBy, onGroupBy }: {
  data: TimeAnalyticsResult | null
  groupBy: AnalyticsGroupBy
  onGroupBy: (g: AnalyticsGroupBy) => void
}) {
  const rows = data?.breakdown ?? []
  return (
    <AdminCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>Breakdown</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {GROUP_ORDER.map(g => (
            <button key={g} onClick={() => onGroupBy(g)} style={{
              background: g === groupBy ? 'rgba(216,181,106,0.12)' : 'transparent',
              border: `1px solid ${g === groupBy ? A.borderGold : A.border}`,
              color: g === groupBy ? A.gold : A.muted,
              borderRadius: 7, padding: '5px 10px', fontSize: 11, fontFamily: A.font,
              cursor: 'pointer', fontWeight: g === groupBy ? 600 : 400,
            }}>{GROUP_LABELS[g]}</button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: '8px 0' }}>No data for these filters.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: A.font }}>
          <thead>
            <tr style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: A.muted }}>
              <th style={{ textAlign: 'left',  padding: '6px 8px' }}>{GROUP_LABELS[groupBy]}</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Hours</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Effort value</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Invoiced</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Absorbed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={{ fontSize: 13, color: A.text, borderTop: `1px solid ${A.border}` }}>
                <td style={{ textAlign: 'left',  padding: '8px' }}>{r.label}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{r.hours}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{money(r.effort_value)}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{money(r.invoiced)}</td>
                <td style={{ textAlign: 'right', padding: '8px', color: A.gold }}>{money(r.absorbed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminCard>
  )
}

// ── Entry list (always date-desc) ─────────────────────────────────────────────

function EntryList({ data }: { data: TimeAnalyticsResult | null }) {
  const entries = data?.entries ?? []
  if (entries.length === 0) return null
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font, marginBottom: 10 }}>
        Entries ({entries.length})
      </div>
      {entries.map(e => (
        <div key={e.id} style={{
          background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10,
          padding: '10px 14px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>
              {e.house ?? '(no house)'}{e.engagement ? ` · ${e.engagement}` : ''}
            </div>
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
              {e.hours}h · {money(e.effort_value)}
              {e.is_invoiceable ? ` · invoiced ${money(e.billable_amount)}` : ' · not invoiced'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 3 }}>
            {e.work_date}{e.activity ? ` · ${e.activity}` : ''}{e.performer ? ` · ${e.performer}` : ''}
          </div>
          {e.notes && (
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {e.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TimeAnalyticsTab() {
  const [filters, setFilters] = useState<TimeAnalyticsFilters>({})
  const [groupBy, setGroupBy] = useState<AnalyticsGroupBy>('house')
  const [data, setData]       = useState<TimeAnalyticsResult | null>(null)
  const [loading, setLoading] = useState(true)

  // Filter option sources
  const [houses, setHouses]         = useState<HouseOption[]>([])
  const [engagements, setEngs]      = useState<EngagementOption[]>([])
  const [team, setTeam]             = useState<TeamMember[]>([])
  const [activities, setActivities] = useState<TimeActivity[]>([])

  useEffect(() => {
    fetchHouses('').then(setHouses).catch(() => {})
    fetchTeamMembers().then(setTeam).catch(() => {})
    fetchTimeActivities().then(setActivities).catch(() => {})
  }, [])

  // House filter -> load its engagements for the engagement dropdown
  useEffect(() => {
    if (!filters.house_id) { setEngs([]); return }
    fetchEngagementsForHouse(filters.house_id).then(setEngs).catch(() => setEngs([]))
  }, [filters.house_id])

  const load = useCallback(() => {
    setLoading(true)
    fetchTimeAnalytics(filters, groupBy)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [filters, groupBy])

  useEffect(() => { load() }, [load])

  function set<K extends keyof TimeAnalyticsFilters>(k: K, v: TimeAnalyticsFilters[K]) {
    setFilters(prev => {
      const next = { ...prev }
      if (v === undefined || v === '' as any) delete next[k]
      else next[k] = v
      // changing house clears engagement
      if (k === 'house_id') delete next.engagement_id
      return next
    })
  }

  return (
    <AdminSection title='Time Analytics' subtitle='Effort, value, and what is actually invoiced.'>
      {/* Filter bar */}
      <AdminCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            From
            <input type='date' style={inputStyle} value={filters.work_date_from ?? ''} onChange={e => set('work_date_from', e.target.value || undefined)} />
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            To
            <input type='date' style={inputStyle} value={filters.work_date_to ?? ''} onChange={e => set('work_date_to', e.target.value || undefined)} />
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            House
            <select style={inputStyle} value={filters.house_id ?? ''} onChange={e => set('house_id', e.target.value || undefined)}>
              <option value=''>All houses</option>
              {houses.map(h => <option key={h.id} value={h.id}>{h.display_name ?? h.a_house_id}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            Engagement
            <select style={inputStyle} value={filters.engagement_id ?? ''} onChange={e => set('engagement_id', e.target.value || undefined)} disabled={!filters.house_id}>
              <option value=''>{filters.house_id ? 'All engagements' : 'Pick a house first'}</option>
              {engagements.map(en => <option key={en.id} value={en.id}>{en.title}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            Team member
            <select style={inputStyle} value={filters.team_member_id ?? ''} onChange={e => set('team_member_id', e.target.value || undefined)}>
              <option value=''>Everyone</option>
              {team.map(m => <option key={m.person_id} value={m.person_id}>{m.display_name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            Activity
            <select style={inputStyle} value={filters.activity_id ?? ''} onChange={e => set('activity_id', e.target.value || undefined)}>
              <option value=''>All activities</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            Type
            <select style={inputStyle} value={filters.entry_type ?? ''} onChange={e => set('entry_type', (e.target.value || undefined) as any)}>
              <option value=''>All</option>
              <option value='billable'>Billable</option>
              <option value='proactive'>Proactive</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            Invoiceable
            <select style={inputStyle}
              value={filters.is_invoiceable === undefined ? '' : filters.is_invoiceable ? 'yes' : 'no'}
              onChange={e => set('is_invoiceable', e.target.value === '' ? undefined : e.target.value === 'yes')}>
              <option value=''>All</option>
              <option value='yes'>Invoiceable</option>
              <option value='no'>Not invoiced</option>
            </select>
          </label>
        </div>
      </AdminCard>

      <div style={{ height: 16 }} />
      <SummaryTiles data={data} />
      <BreakdownTable data={data} groupBy={groupBy} onGroupBy={setGroupBy} />
      {loading && <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 12 }}>Loading…</div>}
      {!loading && data && data.entries.length === 0 && (
        <AdminEmptyState message='No entries match these filters yet.' />
      )}
      <EntryList data={data} />
    </AdminSection>
  )
}