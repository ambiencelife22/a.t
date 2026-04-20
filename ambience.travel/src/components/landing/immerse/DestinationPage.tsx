// DestinationPage.tsx — Destination subpage for immerse journey
// Routes:
//   Public legacy: /immerse/honeymoon/:destination
//   Public S21:    /immerse/:public_journey_slug/:destination
//   Private trip:  /immerse/:url_id/:destination
// Last updated: S21 — renamed from HoneymoonDestinationPage. Fully data-driven
//   hero (guestName, dateLabel, titlePrefix, nightsLabel all derived from trip +
//   destination data). Consumes ImmerseDestinationHotelsShape discriminated
//   union (flat vs regioned hotels). Bad destination slug still redirects to
//   parent overview with toast.

import { useEffect, useMemo, useState } from 'react'
import ImmerseLayout from '../../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import ImmerseStructuredData from './ImmerseStructuredData'
import { ImmerseDestIntro } from './ImmerseDestinationComponents'
import { ImmerseHotelOptions } from './ImmerseDestinationComponents'
import { ImmerseContentGrid } from './ImmerseDestinationComponents'
import { ImmerseDestPricing } from './ImmerseDestinationComponents'
import { getImmerseDestination } from '../../../lib/immerseQueries'
import { getImmerseTrip, getImmerseTripBySlug } from '../../../lib/immerseTripQueries'
import { getImmerseBottomContent } from '../../../lib/immerseBottomNotes'
import { useToast } from '../../../lib/ToastContext'
import type { ImmerseDestinationData, ImmerseTripData } from '../../../lib/immerseTypes'

type RouteParts = {
  journeyToken:    string        // 'honeymoon' | 11-char url_id | public_journey_slug
  destinationSlug: string
  isPublicLegacy:  boolean       // true when journeyToken === 'honeymoon'
}

function resolveRouteParts(pathname: string): RouteParts {
  const parts = pathname.replace(/\/$/, '').split('/')
  const secondLast = parts[parts.length - 2] ?? ''
  const last       = parts[parts.length - 1] ?? ''
  const isPublicLegacy = secondLast === 'honeymoon'

  return {
    journeyToken:    secondLast,
    destinationSlug: last,
    isPublicLegacy,
  }
}

// S21: parent overview URL for redirect-on-not-found.
// Legacy /immerse/honeymoon maps back to /immerse/honeymoon.
// Other journey tokens map back to /immerse/<token>.
function getParentOverviewUrl(journeyToken: string): string {
  return `/immerse/${journeyToken}`
}

// ─── Hero derivation helpers ──────────────────────────────────────────────────

// Pull a "Month Year" or similar date fragment out of trip.statusLabel.
// Examples: "Designed For You · January 2027" → "January 2027"
//           "Designed For You"                → ""
//           "January 2027 concept preview"    → "January 2027"
function deriveDateLabel(statusLabel: string | undefined): string {
  if (!statusLabel) return ''
  // Match something like "Month YYYY" or "Month YYYY–Month YYYY"
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
function deriveNightsLabel(trip: ImmerseTripData | null, destinationSlug: string): string {
  if (!trip) return ''
  const row = trip.destinationRows.find(r => r.destinationSlug === destinationSlug)
  return row?.stayLabel ?? ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DestinationPage() {
  const [data, setData]     = useState<ImmerseDestinationData | null>(null)
  const [trip, setTrip]     = useState<ImmerseTripData | null>(null)
  const [loading, setLoading] = useState(true)
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

  const { journeyToken, destinationSlug, isPublicLegacy } = useMemo(
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

      try {
        // Fetch trip + destination in parallel.
        // For public legacy ('honeymoon'), trip comes via slug lookup.
        // For url_id / public_journey_slug, trip comes via url_id / slug.
        // Queries layer (resolveTripId inside getImmerseDestination) handles
        // the same fan-out internally; here we fetch the trip separately so
        // the hero can derive clientName, dateLabel, nightsLabel, titlePrefix.
        const tripPromise = isPublicLegacy
          ? getImmerseTripBySlug('honeymoon1')
          : /^[A-Za-z0-9]{11}$/.test(journeyToken)
              ? getImmerseTrip(journeyToken)
              : getImmerseTripBySlug(journeyToken)

        const [destinationResult, tripResult] = await Promise.all([
          getImmerseDestination(journeyToken, destinationSlug),
          tripPromise,
        ])

        if (cancelled) return

        if (!destinationResult) {
          handleNotFound(`We couldn't find that page. Returning to the overview.`)
          return
        }

        // Merge bottom content (pricing notes, etc.)
        const bottomContent = await getImmerseBottomContent({
          scope:             isPublicLegacy ? 'public' : journeyToken,
          destinationId:     destinationResult.destinationId,
          destinationSlug:   destinationResult.destinationSlug,
          fallbackHeading:   destinationResult.pricingNotesHeading,
          fallbackTitle:     destinationResult.pricingNotesTitle,
          fallbackNotes:     destinationResult.pricingNotes ?? [],
        })

        if (cancelled) return

        const mergedData: ImmerseDestinationData = {
          ...destinationResult,
          pricingNotesHeading: bottomContent.pricingNotesHeading ?? destinationResult.pricingNotesHeading,
          pricingNotesTitle:   bottomContent.pricingNotesTitle   ?? destinationResult.pricingNotesTitle,
          pricingNotes:        bottomContent.pricingNotes,
        }

        setData(mergedData)
        setTrip(tripResult)
        setLoading(false)
      } catch (err) {
        console.error('DestinationPage: failed to load destination', err)
        if (cancelled) return
        handleNotFound('Something went wrong loading that destination. Returning to the overview.')
      }
    }

    // S20: redirect handler — toast + pushState back to overview
    function handleNotFound(message: string) {
      const overviewUrl = getParentOverviewUrl(journeyToken)
      toast.warning(message)
      window.history.replaceState(null, '', overviewUrl)
      window.dispatchEvent(new PopStateEvent('popstate'))
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [journeyToken, destinationSlug, isPublicLegacy, toast])

  if (loading) return null
  if (!data)   return null

  // S21: hero values derived from trip + destination data — no hardcodes
  const guestName   = trip?.clientName   ?? 'Our VIP Guest'
  const dateLabel   = deriveDateLabel(trip?.statusLabel)
  const titlePrefix = deriveTitlePrefix(trip?.journeyTypes ?? [])
  const nightsLabel = deriveNightsLabel(trip, destinationSlug)

  return (
    <ImmerseLayout>
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
        diningLabel='Dining + activities'
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
        eyebrow={data.activitiesEyebrow}
        title={data.activitiesTitle}
        body={data.activitiesBody}
        items={data.activities}
      />

      <ImmerseDestPricing data={data} />
    </ImmerseLayout>
  )
}