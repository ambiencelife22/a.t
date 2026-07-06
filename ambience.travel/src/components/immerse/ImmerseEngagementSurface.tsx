// ImmerseEngagementSurface.tsx — the unified engagement surface (A3 Stage 2b).
//
// ONE surface, registry-driven. Computes (stage, shape), calls resolveSectionSet,
// and renders:
//   proposal/draft stages   → sections in sequence (scroll)
//   delivery/completed stages→ sections as tabs (ImmerseDeliveryTabShell)
// Section CONTENT always comes from SECTION_RENDERERS (single source). This
// replaces the hardcoded section order in ImmerseEngagementPage and the tab
/// switch in ImmerseDeliveryPage — both now dissolved (Stage 4 complete).
//
// Ships behind a shadow mount (Stage 2) — the live route still uses the old
// pages until parity is verified and the route is cut (Stage 3).

import ImmerseLayout from '../layouts/ImmerseLayout'
import DestinationPage from './DestinationPage'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { ImmerseDeliveryTabShell } from './ImmerseDeliveryTabShell'
import { SECTION_RENDERERS, type ShellHandshake } from './ImmerseSectionRenderers'
import type { EngagementClientData } from '../../queries/queriesImmerseEngagement'
import {
  computeEngagementStage,
  resolveEngagementShape,
  resolveSectionSet,
  type SectionType,
  type EngagementStatusSlug,
} from '../../types/typesImmerse'

// Delivery SectionTypes gated by show_tab_* brief columns. Proposal sections are
// never tab-gated. Mapping: registry SectionType -> brief flag.
const SHOW_TAB_FLAG: Partial<Record<SectionType, 'show_tab_confirmation' | 'show_tab_programme' | 'show_tab_brief' | 'show_tab_contacts'>> = {
  confirmation: 'show_tab_confirmation',
  programme:    'show_tab_programme',
  brief:        'show_tab_brief',
  contacts:     'show_tab_contacts',
}

export default function ImmerseEngagementSurface({
  data,
  activeDestSlug = null,
}: {
  data:            EngagementClientData
  activeDestSlug?: string | null
}) {
  const eng   = data.engagement
  const stage = computeEngagementStage({ statusSlug: eng.engagementStatus.slug as EngagementStatusSlug })

  // Destination subpage. The resolver supplies stay detail for any destination
  // proposal; render it as shape 'stay' through the registry — the unified surface
  // path that replaced DestinationPage (cut over S53O). A destination-within-a-
  // journey IS a stay render, so shape is forced to 'stay' regardless of the
  // engagement's journey type. DestinationPage remains only as a fallback when the
  // detail fetch fails (one release, then deleted in Stage D).
  if (activeDestSlug && data.stage === 'proposal') {
    if (data.detail) {
      const staySections = resolveSectionSet(stage, 'stay')
      const navItems = buildImmerseNavItems(eng, activeDestSlug)
      const logoHref = window.location.hostname === 'immerse.ambience.travel'
        ? `/${eng.urlId}`
        : `/immerse/${eng.urlId}`
      const shell: ShellHandshake = {}
      return (
        <ImmerseLayout navItems={navItems} logoHref={logoHref}>
          {staySections.map(s => (
            <div key={s.id}>{SECTION_RENDERERS[s.id](data, shell)}</div>
          ))}
        </ImmerseLayout>
      )
    }
    return <DestinationPage engagement={eng} destinationSlug={activeDestSlug} />
  }

  const shape = resolveEngagementShape(eng.journeyTypes[0] ?? null)
  const sections = resolveSectionSet(stage, shape)

  const navItems = buildImmerseNavItems(eng, activeDestSlug)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${eng.urlId}`
    : `/immerse/${eng.urlId}`

  // ── Delivery / completed: tabbed ─────────────────────────────────────────────
  if (data.stage === 'delivery') {
    const brief = data.bundle.clientData.brief
    // Registry section set, minus any show_tab_* the operator switched off.
    const tabSections = sections
      .map(s => s.id)
      .filter(id => {
        const flag = SHOW_TAB_FLAG[id]
        if (!flag) return true                       // hero etc. — not tab-gated
        return brief?.[flag] !== false               // default-on unless explicitly false
      })

    // Hero renders above the tab bar (registry places it first, sortOrder 0).
    const shell: ShellHandshake = {}
    return (
      <ImmerseLayout>
        {SECTION_RENDERERS.hero(data, shell)}
        <ImmerseDeliveryTabShell ctx={data} sections={tabSections} />
      </ImmerseLayout>
    )
  }

  // ── Proposal / draft: sequential ─────────────────────────────────────────────
  const shell: ShellHandshake = {}
  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      {sections.map(s => (
        <div key={s.id}>{SECTION_RENDERERS[s.id](data, shell)}</div>
      ))}
    </ImmerseLayout>
  )
}