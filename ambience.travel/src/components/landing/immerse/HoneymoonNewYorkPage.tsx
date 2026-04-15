// HoneymoonNewYorkPage.tsx — NYC destination subpage for Yazeed honeymoon proposal
// Route: /immerse/honeymoon/new-york
// Composes all NYC-specific sections. Does not own other destination subpages.
// Last updated: S11

import ImmerseLayout                  from '../../layouts/ImmerseLayout'
import ImmerseHero                    from '../immerse/ImmerseHero'
import { ImmerseDestIntro }           from '../immerse/ImmerseDestinationComponents'
import { ImmerseHotelOptions }        from '../immerse/ImmerseDestinationComponents'
import { ImmerseContentGrid }         from '../immerse/ImmerseDestinationComponents'
import { ImmerseDestPricing }         from '../immerse/ImmerseDestinationComponents'
import { yazeedHoneymoonNewYork }     from '../../../data/immerse/yazeed-honeymoon-new-york'

export default function HoneymoonNewYorkPage() {
  const data = yazeedHoneymoonNewYork

  return (
    <ImmerseLayout>
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