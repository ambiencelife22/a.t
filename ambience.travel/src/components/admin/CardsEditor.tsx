/* CardsEditor.tsx
 * Editor for the dining + experience cards on an engagement page.
 * Selection-primary: drives which cards render. Override-secondary: lazy
 * customisation, created only when a field is customised.
 *
 * Design principles (S334 rebuild):
 *   - Built for travel professionals + interns. No coder vocabulary visible.
 *     No "override / null / jsonb / canonical / is_active" anywhere in UI.
 *   - Each field has 3 states: Use default · Customise · Hide on this proposal.
 *   - Canonical values shown as preview when in "default" state - user can
 *     see what flows through without opening anything.
 *   - Bullets edited as a real list (+/- buttons), never JSON.
 *   - Drag-to-reorder works within Dining and within Experiences (independent
 *     ordering per kind, confirmed by data model + D direction).
 *   - "Show on proposal" toggle in place of is_active boolean.
 *
 * Pattern mirrors RouteStopsEditor + DestinationRowsEditor for visual
 * consistency, but the modal is custom because the override mental model
 * is unique here.
 *
 * Last updated: S334
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
  fetchCardSelections,
  updateSelection,
  insertSelection,
  deleteSelection,
  reorderSelections,
  upsertOverride,
  deleteOverride,
  searchCanonicalCards,
  nextSortOrder,
  resolveText,
  resolveBullets,
} from '../../queries/queriesAdminCardSelections'
import type { CardSelection, CardCanonicalOption, CardKind } from '../../types/typesCards'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import { A } from '../../tokens/tokensAdmin'

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
  fontSize: 11, fontWeight: 700,
  color: A.text, fontFamily: A.font,
  marginBottom: 4, display: 'block',
}

const subLabelStyle: React.CSSProperties = {
  fontSize: 11, color: A.faint, fontFamily: A.font,
  marginBottom: 8,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(216,181,106,0.12)', color: A.gold,
  border: `1px solid rgba(216,181,106,0.30)`, borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer',
  letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 14px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

const btnTiny: React.CSSProperties = {
  padding: '4px 10px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 8,
  fontSize: 10, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
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

// ── Three-state field: default / customise / hide ────────────────────────────

type FieldState = 'default' | 'customised' | 'hidden'

function stateLabel(state: FieldState): string {
  if (state === 'default')    return 'Default'
  if (state === 'customised') return 'Customised'
  return 'Hidden on this proposal'
}

function stateColor(state: FieldState): string {
  if (state === 'default')    return A.muted
  if (state === 'customised') return A.gold
  return A.danger
}

/**
 * Single-line text field with three-state control.
 *   value === null       → default (canonical flows through)
 *   value === ''         → hidden on this proposal
 *   value non-empty      → customised
 */
function TextOverrideField({
  label,
  description,
  canonical,
  value,
  onChange,
  multiline = false,
}: {
  label:        string
  description?: string
  canonical:    string | null
  value:        string | null
  onChange:     (next: string | null) => void
  multiline?:   boolean
}) {
  const { state } = resolveText(value, canonical)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <label style={labelStyle}>{label}</label>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: stateColor(state), fontFamily: A.font }}>
          {stateLabel(state)}
        </span>
      </div>

      {description && <div style={subLabelStyle}>{description}</div>}

      {state === 'default' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(216,181,106,0.04)',
            border: `1px dashed ${A.border}`,
            fontSize: 13, color: A.muted, fontFamily: A.font,
            fontStyle: canonical ? 'italic' : 'normal',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {canonical ?? <span style={{ color: A.faint }}>(no default content)</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(canonical ?? '')} style={btnTiny}>+ Customise</button>
            <button onClick={() => onChange('')} style={btnTiny}>Hide on this proposal</button>
          </div>
        </div>
      )}

      {state === 'customised' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {multiline ? (
            <textarea
              style={textareaStyle}
              value={value ?? ''}
              onChange={e => onChange(e.target.value === '' ? '' : e.target.value)}
            />
          ) : (
            <input
              style={inputStyle}
              value={value ?? ''}
              onChange={e => onChange(e.target.value === '' ? '' : e.target.value)}
            />
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={btnTiny}>Use default</button>
            <button onClick={() => onChange('')} style={btnTiny}>Hide on this proposal</button>
          </div>
        </div>
      )}

      {state === 'hidden' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.04)',
            border: `1px dashed rgba(239,68,68,0.3)`,
            fontSize: 12, color: A.danger, fontFamily: A.font,
          }}>
            This field will not appear on the proposal.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={btnTiny}>Show default</button>
            <button onClick={() => onChange(canonical ?? '')} style={btnTiny}>Customise instead</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Image override field with three-state control ────────────────────────────

function ImageOverrideField({
  label,
  description,
  canonical,
  value,
  onChange,
}: {
  label:        string
  description?: string
  canonical:    string | null
  value:        string | null
  onChange:     (next: string | null) => void
}) {
  // For images, "" hides not super useful - but we keep three states to be
  // consistent. Default = canonical image. Customised = override path. Hidden
  // = empty string (renders no image).
  const { state } = resolveText(value, canonical)
  const previewSrc = state === 'default' ? thumbSrc(canonical) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <label style={labelStyle}>{label}</label>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: stateColor(state), fontFamily: A.font }}>
          {stateLabel(state)}
        </span>
      </div>

      {description && <div style={subLabelStyle}>{description}</div>}

      {state === 'default' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: 10, borderRadius: 10,
            background: 'rgba(216,181,106,0.04)',
            border: `1px dashed ${A.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 80, height: 56, borderRadius: 6, overflow: 'hidden',
              background: A.bg, border: `1px solid ${A.border}`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {previewSrc && (
                <img
                  src={previewSrc}
                  alt=''
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              )}
              {!previewSrc && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>no image</span>}
            </div>
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, fontStyle: 'italic' }}>
              {canonical ? 'Default image' : 'No default image set'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(canonical ?? '')} style={btnTiny}>+ Customise image</button>
            <button onClick={() => onChange('')} style={btnTiny}>Hide on this proposal</button>
          </div>
        </div>
      )}

      {state === 'customised' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ImageFieldWithUploader
            value={value}
            onChange={v => onChange(v ?? null)}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={btnTiny}>Use default</button>
            <button onClick={() => onChange('')} style={btnTiny}>Hide on this proposal</button>
          </div>
        </div>
      )}

      {state === 'hidden' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.04)',
            border: `1px dashed rgba(239,68,68,0.3)`,
            fontSize: 12, color: A.danger, fontFamily: A.font,
          }}>
            This image will not appear on the proposal.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={btnTiny}>Show default</button>
            <button onClick={() => onChange(canonical ?? '')} style={btnTiny}>Customise instead</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bullets editor with three-state control ──────────────────────────────────

function BulletsOverrideField({
  label,
  description,
  canonical,
  value,
  onChange,
}: {
  label:        string
  description?: string
  canonical:    string[] | null
  value:        string[] | null
  onChange:     (next: string[] | null) => void
}) {
  const { state } = resolveBullets(value, canonical)

  function setBullets(next: string[]) {
    onChange(next)
  }

  function addBullet() {
    onChange([...(value ?? []), ''])
  }

  function updateBullet(i: number, text: string) {
    const next = [...(value ?? [])]
    next[i] = text
    onChange(next)
  }

  function removeBullet(i: number) {
    const next = [...(value ?? [])]
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <label style={labelStyle}>{label}</label>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: stateColor(state), fontFamily: A.font }}>
          {stateLabel(state)}
        </span>
      </div>

      {description && <div style={subLabelStyle}>{description}</div>}

      {state === 'default' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(216,181,106,0.04)',
            border: `1px dashed ${A.border}`,
            fontSize: 13, color: A.muted, fontFamily: A.font, lineHeight: 1.6,
          }}>
            {canonical && canonical.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontStyle: 'italic' }}>
                {canonical.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            ) : (
              <span style={{ color: A.faint, fontStyle: 'normal' }}>(no default bullets)</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(canonical ?? [])} style={btnTiny}>+ Customise list</button>
            <button onClick={() => onChange([])} style={btnTiny}>Hide on this proposal</button>
          </div>
        </div>
      )}

      {state === 'customised' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(value ?? []).map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={b}
                  onChange={e => updateBullet(i, e.target.value)}
                  placeholder={`Bullet ${i + 1}`}
                />
                <button onClick={() => removeBullet(i)} style={btnDanger} aria-label='Remove bullet'>
                  −
                </button>
              </div>
            ))}
            <button onClick={addBullet} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Add bullet</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={btnTiny}>Use default</button>
            <button onClick={() => onChange([])} style={btnTiny}>Hide on this proposal</button>
          </div>
        </div>
      )}

      {state === 'hidden' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.04)',
            border: `1px dashed rgba(239,68,68,0.3)`,
            fontSize: 12, color: A.danger, fontFamily: A.font,
          }}>
            This list will not appear on the proposal.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={btnTiny}>Show default</button>
            <button onClick={() => onChange(canonical ?? [])} style={btnTiny}>Customise instead</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sortable card (compact list view) ────────────────────────────────────────

function SortableCardRow({
  card,
  onEdit,
  onRemove,
  onToggleVisibility,
}: {
  card:               CardSelection
  onEdit:             (card: CardSelection) => void
  onRemove:           (card: CardSelection) => void
  onToggleVisibility: (card: CardSelection) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging }
    = useSortable({ id: card.id })

  // Resolve display values (override or canonical fallback)
  const displayName  = resolveText(card.nameOverride,  card.canonicalName).rendered
  const displayImage = thumbSrc(card.imageSrcOverride ?? card.canonicalImageSrc)
  const customisedCount = [
    card.kickerOverride, card.nameOverride, card.taglineOverride,
    card.bodyOverride, card.bulletsHeadingOverride,
    card.imageSrcOverride, card.imageAltOverride,
    card.imageCreditOverride, card.imageCreditUrlOverride,
    card.imageLicenseOverride,
  ].filter(v => v !== null).length
    + (card.bulletsOverride !== null ? 1 : 0)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.6 : (card.isActive ? 1 : 0.55),
    background: A.bgInput,
    border:     `1px solid ${isDragging ? A.borderGold : A.border}`,
    borderRadius: 12,
    padding:    '12px 14px',
    display:    'flex',
    alignItems: 'center',
    gap:        12,
  }

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
        {displayImage && (
          <img
            src={displayImage}
            alt=''
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        )}
        {!displayImage && <span style={{ fontSize: 9, color: A.faint, fontFamily: A.font }}>no img</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayName || <span style={{ color: A.faint, fontStyle: 'italic' }}>(unnamed)</span>}
        </div>
        <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
          {card.canonicalGlobalDestSlug ?? '-'}
          {customisedCount > 0 && (
            <span style={{ color: A.gold, marginLeft: 8 }}>
              · {customisedCount} customised
            </span>
          )}
          {!card.isActive && (
            <span style={{ color: A.danger, marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              hidden
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggleVisibility(card)} style={btnGhost}>
          {card.isActive ? 'Hide' : 'Show'}
        </button>
        <button onClick={() => onEdit(card)} style={btnGhost}>Customise</button>
        <button onClick={() => onRemove(card)} style={btnDanger}>Remove</button>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

interface OverrideDraft {
  kickerOverride:             string | null
  nameOverride:               string | null
  taglineOverride:            string | null
  bodyOverride:               string | null
  bulletsHeadingOverride:    string | null
  bulletsOverride:            string[] | null
  imageSrcOverride:          string | null
  imageAltOverride:          string | null
  imageCreditOverride:       string | null
  imageCreditUrlOverride:   string | null
  imageLicenseOverride:      string | null
}

function selectionToDraft(card: CardSelection): OverrideDraft {
  return {
    kickerOverride:             card.kickerOverride,
    nameOverride:               card.nameOverride,
    taglineOverride:            card.taglineOverride,
    bodyOverride:               card.bodyOverride,
    bulletsHeadingOverride:    card.bulletsHeadingOverride,
    bulletsOverride:            card.bulletsOverride,
    imageSrcOverride:          card.imageSrcOverride,
    imageAltOverride:          card.imageAltOverride,
    imageCreditOverride:       card.imageCreditOverride,
    imageCreditUrlOverride:   card.imageCreditUrlOverride,
    imageLicenseOverride:      card.imageLicenseOverride,
  }
}

function EditModal({
  card,
  onClose,
  onSaved,
  showToast,
}: {
  card:      CardSelection
  onClose:   () => void
  onSaved:   () => void
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [draft, setDraft]   = useState<OverrideDraft>(() => selectionToDraft(card))
  const [saving, setSaving] = useState(false)

  function patch<K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }
// Replace the handleSave function inside EditModal with this version

  async function handleSave() {
    setSaving(true)
    try {
      const original = selectionToDraft(card)
      const fields: Partial<OverrideDraft> = {}
      ;(Object.keys(draft) as (keyof OverrideDraft)[]).forEach(k => {
        if (JSON.stringify(draft[k]) !== JSON.stringify(original[k])) {
          ;(fields as any)[k] = draft[k]
        }
      })

      if (Object.keys(fields).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }

      const allDefault = (Object.keys(draft) as (keyof OverrideDraft)[])
        .every(k => draft[k] === null)

      if (allDefault && card.overrideId) {
        await deleteOverride(card.overrideId)
        showToast('Reset to defaults.', 'success')
        onSaved()
        setSaving(false)
        return
      }

      const cardId = (card.kind === 'dining' ? card.diningVenueId : card.experienceId) ?? ''
      await upsertOverride({
        engagementId: card.engagementId,
        kind:        card.kind,
        cardId:     cardId,
        overrideId: card.overrideId,
        fields,
      })
      showToast(`Saved ${Object.keys(fields).length} change${Object.keys(fields).length === 1 ? '' : 's'}.`, 'success')

      onSaved()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
    }
    setSaving(false)
  }
  async function handleResetAll() {
    const confirmed = window.confirm(
      `Reset all customisations on this card?\n\n` +
      `All fields will revert to default. Cannot be undone.`,
    )
    if (!confirmed) return

    setSaving(true)
    try {
      if (card.overrideId) {
        await deleteOverride(card.overrideId)
      }
      showToast('Reset to defaults.', 'success')
      onSaved()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
    }
    setSaving(false)
  }

  const hasOverride = card.overrideId !== null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px', overflowY: 'auto',
    }}>
      <div style={{
        background: A.bg, border: `1px solid ${A.borderGold}`, borderRadius: 20,
        padding: 28, width: '100%', maxWidth: 720,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Customise - {card.kind === 'dining' ? 'Dining' : 'Experience'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {card.canonicalName ?? '(unnamed)'}
            </div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
              {card.canonicalGlobalDestSlug ?? '-'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(216,181,106,0.06)',
          border: `1px solid ${A.borderGold}`,
          fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6,
        }}>
          Each field shows its default. Choose <strong style={{ color: A.gold }}>Customise</strong> to change it on this proposal only,
          or <strong style={{ color: A.danger }}>Hide</strong> to omit it.
          The default content lives on the card itself and is shared across proposals.
        </div>

        {/* Text fields */}
        <TextOverrideField
          label='Kicker'
          description='Small label above the card name (e.g. "Dining", "Experience").'
          canonical={card.canonicalKicker}
          value={draft.kickerOverride}
          onChange={v => patch('kickerOverride', v)}
        />

        <TextOverrideField
          label='Name'
          canonical={card.canonicalName}
          value={draft.nameOverride}
          onChange={v => patch('nameOverride', v)}
        />

        <TextOverrideField
          label='Tagline'
          description='One-line summary shown under the name.'
          canonical={card.canonicalTagline}
          value={draft.taglineOverride}
          onChange={v => patch('taglineOverride', v)}
        />

        <TextOverrideField
          label='Body'
          description='Main descriptive paragraph.'
          canonical={card.canonicalBody}
          value={draft.bodyOverride}
          onChange={v => patch('bodyOverride', v)}
          multiline
        />

        <TextOverrideField
          label='Bullets heading'
          description='Optional heading shown above the bullet list (e.g. "Highlights").'
          canonical={card.canonicalBulletsHeading}
          value={draft.bulletsHeadingOverride}
          onChange={v => patch('bulletsHeadingOverride', v)}
        />

        <BulletsOverrideField
          label='Bullets'
          description='Short list of highlights or details.'
          canonical={card.canonicalBullets}
          value={draft.bulletsOverride}
          onChange={v => patch('bulletsOverride', v)}
        />

        {/* Image fields */}
        <ImageOverrideField
          label='Image'
          canonical={card.canonicalImageSrc}
          value={draft.imageSrcOverride}
          onChange={v => patch('imageSrcOverride', v)}
        />

        <TextOverrideField
          label='Image alt text'
          description='Description of the image for accessibility.'
          canonical={card.canonicalImageAlt}
          value={draft.imageAltOverride}
          onChange={v => patch('imageAltOverride', v)}
        />

        <TextOverrideField
          label='Image credit'
          description='Photographer or source credit.'
          canonical={card.canonicalImageCredit}
          value={draft.imageCreditOverride}
          onChange={v => patch('imageCreditOverride', v)}
        />

        <TextOverrideField
          label='Image credit URL'
          canonical={card.canonicalImageCreditUrl}
          value={draft.imageCreditUrlOverride}
          onChange={v => patch('imageCreditUrlOverride', v)}
        />

        <TextOverrideField
          label='Image license'
          canonical={card.canonicalImageLicense}
          value={draft.imageLicenseOverride}
          onChange={v => patch('imageLicenseOverride', v)}
        />

        {/* Action bar */}
        <div style={{
          display: 'flex', gap: 10, paddingTop: 12,
          borderTop: `1px solid ${A.border}`,
          position: 'sticky', bottom: 0, background: A.bg,
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={onClose} disabled={saving} style={btnGhost}>
            Cancel
          </button>
          {hasOverride && (
            <button onClick={handleResetAll} disabled={saving} style={{ ...btnDanger, marginLeft: 'auto' }}>
              Reset all to defaults
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Card picker ──────────────────────────────────────────────────────────

function AddCardModal({
  engagementId,
  existingKeys,
  selections,
  onClose,
  onAdded,
  showToast,
}: {
  engagementId:  string
  existingKeys:  Set<string>
  selections:    CardSelection[]
  onClose:       () => void
  onAdded:       () => void
  showToast:     (msg: string, type: 'success' | 'error') => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<CardCanonicalOption[]>([])
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      searchCanonicalCards(query).then(setResults).catch(() => setResults([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(
    () => results.filter(r => !existingKeys.has(`${r.kind}:${r.id}`)),
    [results, existingKeys],
  )

  async function addOne(option: CardCanonicalOption) {
    if (adding) return
    setAdding(true)
    try {
      const sortOrder = nextSortOrder(selections, option.kind)
      await insertSelection({
        engagementId: engagementId,
        kind:       option.kind,
        cardId:    option.id,
        sortOrder: sortOrder,
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
        padding: 24, width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>
            Add card to this proposal
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          Search dining venues and experiences. Cards already on this proposal are hidden.
        </div>

        <input
          style={inputStyle}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search by name…'
          autoFocus
        />

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          maxHeight: 420, overflowY: 'auto',
        }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 12, textAlign: 'center' }}>
              {query ? 'No matching cards.' : 'Start typing to search.'}
            </div>
          )}
          {filtered.map(c => {
            const thumb = thumbSrc(c.imageSrc)
            return (
              <button
                key={`${c.kind}:${c.id}`}
                onClick={() => addOne(c)}
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
                <div style={{
                  width: 40, height: 30, borderRadius: 4, overflow: 'hidden',
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
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: A.text }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                    {c.globalDestinationSlug ?? '-'}
                  </span>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: c.kind === 'dining' ? A.gold : A.muted,
                  whiteSpace: 'nowrap',
                }}>
                  {c.kind}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CardsEditor({
  engagementId,
  showToast,
}: {
  engagementId: string
  showToast:    (msg: string, type: 'success' | 'error') => void
}) {
  const [cards, setCards]     = useState<CardSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CardSelection | null>(null)
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
      const list = await fetchCardSelections(engagementId)
      setCards(list)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to load cards: ${message}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  const existingKeys = useMemo(() => {
    const s = new Set<string>()
    cards.forEach(c => {
      if (c.diningVenueId) s.add(`dining:${c.diningVenueId}`)
      if (c.experienceId)   s.add(`experience:${c.experienceId}`)
    })
    return s
  }, [cards])

  // Split + sort by sort_order within each kind
  const dining     = useMemo(
    () => cards.filter(c => c.kind === 'dining').sort((a, b) => a.sortOrder - b.sortOrder),
    [cards],
  )
  const experience = useMemo(
    () => cards.filter(c => c.kind === 'experience').sort((a, b) => a.sortOrder - b.sortOrder),
    [cards],
  )

  async function handleDragEnd(kind: CardKind, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const list = kind === 'dining' ? dining : experience
    const oldIndex = list.findIndex(c => c.id === active.id)
    const newIndex = list.findIndex(c => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(list, oldIndex, newIndex)

    // Optimistic local update
    const reorderedIds = new Set(reordered.map(r => r.id))
    const otherCards = cards.filter(c => !reorderedIds.has(c.id))
    const reorderedWithSort = reordered.map((c, i) => ({ ...c, sortOrder: i + 1 }))
    setCards([...otherCards, ...reorderedWithSort])

    try {
      await reorderSelections(reordered.map(r => r.id))
      showToast('Reordered.', 'success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error'
      showToast(`Failed to reorder: ${message}`, 'error')
      load()
    }
  }

  async function handleRemove(card: CardSelection) {
    const displayName = card.nameOverride ?? card.canonicalName ?? '(unnamed)'
    const confirmed = window.confirm(
      `Remove "${displayName}" from this proposal?\n\n` +
      `This removes the card from this proposal only. The card itself stays available for other proposals.\n\n` +
      `Cannot be undone.`,
    )
    if (!confirmed) return

    try {
      // If override row exists, delete it first to avoid orphans
      if (card.overrideId) {
        await deleteOverride(card.overrideId)
      }
      await deleteSelection(card.id)
      showToast('Card removed.', 'success')
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed to remove: ${message}`, 'error')
    }
  }

  async function handleToggleVisibility(card: CardSelection) {
    try {
      await updateSelection(card.id, { isActive: !card.isActive })
      showToast(card.isActive ? 'Hidden on this proposal.' : 'Shown on this proposal.', 'success')
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error'
      showToast(`Failed: ${message}`, 'error')
    }
  }

  function renderGroup(label: string, list: CardSelection[], kind: CardKind) {
    if (list.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: A.faint, fontFamily: A.font,
        }}>
          {label} ({list.length})
        </div>
        <DndContext sensors={sensors} onDragEnd={(e) => handleDragEnd(kind, e)}>
          <SortableContext items={list.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(card => (
                <SortableCardRow
                  key={card.id}
                  card={card}
                  onEdit={setEditing}
                  onRemove={handleRemove}
                  onToggleVisibility={handleToggleVisibility}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${A.border}`,
      borderRadius: 14, padding: 24,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 16, gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          }}>
            Dining & Experience Cards
          </div>
          <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginTop: 4, lineHeight: 1.6 }}>
            The cards shown on this proposal. Drag to reorder · click <em>Customise</em> to change copy or imagery for this proposal.
          </div>
        </div>
        <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add card</button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
      )}

      {!loading && cards.length === 0 && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: 16, textAlign: 'center' }}>
          No cards on this proposal yet. Add one to begin.
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {renderGroup('Dining',      dining,     'dining')}
          {renderGroup('Experiences', experience, 'experience')}
        </div>
      )}

      {editing && (
        <EditModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          showToast={showToast}
        />
      )}

      {adding && (
        <AddCardModal
          engagementId={engagementId}
          existingKeys={existingKeys}
          selections={cards}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); load() }}
          showToast={showToast}
        />
      )}
    </div>
  )
}