// supabase/functions/global-get-price-details/index.ts
// Returns Stripe price metadata for billing/refund policy modals in the checkout UI.
// Auth: JWT in body, verified via anon client — same pattern as create-checkout-session.
//
// Input:  { token: string, priceId: string }
// Output: { amount: number, currency: string, interval: string | null,
//           interval_count: number | null, trial_period_days: number | null,
//           type: 'recurring' | 'one_time' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const mode   = (Deno.env.get('STRIPE_MODE') ?? 'test').toUpperCase() as 'TEST' | 'LIVE'
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    return new Response('ok', { headers: corsHeaders })
  }

  let body: { token?: string; priceId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  const { token, priceId } = body

  if (!token) {
    return new Response('Missing token', { status: 401, headers: corsHeaders })
  }

  if (!priceId || !isValidPriceId(priceId)) {
    return new Response('Invalid priceId', { status: 400, headers: corsHeaders })
  }

  // Verify user JWT
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  try {
    const price = await stripe.prices.retrieve(priceId)

    return new Response(
      JSON.stringify({
        amount:             price.unit_amount,
        currency:           price.currency,
        type:               price.type,
        interval:           price.recurring?.interval           ?? null,
        interval_count:     price.recurring?.interval_count     ?? null,
        trial_period_days:  price.recurring?.trial_period_days  ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-price-details error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
