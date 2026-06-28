// supabase/functions/global-get-subscription-status/index.ts
// Returns the current subscription state for a user.
// Used for client-side polling after checkout to detect when the webhook
// has updated the profile — app polls until status changes from 'incomplete'.
//
// Auth: JWT verification OFF. Client sends session.access_token in body as { token }.
// Input:  { token: string }
// Output: { tier, status, trialEndsAt, currentPeriodEnd, hasFullAccess }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, preflight } from '../_shared/http.ts'

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

  const { data: profile, error: profileError } = await supabase
    .from('global_profiles')
    .select('subscription_tier, subscription_status, trial_ends_at, current_period_end')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return json({ error: 'Profile not found' }, 404)
  }

  const subProfile = {
    subscriptionTier:   (profile.subscription_tier   ?? 'free') as 'free' | 'pro' | 'lifetime',
    subscriptionStatus: (profile.subscription_status ?? 'active') as 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete',
    trialEndsAt:        profile.trial_ends_at        ?? null,
    currentPeriodEnd:   profile.current_period_end   ?? null,
  }

  return json({
      tier:            subProfile.subscriptionTier,
      status:          subProfile.subscriptionStatus,
      trialEndsAt:     subProfile.trialEndsAt,
      currentPeriodEnd: subProfile.currentPeriodEnd,
      hasFullAccess:   hasFullAccess(subProfile),
    }, 200)
})