/* GuideEditModal.tsx — canonical edit modal for all four guide variants.
 *
 * One modal authors everything for one guide: overlay, access (where
 * grants exist), and download. Mission: "the designer opens one editor
 * and authors everything."
 *
 * Replaces four near-identical EditGuideModal components that used to
 * live inline in GuidesDiningTab / GuidesExperiencesTab / GuidesHotelsTab
 * / GuidesShoppingTab.
 *
 * What it owns:
 *   - Modal shell (z-index, backdrop, padding, scroll)
 *   - Header (product label, destination name, view-↗ link, close button)
 *   - Tab switcher
 *   - Tab rendering (composes GuideOverlayEditor + GuideAccessTab +
 *     GuideDownloadTab)
 *
 * What it does not own:
 *   - Field rendering (GuideOverlayEditor)
 *   - Grant management (GuideAccessTab)
 *   - PDF dispatch (GuideDownloadTab)
 *   - Persistence (caller injects onSave + onDelete)
 *
 * Last updated: S52 — initial build.
 */

import { useState } from 'react'
import { A } from '../../../tokens/tokensAdmin'
import { btnGhost } from '../../../styles/stylesAdmin'
import { buildGuideUrl } from '../../../utils/utilsAdminPath'
import {
  type GuideOverlayDraft,
  type GuideOverlayPatch,
  type GuideVariant,
  GUIDE_COPY,
  variantHasGrants,
} from '../../../types/typesGuides'
import GuideOverlayEditor from './GuideOverlayEditor'
import GuideAccessTab, { type MinimalGrant } from './GuideAccessTab'
import GuideDownloadTab from './GuideDownloadTab'

type ModalTab = 'overlay' | 'access' | 'download'

export default function GuideEditModal({
  variant,
  guide,
  destinationName,
  destinationSlug,
  onSave,
  onDelete,
  onClose,
  onSaved,
  // Access tab dependencies — required only when variantHasGrants(variant).
  // Caller passes scoped fetchers (dining or experiences); component is
  // unaware of the backing table.
  fetchGrants,
  createGrant,
  deleteGrant,
}: {
  variant:         GuideVariant
  guide:           GuideOverlayDraft & { id: string; global_destination_id: string }
  destinationName: string
  destinationSlug: string
  onSave:          (patch: GuideOverlayPatch) => Promise<void>
  onDelete:        () => Promise<void>
  onClose:         () => void
  onSaved:         () => void
  fetchGrants?:    (globalDestinationId: string) => Promise<MinimalGrant[]>
  createGrant?:    (userId: string, globalDestinationId: string) => Promise<void>
  deleteGrant?:    (grantId: string) => Promise<void>
}) {
  const [modalTab, setModalTab] = useState<ModalTab>('overlay')
  const copy       = GUIDE_COPY[variant]
  const showAccess = variantHasGrants(variant)

  // Wrap onSave so the parent reloads list state after a successful save.
  async function handleSave(patch: GuideOverlayPatch) {
    await onSave(patch)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    await onDelete()
    onSaved()
    onClose()
  }

  const tabBtn = (t: ModalTab): React.CSSProperties => ({
    padding:       '6px 16px',
    background:    modalTab === t ? 'rgba(216,181,106,0.12)' : 'transparent',
    color:         modalTab === t ? A.gold : A.muted,
    border:        modalTab === t ? '1px solid rgba(216,181,106,0.30)' : `1px solid ${A.border}`,
    borderRadius:  8,
    fontSize:      12,
    fontWeight:    700,
    fontFamily:    A.font,
    cursor:        'pointer',
    letterSpacing: '0.04em',
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 32, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(800px, 100%)', background: A.bg, border: `1px solid ${A.border}`,
          borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4,
            }}>
              {copy.productLabel}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {destinationName}
            </div>
            <div style={{
              fontSize: 11, color: A.faint, fontFamily: 'DM Mono, monospace', marginTop: 4,
            }}>
              {destinationSlug}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={buildGuideUrl(destinationSlug, variant)}
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
        <div style={{
          display: 'flex', gap: 8, paddingBottom: 4,
          borderBottom: `1px solid ${A.border}`,
        }}>
          <button onClick={() => setModalTab('overlay')} style={tabBtn('overlay')}>Overlay</button>
          {showAccess && (
            <button onClick={() => setModalTab('access')} style={tabBtn('access')}>Access</button>
          )}
          <button onClick={() => setModalTab('download')} style={tabBtn('download')}>Download</button>
        </div>

        {/* Overlay tab */}
        {modalTab === 'overlay' && (
          <GuideOverlayEditor
            variant={variant}
            guide={guide}
            destinationName={destinationName}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={onClose}
          />
        )}

        {/* Access tab — gated on variantHasGrants */}
        {modalTab === 'access' && showAccess && fetchGrants && createGrant && deleteGrant && (
          <GuideAccessTab
            globalDestinationId={guide.global_destination_id}
            fetchGrants={fetchGrants}
            createGrant={createGrant}
            deleteGrant={deleteGrant}
          />
        )}

        {/* Download tab */}
        {modalTab === 'download' && (
          <GuideDownloadTab
            variant={variant}
            destinationSlug={destinationSlug}
            destinationName={destinationName}
            destinationId={guide.global_destination_id}
          />
        )}
      </div>
    </div>
  )
}