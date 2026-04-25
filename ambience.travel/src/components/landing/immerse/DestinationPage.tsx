// DestinationPage.tsx — Destination subpage for immerse engagement
// Routes:
//   Public legacy: /immerse/honeymoon/:destination
//   Public S22:    /immerse/pubMuirRzSW/:destination (and other pub-prefixed url_ids)
//   Private:       /immerse/:url_id/:destination
//
// Last updated: S30E stage 2 — buildImmerseNavItems import path updated for
//   renamed source file (ImmerseTripRoute → ImmerseEngagementRoute).
// Prior: S30E stage 1 — Engagement abstraction. getImmerseTrip →
//   getImmerseEngagement; getImmerseTripBySlug → getImmerseEngagementBySlug;
//   type ImmerseTripData → ImmerseEngagementData; local state trip →
//   engagement; deriveNightsLabel parameter renamed.
// Prior: S26 — Builds navItems from engagement.destinationRows and passes to
//   ImmerseLayout. Current destination is marked active via destinationSlug
//   match. logoHref resolves to /immerse/{journeyToken}.

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
import { getImmerseEngagement, getImmerseEngagementBySlug } from '../../../lib/immerseTripQueries'
import { useToast } from '../../../lib/ToastContext'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import type { ImmerseDestinationData, ImmerseEngagementData } from '../../../lib/immerseTypes'

type RouteParts = {
  journeyToken:    string        // 'honeymoon' | 11-char url_id (private or pub-prefixed template)
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

// Parent overview URL for redirect-on-not-found. Legacy /immerse/honeymoon
// maps back to /immerse/honeymoon. Other journey tokens map back to
// /immerse/<token>.
function getParentOverviewUrl(journeyToken: string): string {
  return `/immerse/${journeyToken}`
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
        // Fetch engagement + destination in parallel.
        // Two cases: legacy 'honeymoon' slug, or any url_id (private or
        // public-template — both flow through getImmerseEngagement which
        // keys on url_id).
        const engagementPromise = isPublicLegacy
          ? getImmerseEngagementBySlug('honeymoon1')
          : getImmerseEngagement(journeyToken)

        const [destinationResult, engagementResult] = await Promise.all([
          getImmerseDestination(journeyToken, destinationSlug),
          engagementPromise,
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

  // Hero values derived from engagement + destination data — no hardcodes
  const guestName   = engagement?.clientName   ?? 'Our VIP Guest'
  const dateLabel   = deriveDateLabel(engagement?.statusLabel)
  const titlePrefix = deriveTitlePrefix(engagement?.journeyTypes ?? [])
  const nightsLabel = deriveNightsLabel(engagement, destinationSlug)

  // Build nav items. Engagement may be null if hydration failed — in that
  // case skip the menu entirely (renders logo-only nav). Otherwise pass the
  // full list with the current destination marked active.
  const navItems = engagement ? buildImmerseNavItems(engagement, destinationSlug) : undefined
  const logoHref = `/immerse/${journeyToken}`

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