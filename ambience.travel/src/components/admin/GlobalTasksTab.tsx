// GlobalTasksTab.tsx - Fleet-wide to-do inbox.
// Reads travel-tasks `all_open` (open, overdue-first) and `all_closed` (done/
// dismissed, most-recent-first) - engagement title + url_id joined on both.
// A single Open / Closed toggle: open and closed are two states of the same
// object, one surface. Open is triage-grouped (Overdue / This week / Later /
// No date via EF-derived is_overdue / is_notifying - never re-derived here);
// Closed is a recency-flat log with a status pill per row, each reopenable.
// Resolve inline (complete / dismiss); reopen from the closed log (reopen).
//
// Styling mirrors TasksSection (status colours + tints from tokensAdmin, row
// shape) so the two task surfaces read as one family - the engagement-scoped
// list and this fleet-wide inbox are the same object at two scopes.
//
// S53K - initial ship (Calendar + Tasks arc, Stage B2 + closed log).

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { A } from '../../tokens/tokensAdmin'
import { buildAdminHash } from '../../utils/utilsAdminPath'
import { useAdminToast } from './_adminPrimitives'

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'open' | 'done' | 'dismissed'
type TaskView   = 'open' | 'closed'

type Task = {
  id:                string
  title:             string
  due_date:          string | null
  status:            TaskStatus
  note:              string | null
  is_overdue:        boolean
  is_notifying:      boolean
  completed_at:      string | null
  assignee_name:     string | null
  engagement_title:  string | null
  engagement_url_id: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = { open: 'Open', done: 'Done', dismissed: 'Dismissed' }
const STATUS_COLOR: Record<TaskStatus, string> = { open: A.statusOpen, done: A.statusDone, dismissed: A.statusDismissed }
const STATUS_TINT:  Record<TaskStatus, string> = { open: A.statusOpenTint, done: A.statusDoneTint, dismissed: A.statusDismissedTint }

// Triage buckets, in operational order. Each bucket is a true operational state
// (already overdue / needs attention this week / scheduled later / undated), not a
// cosmetic grouping - this is the order the work gets triaged in.
type Bucket = 'overdue' | 'week' | 'later' | 'nodate'
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue',
  week:    'This week',
  later:   'Later',
  nodate:  'No date',
}
const BUCKET_ORDER: Bucket[] = ['overdue', 'week', 'later', 'nodate']

function bucketFor(t: Task): Bucket {
  if (t.is_overdue) return 'overdue'
  if (!t.due_date)  return 'nodate'
  if (t.is_notifying) return 'week'   // due within the EF's alert window, not overdue
  return 'later'
}

// ── EF helper ─────────────────────────────────────────────────────────────────

async function invokeTasks<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-tasks', { body })
  if (error) throw new Error(error.message)
  return data as T
}

// ── GlobalTasksTab ────────────────────────────────────────────────────────────

export default function GlobalTasksTab() {
  const [view,    setView]    = useState<TaskView>('open')
  const [open,    setOpen]    = useState<Task[]>([])
  const [closed,  setClosed]  = useState<Task[] | null>(null)  // null = not yet loaded
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)
  const { success, error } = useAdminToast()

  // Open loads on mount. Closed loads lazily the first time the toggle flips.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { tasks: rows } = await invokeTasks<{ tasks: Task[] }>({ mode: 'all_open' })
        if (!cancelled) setOpen(rows)
      } catch (e) {
        if (!cancelled) error(e instanceof Error ? e.message : 'Could not load tasks. Try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function showClosed() {
    setView('closed')
    if (closed !== null) return  // already loaded
    setLoading(true)
    try {
      const { tasks: rows } = await invokeTasks<{ tasks: Task[] }>({ mode: 'all_closed' })
      setClosed(rows)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not load closed tasks.')
    } finally {
      setLoading(false)
    }
  }

  // Done / Dismissed from the open list: task leaves open, and any loaded closed
  // list is invalidated (it'll refetch on next view). Reopen from the closed list:
  // the reverse. Both keep the two lists honest without a full reload.
  async function resolve(task: Task, next: 'done' | 'dismissed') {
    setSaving(task.id)
    try {
      await invokeTasks<{ task: Task }>({ mode: next === 'done' ? 'complete' : 'dismiss', id: task.id })
      setOpen(prev => prev.filter(t => t.id !== task.id))
      setClosed(null)  // invalidate - refetch on next Closed view
      success(`Marked ${STATUS_LABEL[next].toLowerCase()}`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not update the task.')
    } finally {
      setSaving(null)
    }
  }

  async function reopen(task: Task) {
    setSaving(task.id)
    try {
      await invokeTasks<{ task: Task }>({ mode: 'reopen', id: task.id })
      setClosed(prev => (prev ? prev.filter(t => t.id !== task.id) : prev))
      setOpen(prev => [...prev, { ...task, status: 'open', completed_at: null }])
      success('Reopened')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not reopen the task.')
    } finally {
      setSaving(null)
    }
  }

  const showingClosed = view === 'closed'
  const openCount = open.length
  const closedCount = closed?.length ?? null

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>
          Studio
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: A.text, fontFamily: A.font, letterSpacing: '-0.01em' }}>
          Tasks
        </h1>
      </div>

      {/* Open / Closed toggle */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: A.bgCard, border: `1px solid ${A.border}`, width: 'fit-content', marginBottom: 20 }}>
        <ToggleBtn label="Open"   count={openCount}   active={!showingClosed} onClick={() => setView('open')} />
        <ToggleBtn label="Closed" count={closedCount} active={showingClosed}  onClick={showClosed} />
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '40px 0' }}>Loading tasks…</div>
      )}

      {!loading && !showingClosed && <OpenView tasks={open} saving={saving} onResolve={resolve} />}
      {!loading &&  showingClosed && <ClosedView tasks={closed ?? []} saving={saving} onReopen={reopen} />}
    </div>
  )
}

// ── Toggle button ─────────────────────────────────────────────────────────────

function ToggleBtn({ label, count, active, onClick }: { label: string; count: number | null; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', cursor: 'pointer', fontFamily: A.font, fontWeight: 700, fontSize: 12,
        padding: '6px 14px', borderRadius: 999, border: 'none',
        color: active ? A.bg : A.muted,
        background: active ? A.gold : 'transparent',
        transition: 'all 150ms ease',
      }}
    >
      {label}{count !== null ? ` · ${count}` : ''}
    </button>
  )
}

// ── Open view - triage buckets ────────────────────────────────────────────────

function OpenView({ tasks, saving, onResolve }: {
  tasks: Task[]
  saving: string | null
  onResolve: (task: Task, next: 'done' | 'dismissed') => void
}) {
  if (tasks.length === 0) {
    return (
      <div style={{ padding: '56px 0', textAlign: 'center', fontSize: 13, color: A.faint, fontFamily: A.font, lineHeight: 1.6 }}>
        No open tasks. New tasks appear here as they're added to any engagement.
      </div>
    )
  }

  const grouped: Record<Bucket, Task[]> = { overdue: [], week: [], later: [], nodate: [] }
  for (const t of tasks) grouped[bucketFor(t)].push(t)

  return (
    <>
      {BUCKET_ORDER.map(bucket => {
        const rows = grouped[bucket]
        if (rows.length === 0) return null
        const isOverdue = bucket === 'overdue'
        return (
          <div key={bucket} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: isOverdue ? A.statusOverdue : A.faint, fontFamily: A.font,
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {BUCKET_LABEL[bucket]}
              <span style={{ color: A.faint, fontWeight: 600 }}>· {rows.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(task => (
                <OpenRow key={task.id} task={task} saving={saving === task.id} onResolve={onResolve} />
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Closed view - recency-flat log ────────────────────────────────────────────

function ClosedView({ tasks, saving, onReopen }: {
  tasks: Task[]
  saving: string | null
  onReopen: (task: Task) => void
}) {
  if (tasks.length === 0) {
    return (
      <div style={{ padding: '56px 0', textAlign: 'center', fontSize: 13, color: A.faint, fontFamily: A.font, lineHeight: 1.6 }}>
        Nothing closed yet. Tasks you complete or dismiss are logged here.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map(task => (
        <ClosedRow key={task.id} task={task} saving={saving === task.id} onReopen={onReopen} />
      ))}
    </div>
  )
}

// ── Engagement label (shared) ─────────────────────────────────────────────────

function EngagementLabel({ task }: { task: Task }) {
  if (!task.engagement_title) return null
  const href = task.engagement_url_id
    ? buildAdminHash({ product: 'trips', tab: 'tasks', urlId: task.engagement_url_id })
    : null
  const style: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: A.gold, fontFamily: A.font, textDecoration: 'none' }
  return href
    ? <a href={href} style={style}>{task.engagement_title}</a>
    : <span style={style}>{task.engagement_title}</span>
}

// ── Open row ──────────────────────────────────────────────────────────────────

function OpenRow({ task, saving, onResolve }: {
  task: Task
  saving: boolean
  onResolve: (task: Task, next: 'done' | 'dismissed') => void
}) {
  return (
    <div style={{
      background:   A.bg,
      border:       `1px solid ${task.is_overdue ? A.statusOverdueTint : A.border}`,
      borderLeft:   `3px solid ${STATUS_COLOR.open}`,
      borderRadius: 8, padding: '11px 13px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: A.font, color: A.text, marginBottom: 4 }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <EngagementLabel task={task} />
          {task.due_date && (
            <span style={{ fontSize: 10, fontFamily: A.font, color: task.is_overdue ? A.statusOverdue : A.faint }}>
              {task.is_overdue ? '⚠ ' : ''}Due {task.due_date}
            </span>
          )}
          {task.assignee_name && (
            <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{task.assignee_name}</span>
          )}
        </div>
        {task.note && (
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic', marginTop: 4 }}>
            {task.note}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(['done', 'dismissed'] as const).map(next => (
          <button
            key={next}
            onClick={() => onResolve(task, next)}
            disabled={saving}
            style={{
              fontFamily: A.font, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: STATUS_COLOR[next], background: 'transparent',
              border: `1px solid ${STATUS_TINT[next]}`,
              borderRadius: 5, padding: '3px 8px',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
              transition: 'all 150ms ease',
            }}
          >
            {STATUS_LABEL[next]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Closed row ────────────────────────────────────────────────────────────────

function ClosedRow({ task, saving, onReopen }: {
  task: Task
  saving: boolean
  onReopen: (task: Task) => void
}) {
  const status = task.status
  return (
    <div style={{
      background:   A.bg,
      border:       `1px solid ${A.border}`,
      borderLeft:   `3px solid ${STATUS_COLOR[status]}`,
      borderRadius: 8, padding: '11px 13px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, fontFamily: A.font,
          color: status === 'dismissed' ? A.faint : A.text,
          textDecoration: status === 'done' ? 'line-through' : 'none',
          marginBottom: 4,
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: A.font, color: STATUS_COLOR[status] }}>
            {STATUS_LABEL[status]}
          </span>
          <EngagementLabel task={task} />
          {task.completed_at && (
            <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{task.completed_at.slice(0, 10)}</span>
          )}
          {task.assignee_name && (
            <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{task.assignee_name}</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => onReopen(task)}
          disabled={saving}
          style={{
            fontFamily: A.font, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: STATUS_COLOR.open, background: 'transparent',
            border: `1px solid ${STATUS_TINT.open}`,
            borderRadius: 5, padding: '3px 8px',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
            transition: 'all 150ms ease',
          }}
        >
          Reopen
        </button>
      </div>
    </div>
  )
}