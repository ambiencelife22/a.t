// GlobalTasksTab.tsx — Fleet-wide to-do inbox.
// Reads travel-tasks `all_open` (every open task across all engagements, overdue-
// first, engagement title + url_id joined). Groups by operational triage —
// Overdue / This week / Later / No date — using the EF-derived is_overdue /
// is_notifying (single source; never re-derived here). Each row links to its
// engagement's task tab. Complete / N/A inline (complete / na EF modes).
//
// Styling deliberately mirrors TasksSection (same status colors, row shape, tokens)
// so the two task surfaces read as one family — the engagement-scoped list and this
// fleet-wide inbox are the same object at two scopes.
//
// S53K — initial ship (Calendar + Tasks arc, Stage B2).

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { A } from '../../tokens/tokensAdmin'
import { buildAdminHash } from '../../utils/utilsAdminPath'
import { useAdminToast } from './_adminPrimitives'

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'open' | 'done' | 'n/a'

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

const STATUS_LABEL: Record<TaskStatus, string> = { open: 'Open', done: 'Done', 'n/a': 'N/A' }
const STATUS_COLOR: Record<TaskStatus, string> = { open: '#fbbf24', done: '#4ade80', 'n/a': '#8A8880' }
// Target status → EF mode.
const STATUS_MODE: Record<TaskStatus, string> = { open: 'reopen', done: 'complete', 'n/a': 'na' }

// Triage buckets, in operational order. Each bucket is a true operational state
// (already overdue / needs attention this week / scheduled later / undated), not a
// cosmetic grouping — this is the order the work gets triaged in.
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
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)
  const { success, error } = useAdminToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { tasks: rows } = await invokeTasks<{ tasks: Task[] }>({ mode: 'all_open' })
        if (!cancelled) setTasks(rows)
      } catch (e) {
        if (!cancelled) error(e instanceof Error ? e.message : 'Could not load tasks. Try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Complete or N/A removes the task from the open inbox (it's no longer open).
  async function resolve(task: Task, next: TaskStatus) {
    setSaving(task.id)
    try {
      await invokeTasks<{ task: Task }>({ mode: STATUS_MODE[next], id: task.id })
      setTasks(prev => prev.filter(t => t.id !== task.id))
      success(`Marked ${STATUS_LABEL[next].toLowerCase()}`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Could not update the task.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, padding: '48px 0' }}>Loading tasks…</div>
  }

  // Group into triage buckets, preserving the EF's overdue-first order within each.
  const grouped: Record<Bucket, Task[]> = { overdue: [], week: [], later: [], nodate: [] }
  for (const t of tasks) grouped[bucketFor(t)].push(t)

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>
          Studio
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: A.text, fontFamily: A.font, letterSpacing: '-0.01em' }}>
          Tasks
        </h1>
        <div style={{ marginTop: 6, fontSize: 13, color: A.faint, fontFamily: A.font }}>
          {tasks.length === 0 ? 'Nothing open across your engagements.' : `${tasks.length} open across all engagements`}
        </div>
      </div>

      {/* Empty state — an invitation, not a mood. */}
      {tasks.length === 0 && (
        <div style={{ padding: '56px 0', textAlign: 'center', fontSize: 13, color: A.faint, fontFamily: A.font, lineHeight: 1.6 }}>
          No open tasks. New tasks appear here as they're added to any engagement.
        </div>
      )}

      {/* Buckets */}
      {BUCKET_ORDER.map(bucket => {
        const rows = grouped[bucket]
        if (rows.length === 0) return null
        const isOverdue = bucket === 'overdue'
        return (
          <div key={bucket} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: isOverdue ? '#f87171' : A.faint, fontFamily: A.font,
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {BUCKET_LABEL[bucket]}
              <span style={{ color: A.faint, fontWeight: 600 }}>· {rows.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(task => (
                <TaskRow key={task.id} task={task} saving={saving === task.id} onResolve={resolve} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function TaskRow({ task, saving, onResolve }: {
  task: Task
  saving: boolean
  onResolve: (task: Task, next: TaskStatus) => void
}) {
  const engHref = task.engagement_url_id
    ? buildAdminHash({ product: 'trips', tab: 'tasks', urlId: task.engagement_url_id })
    : null

  return (
    <div style={{
      background:   A.bg,
      border:       `1px solid ${task.is_overdue ? '#f8717130' : A.border}`,
      borderLeft:   `3px solid ${STATUS_COLOR.open}`,
      borderRadius: 8,
      padding:      '11px 13px',
      display:      'flex',
      alignItems:   'flex-start',
      justifyContent: 'space-between',
      gap:          12,
    }}>
      {/* Left: title + engagement + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: A.font, color: A.text, marginBottom: 4 }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {task.engagement_title && (
            engHref
              ? <a href={engHref} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: A.gold, fontFamily: A.font, textDecoration: 'none' }}>
                  {task.engagement_title}
                </a>
              : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: A.gold, fontFamily: A.font }}>
                  {task.engagement_title}
                </span>
          )}
          {task.due_date && (
            <span style={{ fontSize: 10, fontFamily: A.font, color: task.is_overdue ? '#f87171' : A.faint }}>
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

      {/* Right: resolve actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(['done', 'n/a'] as TaskStatus[]).map(next => (
          <button
            key={next}
            onClick={() => onResolve(task, next)}
            disabled={saving}
            style={{
              fontFamily: A.font, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color:      STATUS_COLOR[next],
              background:  'transparent',
              border:     `1px solid ${STATUS_COLOR[next]}40`,
              borderRadius: 5, padding: '3px 8px',
              cursor:  saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
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