// supabase/functions/_shared/auth.ts
// Shared auth gates for Edge Functions. Extracted S54 from the verbatim-
// duplicated preamble in travel-read/write-engagement (and ~18 other
// admin-gated EFs). Canon: SERVICE_ROLE_KEY (S66F).
//
// Pattern: an anon client (bound to the caller's JWT) verifies identity;
// a service client (bypasses RLS) performs the privilege check and is
// returned for the handler's own queries.
//
// Usage:
//   const gate = await requireAdmin(req)
//   if (!gate.ok) return gate.response
//   const { serviceClient, user } = gate
//
// Webhook/cron and public EFs do NOT use these — they have bespoke auth
// (Stripe signature, x-cron-secret, or none) and stay as-is. They obtain a
// service client directly from _shared/client.ts createServiceClient() AFTER
// their own verification has passed.
//
// S53H: service-client construction extracted to _shared/client.ts. Anon
// (JWT-bound) client construction stays private here — the only legitimate use
// of an anon client is identity verification inside these gates, so it is not
// exported anywhere. Gate logic is unchanged from S54.

import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
import { createServiceClient } from './client.ts'
import { json } from './http.ts'

type AuthOk = {
  ok: true
  serviceClient: SupabaseClient
  user: User
}
type AuthFail = {
  ok: false
  response: Response
}
type AuthResult = AuthOk | AuthFail

// Anon client bound to the caller's JWT. RLS applies. PRIVATE — used only to
// verify identity (getUser) inside the gates below. Never exported: the only
// way to obtain an authenticated context is through requireUser / requireAdmin.
function createAnonClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
}

// Verify the caller is authenticated. Returns the user + a service client.
// Does NOT check admin — use for user-scoped EFs (invoices, own-account, etc.).
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { ok: false, response: json({ error: 'Unauthorized' }, 401) }

  const anonClient = createAnonClient(authHeader)

  const { data: { user }, error } = await anonClient.auth.getUser()
  if (error || !user) return { ok: false, response: json({ error: 'Unauthorized' }, 401) }

  return { ok: true, serviceClient: createServiceClient(), user }
}

// Verify the caller is authenticated AND an admin (global_profiles.is_admin).
// Use for admin-gated EFs.
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const gate = await requireUser(req)
  if (!gate.ok) return gate

  const { data: profile, error } = await gate.serviceClient
    .from('global_profiles')
    .select('is_admin')
    .eq('id', gate.user.id)
    .maybeSingle()

  if (error || !profile || profile.is_admin !== true) {
    return { ok: false, response: json({ error: 'Forbidden' }, 403) }
  }

  return gate
}