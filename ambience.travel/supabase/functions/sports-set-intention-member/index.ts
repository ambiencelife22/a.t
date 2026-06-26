// supabase/functions/sports-set-intention-member/index.ts
// Admin-triggered: sets is_intention_member on a user profile.
//
// Auth: Pattern A — JWT verification OFF.
//   Caller sends admin session token in body as { token }.
//   Function verifies token, checks is_admin on profile, then proceeds.
//   (Matches sports-grant-free-positions exactly.)
//
// WHY THIS EXISTS (S66F):
//   Previously queriesAdmin.setIntentionMember wrote is_intention_member
//   directly under the admin's authenticated JWT:
//     supabase.from('global_profiles').update({ is_intention_member }).eq('id', userId)
//   The S66F P0-A mitigation revokes UPDATE on global_profiles from the
//   authenticated role, so is_intention_member has no client write path.
//   This EF moves the write to the service role, admin-gated, on Pattern A —
//   so the existing body-token client call needs only to be repointed here.
//
// Input:  { token: string, targetUserId: string, value: boolean }
// Output: { ok: true, targetUserId: string, is_intention_member: boolean } | { error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPORTS_PRODUCT = 'sports'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  let body: { token?: string; targetUserId?: string; value?: boolean }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders })
  }

  const { token, targetUserId, value } = body

  if (!token || !targetUserId || value == null) {
    return new Response('Missing token, targetUserId, or value', { status: 400, headers: corsHeaders })
  }

  if (typeof value !== 'boolean') {
    return new Response('value must be a boolean', { status: 400, headers: corsHeaders })
  }

  // Verify caller is admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const { data: callerProfile } = await serviceClient
    .from('global_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!callerProfile?.is_admin) {
    return new Response('Forbidden — admin only', { status: 403, headers: corsHeaders })
  }

  // Resolve target's person_id (is_intention_member is per person+product now)
  const { data: targetAccount, error: acctErr } = await serviceClient
    .from('global_profiles')
    .select('person_id')
    .eq('id', targetUserId)
    .single()

  if (acctErr || !targetAccount?.person_id) {
    return new Response('Target user not found', { status: 404, headers: corsHeaders })
  }

  // UPSERT is_intention_member on the SPORTS subscription row.
  // The row may not exist yet (global_subscriptions ships empty), so
  // insert-or-update on the (person_id, product) unique key.
  const { error: upsertErr } = await serviceClient
    .from('global_subscriptions')
    .upsert(
      { person_id: targetAccount.person_id, product: SPORTS_PRODUCT, is_intention_member: value },
      { onConflict: 'person_id,product' }
    )

  if (upsertErr) {
    console.error('set-intention-member upsert error:', upsertErr)
    return new Response(
      JSON.stringify({ error: 'DB update failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`set-intention-member: set ${value} on ${targetUserId}`)

  return new Response(
    JSON.stringify({ ok: true, targetUserId, is_intention_member: value }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})