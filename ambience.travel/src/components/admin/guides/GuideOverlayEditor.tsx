/* GuideOverlayEditor.tsx — canonical overlay editor for all four guide variants.
 *
 * One editor authors every overlay field that affects the rendered guide.
 * Replaces the four near-identical Overlay tab bodies that used to live
 * inline in GuidesDiningTab / GuidesExperiencesTab / GuidesHotelsTab /
 * GuidesShoppingTab.
 *
 * What it owns:
 *   - The canonical 13-field draft state (hero, eyebrow, headline, intro,
 *     at_a_glance_bullets, accuracy_date, guide_year, guide_version,
 *     plan_your_visit_*, is_active)
 *   - Save / delete dispatch via injected callbacks
 *   - Bullets fields: newline-separated textarea ↔ string[] | null
 *   - Optimistic save semantics — toast on success, toast on no-op
 *
 * What it does not own:
 *   - The modal shell (GuideEditModal)
 *   - Variant-specific copy defaults (typesGuides.ts)
 *   - Persistence (caller injects onSave + onDelete)
 *
 * Last updated: S52 — initial build.
 */

import { useState } from 'react'
import { A } from '../../../tokens/tokensAdmin'
import { useToast } from '../../../providers/ToastContext'
import {
  inputStyle, textareaStyle,
  btnPrimary, btnGhost, btnDanger,
} from '../../../styles/stylesAdmin'
import { Field } from '../adminUi'
import ImageFieldWithUploader from '../ImageFieldWithUploader'
import {
  type GuideOverlayDraft,
  type GuideOverlayPatch,
  type GuideVariant,
  GUIDE_COPY,
} from '../../../types/typesGuides'

// ── BulletsField — shared newline-stringify pattern ───────────────────────────

function BulletsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label:        string
  value:        string[] | null
  onChange:     (next: string[] | null) => void
  placeholder?: string
}) {
  const [text, setText] = useState((value ?? []).join('\n'))

  function handleChange(next: string) {
    setText(next)
    const parsed = next.split('\n').map(s => s.trim()).filter(Boolean)
    onChange(parsed.length > 0 ? parsed : null)
  }

  return (
    <Field label={label}>
      <textarea
        style={{ ...textareaStyle, minHeight: 120, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GuideOverlayEditor({
  variant,
  guide,
  destinationName,
  onSave,
  onDelete,
  onClose,
}: {
  variant:         GuideVariant
  guide:           GuideOverlayDraft & { id: string }
  destinationName: string
  onSave:          (patch: GuideOverlayPatch) => Promise<void>
  onDelete:        () => Promise<void>
  onClose:         () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft]   = useState<GuideOverlayDraft>(guide)
  const [saving, setSaving] = useState(false)
  const copy = GUIDE_COPY[variant]

  function patch<K extends keyof GuideOverlayDraft>(k: K, v: GuideOverlayDraft[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: GuideOverlayPatch = {}
      const fields: (keyof GuideOverlayDraft)[] = [
        'hero_image_src', 'hero_image_alt',
        'eyebrow_override', 'headline_override', 'intro_override',
        'is_active', 'accuracy_date',
        'at_a_glance_bullets', 'guide_year', 'guide_version',
        'plan_your_visit_heading', 'plan_your_visit_intro', 'plan_your_visit_bullets',
      ]
      for (const f of fields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(guide[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }
      if (Object.keys(payload).length === 0) {
        toast.success('No changes.')
        setSaving(false)
        return
      }
      await onSave(payload)
      toast.success(`Saved ${Object.keys(payload).length} field(s).`)
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the ${copy.productLabel.toLowerCase()} overlay for ${destinationName}? Underlying ${copy.itemNounPlural} remain; only the per-destination overlay is removed.`)) return
    setSaving(true)
    try {
      await onDelete()
      toast.success('Overlay deleted.')
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setSaving(false)
  }

  return (
    <>
      {/* Hero */}
      <Field label='Hero Image Src'>
        <ImageFieldWithUploader
          value={draft.hero_image_src}
          onChange={v => patch('hero_image_src', v)}
        />
      </Field>
      <Field label='Hero Image Alt'>
        <input
          style={inputStyle}
          value={draft.hero_image_alt ?? ''}
          onChange={e => patch('hero_image_alt', e.target.value || null)}
        />
      </Field>

      {/* Headline / intro */}
      <Field label={`Eyebrow override (NULL = "${destinationName}" default)`}>
        <input
          style={inputStyle}
          value={draft.eyebrow_override ?? ''}
          onChange={e => patch('eyebrow_override', e.target.value || null)}
        />
      </Field>
      <Field label={`Headline override (NULL = "${copy.defaultHeadline}" default)`}>
        <input
          style={inputStyle}
          value={draft.headline_override ?? ''}
          onChange={e => patch('headline_override', e.target.value || null)}
        />
      </Field>
      <Field label='Intro override (NULL = default intro paragraph)'>
        <textarea
          style={textareaStyle}
          value={draft.intro_override ?? ''}
          onChange={e => patch('intro_override', e.target.value || null)}
        />
      </Field>

      {/* At a Glance */}
      <BulletsField
        label='At a Glance bullets (one per line — leave empty to hide block)'
        value={draft.at_a_glance_bullets}
        onChange={v => patch('at_a_glance_bullets', v)}
        placeholder={'First bullet\nSecond bullet\nThird bullet'}
      />

      {/* Plan your visit (closing page) */}
      <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}` }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          marginBottom: 12,
        }}>
          Plan Your Visit (closing page)
        </div>

        <Field label='Heading (NULL = "Plan Your Visit" default)'>
          <input
            style={inputStyle}
            value={draft.plan_your_visit_heading ?? ''}
            onChange={e => patch('plan_your_visit_heading', e.target.value || null)}
            placeholder='Plan Your Visit'
          />
        </Field>
        <Field label='Intro paragraph (leave empty to hide)'>
          <textarea
            style={textareaStyle}
            value={draft.plan_your_visit_intro ?? ''}
            onChange={e => patch('plan_your_visit_intro', e.target.value || null)}
          />
        </Field>
        <BulletsField
          label='Bullets (one per line — leave empty to hide block)'
          value={draft.plan_your_visit_bullets}
          onChange={v => patch('plan_your_visit_bullets', v)}
          placeholder={'Reservation guidance\nDress code\nGetting there'}
        />
      </div>

      {/* Year / Version / Accuracy */}
      <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}` }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          marginBottom: 12,
        }}>
          Publication Metadata
        </div>

        <Field label='Guide Year (NULL = current year on PDF generation)'>
          <input
            style={inputStyle}
            type='number'
            value={draft.guide_year ?? ''}
            onChange={e => {
              const n = e.target.value.trim()
              patch('guide_year', n.length > 0 ? parseInt(n, 10) : null)
            }}
            placeholder={String(new Date().getFullYear())}
          />
        </Field>
        <Field label='Guide Version (NULL = "1" default)'>
          <input
            style={inputStyle}
            value={draft.guide_version ?? ''}
            onChange={e => patch('guide_version', e.target.value || null)}
            placeholder='1'
          />
        </Field>
        <Field label='Accuracy Date (e.g. "May 2026" — leave empty to hide disclaimer)'>
          <input
            style={inputStyle}
            value={draft.accuracy_date ?? ''}
            onChange={e => patch('accuracy_date', e.target.value || null)}
            placeholder='e.g. May 2026'
          />
        </Field>
      </div>

      {/* Active */}
      <Field label='Active'>
        <select
          style={inputStyle}
          value={String(draft.is_active)}
          onChange={e => patch('is_active', e.target.value === 'true')}
        >
          <option value='true'>Yes</option>
          <option value='false'>No</option>
        </select>
      </Field>

      {/* Action row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}`,
      }}>
        <button onClick={handleDelete} style={btnDanger} disabled={saving}>
          Delete overlay
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}