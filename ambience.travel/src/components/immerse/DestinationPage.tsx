// DestinationPage.tsx — Destination subpage for immerse engagement.
// Routes: 
//   immerse.ambience.travel/<url_id>/<dest>     → subpage
//   ambience.travel/immerse/<url_id>/<dest>     → subpage (legacy/transitional)
//
// Last updated: S53B Closing+1 — per-destination_row hero_eyebrow_override.
//   Resolver chain: destination_row.heroEyebrowOverride
//     → engagement.heroEyebrowOverride
//     → composed guestName + titlePrefix (legacy).
//   Matched via destination_slug + destination_url_slug pair so variants
//   like grossarl2 resolve to their own override row.
// Prior: S53B Closing — engagement.heroEyebrowOverride support added.
// Prior: S42 Add 3 — getImmerseDestinationHotels now receives
//   coreResult.destinationUrlSlug so variant pages scope room overlays
//   correctly via travel_immerse_rooms.destination_url_slug.

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
import { getImmerseDestinationCore }    from '../../queries/queriesImmerseDestCore'
import { getImmerseDestinationHotels }  from '../../queries/queriesImmerseDestHotels'
import { getImmerseDestinationCards }   from '../../queries/queriesImmerseDestCards'
import { getImmerseDestinationPricing } from '../../queries/queriesImmerseDestPricing'
import { useToast } from '../../providers/ToastContext'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { TravelLoadingScreen, NotFound } from './ImmerseStateScreens'
import { getOverviewUrl } from '../../utils/utilsImmersePath'
import type {
  ImmerseDestinationData,
  ImmerseDestinationHotelsShape,
  ImmerseEngagementData,
  ImmersePricingRow,
} from '../../types/typesImmerse'
import type { ImmerseDestinationCore }  from '../../queries/queriesImmerseDestCore'
import type { ImmerseDestinationCards } from '../../queries/queriesImmerseDestCards'

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
  if (!row) return ''
  if (row.nights && row.nights > 0) return `${row.nights} ${row.nights === 1 ? 'Night' : 'Nights'}`
  return row.stayLabel ?? ''
}

// S53B Closing+1 — resolve per-subpage hero eyebrow.
// Match the destination row by slug + url_slug pair so variant pages
// (e.g. grossarl2) get their own scoped override.
function resolveDestinationRowEyebrow(
  engagement: ImmerseEngagementData,
  destinationSlug: string,
  urlSlugContext: string | null,
): string | undefined {
  const match = engagement.destinationRows.find(r =>
    r.destinationSlug === destinationSlug
    && (r.destinationUrlSlug ?? null) === urlSlugContext,
  )
  return match?.heroEyebrowOverride
}

// ── Compose ImmerseDestinationData ───────────────────────────────────────────

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

  const [core,    setCore]    = useState<ImmerseDestinationCore | null>(null)
  const [hotels,  setHotels]  = useState<ImmerseDestinationHotelsShape | null>(null)
  const [cards,   setCards]   = useState<ImmerseDestinationCards | null>(null)
  const [pricing, setPricing] = useState<ImmersePricingRow[] | null>(null)

  const [coreLoading, setCoreLoading] = useState(true)
  const [errored,     setErrored]     = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setCore(null)
      setHotels(null)
      setCards(null)
      setPricing(null)
      setCoreLoading(true)
      setErrored(false)

      try {
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

        getImmerseDestinationHotels(
          engagement.engagementId,
          coreResult.destinationId,
          coreResult.destinationUrlSlug,
        )
          .then(result => { if (!cancelled) setHotels(result) })
          .catch(err => console.error('DestinationPage: hotels fetch failed', err))

        getImmerseDestinationCards(engagement.engagementId, coreResult.globalDestinationId, coreResult.destinationUrlSlug)
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

  const data        = composeData(core, hotels, cards, pricing)
  const dateLabel   = deriveDateLabel(engagement.statusLabel)
  const nightsLabel = deriveNightsLabel(engagement, destinationSlug)

  // S53B Closing+1 — resolver chain for hero eyebrow:
  // 1. destination_row.heroEyebrowOverride (per-subpage)
  // 2. engagement.heroEyebrowOverride (proposal-wide)
  // 3. legacy composed guestName + titlePrefix
  //
  // When either override level is set, render as single elegant line and
  // suppress the italic titlePrefix sub-line.
  const rowEyebrow = resolveDestinationRowEyebrow(
    engagement,
    destinationSlug,
    core.destinationUrlSlug ?? null,
  )
  const resolvedEyebrow = rowEyebrow ?? engagement.heroEyebrowOverride ?? null

  const hasEyebrowOverride  = !!resolvedEyebrow
  const guestNameRendered   = hasEyebrowOverride ? resolvedEyebrow! : engagement.clientName
  const titlePrefixRendered = hasEyebrowOverride
    ? undefined
    : deriveTitlePrefix(engagement.journeyTypes)

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <ImmerseStructuredData data={data} />

      <ImmerseHero
        guestName={guestNameRendered}
        titlePrefix={titlePrefixRendered}
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