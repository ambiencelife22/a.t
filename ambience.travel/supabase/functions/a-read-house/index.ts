// supabase/functions/a-read-house/index.ts
//
// Edge Function: a-read-house
// Read path for ambience.HOUSE reference data.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - Reads execute via service role to bypass RLS uniformly
//   - Auth via shared requireAdmin gate; SERVICE_ROLE_KEY lives in _shared/client.ts
//
// Modes:
//   roles — returns all active house roles ordered by sort_order → { roles }
//
// Deployed at: /functions/v1/a-read-house

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient } = gate

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
