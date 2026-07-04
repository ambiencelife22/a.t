/* ProgrammeAdmin.tsx
 * Admin interface for the ambience.travel programme product.
 * Gated by profiles.is_admin — same column as ambience.SPORTS.
 * Four tabs: Programmes, Welcome Letters, Listings, Property Sections.
 * Dark theme throughout — matches ProgrammeLayout shell.
 *
 * Last updated: S53G — EF compliance pass. All 29 direct supabase.from()
 *   calls across 5 tables migrated to queriesAdminProgramme (EF-backed).
 *   supabase import removed. global_profiles.is_admin check retained as-is
 *   (pre-admin-scopes migration).
 * Prior: S33 — Six tab function declarations gained the `export` keyword.
 * Prior: S23 — Full surgical rename pass to travel_programme_* table convention.
 */

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../utils/utilsAuth'

import type { ListingCategory } from '../../types/typesProgramme'
import { formatDate } from '../../utils/utilsDates'
import ClientProfilePage from './ClientProfilePage'
import ProgrammeAccessDenied from '../programme/ProgrammeAccessDenied'
import GuestLinker from './GuestLinker'
import {
  fetchProgrammes,
  fetchProgrammePropertyStubs,
  fetchProgrammeProperties,
  fetchListings,
  fetchPropertySections,
  fetchPropertySectionsMeta,
  fetchProgrammeSections,
  createProgramme,
  updateProgramme,
  deleteProgramme,
  toggleProgrammeField,
  updateWelcomeLetter,
  updateProperty,
  deleteProperty,
  togglePropertyActive,
  createListing,
  updateListing,
  deleteListing,
  upsertProgrammeSection,
  deleteProgrammeSection,
  updateSectionContent,
  reorderPropertySections,
  updateSectionMeta,
  type ProgrammeRow,
  type PropertyRow,
  type ListingRow,
  type PropertySectionRow,
  type TogglableField,
} from '../../queries/queriesAdminProgramme'

// ── Design tokens ─────────────────────────────────────────────────────────────

const A = {
  bg:         '#111210',
  bgCard:     '#1A1C1A',
  bgInput:    '#202220',
  border:     '#2E302E',
  borderGold: 'rgba(201,184,142,0.25)',
  text:       '#F3F4F3',
  muted:      '#9A9E9A',
  faint:      '#5A5E5A',
  gold:       '#C9B88E',
  danger:     '#ef4444',
  positive:   '#4ade80',
  font:       "'Plus Jakarta Sans', sans-serif",
}

// ── Guest-facing URL resolution ───────────────────────────────────────────────

const PROGRAMME_HOST = 'programme.ambience.travel'

function buildGuestUrl(subPath: string, urlId: string): string {
  if (typeof window === 'undefined') {
    return `https://${PROGRAMME_HOST}/${subPath}/${urlId}`
  }
  const host = window.location.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') {
    return `${window.location.origin}/programme/${subPath}/${urlId}`
  }
  if (host === PROGRAMME_HOST) {
    return `${window.location.origin}/${subPath}/${urlId}`
  }
  return `https://${PROGRAMME_HOST}/${subPath}/${urlId}`
}

// ── Shared input styles ───────────────────────────────────────────────────────

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
  minHeight:  120,
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
  padding:       '8px 18px',
  background:    `rgba(201,184,142,0.12)`,
  color:         A.gold,
  border:        `1px solid rgba(201,184,142,0.30)`,
  borderRadius:  10,
  fontSize:      12,
  fontWeight:    700,
  fontFamily:    A.font,
  cursor:        'pointer',
  letterSpacing: '0.04em',
}

const btnGhost: React.CSSProperties = {
  padding:      '9px 20px',
  background:   'transparent',
  color:        A.muted,
  border:       `1px solid ${A.border}`,
  borderRadius: 10,
  fontSize:     12,
  fontWeight:   600,
  fontFamily:   A.font,
  cursor:       'pointer',
}

const btnDanger: React.CSSProperties = {
  padding:      '7px 14px',
  background:   'transparent',
  color:        A.danger,
  border:       `1px solid rgba(239,68,68,0.3)`,
  borderRadius: 8,
  fontSize:     11,
  fontWeight:   600,
  fontFamily:   A.font,
  cursor:       'pointer',
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Admin
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          {title}
        </div>
      </div>
      {action}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = status === 'confirmed' ? A.positive
    : status === 'draft'     ? A.muted
    : A.danger

  return (
    <span style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      padding:       '3px 10px',
      borderRadius:  100,
      border:        `1px solid ${color}50`,
      color,
      background:    `${color}12`,
      fontFamily:    A.font,
    }}>
      {status}
    </span>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

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

// ── Local type aliases ────────────────────────────────────────────────────────
// Thin aliases so the JSX below stays identical to the original.

type Programme  = ProgrammeRow
type Property   = { id: string; name: string; slug: string }
type Listing    = ListingRow
type Section    = PropertySectionRow & { content: ContentBlock[] }

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading';   text: string }
  | { type: 'note';      text: string }
  | { type: 'warning';   text: string }
  | { type: 'list';      items: string[] }
  | { type: 'wifi';      network: string; password: string }

// ── Tab: Programmes ───────────────────────────────────────────────────────────

export function ProgrammesTab() {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Programme | null>(null)
  const { toast, showToast }        = useToast()

  const emptyForm = {
    url_id:               '',
    programme_type:       'stay',
    sub_path:             'stays',
    status:               'confirmed',
    guest_names:          '',
    guest_count:          1,
    check_in:             '',
    check_out:            '',
    welcome_letter:       '',
    property_id:          '',
    alarm_code_provided:  false,
  }

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [progs, props] = await Promise.all([
        fetchProgrammes(),
        fetchProgrammePropertyStubs(),
      ])
      setProgrammes(progs)
      setProperties(props)
    } catch (e) {
      showToast(`Failed to load: ${errMsg(e)}`, 'error')
    }
    setLoading(false)
  }

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(prog: Programme) {
    setForm({
      url_id:               prog.url_id,
      programme_type:       prog.programme_type,
      sub_path:             prog.sub_path,
      status:               prog.status,
      guest_names:          prog.guest_names,
      guest_count:          prog.guest_count,
      check_in:             prog.check_in ?? '',
      check_out:            prog.check_out ?? '',
      welcome_letter:       prog.welcome_letter,
      property_id:          prog.property_id ?? '',
      alarm_code_provided:  prog.alarm_code_provided,
    })
    setEditing(prog)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    if (!form.url_id.trim() || !form.guest_names.trim()) {
      showToast('URL ID and guest names are required.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      url_id:              form.url_id.trim(),
      programme_type:      form.programme_type,
      sub_path:            form.sub_path,
      status:              form.status,
      guest_names:         form.guest_names.trim(),
      guest_count:         form.guest_count,
      check_in:            form.check_in || null,
      check_out:           form.check_out || null,
      welcome_letter:      form.welcome_letter.trim(),
      property_id:         form.property_id || null,
      alarm_code_provided: form.alarm_code_provided,
    }
    try {
      if (editing) {
        await updateProgramme(editing.id, payload)
        showToast('Programme updated.', 'success')
      }
      if (!editing) {
        await createProgramme(payload)
        showToast('Programme created.', 'success')
      }
      cancelForm()
      load()
    } catch (e) {
      const msg = errMsg(e)
      showToast(msg.includes('unique') ? 'URL ID already exists.' : `Failed to save: ${msg}`, 'error')
    }
    setSaving(false)
  }

  async function handleToggleActive(prog: Programme) {
    try {
      await toggleProgrammeField(prog.id, 'active', !prog.active)
      showToast(prog.active ? 'Programme deactivated.' : 'Programme activated.', 'success')
      load()
    } catch (e) { showToast(`Failed: ${errMsg(e)}`, 'error') }
  }

  async function handleTogglePublic(prog: Programme) {
    try {
      await toggleProgrammeField(prog.id, 'is_public', !prog.is_public)
      showToast(prog.is_public ? 'Programme set to private.' : 'Programme is now public.', 'success')
      load()
    } catch (e) { showToast(`Failed: ${errMsg(e)}`, 'error') }
  }

  async function handleToggleField(prog: Programme, field: TogglableField) {
    try {
      await toggleProgrammeField(prog.id, field, !prog[field])
      load()
    } catch (e) { showToast(`Failed to update visibility: ${errMsg(e)}`, 'error') }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this programme? This cannot be undone.')) return
    try {
      await deleteProgramme(id)
      showToast('Programme deleted.', 'success')
      load()
    } catch (e) { showToast(`Failed to delete: ${errMsg(e)}`, 'error') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <SectionHeader
        title='Programmes'
        action={<button onClick={openCreate} style={btnPrimary}>+ New Programme</button>}
      />

      {showForm && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 20 }}>
            {editing ? 'Edit Programme' : 'New Programme'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label='URL ID'>
              <input style={inputStyle} value={form.url_id} onChange={e => setForm(f => ({ ...f, url_id: e.target.value }))} placeholder='e.g. k5SSks4AUedpBJLO' disabled={!!editing} />
            </Field>
            <Field label='Property'>
              <select style={inputStyle} value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                <option value=''>— No property —</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label='Guest Names'>
              <input style={inputStyle} value={form.guest_names} onChange={e => setForm(f => ({ ...f, guest_names: e.target.value }))} placeholder='e.g. Ragnar & Gunnar' />
            </Field>
            <Field label='Guest Count'>
              <input style={inputStyle} type='number' min={1} value={form.guest_count} onChange={e => setForm(f => ({ ...f, guest_count: parseInt(e.target.value) || 1 }))} />
            </Field>
            <Field label='Check-in'>
              <input style={inputStyle} type='date' value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} />
            </Field>
            <Field label='Check-out'>
              <input style={inputStyle} type='date' value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} />
            </Field>
            <Field label='Type'>
              <select style={inputStyle} value={form.programme_type} onChange={e => setForm(f => ({ ...f, programme_type: e.target.value, sub_path: e.target.value === 'stay' ? 'stays' : e.target.value }))}>
                <option value='stay'>Stay</option>
                <option value='concierge'>Concierge</option>
              </select>
            </Field>
            <Field label='Status'>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value='confirmed'>Confirmed</option>
                <option value='draft'>Draft</option>
                <option value='cancelled'>Cancelled</option>
              </select>
            </Field>
          </div>
          {form.programme_type === 'stay' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '14px 16px', borderRadius: 12, border: `1px solid ${A.border}`, background: 'rgba(255,255,255,0.03)' }}>
              <input type='checkbox' id='alarm_code' checked={form.alarm_code_provided} onChange={e => setForm(f => ({ ...f, alarm_code_provided: e.target.checked }))} style={{ accentColor: A.gold, width: 16, height: 16, flexShrink: 0 }} />
              <div>
                <label htmlFor='alarm_code' style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font, cursor: 'pointer', display: 'block', marginBottom: 2 }}>Alarm code provided to guests</label>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Unchecked shows alternate no-code alarm instructions in the house guide</div>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <Field label='Welcome Letter'>
              <textarea style={{ ...textareaStyle, minHeight: 160 }} value={form.welcome_letter} onChange={e => setForm(f => ({ ...f, welcome_letter: e.target.value }))} placeholder='Write the welcome letter here…' />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Programme'}</button>
            <button onClick={cancelForm} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>Loading…</div>}
      {!loading && programmes.length === 0 && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>No programmes yet.</div>}

      {!loading && programmes.map(prog => (
        <div key={prog.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 14, padding: '18px 20px', opacity: prog.active ? 1 : 0.5 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <StatusBadge status={prog.status} />
              {!prog.active && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 100, border: `1px solid ${A.danger}50`, color: A.danger, background: `${A.danger}12`, fontFamily: A.font }}>Inactive</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 6 }}>{prog.guest_names}</div>
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>{prog.properties?.name ?? '—'}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: "'DM Mono', monospace", marginBottom: 3, wordBreak: 'break-all' }}>/{prog.sub_path}/{prog.url_id}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{prog.check_in ? formatDate(prog.check_in) : 'TBA'} → {prog.check_out ? formatDate(prog.check_out) : 'TBA'}</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <a href={buildGuestUrl(prog.sub_path, prog.url_id)} target='_blank' rel='noopener noreferrer' style={{ ...btnGhost, fontSize: 12, padding: '7px 16px', color: A.gold, borderColor: A.borderGold, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>View ↗</a>
            <button onClick={() => openEdit(prog)} style={{ ...btnGhost, fontSize: 12, padding: '7px 16px' }}>Edit</button>
            <button onClick={() => handleTogglePublic(prog)} style={{ ...btnGhost, fontSize: 12, padding: '7px 16px', color: prog.is_public ? A.positive : A.muted, borderColor: prog.is_public ? `${A.positive}50` : A.border }}>{prog.is_public ? 'Make Private' : 'Make Public'}</button>
            <button onClick={() => handleToggleActive(prog)} style={{ ...btnGhost, fontSize: 12, padding: '7px 16px', color: prog.active ? A.danger : A.positive, borderColor: prog.active ? `${A.danger}50` : `${A.positive}50` }}>{prog.active ? 'Deactivate' : 'Activate'}</button>
            <button onClick={() => handleDelete(prog.id)} style={{ ...btnDanger, fontSize: 12, padding: '7px 14px' }}>Delete</button>
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button onClick={() => handleToggleField(prog, 'no_alarm')} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px', color: prog.no_alarm ? A.positive : A.faint, borderColor: prog.no_alarm ? `${A.positive}50` : A.border }}>{prog.no_alarm ? '✓' : '—'} No alarm stay</button>
            </div>
          </div>

          <div style={{ marginTop: 4, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Public visibility</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { field: 'public_arrival'       as const, label: 'Arrival' },
                { field: 'public_wifi'          as const, label: 'WiFi' },
                { field: 'public_alarm'         as const, label: 'Alarm code' },
                { field: 'public_owner_phone'   as const, label: 'Host phone' },
                { field: 'public_manager_phone' as const, label: 'Manager phone' },
              ] as const).map(({ field, label }) => (
                <button key={field} onClick={() => handleToggleField(prog, field)} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px', color: prog[field] ? A.positive : A.faint, borderColor: prog[field] ? `${A.positive}50` : A.border }}>
                  {prog[field] ? '✓' : '—'} {label}
                </button>
              ))}
            </div>
          </div>

          <GuestLinker programmeId={prog.id} />
          <ProgrammeSectionOverrides programmeId={prog.id} propertyId={prog.property_id ?? ''} />
        </div>
      ))}
    </div>
  )
}

// ── Programme Section Overrides ───────────────────────────────────────────────

type SectionOption = { id: string; title: string; icon: string }
type OverrideRow   = { id: string; section_id: string; content: ContentBlock[] }

function ProgrammeSectionOverrides({ programmeId, propertyId }: { programmeId: string; propertyId: string }) {
  const [open, setOpen]               = useState(false)
  const [sections, setSections]       = useState<SectionOption[]>([])
  const [overrides, setOverrides]     = useState<OverrideRow[]>([])
  const [editing, setEditing]         = useState<OverrideRow | null>(null)
  const [editContent, setEditContent] = useState<ContentBlock[]>([])
  const [saving, setSaving]           = useState(false)
  const { toast, showToast }          = useToast()

  async function load() {
    try {
      const [secs, ovs] = await Promise.all([
        fetchPropertySectionsMeta(propertyId),
        fetchProgrammeSections(programmeId),
      ])
      setSections(secs)
      setOverrides(ovs as OverrideRow[])
    } catch (e) { showToast(`Failed to load: ${errMsg(e)}`, 'error') }
  }

  function handleOpen() {
    if (!open) load()
    setOpen(o => !o)
  }

  function startEdit(section: SectionOption) {
    const existing = overrides.find(o => o.section_id === section.id)
    if (existing) {
      setEditing(existing)
      setEditContent(JSON.parse(JSON.stringify(existing.content)))
      return
    }
    setEditing({ id: '', section_id: section.id, content: [] })
    setEditContent([])
  }

  function cancelEdit() { setEditing(null); setEditContent([]) }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const existing = overrides.find(o => o.section_id === editing.section_id)
      await upsertProgrammeSection(existing?.id ?? null, programmeId, editing.section_id, editContent)
      showToast('Section override saved.', 'success')
      cancelEdit()
      load()
    } catch (e) { showToast(`Failed to save override: ${errMsg(e)}`, 'error') }
    setSaving(false)
  }

  async function handleDelete(sectionId: string) {
    const existing = overrides.find(o => o.section_id === sectionId)
    if (!existing) return
    try {
      await deleteProgrammeSection(existing.id)
      showToast('Override removed — using property default.', 'success')
      load()
    } catch (e) { showToast(`Failed to remove override: ${errMsg(e)}`, 'error') }
  }

  function updateBlock(idx: number, updated: ContentBlock) { setEditContent(prev => prev.map((b, i) => i === idx ? updated : b)) }
  function deleteBlock(idx: number) { setEditContent(prev => prev.filter((_, i) => i !== idx)) }
  function moveBlock(idx: number, dir: 'up' | 'down') {
    setEditContent(prev => { const next = [...prev]; const swap = dir === 'up' ? idx - 1 : idx + 1; [next[idx], next[swap]] = [next[swap], next[idx]]; return next })
  }
  function addBlock(type: ContentBlock['type']) {
    const blank: ContentBlock = type === 'list' ? { type: 'list', items: [''] } : type === 'wifi' ? { type: 'wifi', network: '', password: '' } : { type, text: '' } as ContentBlock
    setEditContent(prev => [...prev, blank])
  }

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <button onClick={handleOpen} style={{ ...btnGhost, fontSize: 11, padding: '5px 14px', color: A.muted }}>{open ? '▲' : '▼'} Guest-specific section overrides</button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map(section => {
            const hasOverride = overrides.some(o => o.section_id === section.id)
            return (
              <div key={section.id} style={{ background: A.bg, border: `1px solid ${hasOverride ? A.borderGold : A.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{section.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: A.text, fontFamily: A.font }}>{section.title}</span>
                {hasOverride && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>Override active</span>}
                <button onClick={() => startEdit(section)} style={{ ...btnGhost, fontSize: 11, padding: '4px 12px' }}>{hasOverride ? 'Edit' : '+ Override'}</button>
                {hasOverride && <button onClick={() => handleDelete(section.id)} style={{ ...btnDanger, fontSize: 11, padding: '4px 10px' }}>Remove</button>}
              </div>
            )
          })}

          {editing && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
              <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Guest Override</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>{sections.find(s => s.id === editing.section_id)?.icon} {sections.find(s => s.id === editing.section_id)?.title}</div>
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>This content replaces the property default for this guest only.</div>
                  </div>
                  <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {editContent.map((block, idx) => (
                    <div key={idx} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, flex: 1 }}>{block.type}</span>
                        <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? A.faint : A.muted, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 13, padding: '2px 6px' }}>↑</button>
                        <button onClick={() => moveBlock(idx, 'down')} disabled={idx === editContent.length - 1} style={{ background: 'none', border: 'none', color: idx === editContent.length - 1 ? A.faint : A.muted, cursor: idx === editContent.length - 1 ? 'default' : 'pointer', fontSize: 13, padding: '2px 6px' }}>↓</button>
                        <button onClick={() => deleteBlock(idx)} style={{ background: 'none', border: 'none', color: A.danger, cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>✕</button>
                      </div>
                      {(block.type === 'paragraph' || block.type === 'heading' || block.type === 'note' || block.type === 'warning') && (
                        <textarea style={{ ...textareaStyle, minHeight: block.type === 'heading' ? 44 : 80, fontSize: 13 }} value={block.text} onChange={e => updateBlock(idx, { ...block, text: e.target.value })} />
                      )}
                      {block.type === 'list' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {block.items.map((item, ii) => (
                            <div key={ii} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input style={{ ...inputStyle, flex: 1, fontSize: 13 }} value={item} onChange={e => { const items = [...block.items]; items[ii] = e.target.value; updateBlock(idx, { ...block, items }) }} />
                              <button onClick={() => { const items = block.items.filter((_, i) => i !== ii); updateBlock(idx, { ...block, items }) }} style={{ background: 'none', border: 'none', color: A.danger, cursor: 'pointer', fontSize: 16 }}>✕</button>
                            </div>
                          ))}
                          <button onClick={() => updateBlock(idx, { ...block, items: [...block.items, ''] })} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px', alignSelf: 'flex-start' }}>+ Add item</button>
                        </div>
                      )}
                      {block.type === 'wifi' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input style={{ ...inputStyle, fontSize: 13 }} value={block.network} onChange={e => updateBlock(idx, { ...block, network: e.target.value })} placeholder='Network name' />
                          <input style={{ ...inputStyle, fontSize: 13 }} value={block.password} onChange={e => updateBlock(idx, { ...block, password: e.target.value })} placeholder='Password' />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Add block</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['paragraph', 'heading', 'note', 'warning', 'list', 'wifi'] as ContentBlock['type'][]).map(type => (
                      <button key={type} onClick={() => addBlock(type)} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px' }}>+ {type}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${A.border}` }}>
                  <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save Override'}</button>
                  <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Welcome Letters ──────────────────────────────────────────────────────

export function WelcomeLettersTab() {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [selected, setSelected]     = useState<Programme | null>(null)
  const [letter, setLetter]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const { toast, showToast }        = useToast()

  useEffect(() => {
    fetchProgrammes()
      .then(rows => { setProgrammes(rows); setLoading(false) })
      .catch(e => { showToast(`Failed to load programmes: ${errMsg(e)}`, 'error'); setLoading(false) })
  }, [])

  function selectProgramme(prog: Programme) { setSelected(prog); setLetter(prog.welcome_letter) }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await updateWelcomeLetter(selected.id, letter)
      setProgrammes(prev => prev.map(p => p.id === selected.id ? { ...p, welcome_letter: letter } : p))
      setSelected(prev => prev ? { ...prev, welcome_letter: letter } : null)
      showToast('Welcome letter saved.', 'success')
    } catch (e) { showToast(`Failed to save: ${errMsg(e)}`, 'error') }
    setSaving(false)
  }

  const paragraphs = letter.split('\n\n').filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <SectionHeader title='Welcome Letters' />
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {programmes.map(prog => (
              <button key={prog.id} onClick={() => selectProgramme(prog)} style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: `1px solid ${selected?.id === prog.id ? A.borderGold : A.border}`, background: selected?.id === prog.id ? 'rgba(201,184,142,0.06)' : A.bgCard, cursor: 'pointer', fontFamily: A.font }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: A.text, marginBottom: 3 }}>{prog.guest_names}</div>
                <div style={{ fontSize: 11, color: A.faint }}>{prog.properties?.name ?? '—'}</div>
              </button>
            ))}
          </div>
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>Editor</div>
                  <textarea style={{ ...textareaStyle, minHeight: 400 }} value={letter} onChange={e => setLetter(e.target.value)} placeholder='Write the welcome letter here. Separate paragraphs with a blank line.' />
                  <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1, alignSelf: 'flex-start' }}>{saving ? 'Saving…' : 'Save Letter'}</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>Preview</div>
                  <div style={{ background: '#F7F4EE', borderRadius: 12, padding: '24px 28px', minHeight: 400 }}>
                    <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7A8476', marginBottom: 20, fontFamily: A.font }}>Welcome</p>
                    {paragraphs.map((p, i) => (
                      <p key={i} style={{ fontSize: i === 0 ? 18 : 15, lineHeight: 1.85, color: i === 0 ? '#171917' : '#4F564F', fontWeight: i === 0 ? 600 : 400, marginBottom: i === paragraphs.length - 1 ? 0 : 16, fontFamily: A.font }}>{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '40px 0' }}>Select a programme to edit its welcome letter.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Listings ─────────────────────────────────────────────────────────────

const LISTING_CATEGORIES: ListingCategory[] = ['lunch', 'dinner', 'takeaway', 'experience', 'shopping']

export function ListingsTab() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<string>('')
  const [listings, setListings]     = useState<Listing[]>([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Listing | null>(null)
  const [saving, setSaving]         = useState(false)
  const [filterCat, setFilterCat]   = useState<string>('all')
  const { toast, showToast }        = useToast()

  const emptyForm = { name: '', category: 'lunch' as ListingCategory, genre: '', address: '', website: '', hours: '', note: '', favourite: false }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchProgrammePropertyStubs()
      .then(props => { setProperties(props); if (props.length > 0) setSelectedProp(props[0].id) })
      .catch(e => showToast(`Failed to load properties: ${errMsg(e)}`, 'error'))
  }, [])

  useEffect(() => { if (!selectedProp) return; loadListings() }, [selectedProp])

  async function loadListings() {
    setLoading(true)
    try { setListings(await fetchListings(selectedProp)) } catch (e) { showToast(`Failed to load listings: ${errMsg(e)}`, 'error') }
    setLoading(false)
  }

  function openCreate() { setForm(emptyForm); setEditing(null); setShowForm(true) }
  function openEdit(l: Listing) { setForm({ name: l.name, category: l.category as ListingCategory, genre: l.genre ?? '', address: l.address, website: l.website ?? '', hours: l.hours ?? '', note: l.note ?? '', favourite: l.favourite }); setEditing(l); setShowForm(true) }
  function cancelForm() { setShowForm(false); setEditing(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) { showToast('Name and address are required.', 'error'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), category: form.category, genre: form.genre.trim() || null, address: form.address.trim(), website: form.website.trim() || null, hours: form.hours.trim() || null, note: form.note.trim() || null, favourite: form.favourite, property_id: selectedProp }
    try {
      if (editing) { await updateListing(editing.id, payload); showToast('Listing updated.', 'success'); cancelForm(); loadListings(); setSaving(false); return }
      await createListing(payload); showToast('Listing created.', 'success')
      cancelForm(); loadListings()
    } catch (e) { showToast(`Failed to save: ${errMsg(e)}`, 'error') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this listing?')) return
    try { await deleteListing(id); showToast('Listing deleted.', 'success'); loadListings() } catch (e) { showToast(`Failed to delete: ${errMsg(e)}`, 'error') }
  }

  const filtered = filterCat === 'all' ? listings : listings.filter(l => l.category === filterCat)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <SectionHeader title='Listings' action={<button onClick={openCreate} style={btnPrimary}>+ New Listing</button>} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Property</label>
        <select style={{ ...inputStyle, width: 'auto' }} value={selectedProp} onChange={e => setSelectedProp(e.target.value)}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {showForm && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 20 }}>{editing ? 'Edit Listing' : 'New Listing'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label='Name'><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder='Restaurant or venue name' /></Field>
            <Field label='Category'><select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ListingCategory }))}>{LISTING_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select></Field>
            <Field label='Genre'><input style={inputStyle} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder='e.g. Italian, Paella, Market' /></Field>
            <Field label='Hours'><input style={inputStyle} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder='e.g. Mon-Sat 9:00-21:30' /></Field>
            <Field label='Address'><input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder='Full address' /></Field>
            <Field label='Website'><input style={inputStyle} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder='https://…' /></Field>
          </div>
          <div style={{ marginBottom: 16 }}><Field label='Note'><textarea style={textareaStyle} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder='Optional note for guests…' /></Field></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <input type='checkbox' id='favourite' checked={form.favourite} onChange={e => setForm(f => ({ ...f, favourite: e.target.checked }))} style={{ accentColor: A.gold, width: 16, height: 16 }} />
            <label htmlFor='favourite' style={{ fontSize: 13, color: A.text, fontFamily: A.font, cursor: 'pointer' }}>Mark as favourite</label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Listing'}</button>
            <button onClick={cancelForm} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', ...LISTING_CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '6px 16px', borderRadius: 100, border: `1px solid ${filterCat === cat ? A.gold : A.border}`, background: filterCat === cat ? 'rgba(201,184,142,0.1)' : 'transparent', color: filterCat === cat ? A.gold : A.muted, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer' }}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}
      {!loading && filtered.length === 0 && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>No listings in this category.</div>}
      {!loading && filtered.map(listing => (
        <div key={listing.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: A.text, fontFamily: A.font }}>{listing.name}</span>
              {listing.favourite && <span style={{ fontSize: 9, color: A.gold, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${A.borderGold}`, borderRadius: 100, padding: '2px 8px', fontFamily: A.font }}>Fav</span>}
              <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font, textTransform: 'capitalize' }}>{listing.category}</span>
            </div>
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{listing.address}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => openEdit(listing)} style={btnGhost}>Edit</button>
            <button onClick={() => handleDelete(listing.id)} style={btnDanger}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Property Sections ────────────────────────────────────────────────────

export function PropertySectionsTab() {
  const [properties, setProperties]         = useState<Property[]>([])
  const [selectedProp, setSelectedProp]     = useState<string>('')
  const [sections, setSections]             = useState<Section[]>([])
  const [loading, setLoading]               = useState(false)
  const [editing, setEditing]               = useState<Section | null>(null)
  const [editTitle, setEditTitle]           = useState('')
  const [editIcon, setEditIcon]             = useState('')
  const [editContent, setEditContent]       = useState<ContentBlock[]>([])
  const [editingContent, setEditingContent] = useState<Section | null>(null)
  const [editingVariant, setEditingVariant] = useState<string>('default')
  const [saving, setSaving]                 = useState(false)
  const { toast, showToast }                = useToast()

  useEffect(() => {
    fetchProgrammePropertyStubs()
      .then(props => { setProperties(props); if (props.length > 0) setSelectedProp(props[0].id) })
      .catch(e => showToast(`Failed to load properties: ${errMsg(e)}`, 'error'))
  }, [])

  useEffect(() => { if (!selectedProp) return; loadSections() }, [selectedProp])

  async function loadSections() {
    setLoading(true)
    try { setSections((await fetchPropertySections(selectedProp)) as Section[]) } catch (e) { showToast(`Failed to load sections: ${errMsg(e)}`, 'error') }
    setLoading(false)
  }

  function openEdit(section: Section) { setEditing(section); setEditTitle(section.title); setEditIcon(section.icon) }
  function cancelEdit() { setEditing(null); setEditTitle(''); setEditIcon('') }

  function openContentEdit(section: Section) {
    const defaultRow = sections.find(s => s.title === section.title && s.variant === 'default')
    const target = defaultRow ?? section
    setEditingContent(target)
    setEditingVariant(target.variant)
    setEditContent(JSON.parse(JSON.stringify(target.content)))
  }

  function cancelContentEdit() { setEditingContent(null); setEditContent([]); setEditingVariant('default') }

  function switchVariant(variant: string) {
    if (!editingContent) return
    const target = sections.find(s => s.title === editingContent.title && s.variant === variant)
    if (!target) return
    setEditingContent(target); setEditingVariant(variant); setEditContent(JSON.parse(JSON.stringify(target.content)))
  }

  async function handleSaveContent() {
    if (!editingContent) return
    setSaving(true)
    try { await updateSectionContent(editingContent.id, editContent); showToast('Section content saved.', 'success'); cancelContentEdit(); loadSections() } catch (e) { showToast(`Failed to save content: ${errMsg(e)}`, 'error') }
    setSaving(false)
  }

  function updateBlock(idx: number, updated: ContentBlock) { setEditContent(prev => prev.map((b, i) => i === idx ? updated : b)) }
  function deleteBlock(idx: number) { setEditContent(prev => prev.filter((_, i) => i !== idx)) }
  function moveBlock(idx: number, dir: 'up' | 'down') {
    setEditContent(prev => { const next = [...prev]; const swap = dir === 'up' ? idx - 1 : idx + 1; [next[idx], next[swap]] = [next[swap], next[idx]]; return next })
  }
  function addBlock(type: ContentBlock['type']) {
    const blank: ContentBlock = type === 'list' ? { type: 'list', items: [''] } : type === 'wifi' ? { type: 'wifi', network: '', password: '' } : { type, text: '' } as ContentBlock
    setEditContent(prev => [...prev, blank])
  }

  async function handleSaveSection() {
    if (!editing || !editTitle.trim()) { showToast('Title is required.', 'error'); return }
    setSaving(true)
    try { await updateSectionMeta(editing.id, editTitle.trim(), editIcon.trim()); showToast('Section updated.', 'success'); cancelEdit(); loadSections() } catch (e) { showToast(`Failed to save: ${errMsg(e)}`, 'error') }
    setSaving(false)
  }

  async function moveSection(section: Section, direction: 'up' | 'down') {
    const idx = sections.findIndex(s => s.id === section.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sections.length - 1) return
    const swap = sections[direction === 'up' ? idx - 1 : idx + 1]
    try { await reorderPropertySections(section.id, section.sort_order, swap.id, swap.sort_order); loadSections() } catch (e) { showToast(`Failed to reorder: ${errMsg(e)}`, 'error') }
  }

  const groupedSections = sections.reduce<Section[]>((acc, section) => {
    const exists = acc.some(s => s.title === section.title && s.sort_order === section.sort_order)
    if (!exists) acc.push(section)
    return acc
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <SectionHeader title='Property Sections' />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Property</label>
        <select style={{ ...inputStyle, width: 'auto' }} value={selectedProp} onChange={e => setSelectedProp(e.target.value)}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}
      {!loading && groupedSections.map((section, idx) => (
        <div key={section.id}>
          {editing?.id === section.id ? (
            <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, marginBottom: 16 }}>
                <Field label='Icon'><input style={inputStyle} value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder='🔑' /></Field>
                <Field label='Title'><input style={inputStyle} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder='Section title' /></Field>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSaveSection} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={() => moveSection(section, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? A.faint : A.muted, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: A.font }}>↑</button>
                <button onClick={() => moveSection(section, 'down')} disabled={idx === groupedSections.length - 1} style={{ background: 'none', border: 'none', color: idx === groupedSections.length - 1 ? A.faint : A.muted, cursor: idx === groupedSections.length - 1 ? 'default' : 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: A.font }}>↓</button>
              </div>
              <span style={{ fontSize: 18 }}>{section.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: A.text, fontFamily: A.font }}>{section.title}</div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Sort order: {section.sort_order}</div>
              </div>
              <button onClick={() => openEdit(section)} style={btnGhost}>Edit</button>
              <button onClick={() => openContentEdit(section)} style={{ ...btnGhost, color: A.gold, borderColor: `${A.gold}40` }}>Edit Content</button>
            </div>
          )}
        </div>
      ))}

      {editingContent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Editing Content</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>{editingContent.icon} {editingContent.title}</div>
              </div>
              <button onClick={cancelContentEdit} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', fontFamily: A.font, lineHeight: 1 }}>✕</button>
            </div>
            {(() => {
              const siblings = sections.filter(s => s.title === editingContent.title)
              if (siblings.length <= 1) return null
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {siblings.map(s => (
                    <button key={s.variant} onClick={() => switchVariant(s.variant)} style={{ ...btnGhost, fontSize: 11, padding: '5px 14px', color: editingVariant === s.variant ? A.gold : A.muted, borderColor: editingVariant === s.variant ? `${A.gold}50` : A.border }}>{s.variant}</button>
                  ))}
                </div>
              )
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {editContent.map((block, idx) => (
                <div key={idx} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, flex: 1 }}>{block.type}</span>
                    <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? A.faint : A.muted, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 13, padding: '2px 6px', fontFamily: A.font }}>↑</button>
                    <button onClick={() => moveBlock(idx, 'down')} disabled={idx === editContent.length - 1} style={{ background: 'none', border: 'none', color: idx === editContent.length - 1 ? A.faint : A.muted, cursor: idx === editContent.length - 1 ? 'default' : 'pointer', fontSize: 13, padding: '2px 6px', fontFamily: A.font }}>↓</button>
                    <button onClick={() => deleteBlock(idx)} style={{ background: 'none', border: 'none', color: A.danger, cursor: 'pointer', fontSize: 13, padding: '2px 6px', fontFamily: A.font }}>✕</button>
                  </div>
                  {(block.type === 'paragraph' || block.type === 'heading' || block.type === 'note' || block.type === 'warning') && (
                    <textarea style={{ ...textareaStyle, minHeight: block.type === 'heading' ? 44 : 80, fontSize: 13 }} value={block.text} onChange={e => updateBlock(idx, { ...block, text: e.target.value })} placeholder={block.type === 'heading' ? 'Heading text…' : 'Block text…'} />
                  )}
                  {block.type === 'list' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {block.items.map((item, ii) => (
                        <div key={ii} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input style={{ ...inputStyle, flex: 1, fontSize: 13 }} value={item} onChange={e => { const items = [...block.items]; items[ii] = e.target.value; updateBlock(idx, { ...block, items }) }} placeholder={`Item ${ii + 1}`} />
                          <button onClick={() => { const items = block.items.filter((_, i) => i !== ii); updateBlock(idx, { ...block, items }) }} style={{ background: 'none', border: 'none', color: A.danger, cursor: 'pointer', fontSize: 16, padding: '4px 6px', fontFamily: A.font }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateBlock(idx, { ...block, items: [...block.items, ''] })} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px', alignSelf: 'flex-start', marginTop: 2 }}>+ Add item</button>
                    </div>
                  )}
                  {block.type === 'wifi' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input style={{ ...inputStyle, fontSize: 13 }} value={block.network} onChange={e => updateBlock(idx, { ...block, network: e.target.value })} placeholder='Network name' />
                      <input style={{ ...inputStyle, fontSize: 13 }} value={block.password} onChange={e => updateBlock(idx, { ...block, password: e.target.value })} placeholder='Password' />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Add block</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['paragraph', 'heading', 'note', 'warning', 'list', 'wifi'] as ContentBlock['type'][]).map(type => (
                  <button key={type} onClick={() => addBlock(type)} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px' }}>+ {type}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${A.border}` }}>
              <button onClick={handleSaveContent} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save Content'}</button>
              <button onClick={cancelContentEdit} style={btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Properties ───────────────────────────────────────────────────────────

type FullProperty = PropertyRow

export function PropertiesTab() {
  const [properties, setProperties] = useState<FullProperty[]>([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState<FullProperty | null>(null)
  const [saving, setSaving]         = useState(false)
  const { toast, showToast }        = useToast()

  const emptyForm = { name: '', tagline: '', city: '', country: '', hero_image: '', maps_url: '', maps_embed_url: '', owner_name: '', owner_phone: '', manager_name: '', manager_phone: '', emergency_contacts: [] as { label: string; phone: string }[] }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setProperties(await fetchProgrammeProperties()) } catch (e) { showToast(`Failed to load properties: ${errMsg(e)}`, 'error') }
    setLoading(false)
  }

  function openEdit(prop: FullProperty) {
    setForm({ name: prop.name, tagline: prop.tagline ?? '', city: prop.city ?? '', country: prop.country ?? '', hero_image: prop.hero_image ?? '', maps_url: prop.maps_url ?? '', maps_embed_url: prop.maps_embed_url ?? '', owner_name: prop.owner_name ?? '', owner_phone: prop.owner_phone ?? '', manager_name: prop.manager_name ?? '', manager_phone: prop.manager_phone ?? '', emergency_contacts: prop.emergency_contacts ?? [] })
    setEditing(prop)
  }

  function cancelEdit() { setEditing(null); setForm(emptyForm) }
  function addEmergency() { setForm(f => ({ ...f, emergency_contacts: [...f.emergency_contacts, { label: '', phone: '' }] })) }
  function updateEmergency(idx: number, field: 'label' | 'phone', value: string) { setForm(f => ({ ...f, emergency_contacts: f.emergency_contacts.map((e, i) => i === idx ? { ...e, [field]: value } : e) })) }
  function removeEmergency(idx: number) { setForm(f => ({ ...f, emergency_contacts: f.emergency_contacts.filter((_, i) => i !== idx) })) }

  async function handleSave() {
    if (!editing || !form.name.trim()) { showToast('Name is required.', 'error'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), tagline: form.tagline.trim() || null, city: form.city.trim() || null, country: form.country.trim() || null, hero_image: form.hero_image.trim() || null, maps_url: form.maps_url.trim() || null, maps_embed_url: form.maps_embed_url.trim() || null, owner_name: form.owner_name.trim() || null, owner_phone: form.owner_phone.trim() || null, manager_name: form.manager_name.trim() || null, manager_phone: form.manager_phone.trim() || null, emergency_contacts: form.emergency_contacts.filter(e => e.label.trim() || e.phone.trim()) }
    try { await updateProperty(editing.id, payload); showToast('Property saved.', 'success'); cancelEdit(); load() } catch (e) { showToast(`Failed to save property: ${errMsg(e)}`, 'error') }
    setSaving(false)
  }

  async function handleToggleActive(prop: FullProperty) {
    try { await togglePropertyActive(prop.id, !prop.active); showToast(prop.active ? 'Property deactivated.' : 'Property activated.', 'success'); load() } catch (e) { showToast(`Failed: ${errMsg(e)}`, 'error') }
  }

  async function handleDelete(prop: FullProperty) {
    if (!window.confirm(`Delete "${prop.name}"? This cannot be undone and will affect any linked programmes.`)) return
    try { await deleteProperty(prop.id); showToast('Property deleted.', 'success'); load() } catch (e) { showToast(`Failed to delete property: ${errMsg(e)}`, 'error') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <SectionHeader title='Properties' />
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}
      {editing && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 20 }}>Editing: <span style={{ color: A.gold }}>{editing.name}</span><span style={{ fontSize: 11, color: A.faint, fontWeight: 400, marginLeft: 10 }}>/{editing.slug}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label='Name'><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label='Tagline'><input style={inputStyle} value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder='A short descriptor…' /></Field>
            <Field label='City'><input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder='Valencia' /></Field>
            <Field label='Country'><input style={inputStyle} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder='Spain' /></Field>
            <Field label='Hero Image Path'><input style={inputStyle} value={form.hero_image} onChange={e => setForm(f => ({ ...f, hero_image: e.target.value }))} placeholder='/programme/stays/casa-romeu/hero.jpg' /></Field>
            <Field label='Google Maps URL'><input style={inputStyle} value={form.maps_url} onChange={e => setForm(f => ({ ...f, maps_url: e.target.value }))} placeholder='https://maps.google.com/?q=…' /></Field>
            <Field label='Google Maps Embed URL'><input style={inputStyle} value={form.maps_embed_url} onChange={e => setForm(f => ({ ...f, maps_embed_url: e.target.value }))} placeholder='https://www.google.com/maps/embed?pb=…' /></Field>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 12 }}>Contacts</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Field label='Owner Name'><input style={inputStyle} value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} /></Field>
            <Field label='Owner Phone'><input style={inputStyle} value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} placeholder='+34 600 000 000' /></Field>
            <Field label='Manager Name'><input style={inputStyle} value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} /></Field>
            <Field label='Manager Phone'><input style={inputStyle} value={form.manager_phone} onChange={e => setForm(f => ({ ...f, manager_phone: e.target.value }))} placeholder='+34 600 000 000' /></Field>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>Emergency Contacts</div>
              <button onClick={addEmergency} style={{ ...btnGhost, padding: '5px 14px', fontSize: 11 }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.emergency_contacts.map((e, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                  <input style={inputStyle} value={e.label} onChange={ev => updateEmergency(idx, 'label', ev.target.value)} placeholder='e.g. Police' />
                  <input style={inputStyle} value={e.phone} onChange={ev => updateEmergency(idx, 'phone', ev.target.value)} placeholder='112' />
                  <button onClick={() => removeEmergency(idx)} style={{ ...btnDanger, padding: '8px', fontSize: 13, lineHeight: 1, textAlign: 'center' }}>✕</button>
                </div>
              ))}
              {form.emergency_contacts.length === 0 && <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>No emergency contacts added.</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
            <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}
      {!loading && properties.map(prop => (
        <div key={prop.id} style={{ background: A.bgCard, border: `1px solid ${editing?.id === prop.id ? A.borderGold : A.border}`, borderRadius: 14, padding: '18px 20px', opacity: prop.active ? 1 : 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: A.text, fontFamily: A.font }}>{prop.name}</span>
                {!prop.active && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 100, border: `1px solid ${A.danger}50`, color: A.danger, background: `${A.danger}12`, fontFamily: A.font }}>Inactive</span>}
              </div>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginBottom: 2 }}>{[prop.city, prop.country].filter(Boolean).join(', ')} · /{prop.slug}</div>
              {prop.tagline && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{prop.tagline}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(prop)} style={btnGhost}>Edit</button>
              <button onClick={() => handleToggleActive(prop)} style={{ ...btnGhost, color: prop.active ? A.danger : A.positive, borderColor: prop.active ? `${A.danger}50` : `${A.positive}50` }}>{prop.active ? 'Deactivate' : 'Activate'}</button>
              <button onClick={() => handleDelete(prop)} style={btnDanger}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Access Denied Page ───────────────────────────────────────────────────

export function AccessDeniedPageTab() {
  const [showFallback, setShowFallback] = useState(false)
  const mockEmail    = 'guest@ambience.travel'
  const mockFallback = { url: '/stays/k5SSks4AUedpBJLO', guestNames: 'Ragnar & Gunnar' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title='Access Denied Page' />
      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, lineHeight: 1.7 }}>
        Live render of <code style={{ color: A.gold, fontSize: 11 }}>ProgrammeAccessDenied.tsx</code> — any copy changes in that file are reflected here automatically.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ label: 'No programmes', value: false }, { label: 'Has other programmes', value: true }].map(opt => (
          <button key={String(opt.value)} onClick={() => setShowFallback(opt.value)} style={{ padding: '6px 16px', borderRadius: 100, border: `1px solid ${showFallback === opt.value ? A.gold : A.border}`, background: showFallback === opt.value ? 'rgba(201,184,142,0.1)' : 'transparent', color: showFallback === opt.value ? A.gold : A.muted, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer' }}>
            {opt.label}
          </button>
        ))}
      </div>
      <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${A.border}` }}>
        <div style={{ padding: '8px 16px', background: A.bgCard, borderBottom: `1px solid ${A.border}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
          Preview · {showFallback ? 'Has other programmes' : 'No programmes'}
        </div>
        <div style={{ overflow: 'hidden', height: 480 }}>
          <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', height: '138.9%', pointerEvents: 'none' }}>
            <ProgrammeAccessDenied email={mockEmail} fallbackProgramme={showFallback ? mockFallback : undefined} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Admin shell ───────────────────────────────────────────────────────────────

type AdminTab = 'programmes' | 'letters' | 'listings' | 'sections' | 'properties' | 'access-denied' | 'client-profile'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'programmes',     label: 'Programmes' },
  { id: 'letters',        label: 'Welcome Letters' },
  { id: 'listings',       label: 'Listings' },
  { id: 'sections',       label: 'Property Sections' },
  { id: 'properties',     label: 'Properties' },
  { id: 'access-denied',  label: 'Access Denied Page' },
  { id: 'client-profile', label: 'Client Profile' },
]

const FULL_WIDTH_TABS: AdminTab[] = ['client-profile']

function AdminShell() {
  const [tab, setTab]             = useState<AdminTab>('programmes')
  const [isMobile, setIsMobile]   = useState(false)
  const tabBarRef                 = useRef<HTMLDivElement>(null)
  const [underline, setUnderline] = useState({ left: 0, width: 0 })

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const bar = tabBarRef.current; if (!bar) return
    const activeBtn = bar.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`); if (!activeBtn) return
    setUnderline({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
  }, [tab, isMobile])

  const isFullWidth = FULL_WIDTH_TABS.includes(tab)

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: A.bgCard, borderBottom: `1px solid ${A.border}`, backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(16px, 4vw, 32px)', height: 52, borderBottom: isMobile ? `1px solid ${A.border}` : 'none' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>ambience · Admin</div>
          <a href='https://programme.ambience.travel' style={{ fontSize: 11, color: A.faint, textDecoration: 'none', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>← Back to site</a>
        </div>
        {isMobile ? (
          <div style={{ padding: '10px clamp(16px, 4vw, 32px)' }}>
            <select value={tab} onChange={e => setTab(e.target.value as AdminTab)} style={{ width: '100%', background: A.bgInput, border: `1px solid ${A.borderGold}`, borderRadius: 10, color: A.gold, padding: '10px 14px', fontSize: 13, fontWeight: 700, fontFamily: A.font, cursor: 'pointer', outline: 'none', colorScheme: 'dark' }}>
              {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        ) : (
          <div ref={tabBarRef} style={{ position: 'relative', display: 'flex', gap: 0, padding: '0 clamp(16px, 4vw, 32px)', overflowX: 'auto' }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} data-tab={t.id} onClick={() => setTab(t.id)} style={{ padding: '12px 18px', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: A.font, border: 'none', background: 'transparent', color: active ? A.gold : A.muted, whiteSpace: 'nowrap', transition: 'color 0.15s ease', marginBottom: -1 }}>
                  {t.label}
                </button>
              )
            })}
            <div style={{ position: 'absolute', bottom: 0, left: underline.left, width: underline.width, height: 2, background: A.gold, borderRadius: 2, transition: 'left 0.2s cubic-bezier(0.16,1,0.3,1), width 0.2s cubic-bezier(0.16,1,0.3,1)', pointerEvents: 'none' }} />
          </div>
        )}
      </div>
      <div style={{ maxWidth: isFullWidth ? 1440 : 1100, margin: '0 auto', padding: `clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px)`, width: '100%', boxSizing: 'border-box' }}>
        {tab === 'programmes'     && <ProgrammesTab />}
        {tab === 'letters'        && <WelcomeLettersTab />}
        {tab === 'listings'       && <ListingsTab />}
        {tab === 'sections'       && <PropertySectionsTab />}
        {tab === 'properties'     && <PropertiesTab />}
        {tab === 'access-denied'  && <AccessDeniedPageTab />}
        {tab === 'client-profile' && <ClientProfilePage />}
      </div>
    </div>
  )
}

// ── Access denied ─────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: A.text, fontFamily: A.font }}>Access denied.</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: A.gold, textDecoration: 'none', fontFamily: A.font }}>Return to ambience.travel →</a>
    </div>
  )
}

// ── ProgrammeAdmin — gated entry point ───────────────────────────────────────
// global_profiles.is_admin check retained as-is (pre-admin-scopes migration).

export default function ProgrammeAdmin() {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    async function check() {
      const session = await getSession()
      if (!session) { setStatus('denied'); return }
      const { data } = await supabase.from('global_profiles').select('is_admin').eq('id', session.user.id).single()
      setStatus(data?.is_admin === true ? 'allowed' : 'denied')
    }
    check()
  }, [])

  if (status === 'loading') {
    return <div style={{ minHeight: '100vh', background: A.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Checking access…</div></div>
  }
  if (status === 'denied') return <AccessDenied />
  return <AdminShell />
}

// ── Error helper ──────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error'
}