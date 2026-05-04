/* DestinationRowsEditor.tsx
 * Editor for travel_immerse_trip_destination_rows. Mounts inside
 * EngagementDetailTab below the engagement-level fields.
 *
 * Shape:
 *   - Compact list: drag handle + thumbnail + title + destination name + sort
 *   - Edit button → modal with 3 collapsible sections (Card / Subpage Hero
 *     / Subpage Overrides). 6 ImageFieldWithUploader instances total.
 *   - Add Destination button → picker → INSERT with sensible defaults
 *   - Delete button on each row → confirm with cascade text
 *   - Drag-to-reorder → reorderDestinationRows() on drop
 *
 * Last updated: S33C
 */

import { useEffect, useMemo, useState } from 'react'
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
  fetchDestinationRows,
  updateDestinationRow,
  insertDestinationRow,
  deleteDestinationRow,
  reorderDestinationRows,
  searchDestinations,
  fetchMaxDestinationSortOrder,
  type DestinationRow,
  type DestinationOption,
} from '../../lib/adminDestinationRowQueries'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { A } from '../../lib/adminTokens'

// ── Shared styles (mirrors EngagementDetailTab patterns) ─────────────────────

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

// ── Field + Section helpers (local — mirror EngagementDetailTab) ─────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title:        string
  defaultOpen?: boolean
  children:     React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${A.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 18px', background: 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12, color: A.faint, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>▸</span>
      </button>
      {open && (
        <div style={{
          padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sortable row card (compact list view) ────────────────────────────────────

function SortableRowCard({
  row,
  onEdit,
  onDelete,
}: {
  row:      DestinationRow
  onEdit:   (row: DestinationRow) => void
  onDelete: (row: DestinationRow) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging }
    = useSortable({ id: row.id })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
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

  const thumb = thumbSrc(row.image_src)

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
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

      {/* Thumbnail */}
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

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.title || <span style={{ color: A.faint, fontStyle: 'italic' }}>(untitled)</span>}
        </div>
        <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
          {row.destination_name ?? row.destination_slug ?? '—'}
          <span style={{ color: A.faint, marginLeft: 8 }}>· sort {row.sort_order}</span>
          <span style={{
            marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: row.subpage_status === 'live' ? A.gold : A.muted,
          }}>
            {row.subpage_status}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onEdit(row)} style={btnGhost}>Edit</button>
        <button onClick={() => onDelete(row)} style={btnDanger}>Delete</button>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  row,
  onClose,
  onSaved,
  showToast,
}: {
  row:       DestinationRow
  onClose:   () => void
  onSaved:   () => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [draft, setDraft] = useState<DestinationRow>(row)
  const [saving, setSaving] = useState(false)

  function patch<K extends keyof DestinationRow>(key: K, value: DestinationRow[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Partial<DestinationRow> = {}
      ;(Object.keys(draft) as (keyof DestinationRow)[]).forEach(k => {
        if (JSON.stringify(draft[k]) !== JSON.stringify(row[k])) {
          ;(payload as any)[k] = draft[k]
        }
      })
      if (Object.keys(payload).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }
      await updateDestinationRow(row.id, payload)
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
        padding: 28, width: '100%', maxWidth: 880,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Destination Row
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {row.destination_name ?? row.destination_slug ?? '(unknown)'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Subpage status toggle */}
        <Field label='Subpage Status'>
          <select
            style={inputStyle}
            value={draft.subpage_status}
            onChange={e => patch('subpage_status', e.target.value as 'live' | 'preview')}
          >
            <option value='preview'>preview</option>
            <option value='live'>live</option>
          </select>
        </Field>

        {/* Card section */}
        <CollapsibleSection title='Card (overview)' defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Title'>
              <input style={inputStyle} value={draft.title ?? ''} onChange={e => patch('title', e.target.value || null)} />
            </Field>
            <Field label='Number Label'>
              <input style={inputStyle} value={draft.number_label ?? ''} onChange={e => patch('number_label', e.target.value || null)} />
            </Field>
            <Field label='Mood'>
              <input style={inputStyle} value={draft.mood ?? ''} onChange={e => patch('mood', e.target.value || null)} />
            </Field>
            <Field label='Stay Label'>
              <input style={inputStyle} value={draft.stay_label ?? ''} onChange={e => patch('stay_label', e.target.value || null)} />
            </Field>
          </div>
          <Field label='Summary'>
            <textarea style={textareaStyle} value={draft.summary ?? ''} onChange={e => patch('summary', e.target.value || null)} />
          </Field>
          <Field label='Card Image'>
            <ImageFieldWithUploader value={draft.image_src} onChange={v => patch('image_src', v)} />
          </Field>
          <Field label='Card Image Alt'>
            <input style={inputStyle} value={draft.image_alt ?? ''} onChange={e => patch('image_alt', e.target.value || null)} />
          </Field>
        </CollapsibleSection>

        {/* Subpage Hero overrides */}
        <CollapsibleSection title='Subpage Hero (overrides)' defaultOpen={false}>
          <Field label='Hero Image Src'>
            <ImageFieldWithUploader value={draft.hero_image_src_override} onChange={v => patch('hero_image_src_override', v)} />
          </Field>
          <Field label='Hero Image Alt'>
            <input style={inputStyle} value={draft.hero_image_alt_override ?? ''} onChange={e => patch('hero_image_alt_override', e.target.value || null)} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Hero Title 2'>
              <input style={inputStyle} value={draft.hero_title_2_override ?? ''} onChange={e => patch('hero_title_2_override', e.target.value || null)} />
            </Field>
            <Field label='Hero Subtitle 2'>
              <input style={inputStyle} value={draft.hero_subtitle_2_override ?? ''} onChange={e => patch('hero_subtitle_2_override', e.target.value || null)} />
            </Field>
          </div>
          <Field label='Hero Image Src 2'>
            <ImageFieldWithUploader value={draft.hero_image_src_2_override} onChange={v => patch('hero_image_src_2_override', v)} />
          </Field>
          <Field label='Hero Image Alt 2'>
            <input style={inputStyle} value={draft.hero_image_alt_2_override ?? ''} onChange={e => patch('hero_image_alt_2_override', e.target.value || null)} />
          </Field>
        </CollapsibleSection>

        {/* Subpage intro / pricing / dining overrides */}
        <CollapsibleSection title='Subpage Overrides' defaultOpen={false}>
          <Field label='Intro Title'>
            <input style={inputStyle} value={draft.intro_title_override ?? ''} onChange={e => patch('intro_title_override', e.target.value || null)} />
          </Field>
          <Field label='Intro Body'>
            <textarea style={textareaStyle} value={draft.intro_body_override ?? ''} onChange={e => patch('intro_body_override', e.target.value || null)} />
          </Field>

          <div style={{ height: 1, background: A.border, margin: '4px 0' }} />

          <Field label='Pricing Body'>
            <textarea style={textareaStyle} value={draft.pricing_body_override ?? ''} onChange={e => patch('pricing_body_override', e.target.value || null)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Pricing Notes Heading'>
              <input style={inputStyle} value={draft.pricing_notes_heading_override ?? ''} onChange={e => patch('pricing_notes_heading_override', e.target.value || null)} />
            </Field>
            <Field label='Pricing Notes Title'>
              <input style={inputStyle} value={draft.pricing_notes_title_override ?? ''} onChange={e => patch('pricing_notes_title_override', e.target.value || null)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Pricing Closer Item'>
              <input style={inputStyle} value={draft.pricing_closer_item_override ?? ''} onChange={e => patch('pricing_closer_item_override', e.target.value || null)} />
            </Field>
            <Field label='Pricing Closer Basis'>
              <input style={inputStyle} value={draft.pricing_closer_basis_override ?? ''} onChange={e => patch('pricing_closer_basis_override', e.target.value || null)} />
            </Field>
            <Field label='Pricing Closer Stay'>
              <input style={inputStyle} value={draft.pricing_closer_stay_override ?? ''} onChange={e => patch('pricing_closer_stay_override', e.target.value || null)} />
            </Field>
            <Field label='Pricing Closer Range'>
              <input style={inputStyle} value={draft.pricing_closer_indicative_range_override ?? ''} onChange={e => patch('pricing_closer_indicative_range_override', e.target.value || null)} />
            </Field>
          </div>

          <div style={{ height: 1, background: A.border, margin: '4px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label='Dining Eyebrow'>
              <input style={inputStyle} value={draft.dining_eyebrow_override ?? ''} onChange={e => patch('dining_eyebrow_override', e.target.value || null)} />
            </Field>
            <Field label='Dining Title'>
              <input style={inputStyle} value={draft.dining_title_override ?? ''} onChange={e => patch('dining_title_override', e.target.value || null)} />
            </Field>
          </div>
          <Field label='Dining Body'>
            <textarea style={textareaStyle} value={draft.dining_body_override ?? ''} onChange={e => patch('dining_body_override', e.target.value || null)} />
          </Field>
        </CollapsibleSection>

        {/* Action bar */}
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

// ── Add Destination picker ────────────────────────────────────────────────────

function AddDestinationModal({
  engagementId,
  existingGlobalIds,
  onClose,
  onAdded,
  showToast,
}: {
  engagementId:      string
  existingGlobalIds: Set<string>
  onClose:           () => void
  onAdded:           () => void
  showToast:         (msg: string, type: 'success' | 'error') => void
}) {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState<DestinationOption[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      searchDestinations(query).then(setResults).catch(() => setResults([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(
    () => results.filter(r => !existingGlobalIds.has(r.id)),
    [results, existingGlobalIds],
  )

  async function addOne(option: DestinationOption) {
    if (adding) return
    setAdding(true)
    try {
      const sortOrder = await fetchMaxDestinationSortOrder(engagementId)
      await insertDestinationRow({
        trip_id:               engagementId,
        global_destination_id: option.id,
        title:                 option.name,
        sort_order:            sortOrder,
        subpage_status:        'preview',
      })
      showToast(`Added ${option.name}.`, 'success')
      onAdded()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to add: ${message}`, 'error')
    }
    setAdding(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 20px',
    }}>
      <div style={{
        background: A.bg, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 24, width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>
            Add Destination
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <input
          style={inputStyle}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search destinations…'
          autoFocus
        />

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          maxHeight: 360, overflowY: 'auto',
        }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 12, textAlign: 'center' }}>
              {query ? 'No matching destinations.' : 'Start typing to search.'}
            </div>
          )}
          {filtered.map(d => (
            <button
              key={d.id}
              onClick={() => addOne(d)}
              disabled={adding}
              style={{
                textAlign: 'left',
                padding: '10px 14px', borderRadius: 8,
                background: A.bgInput, border: `1px solid ${A.border}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12,
                fontFamily: A.font,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: A.text }}>{d.name}</span>
                <span style={{ fontSize: 11, color: A.faint, fontFamily: "'DM Mono', monospace" }}>{d.slug}</span>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: d.storage_path ? A.gold : A.faint,
                whiteSpace: 'nowrap',
              }}>
                {d.storage_path ? '✓ path' : 'no path'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DestinationRowsEditor({
  engagementId,
  showToast,
}: {
  engagementId: string
  showToast:    (msg: string, type: 'success' | 'error') => void
}) {
  const [rows, setRows]       = useState<DestinationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<DestinationRow | null>(null)
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
      const list = await fetchDestinationRows(engagementId)
      setRows(list)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      if (typeof showToast === 'function') {
        showToast(`Failed to load destinations: ${message}`, 'error')
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  const existingGlobalIds = useMemo(
    () => new Set(rows.map(r => r.global_destination_id)),
    [rows],
  )

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const oldIndex = rows.findIndex(r => r.id === active.id)
    const newIndex = rows.findIndex(r => r.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(rows, oldIndex, newIndex)
    // Optimistic local update with new sort_order assignments
    const withNewSort = reordered.map((r, i) => ({ ...r, sort_order: i + 1 }))
    setRows(withNewSort)

    try {
      await reorderDestinationRows(reordered.map(r => r.id))
      showToast('Reordered.', 'success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error'
      showToast(`Failed to reorder: ${message}`, 'error')
      load()
    }
  }

  async function handleDelete(row: DestinationRow) {
    const confirmed = window.confirm(
      `Remove "${row.title || row.destination_name}" from this engagement?\n\n` +
      `This deletes the destination row only. Pricing rows for this destination ` +
      `on this engagement remain — clean those up separately if needed.\n\n` +
      `Cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await deleteDestinationRow(row.id)
      showToast('Destination removed.', 'success')
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to delete: ${message}`, 'error')
    }
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
            Destination Rows
          </div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            Drag the ⋮⋮ handle to reorder · Edit opens the full row editor
          </div>
        </div>
        <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add Destination</button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 16, textAlign: 'center' }}>
          No destination rows yet. Add the first one to begin shaping the proposal.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(row => (
                <SortableRowCard
                  key={row.id}
                  row={row}
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
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          showToast={showToast}
        />
      )}

      {adding && (
        <AddDestinationModal
          engagementId={engagementId}
          existingGlobalIds={existingGlobalIds}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); load() }}
          showToast={showToast}
        />
      )}
    </div>
  )
}