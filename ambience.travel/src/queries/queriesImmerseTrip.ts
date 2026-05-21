// tripClientQueries.ts — Data layer for client-facing trip pages.
//
// What it owns:
//   - fetchTripClientData: calls the get-trip-confirmation Edge Function,
//     which resolves url_id → full TripClientData server-side via service role.
//     No direct Supabase table reads — RLS is bypassed server-side only.
//
// Security model:
//   - Public endpoint — url_id is the access token
//   - All DB reads happen server-side via service role in the Edge Function
//   - No sensitive financial or commission data is returned
//
// Naming note: this file should be renamed queriesImmerseTrip.ts to conform
//   to the queries{Domain}.ts convention (S48 naming standards). Deferred —
//   do not rename mid-session without updating all import paths.
//
// Last updated: S49 — added guides field to TripClientData (hasDining,
//   hasExperiences, destinationSlug) populated by Edge Function.
// Prior: S48 — added apikey + Authorization headers required by
//   Supabase Edge Function gateway even for public endpoints.

import type { DossierTrip, HouseProfile, TripAuxBooking, TripBrief } from '../queries/queriesAdminTrip'

export type TripGuides = {
  hasDining:       boolean
  hasExperiences:  boolean
  destinationSlug: string | null
}

export type TripClientData = {
  trip:            DossierTrip
  brief:           TripBrief | null
  house:           HouseProfile | null
  destinationName: string
  auxBookings:     TripAuxBooking[]
  guides:          TripGuides
  urlId:           string
}

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/get-trip-confirmation`

export async function fetchTripClientData(urlId: string): Promise<TripClientData | null> {
  try {
    console.log('FUNCTION_URL:', FUNCTION_URL)
    console.log('ANON_KEY:', SUPABASE_ANON_KEY?.slice(0, 20))
    const res = await fetch(FUNCTION_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url_id: urlId }),
    })

    if (!res.ok) {
      console.error('get-trip-confirmation failed:', res.status, await res.text())
      return null
    }

    const payload = await res.json()
    if (payload.error || !payload.trip) return null

    return payload as TripClientData
  } catch (err) {
    console.error('fetchTripClientData error:', err)
    return null
  }
}