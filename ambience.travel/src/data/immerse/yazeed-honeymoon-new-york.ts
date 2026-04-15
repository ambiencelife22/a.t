// yazeed-honeymoon-new-york.ts — NYC destination data for Yazeed honeymoon proposal
// Owns all copy, hotel options, dining, activities, and pricing for the NYC subpage.
// Does not own the journey overview or other destination subpages.
// Last updated: S11

import type { ImmerseDestinationData } from '../../lib/immerseTypes'

export const yazeedHoneymoonNewYork: ImmerseDestinationData = {
  destinationId: 'new-york',
  journeyId:     'yazeed-honeymoon',

  eyebrow:      'Destination · New York City',
  title:        'New York City',
  subtitle:     'A polished city stop designed to bring energy, dining, shopping, and a strong hotel experience into the middle of the honeymoon — with Aman as the primary option and Peninsula and Mandarin as clear alternates.',
  heroImageSrc: 'https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=2200&q=80',
  heroImageAlt: 'New York City skyline at dusk',
  heroPills:    ['5–6 nights suggested', 'Three hotel options', 'Dining + activities'],

  introEyebrow: 'Why this fits',
  introTitle:   'The right urban contrast.',
  introBody:    'New York works best here as the high-energy city contrast between the winter opening and the beach portion of the honeymoon. The key decision is less about whether New York belongs, and more about which hotel style best matches the couple\'s preferences.',

  hotelsEyebrow: 'Hotel options',
  hotelsTitle:   'Aman first, with two clear alternates.',
  hotelsBody:    'One primary recommendation, two clean alternates — decision-friendly without creating three separate NYC presentations unless the client asks for that later.',

  hotels: [
    {
      id:           'aman',
      rank:         'primary',
      rankLabel:    'Primary option 01',
      name:         'Aman New York',
      tagline:      'Best for privacy, ultra-luxury, and a more insulated city feel',
      description:  'The strongest luxury positioning of the set and the best fit if the goal is to experience New York from a place of calm and separation.',
      bullets:      ['Most private feel', 'Strongest wellness positioning', 'Highest nightly range'],
      nightlyRange: 'USD 3,500–7,000+',
      nightlyNote:  'Primary recommended basis.',
      imageSrc:     'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      imageAlt:     'Aman New York lobby style interior',
      stayLabel:    '5–6 nights',
      rooms: [
        {
          roomCategory: 'Room category · Aman',
          roomBasis:    'Premier Suite or similar',
          roomBenefits: ['Aman-level privacy and service', 'Ideal for a more insulated city stay', 'Strong spa / wellness positioning', 'Best if luxury tone matters more than classic city energy'],
          roomImageSrc: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Elegant suite interior with city views',
        },
        {
          roomCategory: 'Room category · Aman',
          roomBasis:    'Aman Suite or similar',
          roomBenefits: ['Larger footprint with dedicated living area', 'Enhanced privacy and butler service', 'Ideal for an extended stay', 'Strongest positioning within the property'],
          roomImageSrc: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Luxury Aman suite living area',
        },
        {
          roomCategory: 'Room category · Aman',
          roomBasis:    'Deluxe Room or similar',
          roomBenefits: ['Entry point to the Aman experience', 'Full access to spa and wellness facilities', 'Clean value balance within the property', 'Ideal if room is secondary to the city programme'],
          roomImageSrc: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Aman deluxe room interior',
        },
      ],
    },
    {
      id:           'peninsula',
      rank:         'secondary',
      rankLabel:    'Secondary option 02',
      name:         'The Peninsula',
      tagline:      'Best for classic luxury and a familiar benchmark feel',
      description:  'The cleanest classic benchmark option if the client prefers a more traditional luxury city stay with strong Midtown positioning.',
      bullets:      ['Closest to classic benchmark', 'Strong Midtown base', 'Likely cleaner value balance'],
      nightlyRange: 'USD 2,000–4,500+',
      nightlyNote:  'Strong secondary alternate.',
      imageSrc:     'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
      imageAlt:     'Peninsula New York style facade',
      stayLabel:    '5–6 nights',
      rooms: [
        {
          roomCategory: 'Room category · Peninsula',
          roomBasis:    'Deluxe Suite or similar',
          roomBenefits: ['Classic luxury positioning', 'Very strong Midtown base', 'Clean benchmark for comparison', 'Likely strongest value-to-positioning balance'],
          roomImageSrc: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Peninsula style suite interior',
        },
        {
          roomCategory: 'Room category · Peninsula',
          roomBasis:    'Peninsula Suite or similar',
          roomBenefits: ['Flagship suite category', 'Panoramic Midtown views', 'Dedicated butler and enhanced arrival', 'Best positioning within the property'],
          roomImageSrc: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Peninsula flagship suite',
        },
        {
          roomCategory: 'Room category · Peninsula',
          roomBasis:    'Superior Room or similar',
          roomBenefits: ['Entry point to the Peninsula experience', 'Full access to rooftop bar and spa', 'Strong value balance', 'Ideal if city programme is the priority'],
          roomImageSrc: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Peninsula superior room',
        },
      ],
    },
    {
      id:           'mandarin',
      rank:         'secondary',
      rankLabel:    'Secondary option 03',
      name:         'Mandarin Oriental',
      tagline:      'Best for views and a calmer, slightly softer city feeling',
      description:  'A strong alternate if skyline views and a more serene New York atmosphere matter more than classic Midtown positioning.',
      bullets:      ['Excellent views', 'Calmer feel throughout', 'Strong alternate to keep visible'],
      nightlyRange: 'USD 1,800–4,000+',
      nightlyNote:  'Another clean alternate option.',
      imageSrc:     'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80',
      imageAlt:     'Mandarin Oriental New York style hotel',
      stayLabel:    '5–6 nights',
      rooms: [
        {
          roomCategory: 'Room category · Mandarin',
          roomBasis:    'Premier Room / Suite or similar',
          roomBenefits: ['Excellent skyline views', 'Softer, calmer city feeling', 'Good alternate to Aman and Peninsula', 'Strong if atmosphere matters most'],
          roomImageSrc: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Suite with skyline view interior',
        },
        {
          roomCategory: 'Room category · Mandarin',
          roomBasis:    'Mandarin Suite or similar',
          roomBenefits: ['Panoramic Columbus Circle views', 'Spacious living and dining area', 'Enhanced arrival and butler service', 'Strongest positioning within the property'],
          roomImageSrc: 'https://images.unsplash.com/photo-1560347876-aeef00ee58a1?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Mandarin Oriental suite with views',
        },
        {
          roomCategory: 'Room category · Mandarin',
          roomBasis:    'Deluxe Room or similar',
          roomBenefits: ['Entry point to the Mandarin experience', 'Access to spa and rooftop pool', 'Strongest value balance of the three options', 'Ideal if city programme is the priority'],
          roomImageSrc: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1800&q=80',
          roomImageAlt: 'Mandarin Oriental deluxe room',
        },
      ],
    },
  ],

  diningEyebrow: 'Sample dining',
  diningTitle:   'A Curated Table.',
  diningBody:    'A few curated dining anchors help the destination page feel richer without becoming too dense.',

  dining: [
    {
      id:       'lagoulue',
      kicker:   'Dining block 01',
      name:     'La Goulue',
      tagline:  'Classic, polished, Upper East Side feeling',
      body:     'A refined opening dinner option if the couple wants a more timeless New York mood with strong atmosphere and familiarity.',
      imageSrc: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Classic French bistro interior',
    },
    {
      id:       'catch',
      kicker:   'Dining block 02',
      name:     'Catch',
      tagline:  'Livelier energy, scene, and momentum',
      body:     'Works well if one evening should feel more social, current, and recognizably New York in tone and movement.',
      imageSrc: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Vibrant modern restaurant interior',
    },
    {
      id:       'lateedor',
      kicker:   'Dining block 03',
      name:     "La Tête d'Or",
      tagline:  'A richer, more dramatic signature dinner',
      body:     'A strong choice if one dinner should feel more statement-driven, with a slightly deeper and more theatrical atmosphere.',
      imageSrc: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Elegant fine dining restaurant',
    },
  ],

  activitiesEyebrow: 'Sample activities',
  activitiesTitle:   'A Selected Program.',
  activitiesBody:    'A few high-quality anchors that help the client picture the stay quickly without overloading the page.',

  activities: [
    {
      id:       'wicked',
      kicker:   'Activity block 01',
      name:     'Wicked',
      tagline:  'Iconic Broadway evening',
      body:     'A strong theatre anchor if one night should feel recognizably New York and classically entertaining.',
      imageSrc: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Broadway theatre marquee at night',
    },
    {
      id:       'faena',
      kicker:   'Activity block 02',
      name:     'Faena Living Room',
      tagline:  'Stylish lounge atmosphere',
      body:     'A mood-driven nightlife block if one evening should feel more intimate, atmospheric, and design-forward.',
      imageSrc: 'https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Elegant hotel lounge with warm lighting',
    },
    {
      id:       'shopping',
      kicker:   'Activity block 03',
      name:     'Shopping at LV or similar',
      tagline:  'Luxury retail and city movement',
      body:     'A flexible daytime block that adds glamour, movement, and a premium city rhythm to the stay.',
      imageSrc: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      imageAlt: 'Luxury boutique shopping avenue',
    },
  ],

  pricingEyebrow: 'Indicative pricing',
  pricingTitle:   'NYC destination basis',
  pricingBody:    'Aman treated as the primary NYC basis. Peninsula and Mandarin remain visible as alternates.',

  pricingRows: [
    { id: 'pr-aman',      item: 'Aman New York',              basis: 'Primary option',     stay: '5–6 nights', indicativeRange: 'USD 18k–38k+' },
    { id: 'pr-peninsula', item: 'Peninsula New York',         basis: 'Secondary alternate', stay: '5–6 nights', indicativeRange: 'USD 10k–24k+' },
    { id: 'pr-mandarin',  item: 'Mandarin Oriental New York', basis: 'Secondary alternate', stay: '5–6 nights', indicativeRange: 'USD 9k–22k+' },
    { id: 'pr-dining',    item: 'Dining / activities',        basis: 'As selected',         stay: 'Optional',   indicativeRange: 'On request' },
    { id: 'pr-total',     item: 'NYC destination basis',      basis: 'Hotel-led concept',   stay: '5–6 nights', indicativeRange: 'Primary + alternates shown', isTotal: true },
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