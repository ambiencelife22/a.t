// supabase/functions/sports-wipe-user-data/index.ts
// Deletes all user data rows but preserves the account.
//   1. Deletes all data rows EXCEPT global_profiles
//   2. Auth user is preserved — user remains signed in
//   3. Profile row remains — subscription, display name, admin status intact
//
// For full account deletion (data + auth user), use delete-account instead.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DATA_TABLES: [string, string][] = [
  ['sports_bet_edit_history',       'user_id'],
  ['sports_bets',                   'user_id'],
  ['sports_transactions',           'user_id'],
  ['sports_backlog',                'user_id'],
  ['sports_daily_snapshots',        'user_id'],
  ['sports_user_sportsbooks',       'user_id'],
  ['sports_backlog_summary',        'user_id'],
  ['sports_system_balance_history', 'user_id'],
  ['sports_user_systems',           'user_id'],
  ['sports_user_trader',            'user_id'],
  ['global_login_events',           'user_id'],
  // global_profiles intentionally omitted — account preserved.
  // S66B Add 3: sports_trader_balance_history removed — it's shared canon
  // per trader, not user-scoped data. Wiping it on a user data wipe would
  // destroy trader history visible to every user. Also: the table has no
  // user_id column, so the DELETE would have failed silently anyway.
]

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const body         = await req.json() as { token?: string; targetUserId?: string }
    const token        = body?.token ?? ''
    const targetUserId = body?.targetUserId ?? null
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const client = createClient(supabaseUrl, serviceRoleKey)

    const { data: { user: caller }, error: authErr } = await client.auth.getUser(token)
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let targetId = caller.id
    if (targetUserId && targetUserId !== caller.id) {
      const { data: profile, error: profileErr } = await client
        .from('global_profiles').select('is_admin').eq('id', caller.id).single()
      if (profileErr || !profile?.is_admin) {
        return new Response(JSON.stringify({ error: 'Forbidden — admin required to wipe another user' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      targetId = targetUserId
    }

    const deleteErrors: string[] = []
    for (const [table, col] of DATA_TABLES) {
      const { error } = await client.from(table).delete().eq(col, targetId)
      if (error) deleteErrors.push(`${table}: ${error.message}`)
    }

    return new Response(JSON.stringify({
      wiped:      targetId,
      wipedBy:    caller.id,
      dataErrors: deleteErrors.length > 0 ? deleteErrors : undefined,
      status:     deleteErrors.length > 0 ? 'partial' : 'ok',
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})