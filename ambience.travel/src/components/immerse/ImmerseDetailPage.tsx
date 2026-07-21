// ImmerseDetailPage.tsx - the detail surface for one element of an engagement.
//
// The overview/detail split (D's model): the engagement has an OVERVIEW (the
// whole journey/pipeline) and a DETAIL view for one element within it. This is
// the detail view - today it renders a destination-within-a-journey as shape
// 'stay' (hotels, dining, experiences, pricing for one place). As the platform
// grows, the same detail surface will render other element types (procurement,
// reservation, concierge) - the shape resolves WHICH detail sections render.
//
// Extracted S53O from ImmerseEngagementSurface's activeDestSlug branch, which
// itself replaced the deleted DestinationPage. Behavior unchanged: same sections,
// same registry, same NotFound fallback.
//
// Shape is currently forced to 'stay' - a destination-within-a-journey IS a stay
// render, and it is the ONLY element type that routes here today. Verified S53O:
// engagement_type_id exists but flows only to admin surfaces; no client route or
// payload carries a non-destination element to this detail view. So forcing 'stay'
// is correct, not debt - there is no other element type to resolve yet.
//
// TO UN-FORCE (gated, do NOT build ahead of it): when a real procurement /
// reservation / concierge element gets (a) a client route to this detail view and
// (b) an element-type on its payload, resolve shape from that type instead of
// hardcoding 'stay'. Until both exist, a resolver here would be a grayed future
// box built early.

import ImmerseLayout from '../layouts/ImmerseLayout'
import { NotFound } from './ImmerseStateScreens'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { SECTION_RENDERERS, type ShellHandshake } from './ImmerseSectionRenderers'
import type { EngagementClientData } from '../../queries/queriesImmerseEngagement'
import {
  computeEngagementStage,
  resolveSectionSet,
  type EngagementStatusSlug,
} from '../../types/typesImmerse'

export default function ImmerseDetailPage({
  data,
  activeDestSlug,
}: {
  data:           Extract<EngagementClientData, { stage: 'proposal' }>
  activeDestSlug: string
}) {
  const eng   = data.engagement
  const stage = computeEngagementStage({ statusSlug: eng.engagementStatus.slug as EngagementStatusSlug })

  // A null detail means the element did not resolve (bad/unpublished slug, or a
  // transient EF failure) - a not-found, not a reason to run a second render path.
  if (!data.detail) {
    return (
      <ImmerseLayout>
        <NotFound message="We couldn't find that page." />
      </ImmerseLayout>
    )
  }
  // Shape forced to 'stay': a destination-within-a-journey IS a stay render,
  // regardless of the engagement's own journey type.
  const sections = resolveSectionSet(stage, 'stay')
  const navItems = buildImmerseNavItems(eng, activeDestSlug)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${eng.urlId}`
    : `/immerse/${eng.urlId}`
  const shell: ShellHandshake = {}

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      {sections.map(s => (
        <div key={s.id}>{SECTION_RENDERERS[s.id](data, shell)}</div>
      ))}
    </ImmerseLayout>
  )
}