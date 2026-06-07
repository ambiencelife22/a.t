// supabase/functions/sports-enroll-trader/index.ts
// Admin-only. Enrolls a target user in a trader (PWins or Matt's Picks).
// Uses service role to bypass RLS — admin identity verified server-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const body = await req.json() as {
      token?:               string
      targetUserId?:        string
      traderId?:            string
      myStartDate?:         string
      startBalanceMyStart?: number
    }

    const { token, targetUserId, traderId, myStartDate, startBalanceMyStart } = body

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    if (!targetUserId || !traderId || !myStartDate || startBalanceMyStart == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields: targetUserId, traderId, myStartDate, startBalanceMyStart' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify admin identity
    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const { data: profile, error: profileErr } = await serviceClient
      .from('global_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Verify target user exists
    const { data: targetProfile, error: targetErr } = await serviceClient
      .from('global_profiles')
      .select('id')
      .eq('id', targetUserId)
      .single()

    if (targetErr || !targetProfile) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Verify trader exists
    const { data: trader, error: traderErr } = await serviceClient
      .from('sports_traders')
      .select('id, slug, display_name')
      .eq('id', traderId)
      .single()

    if (traderErr || !trader) {
      return new Response(JSON.stringify({ error: 'Trader not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Upsert enrollment — idempotent on user_id+trader_id
    const { error: enrollErr } = await serviceClient
      .from('sports_user_trader')
      .upsert(
        {
          user_id:                targetUserId,
          trader_id:              traderId,
          my_start_date:          myStartDate,
          start_balance_my_start: startBalanceMyStart,
        },
        { onConflict: 'user_id,trader_id' }
      )

    if (enrollErr) {
      return new Response(JSON.stringify({ error: `Enrollment failed: ${enrollErr.message}` }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    return new Response(
      JSON.stringify({
        ok:           true,
        enrolledBy:   user.id,
        targetUserId,
        traderId,
        traderSlug:   trader.slug,
        traderName:   trader.display_name,
        myStartDate,
        startBalanceMyStart,
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