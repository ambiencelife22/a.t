// supabase/functions/global-stripe-webhook/index.ts
// Handles all inbound Stripe webhook events and updates subscription state.
// This is the ONLY function that writes subscription state to the DB.
//
// Auth: Stripe signature verification (stripe-signature header).
// JWT verification OFF — this endpoint is called by Stripe, not the app.
//
// S66F Phase 2: subscription state moved global_profiles -> global_subscriptions
// (per person_id, product). This COMPLETES the multi-product billing intent the
// old code flagged ("future products get their own columns") — but as per-product
// ROWS keyed by (person_id, product), not per-product columns. The Stripe
// metadata.product value is the row key. stripe_customer_id stays on
// global_profiles (account-level). first_charge_at + all subscription fields go
// to global_subscriptions. Env key -> SERVICE_ROLE_KEY (canon).
//
// Events handled:
//   checkout.session.completed
//   customer.subscription.created / updated / deleted
//   invoice.payment_succeeded / payment_failed
//   payment_intent.succeeded  (Lifetime one-time)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'
import { Resend } from 'npm:resend'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const APP_URL = 'https://sports.ambience.life'
const DEFAULT_PRODUCT = 'sports'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Resolve account id from the Stripe customer (stripe_customer_id stays on the
// account record, global_profiles).
async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('global_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  if (!data) { return null }
  return data.id
}

// Resolve person_id from an account id (subscription rows are person-scoped).
async function getPersonId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('global_profiles')
    .select('person_id')
    .eq('id', userId)
    .single()
  return data?.person_id ?? null
}

// Account-level write (e.g. stripe_customer_id) — stays on global_profiles.
async function updateAccount(userId: string, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from('global_profiles')
    .update(fields)
    .eq('id', userId)
  if (error) { console.error('updateAccount error:', error) }
}

// Subscription write — upsert into global_subscriptions on (person_id, product).
// Upsert because a user's first subscription event may precede any existing row.
async function upsertSubscription(personId: string, product: string, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from('global_subscriptions')
    .upsert(
      { person_id: personId, product, ...fields },
      { onConflict: 'person_id,product' }
    )
  if (error) { console.error('upsertSubscription error:', error) }
}

// Stamp first_charge_at only if not already set (never overwrite) — on the
// SPORTS subscription row.
async function stampFirstChargeIfNeeded(personId: string, product: string) {
  const { data } = await supabase
    .from('global_subscriptions')
    .select('first_charge_at')
    .eq('person_id', personId)
    .eq('product', product)
    .maybeSingle()
  if (data?.first_charge_at) { return } // already stamped — never overwrite
  await upsertSubscription(personId, product, { first_charge_at: new Date().toISOString() })
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !user?.email) { return null }
  return user.email
}

function renderEmail(opts: {
  heading:     string
  body:        string[]
  ctaLabel:    string
  ctaUrl:      string
  footerNote?: string
}): string {
  const paragraphs = opts.body
    .map(p => `  <div class="body">${p}</div>`)
    .join('\n')

  const footerNote = opts.footerNote
    ? `  <div class="footer-note">${opts.footerNote}</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1A1D1A; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .header { background:#E8C547; padding:16px 32px; text-align:center; }
  .logo { color:#1A1D1A; font-size:18px; font-weight:700; letter-spacing:0.05em; }
  .container { max-width:560px; margin:0 auto; padding:40px 32px; }
  .heading { color:#FFFFFF; font-size:24px; font-weight:700; margin-bottom:24px; letter-spacing:-0.01em; }
  .body { color:#D1D5DB; font-size:15px; line-height:1.6; margin-bottom:16px; }
  .footer-note { color:#9CA3AF; font-size:13px; line-height:1.6; margin-top:24px; padding-top:24px; border-top:1px solid #2D3030; }
  .cta-wrap { text-align:center; margin-top:32px; }
  .cta { display:inline-block; background:#E8C547; color:#1A1D1A; font-weight:700; font-size:15px; padding:14px 32px; border-radius:6px; text-decoration:none; }
  .footer { max-width:560px; margin:0 auto; padding:0 32px 40px; text-align:center; }
  .tagline { color:#E8C547; font-size:13px; letter-spacing:0.08em; margin-bottom:8px; margin-top:0; }
  .footer-text { color:#6B7280; font-size:12px; margin:4px 0; }
  .footer-link { color:#6B7280; }
</style>
</head>
<body>
  <!-- bgcolor table — forces dark background in Apple Mail and Gmail which ignore body background-color -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1D1A" style="background:#1A1D1A; min-height:100%;">
    <tr><td>
      <div class="header"><div class="logo">ambience.SPORTS</div></div>
      <div class="container">
        <div class="heading">${opts.heading}</div>
${paragraphs}
${footerNote}
        <div class="cta-wrap">
          <a class="cta" href="${opts.ctaUrl}">${opts.ctaLabel}</a>
        </div>
      </div>
      <div class="footer">
        <div class="tagline">live with intention</div>
        <div class="footer-text">© ambience · <a class="footer-link" href="${APP_URL}">${APP_URL.replace('https://', '')}</a></div>
        <div class="footer-text"><a class="footer-link" href="${APP_URL}/#unsubscribe">unsubscribe</a></div>
      </div>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { error } = await resend.emails.send({
    from:    'ambience.SPORTS <noreply@ambience.life>',
    to,
    subject,
    html,
  })
  if (error) { console.error('stripe-webhook: Resend error', error) }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log(`stripe-webhook: ${event.type}`)

  try {
    // ── checkout.session.completed ──────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string
      const userId     = await getUserIdFromCustomer(customerId)
      if (!userId) { return new Response('ok') }

      // stripe_customer_id is account-level — stays on global_profiles.
      await updateAccount(userId, { stripe_customer_id: customerId })
    }

    // ── customer.subscription.created / updated ─────────────────────────────
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const userId     = await getUserIdFromCustomer(customerId)
      if (!userId) { return new Response('ok') }
      const personId = await getPersonId(userId)
      if (!personId) { console.error('stripe-webhook: no person_id for', userId); return new Response('ok') }

      const product = sub.metadata?.product ?? DEFAULT_PRODUCT
      const tier    = sub.metadata?.tier === 'lifetime' ? 'lifetime' : 'pro'
      const status  = sub.status

      const fields: Record<string, unknown> = {
        subscription_tier:   tier,
        subscription_status: status,
        current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
      }

      if (sub.trial_end) {
        fields.trial_ends_at  = new Date(sub.trial_end * 1000).toISOString()
        fields.has_used_trial = true
      }

      // Clear re-engagement stamps on resubscribe — allows fresh sends on future lapses
      if (event.type === 'customer.subscription.created') {
        fields.re_engagement_30_sent_at = null
        fields.re_engagement_60_sent_at = null
      }

      console.log(`stripe-webhook: subscription update product=${product} tier=${tier} status=${status}`)
      await upsertSubscription(personId, product, fields)
    }

    // ── customer.subscription.deleted ───────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const userId     = await getUserIdFromCustomer(customerId)
      if (!userId) { return new Response('ok') }
      const personId = await getPersonId(userId)
      if (!personId) { console.error('stripe-webhook: no person_id for', userId); return new Response('ok') }

      const product = sub.metadata?.product ?? DEFAULT_PRODUCT

      // Do NOT clear tier — preserve for read-only UX. Do NOT delete data.
      await upsertSubscription(personId, product, {
        subscription_status: 'canceled',
        current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
      })

      const email = await getUserEmail(userId)
      if (email) {
        const html = renderEmail({
          heading:  'Your subscription has ended.',
          body: [
            'Your ambience.SPORTS subscription has ended. Your account is now in read-only mode — your full history is safe and nothing has been deleted.',
            'Whenever you\'re ready, resubscribing takes 30 seconds and picks up exactly where you left off.',
          ],
          ctaLabel:   'Resubscribe',
          ctaUrl:     `${APP_URL}/#plan-selection`,
          footerNote: 'Your history is yours. It\'ll be here when you\'re ready.',
        })
        await sendEmail(email, 'Your ambience.SPORTS subscription has ended', html)
        console.log(`stripe-webhook: SubscriptionLapsedEmail sent to ${email}`)
      }
    }

    // ── invoice.payment_succeeded ───────────────────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
      const invoice    = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      const userId     = await getUserIdFromCustomer(customerId)
      if (!userId) { return new Response('ok') }
      const personId = await getPersonId(userId)
      if (!personId) { console.error('stripe-webhook: no person_id for', userId); return new Response('ok') }

      const product = (invoice.lines?.data?.[0]?.metadata?.product as string | undefined)
        ?? DEFAULT_PRODUCT

      // Only stamp first_charge_at on real payments (not $0 trial invoices)
      const amountPaid = invoice.amount_paid ?? 0
      if (amountPaid > 0) {
        await stampFirstChargeIfNeeded(personId, product)
      }

      await upsertSubscription(personId, product, { subscription_status: 'active' })
    }

    // ── invoice.payment_failed ──────────────────────────────────────────────
    if (event.type === 'invoice.payment_failed') {
      const invoice    = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      const userId     = await getUserIdFromCustomer(customerId)
      if (!userId) { return new Response('ok') }
      const personId = await getPersonId(userId)
      if (!personId) { console.error('stripe-webhook: no person_id for', userId); return new Response('ok') }

      const product = (invoice.lines?.data?.[0]?.metadata?.product as string | undefined)
        ?? DEFAULT_PRODUCT

      await upsertSubscription(personId, product, { subscription_status: 'past_due' })

      const email = await getUserEmail(userId)
      if (email) {
        const html = renderEmail({
          heading:  'There was a payment issue.',
          body: [
            'We weren\'t able to process your ambience.SPORTS subscription payment. Your data is safe and access continues during the grace period.',
            'Stripe will retry automatically. If the issue persists, updating your payment method takes less than a minute.',
          ],
          ctaLabel:   'Update payment method',
          ctaUrl:     `${APP_URL}/#update-payment`,
          footerNote: 'If you\'ve already resolved this, no action is needed — your subscription will resume automatically on the next retry.',
        })
        await sendEmail(email, 'Payment issue with your ambience.SPORTS subscription', html)
        console.log(`stripe-webhook: PaymentFailedEmail sent to ${email}`)
      }
    }

    // ── payment_intent.succeeded (Lifetime one-time) ────────────────────────
    if (event.type === 'payment_intent.succeeded') {
      const pi         = event.data.object as Stripe.PaymentIntent
      const customerId = pi.customer as string
      const userId     = pi.metadata?.userId ?? await getUserIdFromCustomer(customerId)
      if (!userId) { return new Response('ok') }

      const piProduct = pi.metadata?.product ?? DEFAULT_PRODUCT
      console.log(`stripe-webhook: payment_intent.succeeded product=${piProduct}`)
      if (pi.metadata?.tier !== 'lifetime') { return new Response('ok') }

      const personId = await getPersonId(userId)
      if (!personId) { console.error('stripe-webhook: no person_id for', userId); return new Response('ok') }

      await upsertSubscription(personId, piProduct, {
        subscription_tier:   'lifetime',
        subscription_status: 'active',
        current_period_end:  null, // never expires
      })

      await stampFirstChargeIfNeeded(personId, piProduct)
    }

  } catch (err) {
    console.error('stripe-webhook handler error:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})