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
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import Stripe from 'npm:stripe@14'
import { corsHeaders, json, preflight } from '../_shared/http.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
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

  if (!priceId) {
    return json({ error: 'Missing priceId' }, 400)
  }

  // Only allow switching between Pro Monthly and Pro Annual — not to Lifetime
  const proMonthly = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')
  const proAnnual  = Deno.env.get('STRIPE_PRICE_PRO_ANNUAL')

  if (priceId !== proMonthly && priceId !== proAnnual) {
    return json({ error: 'priceId must be Pro Monthly or Pro Annual' }, 400)
  }

  // Verify user JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('global_profiles')
    .select('stripe_customer_id, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return json({ error: 'Profile not found' }, 404)
  }

  if (!profile.stripe_customer_id) {
    return json({ error: 'No Stripe customer found' }, 400)
  }

  if (profile.subscription_tier !== 'pro') {
    return json({ error: 'Only Pro subscriptions can be updated this way' }, 400)
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
      return json({ error: 'No active subscription found' }, 404)
    }

    const currentItemId = subscription.items.data[0]?.id
    if (!currentItemId) {
      return json({ error: 'Could not find subscription item' }, 500)
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
    return json({
        subscriptionId:   updated.id,
        newPriceId:       priceId,
        currentPeriodEnd: new Date(updated.current_period_end * 1000).toISOString(),
      }, 200)

  } catch (err) {
    console.error('update-subscription error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})