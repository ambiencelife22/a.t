// supabase/functions/sports-admin-users/index.ts
// Returns all user profiles using the service role key (bypasses RLS).
// Caller must be authenticated with is_admin = true.
// S59: enrolledTraderIds added — array of trader UUIDs the user is enrolled in.
// S66F Phase 2: display_name moved to sports_user_prefs; is_intention_member +
//   free_positions_override moved to global_subscriptions (product='sports').
//   All three are person-scoped — joined via global_profiles.person_id.
//   Output shape UNCHANGED (queriesAdmin.getAllUsersAdmin mapper untouched).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPORTS_PRODUCT = 'sports'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const body  = await req.json() as { token?: string }
    const token = body?.token ?? ''

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    // ── Verify caller and check is_admin ──
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

    // ── Fetch all account rows (id + person_id) ──
    const { data: profiles, error: profilesErr } = await serviceClient
      .from('global_profiles')
      .select('id, person_id, is_admin, created_at')
      .order('created_at', { ascending: true })

    if (profilesErr) {
      return new Response(JSON.stringify({ error: profilesErr.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const personIds = (profiles ?? []).map(p => p.person_id).filter(Boolean)

    // ── Person-scoped lookups: display_name (prefs) + intention/positions (subs) ──
    const [{ data: prefs }, { data: subs }] = await Promise.all([
      serviceClient.from('sports_user_prefs')
        .select('person_id, display_name')
        .in('person_id', personIds),
      serviceClient.from('global_subscriptions')
        .select('person_id, is_intention_member, free_positions_override')
        .eq('product', SPORTS_PRODUCT)
        .in('person_id', personIds),
    ])

    const prefsByPerson: Record<string, { display_name: string | null }> = {}
    for (const r of prefs ?? []) prefsByPerson[r.person_id] = { display_name: r.display_name }

    const subByPerson: Record<string, { is_intention_member: boolean; free_positions_override: number | null }> = {}
    for (const r of subs ?? []) {
      subByPerson[r.person_id] = {
        is_intention_member:     r.is_intention_member ?? false,
        free_positions_override: r.free_positions_override ?? null,
      }
    }

    // ── Fetch all trader enrollments ──
    const { data: enrollments } = await serviceClient
      .from('sports_user_trader')
      .select('user_id, trader_id')

    const enrollmentMap: Record<string, string[]> = {}
    for (const row of enrollments ?? []) {
      if (!enrollmentMap[row.user_id]) enrollmentMap[row.user_id] = []
      enrollmentMap[row.user_id].push(row.trader_id)
    }

    // ── Fetch trader registry for slug lookup ──
    const { data: traders } = await serviceClient
      .from('sports_traders')
      .select('id, slug, display_name')

    const traderMap: Record<string, { slug: string; displayName: string }> = {}
    for (const t of traders ?? []) {
      traderMap[t.id] = { slug: t.slug, displayName: t.display_name }
    }

    // ── Merge into user records. Output shape UNCHANGED ──
    // Defaults match the old column defaults: no prefs row → display_name null;
    // no subscription row → is_intention_member false, override null.
    const users = (profiles ?? []).map(u => ({
      id:                      u.id,
      display_name:            prefsByPerson[u.person_id]?.display_name ?? null,
      is_admin:                u.is_admin,
      is_intention_member:     subByPerson[u.person_id]?.is_intention_member ?? false,
      created_at:              u.created_at,
      free_positions_override: subByPerson[u.person_id]?.free_positions_override ?? null,
      enrolled_traders: (enrollmentMap[u.id] ?? []).map(traderId => ({
        trader_id:    traderId,
        slug:         traderMap[traderId]?.slug        ?? null,
        display_name: traderMap[traderId]?.displayName ?? null,
      })),
    }))

    return new Response(
      JSON.stringify({ users }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})