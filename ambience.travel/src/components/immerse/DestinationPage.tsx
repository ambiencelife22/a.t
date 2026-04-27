// DestinationPage.tsx — Destination subpage for immerse engagement
// Routes:
//   /immerse/:url_id/:destination — private + public-template engagements
//                                   (public templates use 'pub' prefix
//                                   convention on url_id, e.g. pubMuirRzSW)
//
// Last updated: S30E perf — Fix white-flash on load. Was returning `null`
//   while loading, producing an unstyled gap between unmount and mount.
//   Now renders ImmerseLayout + LoadingScreen during load, matching the
//   shell shape used by ImmerseEngagementRoute. NavItems show as soon as
//   engagement hydrates; LoadingScreen replaces the body until destination
//   data arrives. Imports LoadingScreen + NotFound from shared
//   ImmerseStateScreens.tsx.
// Prior: S30E perf — Removed isPublicLegacy branch and
//   getImmerseEngagementBySlug import. The /immerse/honeymoon/:destination
//   slug-keyed route was deleted; only canonical url_id-keyed routing
//   remains. Route resolver simplified accordingly.
// Prior: S30E stage 3 — buildImmerseNavItems import path updated for
//   renamed source file (ImmerseTripRoute → ImmerseEngagementRoute).
// Prior: S30E stage 1 — Engagement abstraction. getImmerseTrip →
//   getImmerseEngagement; type ImmerseTripData → ImmerseEngagementData;
//   local state trip → engagement; deriveNightsLabel parameter renamed.
// Prior: S26 — Builds navItems from engagement.destinationRows and passes to
//   ImmerseLayout. Current destination is marked active via destinationSlug
//   match. logoHref resolves to /immerse/{urlId}.

import { useEffect, useMemo, useState } from 'react'
import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import ImmerseStructuredData from './ImmerseStructuredData'
import { ImmerseDestIntro } from './ImmerseDestinationComponents'
import { ImmerseHotelOptions } from './ImmerseDestinationComponents'
import { ImmerseContentGrid } from './ImmerseDestinationComponents'
import { ImmerseDestPricing } from './ImmerseDestinationComponents'
import { getImmerseDestination } from '../../lib/immerseQueries'
import { getImmerseEngagement } from '../../lib/immerseEngagementQueries'
import { useToast } from '../../lib/ToastContext'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import { LoadingScreen, NotFound } from './ImmerseStateScreens'
import type { ImmerseDestinationData, ImmerseEngagementData } from '../../lib/immerseTypes'

type RouteParts = {
  urlId:           string
  destinationSlug: string
}

function resolveRouteParts(pathname: string): RouteParts {
  const parts = pathname.replace(/\/$/, '').split('/')
  return {
    urlId:           parts[parts.length - 2] ?? '',
    destinationSlug: parts[parts.length - 1] ?? '',
  }
}

// Parent overview URL for redirect-on-not-found.
function getParentOverviewUrl(urlId: string): string {
  return `/immerse/${urlId}`
}

// ─── Hero derivation helpers ──────────────────────────────────────────────────

// Pull a "Month Year" or similar date fragment out of engagement.statusLabel.
// Examples: "Designed For You · January 2027" → "January 2027"
//           "Designed For You"                → ""
//           "January 2027 concept preview"    → "January 2027"
function deriveDateLabel(statusLabel: string | undefined): string {
  if (!statusLabel) return ''
  const m = statusLabel.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}(\s*[–-]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})?/i,
  )
  return m ? m[0] : ''
}

// Derive the "titlePrefix" line above the destination name.
// "honeymoon" → "Honeymoon in", other → fall back to generic.
function deriveTitlePrefix(journeyTypes: string[]): string {
  if (journeyTypes.includes('honeymoon')) return 'Honeymoon in'
  if (journeyTypes.includes('anniversary')) return 'Anniversary in'
  if (journeyTypes.includes('family')) return 'Family time in'
  return 'Your time in'
}

// Find the destination row by slug to get the stay_label (3-4 nights etc.).
function deriveNightsLabel(engagement: ImmerseEngagementData | null, destinationSlug: string): string {
  if (!engagement) return ''
  const row = engagement.destinationRows.find(r => r.destinationSlug === destinationSlug)
  return row?.stayLabel ?? ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DestinationPage() {
  const [data, setData]               = useState<ImmerseDestinationData | null>(null)
  const [engagement, setEngagement]   = useState<ImmerseEngagementData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [errored, setErrored]         = useState(false)
  const { toast } = useToast()

  // Track pathname so back/forward navigation re-resolves the destination
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    function sync() { setPathname(window.location.pathname) }
    window.addEventListener('popstate', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  const { urlId, destinationSlug } = useMemo(
    () => resolveRouteParts(pathname),
    [pathname]
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Empty slug → not-found redirect
      if (!destinationSlug) {
        handleNotFound('Destination not found.')
        return
      }

      setLoading(true)
      setErrored(false)

      try {
        const [destinationResult, engagementResult] = await Promise.all([
          getImmerseDestination(urlId, destinationSlug),
          getImmerseEngagement(urlId),
        ])

        if (cancelled) return

        if (!destinationResult) {
          handleNotFound(`We couldn't find that page. Returning to the overview.`)
          return
        }

        setData(destinationResult)
        setEngagement(engagementResult)
        setLoading(false)
      } catch (err) {
        console.error('DestinationPage: failed to load destination', err)
        if (cancelled) return
        handleNotFound('Something went wrong loading that destination. Returning to the overview.')
      }
    }

    function handleNotFound(message: string) {
      const overviewUrl = getParentOverviewUrl(urlId)
      toast.warning(message)
      window.history.replaceState(null, '', overviewUrl)
      window.dispatchEvent(new PopStateEvent('popstate'))
      setErrored(true)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [urlId, destinationSlug, toast])

  // Hero values derived from engagement + destination data — no hardcodes.
  // Computed up here so the loading branch can also use the partial nav
  // items (engagement may already be hydrated while destination still loads).
  const navItems = engagement ? buildImmerseNavItems(engagement, destinationSlug) : undefined
  const logoHref = `/immerse/${urlId}`

  // S30E perf: render layout shell during load and error states so there's
  // no unstyled gap between mount transitions. Matches ImmerseEngagementRoute
  // pattern.
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

  const guestName   = engagement?.clientName   ?? 'Our VIP Guest'
  const dateLabel   = deriveDateLabel(engagement?.statusLabel)
  const titlePrefix = deriveTitlePrefix(engagement?.journeyTypes ?? [])
  const nightsLabel = deriveNightsLabel(engagement, destinationSlug)

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <ImmerseStructuredData data={data} />

      <ImmerseHero
        guestName={guestName}
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