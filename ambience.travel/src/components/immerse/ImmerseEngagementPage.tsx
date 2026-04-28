// ImmerseEngagementPage.tsx — DB-wired engagement overview page
// Route: /immerse/{url_id} — private + public-template engagements
//   (public templates use 'pub' prefix convention on url_id, e.g. pubMuirRzSW)
// Renders hero + welcome letter + route strip + (optional) secondary hero + destination rows + pricing
// Does not own destination subpages (see DestinationPage)
//
// Last updated: S30E stage 2 — File renamed ImmerseTripPage.tsx →
//   ImmerseEngagementPage.tsx. Component renamed ImmerseTripPage →
//   ImmerseEngagementPage. Imports updated for renamed
//   ImmerseEngagementComponents + ImmerseEngagementRoute. Internal pricing
//   import renamed ImmerseTripPricing → ImmerseEngagementPricing.
// Prior: S30E stage 1 — Type rename ImmerseTripData → ImmerseEngagementData.
// Prior: S30 — Welcome letter wired between Hero 1 and Route Strip.
//   Canonical singleton (travel_immerse_welcome_letter) + per-engagement
//   overrides (welcome_*_override columns). Component hides if all 5 fields
//   resolve empty.

import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip } from './ImmerseEngagementComponents'
import { ImmerseDestinationRows } from './ImmerseEngagementComponents'
import { ImmerseEngagementPricing } from './ImmerseEngagementComponents'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import type { ImmerseEngagementData } from '../../lib/immerseTypes'

export default function ImmerseEngagementPage({ data }: { data: ImmerseEngagementData | null }) {
  if (!data) return null

  // Trip Overview is always the active item here (this IS the overview route).
  const navItems = buildImmerseNavItems(data, null)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${data.urlId}`
    : `/immerse/${data.urlId}`

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <ImmerseHero
        guestName={data.clientName}
        titlePrefix=''
        title={data.title}
        dateLabel={data.statusLabel}
        itineraryStage={data.itineraryStatus.label}
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
      <ImmerseEngagementPricing data={data} />
    </ImmerseLayout>
  )
}