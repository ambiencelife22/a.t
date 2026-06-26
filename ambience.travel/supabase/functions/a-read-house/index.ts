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
import { corsHeaders, preflight } from '../_shared/http.ts'


const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }
    if (!mode) return json(400, { error: 'mode is required' })

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Unauthorized' })

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) return json(401, { error: 'Unauthorized' })

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await serviceClient
      .from('global_profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (profileError || !profile || profile.is_admin !== true) {
      return json(403, { error: 'Forbidden' })
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
        return json(500, { error: 'Failed to fetch roles' })
      }
      return json(200, { roles: data ?? [] })
    }

    return json(400, { error: `Unknown mode: ${mode}` })

  } catch (err) {
    console.error('a-read-house unexpected error:', err)
    return json(500, { error: 'Internal server error' })
  }
})