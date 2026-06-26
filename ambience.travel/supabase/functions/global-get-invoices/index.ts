// supabase/functions/global-get-invoices/index.ts
// Returns the last 24 Stripe invoices for the authenticated user.
// Free tier users with no stripe_customer_id get an empty array — not an error.
//
// Auth: JWT verification OFF (bespoke). Client sends session.access_token in body
//   as { token }; verified via a per-request token-scoped client. This body-token
//   model is sanctioned-bespoke per _shared/auth.ts — it does NOT use requireUser/
//   requireAdmin (those read the Authorization header). Service-role reads use the
//   canonical createServiceClient factory; responses use shared json/preflight.
// Input:  { token: string }
// Output: { invoices: Invoice[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'
import { createServiceClient } from '../_shared/client.ts'
import { json, preflight } from '../_shared/http.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const serviceClient = createServiceClient()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()

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

  // Verify the body token via a per-request token-scoped anon client.
  // Bespoke auth — NOT a service client, so it stays hand-built (no shared helper).
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Get stripe_customer_id from profile (service role).
  const { data: profile } = await serviceClient
    .from('global_profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  // No customer yet — free tier user, return empty (not an error).
  if (!profile?.stripe_customer_id) {
    return json({ invoices: [] }, 200)
  }

  try {
    const { data: stripeInvoices } = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit:    24,
    })

    const invoices = stripeInvoices.map(inv => ({
      id:                  inv.id,
      number:              inv.number,
      created:             inv.created,
      amount_paid:         inv.amount_paid,
      amount_due:          inv.amount_due,
      currency:            inv.currency,
      status:              inv.status,
      hosted_invoice_url:  inv.hosted_invoice_url,
      invoice_pdf:         inv.invoice_pdf,
    }))

    return json({ invoices }, 200)

  } catch (err) {
    console.error('get-invoices error:', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
