// supabase/functions/travel-tasks/index.ts
//
// Edge Function: travel-tasks
// Class A — admin-only. Single source for all task reads + writes (Calendar +
// To-Do, Stage 2). Tables: travel_tasks + travel_task_templates.
//
// Security model:
//   - JWT REQUIRED (verify_jwt = true). Caller must be an admin (global_profiles.is_admin).
//   - Auth via shared requireAdmin gate (_shared/auth.ts). Reads/writes via service role.
//
// Request body: { mode, ...params }
//
// Read modes (take an optional viewer_team_id for the visibility seam — today it
// only filters global tasks; Stage 4 activates the assigned_to clause):
//   by_engagement  { engagement_id, viewer_team_id? } → TaskRow[]
//   by_range       { range_start, range_end, viewer_team_id? } → TaskRow[]
//   all_open       { viewer_team_id? } → open tasks, all engagements, overdue-first
//   all_closed     { viewer_team_id? } → done/dismissed, all engagements, recent-first
//
// Write modes:
//   create   { engagement_id, stay_id?, title, due_date?, note?, assigned_to? }
//   update   { id, title?, due_date?, note?, stay_id?, assigned_to? }
//   complete { id }
//   reopen   { id }
//   dismiss  { id }
//   delete   { id }
//
// DERIVED in the read response, never stored:
//   is_overdue   = status='open' AND due_date < today
//   is_notifying = status='open' AND due_date present AND due_date <= today + ALERT_WINDOW_DAYS
//
// First ship: S55 (Calendar Stage 2b).

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

const ALERT_WINDOW_DAYS = 7  // single source for the notification horizon

type Mode =
  | 'by_engagement'
  | 'by_range'
  | 'all_open'
  | 'all_closed'
  | 'create'
  | 'update'
  | 'complete'
  | 'reopen'
  | 'dismiss'
  | 'delete'

// Row as stored, plus the assignee name resolved via global_team.person_id → global_people.
type TaskQueryRow = {
  id:            string
  engagement_id: string
  stay_id:       string | null
  template_id:   string | null
  title:         string
  due_date:      string | null
  status:        string
  assigned_to:   string | null
  note:          string | null
  created_at:    string
  completed_at:  string | null
  assignee: {
    person: { first_name: string | null; last_name: string | null; nickname: string | null } | null
  } | null
}

const TASK_SELECT = `
  id, engagement_id, stay_id, template_id, title, due_date, status,
  assigned_to, note, created_at, completed_at,
  assignee:global_team!travel_tasks_assigned_to_fkey(
    person:global_people!global_team_person_id_fkey(first_name, last_name, nickname)
  )
`

// all_open adds the engagement title + url_id so the fleet-wide inbox can label
// and link each row. Kept separate so by_engagement/by_range + shape() are untouched.
const TASK_SELECT_WITH_ENGAGEMENT = `
  id, engagement_id, stay_id, template_id, title, due_date, status,
  assigned_to, note, created_at, completed_at,
  assignee:global_team!travel_tasks_assigned_to_fkey(
    person:global_people!global_team_person_id_fkey(first_name, last_name, nickname)
  ),
  engagement:travel_overlay_engagements!travel_tasks_engagement_id_fkey(title, url_id)
`

function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Shape a stored row into the API row with derived fields + flattened assignee name.
function shape(r: TaskQueryRow) {
  const today = todayISO()
  const windowEnd = addDaysISO(today, ALERT_WINDOW_DAYS)
  const open = r.status === 'open'
  const is_overdue   = open && !!r.due_date && r.due_date < today
  const is_notifying = open && !!r.due_date && r.due_date <= windowEnd
  const p = r.assignee?.person ?? null
  const assignee_name = p ? (p.nickname || [p.first_name, p.last_name].filter(Boolean).join(' ') || null) : null
  return {
    id: r.id, engagement_id: r.engagement_id, stay_id: r.stay_id, template_id: r.template_id,
    title: r.title, due_date: r.due_date, status: r.status,
    assigned_to: r.assigned_to, assignee_name,
    note: r.note, created_at: r.created_at, completed_at: r.completed_at,
    is_overdue, is_notifying,
  }
}

// Row + shape for all_open: the base task plus engagement title/url_id.
type TaskEngagementRow = TaskQueryRow & {
  engagement: { title: string | null; url_id: string | null } | null
}

function shapeWithEngagement(r: TaskEngagementRow) {
  const base = shape(r)
  return {
    ...base,
    engagement_title:  r.engagement?.title ?? null,
    engagement_url_id: r.engagement?.url_id ?? null,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as Mode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    // ── Reads ────────────────────────────────────────────────────────────────
    if (mode === 'by_engagement') {
      const engagement_id = body?.engagement_id as string | undefined
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)
      const viewer = (body?.viewer_team_id as string | undefined) ?? null

      let q = db.from('travel_tasks').select(TASK_SELECT).eq('engagement_id', engagement_id)
      // Visibility seam: global tasks only today. Stage 4: include viewer's own.
      q = viewer ? q.or(`assigned_to.is.null,assigned_to.eq.${viewer}`) : q.is('assigned_to', null)
      q = q.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })

      const { data, error } = await q
      if (error) { console.error('by_engagement error:', error); return json({ error: 'Failed to fetch tasks' }, 500) }
      return json({ tasks: ((data ?? []) as unknown as TaskQueryRow[]).map(shape) })
    }

    if (mode === 'by_range') {
      const range_start = body?.range_start as string | undefined
      const range_end   = body?.range_end as string | undefined
      if (!range_start || !range_end) return json({ error: 'range_start and range_end are required' }, 400)
      const viewer = (body?.viewer_team_id as string | undefined) ?? null

      let q = db.from('travel_tasks').select(TASK_SELECT)
        .gte('due_date', range_start).lte('due_date', range_end)
      q = viewer ? q.or(`assigned_to.is.null,assigned_to.eq.${viewer}`) : q.is('assigned_to', null)
      q = q.order('due_date', { ascending: true })

      const { data, error } = await q
      if (error) { console.error('by_range error:', error); return json({ error: 'Failed to fetch tasks' }, 500) }
      return json({ tasks: ((data ?? []) as unknown as TaskQueryRow[]).map(shape) })
    }

    // all_open — fleet-wide inbox: every open task across all engagements,
    // overdue-first, with the engagement title + url_id joined so each row can
    // link back to its engagement. Includes null-due-date tasks (they still need
    // doing) — this is why it's distinct from by_range, which filters on due_date.
    if (mode === 'all_open') {
      const viewer = (body?.viewer_team_id as string | undefined) ?? null

      let q = db.from('travel_tasks').select(TASK_SELECT_WITH_ENGAGEMENT).eq('status', 'open')
      // Fleet-wide inbox shows ALL open tasks. A viewer_team_id (Stage 4) will
      // narrow to global + own; today, no viewer = everything open.
      if (viewer) q = q.or(`assigned_to.is.null,assigned_to.eq.${viewer}`)
      // Overdue-first: due_date ascending with nulls last, then oldest-created.
      q = q.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })

      const { data, error } = await q
      if (error) { console.error('all_open error:', error); return json({ error: 'Failed to fetch tasks' }, 500) }
      return json({ tasks: ((data ?? []) as unknown as TaskEngagementRow[]).map(shapeWithEngagement) })
    }

    // all_closed — the closed log: every done/dismissed task across all
    // engagements, most-recently-closed first. Same engagement join + shape as
    // all_open so the inbox renders open and closed as one object at two states.
    if (mode === 'all_closed') {
      const viewer = (body?.viewer_team_id as string | undefined) ?? null

      let q = db.from('travel_tasks').select(TASK_SELECT_WITH_ENGAGEMENT)
        .in('status', ['done', 'dismissed'])
      if (viewer) q = q.or(`assigned_to.is.null,assigned_to.eq.${viewer}`)
      q = q.order('completed_at', { ascending: false, nullsFirst: false })

      const { data, error } = await q
      if (error) { console.error('all_closed error:', error); return json({ error: 'Failed to fetch tasks' }, 500) }
      return json({ tasks: ((data ?? []) as unknown as TaskEngagementRow[]).map(shapeWithEngagement) })
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    if (mode === 'create') {
      const engagement_id = body?.engagement_id as string | undefined
      const title = (body?.title as string | undefined)?.trim()
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)
      if (!title)         return json({ error: 'title is required' }, 400)

      const insert = {
        engagement_id,
        stay_id:     (body?.stay_id as string | undefined) ?? null,
        template_id: null,  // custom task — generation sets this for stock tasks
        title,
        due_date:    (body?.due_date as string | undefined) ?? null,
        note:        (body?.note as string | undefined) ?? null,
        assigned_to: (body?.assigned_to as string | undefined) ?? null, // null = global
      }
      const { data, error } = await db.from('travel_tasks').insert(insert).select(TASK_SELECT).single()
      if (error) { console.error('create error:', error); return json({ error: 'Failed to create task' }, 500) }
      return json({ task: shape(data as unknown as TaskQueryRow) })
    }

    if (mode === 'update') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)

      // Patch only provided fields. Status is NOT touched here (use complete/reopen).
      const patch: Record<string, unknown> = {}
      if (body?.title !== undefined)       patch.title       = (body.title as string).trim()
      if (body?.due_date !== undefined)    patch.due_date    = body.due_date ?? null
      if (body?.note !== undefined)        patch.note        = body.note ?? null
      if (body?.stay_id !== undefined)     patch.stay_id     = body.stay_id ?? null
      if (body?.assigned_to !== undefined) patch.assigned_to = body.assigned_to ?? null
      if (Object.keys(patch).length === 0) return json({ error: 'nothing to update' }, 400)

      const { data, error } = await db.from('travel_tasks').update(patch).eq('id', id).select(TASK_SELECT).single()
      if (error) { console.error('update error:', error); return json({ error: 'Failed to update task' }, 500) }
      return json({ task: shape(data as unknown as TaskQueryRow) })
    }

    if (mode === 'complete') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data, error } = await db.from('travel_tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id).select(TASK_SELECT).single()
      if (error) { console.error('complete error:', error); return json({ error: 'Failed to complete task' }, 500) }
      return json({ task: shape(data as unknown as TaskQueryRow) })
    }

    if (mode === 'reopen') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data, error } = await db.from('travel_tasks')
        .update({ status: 'open', completed_at: null })
        .eq('id', id).select(TASK_SELECT).single()
      if (error) { console.error('reopen error:', error); return json({ error: 'Failed to reopen task' }, 500) }
      return json({ task: shape(data as unknown as TaskQueryRow) })
    }

    if (mode === 'dismiss') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data, error } = await db.from('travel_tasks')
        .update({ status: 'dismissed', completed_at: new Date().toISOString() })
        .eq('id', id).select(TASK_SELECT).single()
      if (error) { console.error('dismiss error:', error); return json({ error: 'Failed to dismiss task' }, 500) }
      return json({ task: shape(data as unknown as TaskQueryRow) })
    }

    if (mode === 'delete') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { error } = await db.from('travel_tasks').delete().eq('id', id)
      if (error) { console.error('delete error:', error); return json({ error: 'Failed to delete task' }, 500) }
      return json({ ok: true })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-tasks unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})