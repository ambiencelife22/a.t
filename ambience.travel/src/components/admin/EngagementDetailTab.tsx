/* EngagementDetailTab.tsx
 * Engagement detail/edit view for AmbienceAdmin.
 * Sectioned form mapping to all columns of travel_engagements.
* Person/Trip linkage via typeahead. Welcome letter overrides surface
 * canonical placeholder. Two removal paths: Archive (reversible, calm) and
 * Delete (irreversible, Danger Zone, financial-guarded via EF).
 *
 * Out of scope (read-only summary only): pricing rows, rooms, hotels.
 *
 * Last updated: S54 - All writes migrated to travel-write-engagement EF.
 *   Status changes routed through setEngagementStatus/setItineraryStatus
 *   (two independent axes). Added reversible Archive section; Delete now
 *   EF-backed and refuses when bookings/time_entries/requests exist
 *   (Retention Spec v1). is_public / is_public_template made read-only
 *   (template-library concern, not live visibility - deferred to a future
 *   template surface). public_view is the live gate (set_visibility).
 * Prior: S334 - Replace window.confirm-based handleDelete with
 *   DeleteEngagementModal (4-step destructive confirmation, mirrors SPORTS
 *   DeleteSystemSection pattern). Engagement title type-to-confirm gate.
 * Prior: S334 - Replace CardOverridesEditor with CardsEditor.
 *   Selections-primary architecture: CardsEditor mounts the curation table
 *   (which cards render, sort_order per kind, is_active visibility) with
 *   override-on-demand inside each card's Customise modal. Drop both
 *   card_selections and card_overrides from ChildCountsSummary.
 * Prior: S334 - Mount RouteStopsEditor under Route Section. Drop route_stops
 *   from ChildCountsSummary.
 * Prior: S33C - Mount DestinationRowsEditor between Destination Section
 *   and Pricing Section. Remove destination_rows from ChildCountsSummary.
 * Prior: S33B (re-ship 04 May) - ImageFieldWithUploader for hero image
 *   src fields.
 */

import { useEffect, useState } from 'react'
import {
  fetchEngagementDetail, searchHouses,
  linkHouse, unlinkHouse, setPrimaryHouse, setLabel,
  type EngagementHouseLink, type CandidateLabel, type HouseOption,
  fetchChildCounts,
  fetchEngagementStatuses,
  fetchItineraryStatuses,
  fetchEngagementTypes,
  type EngagementTypeLookup,
  fetchPeople,
  fetchTrips,
  fetchPersonById,
  fetchEngagementById,
  fetchWelcomeLetterCanonical,
  updateEngagement,
  setEngagementStatus,
  setItineraryStatus,
  setEngagementVisibility,
  setEngagementProposalVisibility,
  archiveEngagement,
  deleteEngagement,
  type EngagementDetailRow,
  type StatusLookup,
  type PersonOption,
  type EngagementOption,
  type ChildCounts,
  type WelcomeLetterCanonical,
} from '../../queries/queriesAdminEngagements'
import {
  buildEngagementUrl,
  navigateAdmin,
} from '../../utils/utilsAdminPath'
import { A } from '../../tokens/tokensAdmin'
import ImageFieldWithUploader from './ImageFieldWithUploader'
import DestinationRowsEditor from './DestinationRowsEditor'
import RouteStopsEditor from './RouteStopsEditor'
import CardsEditor from './CardsEditor'
import RoomsEditor from './RoomsEditor'
import DeleteEngagementModal from './DeleteEngagementModal'

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
    return p.nickname ?? p.firstName ?? '(unnamed)'
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
          {selected.lastName && <span style={{ color: A.faint, marginLeft: 6 }}>{selected.lastName}</span>}
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
              {p.lastName && <span style={{ color: A.faint, marginLeft: 6 }}>{p.lastName}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HouseTypeahead({ onPick }: { onPick: (houseId: string) => void }) {
  const [query, setQuery]     = useState('')
  const [options, setOptions] = useState<HouseOption[]>([])
  const [open, setOpen]       = useState(false)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      searchHouses(query).then(setOptions).catch(() => setOptions([]))
    }, 150)
    return () => clearTimeout(t)
  }, [query, open])
  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder='Search houses to link…'
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
              onClick={() => { onPick(h.id); setOpen(false); setQuery('') }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                color: A.text, fontFamily: A.font,
                borderBottom: `1px solid ${A.border}`,
              }}
            >
              {h.displayName}
              {h.public_name && <span style={{ color: A.faint, marginLeft: 6 }}>{h.public_name}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EngagementTypeahead({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [query, setQuery]       = useState('')
  const [options, setOptions]   = useState<EngagementOption[]>([])
  const [open, setOpen]         = useState(false)
  const [selected, setSelected] = useState<EngagementOption | null>(null)

  useEffect(() => {
    if (!value) { setSelected(null); return }
    fetchEngagementById(value).then(t => setSelected(t))
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
          {selected.journeyCode}
          {selected.startDate && <span style={{ color: A.faint, marginLeft: 8, fontSize: 11 }}>{selected.startDate}</span>}
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
              {t.journeyCode}
              {t.startDate && <span style={{ color: A.faint, marginLeft: 8 }}>{t.startDate}</span>}
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

// ── JSON editor (raw textarea - v0) ──────────────────────────────────────────

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
            {canonical ?? <span style={{ color: A.faint }}>-</span>}
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
// S33C: destination_rows removed - now editable inline via DestinationRowsEditor.
// S334: route_stops removed - now editable inline via RouteStopsEditor.
// S334: card_selections + card_overrides removed - now both editable inline via
//       CardsEditor (selections-primary, override-on-demand).

function ChildCountsSummary({ counts, urlId }: { counts: ChildCounts | null; urlId: string }) {
  if (!counts) return null

  const items = [
    { label: 'Pricing rows',          n: counts.pricingRows },
    { label: 'Destination hotels',    n: counts.destination_hotels },
    { label: 'Region hotels',         n: counts.region_hotels },
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
  const [engagementTypes, setEngagementTypes]      = useState<EngagementTypeLookup[]>([])
  const [welcomeCanon, setWelcomeCanon]            = useState<WelcomeLetterCanonical | null>(null)
  const [loading, setLoading]                      = useState(true)
  const [saving, setSaving]                        = useState(false)
  const [showLegacy, setShowLegacy]                = useState(false)
  const [deleteOpen, setDeleteOpen]                = useState(false)
  const [archiving, setArchiving]                  = useState(false)
  const [houses, setHouses]                        = useState<EngagementHouseLink[]>([])
  const [candidateLabels, setCandidateLabels]      = useState<CandidateLabel[]>([])
  const { toast, showToast }                       = useToast()

  async function load() {
    setLoading(true)
    try {
      const [detail, eng, it, canon, types] = await Promise.all([
        fetchEngagementDetail(urlId),
        fetchEngagementStatuses(),
        fetchItineraryStatuses(),
        fetchWelcomeLetterCanonical(),
        fetchEngagementTypes(),
      ])
      if (!detail) {
        showToast('Engagement not found.', 'error')
        setLoading(false)
        return
      }
      setRow(detail.row)
      setDraft(detail.row)
      setHouses(detail.houses)
      setCandidateLabels(detail.candidate_labels)
      setEngagementStatuses(eng)
      setItineraryStatuses(it)
      setWelcomeCanon(canon)
      setEngagementTypes(types)

      const c = await fetchChildCounts(detail.row.id)
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
      // Columns handled by dedicated EF modes - excluded from the scalar patch.
      const STATUS_KEYS = new Set<keyof EngagementDetailRow>([
        'engagementStatusId', 'itineraryStatusId',
      ])

      const patch: Record<string, unknown> = {}
      let statusOps = 0
      let scalarOps = 0

      for (const k of Object.keys(draft) as (keyof EngagementDetailRow)[]) {
        if (JSON.stringify(draft[k]) === JSON.stringify(row[k])) continue
        if (STATUS_KEYS.has(k)) { statusOps++; continue }      // routed below
        ;(patch as any)[k] = draft[k]
        scalarOps++
      }

      // Resolve status ids -> slugs for the status modes (two independent axes).
      async function applyStatusChanges() {
        if (draft!.engagementStatusId !== row!.engagementStatusId) {
          const slug = engagementStatuses.find(s => s.id === draft!.engagementStatusId)?.slug
          if (slug) await setEngagementStatus(row!.id, slug as any)
        }
        if (draft!.itineraryStatusId !== row!.itineraryStatusId) {
          const slug = itineraryStatuses.find(s => s.id === draft!.itineraryStatusId)?.slug
          if (slug) await setItineraryStatus(row!.id, slug as any)
        }
      }

      if (scalarOps === 0 && statusOps === 0) {
        showToast('No changes.', 'success')
        setSaving(false)
        return
      }

      if (scalarOps > 0) await updateEngagement(row.id, patch)
      if (statusOps > 0) await applyStatusChanges()

      showToast(`Saved ${scalarOps + statusOps} change(s).`, 'success')
      load()
    } catch (e: any) {
      showToast(`Failed: ${e.message ?? 'unknown error'}`, 'error')
    }
    setSaving(false)
  }

  // Delete = irreversible hard delete, through the EF. The EF refuses (409)
  // if any financial/operational record exists, surfacing a friendly message
  // that steers to Archive instead. Only record-free engagements delete.
  async function handleDeleteConfirm() {
    if (!row) throw new Error('No engagement loaded.')
    await deleteEngagement(row.id)
    // Success: modal shows success state; handleDeleteClose navigates away.
  }

  // AXIS-2 - toggle proposal_visibility (active|archived). Orthogonal to
  // archive/status: this controls what the CLIENT sees on a still-resolving
  // proposal URL (proposal content vs the "ask your travel designer" fallback),
  // not the engagement's lifecycle. Optimistic, inline-save.
  const [visSaving, setVisSaving] = useState(false)
  async function handleToggleProposalVisibility() {
    if (!row || !draft) return
    const next = draft.proposalVisibility === 'archived' ? 'active' : 'archived'
    setVisSaving(true)
    patch('proposalVisibility', next)  // optimistic
    try {
      await setEngagementProposalVisibility(row.id, next)
      setRow(prev => prev ? { ...prev, proposalVisibility: next } : prev)
    } catch (e: any) {
      patch('proposalVisibility', draft.proposalVisibility)  // revert
      showToast(`Failed: ${e.message ?? 'unknown error'}`, 'error')
    }
    setVisSaving(false)
  }

  // Archive = reversible. Calm single confirm, sets status -> cancelled,
  // itinerary -> archived. Content preserved; reactivatable via status.
  async function handleArchive() {
    if (!row) return
    if (!window.confirm('Archive this engagement? It will be set to Cancelled and can be reactivated later.')) return
    setArchiving(true)
    try {
      await archiveEngagement(row.id, 'cancelled')
      showToast('Engagement archived.', 'success')
      load()
    } catch (e: any) {
      showToast(`Failed: ${e.message ?? 'unknown error'}`, 'error')
    }
    setArchiving(false)
  }

  function handleDeleteClose() {
    setDeleteOpen(false)
    // If row is gone after a successful delete, navigate away
    fetchEngagementDetail(urlId).then(detail => {
      if (!detail) {
        navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: null })
      }
    }).catch(() => {
      navigateAdmin({ product: 'immerse', tab: 'engagements', urlId: null })
    })
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
            {row.urlId}
            {row.iterationLabel && row.iterationLabel.length > 0 && (
              <span style={{ color: A.muted, fontFamily: A.font }}> · {row.iterationLabel}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {row.urlId && (
            <a
              href={buildEngagementUrl(row.urlId)}
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
            <input style={{ ...inputStyle, fontFamily: 'DM Mono, monospace', opacity: 0.6 }} value={draft.urlId ?? ''} disabled />
          </Field>
          <Field label='Title'>
            <input style={inputStyle} value={draft.title ?? ''} onChange={e => patch('title', e.target.value)} />
          </Field>
          <Field label='Iteration Label'>
            <input
              style={inputStyle}
              value={draft.iterationLabel}
              onChange={e => patch('iterationLabel', e.target.value)}
              placeholder='Optional - e.g. Saudi VVIP, Refresh, Pre-Saudi'
            />
          </Field>
          <Field label='Sort Order'>
            <input
              style={inputStyle}
              type='number'
              value={draft.sortOrder}
              onChange={e => patch('sortOrder', parseInt(e.target.value, 10) || 0)}
            />
          </Field>
          <Field label='Audience'>
            <select style={inputStyle} value={draft.audience} onChange={e => patch('audience', e.target.value as any)}>
              <option value='private'>private</option>
              <option value='public'>public</option>
            </select>
          </Field>
          <Field label='Public Template? (read-only)'>
            <input
              style={{ ...inputStyle, opacity: 0.6 }}
              value={draft.isPublicTemplate ? 'Yes' : 'No'}
              disabled
            />
          </Field>
          <Field label='is_public (read-only)'>
            <input
              style={{ ...inputStyle, opacity: 0.6 }}
              value={String(draft.isPublic)}
              disabled
            />
          </Field>
        </div>

        <Field label='Engagement Type'>
          <select
            style={inputStyle}
            value={draft.engagementTypeId ?? ''}
            onChange={e => patch('engagementTypeId', e.target.value || null)}
          >
            <option value=''>- Not set -</option>
            {engagementTypes.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label='Journey Types'>
          <ChipInput values={draft.journeyTypes ?? []} onChange={v => patch('journeyTypes', v)} />
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
          <PersonTypeahead value={draft.personId} onChange={v => patch('personId', v)} />
        </Field>
        <Field label='Trip (canonical)'>
          <EngagementTypeahead value={draft.journeyId} onChange={v => patch('journeyId', v)} />
        </Field>
      </Section>

      {/* Guest Label - Step 11 Part B. The public guest name is resolved from
          this engagement's linked houses + selected label + override, projected
          across the privacy wall by resolve_and_project_guest_label. House must
          be linked BEFORE a label can be selected (the cross-house guard); the
          label select is scoped to linked houses' labels and disabled until a
          house is linked, so an invalid choice is structurally impossible. */}
      <Section title='Guest Label'>
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
          The public guest name. Link a house, then select one of its labels - or set an override. Absent authorship shows no name (blank-until-authored), never a raw identity.
        </div>

        <Field label='Linked Houses'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {houses.length === 0 && (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
                No houses linked yet. Link one to enable label selection.
              </div>
            )}
            {houses.map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 12px', borderRadius: 10,
                background: A.bgInput, border: `1px solid ${h.isPrimary ? A.borderGold : A.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: A.text, fontFamily: A.font }}>
                    {h.a_houses?.displayName ?? h.houseId}
                  </span>
                  {h.isPrimary && <span style={{ fontSize: 9, fontWeight: 700, color: A.gold, fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Primary</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {!h.isPrimary && (
                    <button
                      onClick={async () => { await setPrimaryHouse(h.id); await load() }}
                      style={{ ...btnGhost, fontSize: 10, padding: '3px 8px' }}
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    onClick={async () => { await unlinkHouse(h.id); await load() }}
                    style={{ ...btnDanger, fontSize: 10, padding: '3px 8px' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <HouseTypeahead onPick={async houseId => { await linkHouse(row.id, houseId); await load() }} />
          </div>
        </Field>

        <Field label='Selected Label'>
          <select
            style={{ ...inputStyle, opacity: houses.length === 0 ? 0.5 : 1 }}
            value={draft.publicLabelId ?? ''}
            disabled={houses.length === 0}
            onChange={async e => {
              const val = e.target.value || null
              patch('publicLabelId', val)
              try { await setLabel(row.id, val, draft.guestDisplayNameOverride); await load() }
              catch (err: any) { showToast(err.message ?? 'Failed to set label', 'error'); await load() }
            }}
          >
            <option value=''>- none (fall through to house default / override) -</option>
            {candidateLabels.map(l => (
              <option key={l.id} value={l.id}>
                {l.displayName} · {l.key}{l.isDefault ? ' (house default)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label='Name Override'>
          <input
            style={inputStyle}
            value={draft.guestDisplayNameOverride ?? ''}
            placeholder='e.g. AMF & KMF Families - overrides the label above when set'
            onChange={e => patch('guestDisplayNameOverride', e.target.value || null)}
            onBlur={async e => {
              const val = e.target.value.trim() || null
              try { await setLabel(row.id, draft.publicLabelId, val); await load() }
              catch (err: any) { showToast(err.message ?? 'Failed to set override', 'error'); await load() }
            }}
          />
        </Field>
      </Section>

      {/* Status */}
      <Section title='Status'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Engagement Status'>
            <select
              style={inputStyle}
              value={draft.engagementStatusId}
              onChange={e => patch('engagementStatusId', e.target.value)}
            >
              {engagementStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label='Itinerary Status'>
            <select
              style={inputStyle}
              value={draft.itineraryStatusId}
              onChange={e => patch('itineraryStatusId', e.target.value)}
            >
              {itineraryStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label='status_label (legacy free-text)'>
          <input style={inputStyle} value={draft.statusLabel ?? ''} onChange={e => patch('statusLabel', e.target.value || null)} />
        </Field>
        {/* Close Won - one-action revenue signal */}
        {(() => {
          const currentSlug = engagementStatuses.find(s => s.id === draft.engagementStatusId)?.slug
          const isClosedWon = currentSlug === 'closed_won'
          const closedWonId = engagementStatuses.find(s => s.slug === 'closed_won')?.id
          if (!closedWonId) return null
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
              {!isClosedWon ? (
                <button
                  onClick={() => patch('engagementStatusId', closedWonId)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 7,
                    background: '#4ade8015', color: '#4ade80',
                    border: '1px solid #4ade8040', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Mark Close Won
                </button>
              ) : (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 7,
                  background: '#4ade8020', color: '#4ade80',
                  border: '1px solid #4ade8040',
                }}>
                  ✓ Closed Won
                </span>
              )}
              <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'inherit' }}>
                {isClosedWon ? 'Revenue recognised. Save to persist any other changes.' : 'Sets engagement status to Closed Won. Save to apply.'}
              </span>
            </div>
          )
        })()}
      </Section>

      {/* Hero primary */}
      <Section title='Hero - Primary'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Eyebrow'>
            <input style={inputStyle} value={draft.eyebrow ?? ''} onChange={e => patch('eyebrow', e.target.value || null)} />
          </Field>
          <Field label='Hero Tagline'>
            <input style={inputStyle} value={draft.heroTagline ?? ''} onChange={e => patch('heroTagline', e.target.value || null)} />
          </Field>
          <Field label='Subtitle'>
            <input style={inputStyle} value={draft.subtitle ?? ''} onChange={e => patch('subtitle', e.target.value || null)} />
          </Field>
          <div />
        </div>

        <Field label='Hero Image Src'>
          <ImageFieldWithUploader
            value={draft.heroImageSrc}
            onChange={v => patch('heroImageSrc', v)}
          />
        </Field>
        <Field label='Hero Image Alt'>
          <input style={inputStyle} value={draft.heroImageAlt ?? ''} onChange={e => patch('heroImageAlt', e.target.value || null)} />
        </Field>

        <Field label='Hero Pills (jsonb)'>
          <JsonField value={draft.heroPills} onChange={v => patch('heroPills', v)} />
        </Field>
      </Section>

      {/* Hero secondary */}
      <Section title='Hero - Secondary'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Title 2'>
            <input style={inputStyle} value={draft.heroTitle2 ?? ''} onChange={e => patch('heroTitle2', e.target.value || null)} />
          </Field>
          <Field label='Subtitle 2'>
            <input style={inputStyle} value={draft.heroSubtitle2 ?? ''} onChange={e => patch('heroSubtitle2', e.target.value || null)} />
          </Field>
        </div>

        <Field label='Image Src 2'>
          <ImageFieldWithUploader
            value={draft.heroImageSrc2}
            onChange={v => patch('heroImageSrc2', v)}
          />
        </Field>
        <Field label='Image Alt 2'>
          <input style={inputStyle} value={draft.heroImageAlt2 ?? ''} onChange={e => patch('heroImageAlt2', e.target.value || null)} />
        </Field>
      </Section>

      {/* Route - engagement-level copy */}
      <Section title='Route Section'>
        <Field label='Route Eyebrow'>
          <input style={inputStyle} value={draft.routeEyebrow ?? ''} onChange={e => patch('routeEyebrow', e.target.value || null)} />
        </Field>
        <Field label='Route Heading'>
          <input style={inputStyle} value={draft.routeHeading ?? ''} onChange={e => patch('routeHeading', e.target.value || null)} />
        </Field>
        <Field label='Route Body'>
          <textarea style={textareaStyle} value={draft.routeBody ?? ''} onChange={e => patch('routeBody', e.target.value || null)} />
        </Field>
      </Section>

      {/* S33D: Route stops editor (drag-reorder + per-stop modal editor) */}
      {row.id && (
        <RouteStopsEditor engagementId={row.id} showToast={showToast} />
      )}

      {/* Destination Section copy (engagement-level intro to destinations) */}
      <Section title='Destination Section'>
        <Field label='Destination Heading'>
          <input style={inputStyle} value={draft.destinationHeading ?? ''} onChange={e => patch('destinationHeading', e.target.value || null)} />
        </Field>
        <Field label='Destination Subtitle'>
          <input style={inputStyle} value={draft.destinationSubtitle ?? ''} onChange={e => patch('destinationSubtitle', e.target.value || null)} />
        </Field>
        <Field label='Destination Body'>
          <textarea style={textareaStyle} value={draft.destinationBody ?? ''} onChange={e => patch('destinationBody', e.target.value || null)} />
        </Field>
      </Section>

      {/* S33C: Destination rows editor (drag-reorder + per-row modal editor) */}
      {row.id && (
        <DestinationRowsEditor engagementId={row.id} showToast={showToast} />
      )}

      {/* S334: Cards editor (selections-primary, override-on-demand, dining + experiences) */}
      {row.id && (
        <CardsEditor engagementId={row.id} showToast={showToast} />
      )}

      {row.id && (
        <RoomsEditor engagementId={row.id} />
      )}

      {/* Pricing */}
      <Section title='Pricing Section'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label='Heading'>
            <input style={inputStyle} value={draft.pricingHeading ?? ''} onChange={e => patch('pricingHeading', e.target.value || null)} />
          </Field>
          <Field label='Title'>
            <input style={inputStyle} value={draft.pricingTitle ?? ''} onChange={e => patch('pricingTitle', e.target.value || null)} />
          </Field>
          <Field label='Total Label'>
            <input style={inputStyle} value={draft.pricingTotalLabel ?? ''} onChange={e => patch('pricingTotalLabel', e.target.value || null)} />
          </Field>
          <Field label='Total Value'>
            <input style={inputStyle} value={draft.pricingTotalValue ?? ''} onChange={e => patch('pricingTotalValue', e.target.value || null)} />
          </Field>
          <Field label='Notes Heading'>
            <input style={inputStyle} value={draft.pricingNotesHeading ?? ''} onChange={e => patch('pricingNotesHeading', e.target.value || null)} />
          </Field>
          <Field label='Notes Title'>
            <input style={inputStyle} value={draft.pricingNotesTitle ?? ''} onChange={e => patch('pricingNotesTitle', e.target.value || null)} />
          </Field>
        </div>
        <Field label='Body'>
          <textarea style={textareaStyle} value={draft.pricingBody ?? ''} onChange={e => patch('pricingBody', e.target.value || null)} />
        </Field>
        <Field label='Notes (jsonb)'>
          <JsonField value={draft.pricingNotes} onChange={v => patch('pricingNotes', v)} />
        </Field>
      </Section>

      {/* Welcome overrides */}
      <Section title='Welcome Letter - Per-Engagement Overrides'>
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
          NULL = canonical singleton flows through. Empty string = hide field. Non-empty = override.
        </div>
        <WelcomeOverrideField
          label='Eyebrow'
          canonical={welcomeCanon?.eyebrow ?? null}
          value={draft.welcomeEyebrowOverride}
          onChange={v => patch('welcomeEyebrowOverride', v)}
        />
        <WelcomeOverrideField
          label='Title'
          canonical={welcomeCanon?.title ?? null}
          value={draft.welcomeTitleOverride}
          onChange={v => patch('welcomeTitleOverride', v)}
        />
        <WelcomeOverrideField
          label='Body'
          canonical={welcomeCanon?.body ?? null}
          value={draft.welcomeBodyOverride}
          onChange={v => patch('welcomeBodyOverride', v)}
        />
        <WelcomeOverrideField
          label='Signoff Body'
          canonical={welcomeCanon?.signoff_body ?? null}
          value={draft.welcomeSignoffBodyOverride}
          onChange={v => patch('welcomeSignoffBodyOverride', v)}
        />
        <WelcomeOverrideField
          label='Signoff Name'
          canonical={welcomeCanon?.signoff_name ?? null}
          value={draft.welcomeSignoffNameOverride}
          onChange={v => patch('welcomeSignoffNameOverride', v)}
        />
      </Section>

      {/* Child counts (without destination_rows, route_stops, card_selections, or card_overrides) */}
      {row.urlId && <ChildCountsSummary counts={counts} urlId={row.urlId} />}

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

      {/* Client Visibility - AXIS-2 proposal_visibility */}
      <Section title='Client Visibility'>
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          Controls what the client sees on this proposal's link. <strong style={{ color: A.text }}>Active</strong> shows
          the proposal. <strong style={{ color: A.text }}>Archived</strong> shows a graceful "This page is not publicly visible, please reach out to your travel designer for more information" notice instead, without breaking the link.
          This is separate from the engagement's status: an archived proposal is not cancelled, just no longer shown.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleToggleProposalVisibility}
            disabled={visSaving}
            style={{
              width: 38, height: 20, borderRadius: 999,
              border: `1px solid ${draft.proposalVisibility === 'archived' ? A.gold : A.border}`,
              background: draft.proposalVisibility === 'archived' ? A.gold : 'transparent',
              cursor: visSaving ? 'wait' : 'pointer',
              position: 'relative', flexShrink: 0, transition: 'all 150ms ease', padding: 0,
            }}
          >
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: draft.proposalVisibility === 'archived' ? '#0F1110' : A.faint,
              position: 'absolute', top: 2,
              left: draft.proposalVisibility === 'archived' ? 20 : 2,
              transition: 'left 150ms ease',
            }} />
          </button>
          <div style={{ fontSize: 12, color: draft.proposalVisibility === 'archived' ? A.gold : A.muted, fontFamily: A.font, fontWeight: 600 }}>
            {draft.proposalVisibility === 'archived'
              ? 'Archived: client sees the "ask your travel designer" notice'
              : 'Active: client sees the full proposal'}
          </div>
        </div>
      </Section>

      {/* Archive - reversible, calm */}
      <Section title='Archive'>
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          Archiving sets this engagement to Cancelled and its itinerary to Archived.
          Nothing is deleted - all content is preserved and it can be reactivated
          later by changing its status.
        </div>
        <button onClick={handleArchive} disabled={archiving} style={{ ...btnGhost, opacity: archiving ? 0.5 : 1 }}>
          {archiving ? 'Archiving…' : 'Archive Engagement'}
        </button>
      </Section>

      {/* Danger Zone - irreversible delete */}
      <Section title='Danger Zone'>
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
          Deletion permanently removes this engagement and cascades through its
          content tables. There is no undo. Engagements with bookings, time
          entries, or requests cannot be deleted - archive them instead.
          You will be asked to confirm in several steps before anything is deleted.
        </div>
        <button onClick={() => setDeleteOpen(true)} style={btnDanger}>Delete Engagement</button>
      </Section>

      {/* S334: 4-step delete confirmation modal */}
      {deleteOpen && row && (
        <DeleteEngagementModal
          title={row.title ?? row.urlId ?? '(untitled)'}
          urlId={row.urlId ?? ''}
          onClose={handleDeleteClose}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}