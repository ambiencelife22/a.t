/* TripRoute.tsx
 * Resolves booking ID from pathname and renders TripPage inside TripsLayout.
 * No React Router — reads window.location.pathname directly.
 */

import TripPage from './TripPage'
import TripsLayout from '../layouts/TripsLayout'
import { getBooking } from '../../data/bookings'
import { casaRomeu } from '../../data/trips/casa-romeu/property'
import { houseManual } from '../../data/trips/casa-romeu/houseManual'
import { listings } from '../../data/trips/casa-romeu/listings'
import type { Property, ManualSection, Listing } from '../../lib/tripsTypes'

const PROPERTIES: Record<string, {
  property: Property
  manual:   ManualSection[]
  listings: Listing[]
}> = {
  'casa-romeu': {
    property: casaRomeu,
    manual:   houseManual,
    listings,
  },
}

function getBookingId(): string | null {
  const pathname = window.location.pathname
  const hostname = window.location.hostname

  if (hostname === 'trips.ambience.travel') {
    return pathname.replace(/^\//, '').split('/')[0] || null
  }

  const match = pathname.match(/^\/trips\/([^/]+)/)
  return match ? match[1] : null
}

export default function TripRoute() {
  const bookingId = getBookingId()

  if (!bookingId) {
    return (
      <TripsLayout>
        <NotFound message='No booking ID provided.' />
      </TripsLayout>
    )
  }

  const booking = getBooking(bookingId)

  if (!booking) {
    return (
      <TripsLayout>
        <NotFound message='This guide is not available.' />
      </TripsLayout>
    )
  }

  const data = PROPERTIES[booking.propertyId]

  if (!data) {
    return (
      <TripsLayout>
        <NotFound message='Property not found.' />
      </TripsLayout>
    )
  }

  const activeListings = booking.activeListingIds
    ? data.listings.filter(l => booking.activeListingIds!.includes(l.id))
    : data.listings

  return (
    <TripsLayout guestNames={booking.guestNames}>
      <TripPage
        booking={booking}
        property={data.property}
        manual={data.manual}
        listings={activeListings}
      />
    </TripsLayout>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#171917' }}>{message}</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}