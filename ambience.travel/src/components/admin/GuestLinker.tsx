/* GuestLinker.tsx
 * Admin-only component for linking guests to a programme.
 *
 * Flow:
 *   1. Type name / nickname / email → live results appear (debounced 250ms)
 *   2. Click a result → confirmation bar appears showing full details
 *   3. Confirm → guest row created + profile_id linked in one step
 *   4. Cancel → back to results
 *
 * Existing guests shown above search with unlink/remove options.
 * Usage: <GuestLinker programmeId={prog.id} />
 */

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const A = {
  bg:         '#111210',
  bgCard:     '#1A1C1A',
  bgInput:    '#202220',
  bgHover:    '#252725',
  border:     '#2E302E',
  borderGold: 'rgba(201,184,142,0.25)',
  text:       '#F3F4F3',
  muted:      '#9A9E9A',
  faint:      '#5A5E5A',
  gold:       '#C9B88E',
  danger:     '#ef4444',
  positive:   '#4ade80',
  font:       "'Plus Jakarta Sans', sans-serif",
  mono:       "'DM Mono', monospace",
}

interface GuestRow {
  id:           string
  display_name: string
  profile_id:   string | null
  is_lead:      boolean
  sort_order:   number
}

interface ClientResult {
  profile_id: string
  first_name: string
  last_name:  string | null
  nickname:   string | null
  email:      string | null
  phone:      string | null
}

function fullName(c: ClientResult): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ')
}

function clientSummary(c: ClientResult): string {
  const parts = [fullName(c)]
  if (c.nickname) parts.push(`"${c.nickname}"`)
  if (c.email)    parts.push(c.email)
  if (c.phone)    parts.push(c.phone)
  return parts.join(' · ')
}

export default function GuestLinker({ programmeId }: { programmeId: string }) {
  const [open,      setOpen]      = useState(false)
  const [guests,    setGuests]    = useState<GuestRow[]>([])
  const [loading,   setLoading]   = useState(false)

  // Search
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<ClientResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Confirmation
  const [pending,   setPending]   = useState<ClientResult | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) { resetSearch(); return }
    loadGuests()
  }, [open])

  async function loadGuests() {
    setLoading(true)
    const { data } = await supabase
      .from('programme_guests')
      .select('id, display_name, profile_id, is_lead, sort_order')
      .eq('programme_id', programmeId)
      .order('sort_order')
    setGuests((data ?? []) as GuestRow[])
    setLoading(false)
  }

  function resetSearch() {
    setQuery('')
    setResults([])
    setSearching(false)
    setPending(null)
    setSaveError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setResults([])
    setPending(null)
    setSaveError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.trim().length < 2) return
    debounceRef.current = setTimeout(() => doSearch(value.trim()), 250)
  }

  async function doSearch(q: string) {
    setSearching(true)
    const { data } = await supabase
      .from('travel_clients')
      .select('profile_id, first_name, last_name, nickname, email, phone')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`)
      .not('profile_id', 'is', null)
      .limit(10)
    setSearching(false)
    setResults((data ?? []) as ClientResult[])
  }

  function selectResult(client: ClientResult) {
    setPending(client)
    setSaveError('')
  }

  async function handleConfirm() {
    if (!pending) return
    setSaving(true)
    setSaveError('')

    const displayName = fullName(pending)
    const isFirst     = guests.length === 0

    const { error } = await supabase
      .from('programme_guests')
      .insert({
        programme_id: programmeId,
        display_name: displayName,
        profile_id:   pending.profile_id,
        is_lead:      isFirst,
        sort_order:   guests.length,
      })

    setSaving(false)

    if (error) {
      setSaveError('Failed to add guest. They may already be linked.')
      return
    }

    resetSearch()
    loadGuests()
  }

  async function handleUnlink(guestId: string) {
    await supabase
      .from('programme_guests')
      .update({ profile_id: null })
      .eq('id', guestId)
    loadGuests()
  }

  async function handleRemove(guestId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this programme?`)) return
    await supabase.from('programme_guests').delete().eq('id', guestId)
    loadGuests()
  }

  const alreadyLinked = (profileId: string) =>
    guests.some(g => g.profile_id === profileId)

  return (
    <div style={{ marginTop: 12 }}>

      {/* Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 11, fontWeight: 600,
          color: open ? A.gold : A.faint,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: A.font, letterSpacing: '0.04em', padding: 0,
          transition: 'color 0.15s',
        }}
      >
        {open ? '▾' : '▸'} Guest Access
        {guests.length > 0 && (
          <span style={{ marginLeft: 6, fontSize: 10, color: guests.every(g => g.profile_id) ? A.positive : A.gold }}>
            {guests.filter(g => g.profile_id).length}/{guests.length} linked
          </span>
        )}
      </button>

      {open && (
        <div style={{
          marginTop: 10, padding: 16,
          background: A.bg, borderRadius: 10,
          border: `1px solid ${A.border}`,
        }}>

          {/* ── Existing guests ── */}
          {loading && (
            <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginBottom: 12 }}>Loading…</div>
          )}

          {!loading && guests.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>
                Linked Guests
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {guests.map(guest => (
                  <div key={guest.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: A.bgCard, borderRadius: 8,
                    border: `1px solid ${A.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: guest.profile_id ? A.positive : A.faint,
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                        {guest.display_name}
                      </span>
                      {guest.is_lead && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                          textTransform: 'uppercase', color: A.gold,
                          background: `${A.gold}18`, border: `1px solid ${A.gold}35`,
                          borderRadius: 100, padding: '1px 6px', fontFamily: A.font,
                        }}>Lead</span>
                      )}
                      {!guest.profile_id && (
                        <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>not linked</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {guest.profile_id && (
                        <button
                          onClick={() => handleUnlink(guest.id)}
                          style={{ fontSize: 11, color: A.faint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}
                        >
                          Unlink
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(guest.id, guest.display_name)}
                        style={{ fontSize: 11, color: A.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, padding: 0 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Search ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                Add Guest
              </div>
              <button
                onClick={resetSearch}
                style={{ fontSize: 11, color: A.faint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Input */}
            <div style={{ position: 'relative', marginBottom: results.length > 0 ? 0 : 0 }}>
              <input
                type='text'
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder='Search by name, nickname, or email…'
                style={{
                  width: '100%', background: A.bgInput,
                  border: `1px solid ${pending ? A.borderGold : A.border}`,
                  borderRadius: results.length > 0 ? '8px 8px 0 0' : 8,
                  padding: '9px 12px', fontSize: 12, color: A.text,
                  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {searching && (
                <div style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 10, color: A.faint, fontFamily: A.font,
                }}>
                  Searching…
                </div>
              )}
            </div>

            {/* Results dropdown */}
            {results.length > 0 && !pending && (
              <div style={{
                border: `1px solid ${A.border}`, borderTop: 'none',
                borderRadius: '0 0 8px 8px', overflow: 'hidden',
                marginBottom: 10,
              }}>
                {results.map((client, i) => {
                  const linked = alreadyLinked(client.profile_id)
                  return (
                    <button
                      key={client.profile_id}
                      onClick={() => { if (!linked) selectResult(client) }}
                      disabled={linked}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '10px 12px',
                        background: linked ? `${A.faint}08` : A.bgInput,
                        border: 'none',
                        borderTop: i > 0 ? `1px solid ${A.border}` : 'none',
                        cursor: linked ? 'default' : 'pointer',
                        fontFamily: A.font,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!linked) (e.currentTarget as HTMLButtonElement).style.background = A.bgHover }}
                      onMouseLeave={e => { if (!linked) (e.currentTarget as HTMLButtonElement).style.background = A.bgInput }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: linked ? A.faint : A.text }}>
                          {fullName(client)}
                        </span>
                        {client.nickname && (
                          <span style={{ fontSize: 12, color: A.muted }}>&quot;{client.nickname}&quot;</span>
                        )}
                        {linked && (
                          <span style={{ fontSize: 10, color: A.positive, marginLeft: 4 }}>already linked</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {client.email && (
                          <span style={{ fontSize: 11, color: A.faint, fontFamily: A.mono }}>{client.email}</span>
                        )}
                        {client.phone && (
                          <span style={{ fontSize: 11, color: A.faint, fontFamily: A.mono }}>{client.phone}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* No results */}
            {!searching && query.trim().length >= 2 && results.length === 0 && !pending && (
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, padding: '8px 0' }}>
                No clients found matching &quot;{query}&quot;.
              </div>
            )}

            {/* Confirmation bar */}
            {pending && (
              <div style={{
                marginTop: 8, padding: '12px 14px',
                background: `${A.gold}0E`,
                border: `1px solid ${A.borderGold}`,
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginBottom: 6 }}>
                  Add this guest to the programme?
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 2 }}>
                  {fullName(pending)}
                  {pending.nickname && (
                    <span style={{ fontWeight: 400, color: A.muted }}> &quot;{pending.nickname}&quot;</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  {pending.email && (
                    <span style={{ fontSize: 11, color: A.faint, fontFamily: A.mono }}>{pending.email}</span>
                  )}
                  {pending.phone && (
                    <span style={{ fontSize: 11, color: A.faint, fontFamily: A.mono }}>{pending.phone}</span>
                  )}
                </div>
                {saveError && (
                  <div style={{ fontSize: 11, color: A.danger, fontFamily: A.font, marginBottom: 8 }}>
                    {saveError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleConfirm}
                    disabled={saving}
                    style={{
                      padding: '7px 18px', fontSize: 12, fontWeight: 700,
                      background: A.gold, border: 'none', borderRadius: 7,
                      color: '#111', cursor: saving ? 'wait' : 'pointer',
                      fontFamily: A.font, opacity: saving ? 0.6 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {saving ? 'Adding…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => { setPending(null); setSaveError('') }}
                    style={{
                      padding: '7px 14px', fontSize: 12, background: 'transparent',
                      border: `1px solid ${A.border}`, borderRadius: 7,
                      color: A.muted, cursor: 'pointer', fontFamily: A.font,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}