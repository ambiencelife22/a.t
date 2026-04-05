/* TripRoute.tsx
 * Route handler for /trips/:bookingId
 * Resolves booking → property → manual → listings and renders TripPage.
 * Drop this into your React Router config at path="/trips/:bookingId"
 *
 * Usage in App.tsx / router:
 *   <Route path="/trips/:bookingId" element={<TripRoute />} />
 */

import { useParams } from 'react-router-dom'
import TripPage from './TripPage'
import { getBooking } from '../../data/bookings'
import { casaRomeu } from '../../data/trips/casa-romeu/property'
import { houseManual } from '../../data/trips/casa-romeu/houseManual'
import { listings } from '../../data/trips/casa-romeu/listings'

// Property registry — add new properties here as they're onboarded
const PROPERTIES = {
  'casa-romeu': {
    property: casaRomeu,
    manual:   houseManual,
    listings,
  },
}

export default function TripRoute() {
  const { bookingId } = useParams<{ bookingId: string }>()

  if (!bookingId) {
    return <NotFound message='No booking ID provided.' />
  }

  const booking = getBooking(bookingId)

  if (!booking) {
    return <NotFound message='This guide is not available.' />
  }

  const data = PROPERTIES[booking.propertyId as keyof typeof PROPERTIES]

  if (!data) {
    return <NotFound message='Property not found.' />
  }

  // Filter listings if booking specifies active subset
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