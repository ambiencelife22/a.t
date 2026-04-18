// ImmerseTripPage.tsx — DB-wired trip overview page
// Route: /immerse/{url_id} (trip) OR /immerse/honeymoon (public fallback)
// Renders hero + route strip + (optional) secondary hero + destination rows + pricing
// Does not own destination subpages (see HoneymoonDestinationPage)
// Last updated: S17 — Added secondary hero + 4-destination public fallback (Europe Return)
//   Public fallback now uses DB-driven copy fields (routeEyebrow, destinationSubtitle, destinationBody)

import ImmerseLayout              from '../../layouts/ImmerseLayout'
import ImmerseHero                from './ImmerseHero'
import { ImmerseHeroBlock }       from './ImmerseHeroBlock'
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
    heroImageSrc: 'https://rjobcbpnhymuczjhqzmh.supabase.co/storage/v1/object/public/ambience-assets/immerse/europe/iceland/accom/11dep/11Dep1.webp',
    heroImageAlt: '11 Deplar Farm exterior, Iceland',
    heroPills: [
      'Thoughtfully paced',
      'Beautiful stays',
      'Romantic dining',
      'Seamless transitions',
    ],

    // route
    routeHeading: 'A romantic arc',
    routeEyebrow: 'Program Overview',
    routeBody:
      'From colder cinematic stillness to skyline energy and softer island rhythms, each stop is chosen to create contrast, atmosphere, and ease throughout the journey.',
    routeStops: [
      {
        id: 'nordic',
        stayLabel: '3-4 nights',
        title: 'Nordic Winter Experience',
        note: 'A colder, quieter, more cinematic stretch built around stillness, warmth, and contrast.',
        imageSrc: '/immerse/europe/nordic/nordic-winter-4.webp',
        imageAlt: 'Nordic winter landscape',
      },
      {
        id: 'nyc',
        stayLabel: '5-6 nights',
        title: 'New York City',
        note: 'An energetic stretch shaped by skyline views, memorable tables, and the rhythm of the city.',
        imageSrc: '/immerse/na/usa/ny/nyc/nyc-winter1.webp',
        imageAlt: 'New York City winter view',
      },
      {
        id: 'stb',
        stayLabel: '6-7 nights',
        title: 'St Barths',
        note: 'The main honeymoon stay, defined by privacy, sea light, and a slower daily rhythm.',
        imageSrc: '/images/immerse/overview/st-barths.webp',
        imageAlt: 'St Barths coastline',
      },
      {
        id: 'euro-return',
        stayLabel: '2-3 nights',
        title: 'Europe Return',
        note: 'A graceful decompression segment before the final return home.',
        imageSrc: '/immerse/europe/nordic/nordic-winter-2.webp',
        imageAlt: 'European skyline on return',
      },
    ],

    // destinations (S17: include destinationId null for public fallback)
    destinationHeading:  'Destination overview',
    destinationSubtitle: 'Four destinations. One continuous feeling.',
    destinationBody:     'Each stop should feel distinct, highly visual, and worth entering on its own.',
    destinationRows: [
      {
        id: 'dest-nordic',
        numberLabel: 'Destination 01',
        title: 'Nordic Winter Experience',
        mood: 'Snow, silence, warmth, cinematic contrast',
        summary:
          'A dramatic and atmospheric opening built around winter landscapes, design-led stays, and restorative calm.',
        stayLabel: '3-4 nights',
        destinationId: null,
        destinationSlug: 'nordic-winter',
        imageSrc: '/immerse/europe/nordic/nordic-winter-4.webp',
        imageAlt: 'Nordic Winter destination overview',
      },
      {
        id: 'dest-nyc',
        numberLabel: 'Destination 02',
        title: 'New York City',
        mood: 'Urban energy, skyline romance, memorable dining',
        summary:
          'A polished city segment with iconic views, refined stays, and the kind of pace that makes the middle feel alive.',
        stayLabel: '5-6 nights',
        destinationId: null,
        destinationSlug: 'new-york',
        imageSrc: '/immerse/na/usa/ny/nyc/nyc-winter1.webp',
        imageAlt: 'New York City destination overview',
      },
      {
        id: 'dest-stb',
        numberLabel: 'Destination 03',
        title: 'St Barths',
        mood: 'Sea light, privacy, softer rhythm',
        summary:
          'The longest and strongest stay in the journey, balancing beach, stillness, and beautifully run hospitality.',
        stayLabel: '6-7 nights',
        destinationId: null,
        destinationSlug: 'st-barths',
        imageSrc: '/images/immerse/overview/st-barths-row.webp',
        imageAlt: 'St Barths destination overview',
      },
      {
        id: 'dest-euro-return',
        numberLabel: 'Destination 04',
        title: 'Europe Return',
        mood: 'Graceful decompression, smooth routing home',
        summary:
          'A short and graceful segment designed to make the close feel elegant rather than abrupt.',
        stayLabel: '2-3 nights',
        destinationId: null,
        destinationSlug: null,
        imageSrc: '/immerse/europe/nordic/nordic-winter-3.webp',
        imageAlt: 'Europe return segment',
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

      {resolvedData.heroImageSrc2 && (
        <ImmerseHeroBlock
          imageSrc={resolvedData.heroImageSrc2}
          imageAlt={resolvedData.heroImageAlt2}
          title={resolvedData.heroTitle2}
          subtitle={resolvedData.heroSubtitle2}
        />
      )}

      <ImmerseDestinationRows data={resolvedData} />
      <ImmerseTripPricing data={resolvedData} />
    </ImmerseLayout>
  )
}