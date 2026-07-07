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
import { ImmerseDestIntro, ImmerseContentGrid, ImmerseDestPricing } from './ImmerseDestComponents'
import { ImmerseHotelOptions } from './ImmerseHotelOptions'
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
  // Stay subpage (detail present): the DESTINATION's hero, read only from detail
  // (whose image chain is override -> destination canon -> global, never the
  // engagement). No engagement fallback on a subpage - overlay-seeded or
  // destination canon, nothing borrowed. Journey top-level: the engagement hero.
  const detail = ctx.detail
  if (detail) {
    return (
      <ImmerseHero
        guestName={detail.eyebrow}
        titlePrefix=''
        title={detail.title}
        subtitle={detail.subtitle}
        pills={detail.heroPills}
        heroImageSrc={detail.heroImageSrc}
        heroImageAlt={detail.heroImageAlt}
        primaryHref='#hotels'
        primaryLabel='View stays'
        secondaryHref='#pricing'
        secondaryLabel='Pricing overview'
      />
    )
  }
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
    // Stay-detail subpage (detail present): the interstitial is the DESTINATION's
    // own seeded hero-2 - its override, or nothing. Never the engagement's (that
    // would bleed the journey's lead hero onto every subpage). Journey top-level
    // (no detail): the engagement's hero-2. "The overlay hero seeded for that
    // page, or nothing." Every other stay section reads ctx.detail; this aligns
    // interstitial with them. (Section only resolves for proposal/draft stages.)
    const detail = ctx.stage === 'proposal' ? ctx.detail : undefined
    const hero = detail ?? ctx.engagement
    if (!hero.heroImageSrc2) return null
    return (
      <ImmerseHeroBlock
        imageSrc={hero.heroImageSrc2}
        imageAlt={hero.heroImageAlt2}
        title={hero.heroTitle2}
        subtitle={hero.heroSubtitle2}
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
  intro: (ctx) => {
    if (ctx.stage !== 'proposal' || !ctx.detail) return null
    return <ImmerseDestIntro data={ctx.detail} />
  },

  hotel_options: (ctx) => {
    if (ctx.stage !== 'proposal' || !ctx.detail) return null
    return <ImmerseHotelOptions data={ctx.detail} />
  },

  dining_grid: (ctx) => {
    if (ctx.stage !== 'proposal' || !ctx.detail) return null
    const d = ctx.detail
    return (
      <ImmerseContentGrid
        eyebrow={d.diningEyebrow}
        title={d.diningTitle}
        body={d.diningBody}
        items={d.dining}
      />
    )
  },

  experiences_grid: (ctx) => {
    if (ctx.stage !== 'proposal' || !ctx.detail) return null
    const d = ctx.detail
    return (
      <ImmerseContentGrid
        eyebrow={d.experiencesEyebrow}
        title={d.experiencesTitle}
        body={d.experiencesBody}
        items={d.experiences}
        dark
      />
    )
  },

  detail_pricing: (ctx) => {
    if (ctx.stage !== 'proposal' || !ctx.detail) return null
    return <ImmerseDestPricing data={ctx.detail} />
  },
}