// supabase/functions/_shared/client.ts
// Canonical service-client construction for Edge Functions. Single source —
// every EF that needs a service-role client uses createServiceClient(). The env
// var name (SERVICE_ROLE_KEY, canon S66F) and the auth options block live here
// once, so no EF re-decides them. Extracted S53H from ~12 inline createClient
// idioms (several of which omitted the auth options block entirely — a latent
// persistence bug this erases by construction).
//
// SECURITY CONTRACT:
//   createServiceClient() bypasses RLS. It must be called ONLY after the caller
//   has been verified — either by an auth gate (_shared/auth.ts requireUser /
//   requireAdmin, which call this internally) or, for bespoke-auth EFs that
//   cannot use the gates (Stripe webhook = signature, cron = x-cron-secret,
//   body-token notifications = getUser(token)), after that EF's own verification
//   has passed. Never construct a service client before establishing who is
//   calling.
//
// Anon (JWT-bound) client construction is deliberately NOT exported here. The
// only legitimate use of an anon client is identity verification inside a gate,
// so it lives privately in _shared/auth.ts. Keeping it off the public surface
// means the only way to obtain an authenticated context is through a gate.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}