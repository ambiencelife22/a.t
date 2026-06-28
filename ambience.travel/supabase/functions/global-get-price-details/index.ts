// supabase/functions/global-get-price-details/index.ts
// Returns Stripe price metadata for billing/refund policy modals in the checkout UI.
// Auth: JWT in body, verified via anon client — same pattern as create-checkout-session.
//
// Input:  { token: string, priceId: string }
// Output: { amount: number, currency: string, interval: string | null,
//           interval_count: number | null, trial_period_days: number | null,
//           type: 'recurring' | 'one_time' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import Stripe from 'npm:stripe@14'
import { corsHeaders, json, preflight } from '../_shared/http.ts'

const mode   = (Deno.env.get('STRIPE_MODE') ?? 'test').toUpperCase() as 'TEST' | 'LIVE'
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})


// Returns all known price IDs across all products and modes.
// Add new products here as they launch.
function getAllValidPriceIds(): (string | undefined)[] {
  return [
    // ambience.SPORTS
    Deno.env.get(`STRIPE_PRICE_SPORTS_PRO_MONTHLY_${mode}`),
    Deno.env.get(`STRIPE_PRICE_SPORTS_PRO_ANNUAL_${mode}`),
    Deno.env.get(`STRIPE_PRICE_SPORTS_LIFETIME_${mode}`),
    // ambience.LIFE (add when launching)
    Deno.env.get(`STRIPE_PRICE_LIFE_PRO_MONTHLY_${mode}`),
    Deno.env.get(`STRIPE_PRICE_LIFE_PRO_ANNUAL_${mode}`),
    Deno.env.get(`STRIPE_PRICE_LIFE_LIFETIME_${mode}`),
    // ambience.TRAVEL (add when launching)
    Deno.env.get(`STRIPE_PRICE_TRAVEL_PRO_MONTHLY_${mode}`),
    Deno.env.get(`STRIPE_PRICE_TRAVEL_PRO_ANNUAL_${mode}`),
    Deno.env.get(`STRIPE_PRICE_TRAVEL_LIFETIME_${mode}`),
  ]
}

function isValidPriceId(priceId: string): boolean {
  return getAllValidPriceIds().includes(priceId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflight()
  }

  let body: { token?: string; priceId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { token, priceId } = body

  if (!token) {
    return json({ error: 'Missing token' }, 401)
  }

  if (!priceId || !isValidPriceId(priceId)) {
    return json({ error: 'Invalid priceId' }, 400)
  }

  // Verify user JWT
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const price = await stripe.prices.retrieve(priceId)

    return json({
        amount:             price.unit_amount,
        currency:           price.currency,
        type:               price.type,
        interval:           price.recurring?.interval           ?? null,
        interval_count:     price.recurring?.interval_count     ?? null,
        trial_period_days:  price.recurring?.trial_period_days  ?? null,
      }, 200)
  } catch (err) {
    console.error('get-price-details error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
