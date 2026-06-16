// supabase/functions/global-cancel-subscription/index.ts
// Cancels a Stripe subscription at the end of the current billing period.
// Does NOT cancel immediately — user retains full access until period ends.
// Does NOT delete any user data.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Input:  { token: string }
// Output: { canceledAt: string, currentPeriodEnd: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  const { token } = body
  if (!token) {
    return new Response('Missing token', { status: 401, headers: corsHeaders })
  }

  // Verify user JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  // Get Stripe customer ID from profile
  const { data: profile, error: profileError } = await supabase
    .from('global_profiles')
    .select('stripe_customer_id, subscription_status, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return new Response('Profile not found', { status: 404, headers: corsHeaders })
  }

  if (!profile.stripe_customer_id) {
    return new Response('No Stripe customer found', { status: 400, headers: corsHeaders })
  }

  if (profile.subscription_tier === 'lifetime') {
    return new Response('Lifetime subscriptions cannot be canceled', { status: 400, headers: corsHeaders })
  }

  if (profile.subscription_tier === 'free') {
    return new Response('No active subscription to cancel', { status: 400, headers: corsHeaders })
  }

  try {
    // Find the active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status:   'active',
      limit:    1,
    })

    // Also check trialing subscriptions
    let subscription = subscriptions.data[0]
    if (!subscription) {
      const trialing = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status:   'trialing',
        limit:    1,
      })
      subscription = trialing.data[0]
    }

    if (!subscription) {
      return new Response('No active subscription found in Stripe', { status: 404, headers: corsHeaders })
    }

    // Cancel at period end — user keeps access until current period expires
    const canceled = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })

    // stripe-webhook will update subscription_status when it actually cancels.
    // We return the scheduled cancel info so the UI can reflect it immediately.
    return new Response(
      JSON.stringify({
        canceledAt:        new Date().toISOString(),
        currentPeriodEnd:  new Date(canceled.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: canceled.cancel_at_period_end,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    console.error('cancel-subscription error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})