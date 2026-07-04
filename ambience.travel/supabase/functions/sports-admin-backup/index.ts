// supabase/functions/sports-admin-backup/index.ts
// Exports a full snapshot of all SPORTS + global tables.
// Admin-only — caller must supply a valid session token in the request body.
//
// Auth: Pattern A — JWT verification OFF.
//   Caller sends session token in body as { token }.
//   Function verifies token via service client, checks is_admin on global_profiles.
//
// Input:  { token: string }
// Output: { exportedAt, exportedBy, tables, errors? } | { error: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TABLES = [
  'global_profiles',
  'global_login_events',
  'sports_sportsbooks',
  'sports_user_sportsbooks',
  'sports_traders',
  'sports_user_trader',
  'sports_backlog_summary',
  'sports_backlog',
  'sports_backlog_chart_points',
  'sports_trader_picks',
  'sports_live_picks',
  'sports_trader_balance_history',
  'sports_trader_pick_entries',
  'sports_transactions',
  'sports_bets',
  'sports_bet_edit_history',
  'sports_daily_snapshots',
  'sports_user_systems',
  'sports_system_balance_history',
  'sports_ticket_message_reads',
  'sports_admin_notifications',
  'sports_admin_notification_dismissals',
]

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({
        error: 'Missing env vars',
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
        keyLength: serviceRoleKey?.length ?? 0,
      }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    const body = await req.json() as { token?: string }
    const token = body?.token ?? ''

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token in body' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)

    if (authErr || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        authError: authErr?.message,
        authStatus: authErr?.status,
        tokenLength: token.length,
        tokenPrefix: token.slice(0, 20),
      }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    const { data: profile, error: profileErr } = await serviceClient
      .from('global_profiles').select('is_admin').eq('id', user.id).single()

    if (profileErr || !profile?.is_admin) {
      return new Response(JSON.stringify({
        error: 'Forbidden — admin only',
        profileError: profileErr?.message,
        isAdmin: profile?.is_admin,
        userId: user.id,
      }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    const result: Record<string, unknown[]> = {}
    const errors: string[] = []

    for (const table of TABLES) {
      const { data, error } = await serviceClient.from(table).select('*')
      if (error) { errors.push(`${table}: ${error.message}`); result[table] = []; continue }
      result[table] = data ?? []
    }

    return new Response(
      JSON.stringify({ exportedAt: new Date().toISOString(), exportedBy: user.id, tables: result, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', stack: err instanceof Error ? err.stack : undefined }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})