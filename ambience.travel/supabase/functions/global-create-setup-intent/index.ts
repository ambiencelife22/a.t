// supabase/functions/global-create-setup-intent/index.ts
// Creates a Stripe SetupIntent to allow an existing subscriber to update
// their saved payment method. The new card becomes the default for the
// matched subscription and is charged at the next billing cycle.
//
// Auth: JWT in body, verified via anon client.
// Input:  { token: string, product: 'sports' | 'life' | 'travel' }
// Output: { clientSecret: string }
//
// Product-aware: filters Stripe subscriptions by price IDs belonging to the
// specified product. Safe when a user holds subscriptions across multiple
// ambience products under the same Stripe customer.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check&deno-std=0.177.0'

type Product = 'sports' | 'life' | 'travel'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_PRODUCTS: Product[] = ['sports', 'life', 'travel']

// Returns all known price IDs for a given product and mode.
// Add new products here as they launch.
function getProductPriceIds(product: Product): string[] {
  const mode = (Deno.env.get('STRIPE_MODE') ?? 'test').toUpperCase()
  const ids: string[] = []

  if (product === 'sports') {
    const monthly  = Deno.env.get(`STRIPE_PRICE_SPORTS_PRO_MONTHLY_${mode}`)
    const annual   = Deno.env.get(`STRIPE_PRICE_SPORTS_PRO_ANNUAL_${mode}`)
    const lifetime = Deno.env.get(`STRIPE_PRICE_SPORTS_LIFETIME_${mode}`)
    if (monthly)  { ids.push(monthly) }
    if (annual)   { ids.push(annual) }
    if (lifetime) { ids.push(lifetime) }
  }

  if (product === 'life') {
    const monthly  = Deno.env.get(`STRIPE_PRICE_LIFE_PRO_MONTHLY_${mode}`)
    const annual   = Deno.env.get(`STRIPE_PRICE_LIFE_PRO_ANNUAL_${mode}`)
    const lifetime = Deno.env.get(`STRIPE_PRICE_LIFE_LIFETIME_${mode}`)
    if (monthly)  { ids.push(monthly) }
    if (annual)   { ids.push(annual) }
    if (lifetime) { ids.push(lifetime) }
  }

  if (product === 'travel') {
    const monthly  = Deno.env.get(`STRIPE_PRICE_TRAVEL_PRO_MONTHLY_${mode}`)
    const annual   = Deno.env.get(`STRIPE_PRICE_TRAVEL_PRO_ANNUAL_${mode}`)
    const lifetime = Deno.env.get(`STRIPE_PRICE_TRAVEL_LIFETIME_${mode}`)
    if (monthly)  { ids.push(monthly) }
    if (annual)   { ids.push(annual) }
    if (lifetime) { ids.push(lifetime) }
  }

  return ids
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: { token?: string; product?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  const { token, product } = body

  if (!token) {
    return new Response('Missing token', { status: 401, headers: corsHeaders })
  }

  if (!product || !VALID_PRODUCTS.includes(product as Product)) {
    return new Response('Missing or invalid product', { status: 400, headers: corsHeaders })
  }

  const typedProduct = product as Product

  // Verify user JWT
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    console.error('create-setup-intent: auth failed', authError?.message)
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  // Get stripe_customer_id from profile
  const { data: profile } = await serviceClient
    .from('global_profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return new Response('No Stripe customer found', { status: 400, headers: corsHeaders })
  }

  try {
    // Find the active subscription for this specific product
    // by matching price IDs against known product price IDs
    const productPriceIds = getProductPriceIds(typedProduct)

    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status:   'all',
      limit:    10, // fetch enough to find the right product
    })

    const activeSub = subscriptions.data.find(s => {
      const isActiveStatus = s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
      if (!isActiveStatus) { return false }
      // Match by price ID — confirms this sub belongs to the requested product
      const subPriceId = s.items.data[0]?.price?.id ?? ''
      return productPriceIds.includes(subPriceId)
    })

    if (!activeSub) {
      console.error(`create-setup-intent: no active ${typedProduct} subscription found`)
      return new Response(`No active ${typedProduct} subscription found`, { status: 400, headers: corsHeaders })
    }

    const setupIntent = await stripe.setupIntents.create({
      customer:             profile.stripe_customer_id,
      payment_method_types: ['card'],
      usage:                'off_session',
      metadata: {
        userId:         user.id,
        product:        typedProduct,
        subscriptionId: activeSub.id,
      },
    })

    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-setup-intent error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
