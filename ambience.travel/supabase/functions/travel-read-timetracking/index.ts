// supabase/functions/travel-read-timetracking/index.ts
//
// Edge Function: travel-read-timetracking
// Reads time tracking data (activities, rate card, entries, summaries).
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - travel_time_* tables have admin-only RLS, no direct client read policy
//   - This function uses the service role key to bypass RLS
//   - Never called with the anon key
//
// Request body:
//   { mode: string, ...filters }
//
// Modes:
//   activities             → { activities }   active activity lookup
//   rates                  → { rates }        active rate card
//   entries                → { entries }      filter: house_id?, engagement_id?, work_date_from?, work_date_to?
//   entry                  → { entry }        single by id
//   summary_by_house       → { summary }      { [house_id]: { hours, amount } }
//   summary_by_engagement  → { summary }      { [engagement_id|__unassigned__]: { hours, amount } }
//   houses                 → { houses }       house picker (typeahead), optional { query }
//   house_people           → { people }       members of a house, requires { house_id }
//   engagements_for_house  → { engagements }  via person spine, requires { house_id }
//   house_for_engagement   → { house }        via person spine, requires { engagement_id }
//
// House <-> engagement link resolves through the person spine
// (engagement.person_id -> a_house_people.person_id -> house). Every client
// belongs to a house (invariant; orphans backfilled in migration_s53c_04).
//
// Deployed at: /functions/v1/travel-read-timetracking
// Last updated: S53C — initial ship + house/engagement resolver modes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 2dp rounding gateway (mirrors the write EF) — used for analytics aggregation.
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const ENTRY_SELECT = `
  id, house_id, engagement_id, house_person_id, work_date, hours,
  activity_id, notes, entry_type, performed_by, performed_by_person_id,
  started_at, ended_at, rate_id, rate_applied, billable_amount,
  invoice_status, invoiced_at, paid_at, created_at, updated_at,
  travel_time_activities(slug, label),
  travel_time_rates(slug, role_label, hourly_rate, currency),
  performer:global_people!travel_time_entries_performed_by_person_id_fkey(first_name, last_name, nickname)
`

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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

    // ── 3. Verify caller is admin ─────────────────────────────────────────────
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
      case 'activities': {
        const { data, error } = await serviceClient
          .from('travel_time_activities')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        if (error) {
          console.error('activities fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch activities' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ activities: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'rates': {
        const { data, error } = await serviceClient
          .from('travel_time_rates')
          .select('*')
          .eq('is_active', true)
          .order('role_label', { ascending: true })
        if (error) {
          console.error('rates fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch rates' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ rates: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'entries': {
        const { house_id, engagement_id, work_date_from, work_date_to } = body as {
          house_id?: string; engagement_id?: string
          work_date_from?: string; work_date_to?: string
        }
        let q = serviceClient
          .from('travel_time_entries')
          .select(ENTRY_SELECT)
          .order('work_date', { ascending: false })
        if (house_id)       q = q.eq('house_id', house_id)
        if (engagement_id)  q = q.eq('engagement_id', engagement_id)
        if (work_date_from) q = q.gte('work_date', work_date_from)
        if (work_date_to)   q = q.lte('work_date', work_date_to)

        const { data, error } = await q
        if (error) {
          console.error('entries fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch entries' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ entries: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'entry': {
        const { id } = body as { id?: string }
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await serviceClient
          .from('travel_time_entries')
          .select(ENTRY_SELECT)
          .eq('id', id)
          .maybeSingle()
        if (error) {
          console.error('entry fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch entry' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ entry: data ?? null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'summary_by_house':
      case 'summary_by_engagement': {
        const groupCol = mode === 'summary_by_house' ? 'house_id' : 'engagement_id'
        const { data, error } = await serviceClient
          .from('travel_time_entries')
          .select(`${groupCol}, hours, billable_amount`)
        if (error) {
          console.error('summary fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch summary' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const summary: Record<string, { hours: number; amount: number }> = {}
        for (const r of (data ?? []) as any[]) {
          const key = (r[groupCol] as string) ?? '__unassigned__'
          if (!summary[key]) summary[key] = { hours: 0, amount: 0 }
          summary[key].hours  += Number(r.hours ?? 0)
          summary[key].amount += Number(r.billable_amount ?? 0)
        }
        return new Response(
          JSON.stringify({ summary }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── House picker source (typeahead) ─────────────────────────────────────
      // Optional { query } filters by display_name (case-insensitive).
      case 'houses': {
        const { query } = body as { query?: string }
        let q = serviceClient
          .from('a_houses')
          .select('id, a_house_id, display_name')
          .order('display_name', { ascending: true })
          .limit(50)
        if (query && query.trim()) q = q.ilike('display_name', `%${query.trim()}%`)
        const { data, error } = await q
        if (error) {
          console.error('houses fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch houses' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ houses: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── House members (person picker, scoped to a house) ────────────────────
      // Requires { house_id }. Phase 2: name resolves from global_people via the
      // person_id bridge (set in reconcile Phase 1). member_ref kept as fallback
      // label during transition. display_name is the resolved name to render.
      case 'house_people': {
        const { house_id } = body as { house_id?: string }
        if (!house_id) {
          return new Response(
            JSON.stringify({ error: 'house_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await serviceClient
          .from('a_house_people')
          .select('id, house_id, member_ref, role, person_id, global_people(first_name, last_name, nickname)')
          .eq('house_id', house_id)
          .order('role', { ascending: true })
        if (error) {
          console.error('house_people fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch house people' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Resolve a display name: global_people name -> member_ref fallback.
        const people = (data ?? []).map((m: any) => {
          const gp = Array.isArray(m.global_people) ? m.global_people[0] : m.global_people
          const resolved = gp
            ? (gp.nickname || [gp.first_name, gp.last_name].filter(Boolean).join(' ') || m.member_ref)
            : m.member_ref
          return {
            id: m.id,
            house_id: m.house_id,
            person_id: m.person_id,
            role: m.role,
            member_ref: m.member_ref,
            display_name: resolved,
          }
        })
        return new Response(
          JSON.stringify({ people }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── Engagements for a house (via person spine) ──────────────────────────
      // Requires { house_id }. Phase 2: house -> a_house_people.person_id set ->
      // engagements where person_id in that set. Replaces the bookings.engagement_id
      // walk (only 1 of 8 bookings carried it). Engagements whose person has no
      // house membership simply won't appear here.
      case 'engagements_for_house': {
        const { house_id } = body as { house_id?: string }
        if (!house_id) {
          return new Response(
            JSON.stringify({ error: 'house_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data: members, error: mErr } = await serviceClient
          .from('a_house_people')
          .select('person_id')
          .eq('house_id', house_id)
          .not('person_id', 'is', null)
        if (mErr) {
          console.error('engagements_for_house members error:', mErr)
          return new Response(
            JSON.stringify({ error: 'Failed to resolve engagements' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const personIds = [...new Set((members ?? []).map((m: any) => m.person_id).filter(Boolean))]
        if (personIds.length === 0) {
          return new Response(
            JSON.stringify({ engagements: [] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await serviceClient
          .from('travel_immerse_engagements')
          .select('id, url_id, title, iteration_label')
          .in('person_id', personIds)
          .order('created_at', { ascending: true })
        if (error) {
          console.error('engagements_for_house fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch engagements' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ engagements: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── House for an engagement (via person spine) ──────────────────────────
      // Requires { engagement_id }. Phase 2: engagement.person_id ->
      // a_house_people.person_id -> house. Replaces the bookings hub walk.
      // After the orphan-client backfill + auto-house trigger, every client has a
      // house, so an engagement owned by a client always resolves one.
      case 'house_for_engagement': {
        const { engagement_id } = body as { engagement_id?: string }
        if (!engagement_id) {
          return new Response(
            JSON.stringify({ error: 'engagement_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data: eng, error: eErr } = await serviceClient
          .from('travel_immerse_engagements')
          .select('person_id')
          .eq('id', engagement_id)
          .maybeSingle()
        if (eErr) {
          console.error('house_for_engagement eng error:', eErr)
          return new Response(
            JSON.stringify({ error: 'Failed to resolve house' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (!eng?.person_id) {
          return new Response(
            JSON.stringify({ house: null }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { data: member, error: mErr } = await serviceClient
          .from('a_house_people')
          .select('house_id, a_houses(id, a_house_id, display_name)')
          .eq('person_id', eng.person_id)
          .limit(1)
          .maybeSingle()
        if (mErr) {
          console.error('house_for_engagement member error:', mErr)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch house' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const h = member?.a_houses
          ? (Array.isArray(member.a_houses) ? member.a_houses[0] : member.a_houses)
          : null
        return new Response(
          JSON.stringify({ house: h }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── Analytics: filtered summary + breakdown + date-desc entry list ──────
      // Filters: house_id, engagement_id, team_member_id (performer person),
      //   activity_id, entry_type, is_invoiceable, work_date_from/to.
      // group_by: 'house' | 'engagement' | 'team' | 'activity' (default 'house').
      // All aggregation server-side. Returns { summary, breakdown, entries }.
      case 'analytics': {
        const f = body as {
          house_id?: string; engagement_id?: string; team_member_id?: string
          activity_id?: string; entry_type?: string; is_invoiceable?: boolean
          work_date_from?: string; work_date_to?: string; group_by?: string
        }
        const groupBy = (['house','engagement','team','activity'].includes(f.group_by ?? '')
          ? f.group_by : 'house') as 'house' | 'engagement' | 'team' | 'activity'

        // Select with the labels needed to group + render, date-desc.
        const ANALYTICS_SELECT = `
          id, work_date, hours, entry_type, is_invoiceable,
          rate_applied, effort_value, billable_amount, notes,
          house_id, engagement_id, activity_id, performed_by_person_id, performed_by,
          a_houses(display_name),
          travel_immerse_engagements(title),
          travel_time_activities(label),
          performer:global_people!travel_time_entries_performed_by_person_id_fkey(first_name, last_name, nickname)
        `
        let q = serviceClient
          .from('travel_time_entries')
          .select(ANALYTICS_SELECT)
          .order('work_date', { ascending: false })
        if (f.house_id)        q = q.eq('house_id', f.house_id)
        if (f.engagement_id)   q = q.eq('engagement_id', f.engagement_id)
        if (f.team_member_id)  q = q.eq('performed_by_person_id', f.team_member_id)
        if (f.activity_id)     q = q.eq('activity_id', f.activity_id)
        if (f.entry_type)      q = q.eq('entry_type', f.entry_type)
        if (typeof f.is_invoiceable === 'boolean') q = q.eq('is_invoiceable', f.is_invoiceable)
        if (f.work_date_from)  q = q.gte('work_date', f.work_date_from)
        if (f.work_date_to)    q = q.lte('work_date', f.work_date_to)

        const { data, error } = await q
        if (error) {
          console.error('analytics fetch error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch analytics' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const one = (v: any) => (Array.isArray(v) ? v[0] : v)
        const num = (v: any) => (v == null ? 0 : Number(v))

        // Flatten rows with resolved labels (date-desc preserved from query).
        const entries = (data ?? []).map((r: any) => {
          const gp = one(r.performer)
          const performer = gp
            ? (gp.nickname || [gp.first_name, gp.last_name].filter(Boolean).join(' ') || r.performed_by)
            : r.performed_by
          return {
            id: r.id,
            work_date: r.work_date,
            house: one(r.a_houses)?.display_name ?? null,
            engagement: one(r.travel_immerse_engagements)?.title ?? null,
            activity: one(r.travel_time_activities)?.label ?? null,
            performer,
            hours: num(r.hours),
            entry_type: r.entry_type,
            is_invoiceable: r.is_invoiceable,
            rate_applied: r.rate_applied == null ? null : num(r.rate_applied),
            effort_value: num(r.effort_value),
            billable_amount: num(r.billable_amount),
            notes: r.notes,
            // group keys + labels
            _house_id: r.house_id, _engagement_id: r.engagement_id,
            _activity_id: r.activity_id, _person_id: r.performed_by_person_id,
            _performer: performer,
          }
        })

        // Summary across the filtered set.
        const summary = entries.reduce((acc, e) => {
          acc.hours += e.hours
          acc.effort_value += e.effort_value
          acc.invoiced += e.billable_amount
          return acc
        }, { hours: 0, effort_value: 0, invoiced: 0, absorbed: 0 })
        summary.absorbed = r2(summary.effort_value - summary.invoiced)
        summary.hours = r2(summary.hours)
        summary.effort_value = r2(summary.effort_value)
        summary.invoiced = r2(summary.invoiced)

        // Breakdown grouped by the chosen dimension.
        const keyFns: Record<string, (e: any) => { key: string; label: string }> = {
          house:      e => ({ key: e._house_id ?? 'none',      label: e.house ?? '(no house)' }),
          engagement: e => ({ key: e._engagement_id ?? 'none', label: e.engagement ?? '(no engagement)' }),
          team:       e => ({ key: e._person_id ?? 'none',     label: e._performer ?? '(unassigned)' }),
          activity:   e => ({ key: e._activity_id ?? 'none',   label: e.activity ?? '(no activity)' }),
        }
        const kf = keyFns[groupBy]
        const groups: Record<string, any> = {}
        for (const e of entries) {
          const { key, label } = kf(e)
          if (!groups[key]) groups[key] = { key, label, hours: 0, effort_value: 0, invoiced: 0, absorbed: 0 }
          groups[key].hours += e.hours
          groups[key].effort_value += e.effort_value
          groups[key].invoiced += e.billable_amount
        }
        const breakdown = Object.values(groups).map((g: any) => ({
          key: g.key, label: g.label,
          hours: r2(g.hours), effort_value: r2(g.effort_value),
          invoiced: r2(g.invoiced), absorbed: r2(g.effort_value - g.invoiced),
        })).sort((a, b) => b.effort_value - a.effort_value)

        // Strip internal keys from the returned entry list.
        const cleanEntries = entries.map(({ _house_id, _engagement_id, _activity_id, _person_id, _performer, ...rest }) => rest)

        return new Response(
          JSON.stringify({ summary, breakdown, group_by: groupBy, entries: cleanEntries }),
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
    console.error('travel-read-timetracking unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})