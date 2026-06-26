// supabase/functions/global-get-subscription-status/index.ts
// Returns the current subscription state for a user.
// Used for client-side polling after checkout to detect when the webhook
// has updated the profile — app polls until status changes from 'incomplete'.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Input:  { token: string }
// Output: { tier, status, trialEndsAt, currentPeriodEnd, hasFullAccess }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inlined from lib/subscription.ts — avoids _shared bundling issues
function hasFullAccess(profile: {
  subscriptionTier:   string
  subscriptionStatus: string
}): boolean {
  if (profile.subscriptionTier   === 'lifetime')  { return true }
  if (profile.subscriptionStatus === 'active')    { return true }
  if (profile.subscriptionStatus === 'trialing')  { return true }
  return false
}

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

  const { data: profile, error: profileError } = await supabase
    .from('global_profiles')
    .select('subscription_tier, subscription_status, trial_ends_at, current_period_end')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return new Response('Profile not found', { status: 404, headers: corsHeaders })
  }

  const subProfile = {
    subscriptionTier:   (profile.subscription_tier   ?? 'free') as 'free' | 'pro' | 'lifetime',
    subscriptionStatus: (profile.subscription_status ?? 'active') as 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete',
    trialEndsAt:        profile.trial_ends_at        ?? null,
    currentPeriodEnd:   profile.current_period_end   ?? null,
  }

  return new Response(
    JSON.stringify({
      tier:            subProfile.subscriptionTier,
      status:          subProfile.subscriptionStatus,
      trialEndsAt:     subProfile.trialEndsAt,
      currentPeriodEnd: subProfile.currentPeriodEnd,
      hasFullAccess:   hasFullAccess(subProfile),
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})