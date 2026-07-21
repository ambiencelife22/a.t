/* RequestsSection.tsx
 * Travel Requests surface for HouseTab.
 *
 * Displays all travel_requests for a household, grouped by status.
 * Add form captures: request body, channel, received_at, optional trip ref.
 * Status updates optimistic via inline select.
 *
 * Data fetched in HouseDetail.loadAll via fetchRequestsForHouse and
 * passed in as TravelRequest[]. onReload triggers a full loadAll refresh.
 *
 * Last updated: S44 - initial ship.
 */

import { useState, useMemo } from 'react'
import { formatDateShort, fmtTime } from '../../utils/utilsDates'
import { A } from '../../tokens/tokensAdmin'
import {
  inputStyle, textareaStyle,
  btnPrimary as btnP, btnGhost as btnG, btnDanger as btnD,
} from '../../styles/stylesAdmin'
import { Field } from './adminUi'
import { AdminSection, AdminEmptyState, useAdminToast } from './_adminPrimitives'
import {
  createRequest, updateRequest, deleteRequest,
  REQUEST_STATUSES, REQUEST_CHANNELS,
  type TravelRequest, type RequestStatus, type RequestChannel,
} from '../../queries/queriesAdminRequests'
import { AddFormShell, EntryCard, FormActions, StatusFilterBar } from './houseUi'

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<RequestStatus, string> = {
  'New':           '#93c5fd',
  'In Progress':   '#fbbf24',
  'Proposal Sent': '#D8B56A',
  'Confirmed':     '#4ade80',
  'Closed':        '#6b7280',
}

const CHANNEL_ICON: Record<RequestChannel, string> = {
  WhatsApp: '💬',
  Email:    '✉️',
  Phone:    '📞',
  PA:       '👤',
  Other:    '·',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtReceived(iso: string): string {
  const datePart = iso.slice(0, 10)
  const timePart = iso.slice(11, 16)
  return `${formatDateShort(datePart)} · ${fmtTime(timePart)}`
}

function toDatetimeLocal(iso: string): string {
  // Converts ISO to datetime-local input value (YYYY-MM-DDTHH:MM)
  return iso.slice(0, 16)
}

function fromDatetimeLocal(val: string): string {
  // Converts datetime-local to full ISO - treat as local time
  return val ? new Date(val).toISOString() : new Date().toISOString()
}

// ── RequestCard ───────────────────────────────────────────────────────────────

function RequestCard({ req, onReload }: { req: TravelRequest; onReload: () => void }) {
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [draft, setDraft]         = useState<Partial<TravelRequest>>({})
  const { success, error }        = useAdminToast()
  const color                     = STATUS_COLOR[req.status]

  async function handleStatusChange(status: RequestStatus) {
    try {
      await updateRequest(req.id, { status })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function handleSave() {
    if (!draft.request_body?.trim()) return
    setSaving(true)
    try {
      await updateRequest(req.id, {
        request_body: draft.request_body?.trim(),
        channel:      draft.channel,
        handledBy:   draft.handledBy?.trim() || null,
        notes:        draft.notes?.trim() || null,
        receivedAt:  draft.receivedAt,
      })
      success('Saved.')
      setEditing(false)
      setDraft({})
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this request?')) return
    try { await deleteRequest(req.id); success('Deleted.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <EntryCard accentColor={color}>
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          onClick={() => { setExpanded(e => !e); setEditing(false) }}
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        >
          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            {req.channel && (
              <span style={{ fontSize: 11, fontFamily: A.font }}>
                {CHANNEL_ICON[req.channel]} <span style={{ color: A.muted }}>{req.channel}</span>
              </span>
            )}
            <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{fmtReceived(req.receivedAt)}</span>
            {req.handledBy && (
              <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>· {req.handledBy}</span>
            )}
          </div>
          {/* Body preview */}
          <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, lineHeight: 1.5, whiteSpace: expanded ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: expanded ? 'unset' : 'ellipsis' }}>
            {req.request_body}
          </div>
          {req.notes && expanded && (
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
              {req.notes}
            </div>
          )}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: A.font,
            color, padding: '2px 8px', borderRadius: 12,
            background: color + '15', border: `1px solid ${color}30`,
            whiteSpace: 'nowrap',
          }}>
            {req.status}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {!editing && (
              <button
                onClick={() => { setEditing(true); setExpanded(true); setDraft({ request_body: req.request_body, channel: req.channel ?? undefined, handledBy: req.handledBy ?? '', notes: req.notes ?? '', receivedAt: req.receivedAt }) }}
                style={{ ...btnG, padding: '3px 8px', fontSize: 10 }}
              >Edit</button>
            )}
            <button onClick={handleDelete} style={btnD}>x</button>
          </div>
        </div>
      </div>

      {/* Status selector - always visible when expanded */}
      {expanded && !editing && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font, whiteSpace: 'nowrap' }}>Status</span>
          <select
            value={req.status}
            onChange={e => handleStatusChange(e.target.value as RequestStatus)}
            style={{ ...inputStyle, padding: '5px 10px', fontSize: 11, width: 'auto', flex: 1 }}
          >
            {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {req.journeyId && (
            <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>Trip linked</span>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${A.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label='Request'>
            <textarea
              style={{ ...textareaStyle, minHeight: 80 }}
              value={draft.request_body ?? ''}
              onChange={e => setDraft(d => ({ ...d, request_body: e.target.value }))}
              autoFocus
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label='Channel'>
              <select style={inputStyle} value={draft.channel ?? ''} onChange={e => setDraft(d => ({ ...d, channel: e.target.value as RequestChannel || undefined }))}>
                <option value=''>Not set</option>
                {REQUEST_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label='Received'>
              <input
                type='datetime-local'
                style={{ ...inputStyle, colorScheme: 'dark' }}
                value={draft.receivedAt ? toDatetimeLocal(draft.receivedAt) : ''}
                onChange={e => setDraft(d => ({ ...d, receivedAt: e.target.value ? fromDatetimeLocal(e.target.value) : d.receivedAt }))}
              />
            </Field>
          </div>
          <Field label='Handled by'>
            <input style={inputStyle} placeholder='Name...' value={draft.handledBy ?? ''} onChange={e => setDraft(d => ({ ...d, handledBy: e.target.value }))} />
          </Field>
          <Field label='Notes'>
            <textarea style={{ ...textareaStyle, minHeight: 60 }} placeholder='Internal notes...' value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
          </Field>
          <FormActions onCancel={() => { setEditing(false); setDraft({}) }} onSave={handleSave} saving={saving} saveLabel='Save' />
        </div>
      )}
    </EntryCard>
  )
}

// ── RequestsSection - exported ────────────────────────────────────────────────

export function RequestsSection({ requests, houseId, onReload, mobile }: {
  requests: TravelRequest[]
  houseId:  string
  mobile:   boolean
  onReload: () => void
}) {
  const [filter, setFilter]   = useState<RequestStatus | 'all'>('all')
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const { success, error }    = useAdminToast()
  const [draft, setDraft]     = useState({
    request_body: '',
    channel:      '' as RequestChannel | '',
    receivedAt:  toDatetimeLocal(new Date().toISOString()),
    handledBy:   '',
    notes:        '',
  })

  const filtered = useMemo(() =>
    filter === 'all' ? requests : requests.filter(r => r.status === filter),
    [requests, filter]
  )

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: requests.length }
    for (const r of requests) m[r.status] = (m[r.status] ?? 0) + 1
    return m
  }, [requests])

  async function handleAdd() {
    if (!draft.request_body.trim()) return
    setSaving(true)
    try {
      await createRequest(
        houseId,
        draft.request_body.trim(),
        draft.channel || null,
        draft.receivedAt ? fromDatetimeLocal(draft.receivedAt) : null,
        null,
        null,
        draft.handledBy.trim() || null,
        draft.notes.trim() || null,
      )
      success('Request logged.')
      setAdding(false)
      setDraft({ request_body: '', channel: '', receivedAt: toDatetimeLocal(new Date().toISOString()), handledBy: '', notes: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatusFilterBar
        options={REQUEST_STATUSES}
        active={filter}
        onSelect={v => setFilter(v as RequestStatus | 'all')}
        labelFor={s => s === 'all' ? 'All' : s}
        colorFor={s => s === 'all' ? A.gold : STATUS_COLOR[s as RequestStatus]}
        counts={counts}
      >
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Log Request</button>}
      </StatusFilterBar>

      {adding && (
        <AddFormShell>
          <Field label='Request'>
            <textarea
              style={{ ...textareaStyle, minHeight: 90 }}
              placeholder='What did they ask for...'
              value={draft.request_body}
              onChange={e => setDraft(d => ({ ...d, request_body: e.target.value }))}
              autoFocus
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Channel'>
              <select style={inputStyle} value={draft.channel} onChange={e => setDraft(d => ({ ...d, channel: e.target.value as RequestChannel | '' }))}>
                <option value=''>Not set</option>
                {REQUEST_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_ICON[c]} {c}</option>)}
              </select>
            </Field>
            <Field label='Received'>
              <input
                type='datetime-local'
                style={{ ...inputStyle, colorScheme: 'dark' }}
                value={draft.receivedAt}
                onChange={e => setDraft(d => ({ ...d, receivedAt: e.target.value }))}
              />
            </Field>
          </div>
          <Field label='Handled by'>
            <input style={inputStyle} placeholder='Name...' value={draft.handledBy} onChange={e => setDraft(d => ({ ...d, handledBy: e.target.value }))} />
          </Field>
          <Field label='Notes (optional)'>
            <input style={inputStyle} placeholder='Internal context...' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
          </Field>
          <FormActions onCancel={() => setAdding(false)} onSave={handleAdd} saving={saving} saveLabel='Log Request' />
        </AddFormShell>
      )}

      {filtered.length === 0 ? (
        <AdminEmptyState message={filter === 'all' ? 'No requests logged yet.' : `No ${filter.toLowerCase()} requests.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* New requests get a section header to draw attention */}
          {filter === 'all' && counts['New'] > 0 && (
            <AdminSection title={`${counts['New']} New`} style={{ borderLeftColor: STATUS_COLOR['New'] + '80', marginBottom: 4 }} />
          )}
          {filtered.map(r => (
            <RequestCard key={r.id} req={r} onReload={onReload} />
          ))}
        </div>
      )}
    </div>
  )
}