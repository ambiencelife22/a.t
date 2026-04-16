// yazeed-honeymoon-new-york.ts — NYC destination data for Yazeed honeymoon proposal
// Owns all copy, hotel options, dining, activities, and pricing for the NYC subpage.
// Does not own the journey overview or other destination subpages.
// Last updated: S11

import type { ImmerseDestinationData } from '../../lib/immerseTypes'

export const yazeedHoneymoonNewYork: ImmerseDestinationData = {
  destinationId: 'new-york-area',
  journeyId:     'yazeed-honeymoon',

  eyebrow:      'Destination · New York',
  title:        'New York City',
  subtitle:     'A polished city stop designed to bring energy, dining, shopping, and a strong hotel experience into the middle of the honeymoon — with Aman as the primary option and Peninsula and Mandarin as clear alternates.',
  heroImageSrc: 'https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=2200&q=80',
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
      id: 'aman',
      rank: 'primary',
      rankLabel: 'Option 01',
      name: 'Aman New York',
      bullets: [
        'Most private overall tone',
        'Strongest wellness positioning',
        'A more insulated New York experience'
      ],
      imageSrc: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Minimalist luxury suite interior with fireplace',
      stayLabel: '5-6 nights',
      gallery: [
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1400&q=80'
      ],
      rooms: [
        {
          levelLabel: 'Deluxe level',
          roomBasis: 'Junior Suite or similar',
          roomBenefits: [
            'Entry into the Aman experience with full design integrity',
            'Open-plan suite layout with calm, residential tone',
            'Ideal if privacy and atmosphere outweigh size',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Refined minimalist suite interior',
        },
        {
          levelLabel: 'Junior suite level',
          roomBasis: 'Corner Suite or similar',
          roomBenefits: [
            'Greater separation between living and sleeping areas',
            'More complete in-room experience between city outings',
            'Strong balance of scale, calm, and usability',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Luxury suite with warm wood tones',
        },
        {
          levelLabel: 'Deluxe suite level',
          roomBasis: 'Aman Suite or similar',
          roomBenefits: [
            'True residential Manhattan feel',
            'Ideal for extended stays or in-room hosting',
            'Top-tier positioning within the property',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1540541338-5e8e9974ead0?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Expansive luxury suite living room',
        }
      ]
    },

    {
      id: 'peninsula',
      rank: 'secondary',
      rankLabel: 'Option 02',
      name: 'The Peninsula New York',
      bullets: [
        'Classic Midtown benchmark',
        'Strong Fifth Avenue positioning',
        'Most balanced overall option'
      ],
      imageSrc: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Classic New York luxury hotel exterior',
      stayLabel: '5-6 nights',
      gallery: [
        'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=80'
      ],
      rooms: [
        {
          levelLabel: 'Deluxe level',
          roomBasis: 'Deluxe Room or similar',
          roomBenefits: [
            'Polished and reliable entry point',
            'Ideal if the city programme is the focus',
            'Strong value relative to positioning',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Elegant classic hotel room',
        },
        {
          levelLabel: 'Junior suite level',
          roomBasis: 'Junior Suite or similar',
          roomBenefits: [
            'Adds space without overcommitting to full suite pricing',
            'More relaxed in-room experience',
            'Strong midpoint option',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Junior suite with sitting area',
        },
        {
          levelLabel: 'Deluxe suite level',
          roomBasis: 'Deluxe Suite or similar',
          roomBenefits: [
            'Clear separation of living and sleeping areas',
            'Better suited for extended time in-room',
            'Most complete Peninsula experience',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Luxury suite with classic decor',
        }
      ]
    },

    {
      id: 'mandarin',
      rank: 'secondary',
      rankLabel: 'Option 03',
      name: 'Mandarin Oriental New York',
      bullets: [
        'Strongest skyline views',
        'Calmer overall tone',
        'Excellent alternative positioning'
      ],
      imageSrc: 'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Luxury hotel with skyline view',
      stayLabel: '5-6 nights',
      gallery: [
        'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80'
      ],
      rooms: [
        {
          levelLabel: 'Deluxe level',
          roomBasis: 'Deluxe Room or similar',
          roomBenefits: [
            'Strong entry point with immediate skyline presence',
            'Best value within the property',
            'Ideal for shorter in-room dwell time',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Modern hotel room with skyline view',
        },
        {
          levelLabel: 'Junior suite level',
          roomBasis: 'Suite or similar',
          roomBenefits: [
            'More generous layout with defined seating area',
            'Better for decompressing between outings',
            'Balanced upgrade from base rooms',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Suite with living area and large windows',
        },
        {
          levelLabel: 'Deluxe suite level',
          roomBasis: 'Signature Suite or similar',
          roomBenefits: [
            'Panoramic views and full suite experience',
            'Best for extended stays or special occasions',
            'Top-tier positioning within Mandarin',
          ],
          roomImageSrc: 'https://images.unsplash.com/photo-1560347876-aeef00ee58a1?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Luxury suite with panoramic city views',
        }
      ]
    }
  ],

  diningEyebrow: 'Dining',
  diningTitle:   'A Curated Table.',
  diningBody:    'A few curated dining anchors help the destination page feel richer without becoming too dense.',

  dining: [
      {
        id: 'cote',
        kicker: 'Dining block 01',
        name: 'Cote Korean Steakhouse',
        tagline: 'Modern, energetic, and distinctly New York',
        body: 'A strong opening dinner that blends high-end steakhouse dining with a more social, contemporary atmosphere. Well-suited for couples who want something refined but with movement and energy.',
        bullets: [
          'Michelin-starred Korean steakhouse concept',
          'Interactive tabletop grilling with premium cuts',
          'Lively Flatiron atmosphere with strong evening energy'
        ],
        imageSrc: '/immerse/honeymoonyazeed/cote.webp',
        imageAlt: 'Cote Korean Steakhouse dining room with grills and lively atmosphere'
      },
      {
        id: 'catch',
        kicker: 'Dining block 02',
        name: 'Catch',
        tagline: 'Livelier energy, scene, and momentum',
        body: 'Works well if one evening should feel more social, current, and recognizably New York in tone and movement.',
        bullets: [
          'High-energy social atmosphere',
          'Strong seafood-forward menu',
          'Ideal for a more celebratory evening'
        ],
        imageSrc: '/immerse/honeymoonyazeed/catch.webp',
        imageAlt: 'Catch NYC restaurant dining presentation',
      },
      {
        id: 'lateedor',
        kicker: 'Dining block 03',
        name: "La Tête d'Or",
        tagline: 'A richer, more dramatic signature dinner',
        body: 'A strong choice if one dinner should feel more statement-driven, with a slightly deeper and more theatrical atmosphere.',
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
      id:       'broadway-evening',
      kicker:   'Broadway Evenings',
      name:     'Private Broadway Experience',
      tagline:  'Iconic, without the crowds',
      body:     'An evening on Broadway, curated for comfort and access. Premium seating is secured for select productions, with seamless arrival, minimal wait, and the option to pair the experience with a pre- or post-theatre dinner nearby.',
      bullets:  [
        'Premium orchestra or best-available seating',
        'Priority entry and streamlined arrival',
        'Paired with curated dining before or after'
      ],
      imageSrc: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Broadway theatre marquee at night'
    },
    {
      id:       'faena-living-room',
      kicker:   'Evening Atmosphere',
      name:     'Faena New York: The Living Room',
      tagline:  'Live music, glamour, and a true New York night',
      body:     'An evening at The Living Room at Faena New York, where live music, refined cocktails, and a distinctly theatrical atmosphere come together. Designed as a social salon, the space shifts from relaxed early evening drinks into something more vibrant as the night unfolds.',
      bullets:  [
        'Live music and performances throughout the evening',
        'Elegant, curated crowd with a strong sense of place',
        'Ideal alternative to a traditional dinner or post-dinner setting'
      ],
      imageSrc: 'https://www.faena.com/sites/default/files/styles/hero/public/2025-09/250721_FaenaNY2_09.jpg',
      imageAlt: 'Glamorous NYC lounge with live music atmosphere'
    },
    {
      id: 'lv-shopping',
      kicker:   'Private Shopping',
      name:     'Exclusive Fifth Avenue Maison',
      tagline:  'Private retail, elevated',
      body:     'A curated visit to and Exclusive Fifth Avenue Maison, where the experience moves beyond retail into private access. From ready-to-wear and leather goods to exclusive pieces, the visit can be tailored with a dedicated advisor in a more discreet setting.',
      bullets:  [
        'Private appointment',
        'Dedicated advisor with curated selections prepared in advance',
        'Optional styling experience or quiet in-store salon setting'
      ],
      imageSrc: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Louis Vuitton Fifth Avenue boutique interior'
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