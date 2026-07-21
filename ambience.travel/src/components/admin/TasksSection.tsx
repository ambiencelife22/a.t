// TasksSection.tsx - Engagement-scoped task list.
// Reads from travel-tasks EF (by_engagement mode).
// Status transitions: open → done (complete mode), open → dismissed (dismiss mode),
//   done/dismissed → open (reopen mode).
// Template instantiation is manual for now; automation is Phase 3+.
//
// S53H - initial ship.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { A } from '../../tokens/tokensAdmin'
import { useAdminToast } from './_adminPrimitives'

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'open' | 'done' | 'dismissed'

type Task = {
  id:            string
  title:         string
  due_date:      string | null
  status:        TaskStatus
  note:          string | null
  is_overdue:    boolean
  is_notifying:  boolean
  completed_at:  string | null
  assignee_name: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = {
  open:      'Open',
  done:      'Done',
  dismissed: 'Dismissed',
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  open:      A.statusOpen,
  done:      A.statusDone,
  dismissed: A.statusDismissed,
}

// Tint per status - for the subtle button borders (base colour at low alpha).
const STATUS_TINT: Record<TaskStatus, string> = {
  open:      A.statusOpenTint,
  done:      A.statusDoneTint,
  dismissed: A.statusDismissedTint,
}

// EF mode for each target status
const STATUS_MODE: Record<TaskStatus, string> = {
  open:      'reopen',
  done:      'complete',
  dismissed: 'dismiss',
}

// ── EF helper ─────────────────────────────────────────────────────────────────

async function invokeTasks<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('travel-tasks', { body })
  if (error) throw new Error(error.message)
  return data as T
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontFamily: A.font, fontSize: 11, color: A.text, background: A.bg,
  border: `1px solid ${A.border}`, borderRadius: 6, padding: '5px 8px',
  outline: 'none', boxSizing: 'border-box' as const,
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: A.faint,
  fontFamily: A.font, marginBottom: 3, display: 'block',
}

// ── TasksSection ──────────────────────────────────────────────────────────────

export default function TasksSection({ urlId }: { urlId: string }) {
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [tasks,        setTasks]        = useState<Task[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState<string | null>(null)
  const [adding,       setAdding]       = useState(false)
  const [newTitle,     setNewTitle]     = useState('')
  const [newDueDate,   setNewDueDate]   = useState('')
  const { success, error } = useAdminToast()

  // Resolve engagement_id from url_id, then load tasks
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: eng, error: engErr } = await supabase
          .from('travel_engagements')
          .select('id')
          .eq('url_id', urlId)
          .single()
        if (engErr || !eng) throw new Error('Engagement not found')
        setEngagementId(eng.id)

        const { tasks: rows } = await invokeTasks<{ tasks: Task[] }>({
          mode:          'by_engagement',
          engagementId: eng.id,
        })
        setTasks(rows)
      } catch (e) {
        error(e instanceof Error ? e.message : 'Failed to load tasks')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [urlId])

  async function transition(task: Task, next: TaskStatus) {
    setSaving(task.id)
    try {
      const { task: updated } = await invokeTasks<{ task: Task }>({
        mode: STATUS_MODE[next],
        id:   task.id,
      })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      success(`Marked ${STATUS_LABEL[next].toLowerCase()}`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to update task')
    } finally {
      setSaving(null)
    }
  }

  async function handleAdd() {
    if (!newTitle.trim() || !engagementId) return
    setSaving('new')
    try {
      const { task: created } = await invokeTasks<{ task: Task }>({
        mode:          'create',
        engagementId: engagementId,
        title:         newTitle.trim(),
        due_date:      newDueDate || null,
      })
      setTasks(prev => [...prev, created])
      setNewTitle('')
      setNewDueDate('')
      setAdding(false)
      success('Task added')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Failed to add task')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, padding: '40px 0' }}>
        Loading tasks…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
          Tasks ({tasks.length})
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              fontFamily: A.font, fontSize: 10, fontWeight: 600,
              color: A.gold, background: 'transparent',
              border: `1px solid ${A.gold}40`, borderRadius: 5,
              padding: '3px 10px', cursor: 'pointer',
            }}
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div style={{
          background: A.bgCard, border: `1px solid ${A.gold}30`,
          borderRadius: 8, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input
                style={{ ...inputStyle, width: '100%' }}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder='Task title'
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                style={{ ...inputStyle, width: 140 }}
                type='date'
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setAdding(false); setNewTitle(''); setNewDueDate('') }}
              style={{
                fontFamily: A.font, fontSize: 11, fontWeight: 600,
                color: A.faint, background: 'transparent',
                border: `1px solid ${A.border}`, borderRadius: 6,
                padding: '4px 12px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || saving === 'new'}
              style={{
                fontFamily: A.font, fontSize: 11, fontWeight: 600,
                color: A.bg, background: A.gold, border: 'none',
                borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
                opacity: !newTitle.trim() || saving === 'new' ? 0.5 : 1,
              }}
            >
              {saving === 'new' ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && !adding && (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: A.faint, fontFamily: A.font }}>
          No tasks yet.
        </div>
      )}

      {/* Task rows */}
      {tasks.map(task => {
        const status = task.status as TaskStatus
        const isSaving = saving === task.id
        const nextOptions = (['open', 'done', 'dismissed'] as TaskStatus[]).filter(s => s !== status)

        return (
          <div
            key={task.id}
            style={{
              background:   A.bg,
              border:       `1px solid ${task.is_overdue ? A.statusOverdueTint : A.border}`,
              borderLeft:   `3px solid ${STATUS_COLOR[status]}`,
              borderRadius: 8,
              padding:      '10px 12px',
              display:      'flex',
              alignItems:   'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Left: title + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, fontFamily: A.font,
                color:          status === 'dismissed' ? A.faint : A.text,
                textDecoration: status === 'done' ? 'line-through' : 'none',
                marginBottom: 4,
              }}>
                {task.title}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', fontFamily: A.font,
                  color: STATUS_COLOR[status],
                }}>
                  {STATUS_LABEL[status]}
                </span>
                {task.due_date && (
                  <span style={{ fontSize: 10, fontFamily: A.font, color: task.is_overdue ? A.statusOverdue : A.faint }}>
                    {task.is_overdue ? '⚠ ' : ''}Due {task.due_date}
                  </span>
                )}
                {task.completed_at && status !== 'open' && (
                  <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>
                    {task.completed_at.slice(0, 10)}
                  </span>
                )}
                {task.assignee_name && (
                  <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>
                    {task.assignee_name}
                  </span>
                )}
              </div>
              {task.note && (
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic', marginTop: 4 }}>
                  {task.note}
                </div>
              )}
            </div>

            {/* Right: status transition buttons */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {nextOptions.map(next => (
                <button
                  key={next}
                  onClick={() => transition(task, next)}
                  disabled={isSaving}
                  style={{
                    fontFamily: A.font, fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color:      STATUS_COLOR[next],
                    background: 'transparent',
                    border:     `1px solid ${STATUS_TINT[next]}`,
                    borderRadius: 5, padding: '3px 8px',
                    cursor:  isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.5 : 1,
                    transition: 'all 150ms ease',
                  }}
                >
                  {STATUS_LABEL[next]}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}