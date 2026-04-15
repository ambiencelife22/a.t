// iceland-4e.ts — content model for Iceland · 4 Elements signature experience
// Owns content only. Does not own rendering, layout, or routing.
// Last updated: S9

export const experience = {
  meta: {
    slug:     'iceland-4e',
    title:    'Iceland · 4 Elements',
    eyebrow:  'Signature Experience · Iceland',
  },

  // Theme — controls accent colour on blue sections (Elements, Practical, CTA)
  // Each experience defines its own palette here
  theme: {
    gradientLayers: [
      'linear-gradient(180deg, #223247 0%, #3A5468 50%, #2E4558 100%)',
      'radial-gradient(ellipse 70% 55% at 80% 20%, rgba(125,201,197,0.22) 0%, transparent 60%)',
      'radial-gradient(ellipse 45% 40% at 15% 80%, rgba(100,160,200,0.14) 0%, transparent 55%)',
    ],
    borderColor: 'rgba(34,50,71,0.6)',
  },

  video: {
    src:    '/landing/experiences/iceland-4e/lagoon.mp4',
    poster: '/landing/experiences/iceland-4e/lagoon-poster.webp',
  },

  hero: {
    eyebrow:   'Signature Experience · Iceland',
    title:     'Iceland · 4 Elements',
    subtitle:  'A composed immersion shaped by geothermal warmth, elemental contrast, movement, and stillness — designed to reconnect you with what matters.',
    pills:     ['Iceland', 'Dates to be advised', 'Small group or private', 'Pricing on request'],
    imageSrc:  '/landing/experiences/iceland-4e/fontana.webp',
    imageAlt:  'Fontana geothermal pools under the northern lights, Iceland',
    glassNote: 'Water. Earth. Fire. Air. A journey designed around contrast, presence, and restoration.',
  },

  intro: {
    eyebrow: 'Why this exists',
    title:   'A signature experience held with intention.',
    body: [
      'Iceland offers a kind of clarity that is difficult to manufacture elsewhere. The landscape strips away noise. The pace invites presence. The contrast between warmth and cold, stillness and movement, openness and shelter becomes part of the experience itself.',
      '4 Elements is designed as an ambience Signature Experience: calm in tone, precise in composition, and quietly transformative in how it is held. It is not simply about seeing Iceland. It is about moving through it in a way that changes how it feels to be inside your own life.',
    ],
  },

  elements: {
    eyebrow: 'Experience pillars',
    title:   'Built around what the landscape naturally gives.',
    body:    'Each element shapes the emotional rhythm of the experience and creates space for both awe and restoration.',
    items: [
      {
        tag:      'Water',
        text:     'Thermal bathing, coastlines, glacial presence, and the slow reset that only water seems able to offer.',
        imageSrc: '/landing/experiences/iceland-4e/water.webp',
        imageAlt: 'Glacial water and Icelandic coastline',
      },
      {
        tag:      'Earth',
        text:     'Volcanic terrain, moss fields, black sand, and the grounding effect of moving through a landscape that feels older than language.',
        imageSrc: '/landing/experiences/iceland-4e/earth.webp',
        imageAlt: 'Moss-covered lava field, Iceland',
      },
      {
        tag:      'Fire',
        text:     'Geothermal energy, warmth, contrast, and the quiet exhilaration that comes from elemental power held close.',
        imageSrc: '/landing/experiences/iceland-4e/fire.webp',
        imageAlt: 'Geothermal Blue Lagoon at sunrise, Iceland',
      },
      {
        tag:      'Air',
        text:     'Space, stillness, weather, breath, and the subtle internal shift that arrives when the mind is finally given room.',
        imageSrc: '/landing/experiences/iceland-4e/air.webp',
        imageAlt: 'Black sand beach and sea stacks, Reynisfjara, Iceland',
      },
    ],
  },

  rhythm: {
    eyebrow: 'Experience rhythm',
    title:   'A week shaped more by feeling than by hurry.',
    body:    'Structured enough to guide, open enough to breathe.',
    rows: [
      { label: 'Arrival',   title: 'Settle into a slower frequency', text: 'Arrival, grounding, a first exhale, and the beginning of a different pace.' },
      { label: 'Air',       title: 'Perspective and space',          text: 'Breath, weather, stillness, and the kind of room that helps you hear yourself think again.' },
      { label: 'Earth',     title: 'Grounding and movement',         text: 'Movement through volcanic terrain, moss fields, and the stabilising intelligence of an ancient landscape.' },
      { label: 'Fire',      title: 'Vitality and contrast',          text: 'Geothermal heat, elemental warmth, and the enlivening quality that comes from raw force held close.' },
      { label: 'Water',     title: 'Release and restoration',        text: 'Thermal immersion, stillness, and the slow reset that only water seems able to offer.' },
      { label: 'Departure', title: 'Return differently',             text: 'A composed close, integration, and a departure that carries more than photographs home with it.' },
    ],
  },

  stay: {
    eyebrow:     'Accommodation',
    title:       'Where you stay matters.',
    body:        'The experience is anchored by carefully selected properties that reflect Iceland\'s natural tone: understated, refined, restorative, and deeply connected to the landscape.',
    description: 'Rather than overt spectacle, the accommodation approach centres on warmth, design integrity, quiet service, and a sense of being held by the environment. The stay should feel like an extension of the journey itself.',
    bullets: [
      { label: 'Style',    text: 'Minimal, atmospheric, restorative' },
      { label: 'Feel',     text: 'Calm luxury rather than flash' },
      { label: 'Setting',  text: 'Chosen to deepen immersion in the landscape' },
      { label: 'Approach', text: 'Room categories and exact properties advised with release' },
    ],
    imageSrc: '/landing/experiences/iceland-4e/accom.webp',
    imageAlt: 'Understated Icelandic lodge interior with panoramic landscape view',
  },

  inclusions: {
    eyebrow: 'Logistics & inclusions',
    title:   'More complete, without feeling cluttered.',
    body:    'Enough substance to picture the experience and understand what is being held.',
    included: [
      'Luxury accommodation throughout the experience',
      'Private transfers and curated ground movement',
      'Element-led daily experiences and thermal components',
      'Select meals and a considered dining rhythm',
      'Pre-departure guidance and preparation notes',
      'On-the-ground support throughout the journey',
      'Optional extensions available on request',
    ],
    excluded: [
      'International flights to and from Iceland',
      'Comprehensive travel insurance',
      'Personal expenses, spa add-ons, and discretionary purchases',
      'Optional activities not listed within the programme',
      'Additional pre- or post-experience nights unless arranged',
    ],
  },

  practical: {
    eyebrow: 'Practical details',
    title:   'Simple, clear, considered.',
    body:    'The reality of the offer, visible without pushing the page into a heavy itinerary-document feel.',
    cards: [
      { label: 'Dates',      big: 'To be advised',          small: 'Guests can register interest now and receive first notice when dates are released.' },
      { label: 'Length',     big: '6-7 nights',             small: 'Long enough to feel restorative, short enough to remain focused and beautifully paced.' },
      { label: 'Format',     big: 'Small group or private', small: 'Suitable either as a limited hosted departure or a privately tailored variation.' },
      { label: 'Extensions', big: 'Available',              small: 'Additional nights, Reykjavik time, or broader Iceland routing can be layered in separately.' },
    ],
  },

  quote: {
    eyebrow: 'Guest reflection',
    title:   'What lingers is rarely only the destination.',
    body:    'The point is not merely where someone went, but how the experience was held.',
    text:    'The experience felt beautifully held from beginning to end. Iceland itself was extraordinary, but what stayed with me most was the quality of presence it gave back.',
    attrib:  'Past guest',
  },

  cta: {
    eyebrow:        'Enquiry',
    title:          'Interested in Iceland · 4 Elements?',
    body:           'Dates are currently to be advised. Enquire to receive first notice, private details, and early access when the next departure is announced.',
    primaryLabel:   'Request details',
    secondaryLabel: 'Enquire privately',
  },
}

export type IcelandExperience = typeof experience