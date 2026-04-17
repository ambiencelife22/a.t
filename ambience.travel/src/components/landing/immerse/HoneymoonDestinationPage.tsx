// HoneymoonDestinationPage.tsx — Destination subpage for immerse journey
// Routes:
//   Public: /immerse/honeymoon/:destination
//   Trip:   /immerse/:tripId/:destination
// Last updated: S17 — secondary hero now DB-driven via hero_image_src_2

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
import type { ImmerseDestinationData } from '../../../lib/immerseTypes'

type RouteParts = {
  tripId: string
  destinationSlug: string
  isPublic: boolean
}

function resolveRouteParts(): RouteParts {
  const parts = window.location.pathname.replace(/\/$/, '').split('/')

  const secondLast = parts[parts.length - 2] ?? ''
  const last = parts[parts.length - 1] ?? ''

  const isPublic = secondLast === 'honeymoon'

  return {
    tripId: isPublic ? 'honeymoon' : secondLast,
    destinationSlug: last,
    isPublic,
  }
}

export default function HoneymoonDestinationPage() {
  const [data, setData] = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)

  const { tripId, destinationSlug, isPublic } = useMemo(() => resolveRouteParts(), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!destinationSlug) {
        setLoading(false)
        return
      }

      try {
        const result = await getImmerseDestination(tripId, destinationSlug)

        if (cancelled) return

        if (!result) {
          setData(null)
          setLoading(false)
          return
        }

        const bottomContent = await getImmerseBottomContent({
          scope: isPublic ? 'public' : tripId,
          destinationSlug,
          fallbackHeading: result.pricingNotesHeading,
          fallbackTitle: result.pricingNotesTitle,
          fallbackNotes: result.pricingNotes ?? [],
        })

        if (cancelled) return

        const mergedData: ImmerseDestinationData = {
          ...result,
          pricingNotesHeading: bottomContent.pricingNotesHeading ?? result.pricingNotesHeading,
          pricingNotesTitle: bottomContent.pricingNotesTitle ?? result.pricingNotesTitle,
          pricingNotes: bottomContent.pricingNotes,
        }

        setData(mergedData)
      } catch (err) {
        console.error('HoneymoonDestinationPage: failed to load destination', err)
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [tripId, destinationSlug, isPublic])

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

      {!data.heroImageSrc2 && destinationSlug === 'new-york' && (
        <ImmerseHeroBlock
          imageSrc='/landing/nyc-temp/nyc-romance.webp'
          imageAlt='Romantic New York skyline view at dusk'
          title='New York City Romance'
          subtitle='Where the city softens into something more intimate.'
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