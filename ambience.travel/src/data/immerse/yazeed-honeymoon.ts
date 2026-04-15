// yazeed-honeymoon.ts — master journey data for Yazeed honeymoon proposal
// Owns all copy, route stops, destination summaries, and pricing for the overview page.
// Does not own rendering or destination subpage content.
// Last updated: S10

import type { ImmerseJourneyData } from '../../lib/immerseTypes'

export const yazeedHoneymoon: ImmerseJourneyData = {
  journeyId:   'yazeed-honeymoon',
  clientName:  'Yazeed',
  statusLabel: 'January 2027 concept preview',

  eyebrow:  'Honeymoon Journey Proposal',
  title:    'Saudi → Europe → New York → St. Barth → Europe → Saudi',
  subtitle: 'A well-paced premium honeymoon concept designed around winter atmosphere, city energy, and a restorative Caribbean main stay — with routing structured to feel elegant rather than rushed.',

  heroImageSrc: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=2200&q=80',
  heroImageAlt: 'Caribbean coastline at golden hour',
  heroPills: ['Start / end: Saudi Arabia', 'Style: premium · 5-star', 'Flights: business class'],

  routeHeading: 'Overview together. Decisions separated by destination.',
  routeBody:    'The overview keeps the journey arc clear and elegant. Each destination carries its own hotel choices and cost logic separately — so decisions happen at the right level of detail, at the right time.',

  routeStops: [
    {
      id:        'saudi',
      title:     'Saudi Arabia',
      stayLabel: 'Start / End',
      note:      'Origin and final return.',
      imageSrc:  'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1000&q=80',
      imageAlt:  'Saudi Arabia skyline',
    },
    {
      id:        'winter-europe',
      title:     'Winter Europe',
      stayLabel: '3-4 nights',
      note:      'Short, scenic, romantic opening.',
      imageSrc:  'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?auto=format&fit=crop&w=1000&q=80',
      imageAlt:  'Winter European cityscape',
    },
    {
      id:        'new-york',
      title:     'New York City',
      stayLabel: '5-6 nights',
      note:      'Dining, shopping, skyline energy.',
      imageSrc:  'https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=1000&q=80',
      imageAlt:  'New York City at dusk',
    },
    {
      id:        'st-barth',
      title:     'St. Barth',
      stayLabel: '6-7 nights',
      note:      'Main honeymoon stay.',
      imageSrc:  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
      imageAlt:  'St. Barth beach and water',
    },
    {
      id:        'return-europe',
      title:     'Europe Return',
      stayLabel: '2-3 nights',
      note:      'Soft close before home.',
      imageSrc:  'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1000&q=80',
      imageAlt:  'European city at night',
    },
  ],

  destinationHeading: 'Destination summaries',

  destinationRows: [
    {
      id:          'dest-winter-europe',
      numberLabel: 'Destination 01',
      title:       'Winter Europe',
      mood:        'Scenic winter mood · romantic opening · short and memorable',
      summary:     'This should feel cinematic and brief. Final city can remain flexible until routing and hotel strength become clearer.',
      stayLabel:   '3-4 nights',
      imageSrc:    'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=80',
      imageAlt:    'Winter European landscape',
      href:        '/immerse/honeymoon/winter-europe',
    },
    {
      id:          'dest-new-york',
      numberLabel: 'Destination 02',
      title:       'New York City',
      mood:        'City energy · dining · shopping · polished contrast',
      summary:     'The key decision here is not whether New York works — it is which hotel best matches the couple\'s style and desired level of privacy.',
      stayLabel:   '5-6 nights',
      imageSrc:    'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=1400&q=80',
      imageAlt:    'New York City aerial view',
      href:        '/immerse/honeymoon/new-york',
    },
    {
      id:          'dest-st-barth',
      numberLabel: 'Destination 03',
      title:       'St. Barth',
      mood:        'Main honeymoon stay · beach ease · privacy · strongest emotional peak',
      summary:     'This should remain the longest and strongest hotel stay in the entire journey. The beach portion is the centre of gravity.',
      stayLabel:   '6-7 nights',
      imageSrc:    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
      imageAlt:    'St. Barth turquoise water',
      href:        '/immerse/honeymoon/st-barth',
    },
    {
      id:          'dest-return-europe',
      numberLabel: 'Destination 04',
      title:       'Europe Return',
      mood:        'Soft close · decompression · graceful final routing',
      summary:     'The return Europe stop exists to make the close feel graceful rather than abrupt. Final city should follow the smoothest premium route home.',
      stayLabel:   '2-3 nights',
      imageSrc:    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1400&q=80',
      imageAlt:    'European lights at night',
      href:        '/immerse/honeymoon/return-europe',
    },
  ],

  pricingHeading:    'Pricing summary',
  pricingTitle:      'Recommended basis by destination',
  pricingBody:       'One recommended hotel basis per destination. Each destination subpage carries the alternates and detailed cost logic.',

  pricingRows: [
    { id: 'p-europe',   destination: 'Winter Europe',  recommendedBasis: 'Lead option TBC',   stayLabel: '3-4 nights', indicativeRange: 'USD 4k-10k+' },
    { id: 'p-nyc',      destination: 'New York City',  recommendedBasis: 'Aman New York',     stayLabel: '5-6 nights', indicativeRange: 'USD 18k-38k+' },
    { id: 'p-stbarth',  destination: 'St. Barth',      recommendedBasis: 'Lead luxury option', stayLabel: '6-7 nights', indicativeRange: 'USD 22k-45k+' },
    { id: 'p-return',   destination: 'Europe Return',  recommendedBasis: 'Gateway-led option', stayLabel: '2-3 nights', indicativeRange: 'USD 3k-8k+' },
  ],

  pricingTotalLabel: 'Recommended itinerary',
  pricingTotalValue: 'Approx. USD 47k-101k+',

  pricingNotesHeading: 'What this covers',
  pricingNotesTitle:   'Hotel-led concept only.',
  pricingNotes: [
    'All figures are indicative hotel-only ranges. Flights, transfers, and dining are additional.',
    'Business class flights from Saudi Arabia are budgeted separately and vary significantly by routing.',
    'Each destination subpage shows hotel alternates with their own indicative ranges.',
    'Final figures are confirmed at point of booking based on live availability and client preferences.',
  ],
}
