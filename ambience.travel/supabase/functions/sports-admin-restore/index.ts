// supabase/functions/sports-admin-restore/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONFLICT_KEYS: Record<string, string> = {
  'global_profiles':               'id',
  'global_login_events':           'id',
  'sports_sportsbooks':            'id',
  'sports_user_sportsbooks':       'id',
  'sports_traders':                'id',
  'sports_user_trader':            'id',
  'sports_backlog_summary':        'user_id',
  'sports_backlog':                'id',
  'sports_backlog_chart_points':   'user_id,date',
  'sports_trader_picks':           'trader_id,date',
  'sports_live_picks':             'id',
  'sports_trader_balance_history': 'trader_id,date',
  'sports_trader_pick_entries':    'id',
  'sports_transactions':           'id',
  'sports_bets':                   'id',
  'sports_bet_edit_history':       'id',
  'sports_daily_snapshots':        'id',
  'sports_user_systems':           'id',
  'sports_system_balance_history': 'user_id,system_id,date',
}

const RESTORE_ORDER = [
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
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const body = await req.json() as { token?: string; tables?: Record<string, unknown[]> }
    const token = body?.token ?? ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token in body' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: authErr?.message }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const { data: profile, error: profileErr } = await serviceClient
      .from('global_profiles').select('is_admin').eq('id', user.id).single()

    if (profileErr || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    if (!body?.tables) {
      return new Response(JSON.stringify({ error: 'Invalid backup format — missing tables key' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const results: Record<string, { restored: number; error?: string }> = {}

    for (const table of RESTORE_ORDER) {
      const rows = body.tables[table]
      if (!rows || rows.length === 0) { results[table] = { restored: 0 }; continue }

      const CHUNK = 500
      let totalRestored = 0
      let tableError: string | undefined

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const { error } = await serviceClient
          .from(table)
          .upsert(chunk as Record<string, unknown>[], { onConflict: CONFLICT_KEYS[table] ?? 'id' })
        if (error) { tableError = error.message; break }
        totalRestored += chunk.length
      }

      results[table] = { restored: totalRestored, ...(tableError ? { error: tableError } : {}) }
    }

    const hasErrors = Object.values(results).some(r => r.error)

    return new Response(
      JSON.stringify({ restoredAt: new Date().toISOString(), restoredBy: user.id, results, status: hasErrors ? 'partial' : 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})