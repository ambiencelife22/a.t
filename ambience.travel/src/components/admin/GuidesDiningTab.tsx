/* GuidesDiningTab.tsx
 * Per-destination dining guide overlay editor + access management.
 *
 * Shows two sections:
 *   - Active guides (destinations with travel_dining_guides row)
 *   - Destinations without overlay (offers "Create guide" action)
 *
 * Click an active guide row → modal with two tabs:
 *   - Overlay: edits hero, eyebrow, headline, intro, accuracy_date, is_active
 *   - Access: shows current grantees, assign new via people picker, revoke
 *
 * UUID-keyed throughout. Destination name + slug for display only.
 * Slug used only for buildGuideUrl (URL routing, the one allowed slug surface).
 *
 * Last updated: S41 — Refactored to shared adminStyles + adminUi. Removed
 *   local Toast, useToast, inputStyle, textareaStyle, labelStyle, btnPrimary,
 *   btnGhost, btnDanger, Field definitions. Now imported from canonical sources.
 * Prior: S40C — Access tab added. Grant assign/revoke via
 *   fetchGrantsForDestination, fetchAllPeople, fetchProfileByPersonId,
 *   createGrant, deleteGrant. People with no linked profile shown greyed out.
 * Prior: S39 — Added accuracy_date field to edit modal and handleSave.
 * Prior: S36 — initial ship.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../lib/adminTokens'
import { useToast } from '../../lib/ToastContext'
import {
  inputStyle, textareaStyle,
  btnPrimary, btnGhost, btnDanger,
} from '../../lib/adminStyles'
import { Field } from './adminUi'
import { buildGuideUrl } from '../../lib/adminPath'
import {
  fetchDiningGuides,
  fetchDestinationsWithDining,
  fetchDestinationOptions,
  updateDiningGuide,
  createDiningGuide,
  deleteDiningGuide,
  fetchGrantsForDestination,
  fetchAllPeople,
  fetchProfileByPersonId,
  createGrant,
  deleteGrant,
  type AdminDiningGuide,
  type DestinationWithDiningCounts,
  type DestinationOption,
  type DiningGuidePatch,
  type AdminGrant,
  type GlobalPerson,
} from '../../lib/queriesAdminGuides'
import ImageFieldWithUploader from './ImageFieldWithUploader'

// ── Helpers ──────────────────────────────────────────────────────────────────

function personDisplayName(person: GlobalPerson): string {
  const parts = [person.first_name, person.last_name].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  return person.nickname ?? person.email ?? '(unnamed)'
}

function grantDisplayName(grant: AdminGrant): string {
  if (grant.person) return personDisplayName(grant.person)
  if (grant.display_name) return grant.display_name
  return '(unknown user)'
}

// ── Access Tab ───────────────────────────────────────────────────────────────

function AccessTab({
  globalDestinationId,
}: {
  globalDestinationId: string
}) {
  const { toast } = useToast()
  const [grants, setGrants]   = useState<AdminGrant[]>([])
  const [people, setPeople]   = useState<GlobalPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [assigning, setAssigning] = useState(false)
  const [revoking, setRevoking]   = useState<string | null>(null)

  const [profileCache, setProfileCache] = useState<Map<string, string | null>>(new Map())

  async function load() {
    setLoading(true)
    try {
      const [g, p] = await Promise.all([
        fetchGrantsForDestination(globalDestinationId),
        fetchAllPeople(),
      ])
      setGrants(g)
      setPeople(p)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed to load access: ${msg}`)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [globalDestinationId])

  const grantedUserIds = useMemo(() => new Set(grants.map(g => g.user_id)), [grants])

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

  async function handleAssign(person: GlobalPerson) {
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
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed: ${msg}`)
    }
    setAssigning(false)
  }

  async function handleRevoke(grant: AdminGrant) {
    setRevoking(grant.id)
    try {
      await deleteGrant(grant.id)
      toast.success('Access revoked.')
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed: ${msg}`)
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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
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
                    Granted {new Date(g.granted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
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

// ── Edit Modal ───────────────────────────────────────────────────────────────

type ModalTab = 'overlay' | 'access'

function EditGuideModal({
  guide,
  destinationName,
  destinationSlug,
  onClose,
  onSaved,
}: {
  guide:           AdminDiningGuide
  destinationName: string
  destinationSlug: string
  onClose:         () => void
  onSaved:         () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft]       = useState<AdminDiningGuide>(guide)
  const [saving, setSaving]     = useState(false)
  const [modalTab, setModalTab] = useState<ModalTab>('overlay')

  function patch<K extends keyof AdminDiningGuide>(k: K, v: AdminDiningGuide[K]) {
    setDraft(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: DiningGuidePatch = {}
      const fields: (keyof DiningGuidePatch)[] = [
        'hero_image_src', 'hero_image_alt',
        'eyebrow_override', 'headline_override', 'intro_override',
        'is_active', 'accuracy_date',
      ]
      for (const f of fields) {
        if (JSON.stringify(draft[f]) !== JSON.stringify(guide[f])) {
          (payload as Record<string, unknown>)[f] = draft[f]
        }
      }
      if (Object.keys(payload).length === 0) {
        toast.success('No changes.')
        setSaving(false)
        return
      }
      await updateDiningGuide(guide.id, payload)
      toast.success(`Saved ${Object.keys(payload).length} field(s).`)
      onSaved()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed: ${msg}`)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the guide overlay for ${destinationName}? Venues remain; only the per-destination hero/headline/intro is removed.`)) return
    setSaving(true)
    try {
      await deleteDiningGuide(guide.id)
      toast.success('Overlay deleted.')
      onSaved()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed: ${msg}`)
    }
    setSaving(false)
  }

  const tabBtn = (t: ModalTab): React.CSSProperties => ({
    padding:      '6px 16px',
    background:   modalTab === t ? 'rgba(216,181,106,0.12)' : 'transparent',
    color:        modalTab === t ? A.gold : A.muted,
    border:       modalTab === t ? '1px solid rgba(216,181,106,0.30)' : `1px solid ${A.border}`,
    borderRadius: 8,
    fontSize:     12,
    fontWeight:   700,
    fontFamily:   A.font,
    cursor:       'pointer',
    letterSpacing: '0.04em',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 32, overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(800px, 100%)', background: A.bg, border: `1px solid ${A.border}`,
        borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
              Dining Guide
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>{destinationName}</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>{destinationSlug}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={buildGuideUrl(destinationSlug)}
              target='_blank'
              rel='noopener noreferrer'
              style={{ ...btnGhost, color: A.gold, borderColor: A.borderGold, textDecoration: 'none' }}
            >
              View ↗
            </a>
            <button onClick={onClose} style={btnGhost}>Close</button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 4, borderBottom: `1px solid ${A.border}` }}>
          <button onClick={() => setModalTab('overlay')} style={tabBtn('overlay')}>Overlay</button>
          <button onClick={() => setModalTab('access')}  style={tabBtn('access')}>Access</button>
        </div>

        {/* Overlay tab */}
        {modalTab === 'overlay' && (
          <>
            <Field label='Hero Image Src'>
              <ImageFieldWithUploader value={draft.hero_image_src} onChange={v => patch('hero_image_src', v)} />
            </Field>
            <Field label='Hero Image Alt'>
              <input style={inputStyle} value={draft.hero_image_alt ?? ''} onChange={e => patch('hero_image_alt', e.target.value || null)} />
            </Field>
            <Field label='Eyebrow override (NULL = "Curated dining" default)'>
              <input style={inputStyle} value={draft.eyebrow_override ?? ''} onChange={e => patch('eyebrow_override', e.target.value || null)} />
            </Field>
            <Field label='Headline override (NULL = default)'>
              <input style={inputStyle} value={draft.headline_override ?? ''} onChange={e => patch('headline_override', e.target.value || null)} />
            </Field>
            <Field label='Intro override (NULL = default intro paragraph)'>
              <textarea style={textareaStyle} value={draft.intro_override ?? ''} onChange={e => patch('intro_override', e.target.value || null)} />
            </Field>
            <Field label='Accuracy Date (e.g. "May 2026" — leave empty to hide disclaimer)'>
              <input
                style={inputStyle}
                value={draft.accuracy_date ?? ''}
                onChange={e => patch('accuracy_date', e.target.value || null)}
                placeholder='e.g. May 2026'
              />
            </Field>
            <Field label='Active'>
              <select style={inputStyle} value={String(draft.is_active)} onChange={e => patch('is_active', e.target.value === 'true')}>
                <option value='true'>Yes</option>
                <option value='false'>No</option>
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTop: `1px solid ${A.border}` }}>
              <button onClick={handleDelete} style={btnDanger} disabled={saving}>Delete overlay</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
                <button onClick={handleSave} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Access tab */}
        {modalTab === 'access' && (
          <AccessTab globalDestinationId={guide.global_destination_id} />
        )}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function GuidesDiningTab() {
  const { toast } = useToast()
  const [guides, setGuides]                           = useState<AdminDiningGuide[]>([])
  const [destinationsWithCounts, setDestinationsWithCounts] = useState<DestinationWithDiningCounts[]>([])
  const [destinationOptions, setDestinationOptions]   = useState<DestinationOption[]>([])
  const [loading, setLoading]                         = useState(true)
  const [editing, setEditing]                         = useState<AdminDiningGuide | null>(null)
  const [creating, setCreating]                       = useState(false)

  const destinationsById = useMemo(() => {
    const m = new Map<string, DestinationOption>()
    destinationOptions.forEach(d => m.set(d.id, d))
    return m
  }, [destinationOptions])

  async function load() {
    setLoading(true)
    try {
      const [g, d, opts] = await Promise.all([
        fetchDiningGuides(),
        fetchDestinationsWithDining(),
        fetchDestinationOptions(),
      ])
      setGuides(g)
      setDestinationsWithCounts(d)
      setDestinationOptions(opts)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed to load: ${msg}`)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(destId: string) {
    setCreating(true)
    try {
      await createDiningGuide(destId)
      const name = destinationsById.get(destId)?.name ?? '(destination)'
      toast.success(`Guide created for ${name}. Click to edit.`)
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      toast.error(`Failed: ${msg}`)
    }
    setCreating(false)
  }

  const guideByDestId              = new Map(guides.map(g => [g.global_destination_id, g]))
  const destinationsWithoutOverlay = destinationsWithCounts.filter(d => !guideByDestId.has(d.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>
          Guides
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
          Dining Guides
        </div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
          Per-destination overlay (hero, eyebrow, headline, intro, accuracy date) and access management.
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
              Active Guides ({guides.length})
            </div>
            {guides.length === 0 ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>None yet. Create one below.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {guides.map(g => {
                  const dest       = destinationsById.get(g.global_destination_id)
                  const venueCount = destinationsWithCounts.find(d => d.id === g.global_destination_id)?.venue_count ?? 0
                  return (
                    <div
                      key={g.id}
                      onClick={() => setEditing(g)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr 100px 100px 80px',
                        gap: 12, padding: '12px 14px',
                        background: A.bgCard, border: `1px solid ${A.border}`,
                        borderRadius: 10, cursor: 'pointer', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                          {dest?.name ?? '(unknown)'}
                        </div>
                        <div style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                          {dest?.slug ?? ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, fontStyle: 'italic' }}>
                        {g.headline_override ?? <span style={{ color: A.faint, fontStyle: 'normal' }}>(default headline)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {venueCount} {venueCount === 1 ? 'venue' : 'venues'}
                      </div>
                      <div style={{ fontSize: 11, color: g.accuracy_date ? A.gold : A.faint, fontFamily: A.font }}>
                        {g.accuracy_date ?? 'No date set'}
                      </div>
                      <div style={{ fontSize: 11, color: g.is_active ? A.positive : A.faint, fontFamily: A.font, fontWeight: 600 }}>
                        {g.is_active ? 'Active' : 'Hidden'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {destinationsWithoutOverlay.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
                Destinations Without Overlay ({destinationsWithoutOverlay.length})
              </div>
              <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 10 }}>
                These have dining venues but no per-destination guide row. Create one to set hero / eyebrow / headline / intro.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {destinationsWithoutOverlay.map(d => {
                  const dest = destinationsById.get(d.id)
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 120px',
                        gap: 12, padding: '10px 14px',
                        background: A.bgCard, border: `1px solid ${A.border}`,
                        borderRadius: 10, alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>
                        {dest?.name ?? '(unknown)'}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {d.venue_count} {d.venue_count === 1 ? 'venue' : 'venues'}
                      </div>
                      <button
                        onClick={() => handleCreate(d.id)}
                        style={{ ...btnPrimary, justifySelf: 'end', opacity: creating ? 0.5 : 1 }}
                        disabled={creating}
                      >
                        + Create guide
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {editing && (
        <EditGuideModal
          guide={editing}
          destinationName={destinationsById.get(editing.global_destination_id)?.name ?? '(unknown)'}
          destinationSlug={destinationsById.get(editing.global_destination_id)?.slug ?? ''}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}