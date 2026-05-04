/* EngagementDetailTab.tsx
 * Engagement detail/edit view for AmbienceAdmin.
 * Sectioned form mapping to all columns of travel_immerse_engagements.
 * Person/Trip linkage via typeahead. Welcome letter overrides surface
 * canonical placeholder. Danger zone delete with CASCADE warning.
 *
 * Out of scope (read-only summary only): card selections, route stops,
 * pricing rows, rooms.
 *
 * Last updated: S33C — Mount DestinationRowsEditor between Destination
 *   Section and Pricing Section. Remove destination_rows from
 *   ChildCountsSummary (now editable in-line).
 * Prior: S33B (re-ship 04 May) — ImageFieldWithUploader for hero image
 *   src fields.
 * Prior: S33 — Added iteration_label field to Identity section.
 */

import { useEffect, useState } from 'react'
import {
  fetchEngagementDetail,
  fetchChildCounts,
  fetchEngagementStatuses,
  fetchItineraryStatuses,
  fetchPeople,
  fetchTrips,
  fetchPersonById,
  fetchTripById,
  fetchWelcomeLetterCanonical,
  updateEngagement,
  deleteEngagement,
  type EngagementDetailRow,
  type StatusLookup,
  type PersonOption,
  type TripOption,
  type ChildCounts,
  type WelcomeLetterCanonical,
} from '../../lib/adminEngagementQueries'
import {
  buildEngagementUrl,
  navigateAdmin,
} from '../../lib/adminPath'
import { A } from '../../lib/adminTokens'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import DestinationRowsEditor from './DestinationRowsEditor'

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
      padding: '12px 20px', borderRadius: 12,
      background:   type === 'success' ? '#1a2e1a' : '#2e1a1a',
      border:       `1px solid ${type === 'success' ? A.positive + '50' : A.danger + '50'}`,
      color:        type === 'success' ? A.positive : A.danger,
      fontSize: 13, fontFamily: A.font, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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

// ── Styles ───────────────────────────────────────────────────────────────────

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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize:     'vertical',
  lineHeight: 1.7,
  minHeight:  90,
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

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: `rgba(216,181,106,0.12)`, color: A.gold,
  border: `1px solid rgba(216,181,106,0.30)`, borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer', letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
}

const btnDanger: React.CSSProperties = {
  padding: '7px 14px', background: 'transparent', color: A.danger,
  border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8,
  fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}

// ── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background:   A.bgCard,
      border:       `1px solid ${A.border}`,
      borderRadius: 14,
      padding:      24,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
        marginBottom: 16,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

// ── Typeahead ────────────────────────────────────────────────────────────────

function PersonTypeahead({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [query, setQuery]       = useState('')
  const [options, setOptions]   = useState<PersonOption[]>([])
  const [open, setOpen]         = useState(false)
  const [selected, setSelected] = useState<PersonOption | null>(null)

  useEffect(() => {
    if (!value) { setSelected(null); return }
    fetchPersonById(value).then(p => setSelected(p))
  }, [value])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      fetchPeople(query).then(setOptions).catch(() => setOptions([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query, open])

  function displayName(p: PersonOption): string {
    return p.nickname ?? p.first_name ?? '(unnamed)'
  }

  if (selected && !open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          background: A.bgInput, border: `1px solid ${A.border}`,
          fontSize: 13, color: A.text, fontFamily: A.font,
        }}>
          {displayName(selected)}
          {selected.last_name && <span style={{ color: A.faint, marginLeft: 6 }}>{selected.last_name}</span>}
        </div>
        <button onClick={() => { setOpen(true); setQuery('') }} style={btnGhost}>Change</button>
        <button onClick={() => onChange(null)} style={btnGhost}>Clear</button>
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
        placeholder='Search people…'
        autoFocus={open}
      />
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 10,
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map(p => (
            <div
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); setQuery('') }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                color: A.text, fontFamily: A.font,
                borderBottom: `1px solid ${A.border}`,
              }}
            >
              {displayName(p)}
              {p.last_name && <span style={{ color: A.faint, marginLeft: 6 }}>{p.last_name}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TripTypeahead({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [query, setQuery]       = useState('')
  const [options, setOptions]   = useState<TripOption[]>([])
  const [open, setOpen]         = useState(false)
  const [selected, setSelected] = useState<TripOption | null>(null)

  useEffect(() => {
    if (!value) { setSelected(null); return }
    fetchTripById(value).then(t => setSelected(t))
  }, [value])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      fetchTrips(query).then(setOptions).catch(() => setOptions([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query, open])

  if (selected && !open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          background: A.bgInput, border: `1px solid ${A.border}`,
          fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace',
        }}>
          {selected.trip_code}
          {selected.start_date && <span style={{ color: A.faint, marginLeft: 8, fontSize: 11 }}>{selected.start_date}</span>}
        </div>
        <button onClick={() => { setOpen(true); setQuery('') }} style={btnGhost}>Change</button>
        <button onClick={() => onChange(null)} style={btnGhost}>Clear</button>
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
        placeholder='Search trip code…'
        autoFocus={open}
      />
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 10,
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map(t => (
            <div
              key={t.id}
              onClick={() => { onChange(t.id); setOpen(false); setQuery('') }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                color: A.text, fontFamily: 'DM Mono, monospace',
                borderBottom: `1px solid ${A.border}`,
              }}
            >
              {t.trip_code}
              {t.start_date && <span style={{ color: A.faint, marginLeft: 8 }}>{t.start_date}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Journey types chip input ─────────────────────────────────────────────────

function ChipInput({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v) return
    if (values.includes(v)) { setDraft(''); return }
    onChange([...values, v])
    setDraft('')
  }

  function remove(v: string) {
    onChange(values.filter(x => x !== v))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 24 }}>
        {values.map(v => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: 'rgba(216,181,106,0.08)',
            border: `1px solid ${A.borderGold}`,
            color: A.gold, fontSize: 11, fontFamily: A.font, fontWeight: 600,
          }}>
            {v}
            <span onClick={() => remove(v)} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder='Add type… (Enter)'
        />
        <button onClick={add} style={btnGhost}>+ Add</button>
      </div>
    </div>
  )
}

// ── JSON editor (raw textarea — v0) ──────────────────────────────────────────

function JsonField({
  value,
  onChange,
  placeholder,
}: {
  value: unknown
  onChange: (next: unknown) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value ?? [], null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(JSON.stringify(value ?? [], null, 2))
  }, [value])

  function handleChange(next: string) {
    setDraft(next)
    try {
      const parsed = JSON.parse(next)
      setError(null)
      onChange(parsed)
    } catch (e: any) {
      setError(e.message ?? 'invalid JSON')
    }
  }

  return (
    <div>
      <textarea
        style={{ ...textareaStyle, fontFamily: 'DM Mono, monospace', minHeight: 110, fontSize: 12 }}
        value={draft}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder ?? '[]'}
      />
      {error && <div style={{ fontSize: 11, color: A.danger, fontFamily: A.font, marginTop: 4 }}>⚠ {error}</div>}
    </div>
  )
}

// ── Welcome override field ───────────────────────────────────────────────────

function WelcomeOverrideField({
  label,
  canonical,
  value,
  onChange,
}: {
  label:     string
  canonical: string | null
  value:     string | null
  onChange:  (next: string | null) => void
}) {
  const isOverriding = value !== null

  return (
    <Field label={label}>
      {!isOverriding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(216,181,106,0.04)',
            border: `1px dashed ${A.border}`,
            fontSize: 12, color: A.muted, fontFamily: A.font,
            fontStyle: 'italic',
          }}>
            <span style={{ color: A.faint, fontStyle: 'normal', fontSize: 10, marginRight: 6 }}>canonical:</span>
            {canonical ?? <span style={{ color: A.faint }}>—</span>}
          </div>
          <button onClick={() => onChange('')} style={{ ...btnGhost, alignSelf: 'flex-start', fontSize: 11 }}>+ Override</button>
        </div>
      )}
      {isOverriding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            style={{ ...textareaStyle, minHeight: 70 }}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            placeholder={`Override (empty string = hide; null = use canonical)`}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onChange(null)} style={{ ...btnGhost, fontSize: 11 }}>Use canonical</button>
            <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font, alignSelf: 'center' }}>
              Empty string hides the field on the page.
            </span>
          </div>
        </div>
      )}
    </Field>
  )
}

// ── Child counts summary ─────────────────────────────────────────────────────
// S33C: destination_rows removed — now editable inline via DestinationRowsEditor.

function ChildCountsSummary({ counts, urlId }: { counts: ChildCounts | null; urlId: string }) {
  if (!counts) return null

  const items = [
    { label: 'Pricing rows',          n: counts.pricing_rows },
    { label: 'Destination hotels',    n: counts.destination_hotels },
    { label: 'Region hotels',         n: counts.region_hotels },
    { label: 'Route stops',           n: counts.route_stops },
    { label: 'Card selections',       n: counts.card_selections },
    { label: 'Card overrides',        n: counts.card_overrides },
    { label: 'Rooms (overlay)',       n: counts.rooms },
  ]

  return (
    <Section title='Child Content (read-only)'>
      <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
        These tables aren't yet editable in admin. Edit via SQL or migrations. View live to verify render.
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8,
      }}>
        {items.map(item => (
          <div key={item.label} style={{
            padding: '10px 12px', borderRadius: 10,
            background: A.bgInput, border: `1px solid ${A.border}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>{item.n}</div>
          </div>
        ))}
      </div>
      <a
        href={buildEngagementUrl(urlId)}
        target='_blank'
        rel='noopener noreferrer'
        style={{ ...btnGhost, color: A.gold, borderColor: A.borderGold, alignSelf: 'flex-start' }}
      >
        View live ↗
      </a>
    </Section>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EngagementDetailTab({ urlId }: { urlId: string }) {
  const [row, setRow]                              = useState<EngagementDetailRow | null>(null)
  const [draft, setDraft]                          = useState<EngagementDetailRow | null>(null)
  const [counts, setCounts]                        = useState<ChildCounts | null>(null)
  const [engagementStatuses, setEngagementStatuses] = useState<StatusLookup[]>([])
  const [itineraryStatuses, setItineraryStatuses]  = useState<StatusLookup[]>([])
  const [welcomeCanon, setWelcomeCanon]            = useState<WelcomeLetterCanonical | null>(null)
  const [loading, setLoading]                      = useState(true)
  const [saving, setSaving]                        = useState(false)
  const [showLegacy, setShowLegacy]                = useState(false)
  const { toast, showToast }                       = useToast()

  async function load() {
    setLoading(true)
    try {
      const [detail, eng, it, canon] = await Promise.all([
        fetchEngagementDetail(urlId),
        fetchEngagementStatuses(),
        fetchItineraryStatuses(),
        fetchWelcomeLetterCanonical(),
      ])
      if (!detail) {
        showToast('Engagement not found.', 'error')
        setLoading(false)
        return
      }
      setRow(detail)
      setDraft(detail)
      setEngagementStatuses(eng)
      setItineraryStatuses(it)
      setWelcomeCanon(canon)

      const c = await fetchChildCounts(detail.id)
      setCounts(c)
    } catch (e: any) {
      showToast(`Failed to load: ${e.message ?? 'unknown error'}`, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [urlId])

  function patch<K extends keyof EngagementDetailRow>(key: K, value: EngagementDetailRow[K]) {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function handleSave() {
    if (!row || !draft) return
    setSaving(true)
    try {
      const payload: Partial<EngagementDetailRow> = {}
      ;(Object.keys(draft) as (keyof EngagementDetailRow)[]).forEach(k => {
        if (JSON.stringify(draft[k]) !== JSON.stringify(row[k])) {
          ;(payload as any)[k] = draft[k]
        }
      })
      if (Object.keys(payload).length === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }
      await updateEngagement(row.id, payload)
      showToast(`Saved ${Object.keys(payload).length} field(s).`, 'success')
      load()
    } catch (e: any) {
      showToast(`Failed: ${e.message ?? 'unknown error'}`, 'error')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!row) return
    const confirmed = window.confirm(
      `Delete engagement "${row.title || row.url_id}"?\n\n` +
      `This CASCADES through 10 child tables:\n` +
      `• route_stops · trip_destination_rows · trip_pricing_rows\n` +
      `• trip_regions · trip_region_hotels · trip_destination_hotels\n` +
      `• trip_content_card_selections · trip_content_card_overrides\n` +
      `• trip_display · immerse_rooms\n\n` +
      `This cannot be undone. Are you sure?`,
    )
    if (!confirmed) return
    try {
      await deleteEngagement(row.id)
      showToast('Engagement deleted.', 'success')
      navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: null })
    } catch (e: any) {
      showToast(`Failed to delete: ${e.message ?? 'unknown error'}`, 'error')
    }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
  }

  if (!row || !draft) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 14, color: A.text, fontFamily: A.font }}>Engagement not found.</div>
        <button onClick={() => navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: null })} style={btnGhost}>
          ← Back to list
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <button onClick={() => navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: null })} style={{ ...btnGhost, marginBottom: 8 }}>
            ← All Engagements
          </button>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
            Engagement
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
            {row.title || <span style={{ color: A.faint, fontStyle: 'italic' }}>(untitled)</span>}
          </div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>
            {row.url_id}
            {row.iteration_label && row.iteration_label.length > 0 && (
              <span style={{ color: A.muted, fontFamily: A.font }}> · {row.iteration_label}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Identity */}
      <Section title='Identity'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='url_id (immutable)'>
            <input style={{ ...inputStyle, fontFamily: 'DM Mono, monospace', opacity: 0.6 }} value={draft.url_id ?? ''} disabled />
          </Field>
          <Field label='Title'>
            <input style={inputStyle} value={draft.title ?? ''} onChange={e => patch('title', e.target.value)} />
          </Field>
          <Field label='Iteration Label'>
            <input
              style={inputStyle}
              value={draft.iteration_label}
              onChange={e => patch('iteration_label', e.target.value)}
              placeholder='Optional — e.g. Saudi VVIP, Refresh, Pre-Saudi'
            />
          </Field>
          <Field label='Sort Order'>
            <input
              style={inputStyle}
              type='number'
              value={draft.sort_order}
              onChange={e => patch('sort_order', parseInt(e.target.value, 10) || 0)}
            />
          </Field>
          <Field label='Audience'>
            <select style={inputStyle} value={draft.audience} onChange={e => patch('audience', e.target.value as any)}>
              <option value='private'>private</option>
              <option value='public'>public</option>
            </select>
          </Field>
          <Field label='Public Template?'>
            <select
              style={inputStyle}
              value={String(draft.is_public_template ?? false)}
              onChange={e => patch('is_public_template', e.target.value === 'true')}
            >
              <option value='false'>No</option>
              <option value='true'>Yes</option>
            </select>
          </Field>
          <Field label='Engagement Type'>
            <select style={inputStyle} value={draft.engagement_type} onChange={e => patch('engagement_type', e.target.value)}>
              <option value='journey'>journey</option>
              <option value='service'>service</option>
              <option value='experience'>experience</option>
              <option value='acquisition'>acquisition</option>
            </select>
          </Field>
          <Field label='Trip Format'>
            <select style={inputStyle} value={draft.trip_format} onChange={e => patch('trip_format', e.target.value)}>
              <option value='journey'>journey</option>
              <option value='experience'>experience</option>
            </select>
          </Field>
          <Field label='is_public'>
            <select
              style={inputStyle}
              value={String(draft.is_public)}
              onChange={e => patch('is_public', e.target.value === 'true')}
            >
              <option value='false'>false</option>
              <option value='true'>true</option>
            </select>
          </Field>
        </div>

        <Field label='Journey Types'>
          <ChipInput values={draft.journey_types ?? []} onChange={v => patch('journey_types', v)} />
        </Field>

        <div>
          <button onClick={() => setShowLegacy(s => !s)} style={{ ...btnGhost, fontSize: 11 }}>
            {showLegacy ? '▲ Hide' : '▼ Show'} legacy fields
          </button>
        </div>
        {showLegacy && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
            <Field label='slug (deprecated)'>
              <input style={inputStyle} value={draft.slug ?? ''} onChange={e => patch('slug', e.target.value || null)} />
            </Field>
          </div>
        )}
      </Section>

      {/* Linkage */}
      <Section title='Linkage'>
        <Field label='Person'>
          <PersonTypeahead value={draft.person_id} onChange={v => patch('person_id', v)} />
        </Field>
        <Field label='Trip (canonical)'>
          <TripTypeahead value={draft.trip_id} onChange={v => patch('trip_id', v)} />
        </Field>
      </Section>

      {/* Status */}
      <Section title='Status'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Engagement Status'>
            <select
              style={inputStyle}
              value={draft.engagement_status_id}
              onChange={e => patch('engagement_status_id', e.target.value)}
            >
              {engagementStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label='Itinerary Status'>
            <select
              style={inputStyle}
              value={draft.itinerary_status_id}
              onChange={e => patch('itinerary_status_id', e.target.value)}
            >
              {itineraryStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label='status_label (legacy free-text)'>
          <input style={inputStyle} value={draft.status_label ?? ''} onChange={e => patch('status_label', e.target.value || null)} />
        </Field>
      </Section>

      {/* Hero primary */}
      <Section title='Hero — Primary'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Eyebrow'>
            <input style={inputStyle} value={draft.eyebrow ?? ''} onChange={e => patch('eyebrow', e.target.value || null)} />
          </Field>
          <Field label='Hero Tagline'>
            <input style={inputStyle} value={draft.hero_tagline ?? ''} onChange={e => patch('hero_tagline', e.target.value || null)} />
          </Field>
          <Field label='Subtitle'>
            <input style={inputStyle} value={draft.subtitle ?? ''} onChange={e => patch('subtitle', e.target.value || null)} />
          </Field>
          <div />
        </div>

        <Field label='Hero Image Src'>
          <ImageFieldWithUploader
            value={draft.hero_image_src}
            onChange={v => patch('hero_image_src', v)}
          />
        </Field>
        <Field label='Hero Image Alt'>
          <input style={inputStyle} value={draft.hero_image_alt ?? ''} onChange={e => patch('hero_image_alt', e.target.value || null)} />
        </Field>

        <Field label='Hero Pills (jsonb)'>
          <JsonField value={draft.hero_pills} onChange={v => patch('hero_pills', v)} />
        </Field>
      </Section>

      {/* Hero secondary */}
      <Section title='Hero — Secondary'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Title 2'>
            <input style={inputStyle} value={draft.hero_title_2 ?? ''} onChange={e => patch('hero_title_2', e.target.value || null)} />
          </Field>
          <Field label='Subtitle 2'>
            <input style={inputStyle} value={draft.hero_subtitle_2 ?? ''} onChange={e => patch('hero_subtitle_2', e.target.value || null)} />
          </Field>
        </div>

        <Field label='Image Src 2'>
          <ImageFieldWithUploader
            value={draft.hero_image_src_2}
            onChange={v => patch('hero_image_src_2', v)}
          />
        </Field>
        <Field label='Image Alt 2'>
          <input style={inputStyle} value={draft.hero_image_alt_2 ?? ''} onChange={e => patch('hero_image_alt_2', e.target.value || null)} />
        </Field>
      </Section>

      {/* Route */}
      <Section title='Route Section'>
        <Field label='Route Eyebrow'>
          <input style={inputStyle} value={draft.route_eyebrow ?? ''} onChange={e => patch('route_eyebrow', e.target.value || null)} />
        </Field>
        <Field label='Route Heading'>
          <input style={inputStyle} value={draft.route_heading ?? ''} onChange={e => patch('route_heading', e.target.value || null)} />
        </Field>
        <Field label='Route Body'>
          <textarea style={textareaStyle} value={draft.route_body ?? ''} onChange={e => patch('route_body', e.target.value || null)} />
        </Field>
      </Section>

      {/* Destination Section copy (engagement-level intro to destinations) */}
      <Section title='Destination Section'>
        <Field label='Destination Heading'>
          <input style={inputStyle} value={draft.destination_heading ?? ''} onChange={e => patch('destination_heading', e.target.value || null)} />
        </Field>
        <Field label='Destination Subtitle'>
          <input style={inputStyle} value={draft.destination_subtitle ?? ''} onChange={e => patch('destination_subtitle', e.target.value || null)} />
        </Field>
        <Field label='Destination Body'>
          <textarea style={textareaStyle} value={draft.destination_body ?? ''} onChange={e => patch('destination_body', e.target.value || null)} />
        </Field>
      </Section>

      {/* S33C: Destination rows editor (drag-reorder + per-row modal editor) */}
      {row.id && (
        <DestinationRowsEditor engagementId={row.id} showToast={showToast} />
      )}

      {/* Pricing */}
      <Section title='Pricing Section'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Heading'>
            <input style={inputStyle} value={draft.pricing_heading ?? ''} onChange={e => patch('pricing_heading', e.target.value || null)} />
          </Field>
          <Field label='Title'>
            <input style={inputStyle} value={draft.pricing_title ?? ''} onChange={e => patch('pricing_title', e.target.value || null)} />
          </Field>
          <Field label='Total Label'>
            <input style={inputStyle} value={draft.pricing_total_label ?? ''} onChange={e => patch('pricing_total_label', e.target.value || null)} />
          </Field>
          <Field label='Total Value'>
            <input style={inputStyle} value={draft.pricing_total_value ?? ''} onChange={e => patch('pricing_total_value', e.target.value || null)} />
          </Field>
          <Field label='Notes Heading'>
            <input style={inputStyle} value={draft.pricing_notes_heading ?? ''} onChange={e => patch('pricing_notes_heading', e.target.value || null)} />
          </Field>
          <Field label='Notes Title'>
            <input style={inputStyle} value={draft.pricing_notes_title ?? ''} onChange={e => patch('pricing_notes_title', e.target.value || null)} />
          </Field>
        </div>
        <Field label='Body'>
          <textarea style={textareaStyle} value={draft.pricing_body ?? ''} onChange={e => patch('pricing_body', e.target.value || null)} />
        </Field>
        <Field label='Notes (jsonb)'>
          <JsonField value={draft.pricing_notes} onChange={v => patch('pricing_notes', v)} />
        </Field>
      </Section>

      {/* Welcome overrides */}
      <Section title='Welcome Letter — Per-Engagement Overrides'>
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
          NULL = canonical singleton flows through. Empty string = hide field. Non-empty = override.
        </div>
        <WelcomeOverrideField
          label='Eyebrow'
          canonical={welcomeCanon?.eyebrow ?? null}
          value={draft.welcome_eyebrow_override}
          onChange={v => patch('welcome_eyebrow_override', v)}
        />
        <WelcomeOverrideField
          label='Title'
          canonical={welcomeCanon?.title ?? null}
          value={draft.welcome_title_override}
          onChange={v => patch('welcome_title_override', v)}
        />
        <WelcomeOverrideField
          label='Body'
          canonical={welcomeCanon?.body ?? null}
          value={draft.welcome_body_override}
          onChange={v => patch('welcome_body_override', v)}
        />
        <WelcomeOverrideField
          label='Signoff Body'
          canonical={welcomeCanon?.signoff_body ?? null}
          value={draft.welcome_signoff_body_override}
          onChange={v => patch('welcome_signoff_body_override', v)}
        />
        <WelcomeOverrideField
          label='Signoff Name'
          canonical={welcomeCanon?.signoff_name ?? null}
          value={draft.welcome_signoff_name_override}
          onChange={v => patch('welcome_signoff_name_override', v)}
        />
      </Section>

      {/* Child counts (now without destination_rows) */}
      {row.url_id && <ChildCountsSummary counts={counts} urlId={row.url_id} />}

      {/* Save bar (sticky bottom) */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 10,
        background: A.bg, borderTop: `1px solid ${A.border}`,
        padding: '14px 0', marginTop: 8,
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
          Only changed fields are written.
        </span>
      </div>

      {/* Danger zone */}
      <Section title='Danger Zone'>
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          Deletion cascades through 10 child tables. There is no undo.
        </div>
        <button onClick={handleDelete} style={btnDanger}>Delete Engagement</button>
      </Section>
    </div>
  )
}