// ImmerseEngagementPage.tsx — Unified client-facing engagement surface.
//
// Collapse A: one component, two render arms, one stage discriminant.
//
//   proposal → Hero + Welcome Letter + Route Strip + Destinations + Pricing
//   delivery → ImmerseDeliveryPage (tabs: Confirmation, Programme, Brief, Contacts)
//
// Receives EngagementClientData from ImmerseEngagementRoute — data already
// fetched, no internal fetch here. ImmerseDeliveryPage re-fetches for the confirmed
// arm (its internal hook) — acceptable until Collapse A phase 2 passes data down.
//
// ImmerseDeliveryPage is NOT modified. It remains the confirmed render authority.
// This file is the composition layer only.
//
// Last updated: S53I — Collapse A page layer. Replaces the 72-line proposal-only
// wrapper. ImmerseDeliveryPage dissolution is Collapse A phase 2.

import ImmerseLayout from '../layouts/ImmerseLayout'
import ImmerseHero from './ImmerseHero'
import { ImmerseHeroBlock } from './ImmerseHeroBlock'
import { ImmerseWelcomeLetter } from './ImmerseComponents'
import { ImmerseRouteStrip, ImmerseDestinationRows, ImmerseEngagementPricing } from './ImmerseEngagementComponents'
import ImmerseDeliveryPage from './ImmerseDeliveryPage'
import { buildImmerseNavItems } from './ImmerseEngagementRoute'
import DestinationPage from './DestinationPage'
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
  // ImmerseDeliveryPage owns the full confirmed render (tabs, bookings, programme,
  // brief, contacts). Delegate entirely — no duplication.
  if (data.stage === 'delivery') {
    // Delivery arm: the delivery surface fetches its own brief/confirmation/programme data internally.
    // urlId is the access token; ImmerseDeliveryPage owns the delivery render.
    return <ImmerseDeliveryPage urlId={data.urlId} />
  }

  // ── Proposal arm ───────────────────────────────────────────────────────────
  const eng      = data.engagement

  // If a destination slug is active, render the destination subpage
  if (activeDestSlug) {
    return (
      <DestinationPage
        engagement={eng}
        destinationSlug={activeDestSlug}
      />
    )
  }

  const navItems = buildImmerseNavItems(eng, activeDestSlug)
  const logoHref = window.location.hostname === 'immerse.ambience.travel'
    ? `/${eng.urlId}`
    : `/immerse/${eng.urlId}`

  const guestNameRendered = eng.heroEyebrowOverride ?? eng.clientName ?? ''

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