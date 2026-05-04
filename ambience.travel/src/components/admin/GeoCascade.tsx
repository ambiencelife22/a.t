// GeoCascade.tsx — reusable cascading dropdown for geography + storage path
// Owns: subcontinent → country → (state) → destination → category → (hotel)
//       cascade UI. Custom-path toggle/free-text fallback.
// Not owned: queries (see adminGeoQueries.ts), upload pipeline
//            (adminAssetQueries.ts), storage path composition (storagePath.ts).
//
// Last updated: S33B

import { useEffect, useState } from 'react'
import {
  fetchSubcontinents,
  fetchCountriesBySubcontinent,
  fetchStatesByCountry,
  fetchDestinations,
  fetchHotelsByDestination,
  type GeoSubcontinent,
  type GeoCountry,
  type GeoState,
  type GeoDestination,
  type GeoHotel,
} from '../../lib/adminGeoQueries'
import {
  resolveStoragePath,
  type AssetCategory,
} from '../../lib/storagePath'
import { A } from '../../lib/adminTokens'

// ── Selection emitted by the cascade ──────────────────────────────────────────

export type GeoCascadeValue = {
  // Free-text mode — user typed a path manually
  customPath?: string
  // Cascade mode — fully resolved
  destination?: GeoDestination
  category?:    AssetCategory
  hotel?:       GeoHotel | null
  // The composed storage path. null when destination has no storage_path
  // configured AND custom-path is empty.
  resolvedPath: string | null
}

// ── Styles ────────────────────────────────────────────────────────────────────

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

const selectStyle: React.CSSProperties = {
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
  cursor:       'pointer',
}

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  cursor:     'text',
  fontFamily: "'DM Mono', monospace",
}

const fieldGap = 12

// ── Component ─────────────────────────────────────────────────────────────────

export default function GeoCascade({
  onChange,
}: {
  onChange: (value: GeoCascadeValue) => void
}) {
  // Mode toggle
  const [customMode, setCustomMode] = useState(false)
  const [customPath, setCustomPath] = useState('')

  // Cascade option lists
  const [subcontinents, setSubcontinents] = useState<GeoSubcontinent[]>([])
  const [countries,     setCountries]     = useState<GeoCountry[]>([])
  const [states,        setStates]        = useState<GeoState[]>([])
  const [destinations,  setDestinations]  = useState<GeoDestination[]>([])
  const [hotels,        setHotels]        = useState<GeoHotel[]>([])

  // Cascade selections
  const [subId,        setSubId]        = useState<string>('')
  const [countryId,    setCountryId]    = useState<string>('')
  const [stateId,      setStateId]      = useState<string>('')
  const [destinationId, setDestinationId] = useState<string>('')
  const [category,     setCategory]     = useState<AssetCategory>('hero')
  const [hotelId,      setHotelId]      = useState<string>('')

  // ── Initial subcontinents ───────────────────────────────────────────────
  useEffect(() => {
    fetchSubcontinents().then(setSubcontinents).catch(() => setSubcontinents([]))
  }, [])

  // ── Cascade fetches ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!subId) { setCountries([]); setCountryId(''); return }
    fetchCountriesBySubcontinent(subId).then(setCountries).catch(() => setCountries([]))
    setCountryId('')
    setStates([]); setStateId('')
    setDestinations([]); setDestinationId('')
    setHotels([]); setHotelId('')
  }, [subId])

  useEffect(() => {
    if (!countryId) { setStates([]); setStateId(''); return }
    fetchStatesByCountry(countryId).then(setStates).catch(() => setStates([]))
    setStateId('')
    setDestinations([]); setDestinationId('')
    setHotels([]); setHotelId('')
  }, [countryId])

  useEffect(() => {
    // Destinations cascade off the most-specific FK available
    if (stateId) {
      fetchDestinations({ stateId }).then(setDestinations).catch(() => setDestinations([]))
    }
    if (!stateId && countryId) {
      fetchDestinations({ countryId }).then(setDestinations).catch(() => setDestinations([]))
    }
    if (!stateId && !countryId) {
      setDestinations([])
    }
    setDestinationId('')
    setHotels([]); setHotelId('')
  }, [stateId, countryId])

  // Hotels load only when category=accom and destination is selected
  useEffect(() => {
    if (category !== 'accom' || !destinationId) {
      setHotels([])
      setHotelId('')
      return
    }
    fetchHotelsByDestination(destinationId).then(setHotels).catch(() => setHotels([]))
    setHotelId('')
  }, [category, destinationId])

  // ── Resolve + emit ──────────────────────────────────────────────────────
  useEffect(() => {
    if (customMode) {
      const trimmed = customPath.trim()
      onChange({
        customPath: trimmed || undefined,
        resolvedPath: trimmed.length > 0 ? trimmed : null,
      })
      return
    }

    const dest  = destinations.find(d => d.id === destinationId) ?? undefined
    const hotel = hotels.find(h => h.id === hotelId) ?? null

    if (!dest) {
      onChange({ resolvedPath: null })
      return
    }

    const hotelStorageSlug = hotel
      ? (hotel.short_slug || hotel.slug)
      : undefined

    const resolved = resolveStoragePath({
      destinationStoragePath: dest.storage_path,
      category,
      hotelStorageSlug,
    })

    onChange({
      destination: dest,
      category,
      hotel,
      resolvedPath: resolved,
    })
  }, [customMode, customPath, destinations, destinationId, category, hotels, hotelId, onChange])

  // ── Render helpers ──────────────────────────────────────────────────────
  const selectedDest = destinations.find(d => d.id === destinationId)
  const showStateField = states.length > 0
  const showHotelField = category === 'accom' && destinationId.length > 0

  // Status indicator beneath the cascade
  const noStoragePath = !customMode && selectedDest && !selectedDest.storage_path

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Cascade body — hidden when custom mode is on */}
      {!customMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: fieldGap }}>
          <div>
            <label style={labelStyle}>Subcontinent</label>
            <select
              style={selectStyle}
              value={subId}
              onChange={e => setSubId(e.target.value)}
            >
              <option value=''>Select subcontinent…</option>
              {subcontinents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <select
              style={selectStyle}
              value={countryId}
              onChange={e => setCountryId(e.target.value)}
              disabled={!subId || countries.length === 0}
            >
              <option value=''>{subId ? 'Select country…' : '—'}</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {showStateField && (
            <div>
              <label style={labelStyle}>State</label>
              <select
                style={selectStyle}
                value={stateId}
                onChange={e => setStateId(e.target.value)}
              >
                <option value=''>(no state)</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {!showStateField && <div />}

          <div>
            <label style={labelStyle}>Destination</label>
            <select
              style={selectStyle}
              value={destinationId}
              onChange={e => setDestinationId(e.target.value)}
              disabled={destinations.length === 0}
            >
              <option value=''>{countryId ? 'Select destination…' : '—'}</option>
              {destinations.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{!d.storage_path && '  (no path)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select
              style={selectStyle}
              value={category}
              onChange={e => setCategory(e.target.value as AssetCategory)}
            >
              <option value='hero'>hero</option>
              <option value='accom'>accom</option>
              <option value='dining'>dining</option>
              <option value='experiences'>experiences</option>
            </select>
          </div>

          {showHotelField && (
            <div>
              <label style={labelStyle}>Hotel</label>
              <select
                style={selectStyle}
                value={hotelId}
                onChange={e => setHotelId(e.target.value)}
                disabled={hotels.length === 0}
              >
                <option value=''>Select hotel…</option>
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.short_slug || h.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
          {!showHotelField && <div />}
        </div>
      )}

      {/* Custom-path mode body */}
      {customMode && (
        <div>
          <label style={labelStyle}>Custom storage path</label>
          <input
            style={inputStyle}
            value={customPath}
            onChange={e => setCustomPath(e.target.value)}
            placeholder='immerse/me/ksa  (no leading or trailing slash)'
          />
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 6 }}>
            Used when the destination has no canonical path configured, or for ad-hoc folders like z-general.
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setCustomMode(m => !m)}
          style={{
            background:   'transparent',
            border:       `1px solid ${A.border}`,
            color:        A.muted,
            fontSize:     11,
            fontWeight:   600,
            fontFamily:   A.font,
            padding:      '6px 12px',
            borderRadius: 8,
            cursor:       'pointer',
          }}
        >
          {customMode ? '← Use cascade' : 'Use custom path →'}
        </button>
        {noStoragePath && (
          <span style={{ fontSize: 11, color: A.danger, fontFamily: A.font }}>
            This destination has no canonical path — switch to custom path.
          </span>
        )}
      </div>
    </div>
  )
}