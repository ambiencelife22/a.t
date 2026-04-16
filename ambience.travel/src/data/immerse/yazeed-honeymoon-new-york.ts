// yazeed-honeymoon-new-york.ts — NYC destination data for Yazeed honeymoon proposal
// Owns all copy, hotel options, dining, activities, and pricing for the NYC subpage.
// Does not own the journey overview or other destination subpages.
// Last updated: S12

import type { ImmerseDestinationData } from '../../lib/immerseTypes'

export const yazeedHoneymoonNewYork: ImmerseDestinationData = {
  destinationId: 'new-york-area',
  journeyId:     'yazeed-honeymoon',

  eyebrow:      'Destination · New York',
  title:        'New York City',
  subtitle:     'A polished city stop designed to bring energy, dining, shopping, and a strong hotel experience into the middle of the honeymoon — with Aman as the primary option and Peninsula and Mandarin as clear alternates.',
  heroImageSrc: 'https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&fm=jpg&q=90&w=2400',
  heroImageAlt: 'New York City skyline at dusk',
  heroPills:    ['5-6 nights suggested', 'Three hotel options', 'Dining + activities'],

  introEyebrow: 'Why this fits',
  introTitle:   'The right urban contrast.',
  introBody:    'New York works best here as the high-energy city contrast between the winter opening and the beach portion of the honeymoon. The key decision is less about whether New York belongs, and more about which hotel style best matches the couple\'s preferences.',

  hotelsEyebrow: 'Hotel options',
  hotelsTitle:   'Aman first, with two clear alternates.',
  hotelsBody:    'One primary recommendation, two clean alternates — decision-friendly without creating three separate NYC presentations unless the client asks for that later.',

hotels: [
  {
    id:          'aman',
    rank:        'primary',
    rankLabel:   'Option 01',
    name:        'Aman New York',
    imageCredit: 'Aman Resorts',
    bullets: [
      'Most private overall tone',
      'Strongest wellness positioning',
      'A more insulated New York experience'
    ],
    imageSrc:  'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Premier-Suite-56th.jpg?itok=a2QvmpU2',
    imageAlt:  'Premier Suite at Aman New York',
    stayLabel: '5-6 nights',
    gallery: [
      'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Premier-Suite-56th.jpg?itok=a2QvmpU2',
      'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Grand-Suite-copy.jpg?itok=ifBfHY-I',
      'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Corner-Suite--Bedroom.jpg?itok=JuZcGJ5j',
      'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Aman-Suite--Dining-area.jpg?itok=GlbE88SV'
    ],
    rooms: [
      {
        levelLabel: 'Deluxe level',
        roomBasis:  'Premier Suite or similar',
        nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'Entry into the Aman experience with full design integrity',
          'Open-plan suite layout with calm, residential tone',
          'Ideal if privacy and atmosphere outweigh size',
        ],
        roomImageSrc: 'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Premier-Suite-56th.jpg?itok=a2QvmpU2',
        roomImageAlt: 'Premier Suite at Aman New York',
      },
      {
        levelLabel: 'Junior suite level',
        roomBasis:  'Corner Suite or similar',
        nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       0, // replace with real value
        sqm:        0, // replace with real value
        roomBenefits: [
          'Greater separation between living and sleeping areas',
          'More complete in-room experience between city outings',
          'Strong balance of scale, calm, and usability',
        ],
        roomImageSrc: 'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Corner-Suite--Bedroom.jpg?itok=JuZcGJ5j',
        roomImageAlt: 'Corner Suite bedroom at Aman New York',
      },
      {
        levelLabel: 'Deluxe suite level',
        roomBasis:  'Aman Suite or similar',
       nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'True residential Manhattan feel',
          'Ideal for extended stays or in-room hosting',
          'Top-tier positioning within the property',
        ],
        roomImageSrc: 'https://www.aman.com/sites/default/files/styles/central_carousel_large/public/2026-03/Aman-New-York--USA---Accommodation--Aman-Suite--Dining-area.jpg?itok=GlbE88SV',
        roomImageAlt: 'Aman Suite dining area at Aman New York',
      }
    ]
  },
  {
    id:          'peninsula',
    rank:        'secondary',
    rankLabel:   'Option 02',
    name:        'The Peninsula New York',
    imageCredit: 'The Peninsula Hotels',
    bullets: [
      'Classic Midtown benchmark',
      'Strong Fifth Avenue positioning',
      'Most balanced overall option'
    ],
    imageSrc:  'https://www.peninsula.com/en/-/media/images/hero-images/rooms-and-suites/pny-pen-suite1/new-york_the-peninsula-suite-living-room-1-%281%29.jpg?hash=E3C52FB6A2DAD02490BFDD681D35BE3A&mw=2048',
    imageAlt:  'The Peninsula New York suite living room',
    stayLabel: '5-6 nights',
    gallery: [
      'https://www.peninsula.com/en/-/media/images/hero-images/rooms-and-suites/pny-pen-suite1/new-york_the-peninsula-suite-living-room-1-%281%29.jpg?hash=E3C52FB6A2DAD02490BFDD681D35BE3A&mw=2048'
    ],
    rooms: [
      {
        levelLabel: 'Deluxe level',
        roomBasis:  'Deluxe Room or similar',
       nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'Polished and reliable entry point',
          'Ideal if the city programme is the focus',
          'Strong value relative to positioning',
        ],
        roomImageSrc: 'https://www.peninsula.com/en/-/media/images/hero-images/rooms-and-suites/pny-pen-suite1/new-york_the-peninsula-suite-living-room-1-%281%29.jpg?hash=E3C52FB6A2DAD02490BFDD681D35BE3A&mw=2048',
        roomImageAlt: 'The Peninsula New York room image placeholder from official site',
        // roomImagePage: 'https://www.peninsula.com/en/new-york/luxury-hotel-room-suite-types/deluxe-room'
      },
      {
        levelLabel: 'Junior suite level',
        roomBasis:  'Junior Suite or similar',
       nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'Adds space without overcommitting to full suite pricing',
          'More relaxed in-room experience',
          'Strong midpoint option',
        ],
        roomImageSrc: 'https://www.peninsula.com/en/-/media/images/hero-images/rooms-and-suites/pny-pen-suite1/new-york_the-peninsula-suite-living-room-1-%281%29.jpg?hash=E3C52FB6A2DAD02490BFDD681D35BE3A&mw=2048',
        roomImageAlt: 'The Peninsula New York junior suite image placeholder from official site',
        // roomImagePage: 'https://www.peninsula.com/en/new-york/luxury-hotel-room-suite-types/junior-suite'
      },
      {
        levelLabel: 'Deluxe suite level',
        roomBasis:  'Deluxe Suite or similar',
       nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'Clear separation of living and sleeping areas',
          'Better suited for extended time in-room',
          'Most complete Peninsula experience',
        ],
        roomImageSrc: 'https://www.peninsula.com/en/-/media/images/hero-images/rooms-and-suites/pny-pen-suite1/new-york_the-peninsula-suite-living-room-1-%281%29.jpg?hash=E3C52FB6A2DAD02490BFDD681D35BE3A&mw=2048',
        roomImageAlt: 'The Peninsula New York deluxe suite image placeholder from official site',
        // roomImagePage: 'https://www.peninsula.com/en/new-york/luxury-hotel-room-suite-types/deluxe-suite'
      }
    ]
  },

  {
    id:          'mandarin',
    rank:        'secondary',
    rankLabel:   'Option 03',
    name:        'Mandarin Oriental New York',
    imageCredit: 'Mandarin Oriental Hotel Group',
    bullets: [
      'Strongest skyline views',
      'Calmer overall tone',
      'Excellent alternative positioning'
    ],
    imageSrc:  'https://media.ffycdn.net/eu/mandarin-oriental-hotel-group/iz342uokN4ioGgTT36wc.jpg',
    imageAlt:  'Mandarin Oriental brand image placeholder',
    stayLabel: '5-6 nights',
    gallery: [
      'https://media.ffycdn.net/eu/mandarin-oriental-hotel-group/iz342uokN4ioGgTT36wc.jpg'
    ],
    rooms: [
      {
        levelLabel: 'Deluxe level',
        roomBasis:  'Central Park View Room or similar',
       nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'Strong entry point with immediate skyline presence',
          'Best value within the property',
          'Ideal for shorter in-room dwell time',
        ],
        roomImageSrc: 'https://media.ffycdn.net/eu/mandarin-oriental-hotel-group/iz342uokN4ioGgTT36wc.jpg',
        roomImageAlt: 'Mandarin Oriental New York room image placeholder',
        // roomImagePage: 'https://www.mandarinoriental.com/en/new-york/manhattan/stay/central-park-view-room'
      },
      {
        levelLabel: 'Junior suite level',
        roomBasis:  'Central Park View Suite or similar',
       nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       100, // replace with real value
        sqm:        10, // replace with real value
        roomBenefits: [
          'More generous layout with defined seating area',
          'Better for decompressing between outings',
          'Balanced upgrade from base rooms',
        ],
        roomImageSrc: 'https://media.ffycdn.net/eu/mandarin-oriental-hotel-group/iz342uokN4ioGgTT36wc.jpg',
        roomImageAlt: 'Mandarin Oriental New York suite image placeholder',
        // roomImagePage: 'https://www.mandarinoriental.com/en/new-york/manhattan/stay/central-park-view-suite'
      },
      {
        levelLabel: 'Deluxe suite level',
        roomBasis:  'Oriental Suite or similar',
        nightlyRate: '$2,000',
        publicNightlyRate: '$2,500',
        sqft:       0, // replace with real value
        sqm:        0, // replace with real value
        roomBenefits: [
          'Panoramic views and full suite experience',
          'Best for extended stays or special occasions',
          'Top-tier positioning within Mandarin',
        ],
        roomImageSrc: 'https://media.ffycdn.net/eu/mandarin-oriental-hotel-group/iz342uokN4ioGgTT36wc.jpg',
        roomImageAlt: 'Mandarin Oriental New York signature suite image placeholder',
        // roomImagePage: 'https://www.mandarinoriental.com/en/new-york/manhattan/stay/oriental-suite'
      }
    ]
  }
],

  diningEyebrow: 'Dining',
  diningTitle:   'A Curated Table.',
  diningBody:    'A few curated dining anchors help the destination page feel richer without becoming too dense.',

  dining: [
    {
      id:      'cote',
      kicker:  'Dining block 01',
      name:    'Cote Korean Steakhouse',
      tagline: 'Modern, energetic, and distinctly New York',
      body:    'A strong opening dinner that blends high-end steakhouse dining with a more social, contemporary atmosphere. Well-suited for couples who want something refined but with movement and energy.',
      bullets: [
        'Michelin-starred Korean steakhouse concept',
        'Interactive tabletop grilling with premium cuts',
        'Lively Flatiron atmosphere with strong evening energy'
      ],
      imageSrc: '/immerse/honeymoonyazeed/cote.webp',
      imageAlt: 'Cote Korean Steakhouse dining room with grills and lively atmosphere'
    },
    {
      id:      'catch',
      kicker:  'Dining block 02',
      name:    'Catch',
      tagline: 'Livelier energy, scene, and momentum',
      body:    'Works well if one evening should feel more social, current, and recognizably New York in tone and movement.',
      bullets: [
        'High-energy social atmosphere',
        'Strong seafood-forward menu',
        'Ideal for a more celebratory evening'
      ],
      imageSrc: '/immerse/honeymoonyazeed/catch.webp',
      imageAlt: 'Catch NYC restaurant dining presentation',
    },
    {
      id:      'lateedor',
      kicker:  'Dining block 03',
      name:    "La Tête d'Or",
      tagline: 'A richer, more dramatic signature dinner',
      body:    'A strong choice if one dinner should feel more statement-driven, with a slightly deeper and more theatrical atmosphere.',
      bullets: [
        'Dramatic, theatrical setting',
        'French-led steakhouse format',
        'Strongest statement dining of the set'
      ],
      imageSrc: '/immerse/honeymoonyazeed/latete.webp',
      imageAlt: "La Tête d'Or bar and dining room",
    },
  ],

  activitiesEyebrow: 'Experiences',
  activitiesTitle:   'A Selected Program.',
  activitiesBody:    'A few high-quality anchors that help the client picture the stay quickly without overloading the page.',

  activities: [
    {
      id:      'broadway-evening',
      kicker:  'Broadway Evenings',
      name:    'Private Broadway Experience',
      tagline: 'Iconic, without the crowds',
      body:    'An evening on Broadway, curated for comfort and access. Premium seating is secured for select productions, with seamless arrival, minimal wait, and the option to pair the experience with a pre- or post-theatre dinner nearby.',
      bullets: [
        'Premium orchestra or best-available seating',
        'Priority entry and streamlined arrival',
        'Paired with curated dining before or after'
      ],
      imageSrc:    'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1200&q=80',
      imageAlt:    'Broadway theatre marquee at night',
      imageCredit: 'Unsplash',
      imageLicense: 'https://unsplash.com/license',
    },
    {
      id:      'faena-living-room',
      kicker:  'Evening Atmosphere',
      name:    'Faena New York: The Living Room',
      tagline: 'Live music, glamour, and a true New York night',
      body:    'An evening at The Living Room at Faena New York, where live music, refined cocktails, and a distinctly theatrical atmosphere come together. Designed as a social salon, the space shifts from relaxed early evening drinks into something more vibrant as the night unfolds.',
      bullets: [
        'Live music and performances throughout the evening',
        'Elegant, curated crowd with a strong sense of place',
        'Ideal alternative to a traditional dinner or post-dinner setting'
      ],
      imageSrc:    'https://www.faena.com/sites/default/files/styles/hero/public/2025-09/250721_FaenaNY2_09.jpg',
      imageAlt:    'Glamorous NYC lounge with live music atmosphere',
      imageCredit: 'Faena New York',
      imageCreditUrl: 'https://www.faena.com/new-york',
    },
    {
      id:      'lv-shopping',
      kicker:  'Private Shopping',
      name:    'Exclusive Fifth Avenue Maison',
      tagline: 'Private retail, elevated',
      body:    'A curated visit to an Exclusive Fifth Avenue Maison, where the experience moves beyond retail into private access. From ready-to-wear and leather goods to exclusive pieces, the visit can be tailored with a dedicated advisor in a more discreet setting.',
      bullets: [
        'Private appointment',
        'Dedicated advisor with curated selections prepared in advance',
        'Optional styling experience or quiet in-store salon setting'
      ],
      imageSrc:    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      imageAlt:    'Luxury Fifth Avenue boutique interior',
      imageCredit: 'Unsplash',
      imageLicense: 'https://unsplash.com/license',
    },
  ],

  pricingEyebrow: 'Indicative pricing',
  pricingTitle:   'NYC destination basis',
  pricingBody:    'Aman treated as the primary NYC basis. Peninsula and Mandarin remain visible as alternates.',

  pricingRows: [
    { id: 'pr-aman',      item: 'Aman New York',              basis: 'Primary option',     stay: '5-6 nights', indicativeRange: 'USD 18k-38k+' },
    { id: 'pr-peninsula', item: 'Peninsula New York',         basis: 'Secondary alternate', stay: '5-6 nights', indicativeRange: 'USD 10k-24k+' },
    { id: 'pr-mandarin',  item: 'Mandarin Oriental New York', basis: 'Secondary alternate', stay: '5-6 nights', indicativeRange: 'USD 9k-22k+' },
    { id: 'pr-dining',    item: 'Dining / activities',        basis: 'As selected',         stay: 'Optional',   indicativeRange: 'On request' },
    { id: 'pr-total',     item: 'NYC destination basis',      basis: 'Hotel-led concept',   stay: '5-6 nights', indicativeRange: 'Primary + alternates shown', isTotal: true },
  ],

  pricingNotesHeading: 'Subpage logic',
  pricingNotesTitle:   'Why this works.',
  pricingNotes: [
    'The page stays destination-specific rather than becoming a mini full-trip proposal.',
    'Aman can lead, while Peninsula and Mandarin stay visible as simple alternates.',
    'Dining and activities enrich the page without taking over the hotel decision.',
    'If the hotel changes later, this destination page can be updated without affecting the overview.',
  ],
}