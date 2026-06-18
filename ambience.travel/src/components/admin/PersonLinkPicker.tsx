/* PersonLinkPicker.tsx
 * Shared searchable picker over the canonical person registry (global_people),
 * read via queriesGlobalPeople (EF-mediated). Sets a person_id link, with an
 * unlink-to-null action. Consumed by:
 *   - PersonModal (HouseTab) — link an a_house_people row to global_people
 *   - AuxPassengersEditor    — link a passenger to global_people
 *
 * Self-contained: own styles, debounced server-side search, resolves the
 * currently-linked person by id on mount so the label shows even before the
 * list is opened.
 */

import { useEffect, useRef, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import {
  fetchPeople, fetchPersonById,
  type GlobalPersonResolved,
} from '../../queries/queriesGlobalPeople'

const inputStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  width: '100%', boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

export function PersonLinkPicker({ label = 'Linked Person', personId, onChange }: {
  label?:   string
  personId: string | null
  onChange: (personId: string | null) => void
}) {
  const [linked,  setLinked]  = useState<GlobalPersonResolved | null>(null)
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<GlobalPersonResolved[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve the currently-linked person on mount / when personId changes.
  useEffect(() => {
    let cancelled = false
    if (!personId) { setLinked(null); return }
    fetchPersonById(personId)
      .then(p => { if (!cancelled) setLinked(p) })
      .catch(() => { if (!cancelled) setLinked(null) })
    return () => { cancelled = true }
  }, [personId])

  // Debounced server-side search while the picker is open.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      fetchPeople(query.trim() || undefined)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [open, query])

  function select(p: GlobalPersonResolved) {
    onChange(p.id)
    setLinked(p)
    setOpen(false)
    setQuery('')
  }

  function unlink() {
    onChange(null)
    setLinked(null)
    setOpen(false)
    setQuery('')
  }

  return (
    <div>
      <label style={labelStyle}>{label}</label>

      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              flex: 1, textAlign: 'left' as const, cursor: 'pointer',
              fontFamily: A.font, fontSize: 11,
              color: linked ? A.text : A.faint,
              background: A.bg, border: `1px solid ${A.border}`,
              borderRadius: 6, padding: '5px 8px',
            }}
          >
            {linked ? linked.display_name : '— Not linked —'}
          </button>
          {linked && (
            <button
              onClick={unlink}
              style={{ fontFamily: A.font, fontSize: 9, fontWeight: 600, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
            >
              Unlink
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus
              style={{ ...inputStyle, flex: 1 }}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Search people…'
            />
            <button
              onClick={() => { setOpen(false); setQuery('') }}
              style={{ fontFamily: A.font, fontSize: 10, color: A.faint, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 5, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}
            >
              Cancel
            </button>
          </div>

          <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${A.border}`, borderRadius: 6, background: A.bg }}>
            {loading ? (
              <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, padding: '8px 10px' }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, padding: '8px 10px' }}>No people found.</div>
            ) : (
              results.map(p => (
                <button
                  key={p.id}
                  onClick={() => select(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left' as const,
                    fontFamily: A.font, fontSize: 11, color: A.text,
                    background: p.id === personId ? `${A.gold}14` : 'transparent',
                    border: 'none', borderBottom: `1px solid ${A.border}`,
                    padding: '6px 10px', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.display_name}</span>
                  {p.email && <span style={{ color: A.faint, marginLeft: 8, fontFamily: 'DM Mono, monospace', fontSize: 10 }}>{p.email}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}