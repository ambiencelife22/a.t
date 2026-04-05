/* TripRoute.tsx
 * Resolves booking ID from pathname and renders TripPage.
 * No React Router — reads window.location.pathname directly.
 *
 * Pathname pattern: /trips/:bookingId
 * e.g. /trips/k5SSks4AUedpBJLO
 *
 * On trips.ambience.travel, the path is just /:bookingId
 * e.g. trips.ambience.travel/k5SSks4AUedpBJLO
 */

import TripPage from './TripPage'
import { getBooking } from '../../data/bookings'
import { casaRomeu } from '../../data/trips/casa-romeu/property'
import { houseManual } from '../../data/trips/casa-romeu/houseManual'
import { listings } from '../../data/trips/casa-romeu/listings'
import type { Property, ManualSection, Listing } from '../../lib/tripsTypes'

// Property registry — add new properties here as they're onboarded
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

  // trips.ambience.travel/:bookingId
  if (hostname === 'trips.ambience.travel') {
    return pathname.replace(/^\//, '').split('/')[0] || null
  }

  // localhost/trips/:bookingId
  const match = pathname.match(/^\/trips\/([^/]+)/)
  return match ? match[1] : null
}

export default function TripRoute() {
  const bookingId = getBookingId()

  if (!bookingId) {
    return <NotFound message='No booking ID provided.' />
  }

  const booking = getBooking(bookingId)

  if (!booking) {
    return <NotFound message='This guide is not available.' />
  }

  const data = PROPERTIES[booking.propertyId]

  if (!data) {
    return <NotFound message='Property not found.' />
  }

  const activeListings = booking.activeListingIds
    ? data.listings.filter(l => booking.activeListingIds!.includes(l.id))
    : data.listings

  return (
    <TripPage
      booking={booking}
      property={data.property}
      manual={data.manual}
      listings={activeListings}
    />
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div style={{
      minHeight:      '100vh',
      background:     '#171917',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     "'Plus Jakarta Sans', sans-serif",
      gap:            16,
    }}>
      <div style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#838383' }}>
        ambience.travel
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#F3F4F3' }}>{message}</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}