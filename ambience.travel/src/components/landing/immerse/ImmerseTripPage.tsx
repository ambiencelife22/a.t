// ImmerseTripPage.tsx — DB-wired trip overview page
// Route: /immerse/{url_id} (trip) OR /immerse/honeymoon (public fallback)
// Renders hero + route strip + destination rows + pricing
// Does not own destination subpages (see HoneymoonDestinationPage)
// Last updated: S18 — adds internal fallback for public honeymoon overview

import ImmerseLayout              from '../../layouts/ImmerseLayout'
import ImmerseHero                from './ImmerseHero'
import { ImmerseRouteStrip }      from './ImmerseTripComponents'
import { ImmerseDestinationRows } from './ImmerseTripComponents'
import { ImmerseTripPricing }     from './ImmerseTripComponents'
import type { ImmerseTripData }   from '../../../lib/immerseTypes'

function isPublicHoneymoonOverview(): boolean {
  const parts = window.location.pathname.replace(/\/$/, '').split('/')

  return parts[1] === 'immerse' && parts[2] === 'honeymoon' && !parts[3]
}

function getFallbackTripData(): ImmerseTripData {
  return {
    // meta
    tripId: 'public-honeymoon',
    urlId: 'honeymoon',
    slug: 'public-honeymoon',
    tripFormat: 'journey',
    journeyTypes: ['honeymoon'],
    clientName: 'Our Guest',
    statusLabel: 'Sample Journey',

    // hero
    eyebrow: 'Public Inspiration',
    title: 'A Honeymoon Journey',
    subtitle:
      'A beautifully considered sequence of city energy, restorative stillness, and memorable stays shaped to feel romantic from beginning to end.',
    heroImageSrc: '/images/shared/honeymoon-overview-hero.webp',
    heroImageAlt: 'Romantic honeymoon overview',
    heroPills: [
      'Thoughtfully paced',
      'Beautiful stays',
      'Romantic dining',
      'Seamless transitions',
    ],

    // route
    routeHeading: 'A romantic arc',
    routeBody:
      'From skyline energy to softer island rhythms and colder cinematic stillness, each stop is chosen to create contrast, atmosphere, and ease throughout the journey.',
    routeStops: [
      {
        id: 'nyc',
        stayLabel: 'Opening',
        title: 'New York',
        note: 'An energetic beginning shaped by skyline views, memorable tables, and the rhythm of the city.',
        imageSrc: '/images/immerse/overview/new-york.webp',
        imageAlt: 'New York skyline',
      },
      {
        id: 'stb',
        stayLabel: 'Middle',
        title: 'St. Barths',
        note: 'A softer Caribbean stretch defined by privacy, sea light, and a slower daily rhythm.',
        imageSrc: '/images/immerse/overview/st-barths.webp',
        imageAlt: 'St. Barths coastline',
      },
      {
        id: 'nordic',
        stayLabel: 'Finale',
        title: 'Nordic Winter',
        note: 'A colder, quieter, more cinematic stretch built around stillness, warmth, and contrast.',
        imageSrc: '/images/immerse/overview/nordic-winter.webp',
        imageAlt: 'Nordic winter landscape',
      },
    ],

    // destinations
    destinationHeading: 'Destination overview',
    destinationRows: [
      {
        id: 'dest-nyc',
        numberLabel: '01',
        title: 'New York',
        mood: 'Urban energy, skyline romance, memorable dining',
        summary:
          'A polished city opening with iconic views, refined stays, and the kind of pace that makes the beginning feel alive.',
        stayLabel: '3 nights',
        destinationSlug: 'new-york',
        imageSrc: '/images/immerse/overview/new-york-row.webp',
        imageAlt: 'New York destination overview',
      },
      {
        id: 'dest-stb',
        numberLabel: '02',
        title: 'St. Barths',
        mood: 'Sea light, privacy, softer rhythm',
        summary:
          'A warmer and more intimate middle stretch, balancing beach, stillness, and beautifully run hospitality.',
        stayLabel: '4 nights',
        destinationSlug: 'st-barths',
        imageSrc: '/images/immerse/overview/st-barths-row.webp',
        imageAlt: 'St. Barths destination overview',
      },
      {
        id: 'dest-nordic',
        numberLabel: '03',
        title: 'Nordic Winter',
        mood: 'Snow, silence, warmth, cinematic contrast',
        summary:
          'A dramatic and atmospheric stretch built around winter landscapes, design-led stays, and restorative calm.',
        stayLabel: '5 nights',
        destinationSlug: 'nordic-winter',
        imageSrc: '/images/immerse/overview/nordic-winter-row.webp',
        imageAlt: 'Nordic Winter destination overview',
      },
    ],

    // pricing
    pricingHeading: 'Indicative pricing',
    pricingTitle: 'At a glance',
    pricingBody:
      'A high-level hotel-led concept overview designed to give a sense of overall journey shape and spend.',
    pricingRows: [
      {
        id: 'price-nyc',
        destination: 'New York',
        recommendedBasis: 'Luxury hotel stay',
        stayLabel: '3 nights',
        indicativeRange: '$8,000–$18,000',
      },
      {
        id: 'price-stb',
        destination: 'St. Barths',
        recommendedBasis: 'Luxury beachfront stay',
        stayLabel: '4 nights',
        indicativeRange: '$14,000–$34,000',
      },
      {
        id: 'price-nordic',
        destination: 'Nordic Winter',
        recommendedBasis: 'Design-led winter stay',
        stayLabel: '5 nights',
        indicativeRange: '$12,000–$28,000',
      },
    ],
    pricingTotalLabel: 'Journey total',
    pricingTotalValue: '$34,000–$80,000+',
    pricingNotesHeading: 'Planning notes',
    pricingNotesTitle: 'What to know',
    pricingNotes: [
      'All pricing is indicative and subject to availability at the time of booking.',
      'Preferred partner amenities are included where applicable.',
      'Flexible terms are prioritized wherever possible, though final cancellation policies vary by property.',
      'Final pricing depends on exact dates, room category, and overall journey structure.',
    ],
  }
}

export default function ImmerseTripPage({ data }: { data: ImmerseTripData | null }) {
  const resolvedData =
    data ?? (isPublicHoneymoonOverview() ? getFallbackTripData() : null)

  if (!resolvedData) return null

  return (
    <ImmerseLayout>
      <ImmerseHero
        guestName={resolvedData.clientName}
        titlePrefix='A Honeymoon'
        title='Journey'
        dateLabel={resolvedData.statusLabel}
        subtitle={resolvedData.subtitle}
        pills={resolvedData.heroPills}
        heroImageSrc={resolvedData.heroImageSrc}
        heroImageAlt={resolvedData.heroImageAlt}
        primaryHref='#destinations'
        primaryLabel='View destinations'
        secondaryHref='#pricing'
        secondaryLabel='Pricing overview'
      />
      <ImmerseRouteStrip data={resolvedData} />
      <ImmerseDestinationRows data={resolvedData} />
      <ImmerseTripPricing data={resolvedData} />
    </ImmerseLayout>
  )
}