/* GuidesDiningTab.tsx
 * Per-destination dining guide list view + create action.
 * The actual editor (overlay + access + download) lives in the shared
 * GuideEditModal - this file is purely list management.
 *
 * Last updated: S52 - refactored to use shared GuideEditModal. Inline
 *   EditGuideModal / AccessTab / DownloadTab components removed.
 *   Drift between four guide variants closed.
 * Prior: S51 - Download tab + canonical 17-field overlay shape.
 * Prior: S41 - initial Access tab.
 * Prior: S36 - initial ship.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { formatDateShortUpper } from '../../utils/utilsDates'
import { useToast } from '../../providers/ToastContext'
import { btnPrimary } from '../../styles/stylesAdmin'
import {
  fetchDiningGuides,
  fetchDestinationsWithDining,
  fetchDestinationOptions,
  updateDiningGuide,
  createDiningGuide,
  deleteDiningGuide,
  fetchGrantsForDestination,
  createGrant,
  deleteGrant,
  type AdminDiningGuide,
  type DestinationWithDiningCounts,
  type DestinationOption,
} from '../../queries/queriesAdminGuides'
import GuideEditModal from './guides/GuideEditModal'

export default function GuidesDiningTab() {
  const { toast } = useToast()
  const [guides,                 setGuides]                 = useState<AdminDiningGuide[]>([])
  const [destinationsWithCounts, setDestinationsWithCounts] = useState<DestinationWithDiningCounts[]>([])
  const [destinationOptions,     setDestinationOptions]     = useState<DestinationOption[]>([])
  const [loading,                setLoading]                = useState(true)
  const [editing,                setEditing]                = useState<AdminDiningGuide | null>(null)
  const [creating,               setCreating]               = useState(false)

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
      toast.error(`Failed to load: ${e instanceof Error ? e.message : 'unknown error'}`)
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
      toast.error(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
    setCreating(false)
  }

  const guideByDestId              = new Map(guides.map(g => [g.global_destination_id, g]))
  const destinationsWithoutOverlay = destinationsWithCounts.filter(d => !guideByDestId.has(d.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div>
        <div style={{
          fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4,
        }}>
          Guides
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font,
          letterSpacing: '-0.02em',
        }}>
          Dining Guides
        </div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
          Per-destination overlay (hero, eyebrow, headline, intro, at-a-glance bullets, plan-your-visit, publication metadata) and access management.
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>
      ) : (
        <>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10,
            }}>
              Active Guides ({guides.length})
            </div>
            {guides.length === 0 ? (
              <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>
                None yet. Create one below.
              </div>
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
                        <div style={{
                          fontSize: 10, color: A.faint,
                          fontFamily: 'DM Mono, monospace', marginTop: 2,
                        }}>
                          {dest?.slug ?? ''}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 12, color: A.muted, fontFamily: A.font, fontStyle: 'italic',
                      }}>
                        {g.headlineOverride ?? <span style={{ color: A.faint, fontStyle: 'normal' }}>(default headline)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {venueCount} {venueCount === 1 ? 'venue' : 'venues'}
                      </div>
                      <div style={{
                        fontSize: 11, color: g.accuracyDate ? A.gold : A.faint, fontFamily: A.font,
                      }}>
                        {g.accuracyDate ? formatDateShortUpper(g.accuracyDate) : 'No date set'}
                      </div>
                      <div style={{
                        fontSize: 11, color: g.isActive ? A.positive : A.faint,
                        fontFamily: A.font, fontWeight: 600,
                      }}>
                        {g.isActive ? 'Active' : 'Hidden'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {destinationsWithoutOverlay.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10,
              }}>
                Destinations Without Overlay ({destinationsWithoutOverlay.length})
              </div>
              <div style={{
                fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 10,
              }}>
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
        <GuideEditModal
          variant='dining'
          guide={editing}
          destinationName={destinationsById.get(editing.global_destination_id)?.name ?? '(unknown)'}
          destinationSlug={destinationsById.get(editing.global_destination_id)?.slug ?? ''}
          onSave={async (patch) => { await updateDiningGuide(editing.id, patch) }}
          onDelete={async () => { await deleteDiningGuide(editing.id) }}
          onClose={() => setEditing(null)}
          onSaved={load}
          fetchGrants={fetchGrantsForDestination}
          createGrant={createGrant}
          deleteGrant={deleteGrant}
        />
      )}
    </div>
  )
}