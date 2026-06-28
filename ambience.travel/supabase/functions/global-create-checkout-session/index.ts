// supabase/functions/global-create-checkout-session/index.ts
// Creates a Stripe Subscription (Pro tiers) or PaymentIntent (Lifetime).
// Called by the app when a user clicks a paid CTA button.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Function uses service role client + serviceClient.auth.getUser(token).
//
// Input:  { token: string, priceId: string, product: 'sports' | 'life' | 'travel' }
// Output: { clientSecret: string, subscriptionId?: string, type: 'subscription' | 'payment' | 'trial' }
//
// Mode: STRIPE_MODE=test|live. Resolves price IDs from STRIPE_PRICE_SPORTS_*_TEST or *_LIVE.
// To go live: set STRIPE_MODE=live in Supabase secrets. No other changes needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import Stripe from 'npm:stripe@14'
import { corsHeaders, json, preflight } from '../_shared/http.ts'

const mode   = (Deno.env.get('STRIPE_MODE') ?? 'test').toUpperCase() as 'TEST' | 'LIVE'

const stripe = new Stripe(Deno.env.get(`STRIPE_SECRET_KEY`) ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)


// ── Price ID helpers ──────────────────────────────────────────────────────────

function getPriceIds() {
  return {
    monthly:  Deno.env.get(`STRIPE_PRICE_SPORTS_PRO_MONTHLY_${mode}`) ?? '',
    annual:   Deno.env.get(`STRIPE_PRICE_SPORTS_PRO_ANNUAL_${mode}`)  ?? '',
    lifetime: Deno.env.get(`STRIPE_PRICE_SPORTS_LIFETIME_${mode}`)    ?? '',
  }
}

function isLifetimePriceId(priceId: string): boolean {
  if (priceId === getPriceIds().lifetime) { return true }
  return false
}

function isValidPriceId(priceId: string): boolean {
  const ids = getPriceIds()
  if (priceId === ids.monthly)  { return true }
  if (priceId === ids.annual)   { return true }
  if (priceId === ids.lifetime) { return true }
  return false
}

// ── Get or create Stripe customer ─────────────────────────────────────────────

async function getOrCreateCustomer(userId: string, email: string): Promise<{ customerId: string; isNew: boolean }> {
  const { data: profile } = await serviceClient
    .from('global_profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return { customerId: profile.stripe_customer_id, isNew: false }
  }

  // Create new Stripe customer — stripe_customer_id written to profile only
  // after subscription is successfully created, to prevent orphaned IDs
  // attracting stale webhook retries on function crash.
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  return { customerId: customer.id, isNew: true }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflight()
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { token?: string; priceId?: string; product?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { token, priceId, product = 'sports' } = body  // default 'sports' for back-compat

  if (!token) {
    console.error('create-checkout-session: missing token')
    return json({ error: 'Missing token' }, 401)
  }

  if (!priceId) {
    return json({ error: 'Missing priceId' }, 400)
  }

  if (!isValidPriceId(priceId)) {
    console.error(`create-checkout-session: invalid priceId ${priceId} for mode ${mode}`)
    return json({ error: 'Invalid priceId' }, 400)
  }

  // Verify user JWT using a per-request user-scoped client
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    console.error('create-checkout-session: auth failed', authError?.message)
    return json({ error: 'Unauthorized' }, 401)
  }

  console.log(`create-checkout-session: user verified ${user.id} mode=${mode}`)

  const userId = user.id
  const email  = user.email ?? ''

  try {
    const { customerId, isNew } = await getOrCreateCustomer(userId, email)

    // ── Lifetime one-time payment ─────────────────────────────────────────────
    if (isLifetimePriceId(priceId)) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount:   14900,
        currency: 'usd',
        customer: customerId,
        metadata: { userId, tier: 'lifetime', product },
        automatic_payment_methods: { enabled: true },
      })

      // Write stripe_customer_id only after successful payment intent creation
      if (isNew) {
        await serviceClient.from('global_profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
      }

      return json({ clientSecret: paymentIntent.client_secret, type: 'payment' }, 200)
    }

    // ── Pro subscription ─────────────────────────────────────────────────────
    const { data: profileData } = await serviceClient
      .from('global_profiles')
      .select('has_used_trial')
      .eq('id', userId)
      .single()

    const hasUsedTrial = profileData?.has_used_trial ?? false
    const trialDays    = hasUsedTrial ? undefined : 14
    const isTrial      = trialDays !== undefined

    if (isTrial) {
      // Trial: save card via SetupIntent, no charge today
      const subscription = await stripe.subscriptions.create({
        customer:          customerId,
        items:             [{ price: priceId }],
        payment_behavior:  'default_incomplete',
        payment_settings:  { save_default_payment_method: 'on_subscription' },
        trial_period_days: trialDays,
        expand:            ['pending_setup_intent'],
        metadata:          { userId },
      })

      const setupIntent  = subscription.pending_setup_intent as Stripe.SetupIntent
      const clientSecret = setupIntent?.client_secret

      if (!clientSecret) {
        console.error('No client_secret on trial setup intent', subscription.id)
        return json({ error: 'Could not retrieve setup client secret' }, 500)
      }

      // Write stripe_customer_id only after successful subscription creation
      if (isNew) {
        await serviceClient.from('global_profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
      }

      return json({ clientSecret, subscriptionId: subscription.id, type: 'trial' }, 200)
    }

    // ── Paid subscription (no trial) ─────────────────────────────────────────
    const subscription = await stripe.subscriptions.create({
      customer:         customerId,
      items:            [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand:           ['latest_invoice.payment_intent'],
      metadata:         { userId, product },
    })

    const invoice       = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
    const clientSecret  = paymentIntent?.client_secret

    if (!clientSecret) {
      console.error('No client_secret on subscription payment intent', subscription.id)
      return json({ error: 'Could not retrieve payment client secret' }, 500)
    }

    // Write stripe_customer_id only after successful subscription creation
    if (isNew) {
      await serviceClient.from('global_profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
    }

    return json({ clientSecret, subscriptionId: subscription.id, type: 'subscription' }, 200)

  } catch (err) {
    console.error('create-checkout-session error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})