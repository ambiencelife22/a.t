// ImmerseTripPage.tsx — DB-wired trip overview page
// Route: /immerse/{url_id} — resolved by ImmerseTripRoute, data fetched by urlId
// Renders hero + route strip + destination rows + pricing
// Does not own destination subpages (see HoneymoonDestinationPage)
// Last updated: S14 — replaces HoneymoonOverviewPage, no more static yazeed-honeymoon import

import ImmerseLayout              from '../../layouts/ImmerseLayout'
import ImmerseHero                from './ImmerseHero'
import { ImmerseRouteStrip }      from './ImmerseTripComponents'
import { ImmerseDestinationRows } from './ImmerseTripComponents'
import { ImmerseTripPricing }     from './ImmerseTripComponents'
import type { ImmerseTripData } from '../../../lib/immerseTypes'

export default function ImmerseTripPage({ data }: { data: ImmerseTripData }) {
  return (
    <ImmerseLayout>
      <ImmerseHero
        guestName={data.clientName}
        titlePrefix='A Honeymoon'
        title='Journey'
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
      <ImmerseDestinationRows data={data} />
      <ImmerseTripPricing data={data} />
    </ImmerseLayout>
  )
}