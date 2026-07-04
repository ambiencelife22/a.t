// DestinationPage.tsx — Destination subpage for immerse engagement.
// Routes:
//   immerse.ambience.travel/<url_id>/proposal/<dest>  → subpage
//   ambience.travel/immerse/<url_id>/proposal/<dest>  → subpage
//
// Last updated: S53H — single EF call via getProposalDestination replaces
//   4 parallel client-side fetches (queriesImmerseDestCore/Hotels/Cards/Pricing).
//   Load model simplified: one call, one loading state, no progressive shimmer
//   (hotels/cards/pricing arrive together). Render logic unchanged.
// Prior: S53B Closing+1 — per-destination_row hero_eyebrow_override.
// Prior: S53B Closing — engagement.heroEyebrowOverride support added.
// Prior: S42 Add 3 — destinationUrlSlug scoping for variant pages.

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
import { useToast } from '../../providers/ToastContext'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { TravelLoadingScreen, NotFound } from './ImmerseStateScreens'
import { getOverviewUrl } from '../../utils/utilsImmersePath'
import { getProposalDestination } from '../../queries/queriesImmerseProposal'
import type {
  ImmerseDestinationData,
  ImmerseEngagementData,
} from '../../types/typesImmerse'

// ── Hero derivation helpers ───────────────────────────────────────────────────

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
function resolveDestinationRowEyebrow(
  engagement:     ImmerseEngagementData,
  destinationSlug: string,
  urlSlugContext:  string | null,
): string | undefined {
  const match = engagement.destinationRows.find(r =>
    r.destinationSlug === destinationSlug
    && (r.destinationUrlSlug ?? null) === urlSlugContext,
  )
  return match?.heroEyebrowOverride
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  engagement:      ImmerseEngagementData
  destinationSlug: string
}

export default function DestinationPage({ engagement, destinationSlug }: Props) {
  const { toast } = useToast()

  const [data,    setData]    = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setData(null)
      setLoading(true)
      setErrored(false)

      try {
        const result = await getProposalDestination(engagement.urlId, destinationSlug)
        if (cancelled) return

        if (!result) {
          toast.warning(`We couldn't find that page. Returning to the overview.`)
          window.history.replaceState(null, '', getOverviewUrl(engagement.urlId))
          window.dispatchEvent(new PopStateEvent('popstate'))
          setErrored(true)
          setLoading(false)
          return
        }

        setData(result)
        setLoading(false)
      } catch (err) {
        console.error('DestinationPage: failed to load', err)
        if (cancelled) return
        toast.warning('Something went wrong loading that destination. Returning to the overview.')
        window.history.replaceState(null, '', getOverviewUrl(engagement.urlId))
        window.dispatchEvent(new PopStateEvent('popstate'))
        setErrored(true)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [engagement.urlId, engagement.engagementId, destinationSlug, toast])

  const navItems = buildImmerseNavItems(engagement, destinationSlug)
  const logoHref = getOverviewUrl(engagement.urlId)

  if (loading) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <TravelLoadingScreen />
      </ImmerseLayout>
    )
  }

  if (errored || !data) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <NotFound message='Returning to the overview…' />
      </ImmerseLayout>
    )
  }

  const dateLabel   = deriveDateLabel(engagement.statusLabel)
  const nightsLabel = deriveNightsLabel(engagement, destinationSlug)

  // S53B Closing+1 — resolver chain for hero eyebrow:
  // 1. destination_row.heroEyebrowOverride (per-subpage)
  // 2. engagement.heroEyebrowOverride (proposal-wide)
  // 3. legacy composed guestName + titlePrefix
  const rowEyebrow = resolveDestinationRowEyebrow(
    engagement,
    destinationSlug,
    data.destinationSlug ?? null,
  )
  const resolvedEyebrow = rowEyebrow ?? engagement.heroEyebrowOverride ?? null

  const hasEyebrowOverride  = !!resolvedEyebrow
  const guestNameRendered   = hasEyebrowOverride ? resolvedEyebrow! : (engagement.clientName ?? '')
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

      <ImmerseHotelOptions data={data} />

      <ImmerseContentGrid
        id='dining'
        eyebrow={data.diningEyebrow}
        title={data.diningTitle}
        body={data.diningBody}
        items={data.dining}
      />

      {data.heroImageSrc2 && (
        <ImmerseHeroBlock
          imageSrc={data.heroImageSrc2}
          imageAlt={data.heroImageAlt2}
          title={data.heroTitle2}
          subtitle={data.heroSubtitle2}
        />
      )}

      <ImmerseContentGrid
        dark
        eyebrow={data.experiencesEyebrow}
        title={data.experiencesTitle}
        body={data.experiencesBody}
        items={data.experiences}
      />

      <ImmerseDestPricing data={data} />
    </ImmerseLayout>
  )
}