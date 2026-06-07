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
// (Stripe signature, x-cron-secret, or none) and stay as-is.

import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
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

// Build the service client (bypasses RLS). Shared by both gates.
function buildServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Verify the caller is authenticated. Returns the user + a service client.
// Does NOT check admin — use for user-scoped EFs (invoices, own-account, etc.).
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { ok: false, response: json({ error: 'Unauthorized' }, 401) }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error } = await anonClient.auth.getUser()
  if (error || !user) return { ok: false, response: json({ error: 'Unauthorized' }, 401) }

  return { ok: true, serviceClient: buildServiceClient(), user }
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
