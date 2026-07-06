// ImmerseSectionRenderers.tsx — SECTION_RENDERERS: SectionType -> renderer.
//
// A3 Stage 1 (ships dark — nothing consumes this yet). The unified engagement
// surface (Stage 2) will call resolveSectionSet(stage, shape) and render each
// returned SectionType via this map. Existing section components are wrapped
// UNCHANGED — this is the composition seam, not a rewrite.
//
// Context: the existing EngagementClientData discriminated union (proposal|delivery).
//   NOT a new parallel type — that union already IS the render context.
// Shell: surface-owned presentation callbacks (the programme active-day handshake),
//   kept separate from data so no renderer takes a god-prop.
//
// Boundary: types imported through the query layer (queriesImmerseEngagement), never
//   from types/ directly in this .tsx.

import type { ReactNode } from 'react'
import type { SectionType } from '../../types/typesImmerse'
import type { EngagementClientData } from '../../queries/queriesImmerseEngagement'

import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip, ImmerseDestinationRows, ImmerseEngagementPricing } from './ImmerseEngagementComponents'
import { ConfirmationTab, ProgrammeTab, TripBriefTab, ContactsTab } from './ImmerseConfirmedSections'
import { formatDateRange } from '../../utils/utilsDates'

// Surface-owned presentation state passed alongside the data context. The
// programme section reports its active day up to the surface (sticky day-nav
// handshake); other sections ignore it. Kept OUT of EngagementClientData because
// it is presentation wiring, not engagement data.
export type ShellHandshake = {
  onActiveDayChange?: (label: string, openSidebar: () => void) => void
}

// A renderer takes the discriminated context + shell, returns a node or null
// (null = section resolved by the registry but not renderable for this data,
// e.g. route with a single destination, interstitial without a second hero).
export type SectionRenderer = (
  ctx:   EngagementClientData,
  shell: ShellHandshake,
) => ReactNode

// ── Proposal hero props (built from engagement) ──────────────────────────────
function proposalHero(ctx: Extract<EngagementClientData, { stage: 'proposal' }>): ReactNode {
  const eng = ctx.engagement
  const guestNameRendered = eng.heroEyebrowOverride ?? eng.clientName ?? ''
  return (
    <ImmerseHero
      guestName={guestNameRendered}
      titlePrefix=''
      title={eng.title}
      dateLabel={eng.statusLabel}
      itineraryStage={eng.itineraryStatus.label}
      subtitle={eng.subtitle}
      pills={eng.heroPills}
      heroImageSrc={eng.heroImageSrc}
      heroImageAlt={eng.heroImageAlt}
      primaryHref='#destinations'
      primaryLabel='View destinations'
      secondaryHref='#pricing'
      secondaryLabel='Pricing overview'
    />
  )
}

// ── Delivery hero props (built from brief/trip) ──────────────────────────────
function deliveryHero(ctx: Extract<EngagementClientData, { stage: 'delivery' }>): ReactNode {
  const { clientData } = ctx.bundle
  const { trip, brief } = clientData
  const heroTitle    = brief?.brief_title ?? clientData.destinationName ?? trip.destinations[0]?.name ?? ''
  const heroSubtitle = brief?.brief_subtitle ?? trip.destinations.map(d => d.name).join(' \u00b7 ')
  const heroImage    = brief?.hero_image_src || trip.destinations[0]?.hero_image_src || ''
  const guestName    = clientData.guestDisplayName ?? brief?.prepared_for ?? ''
  const dateLabel    = formatDateRange(trip.start_date, trip.end_date) || undefined
  return (
    <ImmerseHero
      guestName={guestName}
      title={heroTitle}
      subtitle={heroSubtitle}
      dateLabel={dateLabel}
      heroImageSrc={heroImage}
      heroImageAlt={heroTitle}
    />
  )
}

// ── SECTION_RENDERERS ────────────────────────────────────────────────────────
// One entry per SectionType. Proposal-capable sections read ctx.engagement (both
// arms carry it). Delivery-only sections require ctx.stage === 'delivery' to reach
// ctx.bundle; they return null on the proposal arm (the registry never resolves
// them there, but the guard keeps each renderer total and type-safe).
export const SECTION_RENDERERS: Record<SectionType, SectionRenderer> = {

  hero: (ctx) =>
    ctx.stage === 'delivery' ? deliveryHero(ctx) : proposalHero(ctx),

  welcome: (ctx) => {
    const eng = ctx.engagement
    return <ImmerseWelcomeLetter {...eng.welcomeLetter} />
  },

  route: (ctx) => {
    const eng = ctx.engagement
    const liveRows = eng.destinationRows.filter(r => r.subpageStatus === 'live').length
    if (!(eng.routeStops.length > 0 && liveRows > 1)) return null
    return <ImmerseRouteStrip data={eng} />
  },

  interstitial: (ctx) => {
    const eng = ctx.engagement
    if (!eng.heroImageSrc2) return null
    return (
      <ImmerseHeroBlock
        imageSrc={eng.heroImageSrc2}
        imageAlt={eng.heroImageAlt2}
        title={eng.heroTitle2}
        subtitle={eng.heroSubtitle2}
      />
    )
  },

  destinations: (ctx) => {
    const eng = ctx.engagement
    return <ImmerseDestinationRows data={eng} />
  },

  pricing: (ctx) => {
    const eng = ctx.engagement
    return <ImmerseEngagementPricing data={eng} />
  },

  confirmation: (ctx) => {
    if (ctx.stage !== 'delivery') return null
    return <ConfirmationTab clientData={ctx.bundle.clientData} />
  },

  programme: (ctx, shell) => {
    if (ctx.stage !== 'delivery') return null
    const { days, entries, clientData } = ctx.bundle
    return (
      <ProgrammeTab
        days={days}
        entries={entries}
        brief={clientData.brief}
        onActiveDayChange={shell.onActiveDayChange}
      />
    )
  },

  brief: (ctx) => {
    if (ctx.stage !== 'delivery') return null
    return <TripBriefTab clientData={ctx.bundle.clientData} />
  },

  contacts: (ctx) => {
    if (ctx.stage !== 'delivery') return null
    return <ContactsTab clientData={ctx.bundle.clientData} />
  },

  // ── Stay-detail sections (eight-shape Stage A — ship dark) ─────────────────
  // These resolve only for shape 'stay'. The stay payload (ImmerseDestinationData)
  // is not yet reachable from EngagementClientData — that arm lands in Stage B.
  // Until then each returns null, keeping SECTION_RENDERERS total over SectionType
  // (tsc exhaustiveness) without fabricating a context field that does not exist.
  // Stage B wiring, verified component + prop:
  //   intro            → <ImmerseDestIntro    data={ctx.detail} />
  //   hotel_options    → <ImmerseHotelOptions data={ctx.detail} />
  //   dining_grid      → <ImmerseContentGrid eyebrow={ctx.detail.diningEyebrow}
  //                        title={ctx.detail.diningTitle} body={ctx.detail.diningBody}
  //                        items={ctx.detail.dining} />
  //   experiences_grid → <ImmerseContentGrid eyebrow={ctx.detail.experiencesEyebrow}
  //                        title={ctx.detail.experiencesTitle} body={ctx.detail.experiencesBody}
  //                        items={ctx.detail.experiences} dark />
  //   detail_pricing   → <ImmerseDestPricing  data={ctx.detail} />
  intro:            () => null,
  hotel_options:    () => null,
  dining_grid:      () => null,
  experiences_grid: () => null,
  detail_pricing:   () => null,
}