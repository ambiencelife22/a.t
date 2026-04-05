/* ProgrammeAdmin.tsx
 * Admin interface for the ambience.travel programme product.
 * Gated by profiles.is_admin — same column as ambience.SPORTS.
 * Four tabs: Programmes, Welcome Letters, Listings, Property Sections.
 * Dark theme throughout — matches ProgrammeLayout shell.
 * No external dependencies beyond supabase client and landingTypes tokens.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/auth'
import { DARK } from '../../lib/landingTypes'
import { WIDGET } from '../../lib/landingColors'
import type { ListingCategory } from '../../lib/programmeTypes'

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
  padding:      '9px 20px',
  background:   A.gold,
  color:        A.bg,
  border:       'none',
  borderRadius: 10,
  fontSize:     12,
  fontWeight:   700,
  fontFamily:   A.font,
  cursor:       'pointer',
  letterSpacing:'0.04em',
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Admin
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
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
    setTimeout(() => setToast(null), 3000)
  }

  return { toast, showToast }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Programme = {
  id:                string
  url_id:            string
  programme_type:    string
  sub_path:          string
  status:            string
  guest_names:       string
  guest_count:       number
  check_in:          string | null
  check_out:         string | null
  welcome_letter:    string
  property_id:       string | null
  active_listing_ids: string[] | null
  properties:        { id: string; name: string; slug: string } | null
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

type Section = {
  id:         string
  title:      string
  icon:       string
  sort_order: number
  content:    unknown
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
    url_id:         '',
    programme_type: 'stay',
    sub_path:       'stays',
    status:         'confirmed',
    guest_names:    '',
    guest_count:    1,
    check_in:       '',
    check_out:      '',
    welcome_letter: '',
    property_id:    '',
  }

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const [{ data: progs }, { data: props }] = await Promise.all([
      supabase
        .from('programmes')
        .select('id, url_id, programme_type, sub_path, status, guest_names, guest_count, check_in, check_out, welcome_letter, property_id, active_listing_ids, properties(id, name, slug)')
        .order('created_at', { ascending: false }),
      supabase
        .from('properties')
        .select('id, name, slug')
        .order('name'),
    ])

    setProgrammes((progs ?? []) as unknown as Programme[])
    setProperties((props ?? []) as Property[])
    setLoading(false)
  }

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(prog: Programme) {
    setForm({
      url_id:         prog.url_id,
      programme_type: prog.programme_type,
      sub_path:       prog.sub_path,
      status:         prog.status,
      guest_names:    prog.guest_names,
      guest_count:    prog.guest_count,
      check_in:       prog.check_in ?? '',
      check_out:      prog.check_out ?? '',
      welcome_letter: prog.welcome_letter,
      property_id:    prog.property_id ?? '',
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
      url_id:         form.url_id.trim(),
      programme_type: form.programme_type,
      sub_path:       form.sub_path,
      status:         form.status,
      guest_names:    form.guest_names.trim(),
      guest_count:    form.guest_count,
      check_in:       form.check_in || null,
      check_out:      form.check_out || null,
      welcome_letter: form.welcome_letter.trim(),
      property_id:    form.property_id || null,
    }

    if (editing) {
      const { error } = await supabase
        .from('programmes')
        .update(payload)
        .eq('id', editing.id)

      if (error) {
        showToast('Failed to update programme.', 'error')
        setSaving(false)
        return
      }
      showToast('Programme updated.', 'success')
    } else {
      const { error } = await supabase
        .from('programmes')
        .insert(payload)

      if (error) {
        showToast(error.message.includes('unique') ? 'URL ID already exists.' : 'Failed to create programme.', 'error')
        setSaving(false)
        return
      }
      showToast('Programme created.', 'success')
    }

    setSaving(false)
    cancelForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this programme? This cannot be undone.')) return
    const { error } = await supabase.from('programmes').delete().eq('id', id)
    if (error) {
      showToast('Failed to delete programme.', 'error')
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
        <div key={prog.id} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: A.text, fontFamily: A.font }}>{prog.guest_names}</span>
                <StatusBadge status={prog.status} />
              </div>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, marginBottom: 4 }}>
                {prog.properties?.name ?? '—'} · /{prog.sub_path}/{prog.url_id}
              </div>
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                {prog.check_in ? prog.check_in : 'TBA'} → {prog.check_out ? prog.check_out : 'TBA'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(prog)} style={btnGhost}>Edit</button>
              <button onClick={() => handleDelete(prog.id)} style={btnDanger}>Delete</button>
            </div>
          </div>
        </div>
      ))}
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
      .from('programmes')
      .select('id, url_id, guest_names, status, welcome_letter, property_id, programme_type, sub_path, guest_count, check_in, check_out, active_listing_ids, properties(id, name, slug)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
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
      .from('programmes')
      .update({ welcome_letter: letter })
      .eq('id', selected.id)

    if (error) {
      showToast('Failed to save.', 'error')
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

const LISTING_CATEGORIES: ListingCategory[] = ['lunch', 'dinner', 'takeaway', 'activity', 'shopping']

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
      .from('properties')
      .select('id, name, slug')
      .order('name')
      .then(({ data }) => {
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
    const { data } = await supabase
      .from('property_listings')
      .select('id, name, category, genre, address, website, hours, note, favourite, property_id')
      .eq('property_id', selectedProp)
      .order('category')
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
      const { error } = await supabase.from('property_listings').update(payload).eq('id', editing.id)
      if (error) { showToast('Failed to update listing.', 'error'); setSaving(false); return }
      showToast('Listing updated.', 'success')
    } else {
      const { error } = await supabase.from('property_listings').insert(payload)
      if (error) { showToast('Failed to create listing.', 'error'); setSaving(false); return }
      showToast('Listing created.', 'success')
    }

    setSaving(false)
    cancelForm()
    loadListings()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this listing?')) return
    const { error } = await supabase.from('property_listings').delete().eq('id', id)
    if (error) { showToast('Failed to delete.', 'error'); return }
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
              <input style={inputStyle} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder='e.g. Mon–Sat 9:00–21:30' />
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
  const [saving, setSaving]         = useState(false)
  const { toast, showToast }        = useToast()

  useEffect(() => {
    supabase
      .from('properties')
      .select('id, name, slug')
      .order('name')
      .then(({ data }) => {
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
    const { data } = await supabase
      .from('property_sections')
      .select('id, title, icon, sort_order, content, property_id')
      .eq('property_id', selectedProp)
      .order('sort_order')
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

  async function handleSaveSection() {
    if (!editing) return
    if (!editTitle.trim()) { showToast('Title is required.', 'error'); return }
    setSaving(true)

    const { error } = await supabase
      .from('property_sections')
      .update({ title: editTitle.trim(), icon: editIcon.trim() })
      .eq('id', editing.id)

    if (error) { showToast('Failed to save.', 'error'); setSaving(false); return }

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
      supabase.from('property_sections').update({ sort_order: swap.sort_order }).eq('id', section.id),
      supabase.from('property_sections').update({ sort_order: section.sort_order }).eq('id', swap.id),
    ])

    loadSections()
  }

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

      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: '4px 0' }}>
        Reorder and rename sections. To edit block content, update the seed SQL or use the Supabase editor directly.
      </div>

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {!loading && sections.map((section, idx) => (
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
                  disabled={idx === sections.length - 1}
                  style={{ background: 'none', border: 'none', color: idx === sections.length - 1 ? A.faint : A.muted, cursor: idx === sections.length - 1 ? 'default' : 'pointer', fontSize: 11, padding: '2px 4px', fontFamily: A.font }}
                >↓</button>
              </div>
              <span style={{ fontSize: 18 }}>{section.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: A.text, fontFamily: A.font }}>{section.title}</div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Sort order: {section.sort_order}</div>
              </div>
              <button onClick={() => openEdit(section)} style={btnGhost}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Admin shell ───────────────────────────────────────────────────────────────

type AdminTab = 'programmes' | 'letters' | 'listings' | 'sections'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'programmes', label: 'Programmes' },
  { id: 'letters',    label: 'Welcome Letters' },
  { id: 'listings',   label: 'Listings' },
  { id: 'sections',   label: 'Property Sections' },
]

function AdminShell() {
  const [tab, setTab] = useState<AdminTab>('programmes')

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: A.font }}>
      {/* Top nav */}
      <div style={{
        position:      'sticky',
        top:           0,
        zIndex:        100,
        background:    A.bgCard,
        borderBottom:  `1px solid ${A.border}`,
        padding:       '0 32px',
        display:       'flex',
        alignItems:    'center',
        gap:           32,
        height:        56,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, letterSpacing: '0.06em' }}>
          ambience.TRAVEL · Admin
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding:      '6px 16px',
                borderRadius: 8,
                border:       'none',
                background:   tab === t.id ? 'rgba(201,184,142,0.12)' : 'transparent',
                color:        tab === t.id ? A.gold : A.muted,
                fontSize:     12,
                fontWeight:   tab === t.id ? 700 : 500,
                cursor:       'pointer',
                fontFamily:   A.font,
                transition:   'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <a
            href='https://programme.ambience.travel'
            style={{ fontSize: 11, color: A.faint, textDecoration: 'none', letterSpacing: '0.04em' }}
          >
            ← Back to site
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px' }}>
        {tab === 'programmes' && <ProgrammesTab />}
        {tab === 'letters'    && <WelcomeLettersTab />}
        {tab === 'listings'   && <ListingsTab />}
        {tab === 'sections'   && <PropertySectionsTab />}
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
        .from('profiles')
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