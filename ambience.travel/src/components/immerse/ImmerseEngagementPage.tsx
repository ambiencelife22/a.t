// ImmerseEngagementPage.tsx — Unified client-facing engagement surface.
//
// Collapse A: one component, two render arms, one stage discriminant.
//
//   proposal  → Hero + Welcome Letter + Route Strip + Destinations + Pricing
//   confirmed → ImmerseTripPage (tabs: Confirmation, Programme, Brief, Contacts)
//
// Receives EngagementClientData from ImmerseEngagementRoute — data already
// fetched, no internal fetch here. ImmerseTripPage re-fetches for the confirmed
// arm (its internal hook) — acceptable until Collapse A phase 2 passes data down.
//
// ImmerseTripPage is NOT modified. It remains the confirmed render authority.
// This file is the composition layer only.
//
// Last updated: S53I — Collapse A page layer. Replaces the 72-line proposal-only
// wrapper. ImmerseTripPage dissolution is Collapse A phase 2.

import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip, ImmerseDestinationRows, ImmerseEngagementPricing } from './ImmerseEngagementComponents'
import ImmerseTripPage from './ImmerseTripPage'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import type { EngagementClientData } from '../../types/typesImmerseClient'

interface Props {
  data:            EngagementClientData
  activeTab?:      string | null
  activeDestSlug?: string | null
}

export default function ImmerseEngagementPage({
  data,
  activeTab      = null,
  activeDestSlug = null,
}: Props) {

  // ── Confirmed arm ───────────────────────────────────────────────────────────
  // ImmerseTripPage owns the full confirmed render (tabs, bookings, programme,
  // brief, contacts). Delegate entirely — no duplication.
  if (data.stage === 'confirmed') {
    return (
      <ImmerseTripPage
        urlId={data.urlId}
        initialTab={activeTab as any ?? undefined}
      />
    )
  }

  // ── Proposal arm ───────────────────────────────────────────────────────────
  const eng      = data.engagement
  const navItems = buildImmerseNavItems(eng, activeDestSlug)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${eng.urlId}`
    : `/immerse/${eng.urlId}`

  const guestNameRendered = eng.heroEyebrowOverride ?? eng.clientName

  return (
    <ImmerseLayout navItems={navItems} logoHref={logoHref}>
      <ImmerseHero
        guestName={guestNameRendered}
        titlePrefix=''
        title={eng.title}
        dateLabel={eng.statusLabel}
        itineraryStage={eng.itineraryStatus.label}
        subtitle={eng.subtitle}
        pills={eng.heroPills}
        heroImageSrc={eng.heroImageSrc}
        heroImageAlt={eng.heroImageAlt}
        primaryHref='#destinations'
        primaryLabel='View destinations'
        secondaryHref='#pricing'
        secondaryLabel='Pricing overview'
      />

      <ImmerseWelcomeLetter {...eng.welcomeLetter} />

      {eng.routeStops.length > 0 &&
        eng.destinationRows.filter(r => r.subpageStatus === 'live').length > 1 && (
          <ImmerseRouteStrip data={eng} />
        )}

      {eng.heroImageSrc2 && (
        <ImmerseHeroBlock
          imageSrc={eng.heroImageSrc2}
          imageAlt={eng.heroImageAlt2}
          title={eng.heroTitle2}
          subtitle={eng.heroSubtitle2}
        />
      )}

      <ImmerseDestinationRows data={eng} />
      <ImmerseEngagementPricing data={eng} />
    </ImmerseLayout>
  )
}