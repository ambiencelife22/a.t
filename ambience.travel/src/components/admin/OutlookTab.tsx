// OutlookTab.tsx — Financial outlook for a trip engagement.
// Replaces FinancialTab (engagement-scoped, read-only bookings) and
// OperationsTab (cross-client, writes bookings). One surface, one read path
// (travel-read-expenses by_engagement_full), one write path
// (travel-write-expenses update_booking_financial).
//
// Mounted at #admin/trips/<url_id>/bookings (EngagementDetailTabId: 'bookings').
// Receives urlId (11-char) and resolves engagement_id internally.
//
// Sections: margin banner · bookings (rooms + write panel) · expenses.
// Write panel: commission · deposit/balance · payment signal · invoice · amenities.
//
// Last updated: S53I — initial ship (Collapse B, B4).

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useAdminToast } from './_adminPrimitives'
import { supabase } from '../../lib/supabase'
import type { BookingFinancial, BookingFinancialRoom } from '../../types/typesBookingFinancial'
import {
  fetchEngagementFull,
  createExpense,
  deleteExpense,
  markBilled,
  markPaid,
  writeOff,
  updateBookingFinancial,
  type EngagementFull,
  type Expense,
  type BillingStatus,
  type CreateExpensePayload,
} from '../../queries/queriesAdminFinance'
import { isHotelBooking } from '../../types/typesAuxBookings'

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function usdDec(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(m[3])} ${MONTHS[parseInt(m[2])-1]} ${m[1]}`
}
function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  return iso.slice(0, 10) < new Date().toISOString().slice(0, 10)
}
function marginColor(n: number): string {
  if (n > 0) return '#4ade80'
  if (n < 0) return '#ef4444'
  return A.muted
}
function pct(n: number | null | undefined): string {
  if (n == null) return ''
  return ` (${n.toFixed(1)}%)`
}

// ── Styles ────────────────────────────────────────────────────────────────────

const btnP: React.CSSProperties = { padding: '8px 18px', background: 'rgba(216,181,106,0.12)', color: A.gold, border: `1px solid rgba(216,181,106,0.30)`, borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: A.font, cursor: 'pointer', letterSpacing: '0.04em' }
const btnG: React.CSSProperties = { padding: '7px 16px', background: 'transparent', color: A.muted, border: `1px solid ${A.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: A.font, cursor: 'pointer' }
const btnD: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: A.font, cursor: 'pointer' }
const inputS: React.CSSProperties = { width: '100%', background: A.bgInput, border: `1px solid ${A.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: A.text, fontFamily: A.font, outline: 'none', boxSizing: 'border-box' }
const labelS: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6, display: 'block' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={labelS}>{label}</label>{children}</div>
}

// ── Metric card ───────────────────────────────────────────────────────────────

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: A.muted, fontFamily: A.font }}>{sub}</div>}
    </div>
  )
}

// ── Status pill (expense) ─────────────────────────────────────────────────────

const STATUS_META: Record<BillingStatus, { label: string; color: string }> = {
  absorbed:    { label: 'Absorbed',    color: A.muted   },
  billable:    { label: 'Billable',    color: '#93C5FD' },
  billed:      { label: 'Billed',      color: '#FBBF24' },
  paid:        { label: 'Paid',        color: '#4ade80' },
  written_off: { label: 'Written off', color: A.faint   },
}

function StatusPill({ status }: { status: BillingStatus }) {
  const m = STATUS_META[status] ?? { label: status, color: A.faint }
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 100, border: `1px solid ${m.color}50`, color: m.color, background: `${m.color}14`, fontFamily: A.font, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

// ── Room line ─────────────────────────────────────────────────────────────────

function RoomLine({ room }: { room: BookingFinancialRoom }) {
  const roomTotal = room.total ?? (room.rate && room.nights ? room.rate * room.nights * (1 + (room.tax_pct ?? 0) / 100) : null)
  const roomBase  = room.rate && room.nights ? room.rate * room.nights : null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 20px', padding: '10px 18px', borderTop: `1px solid ${A.border}`, alignItems: 'start' }}>
      <div>
        {room.guest_name   && <div style={{ fontSize: 13, fontWeight: 600, color: A.text, fontFamily: A.font }}>{room.guest_name}</div>}
        {room.room_name    && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{room.room_name}</div>}
        {room.confirmation_number && <div style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{room.confirmation_number}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        {room.rate != null && <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{usdDec(room.rate)}/night{room.nights ? ` × ${room.nights}` : ''}</div>}
        {roomBase  != null && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Base: {usdDec(roomBase)}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        {roomTotal != null && <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font }}>{usdDec(roomTotal)}</div>}
        {room.tax_pct != null && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>incl. {room.tax_pct.toFixed(2)}% tax</div>}
      </div>
    </div>
  )
}

// ── Booking row ───────────────────────────────────────────────────────────────

function BookingRow({ booking: b, onUpdated }: { booking: BookingFinancial; onUpdated: () => void }) {
  const [expanded,  setExpanded]  = useState(false)
  const [saving,    setSaving]    = useState<string | null>(null)
  const [commPct,   setCommPct]   = useState(b.commission_pct?.toString() ?? '')
  const [commAmt,   setCommAmt]   = useState(b.commission_amount?.toString() ?? '')
  const [invoiceNo, setInvoiceNo] = useState(b.invoice_number ?? '')
  const [amenities, setAmenities] = useState(b.cost?.toString() ?? '')
  const toast = useAdminToast()

  const currency = b.currency ?? 'USD'
  const isHotel  = isHotelBooking(b.booking_type)
  const commAmt_ = b.commission_amount_usd ?? b.commission_amount ?? 0
  const totalRate = b.total_rate_usd ?? b.total_rate ?? 0
  const commBase  = b.commissionable_rate_usd ?? b.commissionable_rate ?? 0
  const taxes     = b.taxes_and_fees_usd ?? b.taxes_and_fees ?? 0
  const commReceived = !!b.commission_paid_at
  const isFx      = b.currency && b.currency !== 'USD'
  const hasRooms  = (b.rooms?.length ?? 0) > 0
  const hasShares = !!(b.referral_share_amt || b.iata_share_amt || b.individual_share_amt)
  const depositStatus = b.deposit_amount
    ? b.deposit_paid_at ? 'paid' : b.deposit_due_date ? `due ${fmtDate(b.deposit_due_date)}` : 'pending'
    : null
  const balanceStatus = b.balance_amount
    ? b.balance_paid_at ? 'paid' : b.balance_due_date ? `due ${fmtDate(b.balance_due_date)}` : 'pending'
    : null
  const displayName = b._hotel_name ?? b.name ?? 'Booking'

  async function patch(label: string, fields: Record<string, unknown>) {
    setSaving(label)
    try {
      await updateBookingFinancial(b.id, fields)
      await onUpdated()
      toast.success(`${label} updated`)
    } catch (e) {
      toast.error(`Failed to update ${label}`)
    } finally {
      setSaving(null)
    }
  }

  async function toggleCommPaid()   { await patch('Commission',     { commission_paid_at:   b.commission_paid_at ? null : new Date().toISOString() }) }
  async function toggleDepositPaid() { await patch('Deposit',        { deposit_paid_at:      b.deposit_paid_at   ? null : new Date().toISOString() }) }
  async function toggleBalancePaid() { await patch('Balance',        { balance_paid_at:      b.balance_paid_at   ? null : new Date().toISOString() }) }
  async function togglePaymentSignal() {
    await patch('Payment signal', { payment_exception_override: b.payment_exception_override ? null : true })
  }
  async function saveCommission() {
    const p = parseFloat(commPct), a = parseFloat(commAmt)
    if (isNaN(p) && isNaN(a)) return
    const fields: Record<string, unknown> = {}
    if (!isNaN(p)) fields.commission_pct    = p
    if (!isNaN(a)) fields.commission_amount = a
    await patch('Commission', fields)
  }
  async function saveInvoice()   { await patch('Invoice',    { invoice_number: invoiceNo.trim() || null }) }
  async function saveAmenities() {
    const v = parseFloat(amenities)
    await patch('Amenities', { cost: isNaN(v) ? null : v })
  }

  return (
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: A.text, fontFamily: A.font }}>{displayName}</span>
            {commReceived
              ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ade80', fontFamily: A.font, border: '1px solid rgba(74,222,128,0.3)', borderRadius: 100, padding: '2px 8px' }}>Comm. Received</span>
              : commAmt_ > 0
                ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FBBF24', fontFamily: A.font, border: '1px solid rgba(251,191,36,0.3)', borderRadius: 100, padding: '2px 8px' }}>Comm. Outstanding</span>
                : null}
          </div>
          <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginBottom: 2 }}>
            {fmtDate(b.start_date)}{b.end_date ? ` – ${fmtDate(b.end_date)}` : ''}{b.nights ? ` · ${b.nights} nights` : ''}{isFx ? ` · ${b.currency}` : ''}
          </div>
          {b.invoice_number && <div style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>Inv. {b.invoice_number}</div>}
          {(depositStatus || balanceStatus) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {depositStatus && <span style={{ fontSize: 10, color: depositStatus === 'paid' ? '#4ade80' : isOverdue(b.deposit_due_date) ? '#f87171' : '#FBBF24', fontFamily: A.font }}>Deposit {b.deposit_amount ? usdDec(b.deposit_amount) : ''} · {depositStatus}</span>}
              {balanceStatus && <span style={{ fontSize: 10, color: balanceStatus === 'paid' ? '#4ade80' : isOverdue(b.balance_due_date) ? '#f87171' : '#FBBF24', fontFamily: A.font }}>Balance {b.balance_amount ? usdDec(b.balance_amount) : ''} · {balanceStatus}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{usdDec(totalRate)}</div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Base {usdDec(commBase)} + tax {usdDec(taxes)}</div>
          {commAmt_ > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: commReceived ? '#4ade80' : '#FBBF24', fontFamily: A.font }}>{usdDec(commAmt_)} comm{pct(b.commission_pct)}</div>}
          {hasShares && (
            <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>
              Net {usdDec(b.net_revenue_usd ?? 0)}
              {b.referral_share_amt ? ` · ref ${usdDec(b.referral_share_amt)}`   : ''}
              {b.iata_share_amt     ? ` · IATA ${usdDec(b.iata_share_amt)}`     : ''}
              {b.individual_share_amt ? ` · indiv ${usdDec(b.individual_share_amt)}` : ''}
            </div>
          )}
          {b.cost && b.cost > 0 && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{usdDec(b.cost)} amenity</div>}
          {hasRooms && (
            <button onClick={() => setExpanded(o => !o)} style={{ background: 'none', border: 'none', color: A.faint, fontSize: 10, fontFamily: A.font, cursor: 'pointer', padding: 0, marginTop: 4, letterSpacing: '0.04em' }}>
              {expanded ? '▲ Hide rooms' : `▼ ${b.rooms.length} room${b.rooms.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* Room rows */}
      {expanded && hasRooms && (
        <div style={{ borderTop: `1px solid ${A.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 20px', padding: '8px 18px', background: A.bg }}>
            {['Guest / Room', 'Rate', 'Total'].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, textAlign: h === 'Guest / Room' ? 'left' : 'right' }}>{h}</div>
            ))}
          </div>
          {b.rooms.map(r => <RoomLine key={r.id} room={r} />)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 20px', padding: '10px 18px', borderTop: `1px solid ${A.border}`, background: A.bg }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>{b.rooms.length} rooms · {b.nights} nights</div>
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, textAlign: 'right' }}>Base {usdDec(commBase)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, textAlign: 'right' }}>{usdDec(totalRate)}</div>
          </div>
        </div>
      )}

      {/* Write panel */}
      <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Commission */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>Commission</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input value={commPct} onChange={e => setCommPct(e.target.value)} onBlur={saveCommission} placeholder='Pct %' style={{ ...inputS, width: 64, fontSize: 12 }} />
            <input value={commAmt} onChange={e => setCommAmt(e.target.value)} onBlur={saveCommission} placeholder={`Amount ${currency}`} style={{ ...inputS, width: 100, fontSize: 12 }} />
            <button onClick={toggleCommPaid} disabled={saving === 'Commission'} style={{ ...btnP, fontSize: 11, padding: '4px 12px', background: b.commission_paid_at ? '#4ade8020' : undefined, color: b.commission_paid_at ? '#4ade80' : undefined, border: b.commission_paid_at ? '1px solid #4ade8040' : undefined }}>
              {b.commission_paid_at ? `Received ${fmtDate(b.commission_paid_at)}` : 'Mark Received'}
            </button>
          </div>
        </div>

        {/* Deposit + Balance */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {b.deposit_amount != null && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Deposit · {usdDec(b.deposit_amount)}</div>
              <button onClick={toggleDepositPaid} disabled={saving === 'Deposit'} style={{ ...btnG, fontSize: 11, padding: '4px 12px', background: b.deposit_paid_at ? '#4ade8015' : undefined, color: b.deposit_paid_at ? '#4ade80' : undefined, border: b.deposit_paid_at ? '1px solid #4ade8030' : undefined }}>
                {b.deposit_paid_at ? `Paid ${fmtDate(b.deposit_paid_at)}` : b.deposit_due_date ? `Due ${fmtDate(b.deposit_due_date)}` : 'Mark Paid'}
              </button>
            </div>
          )}
          {b.balance_amount != null && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Balance · {usdDec(b.balance_amount)}</div>
              <button onClick={toggleBalancePaid} disabled={saving === 'Balance'} style={{ ...btnG, fontSize: 11, padding: '4px 12px', background: b.balance_paid_at ? '#4ade8015' : undefined, color: b.balance_paid_at ? '#4ade80' : undefined, border: b.balance_paid_at ? '1px solid #4ade8030' : undefined }}>
                {b.balance_paid_at ? `Paid ${fmtDate(b.balance_paid_at)}` : b.balance_due_date ? `Due ${fmtDate(b.balance_due_date)}` : 'Mark Paid'}
              </button>
            </div>
          )}
        </div>

        {/* Guest payment signal */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
            Guest Payment Signal
            {!b.payment_exception_override && b.balance_due_date && !b.balance_paid_at && isOverdue(b.balance_due_date) && (
              <span style={{ color: '#f87171', fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>· auto-showing (balance overdue)</span>
            )}
          </div>
          <button onClick={togglePaymentSignal} disabled={saving === 'Payment signal'} style={{ ...btnG, fontSize: 11, padding: '4px 12px', background: b.payment_exception_override ? '#f8717115' : undefined, color: b.payment_exception_override ? '#f87171' : undefined, border: b.payment_exception_override ? '1px solid #f8717130' : undefined }}>
            {b.payment_exception_override ? 'Forced ON · clear override' : 'Force "Payment Outstanding"'}
          </button>
          <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 4 }}>
            {b.payment_exception_override ? 'Guest sees the signal regardless of due dates.' : 'Off: guest sees it only when the balance is past due and unpaid.'}
          </div>
        </div>

        {/* Invoice + Amenities */}
        <div style={{ display: 'grid', gridTemplateColumns: isHotel ? '1fr 1fr' : '1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Invoice #</div>
            <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} onBlur={saveInvoice} placeholder='Invoice number' style={{ ...inputS, fontSize: 12 }} />
          </div>
          {isHotel && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Amenities ({currency}) <span style={{ color: A.faint, fontWeight: 400 }}>absorbed</span></div>
              <input value={amenities} onChange={e => setAmenities(e.target.value)} onBlur={saveAmenities} placeholder='0' style={{ ...inputS, fontSize: 12 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────

const EXPENSE_TYPES = ['Amenity','Dining','Entertainment','Gifting','Ground Transport','Hospitality','Research','Telephone','Travel','Other']

function AddExpenseModal({ engagementId, onClose, onCreated }: { engagementId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ expense_type: 'Other', description: '', total_amount: '', currency: 'USD', billing_status: 'absorbed' as BillingStatus, notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSave() {
    if (!form.description.trim()) { setErr('Description is required.'); return }
    const amt = parseFloat(form.total_amount)
    if (isNaN(amt) || amt < 0) { setErr('Valid amount is required.'); return }
    setSaving(true); setErr(null)
    try {
      await createExpense({ engagement_id: engagementId, expense_type: form.expense_type, description: form.description.trim(), total_amount: amt, currency: form.currency.trim().toUpperCase() || 'USD', billing_status: form.billing_status, notes: form.notes.trim() || null } as CreateExpensePayload)
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
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
          <Field label='Type'><select style={inputS} value={form.expense_type} onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label='Billing Status'><select style={inputS} value={form.billing_status} onChange={e => setForm(f => ({ ...f, billing_status: e.target.value as BillingStatus }))}><option value='absorbed'>Absorbed</option><option value='billable'>Billable</option></select></Field>
          <Field label='Amount'><input style={inputS} type='number' min='0' step='0.01' value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder='0.00' /></Field>
          <Field label='Currency'><input style={inputS} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder='USD' /></Field>
        </div>
        <Field label='Description'><input style={inputS} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder='Brief description' /></Field>
        <Field label='Notes'><textarea style={{ ...inputS, minHeight: 72, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder='Optional internal notes' /></Field>
        {err && <div style={{ fontSize: 12, color: '#ef4444', fontFamily: A.font }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${A.border}` }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnP, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Add Expense'}</button>
          <button onClick={onClose} style={btnG}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Expense row ───────────────────────────────────────────────────────────────

function ExpenseRow({ expense, onAction }: { expense: Expense; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [acting,   setActing]   = useState(false)
  const toast = useAdminToast()

  async function lifecycle(fn: () => Promise<unknown>, label: string) {
    setActing(true)
    try { await fn(); toast.success(`${label}.`); onAction() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setActing(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this expense?')) return
    setActing(true)
    try { await deleteExpense(expense.id); toast.success('Expense deleted.'); onAction() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    setActing(false)
  }

  const canDelete = expense.billing_status !== 'billed'

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
          <div style={{ fontSize: 18, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{usdDec(expense.total_amount)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {expense.billing_status === 'billable' && <button disabled={acting} onClick={() => lifecycle(() => markBilled(expense.id), 'Marked as billed')} style={{ ...btnG, fontSize: 11, padding: '5px 10px', color: '#FBBF24', borderColor: 'rgba(251,191,36,0.3)' }}>Mark Billed</button>}
            {expense.billing_status === 'billed'   && <button disabled={acting} onClick={() => lifecycle(() => markPaid(expense.id), 'Marked as paid')} style={{ ...btnG, fontSize: 11, padding: '5px 10px', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>Mark Paid</button>}
            {(expense.billing_status === 'billable' || expense.billing_status === 'billed') && <button disabled={acting} onClick={() => lifecycle(() => writeOff(expense.id), 'Written off')} style={{ ...btnG, fontSize: 11, padding: '5px 10px' }}>Write Off</button>}
            {canDelete && <button disabled={acting} onClick={handleDelete} style={{ ...btnD, padding: '5px 10px' }}>Delete</button>}
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
              <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{usdDec(item.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── OutlookTab ────────────────────────────────────────────────────────────────

export default function OutlookTab({ urlId }: { urlId: string }) {
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [data,    setData]    = useState<EngagementFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useAdminToast()

  // Resolve url_id -> engagement_id on mount.
  useEffect(() => {
    supabase
      .from('travel_immerse_engagements')
      .select('id')
      .eq('url_id', urlId)
      .single()
      .then(({ data: eng, error }) => {
        if (error || !eng) { toast.error('Engagement not found'); setLoading(false); return }
        setEngagementId(eng.id)
      })
  }, [urlId])

  async function load() {
    if (!engagementId) return
    setLoading(true)
    try { setData(await fetchEngagementFull(engagementId)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load financials') }
    setLoading(false)
  }

  useEffect(() => { if (engagementId) load() }, [engagementId])

  const summary  = data?.summary
  const bookings = (data?.bookings ?? []) as BookingFinancial[]
  const expenses = data?.expenses ?? []
  const title    = data?.engagement?.title ?? 'Financial Outlook'
  const margin   = summary?.net_margin ?? 0

  const grouped: Record<BillingStatus, Expense[]> = { absorbed: [], billable: [], billed: [], paid: [], written_off: [] }
  for (const exp of expenses) { grouped[exp.billing_status]?.push(exp) }
  const ORDER: BillingStatus[] = ['billable', 'billed', 'absorbed', 'paid', 'written_off']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {showAdd && engagementId && (
        <AddExpenseModal
          engagementId={engagementId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontWeight: 700, fontFamily: A.font, marginBottom: 4 }}>Financial Outlook</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{title}</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={btnP}>+ Add Expense</button>
      </div>

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading…</div>}

      {!loading && summary && (
        <>
          {/* Margin banner */}
          <div style={{ background: A.bgCard, borderRadius: 14, border: `1px solid ${margin >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>Net Margin</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: marginColor(margin), fontFamily: A.font, letterSpacing: '-0.03em' }}>{margin >= 0 ? '+' : ''}{usdDec(margin)}</div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 4 }}>Commission − Absorbed expenses</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, flex: 1, minWidth: 280 }}>
                <Metric label='Total Trip Value'  value={usdDec(summary.total_rate)} />
                <Metric label='Commission'        value={usdDec(summary.total_commission)} sub={`${usdDec(summary.commission_received)} received`} />
                {summary.commission_outstanding > 0 && <Metric label='Comm. Outstanding' value={usdDec(summary.commission_outstanding)} color='#FBBF24' />}
                {summary.total_net_revenue !== summary.total_commission && <Metric label='Net Revenue' value={usdDec(summary.total_net_revenue)} sub='after partner shares' />}
                {summary.total_amenities > 0 && <Metric label='Amenities' value={usdDec(summary.total_amenities)} />}
                <Metric label='Absorbed' value={usdDec(summary.total_absorbed)} color={summary.total_absorbed > 0 ? '#ef4444' : A.text} />
                {summary.total_billable > 0 && <Metric label='Billable' value={usdDec(summary.total_billable)} color='#93C5FD' />}
                {summary.deposit_outstanding > 0 && <Metric label='Deposits Due' value={usdDec(summary.deposit_outstanding)} color='#FBBF24' />}
                {summary.balance_outstanding > 0 && <Metric label='Balances Due' value={usdDec(summary.balance_outstanding)} color='#FBBF24' />}
              </div>
            </div>
          </div>

          {/* Bookings */}
          {bookings.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
                Bookings · {bookings.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookings.map(b => <BookingRow key={b.id} booking={b} onUpdated={load} />)}
              </div>
            </div>
          )}

          {/* Expenses */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 10 }}>
              Expenses{expenses.length > 0 ? ` · ${expenses.length}` : ''}
            </div>
            {expenses.length === 0 && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>No expenses recorded.</div>}
            {ORDER.map(status => {
              const group = grouped[status]
              if (!group || group.length === 0) return null
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