// supabase/functions/global-write-team/index.ts
//
// Edge Function: global-write-team
// Creates / updates ambience team members (global_team).
//
// Canonical write layer for the cross-product team entity. Pairs with
// global-read-team. Admin-only.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - global_team admin-only RLS; service role bypasses. Never anon.
//
// Request body:
//   { mode: string, ...fields }
//
// Modes:
//   upsert_member → { member }   create or update a team member.
//                                 requires { person_id }; optional { id, role,
//                                 default_rate_id, is_active }. Keyed on person_id
//                                 (UNIQUE) so re-upsert updates in place.
//   set_active    → { member }   toggle membership active flag.
//                                 requires { person_id, is_active }
//
// role CHECK: owner | admin | member. role is an ORG fact, SEPARATE from
// global_profiles.is_admin (auth). Setting role here never changes auth.
//
// Deployed at: /functions/v1/global-write-team
// Last updated: S53C — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_ROLES = ['owner', 'admin', 'member']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }

    if (!mode) {
      return new Response(
        JSON.stringify({ error: 'mode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Verify caller is admin (SERVICE_ROLE_KEY per S66F canon) ────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await serviceClient
      .from('global_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile || profile.is_admin !== true) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Dispatch by mode ───────────────────────────────────────────────────
    switch (mode) {
      // Create or update a team member, keyed on person_id (UNIQUE).
      case 'upsert_member': {
        const { person_id, role, default_rate_id, is_active } = body as {
          person_id?: string; role?: string;
          default_rate_id?: string | null; is_active?: boolean
        }
        if (!person_id) {
          return new Response(
            JSON.stringify({ error: 'person_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (role !== undefined && !VALID_ROLES.includes(role)) {
          return new Response(
            JSON.stringify({ error: `role must be one of ${VALID_ROLES.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Build the upsert row. Only include provided fields so we don't clobber
        // existing values with undefined on update.
        const row: Record<string, unknown> = { person_id }
        if (role !== undefined)            row.role = role
        if (default_rate_id !== undefined) row.default_rate_id = default_rate_id
        if (is_active !== undefined)       row.is_active = is_active

        const { data, error } = await serviceClient
          .from('global_team')
          .upsert(row, { onConflict: 'person_id' })
          .select('id, person_id, role, is_active, default_rate_id')
          .maybeSingle()
        if (error) {
          console.error('upsert_member error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to save team member' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ member: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Toggle active flag (soft enable/disable without deleting history).
      case 'set_active': {
        const { person_id, is_active } = body as { person_id?: string; is_active?: boolean }
        if (!person_id || typeof is_active !== 'boolean') {
          return new Response(
            JSON.stringify({ error: 'person_id and is_active (boolean) are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await serviceClient
          .from('global_team')
          .update({ is_active })
          .eq('person_id', person_id)
          .select('id, person_id, role, is_active, default_rate_id')
          .maybeSingle()
        if (error) {
          console.error('set_active error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to update team member' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ member: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (err) {
    console.error('global-write-team unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})