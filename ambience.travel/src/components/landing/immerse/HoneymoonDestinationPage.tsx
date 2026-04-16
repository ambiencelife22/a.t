// HoneymoonDestinationPage.tsx — Destination subpage honeymoon proposal
// Route: /immerse/honeymoon/new-york
// Composes all NYC-specific sections. Does not own other destination subpages.
// Last updated: S13

import { useEffect, useState }        from 'react'
import ImmerseLayout                  from '../../layouts/ImmerseLayout'
import ImmerseHero                    from './ImmerseHero'
import ImmerseStructuredData          from './ImmerseStructuredData'
import { ImmerseDestIntro }           from './ImmerseDestinationComponents'
import { ImmerseHotelOptions }        from './ImmerseDestinationComponents'
import { ImmerseContentGrid }         from './ImmerseDestinationComponents'
import { ImmerseDestPricing }         from './ImmerseDestinationComponents'
import { getImmerseDestination }      from '../../../lib/immerseQueries'
import type { ImmerseDestinationData } from '../../../lib/immerseTypes'

export default function HoneymoonDestinationPage() {
  const [data,    setData]    = useState<ImmerseDestinationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getImmerseDestination('yazeed-honeymoon', 'new-york')
      .then(result => {
        setData(result)
        setLoading(false)
      })
      .catch(err => {
        console.error('HoneymoonDestinationPage: failed to load destination', err)
        setLoading(false)
      })
  }, [])

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