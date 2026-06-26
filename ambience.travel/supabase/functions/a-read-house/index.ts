// supabase/functions/a-read-house/index.ts
//
// Edge Function: a-read-house
// Read path for ambience.HOUSE reference data.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - Reads execute via service role to bypass RLS uniformly
//   - SERVICE_ROLE_KEY (canon S66F)
//
// Modes:
//   roles — returns all active house roles ordered by sort_order → { roles }
//
// Deployed at: /functions/v1/a-read-house

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, preflight } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }
    if (!mode) return json({ error: 'mode is required' }, 400)

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await serviceClient
      .from('global_profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (profileError || !profile || profile.is_admin !== true) {
      return json({ error: 'Forbidden' }, 403)
    }
    // ── Dispatch ──────────────────────────────────────────────────────────────
    if (mode === 'roles') {
      const { data, error } = await serviceClient
        .from('a_house_roles')
        .select('id, slug, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) {
        console.error('roles error:', error)
        return json({ error: 'Failed to fetch roles' }, 500)
      }
      return json({ roles: data ?? [] }, 200)
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('a-read-house unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})