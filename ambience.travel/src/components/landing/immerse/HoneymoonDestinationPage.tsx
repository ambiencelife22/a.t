// HoneymoonDestinationPage.tsx — Destination subpage for immerse journey
// Route: /immerse/:tripId/:destination (e.g. /immerse/gCyRNp7NjF9/st-barths)
// Slug-driven — reads trip + destination from URL, no per-destination component needed.
// Last updated: S14

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
import type { ImmerseDestinationData } from '../../../lib/immerseTypes'

type HeroBlockConfig = {
  imageSrc: string
  imageAlt?: string
  title?: string
  subtitle?: string
}

function resolveRouteParts(): { tripId: string; destinationSlug: string } {
  // Path: /immerse/:tripId/:destination
  const parts = window.location.pathname.replace(/\/$/, '').split('/')

  return {
    tripId: parts[parts.length - 2] ?? '',
    destinationSlug: parts[parts.length - 1] ?? '',
  }
}

const HERO_BLOCKS: Record<string, HeroBlockConfig> = {
  'gCyRNp7NjF9:st-barths': {
    imageSrc: '/images/st-barths/st-barths-romance.webp',
    imageAlt: 'Romantic St. Barths coastal view',
    title: 'St. Barths Escape',
    subtitle: 'Sunlight, stillness, and a rhythm that feels entirely your own.',
  },

  'gCyRNp7NjF9:new-york': {
    imageSrc: '/nyc-temp/nyc-romance.webp',
    imageAlt: 'Romantic New York skyline view at dusk',
    title: 'New York City Romance',
    subtitle: 'Where the city softens into something more intimate.',
  },

  '*:st-barths': {
    imageSrc: '/images/st-barths/st-barths-romance.webp',
    imageAlt: 'St. Barths coastline in soft golden light',
    title: 'St. Barths Escape',
    subtitle: 'A softer rhythm, surrounded by sea and light.',
  },

  '*:new-york': {
    imageSrc: '/landing/nyc-temp/nyc-romance.webp',
    imageAlt: 'Romantic New York skyline view',
    title: 'New York City Romance',
    subtitle: 'A quieter side of the city, made for two.',
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

  const { tripId, destinationSlug } = useMemo(() => resolveRouteParts(), [])
  const heroBlock = useMemo(
    () => getHeroBlockConfig(tripId, destinationSlug),
    [tripId, destinationSlug]
  )

  useEffect(() => {
    if (!destinationSlug) {
      setLoading(false)
      return
    }

    getImmerseDestination(tripId, destinationSlug)
      .then(result => {
        setData(result)
        setLoading(false)
      })
      .catch(err => {
        console.error('HoneymoonDestinationPage: failed to load destination', err)
        setLoading(false)
      })
  }, [tripId, destinationSlug])

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