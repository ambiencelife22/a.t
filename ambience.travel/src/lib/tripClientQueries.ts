// tripClientQueries.ts — Data layer for client-facing trip pages.
//
// What it owns:
//   - fetchTripBriefDataByUrlId: resolves url_id → engagement.trip_id →
//     house_id → full ConfirmationBriefData. Single entry point for both
//     TripConfirmationRoute and TripProgrammeRoute.
//
// What it does not own:
//   - PDF export (confirmationBriefPdf.ts, dailyProgrammePdf.ts)
//   - Route rendering (TripConfirmationRoute.tsx, TripProgrammeRoute.tsx)
//   - Admin dossier queries (adminTripQueries.ts)
//
// Join path:
//   travel_immerse_engagements.url_id
//     → travel_immerse_engagements.trip_id
//     → travel_bookings.house_id (first non-null)
//     → fetchTripDossierForHouse(house_id)
//     → fetchTripAuxBookings(trip_id)
//
// Last updated: S48 — initial ship.

import { supabase } from './supabase'
import { fetchTripDossierForHouse, fetchTripAuxBookings } from './adminTripQueries'
import type { DossierTrip, HouseProfile, TripAuxBooking, TripBrief } from './adminTripQueries'

export type TripClientData = {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  auxBookings:     TripAuxBooking[]
  urlId:           string
}

export async function fetchTripClientData(urlId: string): Promise<TripClientData | null> {
  // Step 1: resolve url_id → trip_id
  const { data: engData, error: engErr } = await supabase
    .from('travel_immerse_engagements')
    .select('trip_id')
    .eq('url_id', urlId)
    .not('trip_id', 'is', null)
    .limit(1)
    .single()

  if (engErr || !engData?.trip_id) return null
  const tripId = engData.trip_id as string

  // Step 2: resolve trip_id → house_id
  const { data: bookData, error: bookErr } = await supabase
    .from('travel_bookings')
    .select('house_id')
    .eq('trip_id', tripId)
    .not('house_id', 'is', null)
    .limit(1)
    .single()

  if (bookErr || !bookData?.house_id) return null
  const houseId = bookData.house_id as string

  // Step 3: fetch dossier + aux in parallel
  const [dossier, auxBookings] = await Promise.all([
    fetchTripDossierForHouse(houseId),
    fetchTripAuxBookings(tripId),
  ])

  const trip = dossier.trips.find(t => t.id === tripId)
  if (!trip) return null

  const destinationName = trip.destinations[0]?.name ?? trip.trip_code

  return {
    trip,
    brief:           trip.brief,
    house:           dossier.house,
    destinationName,
    auxBookings,
    urlId,
  }
}