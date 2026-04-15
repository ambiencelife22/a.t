// HoneymoonOverviewPage.tsx — journey overview page for Yazeed honeymoon proposal
// Route: /immerse/honeymoon/
// Resolves to the yazeed-honeymoon data file. Composes all overview sections.
// Does not own destination subpages.
// Last updated: S10

import ImmerseLayout             from '../../layouts/ImmerseLayout'
import ImmerseHero               from '../immerse/ImmerseHero'
import { ImmerseRouteStrip }     from '../immerse/ImmerseJourneyComponents'
import { ImmerseDestinationRows } from '../immerse/ImmerseJourneyComponents'
import { ImmerseJourneyPricing } from '../immerse/ImmerseJourneyComponents'
import { yazeedHoneymoon }       from '../../../data/immerse/yazeed-honeymoon'

export default function HoneymoonOverviewPage() {
  const data = yazeedHoneymoon

  return (
    <ImmerseLayout>
      <ImmerseHero
        eyebrow={data.eyebrow}
        title={data.title}
        subtitle={data.subtitle}
        pills={data.heroPills}
        heroImageSrc={data.heroImageSrc}
        heroImageAlt={data.heroImageAlt}

        primaryHref='#destinations'
        primaryLabel='View destinations'
        secondaryHref='#pricing'
        secondaryLabel='Pricing overview'
      />
      <ImmerseRouteStrip data={data} />
      <ImmerseDestinationRows data={data} />
      <ImmerseJourneyPricing data={data} />
    </ImmerseLayout>
  )
}