/* GuidesHotelsTab.tsx
 * Per-destination hotel guide list view + create action.
 * The actual editor (overlay + download) lives in the shared
 * GuideEditModal — this file is purely list management.
 *
 * No Access tab — no hotel_guide_grants table yet (P1 carry).
 *
 * Last updated: S52 — refactored to use shared GuideEditModal. Inline
 *   EditGuideModal / DownloadTab components removed.
 *   Drift between four guide variants closed.
 * Prior: S51 — Download tab + canonical 17-field overlay shape.
 * Prior: S41 — initial build.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { formatDateShortUpper } from '../../utils/utilsDates'
import { useToast } from '../../providers/ToastContext'
import { btnPrimary } from '../../styles/stylesAdmin'
import {
  fetchHotelGuides,
  fetchDestinationsWithHotels,
  fetchDestinationOptions,
  updateHotelGuide,
  createHotelGuide,
  deleteHotelGuide,
  type AdminHotelGuide,
  type DestinationWithHotelCounts,
  type DestinationOption,
} from '../../queries/queriesAdminGuides'
import GuideEditModal from './guides/GuideEditModal'

export default function GuidesHotelsTab() {
  const { toast } = useToast()
  const [guides,                 setGuides]                 = useState<AdminHotelGuide[]>([])
  const [destinationsWithCounts, setDestinationsWithCounts] = useState<DestinationWithHotelCounts[]>([])
  const [destinationOptions,     setDestinationOptions]     = useState<DestinationOption[]>([])
  const [loading,                setLoading]                = useState(true)
  const [editing,                setEditing]                = useState<AdminHotelGuide | null>(null)
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
        fetchHotelGuides(),
        fetchDestinationsWithHotels(),
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
      await createHotelGuide(destId)
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
          Hotel Guides
        </div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
          Per-destination overlay (hero, eyebrow, headline, intro, at-a-glance bullets, plan-your-visit, publication metadata) and per-download branding.
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
                  const hotelCount = destinationsWithCounts.find(d => d.id === g.global_destination_id)?.hotel_count ?? 0
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
                        {g.headline_override ?? <span style={{ color: A.faint, fontStyle: 'normal' }}>(default headline)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
                        {hotelCount} {hotelCount === 1 ? 'hotel' : 'hotels'}
                      </div>
                      <div style={{
                        fontSize: 11, color: g.accuracy_date ? A.gold : A.faint, fontFamily: A.font,
                      }}>
                        {g.accuracy_date ? formatDateShortUpper(g.accuracy_date) : 'No date set'}
                      </div>
                      <div style={{
                        fontSize: 11, color: g.is_active ? A.positive : A.faint,
                        fontFamily: A.font, fontWeight: 600,
                      }}>
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
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10,
              }}>
                Destinations Without Overlay ({destinationsWithoutOverlay.length})
              </div>
              <div style={{
                fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 10,
              }}>
                These have hotels but no per-destination guide row. Create one to set hero / eyebrow / headline / intro.
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
                        {d.hotel_count} {d.hotel_count === 1 ? 'hotel' : 'hotels'}
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
          variant='hotels'
          guide={editing}
          destinationName={destinationsById.get(editing.global_destination_id)?.name ?? '(unknown)'}
          destinationSlug={destinationsById.get(editing.global_destination_id)?.slug ?? ''}
          onSave={async (patch) => { await updateHotelGuide(editing.id, patch) }}
          onDelete={async () => { await deleteHotelGuide(editing.id) }}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}