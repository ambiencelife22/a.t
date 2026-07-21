/* GuestLinker.tsx
 * Admin-only component for linking guests to a programme.
 *
 * Flow:
 *   1. Type name / nickname -> live results appear (debounced 250ms)
 *   2. Click a linkable result -> confirmation bar appears showing details
 *   3. Confirm -> guest row created + profile linked server-side in one step
 *   4. Cancel -> back to results
 *
 * Existing guests shown above search with unlink/remove options.
 * Usage: <GuestLinker programmeId={prog.id} />
 *
 * Identity model: a guest links a global_people PERSON to the programme via that
 * person's global_profiles.id. Search resolves person -> profile and reports
 * `linkable` (has a login account). A person with no account is shown but cannot be
 * linked - surfaced plainly, never written as a dead link.
 *
 * S53H: migrated to EF-only via queriesAdminProgramme (zero direct supabase.from()).
 *   Search source moved from the dropped travel_clients table to global_people.
 *   Renamed all fields to camelCase. Visual identity unchanged.
 */

import { useEffect, useState, useRef } from 'react'
import {
  fetchProgrammeGuests,
  searchProgrammeGuestCandidates,
  linkProgrammeGuest,
  unlinkProgrammeGuest,
  removeProgrammeGuest,
  LinkGuestError,
  type ProgrammeGuest,
  type GuestSearchResult,
} from '../../queries/queriesAdminProgramme'

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

export default function GuestLinker({ programmeId }: { programmeId: string }) {
  const [open,      setOpen]      = useState(false)
  const [guests,    setGuests]    = useState<ProgrammeGuest[]>([])
  const [loading,   setLoading]   = useState(false)
  const [loadError, setLoadError] = useState('')

  // Search
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<GuestSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Confirmation
  const [pending,   setPending]   = useState<GuestSearchResult | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) { resetSearch(); return }
    loadGuests()
  }, [open])

  async function loadGuests() {
    setLoading(true)
    setLoadError('')
    try {
      const rows = await fetchProgrammeGuests(programmeId)
      setGuests(rows)
    } catch (e) {
      setLoadError(`Failed to load guests: ${errMessage(e)}`)
    }
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
    try {
      const found = await searchProgrammeGuestCandidates(q)
      setResults(found)
    } catch (e) {
      setLoadError(`Search failed: ${errMessage(e)}`)
    }
    setSearching(false)
  }

  function selectResult(candidate: GuestSearchResult) {
    if (!candidate.linkable) return
    setPending(candidate)
    setSaveError('')
  }

  async function handleConfirm() {
    if (!pending) return
    setSaving(true)
    setSaveError('')
    try {
      await linkProgrammeGuest(programmeId, pending.personId)
      resetSearch()
      await loadGuests()
    } catch (e) {
      setSaveError(linkErrorMessage(e))
    }
    setSaving(false)
  }

  async function handleUnlink(guestId: string) {
    try {
      await unlinkProgrammeGuest(guestId)
      await loadGuests()
    } catch (e) {
      setLoadError(`Failed to unlink: ${errMessage(e)}`)
    }
  }

  async function handleRemove(guestId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this programme?`)) return
    try {
      await removeProgrammeGuest(guestId)
      await loadGuests()
    } catch (e) {
      setLoadError(`Failed to remove: ${errMessage(e)}`)
    }
  }

  const alreadyLinked = (profileId: string | null) =>
    profileId != null && guests.some(g => g.profileId === profileId)

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
          <span style={{ marginLeft: 6, fontSize: 10, color: guests.every(g => g.profileId) ? A.positive : A.gold }}>
            {guests.filter(g => g.profileId).length}/{guests.length} linked
          </span>
        )}
      </button>

      {open && (
        <div style={{
          marginTop: 10, padding: 16,
          background: A.bg, borderRadius: 10,
          border: `1px solid ${A.border}`,
        }}>

          {/* Load error */}
          {loadError && (
            <div style={{
              padding: '10px 12px', marginBottom: 12,
              background: `${A.danger}10`, border: `1px solid ${A.danger}40`,
              borderRadius: 8, fontSize: 12, color: A.danger,
              fontFamily: A.font,
            }}>
              {loadError}
            </div>
          )}

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
                        background: guest.profileId ? A.positive : A.faint,
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                        {guest.resolvedName ?? guest.displayName}
                      </span>
                      {guest.isLead && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                          textTransform: 'uppercase', color: A.gold,
                          background: `${A.gold}18`, border: `1px solid ${A.gold}35`,
                          borderRadius: 100, padding: '1px 6px', fontFamily: A.font,
                        }}>Lead</span>
                      )}
                      {!guest.profileId && (
                        <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>not linked</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {guest.profileId && (
                        <button
                          onClick={() => handleUnlink(guest.id)}
                          style={{ fontSize: 11, color: A.faint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: A.font, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}
                        >
                          Unlink
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(guest.id, guest.resolvedName ?? guest.displayName)}
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
            <div style={{ position: 'relative' }}>
              <input
                type='text'
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder='Search by name or nickname…'
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
                {results.map((candidate, i) => {
                  const linked     = alreadyLinked(candidate.profileId)
                  const selectable = candidate.linkable && !linked
                  return (
                    <button
                      key={candidate.personId}
                      onClick={() => selectResult(candidate)}
                      disabled={!selectable}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '10px 12px',
                        background: selectable ? A.bgInput : `${A.faint}08`,
                        border: 'none',
                        borderTop: i > 0 ? `1px solid ${A.border}` : 'none',
                        cursor: selectable ? 'pointer' : 'default',
                        fontFamily: A.font,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (selectable) (e.currentTarget as HTMLButtonElement).style.background = A.bgHover }}
                      onMouseLeave={e => { if (selectable) (e.currentTarget as HTMLButtonElement).style.background = A.bgInput }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: selectable ? A.text : A.faint }}>
                          {candidate.displayName}
                        </span>
                        {candidate.nickname && (
                          <span style={{ fontSize: 12, color: A.muted }}>&quot;{candidate.nickname}&quot;</span>
                        )}
                        {linked && (
                          <span style={{ fontSize: 10, color: A.positive, marginLeft: 4 }}>already linked</span>
                        )}
                      </div>
                      {/* Honest direction: a person with no login account can't be linked. */}
                      {!candidate.linkable && !linked && (
                        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                          No login account yet - can&apos;t be linked
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* No results */}
            {!searching && query.trim().length >= 2 && results.length === 0 && !pending && (
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, padding: '8px 0' }}>
                No people found matching &quot;{query}&quot;.
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
                <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, marginBottom: 12 }}>
                  {pending.displayName}
                  {pending.nickname && (
                    <span style={{ fontWeight: 400, color: A.muted }}> &quot;{pending.nickname}&quot;</span>
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

// ── Error helpers ──────────────────────────────────────────────────────────────

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error'
}

// Link failures carry a typed reason so the UI gives precise direction.
function linkErrorMessage(e: unknown): string {
  if (e instanceof LinkGuestError) return e.message
  return `Failed to add guest: ${errMessage(e)}`
}