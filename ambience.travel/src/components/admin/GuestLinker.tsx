/* GuestLinker.tsx
 * Admin-only component rendered inside each programme row in ProgrammesTab.
 * Shows existing programme_guests with their profile link status.
 * Allows admin to search a user by email and set profile_id on a guest row,
 * which grants that user RLS access to see the programme in their list.
 *
 * Usage in ProgrammesTab (inside the programme row, after the action buttons):
 *   <GuestLinker programmeId={prog.id} />
 *
 * Standalone — no props drilling needed beyond programmeId.
 * Uses the same A token set as ProgrammeAdmin.tsx.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ── Design tokens — matches ProgrammeAdmin.tsx A object ──────────────────────
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

const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 8, padding: '8px 12px', fontSize: 12, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}

interface GuestRow {
  id:           string
  display_name: string
  profile_id:   string | null
  is_lead:      boolean
  sort_order:   number
}

interface GuestLinkerProps {
  programmeId: string
}

export default function GuestLinker({ programmeId }: GuestLinkerProps) {
  const [open,    setOpen]    = useState(false)
  const [guests,  setGuests]  = useState<GuestRow[]>([])
  const [loading, setLoading] = useState(false)

  // Per-guest link state
  const [linkEmail,  setLinkEmail]  = useState<Record<string, string>>({})
  const [linkStatus, setLinkStatus] = useState<Record<string, 'idle' | 'searching' | 'found' | 'not_found' | 'saving' | 'saved' | 'error'>>({})
  const [linkUserId, setLinkUserId] = useState<Record<string, string>>({})
  const [linkMsg,    setLinkMsg]    = useState<Record<string, string>>({})

  // New guest form
  const [showAdd,       setShowAdd]       = useState(false)
  const [newName,       setNewName]       = useState('')
  const [addBusy,       setAddBusy]       = useState(false)

  useEffect(() => {
    if (!open) return
    loadGuests()
  }, [open, programmeId])

  async function loadGuests() {
    setLoading(true)
    const { data, error } = await supabase
      .from('programme_guests')
      .select('id, display_name, profile_id, is_lead, sort_order')
      .eq('programme_id', programmeId)
      .order('sort_order')

    if (!error) setGuests((data ?? []) as GuestRow[])
    setLoading(false)
  }

  async function searchEmail(guestId: string) {
    const email = linkEmail[guestId]?.trim()
    if (!email) return

    setLinkStatus(s => ({ ...s, [guestId]: 'searching' }))
    setLinkMsg(s => ({ ...s, [guestId]: '' }))

    // Search via auth.users — requires service role, so we use a profiles join on email
    // profiles doesn't store email directly, so we search auth.users via edge function or
    // use the admin API workaround: look up by email in auth.users through profiles
    const { data, error } = await supabase
      .rpc('get_user_id_by_email', { email_input: email })

    if (error || !data) {
      // Fallback: try profiles table via supabase.auth.admin (not available client-side)
      // Instead search auth.users indirectly — no direct client access, so we try
      // matching against a known pattern via support_tickets or programme_guests
      setLinkStatus(s => ({ ...s, [guestId]: 'not_found' }))
      setLinkMsg(s => ({ ...s, [guestId]: `No account found for ${email}` }))
      return
    }

    setLinkUserId(s => ({ ...s, [guestId]: data }))
    setLinkStatus(s => ({ ...s, [guestId]: 'found' }))
    setLinkMsg(s => ({ ...s, [guestId]: `Found — ready to link` }))
  }

  async function linkGuest(guestId: string) {
    const userId = linkUserId[guestId]
    if (!userId) return

    setLinkStatus(s => ({ ...s, [guestId]: 'saving' }))

    const { error } = await supabase
      .from('programme_guests')
      .update({ profile_id: userId })
      .eq('id', guestId)

    if (error) {
      setLinkStatus(s => ({ ...s, [guestId]: 'error' }))
      setLinkMsg(s => ({ ...s, [guestId]: 'Failed to link — try again.' }))
      return
    }

    setLinkStatus(s => ({ ...s, [guestId]: 'saved' }))
    setLinkMsg(s => ({ ...s, [guestId]: 'Linked successfully.' }))
    setLinkEmail(s => ({ ...s, [guestId]: '' }))
    loadGuests()
  }

  async function unlinkGuest(guestId: string) {
    if (!window.confirm('Remove this guest\'s profile link? They will no longer see this programme.')) return

    const { error } = await supabase
      .from('programme_guests')
      .update({ profile_id: null })
      .eq('id', guestId)

    if (!error) loadGuests()
  }

  async function handleAddGuest() {
    if (!newName.trim()) return
    setAddBusy(true)

    const { error } = await supabase
      .from('programme_guests')
      .insert({
        programme_id: programmeId,
        display_name: newName.trim(),
        profile_id:   null,
        is_lead:      guests.length === 0,
        sort_order:   guests.length,
      })

    setAddBusy(false)
    if (!error) { setNewName(''); setShowAdd(false); loadGuests() }
  }

  async function handleRemoveGuest(guestId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this programme?`)) return
    await supabase.from('programme_guests').delete().eq('id', guestId)
    loadGuests()
  }

  const statusColor = (s: typeof linkStatus[string]) => {
    if (s === 'found' || s === 'saved') return A.positive
    if (s === 'not_found' || s === 'error') return A.danger
    return A.muted
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 11, fontWeight: 600, color: open ? A.gold : A.faint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, letterSpacing: '0.04em', padding: 0, transition: 'color 0.15s' }}
      >
        {open ? '▾ Guest Access' : '▸ Guest Access'}
      </button>

      {open && (
        <div style={{ marginTop: 12, padding: '16px', background: A.bg, borderRadius: 10, border: `1px solid ${A.border}` }}>

          {loading && <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>Loading guests…</div>}

          {!loading && guests.length === 0 && (
            <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginBottom: 12 }}>No guest rows — add one to enable access.</div>
          )}

          {!loading && guests.map(guest => {
            const status = linkStatus[guest.id] ?? 'idle'
            const email  = linkEmail[guest.id] ?? ''
            const msg    = linkMsg[guest.id] ?? ''

            return (
              <div key={guest.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${A.border}` }}>

                {/* Guest identity row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>{guest.display_name}</span>
                    {guest.is_lead && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.gold, background: `${A.gold}18`, border: `1px solid ${A.gold}40`, borderRadius: 100, padding: '2px 7px', fontFamily: A.font }}>Lead</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveGuest(guest.id, guest.display_name)}
                    style={{ fontSize: 11, color: A.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, padding: 0 }}
                  >
                    Remove
                  </button>
                </div>

                {/* Profile link status */}
                {guest.profile_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: A.positive, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: A.positive, fontFamily: A.font }}>Profile linked</span>
                      <span style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>{guest.profile_id.slice(0, 8)}…</span>
                    </div>
                    <button
                      onClick={() => unlinkGuest(guest.id)}
                      style={{ fontSize: 11, color: A.faint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
                    >
                      Unlink
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: A.faint, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>No profile linked — guest cannot see this programme</span>
                    </div>

                    {/* Email search */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type='email'
                        value={email}
                        onChange={e => {
                          setLinkEmail(s => ({ ...s, [guest.id]: e.target.value }))
                          setLinkStatus(s => ({ ...s, [guest.id]: 'idle' }))
                          setLinkMsg(s => ({ ...s, [guest.id]: '' }))
                        }}
                        placeholder='Search by email address…'
                        style={{ ...inputStyle, flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') searchEmail(guest.id) }}
                      />
                      {status !== 'found' && (
                        <button
                          onClick={() => searchEmail(guest.id)}
                          disabled={!email || status === 'searching'}
                          style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, background: 'transparent', border: `1px solid ${A.borderGold}`, borderRadius: 8, color: A.gold, cursor: !email || status === 'searching' ? 'not-allowed' : 'pointer', fontFamily: A.font, opacity: !email || status === 'searching' ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}
                        >
                          {status === 'searching' ? 'Searching…' : 'Find User'}
                        </button>
                      )}
                      {status === 'found' && (
                        <button
                          onClick={() => linkGuest(guest.id)}
                          disabled={status === 'saving' as any}
                          style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, background: A.positive, border: 'none', borderRadius: 8, color: '#111', cursor: 'pointer', fontFamily: A.font, whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          Link
                        </button>
                      )}
                    </div>

                    {msg && (
                      <div style={{ marginTop: 6, fontSize: 11, color: statusColor(status), fontFamily: A.font }}>
                        {msg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Add guest row */}
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              style={{ fontSize: 12, color: A.gold, background: 'none', border: `1px solid ${A.borderGold}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: A.font, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = `${A.gold}10`}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
            >
              + Add Guest Row
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder='Guest display name…'
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddGuest() }}
                autoFocus
              />
              <button
                onClick={handleAddGuest}
                disabled={addBusy || !newName.trim()}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, background: A.gold, border: 'none', borderRadius: 8, color: '#111', cursor: !newName.trim() ? 'not-allowed' : 'pointer', fontFamily: A.font, opacity: !newName.trim() ? 0.5 : 1, flexShrink: 0 }}
              >
                {addBusy ? 'Adding…' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName('') }}
                style={{ padding: '8px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: 8, color: A.muted, cursor: 'pointer', fontFamily: A.font, flexShrink: 0 }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}