// HoneymoonDestinationPage.tsx — Destination subpage for immerse journey
// Routes:
//   Public: /immerse/honeymoon/:destination
//   Trip:   /immerse/:tripId/:destination
// Last updated: S17

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

type HeroBlockConfig = {
  imageSrc: string
  imageAlt?: string
  title?: string
  subtitle?: string
}

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

const HERO_BLOCKS: Record<string, HeroBlockConfig> = {
  'gCyRNp7NjF9:new-york': {
    imageSrc: '/landing/nyc-temp/nyc-romance.webp',
    imageAlt: 'Romantic New York skyline view at dusk',
    title: 'New York City Romance',
    subtitle: 'Where the city softens into something more intimate.',
  },
  'gCyRNp7NjF9:st-barths': {
    imageSrc: '/images/st-barths/st-barths-romance.webp',
    imageAlt: 'Romantic St. Barths coastal view',
    title: 'St. Barths Escape',
    subtitle: 'Sunlight, stillness, and a rhythm that feels entirely your own.',
  },
  'gCyRNp7NjF9:nordic-winter': {
    imageSrc: '/images/nordic-winter/nordic-winter-romance.webp',
    imageAlt: 'Snow-covered Nordic landscape with soft winter light',
    title: 'Nordic Winter Escape',
    subtitle: 'Stillness, warmth, and a more intimate rhythm in the heart of winter.',
  },
  '*:new-york': {
    imageSrc: '/landing/nyc-temp/nyc-romance.webp',
    imageAlt: 'Romantic New York skyline view',
    title: 'New York City Romance',
    subtitle: 'A quieter side of the city, made for two.',
  },
  '*:st-barths': {
    imageSrc: '/images/st-barths/st-barths-romance.webp',
    imageAlt: 'St. Barths coastline in soft golden light',
    title: 'St. Barths Escape',
    subtitle: 'A softer rhythm, surrounded by sea and light.',
  },
  '*:nordic-winter': {
    imageSrc: '/images/nordic-winter/nordic-winter-romance.webp',
    imageAlt: 'Nordic winter landscape in soft light',
    title: 'Nordic Winter Escape',
    subtitle: 'A quieter, colder, more cinematic stretch of the journey.',
  },
  '*:*': {
    imageSrc: '/images/shared/romance-default.webp',
    imageAlt: 'Romantic travel moment',
    title: 'A Romantic Interlude',
    subtitle: 'A moment within the journey, shaped entirely around you.',
  },
}

function getHeroBlockConfig(tripId: string, destinationSlug: string): HeroBlockConfig {
  return (
    HERO_BLOCKS[`${tripId}:${destinationSlug}`] ||
    HERO_BLOCKS[`*:${destinationSlug}`] ||
    HERO_BLOCKS['*:*']
  )
}

export default function HoneymoonDestinationPage() {
  const [data, setData] = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)

  const { tripId, destinationSlug, isPublic } = useMemo(() => resolveRouteParts(), [])
  const heroBlock = useMemo(
    () => getHeroBlockConfig(tripId, destinationSlug),
    [tripId, destinationSlug]
  )

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

      <ImmerseHeroBlock
        imageSrc={heroBlock.imageSrc}
        imageAlt={heroBlock.imageAlt}
        title={heroBlock.title}
        subtitle={heroBlock.subtitle}
      />

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