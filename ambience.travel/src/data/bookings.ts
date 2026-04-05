// bookings.ts
// All bookings. Each booking maps a unique URL ID to a property, guest, and welcome letter.
// To create a new booking: add an entry here with a new random ID.

import type { Booking } from '../lib/tripsTypes'

export const bookings: Booking[] = [
  {
    id:         'k5SSks4AUedpBJLO',
    propertyId: 'casa-romeu',
    guestNames: 'Ragnar & Gunnar',
    checkIn:    '2026-04-05',
    checkOut:   '2026-04-12',
    welcomeLetter: `Welcome home, Ragnar & Gunnar!

It's a great honour to host you at Casa Romeu — one of my favourite places in the world, and I hope it becomes one of yours too.

Everything has been prepared for your arrival. Below you'll find directions for the house, along with my personal recommendations for dining and things to do in the neighbourhood.

Please don't hesitate to reach out if anything is unclear or if you need anything at all during your stay. And when you leave — please do sign the guest book.

Wishing you a wonderful visit.

Deron`,
  },
]

// Helper — find booking by ID
export function getBooking(id: string): Booking | undefined {
  return bookings.find(b => b.id === id)
}