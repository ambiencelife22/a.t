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
import { corsHeaders, json, preflight } from '../_shared/http.ts'

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)


const SPORTS_PRODUCT = 'sports'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflight()
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { token?: string; targetUserId?: string; value?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { token, targetUserId, value } = body

  if (!token || !targetUserId || value == null) {
    return json({ error: 'Missing token, targetUserId, or value' }, 400)
  }

  if (typeof value !== 'boolean') {
    return json({ error: 'value must be a boolean' }, 400)
  }

  // Verify caller is admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: callerProfile } = await serviceClient
    .from('global_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!callerProfile?.is_admin) {
    return json({ error: 'Forbidden — admin only' }, 403)
  }

  // Resolve target's person_id (is_intention_member is per person+product now)
  const { data: targetAccount, error: acctErr } = await serviceClient
    .from('global_profiles')
    .select('person_id')
    .eq('id', targetUserId)
    .single()

  if (acctErr || !targetAccount?.person_id) {
    return json({ error: 'Target user not found' }, 404)
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
    return json({ error: 'DB update failed' }, 500)
  }

  console.log(`set-intention-member: set ${value} on ${targetUserId}`)

  return json({ ok: true, targetUserId, is_intention_member: value }, 200)
})