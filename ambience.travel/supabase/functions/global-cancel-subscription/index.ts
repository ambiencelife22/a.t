// supabase/functions/global-cancel-subscription/index.ts
// Cancels a Stripe subscription at the end of the current billing period.
// Does NOT cancel immediately — user retains full access until period ends.
// Does NOT delete any user data.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Input:  { token: string }
// Output: { canceledAt: string, currentPeriodEnd: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflight()
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { token } = body
  if (!token) {
    return json({ error: 'Missing token' }, 401)
  }

  // Verify user JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Get Stripe customer ID from profile
  const { data: profile, error: profileError } = await supabase
    .from('global_profiles')
    .select('stripe_customer_id, subscription_status, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return json({ error: 'Profile not found' }, 404)
  }

  if (!profile.stripe_customer_id) {
    return json({ error: 'No Stripe customer found' }, 400)
  }

  if (profile.subscription_tier === 'lifetime') {
    return json({ error: 'Lifetime subscriptions cannot be canceled' }, 400)
  }

  if (profile.subscription_tier === 'free') {
    return json({ error: 'No active subscription to cancel' }, 400)
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
      return json({ error: 'No active subscription found in Stripe' }, 404)
    }

    // Cancel at period end — user keeps access until current period expires
    const canceled = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })

    // stripe-webhook will update subscription_status when it actually cancels.
    // We return the scheduled cancel info so the UI can reflect it immediately.
    return json({
        canceledAt:        new Date().toISOString(),
        currentPeriodEnd:  new Date(canceled.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: canceled.cancel_at_period_end,
      }, 200)

  } catch (err: unknown) {
    console.error('cancel-subscription error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})