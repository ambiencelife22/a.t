// supabase/functions/global-get-invoices/index.ts
// Returns the last 24 Stripe invoices for the authenticated user.
// Free tier users with no stripe_customer_id get an empty array — not an error.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Input:  { token: string }
// Output: { invoices: Invoice[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
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

  // Verify JWT via per-request user-scoped client
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  // Get stripe_customer_id from profile
  const { data: profile } = await serviceClient
    .from('global_profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  // No customer yet — free tier user, return empty
  if (!profile?.stripe_customer_id) {
    return new Response(
      JSON.stringify({ invoices: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
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

    return new Response(
      JSON.stringify({ invoices }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('get-invoices error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})