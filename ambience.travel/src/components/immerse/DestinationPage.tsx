// DestinationPage.tsx — Destination subpage for immerse engagement.
// Routes:
//   immerse.ambience.travel/<url_id>/<dest>     → subpage (S32)
//   ambience.travel/immerse/<url_id>/<dest>     → subpage (legacy/transitional)
//
// Last updated: S32D — Now receives engagement + destinationSlug as props
//   from ImmerseEngagementRoute. Removed internal pathname tracking,
//   popstate/pageshow listeners, getImmerseEngagement call, and synthetic
//   popstate dispatch. Parent owns routing; this component owns destination
//   data fetching only. Eliminates back-button blank-page bug where
//   DestinationPage stayed mounted with stale URL state.
// Prior: S30E perf — Render layout shell during load to prevent white-flash.

import { useEffect, useState } from 'react'
import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import ImmerseStructuredData from './ImmerseStructuredData'
import { ImmerseDestIntro } from './ImmerseDestinationComponents'
import { ImmerseHotelOptions } from './ImmerseDestinationComponents'
import { ImmerseContentGrid } from './ImmerseDestinationComponents'
import { ImmerseDestPricing } from './ImmerseDestinationComponents'
import { getImmerseDestination } from '../../lib/immerseQueries'
import { useToast } from '../../lib/ToastContext'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { LoadingScreen, NotFound } from './ImmerseStateScreens'
import type { ImmerseDestinationData, ImmerseEngagementData } from '../../lib/immerseTypes'

const IMMERSE_HOST = 'immerse.ambience.travel'

function isImmerseHost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === IMMERSE_HOST
}

function getOverviewUrl(urlId: string): string {
  return isImmerseHost() ? `/${urlId}` : `/immerse/${urlId}`
}

// ── Hero derivation helpers ──────────────────────────────────────────────────

// Pull a "Month Year" or similar date fragment out of engagement.statusLabel.
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

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  engagement:      ImmerseEngagementData
  destinationSlug: string
}

export default function DestinationPage({ engagement, destinationSlug }: Props) {
  const [data, setData]       = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrored(false)

      try {
        const result = await getImmerseDestination(engagement.urlId, destinationSlug)
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
        console.error('DestinationPage: failed to load destination', err)
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
  }, [engagement.urlId, destinationSlug, toast])

  const navItems = buildImmerseNavItems(engagement, destinationSlug)
  const logoHref = getOverviewUrl(engagement.urlId)

  if (loading) {
    return (
      <ImmerseLayout navItems={navItems} logoHref={logoHref}>
        <LoadingScreen />
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