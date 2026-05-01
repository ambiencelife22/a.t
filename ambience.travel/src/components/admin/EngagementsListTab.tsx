/* EngagementsListTab.tsx
 * Engagement list view for AmbienceAdmin.
 *
 * Trip-grouped collapsible structure (S33):
 *   - Top-level rows are trips (canonical travel_trips)
 *   - Each trip expands to show its engagement iterations (v1/v2/...)
 *   - Engagements with trip_id=NULL collected into an "Unlinked" group
 *     pinned to the bottom
 *   - Within a group, engagements ordered by created_at ASC
 *
 * Inline edit of engagement_status_id + itinerary_status_id on each
 * engagement card. View opens guest URL in new tab. Edit navigates to
 * detail tab. + New Engagement opens create modal.
 *
 * Last updated: S33
 */

import { useEffect, useMemo, useState } from 'react'
import {
  fetchEngagementList,
  fetchEngagementStatuses,
  fetchItineraryStatuses,
  updateEngagementStatus,
  fetchMaxSortOrder,
  createEngagement,
  groupByTrip,
  type EngagementListRow,
  type StatusLookup,
  type TripGroup,
} from '../../lib/adminEngagementQueries'
import {
  buildEngagementUrl,
  navigateAdmin,
  generateUrlId,
} from '../../lib/adminPath'
import { A } from '../../lib/adminTokens'

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position:     'fixed',
      bottom:       32,
      right:        32,
      zIndex:       9999,
      padding:      '12px 20px',
      borderRadius: 12,
      background:   type === 'success' ? '#1a2e1a' : '#2e1a1a',
      border:       `1px solid ${type === 'success' ? A.positive + '50' : A.danger + '50'}`,
      color:        type === 'success' ? A.positive : A.danger,
      fontSize:     13,
      fontFamily:   A.font,
      fontWeight:   600,
      boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {message}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }
  return { toast, showToast }
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inlineSelectStyle: React.CSSProperties = {
  background:   A.bgInput,
  border:       `1px solid ${A.border}`,
  borderRadius: 8,
  padding:      '5px 10px',
  fontSize:     11,
  color:        A.text,
  fontFamily:   A.font,
  outline:      'none',
  cursor:       'pointer',
}

const btnPrimary: React.CSSProperties = {
  padding:       '8px 18px',
  background:    `rgba(216,181,106,0.12)`,
  color:         A.gold,
  border:        `1px solid rgba(216,181,106,0.30)`,
  borderRadius:  10,
  fontSize:      12,
  fontWeight:    700,
  fontFamily:    A.font,
  cursor:        'pointer',
  letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding:      '7px 16px',
  background:   'transparent',
  color:        A.muted,
  border:       `1px solid ${A.border}`,
  borderRadius: 10,
  fontSize:     12,
  fontWeight:   600,
  fontFamily:   A.font,
  cursor:       'pointer',
  textDecoration: 'none',
  display:      'inline-flex',
  alignItems:   'center',
  gap:          4,
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   A.bgInput,
  border:       `1px solid ${A.border}`,
  borderRadius: 10,
  padding:      '10px 14px',
  fontSize:     13,
  color:        A.text,
  fontFamily:   A.font,
  outline:      'none',
  boxSizing:    'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color:         A.faint,
  fontFamily:    A.font,
  marginBottom:  6,
  display:       'block',
}

// ── Audience pill ────────────────────────────────────────────────────────────

function AudiencePill({ audience, isTemplate }: { audience: 'private' | 'public'; isTemplate: boolean | null }) {
  const isPublic = audience === 'public'
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      padding:       '3px 10px',
      borderRadius:  100,
      border:        `1px solid ${isPublic ? A.borderGold : A.border}`,
      color:         isPublic ? A.gold : A.muted,
      background:    isPublic ? 'rgba(216,181,106,0.06)' : 'transparent',
      fontFamily:    A.font,
    }}>
      {audience}
      {isTemplate && <span style={{ color: A.gold }}>★</span>}
    </span>
  )
}

// ── Engagement card (one per row inside a group) ─────────────────────────────

function EngagementCard({
  row,
  engagementStatuses,
  itineraryStatuses,
  onStatusChange,
}: {
  row: EngagementListRow
  engagementStatuses: StatusLookup[]
  itineraryStatuses:  StatusLookup[]
  onStatusChange: (
    row: EngagementListRow,
    field: 'engagement_status_id' | 'itinerary_status_id',
    value: string,
  ) => void
}) {
  const hasIterationLabel = row.iteration_label && row.iteration_label.length > 0

  return (
    <div style={{
      background:    A.bg,
      border:        `1px solid ${A.border}`,
      borderRadius:  12,
      padding:       '14px 18px',
      display:       'flex',
      flexDirection: 'column',
      gap:           10,
    }}>
      {/* Top: title + audience */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font }}>
          {row.title || <span style={{ color: A.faint, fontStyle: 'italic' }}>(untitled)</span>}
        </div>
        <AudiencePill audience={row.audience} isTemplate={row.is_public_template} />
      </div>

      {/* Identifier row: url_id [· iteration_label] */}
      <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>
        {row.url_id ?? '—'}
        {hasIterationLabel && (
          <span style={{ color: A.muted, fontFamily: A.font }}> · {row.iteration_label}</span>
        )}
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
            Engagement
          </span>
          <select
            style={inlineSelectStyle}
            value={row.engagement_status_id}
            onChange={e => onStatusChange(row, 'engagement_status_id', e.target.value)}
          >
            {engagementStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
            Itinerary
          </span>
          <select
            style={inlineSelectStyle}
            value={row.itinerary_status_id}
            onChange={e => onStatusChange(row, 'itinerary_status_id', e.target.value)}
          >
            {itineraryStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
        {row.url_id && (
          <a
            href={buildEngagementUrl(row.url_id)}
            target='_blank'
            rel='noopener noreferrer'
            style={{ ...btnGhost, color: A.gold, borderColor: A.borderGold }}
          >
            View ↗
          </a>
        )}
        {row.url_id && (
          <button
            onClick={() => navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: row.url_id! })}
            style={btnGhost}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ── Trip group (collapsible) ─────────────────────────────────────────────────

function TripGroupBlock({
  group,
  expanded,
  onToggle,
  engagementStatuses,
  itineraryStatuses,
  onStatusChange,
}: {
  group: TripGroup
  expanded: boolean
  onToggle: () => void
  engagementStatuses: StatusLookup[]
  itineraryStatuses:  StatusLookup[]
  onStatusChange: (
    row: EngagementListRow,
    field: 'engagement_status_id' | 'itinerary_status_id',
    value: string,
  ) => void
}) {
  const isOrphan = group.trip_id == null
  const heading = isOrphan
    ? 'Unlinked'
    : (group.client_display
        ? `${group.client_display}'s ${group.trip_public_title ?? 'Trip'}`
        : (group.trip_public_title ?? group.trip_code ?? 'Untitled Trip'))

  const sublineParts: string[] = []
  if (!isOrphan) {
    if (group.trip_code) sublineParts.push(group.trip_code)
    if (group.trip_start_date) sublineParts.push(group.trip_start_date)
  }
  const subline = sublineParts.join(' · ')

  return (
    <div style={{
      background:   A.bgCard,
      border:       `1px solid ${A.border}`,
      borderRadius: 14,
      overflow:     'hidden',
    }}>
      {/* Header — clickable toggle */}
      <div
        onClick={onToggle}
        style={{
          padding:      '16px 20px',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          gap:          12,
          cursor:       'pointer',
          background:   expanded ? 'rgba(216,181,106,0.03)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{
            fontSize:   12,
            color:      A.faint,
            fontFamily: A.font,
            transition: 'transform 0.15s ease',
            transform:  expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            display:    'inline-block',
            width:      12,
            textAlign:  'center',
          }}>
            ▸
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize:   isOrphan ? 13 : 15,
              fontWeight: 700,
              color:      isOrphan ? A.muted : A.text,
              fontFamily: A.font,
              fontStyle:  isOrphan ? 'italic' : 'normal',
            }}>
              {heading}
            </div>
            {subline && (
              <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                {subline}
              </div>
            )}
          </div>
        </div>
        <div style={{
          fontSize:   10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:      A.faint,
          fontFamily: A.font,
        }}>
          {group.engagements.length} · {group.engagements.length === 1 ? 'engagement' : 'engagements'}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{
          padding:    '0 20px 20px',
          display:    'flex',
          flexDirection: 'column',
          gap:        10,
        }}>
          {group.engagements.map(row => (
            <EngagementCard
              key={row.id}
              row={row}
              engagementStatuses={engagementStatuses}
              itineraryStatuses={itineraryStatuses}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({
  engagementStatuses,
  itineraryStatuses,
  onClose,
  onCreated,
  showToast,
}: {
  engagementStatuses: StatusLookup[]
  itineraryStatuses:  StatusLookup[]
  onClose:            () => void
  onCreated:          (urlId: string) => void
  showToast:          (msg: string, type: 'success' | 'error') => void
}) {
  const newRequestStatus = engagementStatuses.find(s => s.slug === 'new_request')
  const draftStatus      = itineraryStatuses.find(s => s.slug === 'draft')

  const [urlId, setUrlId]                          = useState(() => generateUrlId())
  const [title, setTitle]                          = useState('')
  const [iterationLabel, setIterationLabel]        = useState('')
  const [audience, setAudience]                    = useState<'private' | 'public'>('private')
  const [isPublicTemplate, setIsPublicTemplate]    = useState(false)
  const [engagementType, setEngagementType]        = useState('journey')
  const [tripFormat, setTripFormat]                = useState('journey')
  const [engagementStatusId, setEngagementStatusId] = useState(newRequestStatus?.id ?? '')
  const [itineraryStatusId,  setItineraryStatusId]  = useState(draftStatus?.id ?? '')
  const [saving, setSaving]                        = useState(false)

  async function handleCreate() {
    if (!title.trim()) {
      showToast('Title is required.', 'error')
      return
    }
    if (!engagementStatusId || !itineraryStatusId) {
      showToast('Statuses are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const sortOrder = await fetchMaxSortOrder()
      const newUrlId = await createEngagement({
        url_id:               urlId,
        title:                title.trim(),
        audience,
        is_public_template:   isPublicTemplate,
        engagement_type:      engagementType,
        trip_format:          tripFormat,
        journey_types:        [],
        engagement_status_id: engagementStatusId,
        itinerary_status_id:  itineraryStatusId,
        sort_order:           sortOrder,
        iteration_label:      iterationLabel.trim(),
      })
      showToast('Engagement created.', 'success')
      onCreated(newUrlId)
    } catch (e: any) {
      showToast(`Failed to create: ${e.message ?? 'unknown error'}`, 'error')
    }
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px', overflowY: 'auto',
    }}>
      <div style={{
        background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
              New Engagement
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              Create
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>url_id</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, fontFamily: 'DM Mono, monospace', flex: 1 }}
                value={urlId}
                onChange={e => setUrlId(e.target.value)}
                maxLength={11}
              />
              <button onClick={() => setUrlId(generateUrlId())} style={btnGhost}>↻ Regen</button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              style={inputStyle}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='e.g. Honeymoon'
            />
          </div>

          <div>
            <label style={labelStyle}>Iteration Label (optional)</label>
            <input
              style={inputStyle}
              value={iterationLabel}
              onChange={e => setIterationLabel(e.target.value)}
              placeholder='e.g. Saudi VVIP, Refresh, Pre-Saudi'
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Audience</label>
              <select style={inputStyle} value={audience} onChange={e => setAudience(e.target.value as any)}>
                <option value='private'>private</option>
                <option value='public'>public</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Public Template?</label>
              <select style={inputStyle} value={String(isPublicTemplate)} onChange={e => setIsPublicTemplate(e.target.value === 'true')}>
                <option value='false'>No</option>
                <option value='true'>Yes</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Engagement Type</label>
              <select style={inputStyle} value={engagementType} onChange={e => setEngagementType(e.target.value)}>
                <option value='journey'>journey</option>
                <option value='service'>service</option>
                <option value='experience'>experience</option>
                <option value='acquisition'>acquisition</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trip Format</label>
              <select style={inputStyle} value={tripFormat} onChange={e => setTripFormat(e.target.value)}>
                <option value='journey'>journey</option>
                <option value='experience'>experience</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Engagement Status</label>
              <select style={inputStyle} value={engagementStatusId} onChange={e => setEngagementStatusId(e.target.value)}>
                {engagementStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Itinerary Status</label>
              <select style={inputStyle} value={itineraryStatusId} onChange={e => setItineraryStatusId(e.target.value)}>
                {itineraryStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${A.border}` }}>
          <button onClick={handleCreate} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Creating…' : 'Create Engagement'}
          </button>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EngagementsListTab() {
  const [rows, setRows]                             = useState<EngagementListRow[]>([])
  const [engagementStatuses, setEngagementStatuses] = useState<StatusLookup[]>([])
  const [itineraryStatuses,  setItineraryStatuses]  = useState<StatusLookup[]>([])
  const [loading, setLoading]                       = useState(true)
  const [showCreate, setShowCreate]                 = useState(false)
  const [collapsedKeys, setCollapsedKeys]           = useState<Set<string>>(new Set())
  const { toast, showToast }                        = useToast()

  async function load() {
    setLoading(true)
    try {
      const [list, eng, it] = await Promise.all([
        fetchEngagementList(),
        fetchEngagementStatuses(),
        fetchItineraryStatuses(),
      ])
      setRows(list)
      setEngagementStatuses(eng)
      setItineraryStatuses(it)
    } catch (e: any) {
      showToast(`Failed to load: ${e.message ?? 'unknown error'}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const groups = useMemo(() => groupByTrip(rows), [rows])

  // Group key for collapse-state tracking (orphan group keyed as '__orphan__')
  function groupKey(g: TripGroup): string {
    return g.trip_id ?? '__orphan__'
  }

  function toggle(g: TripGroup) {
    const key = groupKey(g)
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleStatusChange(
    row: EngagementListRow,
    field: 'engagement_status_id' | 'itinerary_status_id',
    value: string,
  ) {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: value } : r))
    try {
      await updateEngagementStatus(row.id, field, value)
      showToast('Status updated.', 'success')
      load()
    } catch (e: any) {
      showToast(`Failed: ${e.message ?? 'unknown error'}`, 'error')
      load()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
            Admin · Immerse
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
            Engagements
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ New Engagement</button>
      </div>

      {/* Empty / loading */}
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>Loading…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>No engagements yet.</div>
      )}

      {/* Trip groups */}
      {!loading && groups.map(group => {
        const key = groupKey(group)
        const expanded = !collapsedKeys.has(key)
        return (
          <TripGroupBlock
            key={key}
            group={group}
            expanded={expanded}
            onToggle={() => toggle(group)}
            engagementStatuses={engagementStatuses}
            itineraryStatuses={itineraryStatuses}
            onStatusChange={handleStatusChange}
          />
        )
      })}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          engagementStatuses={engagementStatuses}
          itineraryStatuses={itineraryStatuses}
          onClose={() => setShowCreate(false)}
          onCreated={(newUrlId) => {
            setShowCreate(false)
            navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: newUrlId })
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}