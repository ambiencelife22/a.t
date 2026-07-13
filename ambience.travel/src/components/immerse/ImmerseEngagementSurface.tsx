// ImmerseEngagementSurface.tsx — the unified engagement surface (A3 Stage 2b).
//
// ONE surface, registry-driven. Computes (stage, shape), calls resolveSectionSet,
// and renders:
//   proposal/draft stages   → sections in sequence (scroll)
//   delivery/completed stages→ sections as tabs (ImmerseDeliveryTabShell)
// Section CONTENT always comes from SECTION_RENDERERS (single source). This
// replaced the hardcoded section order in ImmerseEngagementPage and the tab
// switch in ImmerseDeliveryPage — both dissolved (A3).
//
// The default surface for both arms (A3 cutover, S53O). The overview renders
// here; the /<dest> detail view delegates to ImmerseDetailPage.

import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseDetailPage from './ImmerseDetailPage'
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

  // Detail view: one element of the engagement (today a destination-within-a-
  // journey, rendered as shape 'stay'). Delegated to ImmerseDetailPage. Only the
  // proposal arm carries detail; the Extract type on the delegate enforces it.
  if (activeDestSlug && data.stage === 'proposal') {
    return <ImmerseDetailPage data={data} activeDestSlug={activeDestSlug} />
  }

  const shape = resolveEngagementShape(eng.journeyTypes[0] ?? null)
  const sections = resolveSectionSet(stage, shape)

  const navItems = buildImmerseNavItems(eng, activeDestSlug)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${eng.urlId}`
    : `/immerse/${eng.urlId}`

  // ── Delivery / completed: tabbed ─────────────────────────────────────────────
  if (data.stage === 'delivery') {
    const brief = data.bundle.brief
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