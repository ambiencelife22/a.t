/* RouteStopsEditor.tsx
 * Editor for travel_immerse_route_stops. Mounts inside EngagementDetailTab,
 * paired with the engagement-level Route Section copy block.
 *
 * Shape:
 *   - Compact list: drag handle + thumbnail + title + stay_label + sort
 *   - Edit button → modal with single form (no collapsibles — only 5 fields)
 *   - Add Stop button → INSERT blank at sort = max + 1
 *   - Delete with confirm
 *   - Drag-to-reorder → reorderRouteStops (0-indexed, matches DB convention)
 *
 * Last updated: S33D
 */

import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  fetchRouteStops,
  updateRouteStop,
  insertRouteStop,
  deleteRouteStop,
  reorderRouteStops,
  fetchMaxRouteStopSortOrder,
  type RouteStop,
} from '../../lib/adminRouteStopQueries'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { A } from '../../lib/adminTokens'

// ── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', lineHeight: 1.7, minHeight: 90,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: A.faint, fontFamily: A.font,
  marginBottom: 6, display: 'block',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(216,181,106,0.12)', color: A.gold,
  border: `1px solid rgba(216,181,106,0.30)`, borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer',
  letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: A.danger,
  border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8,
  fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const PUBLIC_URL_PREFIX =
  'https://rjobcbpnhymuczjhqzmh.supabase.co/storage/v1/object/public/ambience-assets/'

function thumbSrc(value: string | null): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `${PUBLIC_URL_PREFIX}${value}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Sortable card (compact list view) ────────────────────────────────────────

function SortableStopCard({
  stop,
  onEdit,
  onDelete,
}: {
  stop:     RouteStop
  onEdit:   (stop: RouteStop) => void
  onDelete: (stop: RouteStop) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging }
    = useSortable({ id: stop.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    background: A.bgInput,
    border:     `1px solid ${isDragging ? A.borderGold : A.border}`,
    borderRadius: 12,
    padding:    '12px 14px',
    display:    'flex',
    alignItems: 'center',
    gap:        12,
  }

  const thumb = thumbSrc(stop.image_src)

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab', padding: '2px 6px', color: A.faint,
          fontSize: 14, lineHeight: 1, userSelect: 'none', touchAction: 'none',
        }}
        aria-label='Drag to reorder'
      >
        ⋮⋮
      </div>

      <div style={{
        width: 56, height: 40, borderRadius: 6, overflow: 'hidden',
        background: A.bg, border: `1px solid ${A.border}`,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb && (
          <img
            src={thumb}
            alt=''
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
        {!thumb && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>no img</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {stop.title || <span style={{ color: A.faint, fontStyle: 'italic' }}>(untitled)</span>}
        </div>
        <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
          {stop.stay_label ?? '—'}
          <span style={{ color: A.faint, marginLeft: 8 }}>· position {stop.sort_order}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onEdit(stop)} style={btnGhost}>Edit</button>
        <button onClick={() => onDelete(stop)} style={btnDanger}>Delete</button>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  stop,
  onClose,
  onSaved,
  showToast,
}: {
  stop:      RouteStop
  onClose:   () => void
  onSaved:   () => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [draft, setDraft]   = useState<RouteStop>(stop)
  const [saving, setSaving] = useState(false)

  function patch<K extends keyof RouteStop>(key: K, value: RouteStop[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Partial<RouteStop> = {}
      ;(Object.keys(draft) as (keyof RouteStop)[]).forEach(k => {
        if (JSON.stringify(draft[k]) !== JSON.stringify(stop[k])) {
          ;(payload as any)[k] = draft[k]
        }
      })
      if (Object.keys(payload).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }
      await updateRouteStop(stop.id, payload)
      showToast(`Saved ${Object.keys(payload).length} field(s).`, 'success')
      onSaved()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
    }
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px', overflowY: 'auto',
    }}>
      <div style={{
        background: A.bg, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 640,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Route Stop · position {stop.sort_order}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {stop.title || '(untitled)'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <Field label='Title'>
            <input
              style={inputStyle}
              value={draft.title ?? ''}
              onChange={e => patch('title', e.target.value || null)}
              placeholder='e.g. New York City, Saudi Arabia'
            />
          </Field>
          <Field label='Stay Label'>
            <input
              style={inputStyle}
              value={draft.stay_label ?? ''}
              onChange={e => patch('stay_label', e.target.value || null)}
              placeholder='e.g. 5-6 nights, Start, End'
            />
          </Field>
        </div>

        <Field label='Note'>
          <textarea
            style={textareaStyle}
            value={draft.note ?? ''}
            onChange={e => patch('note', e.target.value || null)}
            placeholder='Short narrative note shown on the route arc.'
          />
        </Field>

        <Field label='Image Src'>
          <ImageFieldWithUploader
            value={draft.image_src}
            onChange={v => patch('image_src', v)}
          />
        </Field>

        <Field label='Image Alt'>
          <input
            style={inputStyle}
            value={draft.image_alt ?? ''}
            onChange={e => patch('image_alt', e.target.value || null)}
          />
        </Field>

        <div style={{
          display: 'flex', gap: 10, paddingTop: 8,
          borderTop: `1px solid ${A.border}`,
          position: 'sticky', bottom: 0, background: A.bg,
        }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} disabled={saving} style={btnGhost}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RouteStopsEditor({
  engagementId,
  showToast,
}: {
  engagementId: string
  showToast:    (msg: string, type: 'success' | 'error') => void
}) {
  const [stops, setStops]     = useState<RouteStop[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<RouteStop | null>(null)
  const [adding, setAdding]   = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function load() {
    if (!engagementId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await fetchRouteStops(engagementId)
      setStops(list)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      if (typeof showToast === 'function') {
        showToast(`Failed to load route stops: ${message}`, 'error')
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const oldIndex = stops.findIndex(s => s.id === active.id)
    const newIndex = stops.findIndex(s => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(stops, oldIndex, newIndex)
    // 0-indexed sort_order to match DB convention
    const withNewSort = reordered.map((s, i) => ({ ...s, sort_order: i }))
    setStops(withNewSort)

    try {
      await reorderRouteStops(reordered.map(s => s.id))
      showToast('Reordered.', 'success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error'
      showToast(`Failed to reorder: ${message}`, 'error')
      load()
    }
  }

  async function handleDelete(stop: RouteStop) {
    const confirmed = window.confirm(
      `Remove route stop "${stop.title ?? '(untitled)'}"?\n\n` +
      `Cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteRouteStop(stop.id)
      showToast('Stop removed.', 'success')
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to delete: ${message}`, 'error')
    }
  }

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    try {
      const sortOrder = await fetchMaxRouteStopSortOrder(engagementId)
      const newId = await insertRouteStop({
        trip_id:    engagementId,
        sort_order: sortOrder,
      })
      showToast('Stop added.', 'success')
      const fresh = await fetchRouteStops(engagementId)
      setStops(fresh)
      // Open the new one straight away for editing
      const newStop = fresh.find(s => s.id === newId)
      if (newStop) setEditing(newStop)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to add: ${message}`, 'error')
    }
    setAdding(false)
  }

  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${A.border}`,
      borderRadius: 14, padding: 24,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          }}>
            Route Stops
          </div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            Drag the ⋮⋮ handle to reorder · Edit opens the stop editor
          </div>
        </div>
        <button onClick={handleAdd} disabled={adding} style={{ ...btnPrimary, opacity: adding ? 0.5 : 1 }}>
          + Add Stop
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
      )}

      {!loading && stops.length === 0 && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 16, textAlign: 'center' }}>
          No route stops yet. Add the first one to begin shaping the journey arc.
        </div>
      )}

      {!loading && stops.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stops.map(stop => (
                <SortableStopCard
                  key={stop.id}
                  stop={stop}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <EditModal
          stop={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          showToast={showToast}
        />
      )}
    </div>
  )
}