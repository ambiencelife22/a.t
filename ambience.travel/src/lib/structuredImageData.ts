// structuredImageData.ts — schema.org JSON-LD builder for /immerse/ destination pages
// Owns: buildImageObjects, buildWebPageSchema, buildDestinationSchema
// Does not own rendering, routing, or injection — that belongs to ImmerseStructuredData.tsx
// Last updated: S12

import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseContentCard } from './immerseTypes'

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

function buildTouristTripSchema(data: ImmerseDestinationData): Record<string, unknown> {
  return {
    '@type':       'TouristTrip',
    '@id':         `https://ambience.travel/immerse/honeymoon/new-york#trip`,
    'name':        `${data.title} — Honeymoon Proposal`,
    'description': data.introBody,
    'touristType':  'Honeymoon',
    'itinerary': {
      '@type': 'ItemList',
      'itemListElement': data.hotels.map((hotel, i) => ({
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
  data.hotels.forEach(hotel => {
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
      buildTouristTripSchema(data),
      ...allImages,
    ],
  }

  return JSON.stringify(payload, null, 2)
}