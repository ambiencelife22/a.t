// FinancialTab.tsx — Financial Module v1 for ambience.TRAVEL admin.
//
// Two surfaces:
//   Pipeline   (#admin/finance)                   — all confirmed trips, financial overview
//   Engagement (#admin/finance/engagement/<id>)   — drill-in: full booking economics + expenses
//
// Last updated: S53G v2 — engagement view now uses by_engagement_full mode,
//   showing per-booking rate/commission/nights breakdown + expenses.

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { navigateAdmin } from '../../utils/utilsAdminPath'
import { useAdminToast } from './_adminPrimitives'
import {
  fetchPipeline,
  fetchEngagementFull,
  createExpense,
  deleteExpense,
  markBilled,
  markPaid,
  writeOff,
  type PipelineTrip,
  type Expense,
  type EngagementFull,
  type BillingStatus,
  type CreateExpensePayload,
} from '../../queries/queriesAdminFinance'

// ── Formatters ────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function usdDec(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(m[3])} ${MONTHS[parseInt(m[2])-1]} ${m[1]}`
}

function marginColor(n: number): string {
  if (n > 0)  return '#4ade80'
  if (n < 0)  return '#ef4444'
  return A.muted
}

function pct(n: number | null): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_META: Record<BillingStatus, { label: string; color: string }> = {
  absorbed:    { label: 'Absorbed',    color: A.muted   },
  billable:    { label: 'Billable',    color: '#93C5FD' },
  billed:      { label: 'Billed',      color: '#FBBF24' },
  paid:        { label: 'Paid',        color: '#4ade80' },
  written_off: { label: 'Written off', color: A.faint   },
}

function StatusPill({ status }: { status: BillingStatus }) {
  const meta = STATUS_META[status] ?? { label: status, color: A.faint }
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: 100,
      border: `1px solid ${meta.color}50`, color: meta.color,
      background: `${meta.color}14`, fontFamily: A.font, whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, small }: { label: string; value: string; sub?: string; color?: string; small?: boolean }) {
  return (
    <div style={{
      background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12,
      padding: small ? '12px 16px' : '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, color: color ?? A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{sub}</div>}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>{eyebrow ?? 'Finance'}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{title}</div>
      </div>
      {action}
    </div>
  )
}

// ── Button primitives ─────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'rgba(216,181,106,0.12)', color: A.gold,
  border: `1px solid rgba(216,181,106,0.30)`, borderRadius: 10,
  fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer', letterSpacing: '0.04em',
}
const btnGhost: React.CSSProperties = {
  padding: '7px 16px', background: 'transparent', color: A.muted,
  border: `1px solid ${A.border}`, borderRadius: 10,
  fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: '#ef4444',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
  fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: A.bgInput, border: `1px solid ${A.border}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text,
  fontFamily: A.font, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: A.faint, fontFamily: A.font, marginBottom: 6, display: 'block',
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────

const EXPENSE_TYPES = ['Amenity','Dining','Entertainment','Gifting','Ground Transport','Hospitality','Research','Telephone','Travel','Other']

function AddExpenseModal({ engagementId, onClose, onCreated }: { engagementId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ expense_type: 'Other', description: '', total_amount: '', currency: 'USD', billing_status: 'absorbed' as BillingStatus, notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  async function handleSave() {
    if (!form.description.trim()) { setErr('Description is required.'); return }
    const amt = parseFloat(form.total_amount)
    if (isNaN(amt) || amt < 0) { setErr('Valid amount is required.'); return }
    setSaving(true); setErr(null)
    try {
      await createExpense({ engagement_id: engagementId, expense_type: form.expense_type, description: form.description.trim(), total_amount: amt, currency: form.currency.trim().toUpperCase() || 'USD', billing_status: form.billing_status, notes: form.notes.trim() || null } as CreateExpensePayload)
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to create expense') }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: A.bgCard, border: `1px solid rgba(216,181,106,0.25)`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>New Expense</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font }}>Add Expense</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label='Type'><select style={inputStyle} value={form.expense_type} onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}>{EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label='Billing Status'><select style={inputStyle} value={form.billing_status} onChange={e => setForm(f => ({ ...f, billing_status: e.target.value as BillingStatus }))}><option value='absorbed'>Absorbed</option><option value='billable'>Billable</option></select></Field>
          <Field label='Amount'><input style={inputStyle} type='number' min='0' step='0.01' value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder='0.00' /></Field>
          <Field label='Currency'><input style={inputStyle} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder='USD' /></Field>
        </div>
        <Field label='Description'><input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder='Brief description' /></Field>
        <Field label='Notes'><textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.6 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder='Optional internal notes' /></Field>
        {err && <div style={{ fontSize: 12, color: '#ef4444', fontFamily: A.font }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${A.border}` }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Add Expense'}</button>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Booking row ───────────────────────────────────────────────────────────────

type BookingRow = {
  id: string; name: string; booking_type: string | null
  start_date: string | null; end_date: string | null; nights: number | null; currency: string | null
  total_rate: number | null; total_rate_usd: number | null
  commissionable_rate: number | null; commissionable_rate_usd: number | null
  commission_pct: number | null; commission_amount: number | null; commission_amount_usd: number | null
  commission_paid_at: string | null
  net_revenue: number | null; net_revenue_usd: number | null
  taxes_and_fees: number | null; taxes_and_fees_usd: number | null
  referral_share_amt: number | null; iata_share_amt: number | null; individual_share_amt: number | null
  deposit_amount: number | null; deposit_due_date: string | null; deposit_paid_at: string | null
  balance_amount: number | null; balance_due_date: string | null; balance_paid_at: string | null
  invoice_number: string | null; rate_type: string | null; sort_order: number
  cost: number | null
}

function BookingFinancialRow({ booking }: { booking: BookingRow }) {
  const [expanded, setExpanded] = useState(false)
  const commAmt = booking.commission_amount_usd ?? booking.commission_amount ?? 0
  const totalRate = booking.total_rate_usd ?? booking.total_rate ?? 0
  const isMultiCurrency = booking.currency && booking.currency !== 'USD'
  const commReceived = !!booking.commission_paid_at

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: A.text, fontFamily: A.font }}>{booking.name}</span>
            {booking.booking_type && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>{booking.booking_type.replace(/_/g, ' ')}</span>
            )}
            {commReceived ? (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ade80', fontFamily: A.font, border: '1px solid rgba(74,222,128,0.3)', borderRadius: 100, padding: '2px 8px' }}>Comm. Received</span>
            ) : commAmt > 0 ? (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FBBF24', fontFamily: A.font, border: '1px solid rgba(251,191,36,0.3)', borderRadius: 100, padding: '2px 8px' }}>Comm. Outstanding</span>
            ) : null}
          </div>
          <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
            {[fmtDate(booking.start_date), fmtDate(booking.end_date)].filter(Boolean).join(' – ')}
            {booking.nights ? ` · ${booking.nights} nights` : ''}
            {isMultiCurrency ? ` · ${booking.currency}` : ''}
          </div>
          {booking.invoice_number && (
            <div style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Inv. {booking.invoice_number}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{usd(totalRate)}</div>
          {commAmt > 0 && (
            <div style={{ fontSize: 12, color: commReceived ? '#4ade80' : '#FBBF24', fontFamily: A.font }}>
              {usd(commAmt)} comm{booking.commission_pct ? ` (${pct(booking.commission_pct)})` : ''}
            </div>
          )}
          {booking.cost && booking.cost > 0 ? (
            <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{usd(booking.cost)} amenity</div>
          ) : null}
          <button
            onClick={() => setExpanded(o => !o)}
            style={{ background: 'none', border: 'none', color: A.faint, fontSize: 10, fontFamily: A.font, cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}
          >
            {expanded ? '▲ Less' : '▼ Details'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
          {[
            { label: 'Total Rate', value: booking.total_rate_usd != null ? usdDec(booking.total_rate_usd) : booking.total_rate != null ? usdDec(booking.total_rate) : '—' },
            { label: 'Commissionable Rate', value: booking.commissionable_rate_usd != null ? usdDec(booking.commissionable_rate_usd) : booking.commissionable_rate != null ? usdDec(booking.commissionable_rate) : '—' },
            { label: 'Taxes & Fees', value: booking.taxes_and_fees_usd != null ? usdDec(booking.taxes_and_fees_usd) : booking.taxes_and_fees != null ? usdDec(booking.taxes_and_fees) : '—' },
            { label: 'Commission', value: booking.commission_amount_usd != null ? usdDec(booking.commission_amount_usd) : booking.commission_amount != null ? usdDec(booking.commission_amount) : '—' },
            { label: 'Net Revenue', value: booking.net_revenue_usd != null ? usdDec(booking.net_revenue_usd) : booking.net_revenue != null ? usdDec(booking.net_revenue) : '—' },
            { label: 'Rate Type', value: booking.rate_type ?? '—' },
            { label: 'Deposit', value: booking.deposit_amount ? `${usd(booking.deposit_amount)}${booking.deposit_paid_at ? ' ✓' : booking.deposit_due_date ? ` due ${fmtDate(booking.deposit_due_date)}` : ''}` : '—' },
            { label: 'Balance', value: booking.balance_amount ? `${usd(booking.balance_amount)}${booking.balance_paid_at ? ' ✓' : booking.balance_due_date ? ` due ${fmtDate(booking.balance_due_date)}` : ''}` : '—' },
            { label: 'Comm. Received', value: booking.commission_paid_at ? fmtDate(booking.commission_paid_at) : 'Pending' },
            ...(booking.referral_share_amt ? [{ label: 'Referral Share', value: usd(booking.referral_share_amt) }] : []),
            ...(booking.iata_share_amt ? [{ label: 'IATA Share', value: usd(booking.iata_share_amt) }] : []),
            ...(booking.individual_share_amt ? [{ label: 'Individual Share', value: usd(booking.individual_share_amt) }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Expense row ───────────────────────────────────────────────────────────────

function ExpenseRow({ expense, onAction }: { expense: Expense; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [acting,   setActing]   = useState(false)
  const toast = useAdminToast()

  async function handleLifecycle(fn: () => Promise<unknown>, label: string) {
    setActing(true)
    try { await fn(); toast.success(`${label}.`); onAction() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setActing(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    setActing(true)
    try { await deleteExpense(expense.id); toast.success('Expense deleted.'); onAction() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to delete') }
    setActing(false)
  }

  const canDelete = expense.billing_status !== 'billed'
  const isFx = expense.currency !== 'USD'

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>{expense.expense_type}</span>
            <StatusPill status={expense.billing_status} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: A.text, fontFamily: A.font, marginBottom: 3 }}>{expense.description}</div>
          {expense.notes && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, fontStyle: 'italic' }}>{expense.notes}</div>}
          {expense.items.length > 0 && (
            <button onClick={() => setExpanded(o => !o)} style={{ marginTop: 6, background: 'none', border: 'none', color: A.muted, fontSize: 11, fontFamily: A.font, cursor: 'pointer', padding: 0 }}>
              {expanded ? '▲' : '▼'} {expense.items.length} line item{expense.items.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{usd(expense.total_amount)}</div>
          {isFx && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{expense.currency}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {expense.billing_status === 'billable' && <button disabled={acting} onClick={() => handleLifecycle(() => markBilled(expense.id), 'Marked as billed')} style={{ ...btnGhost, fontSize: 11, padding: '5px 10px', color: '#FBBF24', borderColor: 'rgba(251,191,36,0.3)' }}>Mark Billed</button>}
            {expense.billing_status === 'billed'   && <button disabled={acting} onClick={() => handleLifecycle(() => markPaid(expense.id),   'Marked as paid')} style={{ ...btnGhost, fontSize: 11, padding: '5px 10px', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>Mark Paid</button>}
            {(expense.billing_status === 'billable' || expense.billing_status === 'billed') && <button disabled={acting} onClick={() => handleLifecycle(() => writeOff(expense.id), 'Written off')} style={{ ...btnGhost, fontSize: 11, padding: '5px 10px' }}>Write Off</button>}
            {canDelete && <button disabled={acting} onClick={handleDelete} style={{ ...btnDanger, padding: '5px 10px' }}>Delete</button>}
          </div>
        </div>
      </div>
      {expanded && expense.items.length > 0 && (
        <div style={{ borderTop: `1px solid ${A.border}` }}>
          {expense.items.slice().sort((a, b) => a.sort_order - b.sort_order).map((item, i) => (
            <div key={item.id} style={{ padding: '10px 18px 10px 34px', borderTop: i > 0 ? `1px solid ${A.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{item.description}</div>
                <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{item.item_type}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{usd(item.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Engagement view ───────────────────────────────────────────────────────────

export function EngagementFinanceView({ engagementId }: { engagementId: string }) {
  const [data,    setData]    = useState<EngagementFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useAdminToast()

  async function load() {
    setLoading(true)
    try { setData(await fetchEngagementFull(engagementId)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load financials') }
    setLoading(false)
  }

  useEffect(() => { load() }, [engagementId])

  const margin    = data?.summary.net_margin ?? 0
  const bookings  = data?.bookings ?? []
  const expenses  = data?.expenses ?? []
  const summary   = data?.summary
  const title     = data?.engagement.title ?? 'Engagement Financials'

  const grouped: Record<BillingStatus, Expense[]> = { absorbed: [], billable: [], billed: [], paid: [], written_off: [] }
  for (const exp of expenses) { grouped[exp.billing_status]?.push(exp) }
  const ORDER: BillingStatus[] = ['billable', 'billed', 'absorbed', 'paid', 'written_off']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {showAdd && <AddExpenseModal engagementId={engagementId} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}

      <button onClick={() => navigateAdmin({ product: 'finance', tab: 'pipeline' })} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 12, fontFamily: A.font, cursor: 'pointer', padding: 0, alignSelf: 'flex-start' }}>
        ← Pipeline
      </button>

      <SectionHeader
        title={title}
        eyebrow='Finance'
        action={<button onClick={() => setShowAdd(true)} style={btnPrimary}>+ Add Expense</button>}
      />

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {!loading && summary && (
        <>
          {/* ── Margin banner ── */}
          <div style={{
            background: A.bgCard, borderRadius: 14,
            border: `1px solid ${margin >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
            padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>Net Margin</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: marginColor(margin), fontFamily: A.font, letterSpacing: '-0.03em' }}>{margin >= 0 ? '+' : ''}{usd(margin)}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, flex: 1, minWidth: 300 }}>
              <MetricCard label='Total Rate' value={usd(summary.total_rate)} small />
              <MetricCard label='Commission' value={usd(summary.total_commission)} sub={`${usd(summary.commission_received)} received`} small />
              {summary.commission_outstanding > 0 && <MetricCard label='Comm. Outstanding' value={usd(summary.commission_outstanding)} color='#FBBF24' small />}
              {summary.total_amenities > 0 && <MetricCard label='Amenities' value={usd(summary.total_amenities)} small />}
              <MetricCard label='Absorbed' value={usd(summary.total_absorbed)} color={summary.total_absorbed > 0 ? '#ef4444' : A.text} small />
              {summary.total_billable > 0 && <MetricCard label='Billable' value={usd(summary.total_billable)} color='#93C5FD' small />}
              {summary.total_outstanding > 0 && <MetricCard label='Outstanding' value={usd(summary.total_outstanding)} color='#FBBF24' small />}
            </div>
          </div>

          {/* ── Bookings ── */}
          {bookings.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
                Bookings · {bookings.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookings.map(b => <BookingFinancialRow key={b.id as string} booking={b as BookingRow} />)}
              </div>
            </div>
          )}

          {/* ── Expenses ── */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
              Expenses{expenses.length > 0 ? ` · ${expenses.length}` : ''}
            </div>
            {expenses.length === 0 && (
              <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>No expenses recorded for this engagement.</div>
            )}
            {ORDER.map(status => {
              const group = grouped[status]
              if (group.length === 0) return null
              const meta = STATUS_META[status]
              return (
                <div key={status} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: meta.color, fontFamily: A.font, marginBottom: 8 }}>
                    {meta.label} · {group.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.map(exp => <ExpenseRow key={exp.id} expense={exp} onAction={load} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Pipeline view ─────────────────────────────────────────────────────────────

export function FinancialPipelineView() {
  const [trips,   setTrips]   = useState<PipelineTrip[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useAdminToast()

  useEffect(() => {
    fetchPipeline()
      .then(setTrips)
      .catch(e => toast.error(e instanceof Error ? e.message : 'Failed to load pipeline'))
      .finally(() => setLoading(false))
  }, [])

  const totalCommission = trips.reduce((s, t) => s + t.total_commission, 0)
  const totalReceived   = trips.reduce((s, t) => s + t.commission_received, 0)
  const totalAbsorbed   = trips.reduce((s, t) => s + t.total_absorbed, 0)
  const totalMargin     = trips.reduce((s, t) => s + t.net_margin, 0)
  const totalRate       = trips.reduce((s, t) => s + (t.total_rate ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title='Financial Pipeline' />

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {!loading && (
        <>
          {trips.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              <MetricCard label='Total Trip Value' value={usd(totalRate)} />
              <MetricCard label='Total Commission' value={usd(totalCommission)} sub={`${usd(totalReceived)} received`} />
              <MetricCard label='Total Absorbed'   value={usd(totalAbsorbed)} color={totalAbsorbed > 0 ? '#ef4444' : A.text} />
              <MetricCard label='Net Margin'        value={usd(totalMargin)} color={marginColor(totalMargin)} />
              <MetricCard label='Active Trips'      value={String(trips.length)} />
            </div>
          )}

          {trips.length === 0 && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>No confirmed trips in the pipeline.</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${A.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 90px 90px 100px', padding: '10px 20px', background: A.bgCard, borderBottom: `1px solid ${A.border}` }}>
              {['Trip', 'Value', 'Comm.', 'Received', 'Absorbed', 'Billable', 'Net Margin'].map(h => (
                <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, textAlign: h === 'Trip' ? 'left' : 'right' }}>{h}</div>
              ))}
            </div>
            {trips.map((trip, i) => (
              <button
                key={trip.engagement_id}
                onClick={() => navigateAdmin({ product: 'finance', tab: 'engagement', engagementId: trip.engagement_id })}
                style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 90px 90px 100px', padding: '14px 20px', background: i % 2 === 0 ? A.bg : A.bgCard, border: 'none', borderBottom: i < trips.length - 1 ? `1px solid ${A.border}` : 'none', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 120ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(216,181,106,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? A.bg : A.bgCard)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font, marginBottom: 2 }}>{trip.title ?? trip.url_id}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {trip.trip_code && <span style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>{trip.trip_code}</span>}
                    {trip.start_date && <span style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{fmtDate(trip.start_date)}{trip.end_date ? ` – ${fmtDate(trip.end_date)}` : ''}</span>}
                    {trip.status_slug && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>{trip.status_slug.replace(/_/g, ' ')}</span>}
                  </div>
                </div>
                {[
                  { value: trip.total_rate ?? 0,          color: A.text },
                  { value: trip.total_commission,          color: A.text },
                  { value: trip.commission_received,       color: '#4ade80' },
                  { value: trip.total_absorbed,            color: trip.total_absorbed > 0 ? '#ef4444' : A.text },
                  { value: trip.total_billable,            color: trip.total_billable > 0 ? '#93C5FD' : A.faint },
                  { value: trip.net_margin,                color: marginColor(trip.net_margin) },
                ].map((col, ci) => (
                  <div key={ci} style={{ fontSize: 13, fontWeight: 700, color: col.color, fontFamily: A.font, textAlign: 'right' }}>
                    {col.value !== 0 ? usd(col.value) : <span style={{ color: A.faint }}>—</span>}
                  </div>
                ))}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Default export ────────────────────────────────────────────────────────────

export default function FinancialTab({ engagementId }: { engagementId?: string }) {
  if (engagementId) return <EngagementFinanceView engagementId={engagementId} />
  return <FinancialPipelineView />
}