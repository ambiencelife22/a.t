// structuredImageData.ts — schema.org JSON-LD builder for /immerse/ destination pages
// Owns: buildImageObjects, buildWebPageSchema, buildDestinationSchema
// Does not own rendering, routing, or injection — that belongs to ImmerseStructuredData.tsx
// Last updated: S21 — flattenHotels() normalizes the new ImmerseDestinationHotelsShape
//   discriminated union into a flat ImmerseHotelOption[] before iteration.
//   Regioned destinations (Nordic Winter, Europe Finale) emit the union of all
//   region hotels; flat destinations (NYC, St-Barths) emit the hotels array as-is.
// Prior: S12 — initial schema builder.
//
// Known debt (flagged for S22):
//   - WebPage + TouristTrip @id values are hardcoded to /immerse/honeymoon/new-york.
//     Should derive from data.journeyId + data.destinationSlug.
//   - TouristTrip.touristType is hardcoded 'Honeymoon'. Should derive from trip.journeyTypes.

import type {
  ImmerseDestinationData,
  ImmerseDestinationHotelsShape,
  ImmerseHotelOption,
  ImmerseContentCard,
} from './immerseTypes'

const UNSPLASH_LICENSE = 'https://unsplash.com/license'
const UNSPLASH_CREDIT  = 'Unsplash'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUnsplash(src: string): boolean {
  return src.includes('unsplash.com')
}

function resolveCredit(src: string, credit?: string): string {
  if (credit) return credit
  if (isUnsplash(src)) return UNSPLASH_CREDIT
  return 'ambience.travel'
}

function resolveLicense(src: string, license?: string): string {
  if (license) return license
  if (isUnsplash(src)) return UNSPLASH_LICENSE
  return 'https://ambience.travel'
}

function resolveCreditUrl(src: string, creditUrl?: string): string {
  if (creditUrl) return creditUrl
  if (isUnsplash(src)) return 'https://unsplash.com'
  return 'https://ambience.travel'
}

function makeImageObject(
  src:         string,
  alt:         string,
  name:        string,
  credit?:     string,
  creditUrl?:  string,
  license?:    string,
): Record<string, unknown> {
  return {
    '@type':            'ImageObject',
    'contentUrl':       src,
    'name':             name,
    'description':      alt,
    'creditText':       resolveCredit(src, credit),
    'copyrightNotice':  `© ${resolveCredit(src, credit)}. All rights reserved.`,
    'acquireLicensePage': resolveCreditUrl(src, creditUrl),
    'license':          resolveLicense(src, license),
  }
}

// S21: flatten the discriminated union into a single ImmerseHotelOption[].
// For regioned destinations, emits the concatenated list of all region hotels
// in region order. For flat, returns as-is.
function flattenHotels(shape: ImmerseDestinationHotelsShape): ImmerseHotelOption[] {
  if (shape.kind === 'flat') return shape.hotels
  return shape.regions.flatMap(region => region.hotels)
}

// ─── Image object collectors ──────────────────────────────────────────────────

function collectHotelImages(hotel: ImmerseHotelOption): Record<string, unknown>[] {
  const images: Record<string, unknown>[] = []

  // Hero image
  images.push(makeImageObject(
    hotel.imageSrc,
    hotel.imageAlt,
    `${hotel.name} — exterior`,
    hotel.imageCredit,
    hotel.imageCreditUrl,
    hotel.imageLicense,
  ))

  // Gallery images
  if (hotel.gallery) {
    hotel.gallery.forEach((src, i) => {
      images.push(makeImageObject(
        src,
        `${hotel.name} — gallery image ${i + 1}`,
        `${hotel.name} — gallery ${i + 1}`,
        hotel.imageCredit,
        hotel.imageCreditUrl,
        hotel.imageLicense,
      ))
    })
  }

  // Room images
  hotel.rooms.forEach(room => {
    images.push(makeImageObject(
      room.roomImageSrc,
      room.roomImageAlt,
      `${hotel.name} — ${room.roomBasis}`,
      hotel.imageCredit,
      hotel.imageCreditUrl,
      hotel.imageLicense,
    ))
  })

  return images
}

function collectContentCardImages(cards: ImmerseContentCard[], context: string): Record<string, unknown>[] {
  return cards.map(card =>
    makeImageObject(
      card.imageSrc,
      card.imageAlt,
      `${context} — ${card.name}`,
      card.imageCredit,
      card.imageCreditUrl,
      card.imageLicense,
    )
  )
}

// ─── Page-level schemas ───────────────────────────────────────────────────────

function buildWebPageSchema(data: ImmerseDestinationData, images: Record<string, unknown>[]): Record<string, unknown> {
  return {
    '@type':       'WebPage',
    '@id':         `https://ambience.travel/immerse/honeymoon/new-york#webpage`,
    'name':        data.title,
    'description': data.subtitle,
    'url':         'https://ambience.travel/immerse/honeymoon/new-york',
    'inLanguage':  'en',
    'image':       images.slice(0, 5),
    'publisher': {
      '@type': 'Organization',
      'name':  'ambience.travel',
      'url':   'https://ambience.travel',
    },
  }
}

// S21: takes a pre-flattened hotels array instead of reading data.hotels directly
// (data.hotels is now a discriminated union, not iterable).
function buildTouristTripSchema(
  data:   ImmerseDestinationData,
  hotels: ImmerseHotelOption[],
): Record<string, unknown> {
  return {
    '@type':       'TouristTrip',
    '@id':         `https://ambience.travel/immerse/honeymoon/new-york#trip`,
    'name':        `${data.title} — Honeymoon Proposal`,
    'description': data.introBody,
    'touristType':  'Honeymoon',
    'itinerary': {
      '@type': 'ItemList',
      'itemListElement': hotels.map((hotel, i) => ({
        '@type':    'ListItem',
        'position': i + 1,
        'item': {
          '@type':       'LodgingBusiness',
          'name':        hotel.name,
          'description': hotel.bullets.join('. '),
          'image':       hotel.imageSrc,
        },
      })),
    },
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildDestinationStructuredData(data: ImmerseDestinationData): string {
  const allImages: Record<string, unknown>[] = []

  // S21: flatten the hotels union once, reuse for all downstream iterations
  const hotels = flattenHotels(data.hotels)

  // Hero image
  allImages.push(makeImageObject(
    data.heroImageSrc,
    data.heroImageAlt,
    `${data.title} — hero`,
    undefined,
    undefined,
    undefined,
  ))

  // Hotel images (hero + gallery + rooms per hotel)
  hotels.forEach(hotel => {
    collectHotelImages(hotel).forEach(img => allImages.push(img))
  })

  // Dining images
  collectContentCardImages(data.dining, 'Dining').forEach(img => allImages.push(img))

  // Activities images
  collectContentCardImages(data.activities, 'Experiences').forEach(img => allImages.push(img))

  const payload = {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebPageSchema(data, allImages),
      buildTouristTripSchema(data, hotels),
      ...allImages,
    ],
  }

  return JSON.stringify(payload, null, 2)
}