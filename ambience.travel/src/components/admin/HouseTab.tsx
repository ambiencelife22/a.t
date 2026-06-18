/* HouseTab.tsx
 * ambience.HOUSE — private client intelligence platform.
 *
 * Shell component only. Section components are imported from their own files.
 * Shared UI primitives live in houseUi.tsx.
 *
 * Mobile-responsive: useWindowWidth hook drives layout decisions.
 *   < 768px (mobile): single column, horizontal pill nav, full-screen modal.
 *   >= 768px (desktop): two-panel layout, sticky sidebar nav.
 *
 * Last updated: S52 — PPD_KEYS removed (was inline at line 114, violation of
 *   single-source rule). Now imported from typesPpd.ts as PPD_PEOPLE_KEYS,
 *   aliased to PPD_KEYS locally to preserve all call sites.
 * Prior: S44 — refactor. Extracted section components + shared primitives.
 *   Added Trip Dossier section (TripDossierSection) + adminTripQueries fetch.
 * Prior: S43 — Phase 4 redesign (useAdminToast, HouseCard, shared primitives).
 * Prior: S41 — Destinations + Contacts sections added.
 * Prior: S40D — mobile-responsive layout pass.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import {
  inputStyle, textareaStyle,
  btnPrimary as btnP, btnGhost as btnG, btnDanger as btnD,
} from '../../styles/stylesAdmin'
import { Field, CopyButton } from './adminUi'
import { AdminSection, AdminEmptyState, useAdminToast } from './_adminPrimitives'
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
} from '../../queries/queriesAdminHouse'
import { fetchTripDossierForHouse, type TripDossierData } from '../../queries/queriesAdminTrip'
import {
  capitalize, formatDOB,
  DesigBadge, StatusFilterBar, AddFormShell, EntryCard,
  SectionHeader, FormActions, SourceSelect, PPDValueInput,
} from './houseUi'
import { TripDossierSection } from './TripDossierSection'
import { RequestsSection } from './RequestsSection'
import { PersonLinkPicker } from './PersonLinkPicker'
import {
  createPerson as createGlobalPerson,
  fetchPersonById as fetchGlobalPersonById,
  updatePerson as updateGlobalPerson,
  type GlobalPersonResolved,
} from '../../queries/queriesGlobalPeople'
import { fetchRequestsForHouse, type TravelRequest } from '../../queries/queriesAdminRequests'
import { PPD_PEOPLE_KEYS as PPD_KEYS } from '../../types/typesPpd'

// Sections are defined inline below (OverviewSection, PreferencesSection, etc.)
// They remain here because they are tightly coupled to AllData and house context.
// TripDossierSection is standalone and lives in its own file.

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

const ROLES              = ['primary', 'spouse', 'partner', 'child', 'staff', 'other']
const DEST_STATUSES: DestinationStatus[]     = ['visited', 'planned', 'avoided']
const DEST_TRIP_TYPES: DestinationTripType[] = ['family', 'couple', 'solo', 'business', 'other']
const CONTACT_TYPES: ContactType[]          = ['pa', 'driver', 'fixer', 'medical', 'security', 'concierge', 'other']

// ── AllData ───────────────────────────────────────────────────────────────────

interface AllData {
  people:       HousePerson[]
  preferences:  HousePreference[]
  dining:       HouseDiningEntry[]
  destinations: HouseDestination[]
  contacts:     HouseContact[]
  ppd:          PPDPeopleEntry[]
  dossier:      TripDossierData
  requests:     TravelRequest[]
}

const EMPTY_DATA: AllData = {
  people: [], preferences: [], dining: [], destinations: [],
  contacts: [], ppd: [], dossier: { trips: [], partners: {}, house: null }, requests: [],
}

// ── Section type ──────────────────────────────────────────────────────────────

type Section = 'overview' | 'preferences' | 'dining' | 'destinations' | 'contacts' | 'sensitive' | 'notes' | 'trips' | 'requests'

// ── Person modal ──────────────────────────────────────────────────────────────

function PersonModal({ person, houseId, allPreferences, allPPD, onClose, onReload }: {
  person:         HousePerson
  houseId:        string
  allPreferences: HousePreference[]
  allPPD:         PPDPeopleEntry[]
  onClose:        () => void
  onReload:       () => void
}) {
  const { success, error } = useAdminToast()
  const mobile             = useWindowWidth() < 768
  const [tab, setTab]      = useState<'identity' | 'preferences' | 'sensitive' | 'profile'>('identity')

  const [identityDraft, setIdentityDraft]   = useState({ member_ref: person.member_ref, role: person.role, notes: person.notes ?? '' })
  const [identitySaving, setIdentitySaving] = useState(false)
  const [profile, setProfile]               = useState<HousePersonProfile | null | 'loading'>('loading')
  const [profileLoaded, setProfileLoaded]   = useState(false)

  // Editable global_people identity (driven by person.person_id).
  const [gp, setGp]               = useState<GlobalPersonResolved | null | 'loading'>('loading')
  const [gpLoaded, setGpLoaded]   = useState(false)
  const [gpDraft, setGpDraft]     = useState({ first_name: '', last_name: '', nickname: '', email: '', phone: '' })
  const [gpSaving, setGpSaving]   = useState(false)

  const personPrefs = useMemo(() => allPreferences.filter(p => p.person_id === person.id), [allPreferences, person.id])
  const personPPD   = useMemo(() => allPPD.filter(p => p.person_id === person.person_id), [allPPD, person.person_id])

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

  useEffect(() => {
    if (tab !== 'profile' || gpLoaded) return
    setGpLoaded(true)
    if (!person.person_id) { setGp(null); return }
    fetchGlobalPersonById(person.person_id)
      .then(p => {
        setGp(p)
        if (p) setGpDraft({
          first_name: p.first_name ?? '',
          last_name:  p.last_name  ?? '',
          nickname:   p.nickname   ?? '',
          email:      p.email      ?? '',
          phone:      '',
        })
      })
      .catch(() => setGp(null))
  }, [tab, gpLoaded, person.person_id])

  async function saveIdentity() {
    if (!identityDraft.member_ref.trim()) return
    setIdentitySaving(true)
    try {
      await updatePerson(person.id, { member_ref: identityDraft.member_ref.trim(), role: identityDraft.role, notes: identityDraft.notes.trim() || null })
      success('Saved.')
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setIdentitySaving(false)
  }

  async function saveGlobalPerson() {
    if (!person.person_id) return
    setGpSaving(true)
    try {
      const updated = await updateGlobalPerson(person.person_id, {
        first_name: gpDraft.first_name.trim() || null,
        last_name:  gpDraft.last_name.trim()  || null,
        nickname:   gpDraft.nickname.trim()   || null,
        email:      gpDraft.email.trim()      || null,
        phone:      gpDraft.phone.trim()      || null,
      })
      setGp(updated)
      success('Identity saved.')
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setGpSaving(false)
  }

  async function deleteSelf() {
    if (!window.confirm(`Remove ${person.member_ref} from this household?`)) return
    try {
      await deletePerson(person.id)
      success('Removed.')
      onClose()
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function addPref() {
    if (!prefDraft.pref_key.trim() || !prefDraft.pref_value.trim()) return
    setPrefSaving(true)
    try {
      await createPreference(houseId, person.id, prefCat, prefDraft.pref_key.trim(), prefDraft.pref_value.trim(), null, prefDraft.source, prefDraft.confidence)
      success('Added.')
      setAddingPref(false)
      setPrefDraft({ pref_key: '', pref_value: '', source: 'direct', confidence: 'confirmed' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setPrefSaving(false)
  }

  async function removePref(id: string) {
    try { await deletePreference(id); success('Removed.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function confirmPref(p: HousePreference) {
    try { await updatePreference(p.id, { confidence: 'confirmed' }); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function addPPD() {
    if (!ppdDraft.data_key.trim() || !ppdDraft.data_value.trim()) return
    setPpdSaving(true)
    try {
      await createPPDPeopleEntry(houseId, person.person_id, ppdDraft.data_key.trim(), ppdDraft.data_value.trim(), ppdDraft.access_note.trim() || null)
      success('Added.')
      setAddingPPD(false)
      setPpdDraft({ data_key: '', data_value: '', access_note: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setPpdSaving(false)
  }

  async function removePPD(id: string) {
    if (!window.confirm('Permanently delete this personal data record?')) return
    try { await deletePPDPeopleEntry(id); success('Deleted.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  const tabStyle = (t: typeof tab): React.CSSProperties => ({
    padding:      mobile ? '8px 12px' : '7px 14px',
    whiteSpace:   'nowrap',
    background:   tab === t ? 'rgba(216,181,106,0.10)' : 'transparent',
    color:        tab === t ? A.gold : A.muted,
    border:       tab === t ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
    borderRadius: 8,
    fontSize:     11,
    fontWeight:   tab === t ? 700 : 500,
    fontFamily:   A.font,
    cursor:       'pointer',
    flexShrink:   0,
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.80)', display: 'flex', alignItems: mobile ? 'flex-end' : 'flex-start', justifyContent: 'center', padding: mobile ? 0 : '32px 24px', overflowY: mobile ? 'hidden' : 'auto' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:         mobile ? '100%' : 'min(680px, 100%)',
          maxHeight:     mobile ? '92vh' : 'none',
          background:    A.bg,
          border:        `1px solid ${A.border}`,
          borderRadius:  mobile ? '14px 14px 0 0' : 14,
          padding:       mobile ? '20px 16px' : 24,
          display:       'flex',
          flexDirection: 'column',
          gap:           14,
          overflowY:     'auto',
          animation:     `_a_admin_modal_in 200ms cubic-bezier(0.16,1,0.3,1) both`,
        }}
      >
        {mobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: A.border, margin: '-8px auto 0', flexShrink: 0 }} />
        )}

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
          <button onClick={() => setTab('preferences')} style={tabStyle('preferences')}>
            Preferences {personPrefs.length > 0 && <span style={{ opacity: 0.6 }}>({personPrefs.length})</span>}
          </button>
          <button onClick={() => setTab('sensitive')}   style={tabStyle('sensitive')}>
            Personal Data {personPPD.length > 0 && <span style={{ opacity: 0.6 }}>({personPPD.length})</span>}
          </button>
          <button onClick={() => setTab('profile')} style={tabStyle('profile')}>Profile</button>
        </div>

        {tab === 'identity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Field label='Reference Code'>
                <input style={inputStyle} value={identityDraft.member_ref} onChange={e => setIdentityDraft(d => ({ ...d, member_ref: e.target.value }))} />
              </Field>
              <Field label='Role'>
                <select style={inputStyle} value={identityDraft.role} onChange={e => setIdentityDraft(d => ({ ...d, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{capitalize(r)}</option>)}
                </select>
              </Field>
            </div>
            <PersonLinkPicker
              label='Linked Person (global registry)'
              personId={person.person_id}
              onChange={async (pid) => {
                try {
                  await updatePerson(person.id, { person_id: pid })
                  success(pid ? 'Linked.' : 'Unlinked.')
                  await onReload()
                } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
              }}
            />
            <Field label='Notes (internal)'>
              <textarea style={{ ...textareaStyle, minHeight: 72 }} value={identityDraft.notes} onChange={e => setIdentityDraft(d => ({ ...d, notes: e.target.value }))} placeholder='Any notes about this person...' />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${A.border}`, flexWrap: 'wrap', gap: 8 }}>
              <button onClick={deleteSelf} style={{ ...btnD, border: '1px solid rgba(248,113,113,0.3)', padding: '5px 12px' }}>Remove from household</button>
              <button onClick={saveIdentity} style={{ ...btnP, opacity: identitySaving ? 0.5 : 1 }} disabled={identitySaving}>
                {identitySaving ? 'Saving...' : 'Save'}
              </button>
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
              <AddFormShell>
                <Field label='Category'>
                  <select style={inputStyle} value={prefCat} onChange={e => { setPrefCat(e.target.value as PrefCategory); setPrefDraft(d => ({ ...d, pref_key: '' })) }}>
                    {PREF_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label='Key'>
                  <select style={inputStyle} value={prefDraft.pref_key} onChange={e => setPrefDraft(d => ({ ...d, pref_key: e.target.value }))}>
                    <option value=''>Select...</option>
                    {(PREF_KEYS[prefCat] ?? []).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label='Value'>
                  <input style={inputStyle} placeholder='Value...' value={prefDraft.pref_value} onChange={e => setPrefDraft(d => ({ ...d, pref_value: e.target.value }))} autoFocus />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <Field label='Confidence'>
                    <select style={inputStyle} value={prefDraft.confidence} onChange={e => setPrefDraft(d => ({ ...d, confidence: e.target.value as PrefConfidence }))}>
                      <option value='confirmed'>Confirmed</option>
                      <option value='to_confirm'>To Confirm</option>
                      <option value='outdated'>Outdated</option>
                    </select>
                  </Field>
                  <Field label='Source'><SourceSelect value={prefDraft.source} onChange={v => setPrefDraft(d => ({ ...d, source: v }))} /></Field>
                </div>
                <FormActions onCancel={() => setAddingPref(false)} onSave={addPref} saving={prefSaving} />
              </AddFormShell>
            )}
            {personPrefs.length === 0
              ? <AdminEmptyState message='No person-specific preferences. Household-level preferences apply.' />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {personPrefs.map(p => (
                    <EntryCard key={p.id} accentColor={CONF_COLOR[p.confidence]}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: p.confidence === 'outdated' ? 0.55 : 1 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.category} · {p.pref_key}</div>
                          <div style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600, marginTop: 2 }}>{p.pref_value}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {p.confidence !== 'confirmed' && <button onClick={() => confirmPref(p)} style={{ ...btnG, padding: '3px 7px', fontSize: 10, color: '#4ade80', borderColor: '#4ade8030' }}>✓</button>}
                          <button onClick={() => removePref(p.id)} style={btnD}>x</button>
                        </div>
                      </div>
                    </EntryCard>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {tab === 'sensitive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span>
              <span style={{ fontSize: 11, color: '#f87171', fontFamily: A.font }}>Personal data. Handle with strict discretion.</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {!addingPPD && <button onClick={() => setAddingPPD(true)} style={btnP}>+ Add Record</button>}
            </div>
            {addingPPD && (
              <AddFormShell danger>
                <Field label='Field'>
                  <select style={inputStyle} value={ppdDraft.data_key} onChange={e => setPpdDraft(d => ({ ...d, data_key: e.target.value }))}>
                    <option value=''>Select...</option>
                    {PPD_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label='Value'>
                  <PPDValueInput dataKey={ppdDraft.data_key} value={ppdDraft.data_value} onChange={v => setPpdDraft(d => ({ ...d, data_value: v }))} />
                </Field>
                <Field label='Access Note (optional)'>
                  <input style={inputStyle} placeholder='Who has access...' value={ppdDraft.access_note} onChange={e => setPpdDraft(d => ({ ...d, access_note: e.target.value }))} />
                </Field>
                <FormActions onCancel={() => setAddingPPD(false)} onSave={addPPD} saving={ppdSaving} />
              </AddFormShell>
            )}
            {personPPD.length === 0
              ? <AdminEmptyState message='No personal data records for this person.' />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {personPPD.map(entry => (
                    <EntryCard key={entry.id} danger>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: A.muted, fontFamily: A.font }}>{entry.data_key}</div>
                          <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>{entry.data_value}</div>
                          {entry.access_note && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2, fontStyle: 'italic' }}>{entry.access_note}</div>}
                        </div>
                        <CopyButton value={entry.data_value} />
                        <button onClick={() => removePPD(entry.id)} style={btnD}>x</button>
                      </div>
                    </EntryCard>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Editable global_people identity (canonical registry). */}
            {!person.person_id ? (
              <div style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>
                  Not linked to the person registry. Use the <span style={{ color: A.gold }}>Linked Person</span> field on the Identity tab to link or create a global record — identity fields become editable here once linked.
                </div>
              </div>
            ) : gp === 'loading' ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading identity…</div>
            ) : gp === null ? (
              <div style={{ fontSize: 12, color: '#f87171', fontFamily: A.font }}>Linked person_id not found in registry.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${A.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>Registry Identity</div>
                <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <Field label='First Name'>
                    <input style={inputStyle} value={gpDraft.first_name} onChange={e => setGpDraft(d => ({ ...d, first_name: e.target.value }))} />
                  </Field>
                  <Field label='Last Name'>
                    <input style={inputStyle} value={gpDraft.last_name} onChange={e => setGpDraft(d => ({ ...d, last_name: e.target.value }))} />
                  </Field>
                  <Field label='Nickname'>
                    <input style={inputStyle} value={gpDraft.nickname} onChange={e => setGpDraft(d => ({ ...d, nickname: e.target.value }))} />
                  </Field>
                  <Field label='Email'>
                    <input style={inputStyle} type='email' value={gpDraft.email} onChange={e => setGpDraft(d => ({ ...d, email: e.target.value }))} />
                  </Field>
                  <Field label='Phone'>
                    <input style={inputStyle} type='tel' value={gpDraft.phone} onChange={e => setGpDraft(d => ({ ...d, phone: e.target.value }))} placeholder='Write-only — not shown on reload' />
                  </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={saveGlobalPerson} style={{ ...btnP, opacity: gpSaving ? 0.5 : 1 }} disabled={gpSaving}>
                    {gpSaving ? 'Saving…' : 'Save Identity'}
                  </button>
                </div>
              </div>
            )}

            {/* Login account status (global_profiles). Read-only. */}
            {profile === 'loading' ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Checking...</div>
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
                <EntryCard>
                  <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>Display name</div>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{profile.display_name ?? '(not set)'}</div>
                </EntryCard>
                <EntryCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>Profile UUID</div>
                      <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>{profile.id}</div>
                    </div>
                    <CopyButton value={profile.id} />
                  </div>
                </EntryCard>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── HouseList ─────────────────────────────────────────────────────────────────

function HouseList({ onSelect }: { onSelect: (h: House) => void }) {
  const [houses, setHouses]   = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const { error }             = useAdminToast()

  useEffect(() => {
    fetchHouses()
      .then(setHouses)
      .catch(e => error(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
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
        <div style={{ fontSize: 24, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em', marginBottom: 3 }}>Client Houses</div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>{houses.length} household{houses.length !== 1 ? 's' : ''}</div>
      </div>
      <input style={{ ...inputStyle, fontSize: 14, padding: '12px 14px' }} placeholder='Search...' value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      {loading ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState message='No results.' />
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
  const summary = house.summary || house.service_style_notes

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:       '18px 20px 16px',
        background:    hov ? '#1a1f1c' : A.bgCard,
        border:        `1px solid ${hov ? A.gold + '50' : A.border}`,
        borderRadius:  12,
        cursor:        'pointer',
        transition:    'all 0.12s ease',
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: A.text, fontFamily: A.font }}>{house.display_name}</span>
          {house.designation && <DesigBadge designation={house.designation} />}
          <span style={{ fontSize: 9, color: house.status === 'active' ? '#4ade80' : A.faint, fontFamily: A.font, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {house.status}
          </span>
        </div>
        <span style={{ color: A.gold, opacity: hov ? 0.9 : 0.25, transition: 'opacity 0.12s', fontSize: 14, flexShrink: 0 }}>→</span>
      </div>
      {summary && (
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6, borderLeft: `2px solid rgba(216,181,106,0.3)`, paddingLeft: 12, fontStyle: 'italic' }}>
          {summary.slice(0, 160)}{summary.length > 160 ? '...' : ''}
        </div>
      )}
      <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em' }}>
        {house.a_house_id}
      </div>
    </div>
  )
}

// ── HouseDetail ───────────────────────────────────────────────────────────────

function HouseDetail({ house: init, onBack }: { house: House; onBack: () => void }) {
  const mobile                        = useWindowWidth() < 768
  const [house, setHouse]             = useState<House>(init)
  const [section, setSection]         = useState<Section>('overview')
  const [q, setQ]                     = useState('')
  const [data, setData]               = useState<AllData>(EMPTY_DATA)
  const [loading, setLoading]         = useState(true)
  const [modalPerson, setModalPerson] = useState<HousePerson | null>(null)
  const { error, success }            = useAdminToast()
  const searchRef                     = useRef<HTMLInputElement>(null)
  const [addingPerson, setAddingPerson] = useState(false)
  const [pd, setPd]                   = useState({ member_ref: '', role: 'primary' })
  const [addSaving, setAddSaving]     = useState(false)

  async function loadAll() {
    setLoading(true)
    try {
      const [people, preferences, dining, destinations, contacts, ppdResponse, dossier, requests] = await Promise.all([
        fetchPeopleForHouse(house.id),
        fetchPreferencesForHouse(house.id),
        fetchDiningHistoryForHouse(house.id),
        fetchDestinationsForHouse(house.id),
        fetchContactsForHouse(house.id),
        fetchPPDForHouse(house.id),
        fetchTripDossierForHouse(house.id),
        fetchRequestsForHouse(house.id),
      ])
      setData({ people, preferences, dining, destinations, contacts, ppd: ppdResponse.people, dossier, requests })
    } catch (e) { error(e instanceof Error ? e.message : 'Failed to load') }
    setLoading(false)
  }

  async function reloadHouse() {
    const h = await fetchHouseById(house.id).catch(() => null)
    if (h) setHouse(h)
  }

  useEffect(() => { loadAll() }, [house.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName ?? '')) {
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
      // Mint a linked global_people row so the house-person is born linked,
      // not orphaned. member_ref doubles as the new person's nickname for
      // display until richer identity fields are filled in.
      const gp = await createGlobalPerson({ nickname: pd.member_ref.trim() })
      await createPerson(house.id, pd.member_ref.trim(), pd.role, null, gp.id)
      success('Added.')
      setAddingPerson(false)
      setPd({ member_ref: '', role: 'primary' })
      await loadAll()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setAddSaving(false)
  }

  const NAV: Array<{ id: Section; label: string; count?: number }> = [
    { id: 'overview',     label: 'Overview' },
    { id: 'trips',        label: 'Trips',        count: data.dossier.trips.length },
    { id: 'preferences',  label: 'Preferences',  count: data.preferences.length },
    { id: 'dining',       label: 'Dining',        count: data.dining.length },
    { id: 'destinations', label: 'Destinations',  count: data.destinations.length },
    { id: 'contacts',     label: 'Contacts',      count: data.contacts.length },
    { id: 'requests',     label: 'Requests',      count: data.requests.length },
    { id: 'sensitive',    label: 'Personal Data',     count: data.ppd.length },
    { id: 'notes',        label: 'Notes' },
  ]

  const PeopleBlock = (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <SectionHeader title='Household' onAdd={() => setAddingPerson(true)} adding={addingPerson} />
      {data.people.length === 0 && !addingPerson && <AdminEmptyState message='No members yet.' />}
      {data.people.map(p => (
        <div key={p.id} onClick={() => setModalPerson(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', padding: '4px 0' }}>
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
        <div style={{ marginTop: 6 }}>
          <AddFormShell>
            <input style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} placeholder='J, K, Child 1...' value={pd.member_ref} onChange={e => setPd(d => ({ ...d, member_ref: e.target.value }))} autoFocus onKeyDown={e => { if (e.key === 'Enter') addPerson() }} />
            <select style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} value={pd.role} onChange={e => setPd(d => ({ ...d, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{capitalize(r)}</option>)}
            </select>
            <FormActions onCancel={() => { setAddingPerson(false); setPd({ member_ref: '', role: 'primary' }) }} onSave={addPerson} saving={addSaving} />
          </AddFormShell>
        </div>
      )}
    </div>
  )

  const AvoidBlock = avoidDining.length > 0 ? (
    <div style={{ background: '#2a161630', border: '1px solid #f8717125', borderRadius: 10, padding: '12px 14px' }}>
      <AdminSection title='Dining Avoids' style={{ borderLeftColor: '#f8717150' }} />
      {avoidDining.map(d => (
        <div key={d.id} style={{ fontSize: 11, color: '#f87171', fontFamily: A.font, marginBottom: 4, opacity: 0.85 }}>
          {d.restaurant_name}{d.city && <span style={{ opacity: 0.6 }}> · {d.city}</span>}
        </div>
      ))}
    </div>
  ) : null

  const renderSection = () => {
    if (loading) return <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading...</div>
    switch (section) {
      case 'overview':     return <OverviewSection     house={house} data={data} onSaved={reloadHouse} onReload={loadAll} mobile={mobile} />
      case 'trips': return <TripDossierSection         dossier={data.dossier} mobile={mobile} />
      case 'requests':    return <RequestsSection     requests={data.requests} houseId={house.id} onReload={loadAll} mobile={mobile} />
      case 'preferences':  return <PreferencesSection  data={data} houseId={house.id} onReload={loadAll} personRef={personRef} mobile={mobile} />
      case 'dining':       return <DiningSection       data={data} houseId={house.id} onReload={loadAll} mobile={mobile} />
      case 'destinations': return <DestinationsSection data={data} houseId={house.id} onReload={loadAll} mobile={mobile} />
      case 'contacts':     return <ContactsSection     data={data} houseId={house.id} onReload={loadAll} mobile={mobile} />
      case 'sensitive':    return <SensitiveSection    data={data} houseId={house.id} onReload={loadAll} personRef={personRef} />
      case 'notes':        return <NotesSection        house={house} onSaved={reloadHouse} />
    }
  }

  const navPillStyle = (id: Section): React.CSSProperties => ({
    padding:      '8px 14px',
    whiteSpace:   'nowrap',
    flexShrink:   0,
    background:   section === id ? 'rgba(216,181,106,0.10)' : 'transparent',
    color:        section === id ? A.gold : A.muted,
    border:       section === id ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
    borderRadius: 20,
    fontSize:     12,
    fontWeight:   section === id ? 700 : 500,
    fontFamily:   A.font,
    cursor:       'pointer',
  })

  const navSidebarStyle = (id: Section, i: number): React.CSSProperties => ({
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
    padding:        '10px 14px',
    textAlign:      'left',
    background:     section === id ? 'rgba(216,181,106,0.08)' : 'transparent',
    borderLeft:     section === id ? `2px solid ${A.gold}` : '2px solid transparent',
    border:         'none',
    borderBottom:   i < NAV.length - 1 ? `1px solid ${A.border}` : 'none',
    color:          section === id ? A.gold : A.muted,
    fontSize:       12,
    fontWeight:     section === id ? 700 : 500,
    fontFamily:     A.font,
    cursor:         'pointer',
  })

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
          {house.designation && <DesigBadge designation={house.designation} />}
        </div>
        <div style={{ position: 'relative', flexShrink: 0, width: mobile ? '100%' : 'auto' }}>
          <input ref={searchRef} style={{ ...inputStyle, width: mobile ? '100%' : 220, paddingRight: 30, boxSizing: 'border-box' }} placeholder='Search... (/)' value={q} onChange={e => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: A.faint, cursor: 'pointer', fontSize: 14, padding: 0 }}>x</button>}
        </div>
      </div>

      {/* Mobile pill nav */}
      {mobile && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 12, scrollbarWidth: 'none' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)} style={navPillStyle(n.id)}>
              {n.label}{n.count ? ` ${n.count}` : ''}
            </button>
          ))}
        </div>
      )}

      {searchResults && <SearchResults results={searchResults} personRef={personRef} onClose={() => setQ('')} />}

      {!searchResults && (
        mobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PeopleBlock}
            {AvoidBlock}
            {renderSection()}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            {/* Sidebar */}
            <div style={{ width: 210, flexShrink: 0, position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {NAV.map((n, i) => (
                  <button key={n.id} onClick={() => setSection(n.id)} style={navSidebarStyle(n.id, i)}>
                    <span>{n.label}</span>
                    {n.count !== undefined && n.count > 0 && (
                      <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{n.count}</span>
                    )}
                  </button>
                ))}
              </div>
              {PeopleBlock}
              {AvoidBlock}
            </div>
            {/* Main */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {renderSection()}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ── SearchResults ─────────────────────────────────────────────────────────────

function SearchResults({ results, personRef, onClose }: {
  results:   { preferences: HousePreference[]; dining: HouseDiningEntry[]; destinations: HouseDestination[]; contacts: HouseContact[]; ppd: PPDPeopleEntry[] }
  personRef: (id: string | null) => string | null
  onClose:   () => void
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
          <AdminSection title='Preferences' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
            {results.preferences.map(p => (
              <EntryCard key={p.id} accentColor={CONF_COLOR[p.confidence]}>
                <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.category} · {p.pref_key}{personRef(p.person_id) ? ` · ${personRef(p.person_id)}` : ''}</div>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600, marginTop: 2 }}>{p.pref_value}</div>
              </EntryCard>
            ))}
          </div>
        </div>
      )}
      {results.dining.length > 0 && (
        <div>
          <AdminSection title='Dining' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
            {results.dining.map(d => (
              <EntryCard key={d.id} accentColor={STATUS[d.status].text}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{d.restaurant_name}</div>
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[d.city, d.country].filter(Boolean).join(', ')}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS[d.status].text, fontFamily: A.font, textTransform: 'uppercase' }}>{STATUS[d.status].label}</span>
                </div>
              </EntryCard>
            ))}
          </div>
        </div>
      )}
      {results.destinations.length > 0 && (
        <div>
          <AdminSection title='Destinations' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
            {results.destinations.map(d => (
              <EntryCard key={d.id} accentColor={DEST_STATUS_COLOR[d.status]}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{d.destination_name}</div>
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[d.city, d.country].filter(Boolean).join(', ')}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: DEST_STATUS_COLOR[d.status], fontFamily: A.font, textTransform: 'uppercase' }}>{DEST_STATUS_LABEL[d.status]}</span>
                </div>
              </EntryCard>
            ))}
          </div>
        </div>
      )}
      {results.contacts.length > 0 && (
        <div>
          <AdminSection title='Contacts' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
            {results.contacts.map(c => (
              <EntryCard key={c.id}>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{c.contact_type}{c.role ? ` · ${c.role}` : ''}</div>
              </EntryCard>
            ))}
          </div>
        </div>
      )}
      {results.ppd.length > 0 && (
        <div>
          <AdminSection title='Personal Data' style={{ borderLeftColor: '#f8717150' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
            {results.ppd.map(p => (
              <EntryCard key={p.id} danger>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.data_key}</div>
                    <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, wordBreak: 'break-all' }}>{p.data_value}</div>
                  </div>
                  <CopyButton value={p.data_value} />
                </div>
              </EntryCard>
            ))}
          </div>
        </div>
      )}
      {total === 0 && <AdminEmptyState message='Nothing found.' />}
    </div>
  )
}

// ── OverviewSection ───────────────────────────────────────────────────────────

function OverviewSection({ house, data, onSaved, onReload, mobile }: {
  house: House; data: AllData; mobile: boolean; onSaved: () => void; onReload: () => void
}) {
  const [editingName, setEditingName]       = useState(false)
  const [nameDraft, setNameDraft]           = useState(house.display_name)
  const [nameSaving, setNameSaving]         = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft]     = useState(house.summary ?? '')
  const [summarySaving, setSummarySaving]   = useState(false)
  const [expandedCats, setExpandedCats]     = useState<Set<string>>(new Set())
  const { success, error }                  = useAdminToast()

  function toggleCat(cat: string) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  async function saveName() {
    if (!nameDraft.trim() || nameDraft.trim() === house.display_name) { setEditingName(false); return }
    setNameSaving(true)
    try { await updateHouse(house.id, { display_name: nameDraft.trim() }); success('Name updated.'); setEditingName(false); await onSaved() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setNameSaving(false)
  }

  async function saveSummary() {
    setSummarySaving(true)
    try { await updateHouse(house.id, { summary: summaryDraft.trim() || null }); success('Saved.'); setEditingSummary(false); await onSaved() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
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
    (p.category === 'Allergies' || (p.category === 'Dining' && ['No Alcohol', 'No Pork', 'Halal', 'Kosher', 'Vegan', 'Vegetarian'].includes(p.pref_key)))
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
          <AdminSection title='Client Summary' />
          {!editingSummary && <button onClick={() => { setEditingSummary(true); setSummaryDraft(house.summary ?? '') }} style={{ ...btnG, padding: '3px 10px', fontSize: 10 }}>{house.summary ? 'Edit' : '+ Add'}</button>}
        </div>
        {editingSummary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea style={{ ...textareaStyle, minHeight: 110, lineHeight: 1.8 }} value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)} placeholder='A concise briefing note...' autoFocus />
            <FormActions onCancel={() => { setEditingSummary(false); setSummaryDraft(house.summary ?? '') }} onSave={saveSummary} saving={summarySaving} saveLabel='Save' />
          </div>
        ) : house.summary ? (
          <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{house.summary}</div>
        ) : (
          <AdminEmptyState message='No summary yet.' />
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
              <AdminSection title='Favourite Restaurants' style={{ borderLeftColor: '#D8B56A50' }} />
              {favs.slice(0, 6).map(d => (
                <div key={d.id} style={{ fontSize: 12, color: A.text, fontFamily: A.font, marginBottom: 5, marginTop: 8 }}>
                  {d.restaurant_name}{d.city && <span style={{ color: A.faint, fontSize: 11 }}> · {d.city}</span>}
                </div>
              ))}
              {favs.length > 6 && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>+{favs.length - 6} more</div>}
            </div>
          )}
          {avoids.length > 0 && (
            <div style={{ padding: '12px 14px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 10 }}>
              <AdminSection title='Dining Avoids' style={{ borderLeftColor: '#f8717150' }} />
              {avoids.map(d => (
                <div key={d.id} style={{ fontSize: 12, color: '#f87171', fontFamily: A.font, marginBottom: 5, marginTop: 8, opacity: 0.85 }}>
                  {d.restaurant_name}{d.city && <span style={{ fontSize: 11, opacity: 0.6 }}> · {d.city}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {prefsByCategory.length === 0 && !hardDietaryAvoids.length && favs.length === 0 && avoids.length === 0 && !house.summary && (
        <AdminEmptyState message='No confirmed preferences recorded yet.' />
      )}
    </div>
  )
}

// ── PreferencesSection ────────────────────────────────────────────────────────

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
  const { success, error }  = useAdminToast()

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
      success('Added.')
      setAdding(false)
      setDraft({ pref_key: '', pref_value: '', notes: '', source: 'direct', confidence: 'confirmed', person_id: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function confirm(p: HousePreference) {
    try { await updatePreference(p.id, { confidence: 'confirmed' }); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    try { await deletePreference(id); success('Removed.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {PREF_CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCat(c); setAdding(false) }} style={{
            padding:      '7px 13px',
            whiteSpace:   'nowrap',
            flexShrink:   0,
            background:   cat === c ? 'rgba(216,181,106,0.10)' : 'transparent',
            color:        cat === c ? A.gold : A.muted,
            border:       cat === c ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
            borderRadius: 8,
            fontSize:     11,
            fontWeight:   600,
            fontFamily:   A.font,
            cursor:       'pointer',
          }}>
            {c} {catCount(c) > 0 && <span style={{ opacity: 0.55 }}>({catCount(c)})</span>}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder='Filter...' value={filter} onChange={e => setFilter(e.target.value)} />
        {!adding && <button onClick={() => setAdding(true)} style={{ ...btnP, flexShrink: 0 }}>+ Add</button>}
      </div>
      {adding && (
        <AddFormShell>
          <Field label='Key'>
            <select style={inputStyle} value={draft.pref_key} onChange={e => setDraft(d => ({ ...d, pref_key: e.target.value }))}>
              <option value=''>Select...</option>
              {(PREF_KEYS[cat] ?? []).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label='Value'><input style={inputStyle} placeholder='Value...' value={draft.pref_value} onChange={e => setDraft(d => ({ ...d, pref_value: e.target.value }))} autoFocus /></Field>
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
            <Field label='Source'><SourceSelect value={draft.source} onChange={v => setDraft(d => ({ ...d, source: v }))} /></Field>
            <Field label='Notes'><input style={inputStyle} placeholder='Context...' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          </div>
          <FormActions onCancel={() => setAdding(false)} onSave={handleAdd} saving={saving} />
        </AddFormShell>
      )}
      {catPrefs.length === 0
        ? <AdminEmptyState message={`No ${cat.toLowerCase()} preferences recorded.`} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {catPrefs.map(p => (
              <EntryCard key={p.id} accentColor={CONF_COLOR[p.confidence]}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: p.confidence === 'outdated' ? 0.55 : 1 }}>
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
                    <button onClick={() => remove(p.id)} style={btnD}>x</button>
                  </div>
                </div>
              </EntryCard>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── DiningSection ─────────────────────────────────────────────────────────────

function DiningSection({ data, houseId, onReload, mobile }: {
  data: AllData; houseId: string; onReload: () => void; mobile: boolean
}) {
  const [filter, setFilter] = useState<DiningStatus | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ restaurant_name: '', city: '', country: '', status: 'visited' as DiningStatus, visit_date: '', trip_ref: '', notes: '' })
  const { success, error }  = useAdminToast()
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
      success('Added.')
      setAdding(false)
      setDraft({ restaurant_name: '', city: '', country: '', status: 'visited', visit_date: '', trip_ref: '', notes: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function changeStatus(entry: HouseDiningEntry, status: DiningStatus) {
    try { await updateDiningEntry(entry.id, { status }); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    try { await deleteDiningEntry(id); success('Removed.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatusFilterBar
        options={STATUSES} active={filter}
        onSelect={v => setFilter(v as DiningStatus | 'all')}
        labelFor={s => s === 'all' ? 'All' : s === 'to_try' ? 'To Try' : capitalize(s as string)}
        colorFor={s => s === 'all' ? A.gold : STATUS[s as DiningStatus].text}
        counts={counts}
      >
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add</button>}
      </StatusFilterBar>

      {adding && (
        <AddFormShell>
          <Field label='Restaurant'><input style={inputStyle} placeholder='Name...' value={draft.restaurant_name} onChange={e => setDraft(d => ({ ...d, restaurant_name: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Field label='City'><input style={inputStyle} placeholder='City...' value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} /></Field>
            <Field label='Country'><input style={inputStyle} placeholder='Country...' value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} /></Field>
            <Field label='Status'>
              <select style={inputStyle} value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as DiningStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s === 'to_try' ? 'To Try' : capitalize(s)}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Visit Date'><input type='date' style={{ ...inputStyle, colorScheme: 'dark' }} value={draft.visit_date} onChange={e => setDraft(d => ({ ...d, visit_date: e.target.value }))} /></Field>
            <Field label='Trip Ref'><input style={inputStyle} placeholder='YAZ-2027-HM...' value={draft.trip_ref} onChange={e => setDraft(d => ({ ...d, trip_ref: e.target.value }))} /></Field>
          </div>
          <Field label='Notes'><input style={inputStyle} placeholder='What they thought...' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          <FormActions onCancel={() => setAdding(false)} onSave={handleAdd} saving={saving} />
        </AddFormShell>
      )}

      {grouped.length === 0
        ? <AdminEmptyState message='No entries yet.' />
        : grouped.map(({ status, entries }) => (
          <div key={status}>
            <SectionHeader title={STATUS[status].label} color={STATUS[status].text} count={entries.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {entries.map(e => (
                <EntryCard key={e.id} accentColor={STATUS[status].text}>
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
                    <button onClick={() => remove(e.id)} style={btnD}>x</button>
                  </div>
                  <select value={e.status} onChange={ev => changeStatus(e, ev.target.value as DiningStatus)} style={{ ...inputStyle, width: '100%', marginTop: 8, padding: '6px 10px', fontSize: 11 }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s === 'to_try' ? 'To Try' : capitalize(s)}</option>)}
                  </select>
                </EntryCard>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ── DestinationsSection ───────────────────────────────────────────────────────

function DestinationsSection({ data, houseId, onReload, mobile }: {
  data: AllData; houseId: string; onReload: () => void; mobile: boolean
}) {
  const [filter, setFilter] = useState<DestinationStatus | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ destination_name: '', country: '', city: '', trip_type: '' as DestinationTripType | '', status: 'visited' as DestinationStatus, visit_date: '', trip_ref: '', notes: '' })
  const { success, error }  = useAdminToast()

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
      await createDestination(houseId, draft.destination_name.trim(), draft.country.trim() || null, draft.city.trim() || null, (draft.trip_type || null) as DestinationTripType | null, draft.status, draft.visit_date || null, draft.trip_ref.trim() || null, draft.notes.trim() || null)
      success('Added.')
      setAdding(false)
      setDraft({ destination_name: '', country: '', city: '', trip_type: '', status: 'visited', visit_date: '', trip_ref: '', notes: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function changeStatus(dest: HouseDestination, status: DestinationStatus) {
    try { await updateDestination(dest.id, { status }); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    try { await deleteDestination(id); success('Removed.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatusFilterBar
        options={DEST_STATUSES} active={filter}
        onSelect={v => setFilter(v as DestinationStatus | 'all')}
        labelFor={s => s === 'all' ? 'All' : DEST_STATUS_LABEL[s as DestinationStatus]}
        colorFor={s => s === 'all' ? A.gold : DEST_STATUS_COLOR[s as DestinationStatus]}
        counts={counts}
      >
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add</button>}
      </StatusFilterBar>

      {adding && (
        <AddFormShell>
          <Field label='Destination'><input style={inputStyle} placeholder='Mallorca, Lake Como...' value={draft.destination_name} onChange={e => setDraft(d => ({ ...d, destination_name: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Country'><input style={inputStyle} placeholder='Italy...' value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} /></Field>
            <Field label='City'><input style={inputStyle} placeholder='Como...' value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} /></Field>
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
            <Field label='Trip Ref'><input style={inputStyle} placeholder='YAZ-2027-HM...' value={draft.trip_ref} onChange={e => setDraft(d => ({ ...d, trip_ref: e.target.value }))} /></Field>
          </div>
          <Field label='Notes'><input style={inputStyle} placeholder='Any notes...' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          <FormActions onCancel={() => setAdding(false)} onSave={handleAdd} saving={saving} />
        </AddFormShell>
      )}

      {grouped.length === 0
        ? <AdminEmptyState message='No destinations recorded yet.' />
        : grouped.map(({ status, entries }) => (
          <div key={status}>
            <SectionHeader title={DEST_STATUS_LABEL[status]} color={DEST_STATUS_COLOR[status]} count={entries.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {entries.map(dest => (
                <EntryCard key={dest.id} accentColor={DEST_STATUS_COLOR[status]}>
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
                    <button onClick={() => remove(dest.id)} style={btnD}>x</button>
                  </div>
                  <select value={dest.status} onChange={ev => changeStatus(dest, ev.target.value as DestinationStatus)} style={{ ...inputStyle, width: '100%', marginTop: 8, padding: '6px 10px', fontSize: 11 }}>
                    {DEST_STATUSES.map(s => <option key={s} value={s}>{DEST_STATUS_LABEL[s]}</option>)}
                  </select>
                </EntryCard>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ── ContactsSection ───────────────────────────────────────────────────────────

function ContactsSection({ data, houseId, onReload, mobile }: {
  data: AllData; houseId: string; onReload: () => void; mobile: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ contact_type: 'pa' as ContactType, name: '', role: '', company: '', is_primary: false, notes: '' })
  const { success, error }  = useAdminToast()

  const primary   = data.contacts.filter(c => c.is_primary)
  const secondary = data.contacts.filter(c => !c.is_primary)

  async function handleAdd() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      await createContact(houseId, draft.contact_type, draft.name.trim(), draft.role.trim() || null, draft.company.trim() || null, draft.is_primary, draft.notes.trim() || null, null)
      success('Added.')
      setAdding(false)
      setDraft({ contact_type: 'pa', name: '', role: '', company: '', is_primary: false, notes: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function togglePrimary(contact: HouseContact) {
    try { await updateContact(contact.id, { is_primary: !contact.is_primary }); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this contact?')) return
    try { await deleteContact(id); success('Removed.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  function ContactCard({ contact }: { contact: HouseContact }) {
    return (
      <EntryCard accentColor={contact.is_primary ? A.gold : undefined}>
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
            <button onClick={() => remove(contact.id)} style={btnD}>x</button>
          </div>
        </div>
      </EntryCard>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add Contact</button>}
      </div>
      {adding && (
        <AddFormShell>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Name'><input style={inputStyle} placeholder='Full name...' value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} autoFocus /></Field>
            <Field label='Type'>
              <select style={inputStyle} value={draft.contact_type} onChange={e => setDraft(d => ({ ...d, contact_type: e.target.value as ContactType }))}>
                {CONTACT_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Field label='Role'><input style={inputStyle} placeholder='Personal Assistant...' value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} /></Field>
            <Field label='Company'><input style={inputStyle} placeholder='Company...' value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))} /></Field>
          </div>
          <Field label='Notes'><input style={inputStyle} placeholder='Any notes...' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type='checkbox' id='is-primary' checked={draft.is_primary} onChange={e => setDraft(d => ({ ...d, is_primary: e.target.checked }))} style={{ accentColor: A.gold }} />
            <label htmlFor='is-primary' style={{ fontSize: 12, color: A.muted, fontFamily: A.font, cursor: 'pointer' }}>Mark as primary contact</label>
          </div>
          <FormActions onCancel={() => setAdding(false)} onSave={handleAdd} saving={saving} />
        </AddFormShell>
      )}
      {data.contacts.length === 0
        ? <AdminEmptyState message='No contacts recorded yet.' />
        : (
          <>
            {primary.length > 0 && (
              <div>
                <SectionHeader title='Primary' color={A.gold} count={primary.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {primary.map(c => <ContactCard key={c.id} contact={c} />)}
                </div>
              </div>
            )}
            {secondary.length > 0 && (
              <div>
                <SectionHeader title='Other' count={secondary.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {secondary.map(c => <ContactCard key={c.id} contact={c} />)}
                </div>
              </div>
            )}
          </>
        )
      }
    </div>
  )
}

// ── SensitiveSection ──────────────────────────────────────────────────────────

function SensitiveSection({ data, houseId, onReload, personRef }: {
  data: AllData; houseId: string; onReload: () => void
  personRef: (id: string | null) => string | null
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ data_key: '', data_value: '', access_note: '', person_id: '' })
  const { success, error }  = useAdminToast()

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
      success('Added.')
      setAdding(false)
      setDraft({ data_key: '', data_value: '', access_note: '', person_id: '' })
      await onReload()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!window.confirm('Permanently delete this record?')) return
    try { await deletePPDPeopleEntry(id); success('Deleted.'); await onReload() }
    catch (e) { error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '9px 14px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🔒</span>
        <span style={{ fontSize: 11, color: '#f87171', fontFamily: A.font }}>Personal data. Handle with strict discretion.</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add Record</button>}
      </div>
      {adding && (
        <AddFormShell danger>
          <Field label='Person'>
            <select style={inputStyle} value={draft.person_id} onChange={e => setDraft(d => ({ ...d, person_id: e.target.value }))}>
              <option value=''>Household</option>
              {data.people.map(p => <option key={p.id} value={p.person_id ?? ''}>{p.member_ref} ({p.role})</option>)}
            </select>
          </Field>
          <Field label='Field'>
            <select style={inputStyle} value={draft.data_key} onChange={e => setDraft(d => ({ ...d, data_key: e.target.value }))}>
              <option value=''>Select...</option>
              {PPD_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label='Value'><PPDValueInput dataKey={draft.data_key} value={draft.data_value} onChange={v => setDraft(d => ({ ...d, data_value: v }))} /></Field>
          <Field label='Access Note (optional)'><input style={inputStyle} placeholder='Who has access...' value={draft.access_note} onChange={e => setDraft(d => ({ ...d, access_note: e.target.value }))} /></Field>
          <FormActions onCancel={() => setAdding(false)} onSave={handleAdd} saving={saving} />
        </AddFormShell>
      )}
      {data.ppd.length === 0
        ? <AdminEmptyState message='No personal data records yet.' />
        : Array.from(grouped.entries()).map(([key, rows]) => (
          <div key={key}>
            <AdminSection title={key === '__household__' ? 'Household' : (data.people.find(pe => pe.person_id === rows[0].person_id)?.member_ref ?? 'Unknown')} style={{ borderLeftColor: '#f8717150' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
              {rows.map(entry => (
                <EntryCard key={entry.id} danger>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: A.muted, fontFamily: A.font }}>{entry.data_key}</div>
                      <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>{entry.data_value}</div>
                      {entry.access_note && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2, fontStyle: 'italic' }}>{entry.access_note}</div>}
                    </div>
                    <CopyButton value={entry.data_value} />
                    <button onClick={() => remove(entry.id)} style={btnD}>x</button>
                  </div>
                </EntryCard>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ── NotesSection ──────────────────────────────────────────────────────────────

function NotesSection({ house, onSaved }: { house: House; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(house)
  const [saving, setSaving]   = useState(false)
  const { success, error }    = useAdminToast()

  const FIELDS: Array<{ key: keyof House; label: string; placeholder: string; danger?: boolean }> = [
    { key: 'service_style_notes', label: 'Service Style', placeholder: 'How this household expects to be served...' },
    { key: 'travel_style_notes',  label: 'Travel Style',  placeholder: 'Travel pace, preferred destinations...' },
    { key: 'avoid_notes',         label: 'Avoid',         placeholder: 'Hard avoids -- destinations, experiences, vendors...', danger: true },
    { key: 'service_notes',       label: 'Service Notes', placeholder: 'Operational notes for the service team...' },
    { key: 'missing_info_notes',  label: 'Missing Info',  placeholder: 'What we still need to learn...' },
  ]

  async function handleSave() {
    setSaving(true)
    try {
      await updateHouse(house.id, { service_style_notes: draft.service_style_notes, travel_style_notes: draft.travel_style_notes, avoid_notes: draft.avoid_notes, service_notes: draft.service_notes, missing_info_notes: draft.missing_info_notes })
      success('Saved.')
      setEditing(false)
      onSaved()
    } catch (e) { error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {editing ? (
          <FormActions onCancel={() => { setEditing(false); setDraft(house) }} onSave={handleSave} saving={saving} saveLabel='Save' />
        ) : (
          <button onClick={() => setEditing(true)} style={btnG}>Edit</button>
        )}
      </div>
      {FIELDS.map(({ key, label, placeholder, danger }) => {
        const val   = house[key] as string | null
        const color = danger ? '#f87171' : undefined
        return (
          <div key={key as string}>
            <AdminSection title={label} style={{ borderLeftColor: danger ? '#f8717150' : undefined }} />
            <div style={{ marginTop: 8 }}>
              {editing ? (
                <textarea style={{ ...textareaStyle, borderColor: danger ? '#f8717130' : A.border, minHeight: 88 }} value={(draft[key] as string) ?? ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value || null }))} placeholder={placeholder} />
              ) : val ? (
                <div style={{ padding: '12px 14px', background: A.bgCard, border: `1px solid ${danger ? '#f8717125' : A.border}`, borderRadius: 8, fontSize: 13, color: color ?? A.text, fontFamily: A.font, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{val}</div>
              ) : (
                <AdminEmptyState message='Not recorded -- click Edit to add.' />
              )}
            </div>
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