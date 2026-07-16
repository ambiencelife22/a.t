// queriesImmerseDelivery.ts — Data layer for the client-facing delivery surface.
//
// What it owns:
//   - fetchDeliveryBundle: calls the SINGLE delivery Edge Function
//     (travel-get-engagement-delivery) and returns the DeliveryBundle the delivery
//     surface renders. One fetch, one bundle. The Confirmation / Programme / Brief /
//     Contacts tabs are VIEWS over this one payload — no second EF, no client-side
//     stitching of two payloads, no parallel timeline source.
//
// Security model:
//   - Public endpoint — url_id is the access token
//   - All DB reads happen server-side via service role in the Edge Function
//   - No sensitive financial or commission data is returned
//
// Types live in typesImmerseDelivery.ts. This file owns the fetch only.
//
// Last updated: S53Q — consolidated the two delivery EFs (confirmation + programme)
//   into one (travel-get-engagement-delivery). fetchDeliveryBundle now makes ONE
//   request and reads one bundle; the former two-payload merge (and its divergence)
//   is gone. entries + days + fullBookings + elements all come from the single source.
// Prior: S53M — absorbed the programme EF + inline payload-assembly (layer-law).
// Prior: S48 — apikey + Authorization headers required by the Supabase EF gateway.

import type { DeliveryData, DeliveryBundle } from '../types/typesImmerseDelivery'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const DELIVERY_FN = `${SUPABASE_URL}/functions/v1/travel-get-engagement-delivery`

const EF_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
}

export async function fetchDeliveryBundle(urlId: string): Promise<DeliveryBundle | null> {
  try {
    const res = await fetch(DELIVERY_FN, {
      method: 'POST',
      headers: EF_HEADERS,
      body: JSON.stringify({ url_id: urlId }),
    })

    if (!res.ok) {
      console.error('travel-get-engagement-delivery failed:', res.status, await res.text())
      return null
    }
    const payload = await res.json()
    if (payload.error || !payload.journey) return null

    const clientData: DeliveryData = {
      journey:          payload.journey,
      brief:            payload.brief,
      house:            payload.house,
      contacts:         payload.contacts ?? [],
      supplierContacts: payload.supplierContacts ?? [],
      guestDisplayName: payload.guestDisplayName ?? null,
      destinationName:  payload.destinationName,
      elements:         payload.elements ?? [],
      guides:           { hasDining: false, hasExperiences: false, destinationSlug: null },
      links:            payload.links ?? [],
      urlId,
      days:             payload.days ?? [],
      entries:          payload.entries ?? [],
    } as DeliveryData
    return clientData
  } catch (err) {
    console.error('fetchDeliveryBundle error:', err)
    return null
  }
}