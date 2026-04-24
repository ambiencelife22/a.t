// ImmerseTripPage.tsx — DB-wired trip overview page
// Route: /immerse/{url_id}        (private, token-keyed — e.g. Yazeed)
//        /immerse/honeymoon       (public preview — slug = 'honeymoon1')
// Renders hero + welcome letter + route strip + (optional) secondary hero + destination rows + pricing
// Does not own destination subpages (see DestinationPage)
//
// Last updated: S30 — Welcome letter wired between Hero 1 and Route Strip.
//   Canonical singleton (travel_immerse_welcome_letter) + per-trip overrides
//   (travel_immerse_trips.welcome_*_override). Hydrated via immerseTripQueries;
//   component hides if all 5 fields resolve empty.
// Prior: S26 — Builds navItems from data.destinationRows and passes to
//   ImmerseLayout. This is the overview route — currentDestinationSlug is
//   always null, so "Trip Overview" is always the active item. logoHref
//   points at this trip's own overview URL.
// Prior: S17B (ChatGPT) — destination cards now scroll to lower anchor sections,
//   while preserving subpage CTAs inside each row.

import ImmerseLayout from '../../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip } from './ImmerseTripComponents'
import { ImmerseDestinationRows } from './ImmerseTripComponents'
import { ImmerseTripPricing } from './ImmerseTripComponents'
import { buildImmerseNavItems } from './ImmerseTripRoute'
import type { ImmerseTripData } from '../../../lib/immerseTypes'

export default function ImmerseTripPage({ data }: { data: ImmerseTripData | null }) {
  if (!data) return null

  // S26: Trip Overview is always the active item here (this IS the overview route).
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
