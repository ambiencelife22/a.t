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
 * S33B additions:
 *   - Drag-and-drop re-parenting via @dnd-kit. Engagement cards drag onto
 *     other group headers to switch trip_id. Drop on Unlinked sets NULL.
 *   - "+ Drop here to create new trip" zone — opens TripCreateModal which
 *     creates the trip and reassigns the engagement in one shot.
 *   - Click-to-edit on group header: client display name, public_title,
 *     trip_code. Blur or Enter commits. Esc reverts. Optimistic update
 *     with reload-on-error.
 *
 * Inline edit of engagement_status_id + itinerary_status_id stays as S33.
 *
 * Last updated: S33B
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import {
  fetchEngagementList,
  fetchEngagementStatuses,
  fetchItineraryStatuses,
  updateEngagementStatus,
  fetchMaxSortOrder,
  createEngagement,
  groupByTrip,
  updateTrip,
  updatePerson,
  reassignEngagementTrip,
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
import TripCreateModal from './TripCreateModal'

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

// ── Pencil icon (inline SVG, no icon library) ────────────────────────────────

function PencilIcon({ size = 11, color }: { size?: number; color: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke={color}
      strokeWidth='2.2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
    </svg>
  )
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

// ── Inline editable text — click-to-edit, blur/Enter commit, Esc revert ──────

type EditableTextProps = {
  value:        string
  placeholder?: string
  monospace?:   boolean
  size?:        'sm' | 'md' | 'lg'
  italic?:      boolean
  fontWeight?:  number
  color?:       string
  onCommit:     (newValue: string) => Promise<void>
  // Disabled when no underlying record exists (e.g. editing client_display
  // when there's no linked person). Renders as plain text, no hover affordance.
  editable?:    boolean
  ariaLabel?:   string
  // Maximum length. Pass 0 to disable.
  maxLength?:   number
  // If true, an empty commit reverts (vs. committing as null/empty).
  rejectEmpty?: boolean
}

function EditableText({
  value,
  placeholder = '—',
  monospace,
  size = 'md',
  italic,
  fontWeight = 400,
  color,
  onCommit,
  editable = true,
  ariaLabel,
  maxLength = 200,
  rejectEmpty = false,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const [hover, setHover]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep draft in sync if the underlying value changes (e.g. parent reload).
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13
  const baseColor = color ?? A.text
  const family = monospace ? "'DM Mono', monospace" : A.font

  function startEdit(e: React.MouseEvent) {
    if (!editable || saving) return
    e.stopPropagation()
    setDraft(value)
    setEditing(true)
  }

  async function commit() {
    const trimmed = draft.trim()
    if (trimmed === value.trim()) {
      setEditing(false)
      return
    }
    if (rejectEmpty && !trimmed) {
      setEditing(false)
      setDraft(value)
      return
    }
    setSaving(true)
    try {
      await onCommit(trimmed)
      setEditing(false)
    } catch {
      // Parent surfaces the toast. Revert local draft.
      setDraft(value)
      setEditing(false)
    }
    setSaving(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      commit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setDraft(value)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        onClick={e => e.stopPropagation()}
        disabled={saving}
        maxLength={maxLength > 0 ? maxLength : undefined}
        aria-label={ariaLabel}
        style={{
          fontSize,
          color:        baseColor,
          fontFamily:   family,
          fontStyle:    italic ? 'italic' : 'normal',
          fontWeight,
          background:   A.bgInput,
          border:       `1px solid ${A.borderGold}`,
          borderRadius: 8,
          padding:      '4px 8px',
          outline:      'none',
          minWidth:     120,
          maxWidth:     '100%',
        }}
      />
    )
  }

  const isPlaceholder = !value || value.length === 0

  return (
    <span
      onMouseEnter={() => editable && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={startEdit}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : -1}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (!editable) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setDraft(value)
          setEditing(true)
        }
      }}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        fontSize,
        color:        isPlaceholder ? A.faint : baseColor,
        fontFamily:   family,
        fontStyle:    isPlaceholder || italic ? 'italic' : 'normal',
        fontWeight,
        cursor:       editable ? 'text' : 'default',
        padding:      editable ? '2px 6px' : '0',
        margin:       editable ? '-2px -6px' : '0',
        borderRadius: 6,
        background:   editable && hover ? 'rgba(216,181,106,0.06)' : 'transparent',
        transition:   'background 0.12s ease',
        outline:      'none',
        wordBreak:    'break-word',
      }}
    >
      <span>{isPlaceholder ? placeholder : value}</span>
      {editable && hover && (
        <span style={{ display: 'inline-flex', opacity: 0.6 }}>
          <PencilIcon size={11} color={A.faint} />
        </span>
      )}
    </span>
  )
}

// ── Engagement card (one per row inside a group) ─────────────────────────────
// Wrapped in a draggable wrapper outside the card body — the inner content
// remains fully interactive (selects, links, buttons) because dnd-kit's drag
// activation distance prevents accidental drags from input/button clicks.

function EngagementCardInner({
  row,
  engagementStatuses,
  itineraryStatuses,
  onStatusChange,
  isDragging,
  dragHandleProps,
}: {
  row: EngagementListRow
  engagementStatuses: StatusLookup[]
  itineraryStatuses:  StatusLookup[]
  onStatusChange: (
    row: EngagementListRow,
    field: 'engagement_status_id' | 'itinerary_status_id',
    value: string,
  ) => void
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}) {
  const hasIterationLabel = row.iteration_label && row.iteration_label.length > 0

  return (
    <div style={{
      background:    A.bg,
      border:        `1px solid ${isDragging ? A.borderGold : A.border}`,
      borderRadius:  12,
      padding:       '14px 18px',
      display:       'flex',
      flexDirection: 'column',
      gap:           10,
      opacity:       isDragging ? 0.5 : 1,
      transition:    'border-color 0.15s ease, opacity 0.15s ease',
    }}>
      {/* Drag handle row — top of card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            aria-label='Drag to reassign engagement'
            style={{
              cursor:       'grab',
              padding:      '2px 4px',
              color:        A.faint,
              fontSize:     14,
              lineHeight:   1,
              userSelect:   'none',
              touchAction:  'none',
              borderRadius: 6,
            }}
            onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.cursor = 'grabbing' }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.cursor = 'grab' }}
          >
            ⋮⋮
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font }}>
          {row.title || <span style={{ color: A.faint, fontStyle: 'italic' }}>(untitled)</span>}
        </div>
        <AudiencePill audience={row.audience} isTemplate={row.is_public_template} />
      </div>

      {/* Identifier row: url_id [· iteration_label] */}
      <div style={{ fontSize: 11, color: A.faint, fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
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

// ── Draggable wrapper around EngagementCardInner ─────────────────────────────

function DraggableEngagementCard({
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   row.id,
    data: { type: 'engagement', row },
  })

  return (
    <div ref={setNodeRef}>
      <EngagementCardInner
        row={row}
        engagementStatuses={engagementStatuses}
        itineraryStatuses={itineraryStatuses}
        onStatusChange={onStatusChange}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ── Trip group (collapsible + droppable + editable header) ───────────────────

function TripGroupBlock({
  group,
  expanded,
  onToggle,
  engagementStatuses,
  itineraryStatuses,
  onStatusChange,
  onTripUpdate,
  onPersonUpdate,
  isDragOverFromOtherGroup,
  draggingFromThisGroup,
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
  onTripUpdate: (
    tripId: string,
    field: 'trip_code' | 'public_title',
    value: string,
  ) => Promise<void>
  onPersonUpdate: (
    personId: string,
    field: 'first_name' | 'nickname',
    value: string,
  ) => Promise<void>
  isDragOverFromOtherGroup: boolean
  draggingFromThisGroup:    boolean
}) {
  const isOrphan = group.trip_id == null
  const dropId = isOrphan ? '__group_orphan__' : `group_${group.trip_id}`
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { type: 'group', tripId: group.trip_id },
  })

  // Visual highlight: only when dragging from a DIFFERENT group is hovering
  // over this one. Dragging within the same group shouldn't highlight as
  // a re-parenting target.
  const showDropHighlight = isOver && isDragOverFromOtherGroup

  // The "client display" for the header is computed live from the editable
  // person fields. Prefer nickname → first_name. We use first_name for the
  // edit because nickname can be empty.
  const personEditable = !isOrphan && group.client_id != null
  const clientNameValue = group.client_nickname ?? group.client_first_name ?? ''

  // Trip code / public title editing only available on real trips.
  const tripFieldsEditable = !isOrphan && group.trip_id != null

  return (
    <div
      ref={setNodeRef}
      style={{
        background:   A.bgCard,
        border:       `1px solid ${showDropHighlight ? A.borderGold : A.border}`,
        borderRadius: 14,
        overflow:     'hidden',
        boxShadow:    showDropHighlight ? `0 0 0 3px rgba(216,181,106,0.15)` : 'none',
        transition:   'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Header — clickable toggle, but inline-editable fields stop propagation */}
      <div
        onClick={onToggle}
        style={{
          padding:        '16px 20px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          cursor:         'pointer',
          background:     expanded ? 'rgba(216,181,106,0.03)' : 'transparent',
          flexWrap:       'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
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

          {isOrphan && (
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize:   13,
                fontWeight: 700,
                color:      A.muted,
                fontFamily: A.font,
                fontStyle:  'italic',
              }}>
                Unlinked
              </div>
              <div style={{
                fontSize:   11,
                color:      A.faint,
                fontFamily: A.font,
                marginTop:  2,
              }}>
                Drag here to remove from a trip · drag away to assign
              </div>
            </div>
          )}

          {!isOrphan && (
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Title row: "{client_display}'s {public_title}" — both editable */}
              <div style={{
                display:    'flex',
                alignItems: 'center',
                flexWrap:   'wrap',
                gap:        4,
              }}>
                <EditableText
                  value={clientNameValue}
                  placeholder='Add client'
                  size='lg'
                  fontWeight={700}
                  color={A.text}
                  editable={personEditable}
                  ariaLabel='Edit client name'
                  rejectEmpty={false}
                  onCommit={async (v) => {
                    if (!group.client_id) return
                    // We always write to first_name from the header (nickname
                    // editing happens via the engagement detail tab). If the
                    // header is showing nickname today, we still write to
                    // first_name to keep the edit obvious — the operator can
                    // tune nickname elsewhere.
                    await onPersonUpdate(group.client_id, 'first_name', v)
                  }}
                />
                {(clientNameValue || personEditable) && (
                  <span style={{ fontSize: 15, fontWeight: 700, color: A.text, fontFamily: A.font }}>'s</span>
                )}
                <EditableText
                  value={group.trip_public_title ?? ''}
                  placeholder='Add trip title'
                  size='lg'
                  fontWeight={700}
                  color={A.text}
                  editable={tripFieldsEditable}
                  ariaLabel='Edit public title'
                  onCommit={async (v) => {
                    if (!group.trip_id) return
                    await onTripUpdate(group.trip_id, 'public_title', v)
                  }}
                />
              </div>

              {/* Subline: trip_code (editable, mono) · start_date (read-only) */}
              <div style={{
                display:    'flex',
                alignItems: 'center',
                flexWrap:   'wrap',
                gap:        6,
              }}>
                <EditableText
                  value={group.trip_code ?? ''}
                  placeholder='Add trip code'
                  size='sm'
                  monospace
                  color={A.faint}
                  editable={tripFieldsEditable}
                  ariaLabel='Edit trip code'
                  rejectEmpty
                  onCommit={async (v) => {
                    if (!group.trip_id) return
                    await onTripUpdate(group.trip_id, 'trip_code', v)
                  }}
                />
                {group.trip_start_date && (
                  <span style={{
                    fontSize:   11,
                    color:      A.faint,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    · {group.trip_start_date}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         A.faint,
          fontFamily:    A.font,
          flexShrink:    0,
        }}>
          {group.engagements.length} · {group.engagements.length === 1 ? 'engagement' : 'engagements'}
        </div>
      </div>

      {/* Drop hint banner when an engagement is being dragged here from another group */}
      {showDropHighlight && (
        <div style={{
          padding:    '10px 20px',
          background: 'rgba(216,181,106,0.08)',
          borderTop:  `1px dashed ${A.borderGold}`,
          fontSize:   11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:      A.gold,
          fontFamily: A.font,
        }}>
          Drop to {isOrphan ? 'unlink' : `move to ${group.trip_code ?? 'this trip'}`}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{
          padding:       '0 20px 20px',
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
          opacity:       draggingFromThisGroup ? 0.85 : 1,
        }}>
          {group.engagements.map(row => (
            <DraggableEngagementCard
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

// ── "+ Drop here to create new trip" zone ────────────────────────────────────

function NewTripDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id:   '__new_trip_zone__',
    data: { type: 'new_trip' },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        marginTop:    8,
        padding:      '24px 20px',
        border:       `2px dashed ${isOver ? A.gold : A.border}`,
        borderRadius: 14,
        background:   isOver ? 'rgba(216,181,106,0.08)' : 'transparent',
        textAlign:    'center',
        opacity:      active ? 1 : 0.5,
        transition:   'all 0.15s ease',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      <div style={{
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color:         isOver ? A.gold : A.faint,
        fontFamily:    A.font,
      }}>
        + Drop here to create new trip
      </div>
      <div style={{
        fontSize:   11,
        color:      A.faint,
        fontFamily: A.font,
        marginTop:  6,
      }}>
        Opens a form to create a trip and link this engagement
      </div>
    </div>
  )
}

// ── Create modal (existing engagement create flow — unchanged from S33) ──────

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to create: ${message}`, 'error')
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
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", flex: 1 }}
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
              <select style={inputStyle} value={audience} onChange={e => setAudience(e.target.value as 'private' | 'public')}>
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
            {saving && 'Creating…'}
            {!saving && 'Create Engagement'}
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

  // Drag state — id of currently dragged engagement, plus the row snapshot
  // for the DragOverlay ghost.
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [draggingRow, setDraggingRow] = useState<EngagementListRow | null>(null)

  // When the create-new-trip drop fires, we stash the engagement context
  // and open the modal.
  const [pendingCreateForEngagement, setPendingCreateForEngagement] =
    useState<EngagementListRow | null>(null)

  // dnd-kit sensors — pointer (with activation distance to avoid hijacking
  // clicks on selects/buttons inside the card) plus keyboard for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to load: ${message}`, 'error')
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
      if (prev.has(key)) {
        next.delete(key)
        return next
      }
      next.add(key)
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
      load()
    }
  }

  // ── Inline edit handlers — optimistic with reload-on-error ───────────────

  async function handleTripUpdate(
    tripId: string,
    field: 'trip_code' | 'public_title',
    value: string,
  ) {
    // Optimistic local mutation for every row pointing at this trip.
    const prevSnapshot = rows
    setRows(prev => prev.map(r => {
      if (r.trip_id !== tripId) return r
      if (field === 'trip_code')    return { ...r, trip_code: value }
      if (field === 'public_title') return { ...r, trip_public_title: value || null }
      return r
    }))
    try {
      await updateTrip(tripId, { [field]: value })
      showToast('Trip updated.', 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      const isDuplicate = message.toLowerCase().includes('duplicate') || message.includes('23505')
      if (isDuplicate) showToast(`Trip code "${value}" already in use.`, 'error')
      if (!isDuplicate) showToast(`Failed to update trip: ${message}`, 'error')
      setRows(prevSnapshot)
      throw e // bubble so EditableText resets
    }
  }

  async function handlePersonUpdate(
    personId: string,
    field: 'first_name' | 'nickname',
    value: string,
  ) {
    const prevSnapshot = rows
    setRows(prev => prev.map(r => {
      if (r.client_id !== personId) return r
      if (field === 'first_name') return { ...r, client_first_name: value || null }
      if (field === 'nickname')   return { ...r, client_nickname: value || null }
      return r
    }))
    try {
      await updatePerson(personId, { [field]: value })
      showToast('Client updated.', 'success')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to update client: ${message}`, 'error')
      setRows(prevSnapshot)
      throw e
    }
  }

  // ── Drag handlers ────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setDraggingId(id)
    const row = rows.find(r => r.id === id) ?? null
    setDraggingRow(row)
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeRow = draggingRow
    setDraggingId(null)
    setDraggingRow(null)

    if (!e.over || !activeRow) return

    const overData = e.over.data.current as { type?: string; tripId?: string | null } | undefined
    if (!overData) return

    // Drop on "+ New Trip" zone — open the modal (defer the reassignment
    // until the trip is created via TripCreateModal).
    if (overData.type === 'new_trip') {
      setPendingCreateForEngagement(activeRow)
      return
    }

    // Drop on a trip group — re-parent. Skip if dropped on the same group.
    if (overData.type === 'group') {
      const newTripId = overData.tripId ?? null
      if (newTripId === activeRow.trip_id) return

      // Optimistic: update local state first.
      const prevSnapshot = rows
      setRows(prev => prev.map(r => r.id === activeRow.id
        ? { ...r, trip_id: newTripId }
        : r,
      ))

      try {
        await reassignEngagementTrip(activeRow.id, newTripId)
        showToast(
          newTripId ? 'Engagement moved.' : 'Engagement unlinked.',
          'success',
        )
        // Reload to get fresh trip context (trip_code, public_title, client name)
        // for the moved engagement.
        load()
      } catch (e2: unknown) {
        const message = e2 instanceof Error ? e2.message : 'unknown error'
        showToast(`Failed to move: ${message}`, 'error')
        setRows(prevSnapshot)
      }
    }
  }

  function handleDragCancel() {
    setDraggingId(null)
    setDraggingRow(null)
  }

  // For each group block, decide whether to highlight on hover. We highlight
  // when the active drag started in a different group than this one.
  function isDragFromOtherGroup(targetGroup: TripGroup): boolean {
    if (!draggingRow) return false
    return draggingRow.trip_id !== targetGroup.trip_id
  }

  function isDraggingFromGroup(group: TripGroup): boolean {
    if (!draggingRow) return false
    return draggingRow.trip_id === group.trip_id
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
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 6, lineHeight: 1.5 }}>
            Click any group title or trip code to edit · Drag the ⋮⋮ handle to reassign
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ New Engagement</button>
      </div>

      {/* Empty / loading */}
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>Loading…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>No engagements yet.</div>
      )}

      {/* Trip groups — wrapped in DndContext */}
      {!loading && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map(group => {
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
                  onTripUpdate={handleTripUpdate}
                  onPersonUpdate={handlePersonUpdate}
                  isDragOverFromOtherGroup={isDragFromOtherGroup(group)}
                  draggingFromThisGroup={isDraggingFromGroup(group)}
                />
              )
            })}

            {/* New-trip drop zone (always rendered; faded when no drag active) */}
            <NewTripDropZone active={draggingId != null} />
          </div>

          {/* Drag overlay — mirror of the dragged card following the cursor */}
          <DragOverlay dropAnimation={null}>
            {draggingRow && (
              <div style={{ width: 'min(560px, 90vw)', cursor: 'grabbing' }}>
                <EngagementCardInner
                  row={draggingRow}
                  engagementStatuses={engagementStatuses}
                  itineraryStatuses={itineraryStatuses}
                  onStatusChange={() => { /* ghost is non-interactive */ }}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create-engagement modal (S33) */}
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

      {/* Drag-to-create-trip modal (S33B) */}
      {pendingCreateForEngagement && (
        <TripCreateModal
          engagementId={pendingCreateForEngagement.id}
          engagementTitle={pendingCreateForEngagement.title}
          engagementUrlId={pendingCreateForEngagement.url_id}
          onClose={() => setPendingCreateForEngagement(null)}
          onSuccess={() => {
            setPendingCreateForEngagement(null)
            load()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}