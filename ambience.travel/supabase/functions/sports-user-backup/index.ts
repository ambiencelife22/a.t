// supabase/functions/sports-user-backup/index.ts
// Exports all data for the calling user only.
// Uses the user's own JWT — RLS scopes all queries automatically.
// No service role key needed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// S66B Add 3: sports_trader_balance_history removed — it's shared canon
// per trader, not user-scoped data. A user backup should not export the
// trader's full balance walk. The user's *view* of trader history is derived
// live from sports_user_trader (which IS exported) + the trader's canonical
// history at read time via getTraderBalanceHistory(traderId, fromDate).
const USER_TABLES = [
  'sports_user_sportsbooks',
  'sports_backlog_summary',
  'sports_backlog',
  'sports_transactions',
  'sports_bets',
  'sports_bet_edit_history',
  'sports_daily_snapshots',
  'sports_user_systems',
  'sports_system_balance_history',
  'sports_user_trader',
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
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!

    const body  = await req.json() as { token?: string }
    const token = body?.token ?? ''

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── User-scoped client — RLS applied automatically ──
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth:   { persistSession: false },
    })

    // ── Verify the token is valid ──
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Fetch all user tables (RLS scopes to this user automatically) ──
    const result: Record<string, unknown[]> = {}
    const errors: string[] = []

    for (const table of USER_TABLES) {
      const { data, error } = await userClient.from(table).select('*')
      if (error) { errors.push(`${table}: ${error.message}`); result[table] = [] }
      else result[table] = data ?? []
    }

    return new Response(
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        tables: result,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})