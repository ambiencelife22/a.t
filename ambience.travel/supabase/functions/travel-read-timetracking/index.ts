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
//   entries                → { entries }      filter: house_id?, iteration_id?, work_date_from?, work_date_to?
//   entry                  → { entry }        single by id
//   summary_by_house       → { summary }      { [house_id]: { hours, amount } }
//   summary_by_engagement  → { summary }      { [iteration_id|__unassigned__]: { hours, amount } }
//   houses                 → { houses }       house picker (typeahead), optional { query }
//   house_people           → { people }       members of a house, requires { house_id }
//   engagements_for_house  → { engagements }  via person spine, requires { house_id }
//   house_for_engagement   → { house }        via person spine, requires { iteration_id }
//
// House <-> engagement link resolves through the person spine
// (engagement.person_id -> a_house_people.person_id -> house). Every client
// belongs to a house (invariant; orphans backfilled in migration_s53c_04).
//
// Deployed at: /functions/v1/travel-read-timetracking
// Last updated: S53C — initial ship + house/engagement resolver modes.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'


// 2dp rounding gateway (mirrors the write EF) — used for analytics aggregation.
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const ENTRY_SELECT = `
  id, house_id, iteration_id, house_person_id, work_date, hours,
  activity_id, notes, entry_type, performed_by, performed_by_person_id,
  started_at, ended_at, rate_id, rate_applied, billable_amount,
  invoice_status, invoiced_at, paid_at, created_at, updated_at,
  travel_time_activities(slug, label),
  travel_time_rates(slug, role_label, hourly_rate, currency),
  performer:global_people!travel_time_entries_performed_by_person_id_fkey(first_name, last_name, nickname)
`

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return preflight()

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }

    if (!mode) return json({ error: 'mode is required' }, 400)

    // ── 2-3. Verify caller is an authenticated admin ─────────────────────────
    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient } = gate

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
          return json({ error: 'Failed to fetch activities' }, 500)
        }
        return json({ activities: data ?? [] }, 200)
      }

      case 'rates': {
        const { data, error } = await serviceClient
          .from('travel_time_rates')
          .select('*')
          .eq('is_active', true)
          .order('role_label', { ascending: true })
        if (error) {
          console.error('rates fetch error:', error)
          return json({ error: 'Failed to fetch rates' }, 500)
        }
        return json({ rates: data ?? [] }, 200)
      }

      case 'entries': {
        const { house_id, iteration_id, work_date_from, work_date_to } = body as {
          house_id?: string; iteration_id?: string
          work_date_from?: string; work_date_to?: string
        }
        let q = serviceClient
          .from('travel_time_entries')
          .select(ENTRY_SELECT)
          .order('work_date', { ascending: false })
        if (house_id)       q = q.eq('house_id', house_id)
        if (iteration_id)  q = q.eq('iteration_id', iteration_id)
        if (work_date_from) q = q.gte('work_date', work_date_from)
        if (work_date_to)   q = q.lte('work_date', work_date_to)

        const { data, error } = await q
        if (error) {
          console.error('entries fetch error:', error)
          return json({ error: 'Failed to fetch entries' }, 500)
        }
        return json({ entries: data ?? [] }, 200)
      }

      case 'entry': {
        const { id } = body as { id?: string }
        if (!id) {
          return json({ error: 'id is required' }, 400)
        }
        const { data, error } = await serviceClient
          .from('travel_time_entries')
          .select(ENTRY_SELECT)
          .eq('id', id)
          .maybeSingle()
        if (error) {
          console.error('entry fetch error:', error)
          return json({ error: 'Failed to fetch entry' }, 500)
        }
        return json({ entry: data ?? null }, 200)
      }

      case 'summary_by_house':
      case 'summary_by_engagement': {
        const groupCol = mode === 'summary_by_house' ? 'house_id' : 'iteration_id'
        const { data, error } = await serviceClient
          .from('travel_time_entries')
          .select(`${groupCol}, hours, billable_amount`)
        if (error) {
          console.error('summary fetch error:', error)
          return json({ error: 'Failed to fetch summary' }, 500)
        }
        const summary: Record<string, { hours: number; amount: number }> = {}
        for (const r of (data ?? []) as any[]) {
          const key = (r[groupCol] as string) ?? '__unassigned__'
          if (!summary[key]) summary[key] = { hours: 0, amount: 0 }
          summary[key].hours  += Number(r.hours ?? 0)
          summary[key].amount += Number(r.billable_amount ?? 0)
        }
        return json({ summary }, 200)
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
          return json({ error: 'Failed to fetch houses' }, 500)
        }
        return json({ houses: data ?? [] }, 200)
      }

      // ── House members (person picker, scoped to a house) ────────────────────
      // Requires { house_id }. Phase 2: name resolves from global_people via the
      // person_id bridge (set in reconcile Phase 1). member_ref kept as fallback
      // label during transition. display_name is the resolved name to render.
      case 'house_people': {
        const { house_id } = body as { house_id?: string }
        if (!house_id) {
          return json({ error: 'house_id is required' }, 400)
        }
        const { data, error } = await serviceClient
          .from('a_house_people')
          .select('id, house_id, member_ref, role, person_id, global_people(first_name, last_name, nickname)')
          .eq('house_id', house_id)
          .order('role', { ascending: true })
        if (error) {
          console.error('house_people fetch error:', error)
          return json({ error: 'Failed to fetch house people' }, 500)
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
        return json({ people }, 200)
      }

      // ── Engagements for a house (via person spine) ──────────────────────────
      // Requires { house_id }. Phase 2: house -> a_house_people.person_id set ->
      // engagements where person_id in that set. Replaces the bookings.iteration_id
      // walk (only 1 of 8 bookings carried it). Engagements whose person has no
      // house membership simply won't appear here.
      case 'engagements_for_house': {
        const { house_id } = body as { house_id?: string }
        if (!house_id) {
          return json({ error: 'house_id is required' }, 400)
        }
        const { data: members, error: mErr } = await serviceClient
          .from('a_house_people')
          .select('person_id')
          .eq('house_id', house_id)
          .not('person_id', 'is', null)
        if (mErr) {
          console.error('engagements_for_house members error:', mErr)
          return json({ error: 'Failed to resolve engagements' }, 500)
        }
        const personIds = [...new Set((members ?? []).map((m: any) => m.person_id).filter(Boolean))]
        if (personIds.length === 0) {
          return json({ engagements: [] }, 200)
        }
        const { data, error } = await serviceClient
          .from('travel_overlay_engagements')
          .select('id, url_id, title, iteration_label')
          .in('person_id', personIds)
          .order('created_at', { ascending: true })
        if (error) {
          console.error('engagements_for_house fetch error:', error)
          return json({ error: 'Failed to fetch engagements' }, 500)
        }
        return json({ engagements: data ?? [] }, 200)
      }

      // ── House for an engagement (via person spine) ──────────────────────────
      // Requires { iteration_id }. Phase 2: engagement.person_id ->
      // a_house_people.person_id -> house. Replaces the bookings hub walk.
      // After the orphan-client backfill + auto-house trigger, every client has a
      // house, so an engagement owned by a client always resolves one.
      case 'house_for_engagement': {
        const { iteration_id } = body as { iteration_id?: string }
        if (!iteration_id) {
          return json({ error: 'iteration_id is required' }, 400)
        }
        const { data: eng, error: eErr } = await serviceClient
          .from('travel_overlay_engagements')
          .select('person_id')
          .eq('id', iteration_id)
          .maybeSingle()
        if (eErr) {
          console.error('house_for_engagement eng error:', eErr)
          return json({ error: 'Failed to resolve house' }, 500)
        }
        if (!eng?.person_id) {
          return json({ house: null }, 200)
        }
        const { data: member, error: mErr } = await serviceClient
          .from('a_house_people')
          .select('house_id, a_houses(id, a_house_id, display_name)')
          .eq('person_id', eng.person_id)
          .limit(1)
          .maybeSingle()
        if (mErr) {
          console.error('house_for_engagement member error:', mErr)
          return json({ error: 'Failed to fetch house' }, 500)
        }
        const h = member?.a_houses
          ? (Array.isArray(member.a_houses) ? member.a_houses[0] : member.a_houses)
          : null
        return json({ house: h }, 200)
      }

      // ── Analytics: filtered summary + breakdown + date-desc entry list ──────
      // Filters: house_id, iteration_id, team_member_id (performer person),
      //   activity_id, entry_type, is_invoiceable, work_date_from/to.
      // group_by: 'house' | 'engagement' | 'team' | 'activity' (default 'house').
      // All aggregation server-side. Returns { summary, breakdown, entries }.
      case 'analytics': {
        const f = body as {
          house_id?: string; iteration_id?: string; team_member_id?: string
          activity_id?: string; entry_type?: string; is_invoiceable?: boolean
          work_date_from?: string; work_date_to?: string; group_by?: string
        }
        const groupBy = (['house','engagement','team','activity'].includes(f.group_by ?? '')
          ? f.group_by : 'house') as 'house' | 'engagement' | 'team' | 'activity'

        // Select with the labels needed to group + render, date-desc.
        const ANALYTICS_SELECT = `
          id, work_date, hours, entry_type, is_invoiceable,
          rate_applied, effort_value, billable_amount, notes,
          house_id, iteration_id, activity_id, performed_by_person_id, performed_by,
          a_houses(display_name),
          travel_overlay_engagements(title),
          travel_time_activities(label),
          performer:global_people!travel_time_entries_performed_by_person_id_fkey(first_name, last_name, nickname)
        `
        let q = serviceClient
          .from('travel_time_entries')
          .select(ANALYTICS_SELECT)
          .order('work_date', { ascending: false })
        if (f.house_id)        q = q.eq('house_id', f.house_id)
        if (f.iteration_id)   q = q.eq('iteration_id', f.iteration_id)
        if (f.team_member_id)  q = q.eq('performed_by_person_id', f.team_member_id)
        if (f.activity_id)     q = q.eq('activity_id', f.activity_id)
        if (f.entry_type)      q = q.eq('entry_type', f.entry_type)
        if (typeof f.is_invoiceable === 'boolean') q = q.eq('is_invoiceable', f.is_invoiceable)
        if (f.work_date_from)  q = q.gte('work_date', f.work_date_from)
        if (f.work_date_to)    q = q.lte('work_date', f.work_date_to)

        const { data, error } = await q
        if (error) {
          console.error('analytics fetch error:', error)
          return json({ error: 'Failed to fetch analytics' }, 500)
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
            engagement: one(r.travel_overlay_engagements)?.title ?? null,
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
            _house_id: r.house_id, _iteration_id: r.iteration_id,
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
          engagement: e => ({ key: e._iteration_id ?? 'none', label: e.engagement ?? '(no engagement)' }),
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
        const cleanEntries = entries.map(({ _house_id, _iteration_id, _activity_id, _person_id, _performer, ...rest }) => rest)

        return json({ summary, breakdown, group_by: groupBy, entries: cleanEntries }, 200)
      }

      default:
        return json({ error: `Unknown mode: ${mode}` }, 400)
    }

  } catch (err) {
    console.error('travel-read-timetracking unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})