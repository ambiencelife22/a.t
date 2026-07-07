// supabase/functions/_shared/visibility.ts
// Universal public_view gate for all client-facing EFs.
//
// One source of truth: if public_view = false, the engagement is hidden.
// Hidden engagements return 404 — indistinguishable from non-existent ones.
// No information leak about which url_ids exist.
//
// Usage:
//   import { checkPublicView } from '../_shared/visibility.ts'
//   const gate = await checkPublicView(db, url_id)
//   if (gate) return gate  // 404 response
//
// travel-get-trip-confirmation and travel-get-trip-programme call this.
// Any future client-facing EF must call this before returning data.

import { json } from './http.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NOT_FOUND     = () => json({ error: 'not_found' }, 404)
const NOT_PUBLIC    = () => json({ error: 'not_public' }, 403)

/**
 * Check public_view on travel_engagements for the given url_id.
 * Returns a 404 Response if the engagement is hidden or doesn't exist.
 * Returns null if the engagement is publicly visible — caller may proceed.
 */
export async function checkPublicView(
  db:     SupabaseClient,
  urlId:  string
): Promise<Response | null> {
  const { data, error } = await db
    .from('travel_engagements')
    .select('public_view')
    .eq('url_id', urlId)
    .single()

  if (error || !data)          return NOT_FOUND()
  if (!data.public_view)       return NOT_PUBLIC()
  return null
}