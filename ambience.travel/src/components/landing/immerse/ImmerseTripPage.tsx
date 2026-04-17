// ImmerseTripPage.tsx — DB-wired trip overview page
// Route: /immerse/{url_id} (trip) OR /immerse/honeymoon (public fallback)
// Renders hero + route strip + destination rows + pricing
// Does not own destination subpages (see HoneymoonDestinationPage)
// Last updated: S16 — public fallback mirrors Yazeed route order

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
    clientName: 'Our VIP Guest',
    statusLabel: 'Sample Journey',

    // hero
    eyebrow: 'Honeymoon Concept',
    title: 'A Honeymoon Journey',
    subtitle:
      'A beautifully considered sequence starting with winter stillness, moving through city energy, and settling into a restorative island stay.',
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
      'From colder cinematic stillness to skyline energy and softer island rhythms, each stop is chosen to create contrast, atmosphere, and ease throughout the journey.',
    routeStops: [
      {
        id: 'nordic',
        stayLabel: 'Opening',
        title: 'Nordic Winter',
        note: 'A colder, quieter, more cinematic stretch built around stillness, warmth, and contrast.',
        imageSrc: '/immerse/europe/nordic/nordic-winter-1.webp',
        imageAlt: 'Nordic winter landscape',
      },
      {
        id: 'nyc',
        stayLabel: 'Middle',
        title: 'New York',
        note: 'An energetic stretch shaped by skyline views, memorable tables, and the rhythm of the city.',
        imageSrc: '/images/immerse/overview/new-york.webp',
        imageAlt: 'New York skyline',
      },
      {
        id: 'stb',
        stayLabel: 'Main stay',
        title: 'St. Barths',
        note: 'The longest and strongest segment, defined by privacy, sea light, and a slower daily rhythm.',
        imageSrc: '/images/immerse/overview/st-barths.webp',
        imageAlt: 'St. Barths coastline',
      },
    ],

    // destinations
    destinationHeading: 'Destination overview',
    destinationRows: [
      {
        id: 'dest-nordic',
        numberLabel: '01',
        title: 'Nordic Winter',
        mood: 'Snow, silence, warmth, cinematic contrast',
        summary:
          'A dramatic and atmospheric opening built around winter landscapes, design-led stays, and restorative calm.',
        stayLabel: '3-4 nights',
        destinationSlug: 'nordic-winter',
        imageSrc: '/immerse/europe/nordic/nordic-winter-2.webp',
        imageAlt: 'Nordic Winter destination overview',
      },
      {
        id: 'dest-nyc',
        numberLabel: '02',
        title: 'New York',
        mood: 'Urban energy, skyline romance, memorable dining',
        summary:
          'A polished city segment with iconic views, refined stays, and the kind of pace that makes the middle feel alive.',
        stayLabel: '5-6 nights',
        destinationSlug: 'new-york',
        imageSrc: '/images/immerse/overview/new-york-row.webp',
        imageAlt: 'New York destination overview',
      },
      {
        id: 'dest-stb',
        numberLabel: '03',
        title: 'St. Barths',
        mood: 'Sea light, privacy, softer rhythm',
        summary:
          'The longest and strongest stay in the journey, balancing beach, stillness, and beautifully run hospitality.',
        stayLabel: '6-7 nights',
        destinationSlug: 'st-barths',
        imageSrc: '/images/immerse/overview/st-barths-row.webp',
        imageAlt: 'St. Barths destination overview',
      },
    ],

    // pricing
    pricingHeading: 'Indicative pricing',
    pricingTitle: 'At a glance',
    pricingBody:
      'A high-level hotel-led concept overview designed to give a sense of overall journey shape and spend.',
    pricingRows: [
      {
        id: 'price-nordic',
        destination: 'Nordic Winter',
        recommendedBasis: 'Design-led winter stay',
        stayLabel: '3-4 nights',
        indicativeRange: '$4,000–$10,000',
      },
      {
        id: 'price-nyc',
        destination: 'New York',
        recommendedBasis: 'Luxury hotel stay',
        stayLabel: '5-6 nights',
        indicativeRange: '$18,000–$38,000',
      },
      {
        id: 'price-stb',
        destination: 'St. Barths',
        recommendedBasis: 'Luxury beachfront stay',
        stayLabel: '6-7 nights',
        indicativeRange: '$22,000–$45,000',
      },
    ],
    pricingTotalLabel: 'Journey total',
    pricingTotalValue: '$44,000–$93,000+',
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