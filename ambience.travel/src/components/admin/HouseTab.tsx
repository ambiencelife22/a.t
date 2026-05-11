/* HouseTab.tsx
 * ambience.HOUSE — private client intelligence platform.
 *
 * Design: premium concierge dossier. Speed of access over completeness of display.
 * The travel designer reads mid-call, mid-booking. Every element earns its place.
 *
 * Structure:
 *   HouseList     → Household cards with pull-quote, service style, avoid strip
 *   HouseDetail   → Two-panel layout: fixed context sidebar + scrollable content panel
 *     Overview    → People, top confirmed preferences, favourites + avoids at a glance
 *     Preferences → Card-based, confidence as left border, category tabs, inline filter
 *     Dining      → Grouped by status, colour-coded left border, inline status change
 *     Sensitive   → One-click copy for every field. Grouped by person.
 *     Notes       → Freeform overview fields (service style, travel style, etc.)
 *
 * Global search filters across preferences, dining, and sensitive simultaneously.
 * Keyboard shortcut: / to focus search.
 *
 * Toast: useToast() from ToastContext — ToastContainer mounted in main.tsx.
 * Styles: canonical shared objects from adminStyles.ts.
 * UI atoms: Field, SectionLabel, CopyButton from adminUi.tsx.
 *
 * Last updated: S40D (refactor) — extracted Toast/useToast, style objects,
 *   Field, SectionLabel, CopyButton to shared modules.
 * Prior: S40D — initial ship (full dossier platform design).
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
  fetchHouses,
  fetchHouseById,
  fetchPeopleForHouse,
  fetchPreferencesForHouse,
  fetchDiningHistoryForHouse,
  fetchPPDForHouse,
  updateHouse,
  createPerson, deletePerson,
  createPreference, updatePreference, deletePreference,
  createDiningEntry, updateDiningEntry, deleteDiningEntry,
  createPPDEntry, deletePPDEntry,
  type House,
  type HousePerson,
  type HousePreference,
  type HouseDiningEntry,
  type HousePPDEntry,
  type PrefCategory,
  type PrefConfidence,
  type DiningStatus,
} from '../../lib/adminHouseQueries'

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

const DESIG_COLOR: Record<string, string> = {
  HRH: '#c084fc', HH: '#93c5fd', VVIP: '#D8B56A',
}

const PREF_CATEGORIES: PrefCategory[] = ['Dietary', 'Travel', 'Service', 'Beverage']

const PREF_KEYS: Record<PrefCategory, string[]> = {
  Dietary:  ['Halal', 'Kosher', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Shellfish Allergy', 'Dairy-Free', 'No Pork', 'No Alcohol', 'Preferred Cuisine', 'Avoid Cuisine', 'Favourite Dish', 'Avoid Ingredient', 'Medical Dietary Note'],
  Travel:   ['Seat Preference', 'Cabin Class', 'Preferred Airline', 'Avoided Airline', 'Aircraft Preference', 'Departure Airport', 'Hotel Brand Preference', 'Room Type', 'Floor Preference', 'Bed Configuration', 'Pillow Preference', 'Temperature', 'Arrival Protocol', 'Transfer Preference', 'Luggage Note'],
  Service:  ['Communication Style', 'Salutation', 'Response Time Expectation', 'Point of Contact', 'Staff Note', 'Privacy Level', 'Photography Preference', 'Media Policy', 'Gift Preference', 'Flowers', 'Fragrance Sensitivity', 'Occasion Note', 'VIP Note', 'Protocol Note'],
  Beverage: ['Water Preference', 'Coffee Order', 'Tea Preference', 'Champagne Brand', 'White Wine Style', 'Red Wine Style', 'Spirits Preference', 'Cocktail Preference', 'Non-Alcoholic Preference', 'Minibar Note', 'Bottle Service Note', 'Cellar Note'],
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

// ── Household list ────────────────────────────────────────────────────────────

function HouseList({ onSelect }: { onSelect: (h: House) => void }) {
  const [houses, setHouses]   = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const { toast }             = useToast()

  useEffect(() => {
    fetchHouses()
      .then(setHouses)
      .catch(e => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return houses
    return houses.filter(h =>
      h.display_name.toLowerCase().includes(q) ||
      h.a_house_id.toLowerCase().includes(q) ||
      (h.service_style_notes ?? '').toLowerCase().includes(q) ||
      (h.avoid_notes ?? '').toLowerCase().includes(q)
    )
  }, [houses, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 6 }}>ambience · HOUSE</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em', marginBottom: 3 }}>Client Households</div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>{houses.length} household{houses.length !== 1 ? 's' : ''}</div>
      </div>
      <input style={{ ...inputStyle, fontSize: 13, padding: '11px 14px' }} placeholder='Search…' value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      {loading ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No results.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
      style={{
        padding: '18px 22px 14px', background: hov ? '#1a1f1c' : A.bgCard,
        border: `1px solid ${hov ? A.gold + '50' : A.border}`, borderRadius: 12,
        cursor: 'pointer', transition: 'all 0.12s ease',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>{house.display_name}</span>
          {house.designation && (
            <span style={{
              padding: '1px 7px', borderRadius: 5,
              background: (DESIG_COLOR[house.designation] ?? A.gold) + '18',
              border: `1px solid ${(DESIG_COLOR[house.designation] ?? A.gold)}35`,
              color: DESIG_COLOR[house.designation] ?? A.gold,
              fontSize: 9, fontWeight: 700, fontFamily: A.font, letterSpacing: '0.1em',
            }}>{house.designation}</span>
          )}
          <span style={{ fontSize: 9, color: house.status === 'active' ? '#4ade80' : A.faint, fontFamily: A.font, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{house.status}</span>
        </div>
        <span style={{ color: A.gold, opacity: hov ? 0.9 : 0.2, transition: 'opacity 0.12s', fontSize: 14 }}>→</span>
      </div>
      {house.service_style_notes && (
        <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, fontStyle: 'italic', lineHeight: 1.5, borderLeft: `2px solid ${A.gold}35`, paddingLeft: 10 }}>
          {house.service_style_notes.length > 130 ? house.service_style_notes.slice(0, 130) + '…' : house.service_style_notes}
        </div>
      )}
      {house.avoid_notes && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', fontFamily: A.font, letterSpacing: '0.1em', textTransform: 'uppercase', paddingTop: 1, whiteSpace: 'nowrap' }}>Avoid</span>
          <span style={{ fontSize: 11, color: '#f87171', fontFamily: A.font, opacity: 0.8, lineHeight: 1.5 }}>
            {house.avoid_notes.length > 90 ? house.avoid_notes.slice(0, 90) + '…' : house.avoid_notes}
          </span>
        </div>
      )}
      <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{house.a_house_id}</div>
    </div>
  )
}

// ── House detail ──────────────────────────────────────────────────────────────

type Section = 'overview' | 'preferences' | 'dining' | 'sensitive' | 'notes'

interface AllData {
  people:      HousePerson[]
  preferences: HousePreference[]
  dining:      HouseDiningEntry[]
  ppd:         HousePPDEntry[]
}

function HouseDetail({ house: init, onBack }: { house: House; onBack: () => void }) {
  const [house, setHouse]     = useState<House>(init)
  const [section, setSection] = useState<Section>('overview')
  const [q, setQ]             = useState('')
  const [data, setData]       = useState<AllData>({ people: [], preferences: [], dining: [], ppd: [] })
  const [loading, setLoading] = useState(true)
  const { toast }             = useToast()
  const searchRef             = useRef<HTMLInputElement>(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [people, preferences, dining, ppd] = await Promise.all([
        fetchPeopleForHouse(house.id),
        fetchPreferencesForHouse(house.id),
        fetchDiningHistoryForHouse(house.id),
        fetchPPDForHouse(house.id),
      ])
      setData({ people, preferences, dining, ppd })
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
      preferences: data.preferences.filter(p => p.pref_key.toLowerCase().includes(query) || p.pref_value.toLowerCase().includes(query) || (p.notes ?? '').toLowerCase().includes(query)),
      dining:      data.dining.filter(d => d.restaurant_name.toLowerCase().includes(query) || (d.city ?? '').toLowerCase().includes(query) || (d.notes ?? '').toLowerCase().includes(query)),
      ppd:         data.ppd.filter(p => p.data_key.toLowerCase().includes(query) || p.data_value.toLowerCase().includes(query)),
    }
  }, [q, data])

  const sidebarPrefs = useMemo(() => {
    const confirmed = data.preferences.filter(p => p.confidence === 'confirmed')
    const out: Partial<Record<PrefCategory, HousePreference[]>> = {}
    for (const cat of PREF_CATEGORIES) {
      const items = confirmed.filter(p => p.category === cat).slice(0, 3)
      if (items.length) out[cat] = items
    }
    return out
  }, [data.preferences])

  const avoidDining = data.dining.filter(d => d.status === 'avoid')

  const NAV: Array<{ id: Section; label: string; count?: number }> = [
    { id: 'overview',    label: 'Overview' },
    { id: 'preferences', label: 'Preferences', count: data.preferences.length },
    { id: 'dining',      label: 'Dining',       count: data.dining.length },
    { id: 'sensitive',   label: 'Sensitive',    count: data.ppd.length },
    { id: 'notes',       label: 'Notes' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ ...btnG, padding: '5px 10px', fontSize: 11 }}>← All</button>
          <span style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{house.display_name}</span>
          {house.designation && (
            <span style={{
              padding: '2px 8px', borderRadius: 5,
              background: (DESIG_COLOR[house.designation] ?? A.gold) + '18',
              border: `1px solid ${(DESIG_COLOR[house.designation] ?? A.gold)}35`,
              color: DESIG_COLOR[house.designation] ?? A.gold,
              fontSize: 9, fontWeight: 700, fontFamily: A.font, letterSpacing: '0.1em',
            }}>{house.designation}</span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            style={{ ...inputStyle, width: 230, paddingRight: 30 }}
            placeholder='Search everything… (/)'
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: A.faint, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchResults && (
        <SearchResults results={searchResults} personRef={personRef} onClose={() => setQ('')} />
      )}

      {/* Two-panel layout */}
      {!searchResults && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>

          {/* Sidebar */}
          <div style={{ width: 210, flexShrink: 0, position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Nav */}
            <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {NAV.map((n, i) => (
                <button key={n.id} onClick={() => setSection(n.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px', textAlign: 'left',
                  background: section === n.id ? 'rgba(216,181,106,0.08)' : 'transparent',
                  borderLeft: section === n.id ? `2px solid ${A.gold}` : '2px solid transparent',
                  border: 'none',
                  borderBottom: i < NAV.length - 1 ? `1px solid ${A.border}` : 'none',
                  color: section === n.id ? A.gold : A.muted,
                  fontSize: 12, fontWeight: section === n.id ? 700 : 500,
                  fontFamily: A.font, cursor: 'pointer',
                }}>
                  <span>{n.label}</span>
                  {n.count !== undefined && n.count > 0 && (
                    <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{n.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* People */}
            {data.people.length > 0 && (
              <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <SectionLabel label='Household' />
                {data.people.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: `${A.gold}18`, border: `1px solid ${A.gold}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: A.gold, fontFamily: A.font, flexShrink: 0,
                    }}>{p.member_ref.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{p.member_ref}</div>
                      <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, textTransform: 'capitalize' }}>{p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Key confirmed prefs */}
            {Object.entries(sidebarPrefs).map(([cat, prefs]) => (
              <div key={cat} style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <SectionLabel label={cat} />
                {prefs!.map(p => (
                  <div key={p.id} style={{ marginBottom: 7 }}>
                    <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.pref_key}</div>
                    <div style={{ fontSize: 11, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{p.pref_value}</div>
                  </div>
                ))}
              </div>
            ))}

            {/* Dining avoids */}
            {avoidDining.length > 0 && (
              <div style={{ background: '#2a161630', border: '1px solid #f8717125', borderRadius: 10, padding: '12px 14px' }}>
                <SectionLabel label='Dining Avoids' color='#f87171' />
                {avoidDining.map(d => (
                  <div key={d.id} style={{ fontSize: 11, color: '#f87171', fontFamily: A.font, marginBottom: 4, opacity: 0.85 }}>
                    {d.restaurant_name}{d.city && <span style={{ opacity: 0.6 }}> · {d.city}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading…</div>
            ) : (
              <>
                {section === 'overview'    && <OverviewSection    house={house} data={data} onSaved={reloadHouse} onReload={loadAll} />}
                {section === 'preferences' && <PreferencesSection data={data}   houseId={house.id} onReload={loadAll} personRef={personRef} />}
                {section === 'dining'      && <DiningSection      data={data}   houseId={house.id} onReload={loadAll} />}
                {section === 'sensitive'   && <SensitiveSection   data={data}   houseId={house.id} onReload={loadAll} personRef={personRef} />}
                {section === 'notes'       && <NotesSection       house={house} onSaved={reloadHouse} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Search results ────────────────────────────────────────────────────────────

function SearchResults({
  results, personRef, onClose,
}: {
  results: { preferences: HousePreference[]; dining: HouseDiningEntry[]; ppd: HousePPDEntry[] }
  personRef: (id: string | null) => string | null
  onClose: () => void
}) {
  const total = results.preferences.length + results.dining.length + results.ppd.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{total} result{total !== 1 ? 's' : ''}</span>
        <button onClick={onClose} style={{ ...btnG, padding: '4px 10px', fontSize: 11 }}>Clear</button>
      </div>

      {results.preferences.length > 0 && (
        <div>
          <SectionLabel label='Preferences' />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {results.preferences.map(p => (
              <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`, borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.category} · {p.pref_key}{personRef(p.person_id) ? ` · ${personRef(p.person_id)}` : ''}</div>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{p.pref_value}</div>
                </div>
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
              <div key={d.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${STATUS[d.status].text}`, borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{d.restaurant_name}</div>
                  <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[d.city, d.country].filter(Boolean).join(', ')}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS[d.status].text, fontFamily: A.font, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{STATUS[d.status].label}</span>
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
              <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{p.data_key}</div>
                  <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{p.data_value}</div>
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

function OverviewSection({ house, data, onSaved, onReload }: {
  house: House; data: AllData
  onSaved: () => void; onReload: () => void
}) {
  const [addingPerson, setAddingPerson] = useState(false)
  const [pd, setPd]   = useState({ member_ref: '', role: 'principal', notes: '' })
  const [saving, setSaving] = useState(false)
  const { toast }     = useToast()

  const topPrefs = data.preferences.filter(p => p.confidence === 'confirmed').slice(0, 6)
  const favs     = data.dining.filter(d => d.status === 'favorite')
  const avoids   = data.dining.filter(d => d.status === 'avoid')

  async function addPerson() {
    if (!pd.member_ref.trim()) return
    setSaving(true)
    try {
      await createPerson(house.id, pd.member_ref.trim(), pd.role, pd.notes.trim() || null)
      toast.success('Added.')
      setAddingPerson(false); setPd({ member_ref: '', role: 'principal', notes: '' })
      await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function removePerson(id: string) {
    try { await deletePerson(id); toast.success('Removed.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <SectionLabel label='Household Members' />
          {!addingPerson && <button onClick={() => setAddingPerson(true)} style={{ ...btnG, padding: '4px 10px', fontSize: 10 }}>+ Add</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.people.map(p => (
            <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${A.gold}18`, border: `1px solid ${A.gold}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: A.gold, fontFamily: A.font, flexShrink: 0 }}>
                {p.member_ref.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{p.member_ref}</div>
                <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, textTransform: 'capitalize' }}>{p.role}</div>
              </div>
              <button onClick={() => removePerson(p.id)} style={{ ...btnD, marginLeft: 4, fontSize: 12 }}>×</button>
            </div>
          ))}
          {data.people.length === 0 && !addingPerson && (
            <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No members yet.</div>
          )}
        </div>
        {addingPerson && (
          <div style={{ marginTop: 10, padding: '14px 16px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label='Reference Code'><input style={inputStyle} placeholder='J, K, Child 1…' value={pd.member_ref} onChange={e => setPd(d => ({ ...d, member_ref: e.target.value }))} autoFocus /></Field>
              <Field label='Role'>
                <select style={inputStyle} value={pd.role} onChange={e => setPd(d => ({ ...d, role: e.target.value }))}>
                  {['principal','spouse','child','staff','advisor','guest'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAddingPerson(false)} style={btnG}>Cancel</button>
              <button onClick={addPerson} style={{ ...btnP, opacity: saving ? 0.5 : 1 }} disabled={saving}>Add</button>
            </div>
          </div>
        )}
      </div>

      {topPrefs.length > 0 && (
        <div>
          <SectionLabel label='Key Preferences' />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {topPrefs.map(p => (
              <div key={p.id} style={{ padding: '10px 14px', background: A.bgCard, border: `1px solid ${A.border}`, borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font, marginBottom: 3 }}>{p.category} · {p.pref_key}</div>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{p.pref_value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(favs.length > 0 || avoids.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: favs.length && avoids.length ? '1fr 1fr' : '1fr', gap: 12 }}>
          {favs.length > 0 && (
            <div style={{ padding: '14px 16px', background: '#D8B56A08', border: '1px solid #D8B56A25', borderRadius: 10 }}>
              <SectionLabel label='Favourite Restaurants' color={A.gold} />
              {favs.slice(0, 5).map(d => (
                <div key={d.id} style={{ fontSize: 12, color: A.text, fontFamily: A.font, marginBottom: 5 }}>
                  {d.restaurant_name}{d.city && <span style={{ color: A.faint, fontSize: 11 }}> · {d.city}</span>}
                </div>
              ))}
              {favs.length > 5 && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>+{favs.length - 5} more</div>}
            </div>
          )}
          {avoids.length > 0 && (
            <div style={{ padding: '14px 16px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 10 }}>
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
    </div>
  )
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesSection({ data, houseId, onReload, personRef }: {
  data: AllData; houseId: string
  onReload: () => void
  personRef: (id: string | null) => string | null
}) {
  const [cat, setCat]       = useState<PrefCategory>('Dietary')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [draft, setDraft]   = useState({ pref_key: '', pref_value: '', notes: '', source: 'manual', confidence: 'confirmed' as PrefConfidence, person_id: '' })
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
      await createPreference(houseId, draft.person_id || null, cat, draft.pref_key.trim(), draft.pref_value.trim(), draft.notes.trim() || null, draft.source || 'manual', draft.confidence)
      toast.success('Added.')
      setAdding(false); setDraft({ pref_key: '', pref_value: '', notes: '', source: 'manual', confidence: 'confirmed', person_id: '' })
      await onReload()
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {PREF_CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCat(c); setAdding(false) }} style={{
            padding: '6px 13px',
            background:   cat === c ? 'rgba(216,181,106,0.10)' : 'transparent',
            color:        cat === c ? A.gold : A.muted,
            border:       cat === c ? '1px solid rgba(216,181,106,0.28)' : `1px solid ${A.border}`,
            borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
          }}>
            {c} {catCount(c) > 0 && <span style={{ opacity: 0.55 }}>({catCount(c)})</span>}
          </button>
        ))}
        <input style={{ ...inputStyle, width: 140, marginLeft: 'auto' }} placeholder='Filter…' value={filter} onChange={e => setFilter(e.target.value)} />
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add</button>}
      </div>

      {adding && (
        <div style={{ padding: '14px 16px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label='Key'>
              <select style={inputStyle} value={draft.pref_key} onChange={e => setDraft(d => ({ ...d, pref_key: e.target.value }))}>
                <option value=''>Select…</option>
                {(PREF_KEYS[cat] ?? []).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
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
          <Field label='Value'><input style={inputStyle} placeholder='e.g. Halal only, Window seat always…' value={draft.pref_value} onChange={e => setDraft(d => ({ ...d, pref_value: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label='Source'><input style={inputStyle} placeholder='manual, trip:YAZ-2027-HM…' value={draft.source} onChange={e => setDraft(d => ({ ...d, source: e.target.value }))} /></Field>
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
              padding: '11px 16px', background: A.bgCard,
              border: `1px solid ${A.border}`, borderLeft: `3px solid ${CONF_COLOR[p.confidence]}`,
              borderRadius: 8, display: 'grid', gridTemplateColumns: '170px 1fr auto',
              gap: 12, alignItems: 'center', opacity: p.confidence === 'outdated' ? 0.55 : 1,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: A.muted, fontFamily: A.font }}>{p.pref_key}</div>
                {personRef(p.person_id) && <div style={{ fontSize: 9, color: A.faint, fontFamily: A.font, marginTop: 1 }}>{personRef(p.person_id)}</div>}
                <div style={{ fontSize: 9, color: A.faint, fontFamily: A.font, marginTop: 1 }}>{p.source}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: A.text, fontFamily: A.font, fontWeight: 600 }}>{p.pref_value}</div>
                {p.notes && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 2, fontStyle: 'italic' }}>{p.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {p.confidence !== 'confirmed' && (
                  <button onClick={() => confirm(p)} style={{ ...btnG, padding: '3px 8px', fontSize: 10, color: '#4ade80', borderColor: '#4ade8030' }}>Confirm</button>
                )}
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

function DiningSection({ data, houseId, onReload }: {
  data: AllData; houseId: string; onReload: () => void
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
      toast.success('Added.')
      setAdding(false); setDraft({ restaurant_name: '', city: '', country: '', status: 'visited', visit_date: '', trip_ref: '', notes: '' })
      await onReload()
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {(['all', ...STATUSES] as const).map(s => {
          const count = counts[s] ?? 0
          const active = filter === s
          const color = s === 'all' ? A.gold : STATUS[s as DiningStatus].text
          return (
            <button key={s} onClick={() => setFilter(s as typeof filter)} style={{
              padding: '5px 12px',
              background:   active ? color + '12' : 'transparent',
              color:        active ? color : A.muted,
              border:       active ? `1px solid ${color}30` : `1px solid ${A.border}`,
              borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
            }}>
              {s === 'all' ? 'All' : s === 'to_try' ? 'To Try' : s.charAt(0).toUpperCase() + s.slice(1)}
              {count > 0 && <span style={{ marginLeft: 4, opacity: 0.55 }}>({count})</span>}
            </button>
          )
        })}
        <div style={{ marginLeft: 'auto' }}>
          {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add</button>}
        </div>
      </div>

      {adding && (
        <div style={{ padding: '14px 16px', background: A.bgCard, border: `1px solid ${A.gold}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
            <Field label='Restaurant'><input style={inputStyle} placeholder='Name…' value={draft.restaurant_name} onChange={e => setDraft(d => ({ ...d, restaurant_name: e.target.value }))} autoFocus /></Field>
            <Field label='City'><input style={inputStyle} placeholder='City…' value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} /></Field>
            <Field label='Country'><input style={inputStyle} placeholder='Country…' value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} /></Field>
            <Field label='Status'>
              <select style={inputStyle} value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as DiningStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s === 'to_try' ? 'To Try' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
            <Field label='Visit Date'><input type='date' style={{ ...inputStyle, colorScheme: 'dark' }} value={draft.visit_date} onChange={e => setDraft(d => ({ ...d, visit_date: e.target.value }))} /></Field>
            <Field label='Trip Ref'><input style={inputStyle} placeholder='YAZ-2027-HM…' value={draft.trip_ref} onChange={e => setDraft(d => ({ ...d, trip_ref: e.target.value }))} /></Field>
            <Field label='Notes'><input style={inputStyle} placeholder='What they thought…' value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
          </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {entries.map(e => (
                <div key={e.id} style={{
                  padding: '11px 16px', background: A.bgCard,
                  border: `1px solid ${A.border}`, borderLeft: `3px solid ${STATUS[status].text}`,
                  borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{e.restaurant_name}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                      {(e.city || e.country) && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{[e.city, e.country].filter(Boolean).join(', ')}</span>}
                      {e.visit_date && <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>{new Date(e.visit_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                      {e.trip_ref && <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{e.trip_ref}</span>}
                    </div>
                    {e.notes && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginTop: 3, fontStyle: 'italic' }}>{e.notes}</div>}
                  </div>
                  <select value={e.status} onChange={ev => changeStatus(e, ev.target.value as DiningStatus)} style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 11, flexShrink: 0 }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s === 'to_try' ? 'To Try' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <button onClick={() => remove(e.id)} style={btnD}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Sensitive section ─────────────────────────────────────────────────────────

function SensitiveSection({ data, houseId, onReload, personRef }: {
  data: AllData; houseId: string
  onReload: () => void
  personRef: (id: string | null) => string | null
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft]   = useState({ data_key: '', data_value: '', access_note: '', person_id: '' })
  const { toast }           = useToast()

  const grouped = useMemo(() => {
    const m = new Map<string, HousePPDEntry[]>()
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
      await createPPDEntry(houseId, draft.person_id || null, draft.data_key.trim(), draft.data_value.trim(), draft.access_note.trim() || null)
      toast.success('Added.')
      setAdding(false); setDraft({ data_key: '', data_value: '', access_note: '', person_id: '' })
      await onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!window.confirm('Permanently delete this record?')) return
    try { await deletePPDEntry(id); toast.success('Deleted.'); await onReload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '9px 14px', background: '#f8717108', border: '1px solid #f8717125', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12 }}>🔒</span>
        <span style={{ fontSize: 11, color: '#f87171', fontFamily: A.font }}>Sensitive personal data. Handle with strict discretion.</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!adding && <button onClick={() => setAdding(true)} style={btnP}>+ Add Record</button>}
      </div>
      {adding && (
        <div style={{ padding: '14px 16px', background: A.bgCard, border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
          </div>
          <Field label='Value'><input style={inputStyle} placeholder='Enter value…' value={draft.data_value} onChange={e => setDraft(d => ({ ...d, data_value: e.target.value }))} autoComplete='off' autoFocus /></Field>
          <Field label='Access Note (optional)'><input style={inputStyle} placeholder='Who has access, any handling notes…' value={draft.access_note} onChange={e => setDraft(d => ({ ...d, access_note: e.target.value }))} /></Field>
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
                <div key={entry.id} style={{
                  display: 'grid', gridTemplateColumns: '160px 1fr auto auto',
                  gap: 12, alignItems: 'center',
                  padding: '10px 16px', background: A.bgCard,
                  border: '1px solid rgba(248,113,113,0.12)', borderRadius: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: A.muted, fontFamily: A.font }}>{entry.data_key}</div>
                  <div>
                    <div style={{ fontSize: 13, color: A.text, fontFamily: 'DM Mono, monospace', fontWeight: 600, letterSpacing: '0.02em' }}>{entry.data_value}</div>
                    {entry.access_note && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 1, fontStyle: 'italic' }}>{entry.access_note}</div>}
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
      await updateHouse(house.id, {
        service_style_notes: draft.service_style_notes,
        travel_style_notes:  draft.travel_style_notes,
        avoid_notes:         draft.avoid_notes,
        service_notes:       draft.service_notes,
        missing_info_notes:  draft.missing_info_notes,
      })
      toast.success('Saved.')
      setEditing(false); onSaved()
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
              <textarea
                style={{ ...textareaStyle, borderColor: danger ? '#f8717130' : A.border, minHeight: 88 }}
                value={(draft[key] as string) ?? ''}
                onChange={e => setDraft(d => ({ ...d, [key]: e.target.value || null }))}
                placeholder={placeholder}
              />
            ) : val ? (
              <div style={{
                padding: '12px 16px', background: A.bgCard,
                border: `1px solid ${danger ? '#f8717125' : A.border}`, borderRadius: 8,
                fontSize: 13, color: danger ? '#f87171' : A.text,
                fontFamily: A.font, lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>{val}</div>
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