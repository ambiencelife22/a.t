// queriesImmerseDelivery.ts — Data layer for the client-facing delivery surface.
//
// What it owns:
//   - fetchDeliveryBundle: calls BOTH delivery Edge Functions
//     (travel-get-engagement-confirmation + travel-get-engagement-programme) and merges
//     them into the DeliveryBundle the delivery surface renders. Single entry
//     point — the surface never fetches raw.
//
// Security model:
//   - Public endpoints — url_id is the access token
//   - All DB reads happen server-side via service role in the Edge Functions
//   - No sensitive financial or commission data is returned
//
// Types live in typesImmerseDelivery.ts. This file owns the fetch only.
//
// Last updated: S53M — fetchDeliveryData → fetchDeliveryBundle: absorbs the
//   programme EF and the payload-assembly the delivery surface previously did
//   inline; removes the raw fetch() from the component (layer-law compliance).
// Prior: S48 — added apikey + Authorization headers required by the Supabase
//   Edge Function gateway even for public endpoints.

import type { DeliveryData, DeliveryBundle } from '../types/typesImmerseDelivery'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const CONFIRMATION_FN = `${SUPABASE_URL}/functions/v1/travel-get-engagement-confirmation`
const PROGRAMME_FN    = `${SUPABASE_URL}/functions/v1/travel-get-engagement-programme`

const EF_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
}

export async function fetchDeliveryBundle(urlId: string): Promise<DeliveryBundle | null> {
  try {
    const [confRes, progRes] = await Promise.all([
      fetch(CONFIRMATION_FN, { method: 'POST', headers: EF_HEADERS, body: JSON.stringify({ url_id: urlId }) }),
      fetch(PROGRAMME_FN,    { method: 'POST', headers: EF_HEADERS, body: JSON.stringify({ url_id: urlId }) }),
    ])

    if (!confRes.ok) {
      console.error('get-trip-confirmation failed:', confRes.status, await confRes.text())
      return null
    }
    const confPayload = await confRes.json()
    if (confPayload.error || !confPayload.journey) return null

    const progPayload = progRes.ok ? await progRes.json() : null

    const clientData: DeliveryData = {
      journey:          confPayload.journey,
      brief:            confPayload.brief,
      house:            confPayload.house,
      contacts:         confPayload.contacts ?? [],
      guestDisplayName: confPayload.guestDisplayName ?? null,
      destinationName:  confPayload.destinationName,
      elements:      confPayload.elements ?? [],
      guides:           { hasDining: false, hasExperiences: false, destinationSlug: null },
      links:            confPayload.links ?? [],
      urlId,
    } as DeliveryData

    return {
      clientData,
      days:    progPayload?.days    ?? [],
      entries: progPayload?.entries ?? [],
    }
  } catch (err) {
    console.error('fetchDeliveryBundle error:', err)
    return null
  }
}
