/* TimeTrackingTab.tsx
 * Standalone admin surface for time tracking (route: /admin/time).
 *
 * Composes three prop-driven sub-components so each lifts unchanged into the
 * universal EngagementEditorPage later:
 *   TimeEntryForm     -- log an entry (house-first, engagement auto-resolves)
 *   TimeEntriesList   -- recent entries with inline edit / delete
 *   TimeSummaryPanel  -- hours + (dormant) cost rollup per house / engagement
 *
 * All data access via queriesTime.ts -> travel-(read|write)-timetracking EFs.
 * No direct table access. House <-> engagement resolves through travel_bookings.
 *
 * Last updated: S53C -- new file.
 */

import { useEffect, useState, useCallback } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { AdminSection, AdminCard, AdminEmptyState, useAdminToast } from './_adminPrimitives'
import {
  fetchTimeActivities, fetchTimeRates, fetchTimeEntries,
  fetchHouses, fetchHousePeople, fetchEngagementsForHouse, fetchHouseForEngagement,
  fetchTimeSummaryByEngagement,
  createTimeEntry, updateTimeEntry, deleteTimeEntry,
  type TimeActivity, type TimeRate, type TimeEntry, type TimeEntryInput,
  type HouseOption, type HouseMember, type EngagementOption, type TimeSummary,
} from '../../queries/queriesTime'
import {
  fetchTeamMembers, fetchTeamMemberByPerson,
  type TeamMember,
} from '../../queries/queriesTeam'
import { supabase } from '../../lib/supabase'

// ── Shared styles (mirrors EngagementDetailTab grammar) ───────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: A.faint, fontFamily: A.font, marginBottom: 6, display: 'block',
}
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(216,181,106,0.12)', color: A.gold,
  border: '1px solid rgba(216,181,106,0.30)', borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer', letterSpacing: '0.04em',
}
const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: A.danger,
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
  fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// 0.25-step hours options, up to 5.0
const HOURS_OPTIONS: number[] = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.25)

// ── HouseTypeahead (mirrors PersonTypeahead) ──────────────────────────────────

function HouseTypeahead({
  value, displayName, onChange,
}: {
  value: string | null
  displayName: string | null
  onChange: (id: string | null, name: string | null) => void
}) {
  const [query, setQuery]     = useState('')
  const [options, setOptions] = useState<HouseOption[]>([])
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      fetchHouses(query).then(setOptions).catch(() => setOptions([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query, open])

  if (value && !open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          background: A.bgInput, border: `1px solid ${A.border}`,
          fontSize: 13, color: A.text, fontFamily: A.font,
        }}>
          {displayName ?? '(house)'}
        </div>
        <button onClick={() => { setOpen(true); setQuery('') }} style={btnGhost}>Change</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder='Search houses...'
        autoFocus={open}
      />
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 10,
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map(h => (
            <div
              key={h.id}
              onClick={() => { onChange(h.id, h.display_name); setOpen(false); setQuery('') }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                color: A.text, fontFamily: A.font, borderBottom: `1px solid ${A.border}`,
              }}
            >
              {h.display_name ?? '(unnamed)'}
              {h.a_house_id && <span style={{ color: A.faint, marginLeft: 8, fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{h.a_house_id}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TimeEntryForm ─────────────────────────────────────────────────────────────
// Prop-driven: scopeHouseId / scopeEngagementId pre-bind it inside the universal
// surface later. Standalone passes neither.

function TimeEntryForm({
  activities, rates, scopeHouseId, scopeEngagementId, onSaved,
}: {
  activities: TimeActivity[]
  rates: TimeRate[]
  scopeHouseId?: string
  scopeEngagementId?: string
  onSaved: () => void
}) {
  const toast = useAdminToast()

  const [houseId, setHouseId]       = useState<string | null>(scopeHouseId ?? null)
  const [houseName, setHouseName]   = useState<string | null>(null)
  const [engagementId, setEngId]    = useState<string | null>(scopeEngagementId ?? null)
  const [engagements, setEngs]      = useState<EngagementOption[]>([])
  const [members, setMembers]       = useState<HouseMember[]>([])
  const [housePersonId, setPerson]  = useState<string | null>(null)

  const [workDate, setWorkDate]     = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [hours, setHours]           = useState<number>(0.25)
  const [activityId, setActivity]   = useState<string | null>(null)
  const [entryType, setEntryType]   = useState<'billable' | 'proactive'>('billable')
  const [isInvoiceable, setInvoiceable] = useState<boolean>(false)
  const [rateId, setRateId]         = useState<string | null>(null)
  const [team, setTeam]             = useState<TeamMember[]>([])
  const [performedById, setPerformedById] = useState<string | null>(null)  // global_people id
  const [notes, setNotes]           = useState<string>('')
  const [saving, setSaving]         = useState(false)

  // House selected -> load its engagements + members
  useEffect(() => {
    if (!houseId) { setEngs([]); setMembers([]); return }
    fetchEngagementsForHouse(houseId).then(setEngs).catch(() => setEngs([]))
    fetchHousePeople(houseId).then(setMembers).catch(() => setMembers([]))
  }, [houseId])

  // Load active team for the Performed By picker; default to the logged-in
  // admin's own team person (the eventual auth-driven default, modelled now).
  useEffect(() => {
    let alive = true
    fetchTeamMembers().then(t => { if (alive) setTeam(t) }).catch(() => {})
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) return
      const { data: prof } = await supabase
        .from('global_profiles').select('person_id').eq('id', uid).maybeSingle()
      const pid = prof?.person_id ?? null
      if (!pid) return
      const me = await fetchTeamMemberByPerson(pid).catch(() => null)
      if (alive && me) {
        setPerformedById(me.person_id)
        if (me.default_rate_id) setRateId(prev => prev ?? me.default_rate_id)
      }
    })()
    return () => { alive = false }
  }, [])

  // Selecting a performer auto-fills their default rate (overridable).
  function selectPerformer(personId: string | null) {
    setPerformedById(personId)
    const m = team.find(t => t.person_id === personId)
    if (m?.default_rate_id) setRateId(m.default_rate_id)
  }

  // Engagement selected without a house -> auto-resolve house via bookings hub
  function selectEngagement(id: string | null) {
    setEngId(id)
    if (id && !houseId) {
      fetchHouseForEngagement(id).then(h => {
        if (h) { setHouseId(h.id); setHouseName(h.display_name) }
      }).catch(() => {})
    }
  }

  async function handleSave() {
    if (!houseId) { toast.error('Pick a house first.'); return }
    setSaving(true)
    try {
      const input: TimeEntryInput = {
        house_id: houseId,
        iteration_id: engagementId,
        house_person_id: housePersonId,
        work_date: workDate,
        hours,
        activity_id: activityId,
        notes: notes.trim() || null,
        entry_type: entryType,
        is_invoiceable: isInvoiceable,
        performed_by_person_id: performedById,
        rate_id: rateId,
      }
      await createTimeEntry(input)
      toast.success('Time entry logged.')
      // Reset the variable fields, keep house/engagement scope for fast repeat entry
      setHours(0.25); setActivity(null); setNotes(''); setEntryType('billable'); setInvoiceable(false)
      onSaved()
    } catch (e: any) {
      toast.error(`Failed: ${e.message ?? 'unknown error'}`)
    }
    setSaving(false)
  }

  return (
    <AdminSection title='Log Time'>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
        {!scopeHouseId && (
          <Field label='House'>
            <HouseTypeahead
              value={houseId}
              displayName={houseName}
              onChange={(id, name) => { setHouseId(id); setHouseName(name); setEngId(null); setPerson(null) }}
            />
          </Field>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {!scopeEngagementId && (
            <Field label='Engagement (optional)'>
              <select
                style={inputStyle}
                value={engagementId ?? ''}
                onChange={e => selectEngagement(e.target.value || null)}
              >
                <option value=''>None</option>
                {engagements.map(en => (
                  <option key={en.id} value={en.id}>
                    {en.title ?? en.url_id ?? '(untitled)'}
                    {en.iteration_label ? ` - ${en.iteration_label}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label='Person (optional)'>
            <select
              style={inputStyle}
              value={housePersonId ?? ''}
              onChange={e => setPerson(e.target.value || null)}
              disabled={!houseId}
            >
              <option value=''>Whole house</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.display_name ?? m.member_ref ?? '(member)'}{m.role ? ` (${m.role})` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label='Date of Work'>
            <input type='date' style={inputStyle} value={workDate} onChange={e => setWorkDate(e.target.value)} />
          </Field>
          <Field label='Hours'>
            <select style={inputStyle} value={hours} onChange={e => setHours(Number(e.target.value))}>
              {HOURS_OPTIONS.map(h => <option key={h} value={h}>{h.toFixed(2)}</option>)}
            </select>
          </Field>
          <Field label='Type'>
            <select style={inputStyle} value={entryType} onChange={e => setEntryType(e.target.value as any)}>
              <option value='billable'>Billable</option>
              <option value='proactive'>Proactive</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Activity (optional)'>
            <select style={inputStyle} value={activityId ?? ''} onChange={e => setActivity(e.target.value || null)}>
              <option value=''>None</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
          <Field label='Rate (optional, internal)'>
            <select style={inputStyle} value={rateId ?? ''} onChange={e => setRateId(e.target.value || null)}>
              <option value=''>No rate</option>
              {rates.map(r => <option key={r.id} value={r.id}>{r.role_label} ({r.currency} {r.hourly_rate})</option>)}
            </select>
          </Field>
        </div>

        <Field label='Performed By'>
          <select style={inputStyle} value={performedById ?? ''} onChange={e => selectPerformer(e.target.value || null)}>
            <option value=''>Unassigned</option>
            {team.map(m => (
              <option key={m.person_id} value={m.person_id}>
                {m.display_name}{m.role !== 'member' ? ` (${m.role})` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label='Invoiceable to client?'>
          <select style={inputStyle} value={isInvoiceable ? 'yes' : 'no'} onChange={e => setInvoiceable(e.target.value === 'yes')}>
            <option value='no'>Tracked value only (not invoiced)</option>
            <option value='yes'>Invoiceable (bill to client)</option>
          </select>
          {(() => {
            const r = rates.find(x => x.id === rateId)
            if (!r) return null
            const val = (r.hourly_rate * hours)
            return (
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
                Effort value: {r.currency} {val.toFixed(2)} · {isInvoiceable ? `invoiced: ${r.currency} ${val.toFixed(2)}` : 'invoiced: 0'}
              </div>
            )
          })()}
        </Field>

        <Field label='Notes (optional)'>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 70, lineHeight: 1.6 }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving...' : 'Log Entry'}
          </button>
        </div>
      </div>
    </AdminSection>
  )
}

// ── TimeEntriesList ───────────────────────────────────────────────────────────

function TimeEntriesList({
  entries, onChanged,
}: {
  entries: TimeEntry[]
  onChanged: () => void
}) {
  const toast = useAdminToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setBusyId(id)
    try {
      await deleteTimeEntry(id)
      toast.success('Entry deleted.')
      onChanged()
    } catch (e: any) {
      toast.error(`Failed: ${e.message ?? 'unknown error'}`)
    }
    setBusyId(null)
  }

  if (entries.length === 0) {
    return <AdminEmptyState message='No time entries yet. Log your first above.' />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((e, i) => (
        <AdminCard key={e.id} staggerIndex={i}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                  {e.hours.toFixed(2)}h
                </span>
                <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
                  {e.travel_time_activities?.label ?? 'Unspecified'}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: e.entry_type === 'billable' ? A.gold : A.muted, fontFamily: A.font,
                }}>
                  {e.entry_type}
                </span>
                {e.billable_amount != null && (
                  <span style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace' }}>
                    {e.travel_time_rates?.currency ?? 'USD'} {e.billable_amount.toFixed(2)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                {e.work_date}
                {(() => {
                  const p = e.performer
                  const name = p
                    ? (p.nickname || [p.first_name, p.last_name].filter(Boolean).join(' '))
                    : e.performed_by
                  return name ? ` · ${name}` : ''
                })()}
              </div>
              {e.notes && (
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.5 }}>
                  {e.notes}
                </div>
              )}
            </div>
            <button
              onClick={() => handleDelete(e.id)}
              disabled={busyId === e.id}
              style={{ ...btnDanger, opacity: busyId === e.id ? 0.5 : 1, flexShrink: 0 }}
            >
              {busyId === e.id ? '...' : 'Delete'}
            </button>
          </div>
        </AdminCard>
      ))}
    </div>
  )
}

// ── TimeSummaryPanel ──────────────────────────────────────────────────────────

function TimeSummaryPanel({ summary }: { summary: Record<string, TimeSummary> }) {
  const keys = Object.keys(summary)
  if (keys.length === 0) return null

  const totalHours  = keys.reduce((s, k) => s + summary[k].hours, 0)
  const totalAmount = keys.reduce((s, k) => s + summary[k].amount, 0)

  return (
    <AdminSection title='Effort Summary (by engagement)'>
      <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 10, paddingTop: 4 }}>
        Cost is internal only. Not surfaced to clients.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {keys.map(k => (
          <div key={k} style={{ padding: '12px 14px', borderRadius: 10, background: A.bgInput, border: `1px solid ${A.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: 'DM Mono, monospace', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {k === '__unassigned__' ? 'No engagement' : k.slice(0, 8)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {summary[k].hours.toFixed(2)}h
            </div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
              USD {summary[k].amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${A.border}`, display: 'flex', gap: 24 }}>
        <span style={{ fontSize: 13, color: A.text, fontFamily: A.font }}>
          <strong>{totalHours.toFixed(2)}h</strong> total
        </span>
        <span style={{ fontSize: 13, color: A.muted, fontFamily: 'DM Mono, monospace' }}>
          USD {totalAmount.toFixed(2)}
        </span>
      </div>
    </AdminSection>
  )
}

// ── Composing shell ───────────────────────────────────────────────────────────

export default function TimeTrackingTab() {
  const [activities, setActivities] = useState<TimeActivity[]>([])
  const [rates, setRates]           = useState<TimeRate[]>([])
  const [entries, setEntries]       = useState<TimeEntry[]>([])
  const [summary, setSummary]       = useState<Record<string, TimeSummary>>({})
  const [loading, setLoading]       = useState(true)

  const loadEntries = useCallback(async () => {
    const [es, sm] = await Promise.all([
      fetchTimeEntries(),
      fetchTimeSummaryByEngagement(),
    ])
    setEntries(es)
    setSummary(sm)
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [acts, rts] = await Promise.all([fetchTimeActivities(), fetchTimeRates()])
        setActivities(acts)
        setRates(rts)
        await loadEntries()
      } catch {
        // toast handled by callers; keep shell resilient
      }
      setLoading(false)
    })()
  }, [loadEntries])

  if (loading) {
    return <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Time Tracking
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          Effort Log
        </div>
      </div>

      <TimeEntryForm activities={activities} rates={rates} onSaved={loadEntries} />
      <TimeSummaryPanel summary={summary} />
      <AdminSection title='Recent Entries'>
        <div style={{ paddingTop: 8 }}>
          <TimeEntriesList entries={entries} onChanged={loadEntries} />
        </div>
      </AdminSection>
    </div>
  )
}