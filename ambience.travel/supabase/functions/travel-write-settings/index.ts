// supabase/functions/travel-write-settings/index.ts
//
// Edge Function: travel-write-settings
// Admin-only write path for a_platform_settings.
//
// Security model:
//   - JWT REQUIRED (verify_jwt = true in config.toml)
//   - Caller must be authenticated + is_admin = true (requireAdmin gate)
//   - Service role key used for the actual write
//
// Request body:
//   { mode: 'set_maintenance_mode', value: boolean }
//
// Response (200):
//   { maintenance_mode: boolean, updated_at: string, updated_by: string }
//
// Response (400): { error: 'Invalid request' }
// Response (401): { error: 'Unauthorized' }
// Response (403): { error: 'Forbidden' }
// Response (500): { error: 'Internal server error' }
//
// Deployed at: /functions/v1/travel-write-settings
// Created: S53H

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type Mode = 'set_maintenance_mode'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight()

  const gate = await requireAdmin(req)
  if (!gate.ok) return gate.response
  const { serviceClient: db, user } = gate

  let body: { mode: Mode; value: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }

  if (body.mode === 'set_maintenance_mode') {
    if (typeof body.value !== 'boolean') return json({ error: 'Invalid request' }, 400)

    const now = new Date().toISOString()

    const { data, error } = await db
      .from('a_platform_settings')
      .update({
        maintenance_mode: body.value,
        updated_at:       now,
        updated_by:       user.id,
      })
      .eq('id', '424b8a26-fa3e-4830-a110-af7342cef019')
      .select('maintenance_mode, updated_at, updated_by')
      .maybeSingle()

    if (error || !data) return json({ error: 'Internal server error' }, 500)

    return json({
      maintenance_mode: data.maintenance_mode as boolean,
      updated_at:       data.updated_at       as string,
      updated_by:       data.updated_by       as string,
    }, 200)
  }

  if (body.mode === 'settings') {
    const { data, error } = await db
      .from('a_platform_settings')
      .select('maintenance_mode, updated_at, updated_by')
      .limit(1).maybeSingle()
    if (error) return json({ error: 'Failed to fetch settings' }, 500)
    return json({ settings: data ?? null })
  }
  if (body.mode === 'maintenance_mode') {
    const { data, error } = await db
      .from('a_platform_settings')
      .select('maintenance_mode')
      .limit(1).maybeSingle()
    if (error) return json({ error: 'Failed to fetch maintenance mode' }, 500)
    return json({ maintenanceMode: (data as { maintenance_mode: boolean } | null)?.maintenance_mode ?? false })
  }
  return json({ error: 'Invalid request' }, 400)
})