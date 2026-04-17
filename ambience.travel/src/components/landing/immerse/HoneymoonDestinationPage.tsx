// HoneymoonDestinationPage.tsx — Destination subpage for yazeed-honeymoon journey
// Route: /immerse/honeymoon/:destination (e.g. new-york, st-barths)
// Slug-driven — reads destination from URL, no per-destination component needed.
// Does not own other journeys or the honeymoon overview page.
// Last updated: S13

import { useEffect, useState }         from 'react'
import ImmerseLayout                   from '../../layouts/ImmerseLayout'
import ImmerseHero                     from './ImmerseHero'
import { ImmerseHeroBlock }               from './ImmerseHeroBlock'
import ImmerseStructuredData           from './ImmerseStructuredData'
import { ImmerseDestIntro }            from './ImmerseDestinationComponents'
import { ImmerseHotelOptions }         from './ImmerseDestinationComponents'
import { ImmerseContentGrid }          from './ImmerseDestinationComponents'
import { ImmerseDestPricing }          from './ImmerseDestinationComponents'
import { getImmerseDestination }       from '../../../lib/immerseQueries'
import type { ImmerseDestinationData } from '../../../lib/immerseTypes'

function resolveDestinationSlug(): string {
  // Path: /immerse/honeymoon/:destination
  const parts = window.location.pathname.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] ?? ''
}

export default function HoneymoonDestinationPage() {
  const [data,    setData]    = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)

  const slug = resolveDestinationSlug()

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    getImmerseDestination('yazeed-honeymoon', slug)
      .then(result => {
        setData(result)
        setLoading(false)
      })
      .catch(err => {
        console.error('HoneymoonDestinationPage: failed to load destination', err)
        setLoading(false)
      })
  }, [slug])

  if (loading) return null
  if (!data)   return null

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
        imageSrc='/nyc-temp/nyc-romance.webp'
        title='New York, After Dark'
        subtitle='The city shifts — and so do you'
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