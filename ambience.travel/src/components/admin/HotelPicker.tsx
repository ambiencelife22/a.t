/* HotelPicker.tsx
 * Searchable picker over the global hotel catalog (travel_accom_hotels) for
 * linking a booking to its canon hotel (accom_hotel_id). Used by the
 * booking-create form in the dossier so a Hotel booking gets its catalog link
 * in-UI - closing the SQL-only booking-creation gap (the canon hotel id was
 * previously resolved by hand in SQL).
 *
 * Catalog data, read directly via fetchHotels - consistent with the other
 * direct travel_accom_hotels reads (queriesGuidesHotels, queriesAdminGeo).
 * Not client-private, so no EF indirection.
 *
 * Debounced server-side search (the catalog is large; unlike AirlinePicker
 * which loads its whole short list once). Resolves the selected hotel to a
 * "Name - City" confirmation label.
 *
 * Last updated: S54c - initial ship (booking-create coverage).
 */

import { useEffect, useRef, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { fetchHotels, type HotelPick } from '../../queries/queriesAdminGeo'

const boxedStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

export function HotelPicker({
  hotelId,
  onChange,
  showLabel = true,
}: {
  hotelId:    string
  onChange:   (hotelId: string, hotel: HotelPick | null) => void
  showLabel?: boolean
}) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<HotelPick[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [selected, setSelected] = useState<HotelPick | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef      = useRef<HTMLDivElement | null>(null)

  // Resolve the current hotelId to a label on mount / when it changes externally.
  useEffect(() => {
    if (!hotelId) { setSelected(null); return }
    if (selected?.id === hotelId) return
    fetchHotels()
      .then(rows => {
        const found = rows.find(h => h.id === hotelId) ?? null
        if (found) setSelected(found)
      })
      .catch(() => { /* leave unresolved */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  // Debounced search.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      fetchHotels(query)
        .then(rows => setResults(rows))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open])

  // Close dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const label = (h: HotelPick): string => h.city ? `${h.name} - ${h.city}` : h.name

  function pick(h: HotelPick) {
    setSelected(h)
    onChange(h.id, h)
    setOpen(false)
    setQuery('')
  }

  function clear() {
    setSelected(null)
    onChange('', null)
    setQuery('')
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      {showLabel && <label style={labelStyle}>Hotel</label>}

      {selected && !open ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...boxedStyle, flex: 1, display: 'flex', alignItems: 'center' }}>
            {label(selected)}
          </div>
          <button onClick={() => setOpen(true)}
            style={{ fontFamily: A.font, fontSize: 10, fontWeight: 600, color: A.gold, background: 'transparent', border: `1px solid ${A.gold}40`, borderRadius: 5, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>
            Change
          </button>
          <button onClick={clear}
            style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            Clear
          </button>
        </div>
      ) : (
        <input
          style={boxedStyle}
          value={query}
          placeholder='Search hotels by name...'
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
        />
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: 4, background: A.bgCard, border: `1px solid ${A.border}`,
          borderRadius: 6, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
        }}>
          {loading && <div style={{ padding: '8px 10px', fontSize: 11, color: A.faint, fontFamily: A.font }}>Searching...</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {query.trim() ? 'No hotels found' : 'Type to search'}
            </div>
          )}
          {!loading && results.map(h => (
            <button key={h.id} onClick={() => pick(h)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', borderBottom: `1px solid ${A.border}`, cursor: 'pointer', fontFamily: A.font }}>
              <span style={{ fontSize: 12, color: A.text }}>{h.name}</span>
              {h.city && <span style={{ fontSize: 10, color: A.faint, marginLeft: 6 }}>{h.city}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}