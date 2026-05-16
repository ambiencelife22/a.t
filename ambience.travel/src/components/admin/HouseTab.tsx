/* HouseTab.tsx
 * ambience.HOUSE — private client intelligence platform.
 *
 * Mobile-responsive: useWindowWidth hook drives layout decisions.
 *   < 768px (mobile):
 *     - Two-panel collapses to single column
 *     - Sidebar nav becomes horizontal scrollable pill bar
 *     - People + dining avoids render inline above section content
 *     - All grid forms collapse to single column
 *     - Preference rows stack vertically
 *     - Category tabs scroll horizontally
 *     - Person modal uses full-screen treatment
 *   >= 768px (desktop): unchanged two-panel layout
 *
 * Last updated: S41 — Destinations + Contacts sections added.
 * Prior: S40D — mobile-responsive layout pass.
 * Prior: S40D — client summary block, expandable overview categories,
 *   sidebar pref snapshots removed.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { A } from '../../lib/adminTokens'
import { useToast } from '../../lib/ToastContext'
import {
  inputStyle, textareaStyle,
  btnPrimary as btnP, btnGhost as btnG, btnDanger as btnD,
} from '../../lib/adminStyles'
import { Field, SectionLabel, CopyButton } from './adminUi'
import {
  fetchHouses, fetchHouseById,
  fetchPeopleForHouse, fetchPreferencesForHouse,
  fetchDiningHistoryForHouse, fetchPPDForHouse,
  fetchDestinationsForHouse, fetchContactsForHouse,
  fetchProfileForPerson, updateHouse,
  createPerson, updatePerson, deletePerson,
  createPreference, updatePreference, deletePreference,
  createDiningEntry, updateDiningEntry, deleteDiningEntry,
  createDestination, updateDestination, deleteDestination,
  createContact, updateContact, deleteContact,
  createPPDPeopleEntry, deletePPDPeopleEntry,
  type House, type HousePerson, type HousePreference,
  type HouseDiningEntry, type HouseDestination, type HouseContact,
  type PPDPeopleEntry, type HousePersonProfile,
  type PrefCategory, type PrefConfidence, type DiningStatus,
  type DestinationStatus, type DestinationTripType, type ContactType,
} from '../../lib/adminHouseQueries'

// ── Responsive hook ───────────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  useEffect(() => {
    function handle() { setWidth(window.innerWidth) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return width
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const CONF_COLOR: Record<PrefConfidence, string> = {
  confirmed:  '#4ade80',
  to_confirm: '#fbbf24',
  outdated:   '#f87171',
}

const STATUS: Record<DiningStatus, { text: string; label: string }> = {
  favorite: { text: '#D8B56A', label: 'Favourite' },
  visited:  { text: '#4ade80', label: 'Visited'   },
  avoid:    { text: '#f87171', label: 'Avoid'      },
  to_try:   { text: '#93c5fd', label: 'To Try'     },
}

const DEST_STATUS_COLOR: Record<DestinationStatus, string> = {
  visited: '#4ade80',
  planned: '#93c5fd',
  avoided: '#f87171',
}

const DEST_STATUS_LABEL: Record<DestinationStatus, string> = {
  visited: 'Visited',
  planned: 'Planned',
  avoided: 'Avoided',
}

const DESIG_COLOR: Record<string, string> = {
  HRH: '#c084fc', HH: '#93c5fd', VVIP: '#D8B56A',
}

const PREF_CATEGORIES: PrefCategory[] = [
  'Dining', 'Accommodation', 'Experiences', 'Flight',
  'Beverage', 'Allergies', 'Service', 'Misc',
]

const PREF_KEYS: Record<string, string[]> = {
  Dining:        ['Preferred Cuisine', 'Avoid Cuisine', 'Dining Style', 'Preferred Meal Time', 'Tasting Menus', 'Private Chef', 'Food Delivery', 'Lunch Preference', 'Dinner Preference', 'Family Dining Note', 'Couple Dining Note', 'Restaurant Atmosphere', 'Price Level', 'Dietary Note'],
  Accommodation: ['Preferred Brand', 'Avoid Brand', 'Room Configuration', 'Room Size', 'Bed Type', 'Bath Preference', 'Floor Preference', 'View Preference', 'Early Check-in', 'Late Check-out', 'Welcome Amenity', 'In-Room Amenity', 'Eco Preference', 'Resort Style', 'City Property Style', 'Family Property Note', 'Couple Property Note', 'Avoid Property'],
  Experiences:   ['Sport', 'Fitness', 'Spa Treatment', 'Wellness Retreat', 'Yoga / Pilates', 'Watersports', 'Tennis', 'Swimming', 'Snorkeling', 'Skiing', 'Art Interest', 'Show / Performance', 'Cultural Interest', 'Children Activity', 'Family Activity', 'Adventure Level', 'Health Treatment', 'Medical Concierge Note'],
  Flight:        ['Preferred Class', 'Seat Preference', 'Preferred Airline', 'Avoided Airline', 'Preferred Airport', 'Private Aviation', 'PJ Provider Preference', 'PJ Catering Note', 'Meal Code', 'Lounge Access', 'Max Layover', 'Routing Note', 'Frequent Flyer Program', 'Known Traveller Number', 'Global Entry', 'TSA PreCheck'],
  Beverage:      ['Water Preference', 'Coffee', 'Tea', 'Wine', 'Champagne', 'Cocktails', 'Spirits', 'Non-Alcoholic', 'Minibar Note', 'Private Jet Beverage', 'Cellar Note'],
  Allergies:     ['Nut Allergy', 'Shellfish Allergy', 'Dairy Intolerance', 'Gluten Intolerance', 'Egg Allergy', 'Soy Allergy', 'Fish Allergy', 'Wheat Allergy', 'Sesame Allergy', 'Sulphite Sensitivity', 'Medical Dietary Requirement', 'Epipen', 'Allergy Severity Note'],
  Service:       ['Salutation', 'Communication Style', 'Response Time Expectation', 'Point of Contact', 'Privacy Level', 'Photography Policy', 'Media Policy', 'Security Note', 'Gift Preference', 'Flowers', 'Home Scent', 'Fragrance Sensitivity', 'Anniversary', 'Occasion Note', 'VIP Protocol Note', 'Do Not Repeat', 'Staff Note'],
  Misc:          ['General Note', 'To Confirm', 'Open Item'],
}

const PPD_KEYS = [
  'Date of Birth', 'Nationality', 'Passport Number', 'Passport Country',
  'Passport Expiry', 'Passport Issue Date', 'Known Traveller Number',
  'Global Entry', 'TSA PreCheck', 'Visa Notes',
  'Frequent Flyer Program', 'Frequent Flyer Number',
  'Hotel Loyalty Program', 'Hotel Loyalty Number',
  'Mobile', 'Emergency Contact Name', 'Emergency Contact Mobile',
  'Home Address', 'Dietary Medical Note',
]

const ROLES = ['principal', 'spouse', 'child', 'staff', 'advisor', 'guest']

const DEST_STATUSES: DestinationStatus[] = ['visited', 'planned', 'avoided']
const DEST_TRIP_TYPES: DestinationTripType[] = ['family', 'couple', 'solo', 'business', 'other']
const CONTACT_TYPES: ContactType[] = ['pa', 'driver', 'fixer', 'medical', 'security', 'concierge', 'other']

function SourceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
      <option value='direct'>Direct</option>
      <option value='inferred'>Inferred</option>
      <option value='staff_note'>Staff Note</option>
      <option value='profile_summary'>Profile Summary</option>
      <option value='trip'>Trip</option>
      <option value='observation'>Observation</option>
    </select>
  )
}

function formatDOB(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}

function PPDValueInput({ dataKey, value, onChange }: { dataKey: string; value: string; onChange: (v: string) => void }) {
  if (dataKey === 'Date of Birth') {
    const toISO = (stored: string): string => {
      if (!stored) return ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored
      const d = new Date(stored)
      if (isNaN(d.getTime())) return ''
      return d.toISOString().slice(0, 10)
    }
    return (
      <input
        type='date'
        style={{ ...inputStyle, colorScheme: 'dark' }}
        value={toISO(value)}
        onChange={e => onChange(e.target.value ? formatDOB(e.target.value) : '')}
        autoFocus
      />
    )
  }
  return (
    <input style={inputStyle} placeholder='Enter value…' value={value} onChange={e => onChange(e.target.value)} autoComplete='off' autoFocus />
  )
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── Person modal ──────────────────────────────────────────────────────────────

function PersonModal({ person, houseId, allPreferences, allPPD, onClose, onReload }: {
  person: HousePerson; houseId: string
  allPreferences: HousePreference[]; allPPD: PPDPeopleEntry[]
  onClose: () => void; onReload: () => void
}) {
  const { toast }   = useToast()
  const mobile      = useWindowWidth() < 768
  const [tab, setTab] = useState<'identity' | 'preferences' | 'sensitive' | 'profile'>('identity')

  const [identityDraft, setIdentityDraft]   = useState({ member_ref: person.member_ref, role: person.role, notes: person.notes ?? '' })
  const [identitySaving, setIdentitySaving] = useState(false)
  const [profile, setProfile]               = useState<HousePersonProfile | null | 'loading'>('loading')
  const [profileLoaded, setProfileLoaded]   = useState(false)

  const personPrefs = useMemo(() => allPreferences.filter(p => p.person_id === person.id), [allPreferences, person.id])
  const personPPD   = useMemo(() => allPPD.filter(p => p.person_id === person.id), [allPPD, person.id])

  const [addingPref, setAddingPref] = useState(false)
  const [prefCat, setPrefCat]       = useState<PrefCategory>('Dining')
  const [prefDraft, setPrefDraft]   = useState({ pref_key: '', pref_value: '', source: 'direct', confidence: 'confirmed' as PrefConfidence })
  const [prefSaving, setPrefSaving] = useState(false)

  const [addingPPD, setAddingPPD] = useState(false)
  const [ppdDraft, setPpdDraft]   = useState({ data_key: '', data_value: '', access_note: '' })
  const [ppdSaving, setPpdSaving] = useState(false)

  useEffect(() => {
    if (tab === 'profile' && !profileLoaded) {
      setProfileLoaded(true)
      fetchProfileForPerson(person.id).then(p => setProfile(p)).catch(() => setProfile(null))
    }
  }, [tab, profileLoaded, person.id])

  async function saveIdentity() {
    if (!identityDraft.member_ref.trim()) return
    setIdentitySaving(true)
    try {
      await updatePerson(person.id, { member_ref: identityDraft.member_ref.trim(), role: identityDraft.role, notes: identityDraft.notes.trim() || null })
      toast.success('Saved.'); await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setIdentitySaving(false)
  }

  async function deleteSelf() {
    if (!window.confirm(`Remove ${person.member_ref} from this household?`)) return
    try { await deletePerson(person.id); toast.success('Removed.'); onClose(); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function addPref() {
    if (!prefDraft.pref_key.trim() || !prefDraft.pref_value.trim()) return
    setPrefSaving(true)
    try {
      await createPreference(houseId, person.id, prefCat, prefDraft.pref_key.trim(), prefDraft.pref_value.trim(), null, prefDraft.source, prefDraft.confidence)
      toast.success('Added.'); setAddingPref(false); setPrefDraft({ pref_key: '', pref_value: '', source: 'direct', confidence: 'confirmed' }); await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setPrefSaving(false)
  }

  async function removePref(id: string) {
    try { await deletePreference(id); toast.success('Removed.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function confirmPref(p: HousePreference) {
    try { await updatePreference(p.id, { confidence: 'confirmed' }); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function addPPD() {
    if (!ppdDraft.data_key.trim() || !ppdDraft.data_value.trim()) return
    setPpdSaving(true)
    try {
      await createPPDPeopleEntry(houseId, person.id, ppdDraft.data_key.trim(), ppdDraft.data_value.trim(), ppdDraft.access_note.trim() || null)
      toast.success('Added.'); setAddingPPD(false); setPpdDraft({ data_key: '', data_value: '', access_note: '' }); await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setPpdSaving(false)
  }

  async function removePPD(id: string) {
    if (!window.confirm('Permanently delete this sensitive record?')) return
    try { await deletePPDPeopleEntry(id); toast.success('Deleted.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const tabStyle = (t: typeof tab): React.CSSProperties => ({
    padding: mobile ? '8px 12px' : '7px 14px', whiteSpace: 'nowrap',
    background: tab === t ? 'rgba(216,181,106,0.10)' : 'transparent',
    color:      tab === t ? A.gold : A.muted,
    border:     tab === t ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
    borderRadius: 8, fontSize: 11, fontWeight: tab === t ? 700 : 500,
    fontFamily: A.font, cursor: 'pointer', flexShrink: 0,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.80)', display: 'flex', alignItems: mobile ? 'flex-end' : 'flex-start', justifyContent: 'center', padding: mobile ? 0 : '32px 24px', overflowY: mobile ? 'hidden' : 'auto' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: mobile ? '100%' : 'min(680px, 100%)',
          maxHeight: mobile ? '92vh' : 'none',
          background: A.bg, border: `1px solid ${A.border}`,
          borderRadius: mobile ? '14px 14px 0 0' : 14,
          padding: mobile ? '20px 16px' : 24,
          display: 'flex', flexDirection: 'column', gap: 14,
          overflowY: 'auto',
        }}
      >
        {mobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: A.border, margin: '-8px auto 0' }} />}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 4 }}>Member</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>{person.member_ref}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, textTransform: 'capitalize', marginTop: 2 }}>{person.role}</div>
          </div>
          <button onClick={onClose} style={btnG}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, borderBottom: `1px solid ${A.border}`, scrollbarWidth: 'none' }}>
          <button onClick={() => setTab('identity')}    style={tabStyle('identity')}>Identity</button>
          <button onClick={() => setTab('preferences')} style={tabStyle('preferences')}>Preferences {personPrefs.length > 0 && <span style={{ opacity: 0.6 }}>({personPrefs.length})</span>}</button>
          <button onClick={() => setTab('sensitive')}   style={tabStyle('sensitive')}>Sensitive {personPPD.length > 0 && <span style={{ opacity: 0.6 }}>({personPPD.length})</span>}</button>
          <button onClick={() => setTab('profile')}     style={tabStyle('profile')}>Profile</button>
        </div>

        {tab === 'identity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Field label='Reference Code'><input style={inputStyle} value={identityDraft.member_ref} onChange={e => setIdentityDraft(d => ({ ...d, member_ref: e.target.value }))} /></Field>
              <Field label='Role'>
                <select style={inputStyle} value={identityDraft.role} onChange={e => setIdentityDraft(d => ({ ...d, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{capitalize(r)}</option>)}
                </select>
              </Field>
            </div>
            <Field label='Notes (internal)'><textarea style={{ ...textareaStyle, minHeight: 72 }} value={identityDraft.notes} onChange={e => setIdentityDraft(d => ({ ...d, notes: e.target.value }))} placeholder='Any notes about this person…' /></Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${A.border}`, flexWrap: 'wrap', gap: 8 }}>
              <button onClick={deleteSelf} style={{ ...btnD, border: '1px solid rgba(248,113,113,0.3)', padding: '5px 12px' }}>Remove from household</button>
              <button onClick={saveIdentity} style={{ ...btnP, opacity: identitySaving ? 0.5 : 1 }} disabled={identitySaving}>{identitySaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}

        {tab === 'preferences' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>Preferences for {person.member_ref} specifically.</div>
              {!addingPref && <button onClick={() => setAddingPref(true)} style={btnP}>+ Add</button>}
            </div>
            {addingPref && (
              <div style={{ padding: '12px 14px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label='Category'>
                  <select style={inputStyle} value={prefCat} onChange={e => { setPrefCat(e.target.value as PrefCategory); setPrefDraft(d => ({ ...d, pref_key: '' })) }}>
                    {PREF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label='Key'>
                  <select style={inputStyle} value={prefDraft.pref_key} onChange={e => setPrefDraft(d => ({ ...d, pref_key: e.target.value }))}>
                    <option value=''>Select…</option>
                    {(PREF_KEYS[prefCat] ?? []).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label='Value'><input style={inputStyle} placeholder='Value…' value={prefDraft.pref_value} onChange={e => setPrefDraft(d => ({ ...d, pref_value: e.target.value }))} autoFocus /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <Field label='Confidence'>
                    <select style={inputStyle} value={prefDraft.confidence} onChange={e => setPrefDraft(d => ({ ...d, confidence: e.target.value as PrefConfidence }))}>
                      <option value='confirmed'>Confirmed</option>
                      <option value='to_confirm'>To Confirm</option>
                      <option value='outdated'>Outdated</option>
                    </select>
                  </Field>
                  <Field label='Source'><SourceSelect value={prefDraft.source} onChange={(v: string) => setPrefDraft(d => ({ ...d, source: v }))} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setAddingPref(false)} style={btnG}>Cancel</button>
                  <button onClick={addPref} style={{ ...btnP, opacity: prefSaving ? 0.5 : 1 }} disabled={prefSaving}>Add</button>
                </div>
              </div>
            )}
            {personPrefs.length === 0 ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No person-specific preferences. Household-level preferences apply.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {personPrefs.map(p => (
                  <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', opacity: p.confidence === 'outdated' ? 0.55 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.category} · {p.pref_key}</div>
                      <div style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600, marginTop: 2 }}>{p.pref_value}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {p.confidence !== 'confirmed' && <button onClick={() => confirmPref(p)} style={{ ...btnG, padding: '3px 7px', fontSize: 10, color: '#4ade80', borderColor: '#4ade8030' }}>✓</button>}
                      <button onClick={() => removePref(p.id)} style={btnD}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'sensitive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span>
              <span style={{ fontSize: 11, color: '#f87171', fontFamily: A.font }}>Sensitive data. Strict discretion required.</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {!addingPPD && <button onClick={() => setAddingPPD(true)} style={btnP}>+ Add Record</button>}
            </div>
            {addingPPD && (
              <div style={{ padding: '12px 14px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label='Field'>
                  <select style={inputStyle} value={ppdDraft.data_key} onChange={e => setPpdDraft(d => ({ ...d, data_key: e.target.value }))}>
                    <option value=''>Select…</option>
                    {PPD_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label='Value'><PPDValueInput dataKey={ppdDraft.data_key} value={ppdDraft.data_value} onChange={v => setPpdDraft(d => ({ ...d, data_value: v }))} /></Field>
                <Field label='Access Note (optional)'><input style={inputStyle} placeholder='Who has access…' value={ppdDraft.access_note} onChange={e => setPpdDraft(d => ({ ...d, access_note: e.target.value }))} /></Field>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setAddingPPD(false)} style={btnG}>Cancel</button>
                  <button onClick={addPPD} style={{ ...btnP, opacity: ppdSaving ? 0.5 : 1 }} disabled={ppdSaving}>Add</button>
                </div>
              </div>
            )}
            {personPPD.length === 0 ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No sensitive records for this person.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {personPPD.map(entry => (
                  <div key={entry.id} style={{ padding: '10px 14px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.12)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font }}>{entry.data_key}</div>
                      <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>{entry.data_value}</div>
                      {entry.access_note && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2, fontStyle: 'italic' }}>{entry.access_note}</div>}
                    </div>
                    <CopyButton value={entry.data_value} />
                    <button onClick={() => removePPD(entry.id)} style={btnD}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {profile === 'loading' ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Checking…</div>
            ) : profile === null ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: A.faint }} />
                  <span style={{ fontSize: 13, color: A.muted, fontFamily: A.font }}>No linked account</span>
                </div>
                <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, lineHeight: 1.6 }}>
                  {person.member_ref} does not have a linked ambience login. Profile auto-links via <span style={{ fontFamily: 'DM Mono, monospace' }}>global_profiles.person_id</span> when they sign up.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                  <span style={{ fontSize: 13, color: '#4ade80', fontFamily: A.font, fontWeight: 600 }}>Account linked</span>
                </div>
                <div style={{ padding: '12px 16px', background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>Display name</div>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{profile.display_name ?? '(not set)'}</div>
                </div>
                <div style={{ padding: '12px 16px', background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>Profile UUID</div>
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>{profile.id}</div>
                  </div>
                  <CopyButton value={profile.id} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Household list ────────────────────────────────────────────────────────────

function HouseList({ onSelect }: { onSelect: (h: House) => void }) {
  const [houses, setHouses]   = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const { toast }             = useToast()

  useEffect(() => {
    fetchHouses().then(setHouses).catch(e => toast.error(e instanceof Error ? e.message : 'Failed')).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return houses
    return houses.filter(h =>
      h.display_name.toLowerCase().includes(q) ||
      h.a_house_id.toLowerCase().includes(q) ||
      (h.summary ?? '').toLowerCase().includes(q) ||
      (h.service_style_notes ?? '').toLowerCase().includes(q)
    )
  }, [houses, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 6 }}>ambience · HOUSE</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em', marginBottom: 3 }}>Client Households</div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>{houses.length} household{houses.length !== 1 ? 's' : ''}</div>
      </div>
      <input style={{ ...inputStyle, fontSize: 14, padding: '12px 14px' }} placeholder='Search…' value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      {loading ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No results.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(h => <HouseCard key={h.id} house={h} onClick={() => onSelect(h)} />)}
        </div>
      )}
    </div>
  )
}

function HouseCard({ house, onClick }: { house: House; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '16px 18px 14px', background: hov ? '#1a1f1c' : A.bgCard, border: `1px solid ${hov ? A.gold + '50' : A.border}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.12s ease', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>{house.display_name}</span>
          {house.designation && (
            <span style={{ padding: '1px 7px', borderRadius: 5, background: (DESIG_COLOR[house.designation] ?? A.gold) + '18', border: `1px solid ${(DESIG_COLOR[house.designation] ?? A.gold)}35`, color: DESIG_COLOR[house.designation] ?? A.gold, fontSize: 9, fontWeight: 700, fontFamily: A.font, letterSpacing: '0.1em' }}>{house.designation}</span>
          )}
          <span style={{ fontSize: 9, color: house.status === 'active' ? '#4ade80' : A.faint, fontFamily: A.font, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{house.status}</span>
        </div>
        <span style={{ color: A.gold, opacity: hov ? 0.9 : 0.25, transition: 'opacity 0.12s', fontSize: 14, flexShrink: 0 }}>→</span>
      </div>
      {(house.summary || house.service_style_notes) && (
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.5, borderLeft: `2px solid ${A.gold}35`, paddingLeft: 10 }}>
          {(house.summary || house.service_style_notes)!.slice(0, 140)}{((house.summary || house.service_style_notes)!.length > 140) ? '…' : ''}
        </div>
      )}
      <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{house.a_house_id}</div>
    </div>
  )
}

// ── House detail ──────────────────────────────────────────────────────────────

type Section = 'overview' | 'preferences' | 'dining' | 'destinations' | 'contacts' | 'sensitive' | 'notes'

interface AllData {
  people:       HousePerson[]
  preferences:  HousePreference[]
  dining:       HouseDiningEntry[]
  destinations: HouseDestination[]
  contacts:     HouseContact[]
  ppd:          PPDPeopleEntry[]
}

function HouseDetail({ house: init, onBack }: { house: House; onBack: () => void }) {
  const mobile                    = useWindowWidth() < 768
  const [house, setHouse]         = useState<House>(init)
  const [section, setSection]     = useState<Section>('overview')
  const [q, setQ]                 = useState('')
  const [data, setData]           = useState<AllData>({ people: [], preferences: [], dining: [], destinations: [], contacts: [], ppd: [] })
  const [loading, setLoading]     = useState(true)
  const [modalPerson, setModalPerson] = useState<HousePerson | null>(null)
  const { toast }                 = useToast()
  const searchRef                 = useRef<HTMLInputElement>(null)
  const [addingPerson, setAddingPerson] = useState(false)
  const [pd, setPd]               = useState({ member_ref: '', role: 'principal' })
  const [addSaving, setAddSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    try {
      const [people, preferences, dining, destinations, contacts, ppdResponse] = await Promise.all([
        fetchPeopleForHouse(house.id),
        fetchPreferencesForHouse(house.id),
        fetchDiningHistoryForHouse(house.id),
        fetchDestinationsForHouse(house.id),
        fetchContactsForHouse(house.id),
        fetchPPDForHouse(house.id),
      ])
      setData({ people, preferences, dining, destinations, contacts, ppd: ppdResponse.people })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load') }
    setLoading(false)
  }

  async function reloadHouse() {
    const h = await fetchHouseById(house.id).catch(() => null)
    if (h) setHouse(h)
  }

  useEffect(() => { loadAll() }, [house.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName ?? '')) {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const personRef = (id: string | null) => id ? (data.people.find(p => p.id === id)?.member_ref ?? null) : null

  const searchResults = useMemo(() => {
    const query = q.toLowerCase().trim()
    if (!query) return null
    return {
      preferences:  data.preferences.filter(p => p.pref_key.toLowerCase().includes(query) || p.pref_value.toLowerCase().includes(query)),
      dining:       data.dining.filter(d => d.restaurant_name.toLowerCase().includes(query) || (d.city ?? '').toLowerCase().includes(query)),
      destinations: data.destinations.filter(d => d.destination_name.toLowerCase().includes(query) || (d.country ?? '').toLowerCase().includes(query)),
      contacts:     data.contacts.filter(c => c.name.toLowerCase().includes(query) || (c.role ?? '').toLowerCase().includes(query)),
      ppd:          data.ppd.filter(p => p.data_key.toLowerCase().includes(query) || p.data_value.toLowerCase().includes(query)),
    }
  }, [q, data])

  const avoidDining = data.dining.filter(d => d.status === 'avoid')

  async function addPerson() {
    if (!pd.member_ref.trim()) return
    setAddSaving(true)
    try {
      await createPerson(house.id, pd.member_ref.trim(), pd.role, null)
      toast.success('Added.'); setAddingPerson(false); setPd({ member_ref: '', role: 'principal' }); await loadAll()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setAddSaving(false)
  }

  const NAV: Array<{ id: Section; label: string; count?: number }> = [
    { id: 'overview',      label: 'Overview' },
    { id: 'preferences',   label: 'Preferences',  count: data.preferences.length },
    { id: 'dining',        label: 'Dining',        count: data.dining.length },
    { id: 'destinations',  label: 'Destinations',  count: data.destinations.length },
    { id: 'contacts',      label: 'Contacts',      count: data.contacts.length },
    { id: 'sensitive',     label: 'Sensitive',     count: data.ppd.length },
    { id: 'notes',         label: 'Notes' },
  ]

  const PeopleBlock = (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionLabel label='Household' />
        {!addingPerson && <button onClick={() => setAddingPerson(true)} style={{ ...btnG, padding: '2px 8px', fontSize: 10, marginTop: -6 }}>+</button>}
      </div>
      {data.people.length === 0 && !addingPerson && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No members yet.</div>}
      {data.people.map(p => (
        <div key={p.id} onClick={() => setModalPerson(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', padding: '4px 0' }} title='Click to view / edit'>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${A.gold}18`, border: `1px solid ${A.gold}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: A.gold, fontFamily: A.font, flexShrink: 0 }}>
            {p.member_ref.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>{p.member_ref}</div>
            <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, textTransform: 'capitalize' }}>{p.role}</div>
          </div>
          <span style={{ fontSize: 12, color: A.faint, opacity: 0.5 }}>›</span>
        </div>
      ))}
      {addingPerson && (
        <div style={{ marginTop: 6, padding: '10px', background: A.bgInput, borderRadius: 8, border: `1px solid ${A.gold}40`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} placeholder='J, K, Child 1…' value={pd.member_ref} onChange={e => setPd(d => ({ ...d, member_ref: e.target.value }))} autoFocus onKeyDown={e => { if (e.key === 'Enter') addPerson() }} />
          <select style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} value={pd.role} onChange={e => setPd(d => ({ ...d, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{capitalize(r)}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAddingPerson(false); setPd({ member_ref: '', role: 'principal' }) }} style={btnG}>Cancel</button>
            <button onClick={addPerson} style={{ ...btnP, opacity: addSaving ? 0.5 : 1 }} disabled={addSaving}>Add</button>
          </div>
        </div>
      )}
    </div>
  )

  const AvoidBlock = avoidDining.length > 0 ? (
    <div style={{ background: '#2a161630', border: '1px solid #f8717125', borderRadius: 10, padding: '12px 14px' }}>
      <SectionLabel label='Dining Avoids' color='#f87171' />
      {avoidDining.map(d => (
        <div key={d.id} style={{ fontSize: 11, color: '#f87171', fontFamily: A.font, marginBottom: 4, opacity: 0.85 }}>
          {d.restaurant_name}{d.city && <span style={{ opacity: 0.6 }}> · {d.city}</span>}
        </div>
      ))}
    </div>
  ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {modalPerson && (
        <PersonModal
          person={modalPerson} houseId={house.id}
          allPreferences={data.preferences} allPPD={data.ppd}
          onClose={() => setModalPerson(null)} onReload={loadAll}
        />
      )}

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={onBack} style={{ ...btnG, padding: '5px 10px', fontSize: 11, flexShrink: 0 }}>← All</button>
          <span style={{ fontSize: mobile ? 18 : 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{house.display_name}</span>
          {house.designation && (
            <span style={{ padding: '2px 7px', borderRadius: 5, background: (DESIG_COLOR[house.designation] ?? A.gold) + '18', border: `1px solid ${(DESIG_COLOR[house.designation] ?? A.gold)}35`, color: DESIG_COLOR[house.designation] ?? A.gold, fontSize: 9, fontWeight: 700, fontFamily: A.font, letterSpacing: '0.1em', flexShrink: 0 }}>{house.designation}</span>
          )}
        </div>
        <div style={{ position: 'relative', flexShrink: 0, width: mobile ? '100%' : 'auto' }}>
          <input ref={searchRef} style={{ ...inputStyle, width: mobile ? '100%' : 220, paddingRight: 30, boxSizing: 'border-box' }} placeholder='Search… (/)' value={q} onChange={e => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: A.faint, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>}
        </div>
      </div>

      {mobile && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 12, scrollbarWidth: 'none' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)} style={{
              padding: '8px 14px', whiteSpace: 'nowrap', flexShrink: 0,
              background: section === n.id ? 'rgba(216,181,106,0.10)' : 'transparent',
              color:      section === n.id ? A.gold : A.muted,
              border:     section === n.id ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
              borderRadius: 20, fontSize: 12, fontWeight: section === n.id ? 700 : 500,
              fontFamily: A.font, cursor: 'pointer',
            }}>
              {n.label}{n.count ? ` ${n.count}` : ''}
            </button>
          ))}
        </div>
      )}

      {searchResults && <SearchResults results={searchResults} personRef={personRef} onClose={() => setQ('')} />}

      {!searchResults && (
        mobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
            ) : (
              <>
                {PeopleBlock}
                {AvoidBlock}
                {section === 'overview'     && <OverviewSection      house={house} data={data} onSaved={reloadHouse} onReload={loadAll} mobile={true} />}
                {section === 'preferences'  && <PreferencesSection   data={data}   houseId={house.id} onReload={loadAll} personRef={personRef} mobile={true} />}
                {section === 'dining'       && <DiningSection        data={data}   houseId={house.id} onReload={loadAll} mobile={true} />}
                {section === 'destinations' && <DestinationsSection  data={data}   houseId={house.id} onReload={loadAll} mobile={true} />}
                {section === 'contacts'     && <ContactsSection      data={data}   houseId={house.id} onReload={loadAll} mobile={true} />}
                {section === 'sensitive'    && <SensitiveSection     data={data}   houseId={house.id} onReload={loadAll} personRef={personRef} />}
                {section === 'notes'        && <NotesSection         house={house} onSaved={reloadHouse} />}
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 210, flexShrink: 0, position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {NAV.map((n, i) => (
                  <button key={n.id} onClick={() => setSection(n.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 14px', textAlign: 'left',
                    background: section === n.id ? 'rgba(216,181,106,0.08)' : 'transparent',
                    borderLeft: section === n.id ? `2px solid ${A.gold}` : '2px solid transparent',
                    border: 'none', borderBottom: i < NAV.length - 1 ? `1px solid ${A.border}` : 'none',
                    color: section === n.id ? A.gold : A.muted,
                    fontSize: 12, fontWeight: section === n.id ? 700 : 500,
                    fontFamily: A.font, cursor: 'pointer',
                  }}>
                    <span>{n.label}</span>
                    {n.count !== undefined && n.count > 0 && <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{n.count}</span>}
                  </button>
                ))}
              </div>
              {PeopleBlock}
              {AvoidBlock}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
              ) : (
                <>
                  {section === 'overview'     && <OverviewSection      house={house} data={data} onSaved={reloadHouse} onReload={loadAll} mobile={false} />}
                  {section === 'preferences'  && <PreferencesSection   data={data}   houseId={house.id} onReload={loadAll} personRef={personRef} mobile={false} />}
                  {section === 'dining'       && <DiningSection        data={data}   houseId={house.id} onReload={loadAll} mobile={false} />}
                  {section === 'destinations' && <DestinationsSection  data={data}   houseId={house.id} onReload={loadAll} mobile={false} />}
                  {section === 'contacts'     && <ContactsSection      data={data}   houseId={house.id} onReload={loadAll} mobile={false} />}
                  {section === 'sensitive'    && <SensitiveSection     data={data}   houseId={house.id} onReload={loadAll} personRef={personRef} />}
                  {section === 'notes'        && <NotesSection         house={house} onSaved={reloadHouse} />}
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ── Search results ────────────────────────────────────────────────────────────

function SearchResults({ results, personRef, onClose }: {
  results: {
    preferences:  HousePreference[]
    dining:       HouseDiningEntry[]
    destinations: HouseDestination[]
    contacts:     HouseContact[]
    ppd:          PPDPeopleEntry[]
  }
  personRef: (id: string | null) => string | null
  onClose: () => void
}) {
  const total = results.preferences.length + results.dining.length + results.destinations.length + results.contacts.length + results.ppd.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{total} result{total !== 1 ? 's' : ''}</span>
        <button onClick={onClose} style={{ ...btnG, padding: '4px 10px', fontSize: 11 }}>Clear</button>
      </div>
      {results.preferences.length > 0 && (
        <div>
          <SectionLabel label='Preferences' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.preferences.map(p => (
              <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.category} · {p.pref_key}{personRef(p.person_id) ? ` · ${personRef(p.person_id)}` : ''}</div>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600, marginTop: 2 }}>{p.pref_value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.dining.length > 0 && (
        <div>
          <SectionLabel label='Dining' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.dining.map(d => (
              <div key={d.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${STATUS[d.status].text}`, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{d.restaurant_name}</div>
                  <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[d.city, d.country].filter(Boolean).join(', ')}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS[d.status].text, fontFamily: A.font, textTransform: 'uppercase' }}>{STATUS[d.status].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.destinations.length > 0 && (
        <div>
          <SectionLabel label='Destinations' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.destinations.map(d => (
              <div key={d.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${DEST_STATUS_COLOR[d.status]}`, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{d.destination_name}</div>
                  <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[d.city, d.country].filter(Boolean).join(', ')}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: DEST_STATUS_COLOR[d.status], fontFamily: A.font, textTransform: 'uppercase' }}>{DEST_STATUS_LABEL[d.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.contacts.length > 0 && (
        <div>
          <SectionLabel label='Contacts' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.contacts.map(c => (
              <div key={c.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{c.contact_type}{c.role ? ` · ${c.role}` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.ppd.length > 0 && (
        <div>
          <SectionLabel label='Sensitive' color='#f87171' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.ppd.map(p => (
              <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.data_key}</div>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, wordBreak: 'break-all' }}>{p.data_value}</div>
                </div>
                <CopyButton value={p.data_value} />
              </div>
            ))}
          </div>
        </div>
      )}
      {total === 0 && <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>Nothing found.</div>}
    </div>
  )
}

// ── Overview section ──────────────────────────────────────────────────────────

function OverviewSection({ house, data, onSaved, onReload, mobile }: {
  house: House; data: AllData; mobile: boolean
  onSaved: () => void; onReload: () => void
}) {
  const [editingName, setEditingName]       = useState(false)
  const [nameDraft, setNameDraft]           = useState(house.display_name)
  const [nameSaving, setNameSaving]         = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft]     = useState(house.summary ?? '')
  const [summarySaving, setSummarySaving]   = useState(false)
  const [expandedCats, setExpandedCats]     = useState<Set<string>>(new Set())
  const { toast }                           = useToast()

  function toggleCat(cat: string) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  async function saveName() {
    if (!nameDraft.trim() || nameDraft.trim() === house.display_name) { setEditingName(false); return }
    setNameSaving(true)
    try { await updateHouse(house.id, { display_name: nameDraft.trim() }); toast.success('Name updated.'); setEditingName(false); await onSaved() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setNameSaving(false)
  }

  async function saveSummary() {
    setSummarySaving(true)
    try { await updateHouse(house.id, { summary: summaryDraft.trim() || null }); toast.success('Saved.'); setEditingSummary(false); await onSaved() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSummarySaving(false)
  }

  const prefsByCategory = useMemo(() => {
    const confirmed = data.preferences.filter(p => p.confidence === 'confirmed')
    return PREF_CATEGORIES.map(cat => ({ cat, prefs: confirmed.filter(p => p.category === cat) })).filter(x => x.prefs.length > 0)
  }, [data.preferences])

  const favs   = data.dining.filter(d => d.status === 'favorite')
  const avoids = data.dining.filter(d => d.status === 'avoid')

  const hardDietaryAvoids = data.preferences.filter(p =>
    p.confidence === 'confirmed' &&
    (p.category === 'Allergies' || (p.category === 'Dining' && ['No Alcohol','No Pork','Halal','Kosher','Vegan','Vegetarian'].includes(p.pref_key)))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {editingName ? (
          <>
            <input style={{ ...inputStyle, fontSize: 16, fontWeight: 700, padding: '7px 12px', flex: 1, minWidth: 160 }} value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditingName(false); setNameDraft(house.display_name) } }} />
            <button onClick={saveName} style={{ ...btnP, opacity: nameSaving ? 0.5 : 1 }} disabled={nameSaving}>Save</button>
            <button onClick={() => { setEditingName(false); setNameDraft(house.display_name) }} style={btnG}>Cancel</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>{house.display_name}</span>
            <button onClick={() => setEditingName(true)} style={{ ...btnG, padding: '3px 10px', fontSize: 10 }}>Edit name</button>
          </>
        )}
      </div>

      <div style={{ padding: '14px 16px', background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: house.summary || editingSummary ? 10 : 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>Client Summary</div>
          {!editingSummary && <button onClick={() => { setEditingSummary(true); setSummaryDraft(house.summary ?? '') }} style={{ ...btnG, padding: '3px 10px', fontSize: 10 }}>{house.summary ? 'Edit' : '+ Add'}</button>}
        </div>
        {editingSummary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea style={{ ...textareaStyle, minHeight: 110, lineHeight: 1.8 }} value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)} placeholder='A concise briefing note…' autoFocus />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setEditingSummary(false); setSummaryDraft(house.summary ?? '') }} style={btnG}>Cancel</button>
              <button onClick={saveSummary} style={{ ...btnP, opacity: summarySaving ? 0.5 : 1 }} disabled={summarySaving}>{summarySaving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        ) : house.summary ? (
          <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{house.summary}</div>
        ) : (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No summary yet.</div>
        )}
      </div>

      {hardDietaryAvoids.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#f8717108', border: '1px solid #f8717130', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#f87171', fontFamily: A.font, whiteSpace: 'nowrap' }}>Dietary</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hardDietaryAvoids.map(p => (
              <span key={p.id} style={{ padding: '2px 9px', borderRadius: 20, background: '#f8717120', border: '1px solid #f8717140', color: '#f87171', fontSize: 11, fontWeight: 600, fontFamily: A.font }}>{p.pref_key}</span>
            ))}
          </div>
        </div>
      )}

      {prefsByCategory.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {prefsByCategory.map(({ cat, prefs }) => {
            const expanded = expandedCats.has(cat)
            return (
              <div key={cat} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => toggleCat(cat)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', borderBottom: expanded ? `1px solid ${A.border}` : 'none', userSelect: 'none' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>{cat}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{prefs.length}</span>
                    <span style={{ fontSize: 11, color: A.faint }}>{expanded ? '↑' : '↓'}</span>
                  </div>
                </div>
                {expanded && (
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {prefs.map(p => (
                      <div key={p.id} style={{ borderLeft: `2px solid ${CONF_COLOR[p.confidence]}40`, paddingLeft: 10 }}>
                        <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font, marginBottom: 2 }}>
                          {p.pref_key}{p.person_id ? <span style={{ color: A.faint }}> · {data.people.find(pe => pe.id === p.person_id)?.member_ref}</span> : null}
                        </div>
                        <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600, lineHeight: 1.4 }}>{p.pref_value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(favs.length > 0 || avoids.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: !mobile && favs.length && avoids.length ? '1fr 1fr' : '1fr', gap: 10 }}>
          {favs.length > 0 && (
            <div style={{ padding: '12px 14px', background: '#D8B56A08', border: '1px solid #D8B56A25', borderRadius: 10 }}>
              <SectionLabel label='Favourite Restaurants' color={A.gold} />
              {favs.slice(0, 6).map(d => (
                <div key={d.id} style={{ fontSize: 12, color: A.text, fontFamily: A.font, marginBottom: 5 }}>
                  {d.restaurant_name}{d.city && <span style={{ color: A.faint, fontSize: 11 }}> · {d.city}</span>}
                </div>
              ))}
              {favs.length > 6 && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>+{favs.length - 6} more</div>}
            </div>
          )}
          {avoids.length > 0 && (
            <div style={{ padding: '12px 14px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 10 }}>
              <SectionLabel label='Dining Avoids' color='#f87171' />
              {avoids.map(d => (
                <div key={d.id} style={{ fontSize: 12, color: '#f87171', fontFamily: A.font, marginBottom: 5, opacity: 0.85 }}>
                  {d.restaurant_name}{d.city && <span style={{ fontSize: 11, opacity: 0.6 }}> · {d.city}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {prefsByCategory.length === 0 && !hardDietaryAvoids.length && favs.length === 0 && avoids.length === 0 && !house.summary && (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No confirmed preferences recorded yet.</div>
      )}
    </div>
  )
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesSection({ data, houseId, onReload, personRef, mobile }: {
  data: AllData; houseId: string; mobile: boolean
  onReload: () => void
  personRef: (id: string | null) => string | null
}) {
  const [cat, setCat]       = useState<PrefCategory>('Dining')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [draft, setDraft]   = useState({ pref_key: '', pref_value: '', notes: '', source: 'direct', confidence: 'confirmed' as PrefConfidence, person_id: '' })
  const { toast }           = useToast()

  const catPrefs = useMemo(() => {
    const base = data.preferences.filter(p => p.category === cat)
    if (!filter.trim()) return base
    const q = filter.toLowerCase()
    return base.filter(p => p.pref_key.toLowerCase().includes(q) || p.pref_value.toLowerCase().includes(q))
  }, [data.preferences, cat, filter])

  const catCount = (c: PrefCategory) => data.preferences.filter(p => p.category === c).length

  async function handleAdd() {
    if (!draft.pref_key.trim() || !draft.pref_value.trim()) return
    setSaving(true)
    try {
      await createPreference(houseId, draft.person_id || null, cat, draft.pref_key.trim(), draft.pref_value.trim(), draft.notes.trim() || null, draft.source, draft.confidence)
      toast.success('Added.'); setAdding(false); setDraft({ pref_key: '', pref_value: '', notes: '', source: 'direct', confidence: 'confirmed', person_id: '' }); await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function confirm(p: HousePreference) {
    try { await updatePreference(p.id, { confidence: 'confirmed' }); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    try { await deletePreference(id); toast.success('Removed.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {PREF_CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCat(c); setAdding(false) }} style={{
            padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0,
            background: cat === c ? 'rgba(216,181,106,0.10)' : 'transparent',
            color:      cat === c ? A.gold : A.muted,
            border:     cat === c ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
            borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
          }}>
            {c} {catCount(c) > 0 && <span style={{ opacity: 0.55 }}>({catCount(c)})</span>}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder='Filter…' value={filter} onChange={e => setFilter(e.target.value)} />
        {!adding && <button onClick={() => setAdding(true)} style={{ ...btnP, flexShrink: 0 }}>+ Add</button>}
      </div>
      {adding && (
        <div style={{ padding: '14px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label='Key'>
            <select style={inputStyle} value={draft.pref_key} onChange={e => setDraft(d => ({ ...d, pref_key: e.target.value }))}>
              <option value=''>Select…</option>
              {(PREF_KEYS[cat] ?? []).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label='Value'><input style={inputStyle} placeholder='Value…' value={draft.pref_value} onChange={e => setDraft(d => ({ ...d, pref_value: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Person'>
              <select style={inputStyle} value={draft.person_id} onChange={e => setDraft(d => ({ ...d, person_id: e.target.value }))}>
                <option value=''>Household</option>
                {data.people.map(p => <option key={p.id} value={p.id}>{p.member_ref}</option>)}
              </select>
            </Field>
            <Field label='Confidence'>
              <select style={inputStyle} value={draft.confidence} onChange={e => setDraft(d => ({ ...d, confidence: e.target.value as PrefConfidence }))}>
                <option value='confirmed'>Confirmed</option>
                <option value='to_confirm'>To Confirm</option>
                <option value='outdated'>Outdated</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Source'><SourceSelect value={draft.source} onChange={(v: string) => setDraft(d => ({ ...d, source: v }))} /></Field>
            <Field label='Notes'><input style={inputStyle} placeholder='Context…' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnG}>Cancel</button>
            <button onClick={handleAdd} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>Add</button>
          </div>
        </div>
      )}
      {catPrefs.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No {cat.toLowerCase()} preferences recorded.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {catPrefs.map(p => (
            <div key={p.id} style={{
              padding: '11px 14px', background: A.bgCard,
              border: `1px solid ${A.border}`, borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`,
              borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start',
              opacity: p.confidence === 'outdated' ? 0.55 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: A.muted, fontFamily: A.font }}>
                  {p.pref_key}
                  {personRef(p.person_id) && <span style={{ fontWeight: 400, color: A.faint }}> · {personRef(p.person_id)}</span>}
                </div>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600, marginTop: 3, lineHeight: 1.4 }}>{p.pref_value}</div>
                {p.notes && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 2, fontStyle: 'italic' }}>{p.notes}</div>}
                <div style={{ fontSize: 9, color: A.faint, fontFamily: A.font, marginTop: 3 }}>{p.source}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, paddingTop: 2 }}>
                {p.confidence !== 'confirmed' && <button onClick={() => confirm(p)} style={{ ...btnG, padding: '3px 8px', fontSize: 10, color: '#4ade80', borderColor: '#4ade8030' }}>✓</button>}
                <button onClick={() => remove(p.id)} style={btnD}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dining section ────────────────────────────────────────────────────────────

function DiningSection({ data, houseId, onReload, mobile }: {
  data: AllData; houseId: string; onReload: () => void; mobile: boolean
}) {
  const [filter, setFilter] = useState<DiningStatus | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ restaurant_name: '', city: '', country: '', status: 'visited' as DiningStatus, visit_date: '', trip_ref: '', notes: '' })
  const { toast }           = useToast()
  const STATUSES: DiningStatus[] = ['favorite', 'visited', 'to_try', 'avoid']

  const grouped = useMemo(() => {
    const filtered = filter === 'all' ? data.dining : data.dining.filter(d => d.status === filter)
    const m = new Map<DiningStatus, HouseDiningEntry[]>()
    for (const s of STATUSES) m.set(s, [])
    for (const d of filtered) m.get(d.status)!.push(d)
    return STATUSES.map(s => ({ status: s, entries: m.get(s)! })).filter(g => g.entries.length > 0)
  }, [data.dining, filter])

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: data.dining.length }
    for (const d of data.dining) m[d.status] = (m[d.status] ?? 0) + 1
    return m
  }, [data.dining])

  async function handleAdd() {
    if (!draft.restaurant_name.trim()) return
    setSaving(true)
    try {
      await createDiningEntry(houseId, draft.restaurant_name.trim(), draft.city.trim() || null, draft.country.trim() || null, draft.status, draft.visit_date || null, draft.trip_ref.trim() || null, null, draft.notes.trim() || null)
      toast.success('Added.'); setAdding(false); setDraft({ restaurant_name: '', city: '', country: '', status: 'visited', visit_date: '', trip_ref: '', notes: '' }); await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function changeStatus(entry: HouseDiningEntry, status: DiningStatus) {
    try { await updateDiningEntry(entry.id, { status }); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    try { await deleteDiningEntry(id); toast.success('Removed.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {(['all', ...STATUSES] as const).map(s => {
          const count = counts[s] ?? 0
          const active = filter === s
          const color = s === 'all' ? A.gold : STATUS[s as DiningStatus].text
          return (
            <button key={s} onClick={() => setFilter(s as typeof filter)} style={{ padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0, background: active ? color + '12' : 'transparent', color: active ? color : A.muted, border: active ? `1px solid ${color}30` : `1px solid ${A.border}`, borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer' }}>
              {s === 'all' ? 'All' : s === 'to_try' ? 'To Try' : capitalize(s)}
              {count > 0 && <span style={{ marginLeft: 4, opacity: 0.55 }}>({count})</span>}
            </button>
          )
        })}
        <div style={{ flexShrink: 0, marginLeft: 4 }}>{!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add</button>}</div>
      </div>
      {adding && (
        <div style={{ padding: '14px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label='Restaurant'><input style={inputStyle} placeholder='Name…' value={draft.restaurant_name} onChange={e => setDraft(d => ({ ...d, restaurant_name: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Field label='City'><input style={inputStyle} placeholder='City…' value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} /></Field>
            <Field label='Country'><input style={inputStyle} placeholder='Country…' value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} /></Field>
            <Field label='Status'>
              <select style={inputStyle} value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as DiningStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s === 'to_try' ? 'To Try' : capitalize(s)}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Visit Date'><input type='date' style={{ ...inputStyle, colorScheme: 'dark' }} value={draft.visit_date} onChange={e => setDraft(d => ({ ...d, visit_date: e.target.value }))} /></Field>
            <Field label='Trip Ref'><input style={inputStyle} placeholder='YAZ-2027-HM…' value={draft.trip_ref} onChange={e => setDraft(d => ({ ...d, trip_ref: e.target.value }))} /></Field>
          </div>
          <Field label='Notes'><input style={inputStyle} placeholder='What they thought…' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnG}>Cancel</button>
            <button onClick={handleAdd} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>Add</button>
          </div>
        </div>
      )}
      {grouped.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No entries yet.</div>
      ) : (
        grouped.map(({ status, entries }) => (
          <div key={status}>
            <SectionLabel label={`${STATUS[status].label} · ${entries.length}`} color={STATUS[status].text} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {entries.map(e => (
                <div key={e.id} style={{ padding: '12px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${STATUS[status].text}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{e.restaurant_name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        {(e.city || e.country) && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[e.city, e.country].filter(Boolean).join(', ')}</span>}
                        {e.visit_date && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{new Date(e.visit_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                        {e.trip_ref && <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{e.trip_ref}</span>}
                      </div>
                      {e.notes && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginTop: 4, fontStyle: 'italic' }}>{e.notes}</div>}
                    </div>
                    <button onClick={() => remove(e.id)} style={btnD}>×</button>
                  </div>
                  <select value={e.status} onChange={ev => changeStatus(e, ev.target.value as DiningStatus)} style={{ ...inputStyle, width: '100%', marginTop: 8, padding: '6px 10px', fontSize: 11 }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s === 'to_try' ? 'To Try' : capitalize(s)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Destinations section ──────────────────────────────────────────────────────

function DestinationsSection({ data, houseId, onReload, mobile }: {
  data: AllData; houseId: string; onReload: () => void; mobile: boolean
}) {
  const [filter, setFilter] = useState<DestinationStatus | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({
    destination_name: '', country: '', city: '',
    trip_type: '' as DestinationTripType | '',
    status: 'visited' as DestinationStatus,
    visit_date: '', trip_ref: '', notes: '',
  })
  const { toast } = useToast()

  const grouped = useMemo(() => {
    const filtered = filter === 'all' ? data.destinations : data.destinations.filter(d => d.status === filter)
    const m = new Map<DestinationStatus, HouseDestination[]>()
    for (const s of DEST_STATUSES) m.set(s, [])
    for (const d of filtered) m.get(d.status)!.push(d)
    return DEST_STATUSES.map(s => ({ status: s, entries: m.get(s)! })).filter(g => g.entries.length > 0)
  }, [data.destinations, filter])

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: data.destinations.length }
    for (const d of data.destinations) m[d.status] = (m[d.status] ?? 0) + 1
    return m
  }, [data.destinations])

  async function handleAdd() {
    if (!draft.destination_name.trim()) return
    setSaving(true)
    try {
      await createDestination(
        houseId,
        draft.destination_name.trim(),
        draft.country.trim() || null,
        draft.city.trim() || null,
        (draft.trip_type || null) as DestinationTripType | null,
        draft.status,
        draft.visit_date || null,
        draft.trip_ref.trim() || null,
        draft.notes.trim() || null,
      )
      toast.success('Added.')
      setAdding(false)
      setDraft({ destination_name: '', country: '', city: '', trip_type: '', status: 'visited', visit_date: '', trip_ref: '', notes: '' })
      await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function changeStatus(dest: HouseDestination, status: DestinationStatus) {
    try { await updateDestination(dest.id, { status }); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    try { await deleteDestination(id); toast.success('Removed.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {(['all', ...DEST_STATUSES] as const).map(s => {
          const count = counts[s] ?? 0
          const active = filter === s
          const color = s === 'all' ? A.gold : DEST_STATUS_COLOR[s as DestinationStatus]
          return (
            <button key={s} onClick={() => setFilter(s as typeof filter)} style={{ padding: '7px 13px', whiteSpace: 'nowrap', flexShrink: 0, background: active ? color + '12' : 'transparent', color: active ? color : A.muted, border: active ? `1px solid ${color}30` : `1px solid ${A.border}`, borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer' }}>
              {s === 'all' ? 'All' : DEST_STATUS_LABEL[s as DestinationStatus]}
              {count > 0 && <span style={{ marginLeft: 4, opacity: 0.55 }}>({count})</span>}
            </button>
          )
        })}
        <div style={{ flexShrink: 0, marginLeft: 4 }}>{!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add</button>}</div>
      </div>

      {adding && (
        <div style={{ padding: '14px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label='Destination'><input style={inputStyle} placeholder='Mallorca, Lake Como…' value={draft.destination_name} onChange={e => setDraft(d => ({ ...d, destination_name: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Country'><input style={inputStyle} placeholder='Italy…' value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} /></Field>
            <Field label='City'><input style={inputStyle} placeholder='Como…' value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Status'>
              <select style={inputStyle} value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as DestinationStatus }))}>
                {DEST_STATUSES.map(s => <option key={s} value={s}>{DEST_STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label='Trip Type'>
              <select style={inputStyle} value={draft.trip_type} onChange={e => setDraft(d => ({ ...d, trip_type: e.target.value as DestinationTripType | '' }))}>
                <option value=''>Not specified</option>
                {DEST_TRIP_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Visit Date'><input type='date' style={{ ...inputStyle, colorScheme: 'dark' }} value={draft.visit_date} onChange={e => setDraft(d => ({ ...d, visit_date: e.target.value }))} /></Field>
            <Field label='Trip Ref'><input style={inputStyle} placeholder='YAZ-2027-HM…' value={draft.trip_ref} onChange={e => setDraft(d => ({ ...d, trip_ref: e.target.value }))} /></Field>
          </div>
          <Field label='Notes'><input style={inputStyle} placeholder='Any notes…' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnG}>Cancel</button>
            <button onClick={handleAdd} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>Add</button>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No destinations recorded yet.</div>
      ) : (
        grouped.map(({ status, entries }) => (
          <div key={status}>
            <SectionLabel label={`${DEST_STATUS_LABEL[status]} · ${entries.length}`} color={DEST_STATUS_COLOR[status]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {entries.map(dest => (
                <div key={dest.id} style={{ padding: '12px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${DEST_STATUS_COLOR[status]}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{dest.destination_name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        {(dest.city || dest.country) && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[dest.city, dest.country].filter(Boolean).join(', ')}</span>}
                        {dest.trip_type && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font, textTransform: 'capitalize' }}>{dest.trip_type}</span>}
                        {dest.visit_date && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{new Date(dest.visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                        {dest.trip_ref && <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{dest.trip_ref}</span>}
                      </div>
                      {dest.notes && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginTop: 4, fontStyle: 'italic' }}>{dest.notes}</div>}
                    </div>
                    <button onClick={() => remove(dest.id)} style={btnD}>×</button>
                  </div>
                  <select value={dest.status} onChange={ev => changeStatus(dest, ev.target.value as DestinationStatus)} style={{ ...inputStyle, width: '100%', marginTop: 8, padding: '6px 10px', fontSize: 11 }}>
                    {DEST_STATUSES.map(s => <option key={s} value={s}>{DEST_STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Contacts section ──────────────────────────────────────────────────────────

function ContactsSection({ data, houseId, onReload, mobile }: {
  data: AllData; houseId: string; onReload: () => void; mobile: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({
    contact_type: 'pa' as ContactType,
    name: '', role: '', company: '',
    is_primary: false, notes: '',
  })
  const { toast } = useToast()

  const primary    = data.contacts.filter(c => c.is_primary)
  const secondary  = data.contacts.filter(c => !c.is_primary)

  async function handleAdd() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      await createContact(
        houseId,
        draft.contact_type,
        draft.name.trim(),
        draft.role.trim() || null,
        draft.company.trim() || null,
        draft.is_primary,
        draft.notes.trim() || null,
        null,
      )
      toast.success('Added.')
      setAdding(false)
      setDraft({ contact_type: 'pa', name: '', role: '', company: '', is_primary: false, notes: '' })
      await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function togglePrimary(contact: HouseContact) {
    try { await updateContact(contact.id, { is_primary: !contact.is_primary }); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this contact?')) return
    try { await deleteContact(id); toast.success('Removed.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  function ContactCard({ contact }: { contact: HouseContact }) {
    return (
      <div style={{ padding: '12px 14px', background: A.bgCard, border: `1px solid ${contact.is_primary ? A.gold + '40' : A.border}`, borderLeft: `3px solid ${contact.is_primary ? A.gold : A.border}`, borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{contact.name}</div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, padding: '1px 6px', border: `1px solid ${A.gold}30`, borderRadius: 4 }}>{contact.contact_type}</span>
              {contact.is_primary && <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', fontFamily: A.font }}>Primary</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
              {contact.role && <span style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{contact.role}</span>}
              {contact.company && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{contact.company}</span>}
            </div>
            {contact.notes && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginTop: 4, fontStyle: 'italic' }}>{contact.notes}</div>}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => togglePrimary(contact)} style={{ ...btnG, padding: '3px 8px', fontSize: 10, color: contact.is_primary ? A.faint : '#4ade80', borderColor: contact.is_primary ? A.border : '#4ade8030' }}>
              {contact.is_primary ? 'Unprimary' : 'Primary'}
            </button>
            <button onClick={() => remove(contact.id)} style={btnD}>×</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add Contact</button>}
      </div>

      {adding && (
        <div style={{ padding: '14px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Name'><input style={inputStyle} placeholder='Full name…' value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} autoFocus /></Field>
            <Field label='Type'>
              <select style={inputStyle} value={draft.contact_type} onChange={e => setDraft(d => ({ ...d, contact_type: e.target.value as ContactType }))}>
                {CONTACT_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Role'><input style={inputStyle} placeholder='Personal Assistant…' value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} /></Field>
            <Field label='Company'><input style={inputStyle} placeholder='Company…' value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))} /></Field>
          </div>
          <Field label='Notes'><input style={inputStyle} placeholder='Any notes…' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type='checkbox' id='is-primary' checked={draft.is_primary} onChange={e => setDraft(d => ({ ...d, is_primary: e.target.checked }))} style={{ accentColor: A.gold }} />
            <label htmlFor='is-primary' style={{ fontSize: 12, color: A.muted, fontFamily: A.font, cursor: 'pointer' }}>Mark as primary contact</label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnG}>Cancel</button>
            <button onClick={handleAdd} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>Add</button>
          </div>
        </div>
      )}

      {data.contacts.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No contacts recorded yet.</div>
      ) : (
        <>
          {primary.length > 0 && (
            <div>
              <SectionLabel label={`Primary · ${primary.length}`} color={A.gold} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {primary.map(c => <ContactCard key={c.id} contact={c} />)}
              </div>
            </div>
          )}
          {secondary.length > 0 && (
            <div>
              <SectionLabel label={`Other · ${secondary.length}`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {secondary.map(c => <ContactCard key={c.id} contact={c} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Sensitive section ─────────────────────────────────────────────────────────

function SensitiveSection({ data, houseId, onReload, personRef }: {
  data: AllData; houseId: string; onReload: () => void
  personRef: (id: string | null) => string | null
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ data_key: '', data_value: '', access_note: '', person_id: '' })
  const { toast }           = useToast()

  const grouped = useMemo(() => {
    const m = new Map<string, PPDPeopleEntry[]>()
    for (const e of data.ppd) {
      const key = e.person_id ?? '__household__'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(e)
    }
    return m
  }, [data.ppd])

  async function handleAdd() {
    if (!draft.data_key.trim() || !draft.data_value.trim()) return
    setSaving(true)
    try {
      await createPPDPeopleEntry(houseId, draft.person_id || null, draft.data_key.trim(), draft.data_value.trim(), draft.access_note.trim() || null)
      toast.success('Added.'); setAdding(false); setDraft({ data_key: '', data_value: '', access_note: '', person_id: '' }); await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!window.confirm('Permanently delete this record?')) return
    try { await deletePPDPeopleEntry(id); toast.success('Deleted.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '9px 14px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🔒</span>
        <span style={{ fontSize: 11, color: '#f87171', fontFamily: A.font }}>Sensitive personal data. Handle with strict discretion.</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add Record</button>}
      </div>
      {adding && (
        <div style={{ padding: '14px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label='Person'>
            <select style={inputStyle} value={draft.person_id} onChange={e => setDraft(d => ({ ...d, person_id: e.target.value }))}>
              <option value=''>Household</option>
              {data.people.map(p => <option key={p.id} value={p.id}>{p.member_ref} ({p.role})</option>)}
            </select>
          </Field>
          <Field label='Field'>
            <select style={inputStyle} value={draft.data_key} onChange={e => setDraft(d => ({ ...d, data_key: e.target.value }))}>
              <option value=''>Select…</option>
              {PPD_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label='Value'><PPDValueInput dataKey={draft.data_key} value={draft.data_value} onChange={v => setDraft(d => ({ ...d, data_value: v }))} /></Field>
          <Field label='Access Note (optional)'><input style={inputStyle} placeholder='Who has access…' value={draft.access_note} onChange={e => setDraft(d => ({ ...d, access_note: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnG}>Cancel</button>
            <button onClick={handleAdd} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>Add</button>
          </div>
        </div>
      )}
      {data.ppd.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No sensitive records yet.</div>
      ) : (
        Array.from(grouped.entries()).map(([key, rows]) => (
          <div key={key}>
            <SectionLabel label={key === '__household__' ? 'Household' : personRef(rows[0].person_id) ?? 'Unknown'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {rows.map(entry => (
                <div key={entry.id} style={{ padding: '10px 14px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.12)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: A.muted, fontFamily: A.font }}>{entry.data_key}</div>
                    <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>{entry.data_value}</div>
                    {entry.access_note && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2, fontStyle: 'italic' }}>{entry.access_note}</div>}
                  </div>
                  <CopyButton value={entry.data_value} />
                  <button onClick={() => remove(entry.id)} style={btnD}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Notes section ─────────────────────────────────────────────────────────────

function NotesSection({ house, onSaved }: { house: House; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(house)
  const [saving, setSaving]   = useState(false)
  const { toast }             = useToast()

  const FIELDS: Array<{ key: keyof House; label: string; placeholder: string; danger?: boolean }> = [
    { key: 'service_style_notes', label: 'Service Style', placeholder: 'How this household expects to be served…' },
    { key: 'travel_style_notes',  label: 'Travel Style',  placeholder: 'Travel pace, preferred destinations…' },
    { key: 'avoid_notes',         label: 'Avoid',         placeholder: 'Hard avoids — destinations, experiences, vendors…', danger: true },
    { key: 'service_notes',       label: 'Service Notes', placeholder: 'Operational notes for the service team…' },
    { key: 'missing_info_notes',  label: 'Missing Info',  placeholder: 'What we still need to learn…' },
  ]

  async function handleSave() {
    setSaving(true)
    try {
      await updateHouse(house.id, { service_style_notes: draft.service_style_notes, travel_style_notes: draft.travel_style_notes, avoid_notes: draft.avoid_notes, service_notes: draft.service_notes, missing_info_notes: draft.missing_info_notes })
      toast.success('Saved.'); setEditing(false); onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setEditing(false); setDraft(house) }} style={btnG} disabled={saving}>Cancel</button>
            <button onClick={handleSave} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={btnG}>Edit</button>
        )}
      </div>
      {FIELDS.map(({ key, label, placeholder, danger }) => {
        const val = house[key] as string | null
        const color = danger ? '#f87171' : A.faint
        return (
          <div key={key as string}>
            <SectionLabel label={label} color={color} />
            {editing ? (
              <textarea style={{ ...textareaStyle, borderColor: danger ? '#f8717130' : A.border, minHeight: 88 }} value={(draft[key] as string) ?? ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value || null }))} placeholder={placeholder} />
            ) : val ? (
              <div style={{ padding: '12px 14px', background: A.bgCard, border: `1px solid ${danger ? '#f8717125' : A.border}`, borderRadius: 8, fontSize: 13, color: danger ? '#f87171' : A.text, fontFamily: A.font, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{val}</div>
            ) : (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>Not recorded — click Edit to add.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function HouseTab() {
  const [selected, setSelected] = useState<House | null>(null)
  return (
    <div>
      {selected
        ? <HouseDetail house={selected} onBack={() => setSelected(null)} />
        : <HouseList onSelect={setSelected} />
      }
    </div>
  )
}