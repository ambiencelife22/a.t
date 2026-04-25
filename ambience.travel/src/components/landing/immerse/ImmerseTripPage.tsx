// ImmerseTripPage.tsx — DB-wired engagement overview page
// Route: /immerse/{url_id}        (private, token-keyed — e.g. Yazeed)
//        /immerse/honeymoon       (public preview — slug = 'honeymoon1')
// Renders hero + welcome letter + route strip + (optional) secondary hero + destination rows + pricing
// Does not own destination subpages (see DestinationPage)
//
// Last updated: S30E — Type rename ImmerseTripData → ImmerseEngagementData.
//   Component name + filename preserved this session; full ImmerseTrip* →
//   ImmerseEngagement* file rename deferred to stage 2.
// Prior: S30 — Welcome letter wired between Hero 1 and Route Strip.
//   Canonical singleton (travel_immerse_welcome_letter) + per-engagement
//   overrides (welcome_*_override columns). Component hides if all 5 fields
//   resolve empty.

import ImmerseLayout from '../../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip } from './ImmerseTripComponents'
import { ImmerseDestinationRows } from './ImmerseTripComponents'
import { ImmerseTripPricing } from './ImmerseTripComponents'
import { buildImmerseNavItems } from './ImmerseTripRoute'
import type { ImmerseEngagementData } from '../../../lib/immerseTypes'

export default function ImmerseTripPage({ data }: { data: ImmerseEngagementData | null }) {
  if (!data) return null

  // Trip Overview is always the active item here (this IS the overview route).
  const navItems = buildImmerseNavItems(data, null)
  const logoHref = `/immerse/${data.urlId}`

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
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

      <ImmerseWelcomeLetter {...data.welcomeLetter} />

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