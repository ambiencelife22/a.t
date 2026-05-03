// DestinationPage.tsx — Destination subpage for immerse engagement.
// Routes:
//   immerse.ambience.travel/<url_id>/<dest>     → subpage (S32)
//   ambience.travel/immerse/<url_id>/<dest>     → subpage (legacy/transitional)
//
// Last updated: S32K — Pricing now engagement-scoped. getImmerseDestinationPricing
//   now receives core.tripDestinationRowId (the per-engagement destination row id)
//   instead of core.destinationId (canon). Required after migration s32k_71 fanned
//   out the canon pricing rows and re-keyed them by trip_destination_row_id.
// Prior: S32F (file split) — Imports retargeted from monolithic
//   immerseQueries to the 4 split files: immerseDestinationCore (slug cache,
//   override, core fetcher), immerseDestinationHotels, immerseDestinationCards,
//   immerseDestinationPricing. Type imports also retargeted. No behavioural
//   change. Per Dev Standards §II "no barrel index.ts files" — direct
//   imports from each source file.
// Prior: S32F (cleanup pass) — Inline IMMERSE_HOST + isImmerseHost +
//   getOverviewUrl removed in favour of imports from lib/immersePath.
// Prior: S32F (progressive reveal) — 4-stream progressive reveal. Replaces
//   blocking single-fetch model with independent fetches for core / hotels /
//   cards / pricing. Page reveals when core lands (hero + intro + section
//   headings); below-fold sections render shimmer placeholders until each
//   slice arrives. TravelLoadingScreen (branded emblem + "Preparing your
//   journey") replaces minimal text loader for the initial core fetch.
//   Itinerary-membership gate moved to core fetch — page 404s before
//   painting hero if engagement doesn't include this destination.
//
//   Why 4 streams: the previous getImmerseDestination ran ~5-6 sequential
//   round-trips inside one Promise.all chain. User saw "Loading your
//   proposal" for 4-6s before any paint. Now: core resolves in ~3 round-
//   trips and hero paints; hotels/cards/pricing fire in parallel and reveal
//   as they arrive. Estimated user-perceived load: 4-6s → ~1s to first
//   paint, full content within ~3-4s.
//
// Prior: S32E perf — getImmerseDestination called with engagement.engagementId
//   (UUID) instead of engagement.urlId (slug). Query layer signature changed
//   to accept engagementId directly.
// Prior: S32D — Now receives engagement + destinationSlug as props
//   from ImmerseEngagementRoute. Removed internal pathname tracking,
//   popstate/pageshow listeners, getImmerseEngagement call, and synthetic
//   popstate dispatch. Parent owns routing; this component owns destination
//   data fetching only.
// Prior: S30E perf — Render layout shell during load to prevent white-flash.

import { useEffect, useState } from 'react'
import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import ImmerseStructuredData from './ImmerseStructuredData'
import {
  ImmerseDestIntro,
  ImmerseHotelOptions,
  ImmerseContentGrid,
  ImmerseDestPricing,
} from './ImmerseDestinationComponents'
import { HotelsShimmer, ContentGridShimmer, PricingShimmer } from './ImmerseShimmer'
import { getImmerseDestinationCore }    from '../../lib/immerseDestinationCore'
import { getImmerseDestinationHotels }  from '../../lib/immerseDestinationHotels'
import { getImmerseDestinationCards }   from '../../lib/immerseDestinationCards'
import { getImmerseDestinationPricing } from '../../lib/immerseDestinationPricing'
import { useToast } from '../../lib/ToastContext'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { TravelLoadingScreen, NotFound } from './ImmerseStateScreens'
import { getOverviewUrl } from '../../lib/immersePath'
import type {
  ImmerseDestinationData,
  ImmerseDestinationHotelsShape,
  ImmerseEngagementData,
  ImmersePricingRow,
} from '../../lib/immerseTypes'
import type { ImmerseDestinationCore }  from '../../lib/immerseDestinationCore'
import type { ImmerseDestinationCards } from '../../lib/immerseDestinationCards'

// ── Hero derivation helpers ──────────────────────────────────────────────────

function deriveDateLabel(statusLabel: string | undefined): string {
  if (!statusLabel) return ''
  const m = statusLabel.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}(\s*[–-]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})?/i,
  )
  return m ? m[0] : ''
}

function deriveTitlePrefix(journeyTypes: string[]): string {
  if (journeyTypes.includes('honeymoon'))   return 'Honeymoon in'
  if (journeyTypes.includes('anniversary')) return 'Anniversary in'
  if (journeyTypes.includes('family'))      return 'Family time in'
  return 'Your time in'
}

function deriveNightsLabel(engagement: ImmerseEngagementData, destinationSlug: string): string {
  const row = engagement.destinationRows.find(r => r.destinationSlug === destinationSlug)
  return row?.stayLabel ?? ''
}

// ── Compose ImmerseDestinationData from core + hotels + cards + pricing ─────
// Section components consume the bundled ImmerseDestinationData shape. As
// each slice lands we re-compose from current state + sensible empties for
// any slice still loading. The shimmer-vs-real conditional render below
// guarantees a section component never sees its own slice as empty
// placeholder — by the time a section renders, its slice is real.

function composeData(
  core:    ImmerseDestinationCore,
  hotels:  ImmerseDestinationHotelsShape | null,
  cards:   ImmerseDestinationCards | null,
  pricing: ImmersePricingRow[] | null,
): ImmerseDestinationData {
  return {
    destinationId:       core.destinationId,
    destinationSlug:     core.destinationSlug,
    journeyId:           core.journeyId,
    shorthand:           core.shorthand,

    eyebrow:             core.eyebrow,
    title:               core.title,
    subtitle:            core.subtitle,
    heroImageSrc:        core.heroImageSrc,
    heroImageAlt:        core.heroImageAlt,
    heroImageSrc2:       core.heroImageSrc2,
    heroImageAlt2:       core.heroImageAlt2,
    heroTitle2:          core.heroTitle2,
    heroSubtitle2:       core.heroSubtitle2,
    heroPills:           core.heroPills,

    introEyebrow:        core.introEyebrow,
    introTitle:          core.introTitle,
    introBody:           core.introBody,

    hotelsEyebrow:       core.hotelsEyebrow,
    hotelsTitle:         core.hotelsTitle,
    hotelsBody:          core.hotelsBody,
    hotels:              hotels ?? { kind: 'flat', hotels: [] },

    diningEyebrow:       core.diningEyebrow,
    diningTitle:         core.diningTitle,
    diningBody:          core.diningBody,
    dining:              cards?.dining ?? [],

    experiencesEyebrow:  core.experiencesEyebrow,
    experiencesTitle:    core.experiencesTitle,
    experiencesBody:     core.experiencesBody,
    experiences:         cards?.experiences ?? [],

    pricingEyebrow:      core.pricingEyebrow,
    pricingTitle:        core.pricingTitle,
    pricingBody:         core.pricingBody,
    pricingRows:         pricing ?? [],
    pricingCloser:       core.pricingCloser,
    pricingNotesHeading: core.pricingNotesHeading,
    pricingNotesTitle:   core.pricingNotesTitle,
    pricingNotes:        core.pricingNotes,
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  engagement:      ImmerseEngagementData
  destinationSlug: string
}

export default function DestinationPage({ engagement, destinationSlug }: Props) {
  const { toast } = useToast()

  // 4 independent streams. Page reveals when core lands.
  const [core,    setCore]    = useState<ImmerseDestinationCore | null>(null)
  const [hotels,  setHotels]  = useState<ImmerseDestinationHotelsShape | null>(null)
  const [cards,   setCards]   = useState<ImmerseDestinationCards | null>(null)
  const [pricing, setPricing] = useState<ImmersePricingRow[] | null>(null)

  const [coreLoading, setCoreLoading] = useState(true)
  const [errored,     setErrored]     = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Reset state on engagement / destination change
      setCore(null)
      setHotels(null)
      setCards(null)
      setPricing(null)
      setCoreLoading(true)
      setErrored(false)

      try {
        // Stage 1: core. Hero needs this. Itinerary-membership gate lives here.
        const coreResult = await getImmerseDestinationCore(engagement.engagementId, destinationSlug)
        if (cancelled) return

        if (!coreResult) {
          toast.warning(`We couldn't find that page. Returning to the overview.`)
          window.history.replaceState(null, '', getOverviewUrl(engagement.urlId))
          window.dispatchEvent(new PopStateEvent('popstate'))
          setErrored(true)
          setCoreLoading(false)
          return
        }

        setCore(coreResult)
        setCoreLoading(false)

        // Stage 2: hotels, cards, pricing — all in parallel, each lands
        // independently. No await on the outer Promise.all so each setState
        // fires the moment its slice resolves.
        getImmerseDestinationHotels(engagement.engagementId, coreResult.destinationId)
          .then(result => { if (!cancelled) setHotels(result) })
          .catch(err => console.error('DestinationPage: hotels fetch failed', err))

        getImmerseDestinationCards(engagement.engagementId, coreResult.globalDestinationId)
          .then(result => { if (!cancelled) setCards(result) })
          .catch(err => console.error('DestinationPage: cards fetch failed', err))

        getImmerseDestinationPricing(coreResult.tripDestinationRowId)
          .then(result => { if (!cancelled) setPricing(result) })
          .catch(err => console.error('DestinationPage: pricing fetch failed', err))

      } catch (err) {
        console.error('DestinationPage: failed to load destination core', err)
        if (cancelled) return
        toast.warning('Something went wrong loading that destination. Returning to the overview.')
        window.history.replaceState(null, '', getOverviewUrl(engagement.urlId))
        window.dispatchEvent(new PopStateEvent('popstate'))
        setErrored(true)
        setCoreLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [engagement.engagementId, destinationSlug, engagement.urlId, toast])

  const navItems = buildImmerseNavItems(engagement, destinationSlug)
  const logoHref = getOverviewUrl(engagement.urlId)

  // Branded loader until core lands. Errored short-circuits to NotFound.
  if (coreLoading) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <TravelLoadingScreen />
      </ImmerseLayout>
    )
  }

  if (errored || !core) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <NotFound message='Returning to the overview…' />
      </ImmerseLayout>
    )
  }

  // From here, core is guaranteed present. Compose data from current slice
  // state — sections that have data render real components; sections still
  // loading render shimmer.
  const data        = composeData(core, hotels, cards, pricing)
  const dateLabel   = deriveDateLabel(engagement.statusLabel)
  const titlePrefix = deriveTitlePrefix(engagement.journeyTypes)
  const nightsLabel = deriveNightsLabel(engagement, destinationSlug)

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <ImmerseStructuredData data={data} />

      <ImmerseHero
        guestName={engagement.clientName}
        titlePrefix={titlePrefix}
        title={data.title}
        dateLabel={dateLabel}
        nightsLabel={nightsLabel}
        subtitle={data.subtitle}
        heroImageSrc={data.heroImageSrc}
        heroImageAlt={data.heroImageAlt}
        primaryHref='#hotel-options'
        primaryLabel='Hotel options'
        diningHref='#dining'
        diningLabel='Dining + Experiences'
        secondaryHref='#pricing'
        secondaryLabel='Pricing'
      />

      <ImmerseDestIntro data={data} />

      {hotels ? <ImmerseHotelOptions data={data} /> : <HotelsShimmer />}

      {cards ? (
        <ImmerseContentGrid
          id='dining'
          eyebrow={data.diningEyebrow}
          title={data.diningTitle}
          body={data.diningBody}
          items={data.dining}
        />
      ) : (
        <ContentGridShimmer />
      )}

      {data.heroImageSrc2 && (
        <ImmerseHeroBlock
          imageSrc={data.heroImageSrc2}
          imageAlt={data.heroImageAlt2}
          title={data.heroTitle2}
          subtitle={data.heroSubtitle2}
        />
      )}

      {cards ? (
        <ImmerseContentGrid
          dark
          eyebrow={data.experiencesEyebrow}
          title={data.experiencesTitle}
          body={data.experiencesBody}
          items={data.experiences}
        />
      ) : (
        <ContentGridShimmer dark />
      )}

      {pricing ? <ImmerseDestPricing data={data} /> : <PricingShimmer />}
    </ImmerseLayout>
  )
}