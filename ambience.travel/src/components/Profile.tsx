/* Profile.tsx
 * Tabbed account management page for ambience.travel programme product.
 * Two tabs:
 *   — Account:  display name, email change, password change, recent logins
 *   — Support:  submit tickets, view thread history, real-time admin replies
 *
 * No subscription tab — travel is invitation/admin-provisioned.
 * No self-serve delete — records belong to the operator. Account closure
 * is handled via a support ticket or direct contact.
 * Data export available at the bottom of the Account tab.
 */

import { useState, useEffect, useRef } from 'react'
import { C } from '../lib/theme'
import { supabase } from '../lib/supabase'
import {
  getProfile,
  getRecentLogins,
  backupUserData,
  createTicket,
  getUserTickets,
  getTicketMessages,
  addTicketMessage,
  closeTicket,
  type TravelProfile,
  type SupportTicket,
  type TicketMessage,
  type RecentLogin,
} from '../lib/queries'
import { useToast } from '../lib/ToastContext'

const DANGER = '#ef4444'

type Tab             = 'account' | 'support'
type Msg             = { type: 'ok' | 'err'; text: string }
type TicketStatus    = 'open' | 'in_progress' | 'resolved' | 'closed'
type TicketCategory  = 'general' | 'bug_report' | 'feature_request' | 'other'

const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general:         'General',
  bug_report:      'Bug Report',
  feature_request: 'Feature Request',
  other:           'Other',
}

function statusColor(status: TicketStatus): string {
  if (status === 'open')        return C.gold
  if (status === 'in_progress') return C.positive
  if (status === 'resolved')    return '#7FDEFF'
  return C.faint
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (ua.includes('Chrome'))  return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari'))  return 'Safari'
  if (ua.includes('Edge'))    return 'Edge'
  return 'Browser'
}

// ── Shared style factories — reactive to C.* on each render ──────────────────
function card():       React.CSSProperties { return { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px' } }
function btnPrimary(): React.CSSProperties { return { padding: '9px 22px', fontSize: 13, fontWeight: 700, background: C.positive, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" } }
function btnCancel():  React.CSSProperties { return { padding: '9px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" } }

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: C.muted,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  marginBottom: 6, display: 'block',
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '9px 12px', fontSize: 13,
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    boxSizing: 'border-box',
  }
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 16 }}>
      {text}
    </div>
  )
}

function CurrentEmail() {
  const [email, setEmail] = useState('…')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user?.email) setEmail(data.user.email) })
  }, [])
  return <>{email}</>
}

// ── SupportTab ────────────────────────────────────────────────────────────────
function SupportTab({ userId, displayName }: { userId: string; displayName: string }) {
  const { toast } = useToast()
  const font = "'Plus Jakarta Sans', sans-serif"
  const mono = "'DM Mono', monospace"

  const [tickets,     setTickets]     = useState<SupportTicket[]>([])
  const [ticketsLoad, setTicketsLoad] = useState(true)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const ticketsRef = useRef<SupportTicket[]>([])

  const [messages,   setMessages]   = useState<TicketMessage[]>([])
  const [threadLoad, setThreadLoad] = useState(false)
  const [replyBody,  setReplyBody]  = useState('')
  const [replyBusy,  setReplyBusy]  = useState(false)

  const [showForm,    setShowForm]    = useState(false)
  const [formCat,     setFormCat]     = useState<TicketCategory>('general')
  const [formSubject, setFormSubject] = useState('')
  const [formBody,    setFormBody]    = useState('')
  const [formBusy,    setFormBusy]    = useState(false)

  useEffect(() => { ticketsRef.current = tickets }, [tickets])

  useEffect(() => {
    if (!userId) return
    getUserTickets()
      .then(data => setTickets(data))
      .catch(() => toast.error('Failed to load tickets.'))
      .finally(() => setTicketsLoad(false))
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const ticketChannel = supabase
      .channel(`travel-tickets-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` }, payload => {
        const updated = payload.new as SupportTicket
        setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
        toast.info(`Ticket status updated: ${STATUS_LABELS[updated.status as TicketStatus]}`)
      })
      .subscribe()

    const msgChannel = supabase
      .channel(`travel-messages-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, payload => {
        const msg = payload.new as any
        if (msg.author_id === userId) return
        if (!ticketsRef.current.some(t => t.id === msg.ticket_id)) return
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev, { ...msg, isAdminReply: true } as TicketMessage]
        })
        toast.info('Support replied to your ticket.')
      })
      .subscribe()

    return () => { supabase.removeChannel(ticketChannel); supabase.removeChannel(msgChannel) }
  }, [userId])

  async function handleExpand(ticket: SupportTicket) {
    if (expandedId === ticket.id) { setExpandedId(null); setMessages([]); setReplyBody(''); return }
    setExpandedId(ticket.id); setThreadLoad(true); setMessages([]); setReplyBody('')
    try { setMessages(await getTicketMessages(ticket.id)) }
    catch { toast.error('Failed to load thread.') }
    finally { setThreadLoad(false) }
  }

  async function handleReply(ticket: SupportTicket) {
    if (!replyBody.trim()) return
    setReplyBusy(true)
    try {
      await addTicketMessage(ticket.id, replyBody.trim())
      setMessages(prev => [...prev, { id: crypto.randomUUID(), ticketId: ticket.id, authorId: userId, body: replyBody.trim(), isAdminReply: false, createdAt: new Date().toISOString() }])
      setReplyBody('')
    } catch { toast.error('Failed to send reply.') }
    finally { setReplyBusy(false) }
  }

  async function handleSubmitTicket() {
    if (!formSubject.trim() || !formBody.trim()) return
    setFormBusy(true)
    try {
      const ticket = await createTicket({ category: formCat, subject: formSubject.trim(), body: formBody.trim() })
      setTickets(prev => [ticket, ...prev])
      setFormSubject(''); setFormBody(''); setFormCat('general'); setShowForm(false)
      toast.success('Support ticket submitted.')
    } catch { toast.error('Failed to submit ticket.') }
    finally { setFormBusy(false) }
  }

  async function handleCloseTicket(ticketId: string) {
    try {
      await closeTicket(ticketId)
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed' as const } : t))
      setExpandedId(null); setMessages([])
    } catch { toast.error('Failed to close ticket.') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={card()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showForm ? 20 : 0 }}>
          <SectionLabel text='Submit a Ticket' />
          {!showForm && <button onClick={() => setShowForm(true)} style={{ ...btnPrimary(), padding: '7px 18px', fontSize: 12 }}>New Ticket</button>}
        </div>

        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: font, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Category</div>
              <select value={formCat} onChange={e => setFormCat(e.target.value as TicketCategory)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: mono, cursor: 'pointer', outline: 'none', minWidth: 160 }}>
                {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map(k => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: font, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Subject</div>
              <input type='text' value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder='Brief summary' style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: font, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: font, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Description</div>
              <textarea value={formBody} onChange={e => setFormBody(e.target.value)} placeholder='Describe your issue in detail' rows={5} style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: font, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmitTicket} disabled={formBusy || !formSubject.trim() || !formBody.trim()} style={{ ...btnPrimary(), opacity: formBusy || !formSubject.trim() || !formBody.trim() ? 0.5 : 1 }}>
                {formBusy ? 'Submitting…' : 'Submit Ticket'}
              </button>
              <button onClick={() => { setShowForm(false); setFormSubject(''); setFormBody('') }} style={btnCancel()}>Cancel</button>
            </div>
          </div>
        )}

        {!showForm && <div style={{ fontSize: 13, color: C.muted, fontFamily: font, lineHeight: 1.6 }}>Have a question or issue? Submit a ticket and we'll get back to you.</div>}
      </div>

      <div style={card()}>
        <SectionLabel text='Your Tickets' />
        {ticketsLoad && <div style={{ fontSize: 13, color: C.faint, fontFamily: font }}>Loading…</div>}
        {!ticketsLoad && tickets.length === 0 && <div style={{ fontSize: 13, color: C.faint, fontFamily: font }}>No tickets submitted yet.</div>}

        {!ticketsLoad && tickets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tickets.map((ticket, i) => {
              const isExpanded = expandedId === ticket.id
              const sColor     = statusColor(ticket.status as TicketStatus)
              const isLast     = i === tickets.length - 1

              return (
                <div key={ticket.id} style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border}` }}>
                  <button onClick={() => handleExpand(ticket)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sColor, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: font }}>{ticket.subject}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: sColor, background: `${sColor}18`, border: `1px solid ${sColor}40`, borderRadius: 4, padding: '1px 6px', fontFamily: font, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{STATUS_LABELS[ticket.status as TicketStatus]}</span>
                        <span style={{ fontSize: 10, color: C.faint, background: `${C.faint}18`, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', fontFamily: font, flexShrink: 0 }}>{CATEGORY_LABELS[ticket.category as TicketCategory] ?? ticket.category}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.faint, fontFamily: mono }}>{new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div style={{ fontSize: 13, color: C.faint, flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingBottom: 16, paddingLeft: 20 }}>
                      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: C.faint, fontFamily: font, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Your message</div>
                        <div style={{ fontSize: 13, color: C.text, fontFamily: font, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ticket.body}</div>
                      </div>

                      {threadLoad && <div style={{ fontSize: 12, color: C.faint, fontFamily: font, marginBottom: 10 }}>Loading thread…</div>}

                      {!threadLoad && messages.map(msg => {
                        const isUser = !msg.isAdminReply
                        return (
                          <div key={msg.id} style={{ background: isUser ? `${C.gold}10` : `rgba(127,222,255,0.08)`, border: `1px solid ${isUser ? `${C.gold}25` : `rgba(127,222,255,0.20)`}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: isUser ? C.gold : '#7FDEFF', fontFamily: font, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{isUser ? displayName : 'ambience'}</span>
                              <span style={{ fontSize: 10, color: C.faint, fontFamily: mono }}>{new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <div style={{ fontSize: 13, color: C.text, fontFamily: font, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                          </div>
                        )
                      })}

                      {(ticket.status === 'open' || ticket.status === 'in_progress') && !threadLoad && (
                        <div style={{ marginTop: 10 }}>
                          <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder='Add a reply…' rows={3} style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: font, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, marginBottom: 8 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleReply(ticket)} disabled={replyBusy || !replyBody.trim()} style={{ ...btnPrimary(), fontSize: 12, padding: '7px 18px', opacity: replyBusy || !replyBody.trim() ? 0.5 : 1 }}>{replyBusy ? 'Sending…' : 'Send Reply'}</button>
                            <button onClick={() => handleCloseTicket(ticket.id)} style={{ ...btnCancel(), fontSize: 12, padding: '6px 14px' }}>Close Ticket</button>
                          </div>
                        </div>
                      )}

                      {ticket.status === 'resolved' && !threadLoad && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 12, color: C.muted, fontFamily: font }}>Issue resolved? Close this ticket or it will auto-close in 7 days.</div>
                          <button onClick={() => handleCloseTicket(ticket.id)} style={{ ...btnCancel(), fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}>Close Ticket</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Profile() {
  const { toast } = useToast()

  const [profile,      setProfile]      = useState<TravelProfile | null>(null)
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>([])
  const [tab,          setTab]          = useState<Tab>('account')
  const tabBarRef  = useRef<HTMLDivElement>(null)
  const [underline, setUnderline] = useState({ left: 0, width: 0 })

  const TAB_ITEMS: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'support', label: 'Support' },
  ]

  useEffect(() => {
    getProfile().then(p => setProfile(p)).catch(console.error)
    getRecentLogins().then(l => setRecentLogins(l)).catch(console.error)
  }, [])

  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    const activeBtn = bar.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)
    if (activeBtn) setUnderline({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
  }, [tab])

  const displayName = profile?.displayName ?? profile?.email?.split('@')[0] ?? '—'

  // ── Email change ──────────────────────────────────────────────────────────
  const [editEmail, setEditEmail] = useState(false)
  const [email,     setEmail]     = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMsg,  setEmailMsg]  = useState<Msg | null>(null)

  async function saveEmail() {
    setEmailBusy(true); setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email })
    setEmailBusy(false)
    if (error) { setEmailMsg({ type: 'err', text: error.message }); return }
    setEmailMsg({ type: 'ok', text: 'Confirmation sent to new address. Check your inbox.' })
    setEditEmail(false)
  }
  function cancelEmail() { setEditEmail(false); setEmail(''); setEmailMsg(null) }

  // ── Password change ───────────────────────────────────────────────────────
  const [editPw,    setEditPw]    = useState(false)
  const [pw,        setPw]        = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwBusy,    setPwBusy]    = useState(false)
  const [pwMsg,     setPwMsg]     = useState<Msg | null>(null)

  async function savePassword() {
    if (pw.length < 11)   { setPwMsg({ type: 'err', text: 'Password must be at least 11 characters.' }); return }
    if (pw !== pwConfirm) { setPwMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    setPwBusy(true); setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) { setPwMsg({ type: 'err', text: error.message }); return }
    setPwMsg({ type: 'ok', text: 'Password updated successfully.' })
    setPw(''); setPwConfirm(''); setEditPw(false)
  }
  function cancelPw() { setEditPw(false); setPw(''); setPwConfirm(''); setPwMsg(null) }

  // ── Backup ────────────────────────────────────────────────────────────────
  const [backupStatus, setBackupStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [backupErrMsg, setBackupErrMsg] = useState('')

  async function handleDownloadBackup() {
    setBackupStatus('busy'); setBackupErrMsg('')
    try {
      const data = await backupUserData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const now  = new Date()
      const pad  = (n: number) => String(n).padStart(2, '0')
      const slug = displayName.toLowerCase().replace(/\s+/g, '-')
      a.download = `ambience.travel-${slug}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
      a.click(); URL.revokeObjectURL(url)
      setBackupStatus('done')
    } catch (err) {
      setBackupStatus('error')
      setBackupErrMsg(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  return (
    <div style={{ maxWidth: 600, width: '100%', boxSizing: 'border-box' }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>Account</div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4 }}>Manage your profile and contact support</div>
      </div>

      {/* Tab bar */}
      <div ref={tabBarRef} style={{ position: 'relative', display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 28 }}>
        {TAB_ITEMS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} data-tab={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500, background: 'none', border: 'none', cursor: 'pointer', color: active ? C.text : C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'color 0.2s' }}>
              {t.label}
            </button>
          )
        })}
        <div style={{ position: 'absolute', bottom: 0, height: 2, background: C.gold, borderRadius: 2, left: underline.left, width: underline.width, transition: 'left 0.25s cubic-bezier(0.16,1,0.3,1), width 0.25s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>

      {/* ── Account tab ── */}
      {tab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Identity */}
          <div style={card()}>
            <SectionLabel text='Profile' />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${C.gold}, #8A9A8A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#171917', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{displayName}</div>
                {profile?.isAdmin && (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.gold, background: `${C.gold}18`, border: `1px solid ${C.gold}30`, borderRadius: 999, padding: '2px 9px', fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 4, display: 'inline-block' }}>
                    ⚡ Admin
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16, padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Display name is set at sign-up. Contact your travel adviser to update it.</span>
            </div>
          </div>

          {/* Email */}
          <div style={card()}>
            <SectionLabel text='Email' />
            {!editEmail ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 14, color: C.text, fontFamily: "'DM Mono', monospace" }}><CurrentEmail /></div>
                <button onClick={() => { setEditEmail(true); setEmailMsg(null) }} style={btnCancel()}>Change</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>New Email Address</label>
                  <input type='email' value={email} onChange={e => setEmail(e.target.value)} style={inputStyle()} placeholder='new@email.com' onKeyDown={e => { if (e.key === 'Enter') saveEmail() }} />
                </div>
                {emailMsg && <div style={{ fontSize: 12, color: emailMsg.type === 'ok' ? C.positive : C.negative, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{emailMsg.text}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEmail} disabled={emailBusy || !email} style={{ ...btnPrimary(), opacity: emailBusy || !email ? 0.6 : 1 }}>{emailBusy ? 'Sending…' : 'Send Confirmation'}</button>
                  <button onClick={cancelEmail} style={btnCancel()}>Cancel</button>
                </div>
              </div>
            )}
            {emailMsg && !editEmail && <div style={{ marginTop: 12, fontSize: 12, color: emailMsg.type === 'ok' ? C.positive : C.negative, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{emailMsg.text}</div>}
          </div>

          {/* Password */}
          <div style={card()}>
            <SectionLabel text='Password' />
            {!editPw ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, color: C.muted, fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>••••••••••••</div>
                <button onClick={() => { setEditPw(true); setPwMsg(null) }} style={btnCancel()}>Change</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input type='password' value={pw} onChange={e => setPw(e.target.value)} style={inputStyle()} placeholder='Min. 11 characters' />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type='password' value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} style={inputStyle()} placeholder='Repeat new password' onKeyDown={e => { if (e.key === 'Enter') savePassword() }} />
                </div>
                {pwMsg && <div style={{ fontSize: 12, color: pwMsg.type === 'ok' ? C.positive : C.negative, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{pwMsg.text}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={savePassword} disabled={pwBusy || !pw} style={{ ...btnPrimary(), opacity: pwBusy || !pw ? 0.6 : 1 }}>{pwBusy ? 'Saving…' : 'Update Password'}</button>
                  <button onClick={cancelPw} style={btnCancel()}>Cancel</button>
                </div>
              </div>
            )}
            {pwMsg && !editPw && <div style={{ marginTop: 12, fontSize: 12, color: pwMsg.type === 'ok' ? C.positive : C.negative, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{pwMsg.text}</div>}
          </div>

          {/* Recent logins */}
          <div style={card()}>
            <SectionLabel text='Recent Logins' />
            {recentLogins.length === 0 ? (
              <div style={{ fontSize: 13, color: C.faint, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No previous logins on record.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recentLogins.map((login, i) => (
                  <div key={login.id} style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: i > 0 ? 16 : 0, borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>{i === 0 ? 'Current Session' : 'Previous Session'}</div>
                      <div style={{ fontSize: 13, color: C.text, fontFamily: "'DM Mono', monospace" }}>{new Date(login.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                    </div>
                    {login.userAgent && (
                      <div>
                        <div style={{ fontSize: 10, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>Browser</div>
                        <div style={{ fontSize: 13, color: C.text, fontFamily: "'DM Mono', monospace" }}>{parseUserAgent(login.userAgent)}</div>
                      </div>
                    )}
                    {(login.city || login.country) && (
                      <div>
                        <div style={{ fontSize: 10, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>Location</div>
                        <div style={{ fontSize: 13, color: C.text, fontFamily: "'DM Mono', monospace" }}>{[login.city, login.country].filter(Boolean).join(', ')}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data export */}
          <div style={card()}>
            <SectionLabel text='Data Export' />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.6 }}>
                Download a copy of your profile and support ticket history as a JSON file.
              </div>
              <button
                onClick={handleDownloadBackup}
                disabled={backupStatus === 'busy'}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: backupStatus === 'done' ? `${C.positive}15` : 'transparent', border: `1px solid ${backupStatus === 'done' ? `${C.positive}55` : backupStatus === 'error' ? `${DANGER}55` : C.border}`, borderRadius: 8, color: backupStatus === 'done' ? C.positive : backupStatus === 'error' ? DANGER : C.text, cursor: backupStatus === 'busy' ? 'wait' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0, opacity: backupStatus === 'busy' ? 0.6 : 1, transition: 'all 0.2s' }}
              >
                {backupStatus === 'busy' ? 'Exporting…' : backupStatus === 'done' ? '✓ Downloaded' : '⬇ Export My Data'}
              </button>
            </div>
            {backupErrMsg && <div style={{ marginTop: 10, fontSize: 12, color: DANGER, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{backupErrMsg}</div>}
          </div>

          {/* Account closure */}
          <div style={{ ...card(), border: `1px solid ${C.border}` }}>
            <SectionLabel text='Close Account' />
            <div style={{ fontSize: 13, color: C.muted, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.7, marginBottom: 16 }}>
              To close your account, please contact your travel adviser directly or submit a support ticket. We'll take care of it promptly.
            </div>
            <button
              onClick={() => setTab('support')}
              style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.text; (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderGold }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
            >
              Open a support ticket →
            </button>
          </div>

        </div>
      )}

      {/* ── Support tab ── */}
      {tab === 'support' && (
        <SupportTab userId={profile?.id ?? ''} displayName={displayName} />
      )}

    </div>
  )
}