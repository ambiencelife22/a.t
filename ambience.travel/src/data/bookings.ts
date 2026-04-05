// bookings.ts
// All bookings. Each booking maps a unique URL ID to a property, guest, and welcome letter.
// To create a new booking: add an entry here with a new random ID.

import type { Booking } from '../lib/programmeTypes'

export const bookings: Booking[] = [
  {
    id:         'k5SSks4AUedpBJLO',
    propertyId: 'casa-romeu',
    guestNames: 'Ragnar & Gunnar',
    checkIn:    '2026-04-06',
    checkOut:   '2026-04-09',
    welcomeLetter: `Welcome home, Ragnar & Gunnar!

It's a great honour to host you at Casa Romeu — one of my favourite places in the world, and I hope it becomes one of yours too.

Everything has been prepared for your arrival. Below you'll find directions for the house, along with my personal recommendations for dining and things to do in the neighbourhood.

Please don't hesitate to reach out if anything is unclear or if you need anything at all during your stay. And when you leave — please do sign the guest book.

Wishing you a wonderful visit.

Deron`,
  },

  // Generic showcase — no guest, no dates. For preview and demonstration.
  {
    id:         'casa-romeu-preview',
    propertyId: 'casa-romeu',
    guestNames: '',
    checkIn:    '',
    checkOut:   '',
    welcomeLetter: `Casa Romeu is a warm, characterful apartment in the heart of Ruzafa — Valencia's most vibrant and creative neighbourhood.

The apartment has been thoughtfully prepared with everything you need for a comfortable and unhurried stay. Below you'll find the house guide, along with a curated selection of our favourite places to eat, drink, and explore in the city.

We hope you feel at home from the moment you arrive.`,
  },
]

// Helper — find booking by ID
export function getBooking(id: string): Booking | undefined {
  return bookings.find(b => b.id === id)
}