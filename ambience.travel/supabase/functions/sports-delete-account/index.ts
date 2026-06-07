// supabase/functions/sports-delete-account/index.ts
// Permanently deletes a user account:
//   1. Deletes all user data rows
//   2. Deletes the auth.users record via admin API (service role required)
//   3. Returns success — client should sign out immediately after
//
// For data-only wipes that preserve the account, use wipe-user-data instead.
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
  ['sports_trader_balance_history', 'user_id'],
  ['global_login_events',           'user_id'],
  ['global_profiles',               'id'],
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
        return new Response(JSON.stringify({ error: 'Forbidden — admin required to delete another user' }), {
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

    const { error: deleteAuthErr } = await client.auth.admin.deleteUser(targetId)
    if (deleteAuthErr) {
      return new Response(JSON.stringify({
        error: `Data deleted but auth user removal failed: ${deleteAuthErr.message}`,
        dataErrors: deleteErrors.length > 0 ? deleteErrors : undefined,
      }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    return new Response(JSON.stringify({
      deleted:    targetId,
      deletedBy:  caller.id,
      dataErrors: deleteErrors.length > 0 ? deleteErrors : undefined,
      status:     deleteErrors.length > 0 ? 'partial' : 'ok',
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})