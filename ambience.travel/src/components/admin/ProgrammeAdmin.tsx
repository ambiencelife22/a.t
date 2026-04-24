/* ProgrammeAdmin.tsx
 * Admin interface for the ambience.travel programme product.
 * Gated by profiles.is_admin — same column as ambience.SPORTS.
 * Four tabs: Programmes, Welcome Letters, Listings, Property Sections.
 * Dark theme throughout — matches ProgrammeLayout shell.
 * No external dependencies beyond supabase client and landingTypes tokens.
 *
 * Last updated: S23 — Full surgical rename pass to align with travel_programme_*
 *   table convention shipped in S17. Old table names (programmes, properties,
 *   property_sections, property_listings, programme_sections, programme_guests)
 *   were dropped during S12-S20 refactor and admin queries silently failed.
 *   All .from() calls updated. Nested PostgREST relations aliased back to old
 *   keys (e.g. properties:travel_programme_properties) so downstream mapping
 *   code stays unchanged. Added error toasts on every load() failure so future
 *   schema drift surfaces immediately instead of silently rendering empty.
 *   Also: programme list row now renders check-in/check-out via shared
 *   formatDateOnly helper — canonical DD Month YYYY format, timezone-safe.
 *   Added View button per row that opens guest-facing programme in new tab,
 *   resolving to programme.ambience.travel when admin is on a different
 *   subdomain, or current origin when admin lives on the programme subdomain.
 */

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/auth'
// import { DARK } from '../../lib/landingTypes'
// import { WIDGET } from '../../lib/landingColors'

import type { ListingCategory } from '../../lib/programmeTypes'
import { formatDateOnly } from '../../lib/dates'
import ClientProfilePage from './ClientProfilePage'
import ProgrammeAccessDenied from '../programme/ProgrammeAccessDenied'
import GuestLinker from './GuestLinker'

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
// Routing shape varies by environment:
// — Production on programme.ambience.travel: /{sub_path}/{url_id} (no prefix,
//   subdomain routes the programme product)
// — Localhost: /programme/{sub_path}/{url_id} (prefix required because single
//   dev server serves all products under path-based routing)
// — Other subdomains (e.g. design.ambience.travel): absolute URL to canonical
//   programme subdomain

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

// ── Types ─────────────────────────────────────────────────────────────────────

type Programme = {
  id:                   string
  url_id:               string
  programme_type:       string
  sub_path:             string
  status:               string
  active:               boolean
  guest_names:          string
  guest_count:          number
  check_in:             string | null
  check_out:            string | null
  welcome_letter:       string
  property_id:          string | null
  active_listing_ids:   string[] | null
  alarm_code_provided:  boolean
  is_public:            boolean
  public_wifi:          boolean
  public_alarm:         boolean
  public_owner_phone:   boolean
  public_manager_phone: boolean
  no_alarm:             boolean
  public_arrival: boolean
  properties:           { id: string; name: string; slug: string } | null
}

type Property = {
  id:   string
  name: string
  slug: string
}

type Listing = {
  id:        string
  name:      string
  category:  string
  genre:     string | null
  address:   string
  website:   string | null
  hours:     string | null
  note:      string | null
  favourite: boolean
  property_id: string
}

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading';   text: string }
  | { type: 'note';      text: string }
  | { type: 'warning';   text: string }
  | { type: 'list';      items: string[] }
  | { type: 'wifi';      network: string; password: string }

type Section = {
  id:          string
  title:       string
  icon:        string
  sort_order:  number
  variant:     string
  content:     ContentBlock[]
  property_id: string
}

// ── Tab: Programmes ───────────────────────────────────────────────────────────

function ProgrammesTab() {
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

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const [progRes, propRes] = await Promise.all([
      supabase
        .from('travel_programme_master')
        .select('id, url_id, programme_type, sub_path, status, active, is_public, public_wifi, public_alarm, public_owner_phone, public_manager_phone, no_alarm, public_arrival, guest_names, guest_count, check_in, check_out, welcome_letter, property_id, active_listing_ids, alarm_code_provided, properties:travel_programme_properties(id, name, slug)')
        .order('created_at', { ascending: false }),
      supabase
        .from('travel_programme_properties')
        .select('id, name, slug')
        .order('name'),
    ])

    if (progRes.error) {
      showToast(`Failed to load programmes: ${progRes.error.message}`, 'error')
    }
    if (propRes.error) {
      showToast(`Failed to load properties: ${propRes.error.message}`, 'error')
    }

    setProgrammes((progRes.data ?? []) as unknown as Programme[])
    setProperties((propRes.data ?? []) as Property[])
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
      url_id:               form.url_id.trim(),
      programme_type:       form.programme_type,
      sub_path:             form.sub_path,
      status:               form.status,
      guest_names:          form.guest_names.trim(),
      guest_count:          form.guest_count,
      check_in:             form.check_in || null,
      check_out:            form.check_out || null,
      welcome_letter:       form.welcome_letter.trim(),
      property_id:          form.property_id || null,
      alarm_code_provided:  form.alarm_code_provided,
    }

    if (editing) {
      const { error } = await supabase
        .from('travel_programme_master')
        .update(payload)
        .eq('id', editing.id)

      if (error) {
        showToast(`Failed to update programme: ${error.message}`, 'error')
        setSaving(false)
        return
      }
      showToast('Programme updated.', 'success')
    } else {
      const { error } = await supabase
        .from('travel_programme_master')
        .insert(payload)

      if (error) {
        showToast(error.message.includes('unique') ? 'URL ID already exists.' : `Failed to create programme: ${error.message}`, 'error')
        setSaving(false)
        return
      }
      showToast('Programme created.', 'success')
    }

    setSaving(false)
    cancelForm()
    load()
  }

  async function handleToggleActive(prog: Programme) {
    const { error } = await supabase
      .from('travel_programme_master')
      .update({ active: !prog.active })
      .eq('id', prog.id)
    if (error) { showToast(`Failed to update programme: ${error.message}`, 'error'); return }
    showToast(prog.active ? 'Programme deactivated.' : 'Programme activated.', 'success')
    load()
  }

  async function handleTogglePublic(prog: Programme) {
    const { error } = await supabase
      .from('travel_programme_master')
      .update({ is_public: !prog.is_public })
      .eq('id', prog.id)
    if (error) { showToast(`Failed to update programme: ${error.message}`, 'error'); return }
    showToast(prog.is_public ? 'Programme set to private.' : 'Programme is now public — no login required.', 'success')
    load()
  }

  async function handleToggleField(prog: Programme, field: 'public_wifi' | 'public_alarm' | 'public_owner_phone' | 'public_manager_phone' | 'no_alarm' | 'public_arrival') {
    const { error } = await supabase
      .from('travel_programme_master')
      .update({ [field]: !prog[field] })
      .eq('id', prog.id)
    if (error) { showToast(`Failed to update visibility: ${error.message}`, 'error'); return }
    load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this programme? This cannot be undone.')) return
    const { error } = await supabase.from('travel_programme_master').delete().eq('id', id)
    if (error) {
      showToast(`Failed to delete programme: ${error.message}`, 'error')
      return
    }
    showToast('Programme deleted.', 'success')
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <SectionHeader
        title='Programmes'
        action={
          <button onClick={openCreate} style={btnPrimary}>+ New Programme</button>
        }
      />

      {/* Form */}
      {showForm && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 20 }}>
            {editing ? 'Edit Programme' : 'New Programme'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label='URL ID'>
              <input
                style={inputStyle}
                value={form.url_id}
                onChange={e => setForm(f => ({ ...f, url_id: e.target.value }))}
                placeholder='e.g. k5SSks4AUedpBJLO'
                disabled={!!editing}
              />
            </Field>
            <Field label='Property'>
              <select
                style={inputStyle}
                value={form.property_id}
                onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
              >
                <option value=''>— No property —</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label='Guest Names'>
              <input
                style={inputStyle}
                value={form.guest_names}
                onChange={e => setForm(f => ({ ...f, guest_names: e.target.value }))}
                placeholder='e.g. Ragnar & Gunnar'
              />
            </Field>
            <Field label='Guest Count'>
              <input
                style={inputStyle}
                type='number'
                min={1}
                value={form.guest_count}
                onChange={e => setForm(f => ({ ...f, guest_count: parseInt(e.target.value) || 1 }))}
              />
            </Field>
            <Field label='Check-in'>
              <input
                style={inputStyle}
                type='date'
                value={form.check_in}
                onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))}
              />
            </Field>
            <Field label='Check-out'>
              <input
                style={inputStyle}
                type='date'
                value={form.check_out}
                onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))}
              />
            </Field>
            <Field label='Type'>
              <select
                style={inputStyle}
                value={form.programme_type}
                onChange={e => setForm(f => ({ ...f, programme_type: e.target.value, sub_path: e.target.value === 'stay' ? 'stays' : e.target.value === 'journey' ? 'journeys' : e.target.value }))}
              >
                <option value='stay'>Stay</option>
                <option value='journey'>Journey</option>
                <option value='concierge'>Concierge</option>
              </select>
            </Field>
            <Field label='Status'>
              <select
                style={inputStyle}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value='confirmed'>Confirmed</option>
                <option value='draft'>Draft</option>
                <option value='cancelled'>Cancelled</option>
              </select>
            </Field>
          </div>

          {/* Alarm code toggle — only relevant for stay programmes */}
          {form.programme_type === 'stay' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '14px 16px', borderRadius: 12, border: `1px solid ${A.border}`, background: 'rgba(255,255,255,0.03)' }}>
              <input
                type='checkbox'
                id='alarm_code'
                checked={form.alarm_code_provided}
                onChange={e => setForm(f => ({ ...f, alarm_code_provided: e.target.checked }))}
                style={{ accentColor: A.gold, width: 16, height: 16, flexShrink: 0 }}
              />
              <div>
                <label htmlFor='alarm_code' style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font, cursor: 'pointer', display: 'block', marginBottom: 2 }}>
                  Alarm code provided to guests
                </label>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                  Unchecked shows alternate no-code alarm instructions in the house guide
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <Field label='Welcome Letter'>
              <textarea
                style={{ ...textareaStyle, minHeight: 160 }}
                value={form.welcome_letter}
                onChange={e => setForm(f => ({ ...f, welcome_letter: e.target.value }))}
                placeholder='Write the welcome letter here…'
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Programme'}
            </button>
            <button onClick={cancelForm} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>Loading…</div>
      )}

      {!loading && programmes.length === 0 && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '20px 0' }}>No programmes yet.</div>
      )}

      {!loading && programmes.map(prog => (
        <div key={prog.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 14, padding: '18px 20px', opacity: prog.active ? 1 : 0.5 }}>

          {/* Info */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <StatusBadge status={prog.status} />
              {!prog.active && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', padding: '3px 10px', borderRadius: 100,
                  border: `1px solid ${A.danger}50`, color: A.danger,
                  background: `${A.danger}12`, fontFamily: A.font,
                }}>
                  Inactive
                </span>
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 6 }}>
              {prog.guest_names}
            </div>
            <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>
              {prog.properties?.name ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: "'DM Mono', monospace", marginBottom: 3, wordBreak: 'break-all' }}>
              /{prog.sub_path}/{prog.url_id}
            </div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {prog.check_in ? formatDateOnly(prog.check_in) : 'TBA'} → {prog.check_out ? formatDateOnly(prog.check_out) : 'TBA'}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <a
              href={buildGuestUrl(prog.sub_path, prog.url_id)}
              target='_blank'
              rel='noopener noreferrer'
              style={{
                ...btnGhost,
                fontSize:       12,
                padding:        '7px 16px',
                color:          A.gold,
                borderColor:    A.borderGold,
                textDecoration: 'none',
                display:        'inline-flex',
                alignItems:     'center',
                gap:            6,
              }}
            >
              View ↗
            </a>
            <button onClick={() => openEdit(prog)} style={{ ...btnGhost, fontSize: 12, padding: '7px 16px' }}>
              Edit
            </button>
            <button
              onClick={() => handleTogglePublic(prog)}
              style={{
                ...btnGhost, fontSize: 12, padding: '7px 16px',
                color: prog.is_public ? A.positive : A.muted,
                borderColor: prog.is_public ? `${A.positive}50` : A.border,
              }}
            >
              {prog.is_public ? 'Make Private' : 'Make Public'}
            </button>
            <button
              onClick={() => handleToggleActive(prog)}
              style={{
                ...btnGhost, fontSize: 12, padding: '7px 16px',
                color: prog.active ? A.danger : A.positive,
                borderColor: prog.active ? `${A.danger}50` : `${A.positive}50`,
              }}
            >
              {prog.active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => handleDelete(prog.id)} style={{ ...btnDanger, fontSize: 12, padding: '7px 14px' }}>
              Delete
            </button>
          </div>

          {/* Programme flags */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                onClick={() => handleToggleField(prog, 'no_alarm')}
                style={{
                  ...btnGhost, fontSize: 11, padding: '5px 12px',
                  color:       prog.no_alarm ? A.positive : A.faint,
                  borderColor: prog.no_alarm ? `${A.positive}50` : A.border,
                }}
              >
                {prog.no_alarm ? '✓' : '—'} No alarm stay
              </button>
            </div>
          </div>

          {/* Visibility toggles */}
          <div style={{ marginTop: 4, paddingTop: 10, borderTop: `1px solid ${A.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>
                Public visibility
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  { field: 'public_arrival' as const, label: 'Arrival' },
                  { field: 'public_wifi'          as const, label: 'WiFi' },
                  { field: 'public_alarm'         as const, label: 'Alarm code' },
                  { field: 'public_owner_phone'   as const, label: 'Host phone' },
                  { field: 'public_manager_phone' as const, label: 'Manager phone' },
                ] as const).map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => handleToggleField(prog, field)}
                    style={{
                      ...btnGhost, fontSize: 11, padding: '5px 12px',
                      color:       prog[field] ? A.positive : A.faint,
                      borderColor: prog[field] ? `${A.positive}50` : A.border,
                    }}
                  >
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
  const [open, setOpen]         = useState(false)
  const [sections, setSections] = useState<SectionOption[]>([])
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [editing, setEditing]   = useState<OverrideRow | null>(null)
  const [editContent, setEditContent] = useState<ContentBlock[]>([])
  const [saving, setSaving]     = useState(false)
  const { toast, showToast }    = useToast()

  async function load() {
    const [secRes, ovRes] = await Promise.all([
      supabase.from('travel_programme_property_sections').select('id, title, icon').eq('property_id', propertyId).eq('variant', 'default').order('sort_order'),
      supabase.from('travel_programme_sections').select('id, section_id, content').eq('programme_id', programmeId),
    ])

    if (secRes.error) {
      showToast(`Failed to load sections: ${secRes.error.message}`, 'error')
    }
    if (ovRes.error) {
      showToast(`Failed to load overrides: ${ovRes.error.message}`, 'error')
    }

    setSections((secRes.data ?? []) as SectionOption[])
    setOverrides((ovRes.data ?? []) as OverrideRow[])
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
    } else {
      setEditing({ id: '', section_id: section.id, content: [] })
      setEditContent([])
    }
  }

  function cancelEdit() {
    setEditing(null)
    setEditContent([])
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const existing = overrides.find(o => o.section_id === editing.section_id)
    if (existing) {
      const { error } = await supabase.from('travel_programme_sections').update({ content: editContent }).eq('id', existing.id)
      if (error) { showToast(`Failed to save override: ${error.message}`, 'error'); setSaving(false); return }
    } else {
      const { error } = await supabase.from('travel_programme_sections').insert({ programme_id: programmeId, section_id: editing.section_id, content: editContent })
      if (error) { showToast(`Failed to save override: ${error.message}`, 'error'); setSaving(false); return }
    }
    showToast('Section override saved.', 'success')
    setSaving(false)
    cancelEdit()
    load()
  }

  async function handleDelete(sectionId: string) {
    const existing = overrides.find(o => o.section_id === sectionId)
    if (!existing) return
    const { error } = await supabase.from('travel_programme_sections').delete().eq('id', existing.id)
    if (error) { showToast(`Failed to remove override: ${error.message}`, 'error'); return }
    showToast('Override removed — using property default.', 'success')
    load()
  }

  function updateBlock(idx: number, updated: ContentBlock) {
    setEditContent(prev => prev.map((b, i) => i === idx ? updated : b))
  }

  function deleteBlock(idx: number) {
    setEditContent(prev => prev.filter((_, i) => i !== idx))
  }

  function moveBlock(idx: number, dir: 'up' | 'down') {
    setEditContent(prev => {
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function addBlock(type: ContentBlock['type']) {
    const blank: ContentBlock =
      type === 'list' ? { type: 'list', items: [''] } :
      type === 'wifi' ? { type: 'wifi', network: '', password: '' } :
      { type, text: '' } as ContentBlock
    setEditContent(prev => [...prev, blank])
  }

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <button
        onClick={handleOpen}
        style={{ ...btnGhost, fontSize: 11, padding: '5px 14px', color: A.muted }}
      >
        {open ? '▲' : '▼'} Guest-specific section overrides
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map(section => {
            const hasOverride = overrides.some(o => o.section_id === section.id)
            return (
              <div key={section.id} style={{
                background: A.bg, border: `1px solid ${hasOverride ? A.borderGold : A.border}`,
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 15 }}>{section.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: A.text, fontFamily: A.font }}>{section.title}</span>
                {hasOverride && (
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>
                    Override active
                  </span>
                )}
                <button onClick={() => startEdit(section)} style={{ ...btnGhost, fontSize: 11, padding: '4px 12px' }}>
                  {hasOverride ? 'Edit' : '+ Override'}
                </button>
                {hasOverride && (
                  <button onClick={() => handleDelete(section.id)} style={{ ...btnDanger, fontSize: 11, padding: '4px 10px' }}>
                    Remove
                  </button>
                )}
              </div>
            )
          })}

          {editing && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: '40px 20px', overflowY: 'auto',
            }}>
              <div style={{
                background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 20,
                padding: 28, width: '100%', maxWidth: 680,
                display: 'flex', flexDirection: 'column', gap: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Guest Override</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                      {sections.find(s => s.id === editing.section_id)?.icon} {sections.find(s => s.id === editing.section_id)?.title}
                    </div>
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
                      This content replaces the property default for this guest only.
                    </div>
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
                  <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Saving…' : 'Save Override'}
                  </button>
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

function WelcomeLettersTab() {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [selected, setSelected]     = useState<Programme | null>(null)
  const [letter, setLetter]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const { toast, showToast }        = useToast()

  useEffect(() => {
    supabase
      .from('travel_programme_master')
      .select('id, url_id, guest_names, status, welcome_letter, property_id, programme_type, sub_path, guest_count, check_in, check_out, active_listing_ids, properties:travel_programme_properties(id, name, slug)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          showToast(`Failed to load programmes: ${error.message}`, 'error')
        }
        setProgrammes((data ?? []) as unknown as Programme[])
        setLoading(false)
      })
  }, [])

  function selectProgramme(prog: Programme) {
    setSelected(prog)
    setLetter(prog.welcome_letter)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)

    const { error } = await supabase
      .from('travel_programme_master')
      .update({ welcome_letter: letter })
      .eq('id', selected.id)

    if (error) {
      showToast(`Failed to save: ${error.message}`, 'error')
      setSaving(false)
      return
    }

    setProgrammes(prev => prev.map(p => p.id === selected.id ? { ...p, welcome_letter: letter } : p))
    setSelected(prev => prev ? { ...prev, welcome_letter: letter } : null)
    showToast('Welcome letter saved.', 'success')
    setSaving(false)
  }

  const paragraphs = letter.split('\n\n').filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <SectionHeader title='Welcome Letters' />

      {loading && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Programme list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {programmes.map(prog => (
              <button
                key={prog.id}
                onClick={() => selectProgramme(prog)}
                style={{
                  textAlign:    'left',
                  padding:      '12px 16px',
                  borderRadius: 12,
                  border:       `1px solid ${selected?.id === prog.id ? A.borderGold : A.border}`,
                  background:   selected?.id === prog.id ? 'rgba(201,184,142,0.06)' : A.bgCard,
                  cursor:       'pointer',
                  fontFamily:   A.font,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: A.text, marginBottom: 3 }}>{prog.guest_names}</div>
                <div style={{ fontSize: 11, color: A.faint }}>{prog.properties?.name ?? '—'}</div>
              </button>
            ))}
          </div>

          {/* Editor */}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                    Editor
                  </div>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 400 }}
                    value={letter}
                    onChange={e => setLetter(e.target.value)}
                    placeholder='Write the welcome letter here. Separate paragraphs with a blank line.'
                  />
                  <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1, alignSelf: 'flex-start' }}>
                    {saving ? 'Saving…' : 'Save Letter'}
                  </button>
                </div>

                {/* Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                    Preview
                  </div>
                  <div style={{ background: '#F7F4EE', borderRadius: 12, padding: '24px 28px', minHeight: 400 }}>
                    <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7A8476', marginBottom: 20, fontFamily: A.font }}>
                      Welcome
                    </p>
                    {paragraphs.map((p, i) => (
                      <p key={i} style={{
                        fontSize:      i === 0 ? 18 : 15,
                        lineHeight:    1.85,
                        color:         i === 0 ? '#171917' : '#4F564F',
                        fontWeight:    i === 0 ? 600 : 400,
                        marginBottom:  i === paragraphs.length - 1 ? 0 : 16,
                        fontFamily:    A.font,
                      }}>
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
          </div>
          )}

          {!selected && (
            <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '40px 0' }}>
              Select a programme to edit its welcome letter.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Listings ─────────────────────────────────────────────────────────────

const LISTING_CATEGORIES: ListingCategory[] = ['lunch', 'dinner', 'takeaway', 'experience', 'shopping']

function ListingsTab() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<string>('')
  const [listings, setListings]     = useState<Listing[]>([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Listing | null>(null)
  const [saving, setSaving]         = useState(false)
  const [filterCat, setFilterCat]   = useState<string>('all')
  const { toast, showToast }        = useToast()

  const emptyForm = {
    name:      '',
    category:  'lunch' as ListingCategory,
    genre:     '',
    address:   '',
    website:   '',
    hours:     '',
    note:      '',
    favourite: false,
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    supabase
      .from('travel_programme_properties')
      .select('id, name, slug')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          showToast(`Failed to load properties: ${error.message}`, 'error')
        }
        const props = (data ?? []) as Property[]
        setProperties(props)
        if (props.length > 0) {
          setSelectedProp(props[0].id)
        }
      })
  }, [])

  useEffect(() => {
    if (!selectedProp) return
    loadListings()
  }, [selectedProp])

  async function loadListings() {
    setLoading(true)
    const { data, error } = await supabase
      .from('travel_programme_property_listings')
      .select('id, name, category, genre, address, website, hours, note, favourite, property_id')
      .eq('property_id', selectedProp)
      .order('category')
    if (error) {
      showToast(`Failed to load listings: ${error.message}`, 'error')
    }
    setListings((data ?? []) as Listing[])
    setLoading(false)
  }

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(listing: Listing) {
    setForm({
      name:      listing.name,
      category:  listing.category as ListingCategory,
      genre:     listing.genre ?? '',
      address:   listing.address,
      website:   listing.website ?? '',
      hours:     listing.hours ?? '',
      note:      listing.note ?? '',
      favourite: listing.favourite,
    })
    setEditing(listing)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) {
      showToast('Name and address are required.', 'error')
      return
    }

    setSaving(true)

    const payload = {
      name:        form.name.trim(),
      category:    form.category,
      genre:       form.genre.trim() || null,
      address:     form.address.trim(),
      website:     form.website.trim() || null,
      hours:       form.hours.trim() || null,
      note:        form.note.trim() || null,
      favourite:   form.favourite,
      property_id: selectedProp,
    }

    if (editing) {
      const { error } = await supabase.from('travel_programme_property_listings').update(payload).eq('id', editing.id)
      if (error) { showToast(`Failed to update listing: ${error.message}`, 'error'); setSaving(false); return }
      showToast('Listing updated.', 'success')
    } else {
      const { error } = await supabase.from('travel_programme_property_listings').insert(payload)
      if (error) { showToast(`Failed to create listing: ${error.message}`, 'error'); setSaving(false); return }
      showToast('Listing created.', 'success')
    }

    setSaving(false)
    cancelForm()
    loadListings()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this listing?')) return
    const { error } = await supabase.from('travel_programme_property_listings').delete().eq('id', id)
    if (error) { showToast(`Failed to delete: ${error.message}`, 'error'); return }
    showToast('Listing deleted.', 'success')
    loadListings()
  }

  const filtered = filterCat === 'all' ? listings : listings.filter(l => l.category === filterCat)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <SectionHeader
        title='Listings'
        action={<button onClick={openCreate} style={btnPrimary}>+ New Listing</button>}
      />

      {/* Property selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Property</label>
        <select
          style={{ ...inputStyle, width: 'auto' }}
          value={selectedProp}
          onChange={e => setSelectedProp(e.target.value)}
        >
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 20 }}>
            {editing ? 'Edit Listing' : 'New Listing'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label='Name'>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder='Restaurant or venue name' />
            </Field>
            <Field label='Category'>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ListingCategory }))}>
                {LISTING_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label='Genre'>
              <input style={inputStyle} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder='e.g. Italian, Paella, Market' />
            </Field>
            <Field label='Hours'>
              <input style={inputStyle} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder='e.g. Mon-Sat 9:00-21:30' />
            </Field>
            <Field label='Address'>
              <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder='Full address' />
            </Field>
            <Field label='Website'>
              <input style={inputStyle} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder='https://…' />
            </Field>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Field label='Note'>
              <textarea style={textareaStyle} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder='Optional note for guests…' />
            </Field>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <input
              type='checkbox'
              id='favourite'
              checked={form.favourite}
              onChange={e => setForm(f => ({ ...f, favourite: e.target.checked }))}
              style={{ accentColor: A.gold, width: 16, height: 16 }}
            />
            <label htmlFor='favourite' style={{ fontSize: 13, color: A.text, fontFamily: A.font, cursor: 'pointer' }}>
              Mark as favourite
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Listing'}
            </button>
            <button onClick={cancelForm} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', ...LISTING_CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            style={{
              padding:      '6px 16px',
              borderRadius: 100,
              border:       `1px solid ${filterCat === cat ? A.gold : A.border}`,
              background:   filterCat === cat ? 'rgba(201,184,142,0.1)' : 'transparent',
              color:        filterCat === cat ? A.gold : A.muted,
              fontSize:     11,
              fontWeight:   600,
              fontFamily:   A.font,
              cursor:       'pointer',
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Listing rows */}
      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>No listings in this category.</div>
      )}

      {!loading && filtered.map(listing => (
        <div key={listing.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: A.text, fontFamily: A.font }}>{listing.name}</span>
              {listing.favourite && (
                <span style={{ fontSize: 9, color: A.gold, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${A.borderGold}`, borderRadius: 100, padding: '2px 8px', fontFamily: A.font }}>
                  Fav
                </span>
              )}
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

function PropertySectionsTab() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<string>('')
  const [sections, setSections]     = useState<Section[]>([])
  const [loading, setLoading]       = useState(false)
  const [editing, setEditing]       = useState<Section | null>(null)
  const [editTitle, setEditTitle]   = useState('')
  const [editIcon, setEditIcon]     = useState('')
  const [editContent, setEditContent] = useState<ContentBlock[]>([])
  const [editingContent, setEditingContent] = useState<Section | null>(null)
  const [editingVariant, setEditingVariant] = useState<string>('default')
  const [saving, setSaving]         = useState(false)
  const { toast, showToast }        = useToast()

  useEffect(() => {
    supabase
      .from('travel_programme_properties')
      .select('id, name, slug')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          showToast(`Failed to load properties: ${error.message}`, 'error')
        }
        const props = (data ?? []) as Property[]
        setProperties(props)
        if (props.length > 0) setSelectedProp(props[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selectedProp) return
    loadSections()
  }, [selectedProp])

  async function loadSections() {
    setLoading(true)
    const { data, error } = await supabase
      .from('travel_programme_property_sections')
      .select('id, title, icon, sort_order, variant, content, property_id')
      .eq('property_id', selectedProp)
      .order('sort_order')
    if (error) {
      showToast(`Failed to load sections: ${error.message}`, 'error')
    }
    setSections((data ?? []) as Section[])
    setLoading(false)
  }

  function openEdit(section: Section) {
    setEditing(section)
    setEditTitle(section.title)
    setEditIcon(section.icon)
  }

  function cancelEdit() {
    setEditing(null)
    setEditTitle('')
    setEditIcon('')
  }

  function openContentEdit(section: Section) {
    const defaultRow = sections.find(s => s.title === section.title && s.variant === 'default')
    const target = defaultRow ?? section
    setEditingContent(target)
    setEditingVariant(target.variant)
    setEditContent(JSON.parse(JSON.stringify(target.content)))
  }

  function cancelContentEdit() {
    setEditingContent(null)
    setEditContent([])
    setEditingVariant('default')
  }

  function switchVariant(variant: string) {
    if (!editingContent) return
    const target = sections.find(s => s.title === editingContent.title && s.variant === variant)
    if (!target) return
    setEditingContent(target)
    setEditingVariant(variant)
    setEditContent(JSON.parse(JSON.stringify(target.content)))
  }

  async function handleSaveContent() {
    if (!editingContent) return
    setSaving(true)
    const { error } = await supabase
      .from('travel_programme_property_sections')
      .update({ content: editContent })
      .eq('id', editingContent.id)
    if (error) { showToast(`Failed to save content: ${error.message}`, 'error'); setSaving(false); return }
    showToast('Section content saved.', 'success')
    setSaving(false)
    cancelContentEdit()
    loadSections()
  }

  function updateBlock(idx: number, updated: ContentBlock) {
    setEditContent(prev => prev.map((b, i) => i === idx ? updated : b))
  }

  function deleteBlock(idx: number) {
    setEditContent(prev => prev.filter((_, i) => i !== idx))
  }

  function moveBlock(idx: number, dir: 'up' | 'down') {
    setEditContent(prev => {
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function addBlock(type: ContentBlock['type']) {
    const blank: ContentBlock =
      type === 'list' ? { type: 'list', items: [''] } :
      type === 'wifi' ? { type: 'wifi', network: '', password: '' } :
      { type, text: '' } as ContentBlock
    setEditContent(prev => [...prev, blank])
  }

  async function handleSaveSection() {
    if (!editing) return
    if (!editTitle.trim()) { showToast('Title is required.', 'error'); return }
    setSaving(true)

    const { error } = await supabase
      .from('travel_programme_property_sections')
      .update({ title: editTitle.trim(), icon: editIcon.trim() })
      .eq('id', editing.id)

    if (error) { showToast(`Failed to save: ${error.message}`, 'error'); setSaving(false); return }

    showToast('Section updated.', 'success')
    setSaving(false)
    cancelEdit()
    loadSections()
  }

  async function moveSection(section: Section, direction: 'up' | 'down') {
    const idx = sections.findIndex(s => s.id === section.id)

    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sections.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const swap    = sections[swapIdx]

    await Promise.all([
      supabase.from('travel_programme_property_sections').update({ sort_order: swap.sort_order }).eq('id', section.id),
      supabase.from('travel_programme_property_sections').update({ sort_order: section.sort_order }).eq('id', swap.id),
    ])

    loadSections()
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
        <select
          style={{ ...inputStyle, width: 'auto' }}
          value={selectedProp}
          onChange={e => setSelectedProp(e.target.value)}
        >
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {!loading && groupedSections.map((section, idx) => (
        <div key={section.id}>
          {editing?.id === section.id ? (
            <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, marginBottom: 16 }}>
                <Field label='Icon'>
                  <input style={inputStyle} value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder='🔑' />
                </Field>
                <Field label='Title'>
                  <input style={inputStyle} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder='Section title' />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSaveSection} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => moveSection(section, 'up')}
                  disabled={idx === 0}
                  style={{ background: 'none', border: 'none', color: idx === 0 ? A.faint : A.muted, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: A.font }}
                >↑</button>
                <button
                  onClick={() => moveSection(section, 'down')}
                  disabled={idx === groupedSections.length - 1}
                  style={{ background: 'none', border: 'none', color: idx === groupedSections.length - 1 ? A.faint : A.muted, cursor: idx === groupedSections.length - 1 ? 'default' : 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: A.font }}
                >↓</button>
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

      {/* ── Content block editor ── */}
      {editingContent && (
        <div style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.75)',
          zIndex:     1000,
          display:    'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding:    '40px 20px',
          overflowY:  'auto',
        }}>
          <div style={{
            background:   A.bgCard,
            border:       `1px solid ${A.borderGold}`,
            borderRadius: 20,
            padding:      28,
            width:        '100%',
            maxWidth:     680,
            display:      'flex',
            flexDirection: 'column',
            gap:          20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Editing Content</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>{editingContent.icon} {editingContent.title}</div>
              </div>
              <button onClick={cancelContentEdit} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', fontFamily: A.font, lineHeight: 1 }}>✕</button>
            </div>

            {/* Variant selector — only shown when multiple variants exist */}
            {(() => {
              const siblings = sections.filter(s => s.title === editingContent.title)
              if (siblings.length <= 1) return null
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {siblings.map(s => (
                    <button
                      key={s.variant}
                      onClick={() => switchVariant(s.variant)}
                      style={{
                        ...btnGhost,
                        fontSize:    11,
                        padding:     '5px 14px',
                        color:       editingVariant === s.variant ? A.gold : A.muted,
                        borderColor: editingVariant === s.variant ? `${A.gold}50` : A.border,
                      }}
                    >
                      {s.variant}
                    </button>
                  ))}
                </div>
              )
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {editContent.map((block, idx) => (
                <div key={idx} style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 12, padding: 14 }}>
                  {/* Block header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, flex: 1 }}>
                      {block.type}
                    </span>
                    <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? A.faint : A.muted, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 13, padding: '2px 6px', fontFamily: A.font }}>↑</button>
                    <button onClick={() => moveBlock(idx, 'down')} disabled={idx === editContent.length - 1} style={{ background: 'none', border: 'none', color: idx === editContent.length - 1 ? A.faint : A.muted, cursor: idx === editContent.length - 1 ? 'default' : 'pointer', fontSize: 13, padding: '2px 6px', fontFamily: A.font }}>↓</button>
                    <button onClick={() => deleteBlock(idx)} style={{ background: 'none', border: 'none', color: A.danger, cursor: 'pointer', fontSize: 13, padding: '2px 6px', fontFamily: A.font }}>✕</button>
                  </div>

                  {/* Block fields */}
                  {(block.type === 'paragraph' || block.type === 'heading' || block.type === 'note' || block.type === 'warning') && (
                    <textarea
                      style={{ ...textareaStyle, minHeight: block.type === 'heading' ? 44 : 80, fontSize: 13 }}
                      value={block.text}
                      onChange={e => updateBlock(idx, { ...block, text: e.target.value })}
                      placeholder={block.type === 'heading' ? 'Heading text…' : 'Block text…'}
                    />
                  )}

                  {block.type === 'list' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {block.items.map((item, ii) => (
                        <div key={ii} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            style={{ ...inputStyle, flex: 1, fontSize: 13 }}
                            value={item}
                            onChange={e => {
                              const items = [...block.items]
                              items[ii] = e.target.value
                              updateBlock(idx, { ...block, items })
                            }}
                            placeholder={`Item ${ii + 1}`}
                          />
                          <button
                            onClick={() => {
                              const items = block.items.filter((_, i) => i !== ii)
                              updateBlock(idx, { ...block, items })
                            }}
                            style={{ background: 'none', border: 'none', color: A.danger, cursor: 'pointer', fontSize: 16, padding: '4px 6px', fontFamily: A.font }}
                          >✕</button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateBlock(idx, { ...block, items: [...block.items, ''] })}
                        style={{ ...btnGhost, fontSize: 11, padding: '5px 12px', alignSelf: 'flex-start', marginTop: 2 }}
                      >+ Add item</button>
                    </div>
                  )}

                  {block.type === 'wifi' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        style={{ ...inputStyle, fontSize: 13 }}
                        value={block.network}
                        onChange={e => updateBlock(idx, { ...block, network: e.target.value })}
                        placeholder='Network name'
                      />
                      <input
                        style={{ ...inputStyle, fontSize: 13 }}
                        value={block.password}
                        onChange={e => updateBlock(idx, { ...block, password: e.target.value })}
                        placeholder='Password'
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add block */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Add block</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['paragraph', 'heading', 'note', 'warning', 'list', 'wifi'] as ContentBlock['type'][]).map(type => (
                  <button key={type} onClick={() => addBlock(type)} style={{ ...btnGhost, fontSize: 11, padding: '5px 12px' }}>
                    + {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${A.border}` }}>
              <button onClick={handleSaveContent} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Save Content'}
              </button>
              <button onClick={cancelContentEdit} style={btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Properties ───────────────────────────────────────────────────────────

type FullProperty = {
  id:                 string
  slug:               string
  name:               string
  tagline:            string
  city:               string
  country:            string
  hero_image:         string | null
  maps_url:           string | null
  maps_embed_url:     string | null
  owner_name:         string
  owner_phone:        string
  manager_name:       string
  manager_phone:      string
  emergency_contacts: { label: string; phone: string }[]
  active:             boolean
}

function PropertiesTab() {
  const [properties, setProperties] = useState<FullProperty[]>([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState<FullProperty | null>(null)
  const [saving, setSaving]         = useState(false)
  const { toast, showToast }        = useToast()

  const emptyForm = {
    name:               '',
    tagline:            '',
    city:               '',
    country:            '',
    hero_image:         '',
    maps_url:           '',
    maps_embed_url:     '',
    owner_name:         '',
    owner_phone:        '',
    manager_name:       '',
    manager_phone:      '',
    emergency_contacts: [] as { label: string; phone: string }[],
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('travel_programme_properties')
      .select('id, slug, name, tagline, city, country, hero_image, maps_url, maps_embed_url, owner_name, owner_phone, manager_name, manager_phone, emergency_contacts, active')
      .order('name')
    if (error) {
      showToast(`Failed to load properties: ${error.message}`, 'error')
    }
    setProperties((data ?? []) as FullProperty[])
    setLoading(false)
  }

  function openEdit(prop: FullProperty) {
    setForm({
      name:               prop.name,
      tagline:            prop.tagline ?? '',
      city:               prop.city ?? '',
      country:            prop.country ?? '',
      hero_image:         prop.hero_image ?? '',
      maps_url:           prop.maps_url ?? '',
      maps_embed_url:     prop.maps_embed_url ?? '',
      owner_name:         prop.owner_name ?? '',
      owner_phone:        prop.owner_phone ?? '',
      manager_name:       prop.manager_name ?? '',
      manager_phone:      prop.manager_phone ?? '',
      emergency_contacts: prop.emergency_contacts ?? [],
    })
    setEditing(prop)
  }

  function cancelEdit() {
    setEditing(null)
    setForm(emptyForm)
  }

  // Emergency contacts helpers
  function addEmergency() {
    setForm(f => ({ ...f, emergency_contacts: [...f.emergency_contacts, { label: '', phone: '' }] }))
  }

  function updateEmergency(idx: number, field: 'label' | 'phone', value: string) {
    setForm(f => {
      const updated = f.emergency_contacts.map((e, i) => i === idx ? { ...e, [field]: value } : e)
      return { ...f, emergency_contacts: updated }
    })
  }

  function removeEmergency(idx: number) {
    setForm(f => ({ ...f, emergency_contacts: f.emergency_contacts.filter((_, i) => i !== idx) }))
  }

  async function handleSave() {
    if (!editing) return
    if (!form.name.trim()) { showToast('Name is required.', 'error'); return }

    setSaving(true)

    const payload = {
      name:               form.name.trim(),
      tagline:            form.tagline.trim() || null,
      city:               form.city.trim() || null,
      country:            form.country.trim() || null,
      hero_image:         form.hero_image.trim() || null,
      maps_url:           form.maps_url.trim() || null,
      maps_embed_url:     form.maps_embed_url.trim() || null,
      owner_name:         form.owner_name.trim() || null,
      owner_phone:        form.owner_phone.trim() || null,
      manager_name:       form.manager_name.trim() || null,
      manager_phone:      form.manager_phone.trim() || null,
      emergency_contacts: form.emergency_contacts.filter(e => e.label.trim() || e.phone.trim()),
    }

    const { error } = await supabase.from('travel_programme_properties').update(payload).eq('id', editing.id)

    if (error) {
      showToast(`Failed to save property: ${error.message}`, 'error')
      setSaving(false)
      return
    }

    showToast('Property saved.', 'success')
    setSaving(false)
    cancelEdit()
    load()
  }

  async function handleToggleActive(prop: FullProperty) {
    const { error } = await supabase
      .from('travel_programme_properties')
      .update({ active: !prop.active })
      .eq('id', prop.id)
    if (error) { showToast(`Failed to update property: ${error.message}`, 'error'); return }
    showToast(prop.active ? 'Property deactivated.' : 'Property activated.', 'success')
    load()
  }

  async function handleDelete(prop: FullProperty) {
    if (!window.confirm(`Delete "${prop.name}"? This cannot be undone and will affect any linked programmes.`)) return
    const { error } = await supabase.from('travel_programme_properties').delete().eq('id', prop.id)
    if (error) { showToast(`Failed to delete property: ${error.message}`, 'error'); return }
    showToast('Property deleted.', 'success')
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <SectionHeader title='Properties' />

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {/* Edit form */}
      {editing && (
        <div style={{ background: A.bgCard, border: `1px solid ${A.borderGold}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 20 }}>
            Editing: <span style={{ color: A.gold }}>{editing.name}</span>
            <span style={{ fontSize: 11, color: A.faint, fontWeight: 400, marginLeft: 10 }}>/{editing.slug}</span>
          </div>

          {/* Core fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label='Name'>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label='Tagline'>
              <input style={inputStyle} value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder='A short descriptor…' />
            </Field>
            <Field label='City'>
              <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder='Valencia' />
            </Field>
            <Field label='Country'>
              <input style={inputStyle} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder='Spain' />
            </Field>
            <Field label='Hero Image Path'>
              <input style={inputStyle} value={form.hero_image} onChange={e => setForm(f => ({ ...f, hero_image: e.target.value }))} placeholder='/programme/stays/casa-romeu/hero.jpg' />
            </Field>
            <Field label='Google Maps URL'>
              <input style={inputStyle} value={form.maps_url} onChange={e => setForm(f => ({ ...f, maps_url: e.target.value }))} placeholder='https://maps.google.com/?q=…' />
            </Field>
            <Field label='Google Maps Embed URL'>
              <input style={inputStyle} value={form.maps_embed_url} onChange={e => setForm(f => ({ ...f, maps_embed_url: e.target.value }))} placeholder='https://www.google.com/maps/embed?pb=…' />
            </Field>
          </div>

          {/* Owner / Manager */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 12 }}>
            Contacts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Field label='Owner Name'>
              <input style={inputStyle} value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} />
            </Field>
            <Field label='Owner Phone'>
              <input style={inputStyle} value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} placeholder='+34 600 000 000' />
            </Field>
            <Field label='Manager Name'>
              <input style={inputStyle} value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} />
            </Field>
            <Field label='Manager Phone'>
              <input style={inputStyle} value={form.manager_phone} onChange={e => setForm(f => ({ ...f, manager_phone: e.target.value }))} placeholder='+34 600 000 000' />
            </Field>
          </div>

          {/* Emergency contacts */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                Emergency Contacts
              </div>
              <button onClick={addEmergency} style={{ ...btnGhost, padding: '5px 14px', fontSize: 11 }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.emergency_contacts.map((e, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                  <input
                    style={inputStyle}
                    value={e.label}
                    onChange={ev => updateEmergency(idx, 'label', ev.target.value)}
                    placeholder='e.g. Police'
                  />
                  <input
                    style={inputStyle}
                    value={e.phone}
                    onChange={ev => updateEmergency(idx, 'phone', ev.target.value)}
                    placeholder='112'
                  />
                  <button
                    onClick={() => removeEmergency(idx)}
                    style={{ ...btnDanger, padding: '8px', fontSize: 13, lineHeight: 1, textAlign: 'center' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.emergency_contacts.length === 0 && (
                <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>No emergency contacts added.</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Property list */}
      {!loading && properties.map(prop => (
        <div key={prop.id} style={{ background: A.bgCard, border: `1px solid ${editing?.id === prop.id ? A.borderGold : A.border}`, borderRadius: 14, padding: '18px 20px', opacity: prop.active ? 1 : 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                  {prop.name}
                </span>
                {!prop.active && (
                  <span style={{
                    fontSize:      9,
                    fontWeight:    700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    padding:       '3px 10px',
                    borderRadius:  100,
                    border:        `1px solid ${A.danger}50`,
                    color:         A.danger,
                    background:    `${A.danger}12`,
                    fontFamily:    A.font,
                  }}>
                    Inactive
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginBottom: 2 }}>
                {[prop.city, prop.country].filter(Boolean).join(', ')} · /{prop.slug}
              </div>
              {prop.tagline && (
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
                  {prop.tagline}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(prop)} style={btnGhost}>Edit</button>
              <button
                onClick={() => handleToggleActive(prop)}
                style={{ ...btnGhost, color: prop.active ? A.danger : A.positive, borderColor: prop.active ? `${A.danger}50` : `${A.positive}50` }}
              >
                {prop.active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => handleDelete(prop)} style={btnDanger}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Access Denied Page ───────────────────────────────────────────────────

function AccessDeniedPageTab() {
  const [showFallback, setShowFallback] = useState(false)

  const mockEmail    = 'guest@ambience.travel'
  const mockFallback = { url: '/stays/k5SSks4AUedpBJLO', guestNames: 'Ragnar & Gunnar' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title='Access Denied Page' />

      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, lineHeight: 1.7 }}>
        Live render of <code style={{ color: A.gold, fontSize: 11 }}>ProgrammeAccessDenied.tsx</code> —
        any copy changes in that file are reflected here automatically.
      </div>

      {/* State toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'No programmes',        value: false },
          { label: 'Has other programmes', value: true  },
        ].map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => setShowFallback(opt.value)}
            style={{
              padding:      '6px 16px',
              borderRadius: 100,
              border:       `1px solid ${showFallback === opt.value ? A.gold : A.border}`,
              background:   showFallback === opt.value ? 'rgba(201,184,142,0.1)' : 'transparent',
              color:        showFallback === opt.value ? A.gold : A.muted,
              fontSize:     11,
              fontWeight:   600,
              fontFamily:   A.font,
              cursor:       'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Preview — actual component, scaled to fit */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${A.border}` }}>
        <div style={{
          padding:       '8px 16px',
          background:    A.bgCard,
          borderBottom:  `1px solid ${A.border}`,
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:         A.faint,
          fontFamily:    A.font,
        }}>
          Preview · {showFallback ? 'Has other programmes' : 'No programmes'}
        </div>

        {/* Scale wrapper — shrinks the full-viewport component to fit the panel */}
        <div style={{ overflow: 'hidden', height: 480 }}>
          <div style={{
            transform:       'scale(0.72)',
            transformOrigin: 'top center',
            height:          '138.9%', // 100 / 0.72 — compensates for scale
            pointerEvents:   'none',   // preview only — clicks disabled
          }}>
            <ProgrammeAccessDenied
              email={mockEmail}
              fallbackProgramme={showFallback ? mockFallback : undefined}
            />
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

// Full-width tabs (no max-width cap on content)
const FULL_WIDTH_TABS: AdminTab[] = ['client-profile']

function AdminShell() {
  const [tab, setTab]         = useState<AdminTab>('programmes')
  const [isMobile, setIsMobile] = useState(false)
  const tabBarRef             = useRef<HTMLDivElement>(null)
  const [underline, setUnderline] = useState({ left: 0, width: 0 })

  // Detect mobile
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Sliding underline
  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    const activeBtn = bar.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)
    if (!activeBtn) return
    setUnderline({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
  }, [tab, isMobile])

  const isFullWidth = FULL_WIDTH_TABS.includes(tab)

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font }}>

      {/* ── Sticky top nav ── */}
      <div style={{
        position:      'sticky',
        top:           0,
        zIndex:        100,
        background:    A.bgCard,
        borderBottom:  `1px solid ${A.border}`,
        backdropFilter:'blur(12px)',
      }}>
        {/* Logo row */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0 clamp(16px, 4vw, 32px)',
          height:         52,
          borderBottom:   isMobile ? `1px solid ${A.border}` : 'none',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
            ambience · Admin
          </div>
          <a
            href='https://programme.ambience.travel'
            style={{ fontSize: 11, color: A.faint, textDecoration: 'none', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
          >
            ← Back to site
          </a>
        </div>

        {/* Tab bar — dropdown on mobile, sliding tabs on desktop */}
        {isMobile ? (
          <div style={{ padding: '10px clamp(16px, 4vw, 32px)' }}>
            <select
              value={tab}
              onChange={e => setTab(e.target.value as AdminTab)}
              style={{
                width:        '100%',
                background:   A.bgInput,
                border:       `1px solid ${A.borderGold}`,
                borderRadius: 10,
                color:        A.gold,
                padding:      '10px 14px',
                fontSize:     13,
                fontWeight:   700,
                fontFamily:   A.font,
                cursor:       'pointer',
                outline:      'none',
                colorScheme:  'dark',
              }}
            >
              {TABS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div
            ref={tabBarRef}
            style={{
              position:   'relative',
              display:    'flex',
              gap:        0,
              padding:    '0 clamp(16px, 4vw, 32px)',
              overflowX:  'auto',
            }}
          >
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  data-tab={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding:    '12px 18px',
                    fontSize:   12,
                    fontWeight: active ? 700 : 500,
                    cursor:     'pointer',
                    fontFamily: A.font,
                    border:     'none',
                    background: 'transparent',
                    color:      active ? A.gold : A.muted,
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s ease',
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              )
            })}
            {/* Sliding gold underline */}
            <div style={{
              position:     'absolute',
              bottom:       0,
              left:         underline.left,
              width:        underline.width,
              height:       2,
              background:   A.gold,
              borderRadius: 2,
              transition:   'left 0.2s cubic-bezier(0.16,1,0.3,1), width 0.2s cubic-bezier(0.16,1,0.3,1)',
              pointerEvents:'none',
            }} />
          </div>
        )}
      </div>

      {/* ── Page content ── */}
      <div style={{
        maxWidth:  isFullWidth ? 1440 : 1100,
        margin:    '0 auto',
        padding:   `clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px)`,
        width:     '100%',
        boxSizing: 'border-box',
      }}>
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
    <div style={{
      minHeight:      '100vh',
      background:     A.bg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: A.text, fontFamily: A.font }}>Access denied.</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: A.gold, textDecoration: 'none', fontFamily: A.font }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}

// ── ProgrammeAdmin — gated entry point ───────────────────────────────────────

export default function ProgrammeAdmin() {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    async function check() {
      const session = await getSession()

      if (!session) {
        setStatus('denied')
        return
      }

      const { data } = await supabase
        .from('global_profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (data?.is_admin === true) {
        setStatus('allowed')
        return
      }

      setStatus('denied')
    }

    check()
  }, [])

  if (status === 'loading') {
    return (
      <div style={{
        minHeight:      '100vh',
        background:     A.bg,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>
          Checking access…
        </div>
      </div>
    )
  }

  if (status === 'denied') return <AccessDenied />

  return <AdminShell />
}