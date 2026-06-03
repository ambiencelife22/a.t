// ImmerseEngagementPage.tsx — DB-wired engagement overview page
// Route: /immerse/{url_id} — private + public-template engagements
//   (public templates use 'pub' prefix convention on url_id, e.g. pubMuirRzSW)
// Renders hero + welcome letter + route strip + (optional) secondary hero + destination rows + pricing
// Does not own destination subpages (see DestinationPage)
//
// Last updated: S53B Closing — hero eyebrow now respects
//   engagement.heroEyebrowOverride. When populated, replaces guestName
//   with a single elegant line ("For Safiya & Family"). NULL preserves
//   the existing clientName fallback ("Our VIP Guest").
// Prior: S30E stage 2 — File renamed ImmerseTripPage.tsx → ImmerseEngagementPage.tsx.
// Prior: S30E stage 1 — Type rename ImmerseTripData → ImmerseEngagementData.
// Prior: S30 — Welcome letter wired between Hero 1 and Route Strip.

import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip } from './ImmerseEngagementComponents'
import { ImmerseDestinationRows } from './ImmerseEngagementComponents'
import { ImmerseEngagementPricing } from './ImmerseEngagementComponents'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import type { ImmerseEngagementData } from '../../types/typesImmerse'

export default function ImmerseEngagementPage({ data }: { data: ImmerseEngagementData | null }) {
  if (!data) return null

  // Trip Overview is always the active item here (this IS the overview route).
  const navItems = buildImmerseNavItems(data, null)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${data.urlId}`
    : `/immerse/${data.urlId}`

  // S53B Closing — eyebrow override. When populated, replaces clientName
  // with a single elegant tailored line (e.g. "For Safiya & Family").
  const guestNameRendered = data.heroEyebrowOverride ?? data.clientName

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <ImmerseHero
        guestName={guestNameRendered}
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

      {data.routeStops.length > 0 && data.destinationRows.filter(r => r.subpageStatus === 'live').length > 1 && <ImmerseRouteStrip data={data} />}

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