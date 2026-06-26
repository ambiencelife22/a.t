// supabase/functions/sports-update-subscription/index.ts
// Upgrades or downgrades between Pro Monthly and Pro Annual.
// Stripe prorates the billing automatically.
// Also handles un-cancel: if subscription was set to cancel_at_period_end,
// passing the same priceId removes the cancellation.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Input:  { token: string, priceId: string }
// Output: { subscriptionId: string, newPriceId: string, currentPeriodEnd: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
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

  if (!priceId) {
    return new Response('Missing priceId', { status: 400, headers: corsHeaders })
  }

  // Only allow switching between Pro Monthly and Pro Annual — not to Lifetime
  const proMonthly = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')
  const proAnnual  = Deno.env.get('STRIPE_PRICE_PRO_ANNUAL')

  if (priceId !== proMonthly && priceId !== proAnnual) {
    return new Response('priceId must be Pro Monthly or Pro Annual', { status: 400, headers: corsHeaders })
  }

  // Verify user JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('global_profiles')
    .select('stripe_customer_id, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return new Response('Profile not found', { status: 404, headers: corsHeaders })
  }

  if (!profile.stripe_customer_id) {
    return new Response('No Stripe customer found', { status: 400, headers: corsHeaders })
  }

  if (profile.subscription_tier !== 'pro') {
    return new Response('Only Pro subscriptions can be updated this way', { status: 400, headers: corsHeaders })
  }

  try {
    // Find the current subscription
    const activeSubs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status:   'active',
      limit:    1,
    })

    let subscription = activeSubs.data[0]

    // Check trialing too
    if (!subscription) {
      const trialingSubs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status:   'trialing',
        limit:    1,
      })
      subscription = trialingSubs.data[0]
    }

    if (!subscription) {
      return new Response('No active subscription found', { status: 404, headers: corsHeaders })
    }

    const currentItemId = subscription.items.data[0]?.id
    if (!currentItemId) {
      return new Response('Could not find subscription item', { status: 500, headers: corsHeaders })
    }

    // Update the subscription — Stripe prorates automatically
    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false, // un-cancel if previously scheduled to cancel
      items: [{
        id:    currentItemId,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    })

    // stripe-webhook will update subscription_tier/status when next invoice settles.
    // Tier stays 'pro' either way — only the billing interval changes.
    return new Response(
      JSON.stringify({
        subscriptionId:   updated.id,
        newPriceId:       priceId,
        currentPeriodEnd: new Date(updated.current_period_end * 1000).toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('update-subscription error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})