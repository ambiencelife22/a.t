// ImmerseTripPage.tsx — DB-wired trip overview page
// Route: /immerse/{url_id}        (private, token-keyed — e.g. Yazeed)
//        /immerse/honeymoon       (public preview — slug = 'honeymoon1')
// Renders hero + route strip + (optional) secondary hero + destination rows + pricing
// Does not own destination subpages (see HoneymoonDestinationPage)
//
// Last updated: S17B (ChatGPT) — destination cards now scroll to lower anchor sections,
// while preserving subpage CTAs inside each row.

import ImmerseLayout from '../../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseRouteStrip } from './ImmerseTripComponents'
import { ImmerseDestinationRows } from './ImmerseTripComponents'
import { ImmerseTripPricing } from './ImmerseTripComponents'
import type { ImmerseTripData } from '../../../lib/immerseTypes'

export default function ImmerseTripPage({ data }: { data: ImmerseTripData | null }) {
  if (!data) return null

  return (
    <ImmerseLayout>
      <ImmerseHero
        guestName={data.clientName}
        titlePrefix=''
        title='Honeymoon'
        dateLabel={data.statusLabel}
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

      {data.heroImageSrc2 && (
        <ImmerseHeroBlock
          imageSrc={data.heroImageSrc2}
          imageAlt={data.heroImageAlt2}
          title={data.heroTitle2}
          subtitle={data.heroSubtitle2}
        />
      )}

      <ImmerseDestinationRows data={data} />
      <ImmerseTripPricing data={data} />
    </ImmerseLayout>
  )
}