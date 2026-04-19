// HoneymoonDestinationPage.tsx — Destination subpage for immerse journey
// Routes:
//   Public: /immerse/honeymoon/:destination
//   Trip:   /immerse/:tripId/:destination
// Last updated: S20 — bad destination slug now redirects to trip overview with toast
//   instead of rendering blank. Trip is already verified by ImmerseTripRoute,
//   so any "not found" here is a destination-level problem (typo or unimplemented
//   subpage). Redirect uses pushState so back button works as expected.

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
import { getImmerseBottomContent } from '../../../lib/immerseBottomNotes'
import { useToast } from '../../../lib/ToastContext'
import type { ImmerseDestinationData } from '../../../lib/immerseTypes'

type RouteParts = {
  tripId: string
  destinationSlug: string
  isPublic: boolean
}

function resolveRouteParts(pathname: string): RouteParts {
  const parts = pathname.replace(/\/$/, '').split('/')

  const secondLast = parts[parts.length - 2] ?? ''
  const last = parts[parts.length - 1] ?? ''

  const isPublic = secondLast === 'honeymoon'

  return {
    tripId: isPublic ? 'honeymoon' : secondLast,
    destinationSlug: last,
    isPublic,
  }
}

// S20: build the parent overview URL for redirect-on-not-found
function getParentOverviewUrl(tripId: string, isPublic: boolean): string {
  if (isPublic) return '/immerse/honeymoon'
  return `/immerse/${tripId}`
}

export default function HoneymoonDestinationPage() {
  const [data, setData] = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // S17: track pathname so back/forward navigation re-resolves the destination
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

  const { tripId, destinationSlug, isPublic } = useMemo(
    () => resolveRouteParts(pathname),
    [pathname]
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      // S20: empty slug — same redirect treatment as bad slug
      if (!destinationSlug) {
        handleNotFound('Destination not found.')
        return
      }

      setLoading(true)

      try {
        const result = await getImmerseDestination(tripId, destinationSlug)

        if (cancelled) return

        if (!result) {
          // S20: destination slug didn't resolve — redirect to overview with toast
          handleNotFound(`We couldn't find that page. Returning to the overview.`)
          return
        }

        // S17: pass UUID + slug to bottom notes
        const bottomContent = await getImmerseBottomContent({
          scope:             isPublic ? 'public' : tripId,
          destinationId:     result.destinationId,
          destinationSlug:   result.destinationSlug,
          fallbackHeading:   result.pricingNotesHeading,
          fallbackTitle:     result.pricingNotesTitle,
          fallbackNotes:     result.pricingNotes ?? [],
        })

        if (cancelled) return

        const mergedData: ImmerseDestinationData = {
          ...result,
          pricingNotesHeading: bottomContent.pricingNotesHeading ?? result.pricingNotesHeading,
          pricingNotesTitle:   bottomContent.pricingNotesTitle   ?? result.pricingNotesTitle,
          pricingNotes:        bottomContent.pricingNotes,
        }

        setData(mergedData)
        setLoading(false)
      } catch (err) {
        console.error('HoneymoonDestinationPage: failed to load destination', err)
        if (cancelled) return
        handleNotFound('Something went wrong loading that destination. Returning to the overview.')
      }
    }

    // S20: redirect handler — navigates to parent overview, fires toast,
    // and updates browser history via pushState so back button returns to landing,
    // not the bad URL.
    function handleNotFound(message: string) {
      const overviewUrl = getParentOverviewUrl(tripId, isPublic)
      toast.warning(message)
      // Replace current history entry — bad URL never shows in back stack
      window.history.replaceState(null, '', overviewUrl)
      // Trigger pathname re-resolution at the App level
      window.dispatchEvent(new PopStateEvent('popstate'))
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [tripId, destinationSlug, isPublic, toast])

  if (loading) return null
  if (!data) return null

  return (
    <ImmerseLayout>
      <ImmerseStructuredData data={data} />

      <ImmerseHero
        guestName='Yazeed'
        titlePrefix='Honeymoon in'
        title={data.title}
        dateLabel='January 2027'
        nightsLabel='5-6 Nights'
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