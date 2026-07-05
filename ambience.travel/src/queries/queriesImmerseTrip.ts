// queriesImmerseTrip.ts — Data layer for client-facing trip pages (confirmed surface).
//
// What it owns:
//   - fetchDeliveryData: calls the get-trip-confirmation Edge Function,
//     which resolves url_id → full DeliveryData server-side via service role.
//     No direct Supabase table reads — RLS is bypassed server-side only.
//
// Security model:
//   - Public endpoint — url_id is the access token
//   - All DB reads happen server-side via service role in the Edge Function
//   - No sensitive financial or commission data is returned
//
// Types live in typesImmerseClient.ts per convention. This file owns the fetch only.
//
// Last updated: S53M — added guides field to DeliveryData (hasDining,
//   hasExperiences, destinationSlug) populated by Edge Function.
// Prior: S48 — added apikey + Authorization headers required by
//   Supabase Edge Function gateway even for public endpoints.

import type { DeliveryData } from '../types/typesImmerseClient'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/travel-get-trip-confirmation`

export async function fetchDeliveryData(urlId: string): Promise<DeliveryData | null> {
  try {
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

    return payload as DeliveryData
  } catch (err) {
    console.error('fetchDeliveryData error:', err)
    return null
  }
}