/* GuideAccessTab.tsx - canonical access management for guide variants that
 * support per-user grants (currently dining + experiences).
 *
 * Replaces the two near-identical AccessTab components that used to live
 * inline in GuidesDiningTab + GuidesExperiencesTab. Hotels and shopping
 * have no grants tables yet (P1 carry); when they ship, this component
 * is one prop flip away.
 *
 * What it owns:
 *   - Grant list rendering
 *   - People picker with search
 *   - Profile cache (person → profile UUID lookup) to surface "no login"
 *     state without re-querying
 *   - Assign / revoke dispatch via injected callbacks
 *
 * What it does not own:
 *   - The modal shell (GuideEditModal)
 *   - Variant fetch wiring (caller injects fetchGrants, createGrant,
 *     deleteGrant scoped to the right table)
 *
 * Variant-discriminated via callbacks rather than a switch - keeps this
 * file unaware of which underlying table backs the grants.
 *
 * Last updated: S52 - initial build.
 */

import { useEffect, useMemo, useState } from 'react'
import { formatDateShort } from '../../../utils/utilsDates'
import { A } from '../../../tokens/tokensAdmin'
import { useToast } from '../../../providers/ToastContext'
import {
  inputStyle,
  btnPrimary, btnDanger,
} from '../../../styles/stylesAdmin'
import { fetchProfileByPersonId } from '../../../queries/queriesAdminGuides'
import { fetchPeople, type GlobalPersonResolved } from '../../../queries/queriesGlobalPeople'

// ── Minimal grant shape - both AdminGrant + AdminExperiencesGrant satisfy ─────

export interface MinimalGrant {
  id:         string
  userId:    string
  grantedAt: string
  person:     GlobalPersonResolved | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function personDisplayName(person: GlobalPersonResolved): string {
  const parts = [person.firstName, person.lastName].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  return person.nickname ?? person.email ?? '(unnamed)'
}

function grantDisplayName(grant: MinimalGrant): string {
  if (grant.person) return personDisplayName(grant.person)
  return '(unknown user)'
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GuideAccessTab({
  globalDestinationId,
  fetchGrants,
  createGrant,
  deleteGrant,
}: {
  globalDestinationId: string
  fetchGrants:         (globalDestinationId: string) => Promise<MinimalGrant[]>
  createGrant:         (userId: string, globalDestinationId: string) => Promise<void>
  deleteGrant:         (grantId: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [grants,    setGrants]    = useState<MinimalGrant[]>([])
  const [people,    setPeople]    = useState<GlobalPersonResolved[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [assigning, setAssigning] = useState(false)
  const [revoking,  setRevoking]  = useState<string | null>(null)
  const [profileCache, setProfileCache] = useState<Map<string, string | null>>(new Map())

  async function load() {
    setLoading(true)
    try {
      const [g, p] = await Promise.all([
        fetchGrants(globalDestinationId),
        fetchPeople(),
      ])
      setGrants(g)
      setPeople(p)
    } catch (e) {
      toast.error(`Failed to load access: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [globalDestinationId])

  const grantedUserIds   = useMemo(() => new Set(grants.map(g => g.userId)), [grants])
  const grantedPersonIds = useMemo(
    () => new Set(grants.map(g => g.person?.id).filter(Boolean)),
    [grants],
  )

  const filteredPeople = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return people
    return people.filter(p => {
      const name  = personDisplayName(p).toLowerCase()
      const email = (p.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [people, search])

  async function handleAssign(person: GlobalPersonResolved) {
    setAssigning(true)
    try {
      let profileId = profileCache.get(person.id)
      if (profileId === undefined) {
        const profile = await fetchProfileByPersonId(person.id)
        profileId = profile?.id ?? null
        setProfileCache(prev => new Map(prev).set(person.id, profileId ?? null))
      }
      if (!profileId) {
        toast.error(`${personDisplayName(person)} has no login yet. They must create an account first.`)
        setAssigning(false)
        return
      }
      if (grantedUserIds.has(profileId)) {
        toast.error('Already granted.')
        setAssigning(false)
        return
      }
      await createGrant(profileId, globalDestinationId)
      toast.success(`Access granted to ${personDisplayName(person)}.`)
      setSearch('')
      await load()
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setAssigning(false)
  }

  async function handleRevoke(grant: MinimalGrant) {
    setRevoking(grant.id)
    try {
      await deleteGrant(grant.id)
      toast.success('Access revoked.')
      await load()
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setRevoking(null)
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Current grantees */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          marginBottom: 10,
        }}>
          Current Access ({grants.length})
        </div>
        {grants.length === 0 ? (
          <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
            No one has been granted access yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {grants.map(g => (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: A.bgCard,
                  border: `1px solid ${A.border}`, borderRadius: 10, gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                    {grantDisplayName(g)}
                  </div>
                  {g.person?.email && (
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                      {g.person.email}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2 }}>
                    Granted {formatDateShort(g.grantedAt.slice(0, 10))}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(g)}
                  style={{ ...btnDanger, opacity: revoking === g.id ? 0.5 : 1, flexShrink: 0 }}
                  disabled={revoking === g.id}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign picker */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: A.gold, fontFamily: A.font,
          marginBottom: 10,
        }}>
          Assign Access
        </div>
        <input
          style={{ ...inputStyle, marginBottom: 10 }}
          placeholder='Search by name or email…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search.trim().length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
            {filteredPeople.length === 0 && (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic', padding: '8px 0' }}>
                No matches.
              </div>
            )}
            {filteredPeople.map(p => {
              const alreadyGranted = grantedPersonIds.has(p.id)
              const noLogin        = profileCache.get(p.id) === null
              const isDisabled     = alreadyGranted || noLogin || assigning

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', background: A.bgCard,
                    border: `1px solid ${A.border}`, borderRadius: 8, gap: 12,
                    opacity: (alreadyGranted || noLogin) ? 0.45 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                      {personDisplayName(p)}
                    </div>
                    <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                      {p.email ?? '(no email)'}
                      {alreadyGranted && <span style={{ marginLeft: 8, color: A.positive }}>· granted</span>}
                      {noLogin        && <span style={{ marginLeft: 8, color: A.danger  }}>· no login</span>}
                    </div>
                  </div>
                  {!alreadyGranted && (
                    <button
                      onClick={() => handleAssign(p)}
                      style={{ ...btnPrimary, opacity: isDisabled ? 0.4 : 1, flexShrink: 0 }}
                      disabled={isDisabled}
                    >
                      Grant
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}