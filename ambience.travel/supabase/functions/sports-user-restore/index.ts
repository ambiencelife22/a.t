// supabase/functions/sports-user-restore/index.ts
// Restores data for a specific target user from a backup file.
// Caller must be admin. Only touches the 10 user-scoped tables.
// Filters all rows by targetUserId so other users are never touched.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'


// S66B Add 3: sports_trader_balance_history removed — shared canon, not
// user-scoped. Symmetric with sports-user-backup which no longer exports it.
const CONFLICT_KEYS: Record<string, string> = {
  'sports_user_sportsbooks':       'id',
  'sports_backlog_summary':        'user_id',
  'sports_backlog':                'id',
  'sports_transactions':           'id',
  'sports_bets':                   'id',
  'sports_bet_edit_history':       'id',
  'sports_daily_snapshots':        'id',
  'sports_user_systems':           'id',
  'sports_system_balance_history': 'user_id,system_id,date',
  'sports_user_trader':            'user_id',
}

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
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const body = await req.json() as {
      token?: string
      targetUserId?: string
      tables?: Record<string, unknown[]>
    }

    const token        = body?.token ?? ''
    const targetUserId = body?.targetUserId ?? ''

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing targetUserId' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    if (!body?.tables) {
      return new Response(JSON.stringify({ error: 'Missing tables in body' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    // ── Verify caller is admin ──
    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

    // ── Restore only rows belonging to targetUserId ──
    const results: Record<string, { restored: number; skipped: number; error?: string }> = {}

    for (const table of USER_TABLES) {
      const allRows = (body.tables[table] ?? []) as Record<string, unknown>[]
      const rows    = allRows.filter(row => row.user_id === targetUserId)

      if (rows.length === 0) {
        results[table] = { restored: 0, skipped: allRows.length }
        continue
      }

      const CHUNK = 500
      let totalRestored = 0
      let tableError: string | undefined

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const { error } = await serviceClient
          .from(table)
          .upsert(chunk, { onConflict: CONFLICT_KEYS[table] ?? 'id' })
        if (error) { tableError = error.message; break }
        totalRestored += chunk.length
      }

      results[table] = {
        restored: totalRestored,
        skipped:  allRows.length - rows.length,
        ...(tableError ? { error: tableError } : {}),
      }
    }

    const hasErrors = Object.values(results).some(r => r.error)

    return new Response(
      JSON.stringify({
        restoredAt:   new Date().toISOString(),
        restoredBy:   user.id,
        targetUserId,
        results,
        status: hasErrors ? 'partial' : 'ok',
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