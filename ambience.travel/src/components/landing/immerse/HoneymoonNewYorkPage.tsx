// HoneymoonNewYorkPage.tsx — NYC destination subpage for Yazeed honeymoon proposal
// Route: /immerse/honeymoon/new-york
// Composes all NYC-specific sections. Does not own other destination subpages.
// Last updated: S10

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
        eyebrow={data.eyebrow}
        title={data.title}
        subtitle={data.subtitle}
        pills={data.heroPills}
        heroImageSrc={data.heroImageSrc}
        heroImageAlt={data.heroImageAlt}

        primaryHref='#hotel-options'
        primaryLabel='Hotel options'
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
        eyebrow={data.activitiesEyebrow}
        title={data.activitiesTitle}
        body={data.activitiesBody}
        items={data.activities}
      />
      <ImmerseDestPricing data={data} />
    </ImmerseLayout>
  )
}