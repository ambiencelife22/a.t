// OutlookTab.tsx — Financial outlook for a trip engagement.
//
// Redesigned S53H: state-first, action-oriented. The surface tells the story
// of where money stands and what needs action — zero ambiguity.
//
// Architecture:
//   - Margin banner: net margin dominant, commission state, no guest deposit noise
//   - Booking cards: status-first header, write panel behind expand
//   - Commission receipt: full transaction record (platform, ref, partner, fee, net)
//   - Expenses: grouped by status, add inline
//
// What it owns:
//   - All financial reads via travel-read-expenses by_engagement_full
//   - All financial writes via travel-write-expenses
//   - Supplier reference data via travel-read-suppliers
//
// Last updated: S53H — full redesign. Commission receipt captures platform,
//   transaction ref, remitting partner, gross, fee, net, date.

import { useEffect, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import { useAdminToast } from './_adminPrimitives'
import { supabase } from '../../lib/supabase'
import type { BookingFinancial, BookingFinancialRoom } from '../../types/typesBookingFinancial'
import { formatDateShort, formatDateShortRange } from '../../utils/utilsDates'
import { moneyDec as usdDec } from '../../utils/utilsCurrency'
import {
  fetchEngagementFull,
  createExpense,
  deleteExpense,
  markBilled,
  markPaid,
  writeOff,
  updateBookingFinancial,
  fetchPaymentPlatforms,
  fetchPartners,
  markCommissionReceived,
  type EngagementFull,
  type Expense,
  type BillingStatus,
  type CreateExpensePayload,
  type PaymentPlatform,
  type SupplierPartner,
} from '../../queries/queriesAdminFinance'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
        {room.rate != null && <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{usdDec(room.rate)}/night{room.nights ? ` x ${room.nights}` : ''}</div>}
        {roomBase  != null && <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Base: {usdDec(roomBase)}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        {roomTotal != null && <div style={{ fontSize: 14, fontWeight: 700, color: A.text, fontFamily: A.font }}>{usdDec(roomTotal)}</div>}
        {room.tax_pct != null && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>incl. {room.tax_pct.toFixed(2)}% tax</div>}
      </div>
    </div>
  )
}

// ── Commission receipt ────────────────────────────────────────────────────────

function computeReceipt(gross: number, feePct: number, feeFlat: number): { feeAmt: number; net: number } {
  const feeAmt = (gross * feePct / 100) + (feeFlat ?? 0)
  return { feeAmt, net: gross - feeAmt }
}

function CommissionReceipt({
  booking: b,
  platforms,
  partners,
  onDone,
}: {
  booking:   BookingFinancial
  platforms: PaymentPlatform[]
  partners:  SupplierPartner[]
  onDone:    () => void
}) {
  const received = !!b.commission_paid_at
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useAdminToast()

  const defaultGross = b.commission_amount_usd ?? b.commission_amount ?? 0
  const [platformId,   setPlatformId]   = useState<string>(b.commission_payment_platform_id ?? '')
  const [gross,        setGross]        = useState(defaultGross ? defaultGross.toString() : '')
  const [feePct,       setFeePct]       = useState(b.commission_payment_fee_pct?.toString() ?? '')
  const [feeFlat,      setFeeFlat]      = useState('')
  const [txRef,        setTxRef]        = useState(b.commission_transaction_ref ?? '')
  const [partnerId,    setPartnerId]    = useState<string>(b.commission_remitting_partner_id ?? '')

  const currency = b.currency ?? 'USD'

  function selectPlatform(id: string) {
    setPlatformId(id)
    const p = platforms.find(x => x.id === id)
    if (!p) return
    setFeePct(p.default_fee_pct ? p.default_fee_pct.toString() : '')
    setFeeFlat(p.default_fee_flat != null ? p.default_fee_flat.toString() : '')
  }

  const grossN = parseFloat(gross)
  const pctN   = parseFloat(feePct)  || 0
  const flatN  = parseFloat(feeFlat) || 0
  const valid  = !isNaN(grossN) && grossN >= 0
  const { feeAmt, net } = valid ? computeReceipt(grossN, pctN, flatN) : { feeAmt: 0, net: 0 }

  async function confirm() {
    if (!valid) return
    setSaving(true)
    try {
      await markCommissionReceived({
        booking_id:            b.id,
        platform_id:           platformId || undefined,
        received_amount:       Math.round(grossN * 100) / 100,
        fee_pct:               pctN,
        fee_amt:               Math.round(feeAmt * 100) / 100,
        transaction_ref:       txRef.trim() || undefined,
        remitting_partner_id:  partnerId || undefined,
      })
      await onDone()
      toast.success('Commission receipt recorded')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record receipt')
    } finally {
      setSaving(false)
    }
  }

  async function clearReceipt() {
    setSaving(true)
    try {
      await updateBookingFinancial(b.id, {
        commission_paid_at:              null,
        commission_received_amount:      null,
        commission_payment_fee_pct:      null,
        commission_payment_fee_amt:      null,
        commission_net_received:         null,
        commission_payment_platform_id:  null,
        commission_transaction_ref:      null,
        commission_remitting_partner_id: null,
      })
      await onDone()
      toast.success('Receipt cleared')
    } catch {
      toast.error('Failed to clear receipt')
    } finally {
      setSaving(false)
    }
  }

  // ── Received state — show full transaction record ──────────────────────────
  if (received && !open) {
    const platform = b.travel_payment_platforms
    const partner  = b.travel_partners
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4ade80', fontFamily: A.font, border: '1px solid #4ade8040', background: '#4ade8020', borderRadius: 100, padding: '4px 12px' }}>
            Received {formatDateShort(b.commission_paid_at)}
          </span>
          <button onClick={clearReceipt} disabled={saving} style={{ ...btnG, fontSize: 10, padding: '3px 10px' }}>Clear</button>
          <button onClick={() => setOpen(true)} style={{ ...btnG, fontSize: 10, padding: '3px 10px' }}>Edit</button>
        </div>
        {/* Transaction detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 14px', background: A.bg, borderRadius: 8, border: `1px solid ${A.border}` }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {platform && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Via</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{platform.label}</div>
              </div>
            )}
            {partner && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Remitted by</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{partner.name}</div>
              </div>
            )}
            {b.commission_transaction_ref && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Ref</div>
                <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: A.text }}>{b.commission_transaction_ref}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 6, flexWrap: 'wrap' }}>
            {b.commission_received_amount != null && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Gross</div>
                <div style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>{usdDec(b.commission_received_amount)}</div>
              </div>
            )}
            {b.commission_payment_fee_amt != null && b.commission_payment_fee_amt > 0 && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Fee</div>
                <div style={{ fontSize: 12, color: '#ef4444', fontFamily: A.font }}>
                  -{usdDec(b.commission_payment_fee_amt)}
                  {b.commission_payment_fee_pct ? ` (${b.commission_payment_fee_pct}%)` : ''}
                </div>
              </div>
            )}
            {b.commission_net_received != null && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Net to ambience</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', fontFamily: A.font }}>{usdDec(b.commission_net_received)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Record form ────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...btnP, fontSize: 11, padding: '6px 14px' }}>
        Record Receipt
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${A.border}`, borderRadius: 12, padding: 16, background: A.bg }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>
        Commission Receipt
      </div>

      {/* Row 1: Platform + Partner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label='Platform'>
          <select value={platformId} onChange={e => selectPlatform(e.target.value)} style={{ ...inputS, fontSize: 12 }}>
            <option value=''>— select —</option>
            {platforms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label='Remitted by (partner)'>
          <select value={partnerId} onChange={e => setPartnerId(e.target.value)} style={{ ...inputS, fontSize: 12 }}>
            <option value=''>— direct —</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Row 2: Gross + Fee % + Flat + Ref */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 1fr', gap: 10, alignItems: 'end' }}>
        <Field label={`Gross (${currency})`}>
          <input value={gross} onChange={e => setGross(e.target.value)} placeholder='0.00' style={{ ...inputS, fontSize: 12 }} />
        </Field>
        <Field label='Fee %'>
          <input value={feePct} onChange={e => setFeePct(e.target.value)} placeholder='0' style={{ ...inputS, width: 64, fontSize: 12 }} />
        </Field>
        <Field label={`Flat (${currency})`}>
          <input value={feeFlat} onChange={e => setFeeFlat(e.target.value)} placeholder='0' style={{ ...inputS, width: 80, fontSize: 12 }} />
        </Field>
        <Field label='Transaction / Ref #'>
          <input value={txRef} onChange={e => setTxRef(e.target.value)} placeholder='Wire ref, ONYX ID...' style={{ ...inputS, fontSize: 12 }} />
        </Field>
      </div>

      {/* Math preview */}
      {valid && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '10px 14px', background: A.bgCard, borderRadius: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>Gross <strong style={{ color: A.text }}>{usdDec(grossN)}</strong></div>
          {feeAmt > 0 && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>Fee <strong style={{ color: '#ef4444' }}>-{usdDec(feeAmt)}</strong></div>}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', fontFamily: A.font }}>Net {usdDec(net)}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={confirm} disabled={!valid || saving} style={{ ...btnP, fontSize: 11, padding: '6px 16px', opacity: (!valid || saving) ? 0.5 : 1 }}>
          {saving ? 'Saving...' : 'Confirm Receipt'}
        </button>
        <button onClick={() => setOpen(false)} style={{ ...btnG, fontSize: 11, padding: '6px 12px' }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Booking row ───────────────────────────────────────────────────────────────

function BookingRow({
  booking: b,
  platforms,
  partners,
  onUpdated,
}: {
  booking:   BookingFinancial
  platforms: PaymentPlatform[]
  partners:  SupplierPartner[]
  onUpdated: () => void
}) {
  const [expanded,     setExpanded]     = useState(false)
  const [editOpen,     setEditOpen]     = useState(false)
  const [saving,       setSaving]       = useState<string | null>(null)
  const [commPct,      setCommPct]      = useState(b.commission_pct?.toString() ?? '')
  const [commAmt,      setCommAmt]      = useState(b.commission_amount?.toString() ?? '')
  const [invoiceNo,    setInvoiceNo]    = useState(b.invoice_number ?? '')
  const [amenities,    setAmenities]    = useState(b.cost?.toString() ?? '')

  useEffect(() => { setCommPct(b.commission_pct?.toString() ?? '') },    [b.commission_pct])
  useEffect(() => { setCommAmt(b.commission_amount?.toString() ?? '') }, [b.commission_amount])
  useEffect(() => { setInvoiceNo(b.invoice_number ?? '') },              [b.invoice_number])
  useEffect(() => { setAmenities(b.cost?.toString() ?? '') },            [b.cost])

  const toast = useAdminToast()

  const currency     = b.currency ?? 'USD'
  const isHotel      = (b.rooms?.length ?? 0) > 0
  const commAmt_     = b.commission_amount_usd ?? b.commission_amount ?? 0
  const totalRate    = b.total_rate_usd ?? b.total_rate ?? 0
  const commBase     = b.commissionable_rate_usd ?? b.commissionable_rate ?? 0
  const taxes        = b.taxes_and_fees_usd ?? b.taxes_and_fees ?? 0
  const commReceived = !!b.commission_paid_at
  const isFx         = b.currency && b.currency !== 'USD'
  const hasRooms     = (b.rooms?.length ?? 0) > 0
  const hasShares    = !!(b.referral_share_amt || b.iata_share_amt || b.individual_share_amt)
  const displayName  = b._hotel_name ?? b.name ?? 'Booking'

  const depositPaid   = !!b.deposit_paid_at
  const balancePaid   = !!b.balance_paid_at
  const depositOverdue = !depositPaid && isOverdue(b.deposit_due_date ?? null)
  const balanceOverdue = !balancePaid && isOverdue(b.balance_due_date ?? null)

  async function patch(label: string, fields: Record<string, unknown>) {
    setSaving(label)
    try {
      await updateBookingFinancial(b.id, fields)
      await onUpdated()
      toast.success(`${label} updated`)
    } catch {
      toast.error(`Failed to update ${label}`)
    } finally {
      setSaving(null)
    }
  }

  async function toggleDepositPaid()  { await patch('Deposit',        { deposit_paid_at: b.deposit_paid_at   ? null : new Date().toISOString() }) }
  async function toggleBalancePaid()  { await patch('Balance',        { balance_paid_at: b.balance_paid_at   ? null : new Date().toISOString() }) }
  async function togglePaymentSignal() { await patch('Payment signal', { payment_exception_override: b.payment_exception_override ? null : true }) }

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
    <div style={{ background: A.bgCard, border: `1px solid ${A.border}`, borderRadius: 14, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + commission status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: A.text, fontFamily: A.font }}>{displayName}</span>
            {commReceived
              ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ade80', fontFamily: A.font, border: '1px solid rgba(74,222,128,0.3)', borderRadius: 100, padding: '2px 8px' }}>Comm. Received</span>
              : commAmt_ > 0
                ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FBBF24', fontFamily: A.font, border: '1px solid rgba(251,191,36,0.3)', borderRadius: 100, padding: '2px 8px' }}>Comm. Pending</span>
                : null}
          </div>

          {/* Dates + nights */}
          <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginBottom: 8 }}>
            {formatDateShortRange(b.start_date, b.end_date)}{b.nights ? ` · ${b.nights} nights` : ''}{isFx ? ` · ${b.currency}` : ''}
          </div>

          {/* Deposit / Balance status lines */}
          {(b.deposit_amount || b.balance_amount) && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {b.deposit_amount != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>Deposit {usdDec(b.deposit_amount)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: depositPaid ? '#4ade80' : depositOverdue ? '#ef4444' : '#FBBF24', fontFamily: A.font }}>
                    {depositPaid ? `Paid ${formatDateShort(b.deposit_paid_at)}` : depositOverdue ? `Overdue ${formatDateShort(b.deposit_due_date)}` : `Due ${formatDateShort(b.deposit_due_date)}`}
                  </span>
                </div>
              )}
              {b.balance_amount != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>Balance {usdDec(b.balance_amount)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: balancePaid ? '#4ade80' : balanceOverdue ? '#ef4444' : '#FBBF24', fontFamily: A.font }}>
                    {balancePaid ? `Paid ${formatDateShort(b.balance_paid_at)}` : balanceOverdue ? `Overdue ${formatDateShort(b.balance_due_date)}` : `Due ${formatDateShort(b.balance_due_date)}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: amounts */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>{usdDec(totalRate)}</div>
          <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>Base {usdDec(commBase)} + tax {usdDec(taxes)}</div>
          {commAmt_ > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: commReceived ? '#4ade80' : '#FBBF24', fontFamily: A.font }}>
              {usdDec(commAmt_)} comm{pct(b.commission_pct)}
            </div>
          )}
          {hasShares && (
            <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, textAlign: 'right' }}>
              Net {usdDec(b.net_revenue_usd ?? 0)}
              {b.iata_share_amt      ? ` · IATA ${usdDec(b.iata_share_amt)}`          : ''}
              {b.referral_share_amt  ? ` · ref ${usdDec(b.referral_share_amt)}`        : ''}
              {b.individual_share_amt ? ` · indiv ${usdDec(b.individual_share_amt)}`   : ''}
            </div>
          )}
          {b.cost && b.cost > 0 && <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{usdDec(b.cost)} amenity</div>}
          {b.invoice_number && <div style={{ fontSize: 10, color: A.faint, fontFamily: "'DM Mono', monospace" }}>Inv. {b.invoice_number}</div>}
        </div>
      </div>

      {/* ── Rooms (collapsible) ── */}
      {hasRooms && (
        <div style={{ borderTop: `1px solid ${A.border}` }}>
          <button
            onClick={() => setExpanded(o => !o)}
            style={{ width: '100%', background: 'none', border: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: A.faint, fontSize: 11, fontFamily: A.font, textAlign: 'left' }}
          >
            <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>{expanded ? '▲' : '▼'}</span>
            {b.rooms.length} room{b.rooms.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div style={{ borderTop: `1px solid ${A.border}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 20px', padding: '8px 18px', background: A.bg }}>
                {['Guest / Room', 'Rate', 'Total'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, textAlign: h === 'Guest / Room' ? 'left' : 'right' }}>{h}</div>
                ))}
              </div>
              {b.rooms.map(r => <RoomLine key={r.id} room={r} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Commission receipt (always visible) ── */}
      <div style={{ borderTop: `1px solid ${A.border}`, padding: '14px 20px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Commission</div>
        <CommissionReceipt booking={b} platforms={platforms} partners={partners} onDone={onUpdated} />
      </div>

      {/* ── Edit panel (collapsible) ── */}
      <div style={{ borderTop: `1px solid ${A.border}` }}>
        <button
          onClick={() => setEditOpen(o => !o)}
          style={{ width: '100%', background: 'none', border: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: A.faint, fontSize: 11, fontFamily: A.font, textAlign: 'left' }}
        >
          <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>{editOpen ? '▲' : '▼'}</span>
          Edit financials
        </button>

        {editOpen && (
          <div style={{ borderTop: `1px solid ${A.border}`, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Commission pct + amount */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>Commission rate</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={commPct} onChange={e => setCommPct(e.target.value)} onBlur={saveCommission} placeholder='Pct %' style={{ ...inputS, width: 80, fontSize: 12 }} />
                <input value={commAmt} onChange={e => setCommAmt(e.target.value)} onBlur={saveCommission} placeholder={`Amount ${currency}`} style={{ ...inputS, width: 120, fontSize: 12 }} />
              </div>
            </div>

            {/* Deposit + Balance toggles */}
            {(b.deposit_amount != null || b.balance_amount != null) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {b.deposit_amount != null && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Deposit · {usdDec(b.deposit_amount)}</div>
                    <button
                      onClick={toggleDepositPaid}
                      disabled={saving === 'Deposit'}
                      style={{ ...btnG, fontSize: 11, padding: '5px 12px', background: depositPaid ? '#4ade8015' : undefined, color: depositPaid ? '#4ade80' : undefined, border: depositPaid ? '1px solid #4ade8030' : undefined }}
                    >
                      {depositPaid ? `Paid ${formatDateShort(b.deposit_paid_at)}` : 'Mark Paid'}
                    </button>
                  </div>
                )}
                {b.balance_amount != null && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Balance · {usdDec(b.balance_amount)}</div>
                    <button
                      onClick={toggleBalancePaid}
                      disabled={saving === 'Balance'}
                      style={{ ...btnG, fontSize: 11, padding: '5px 12px', background: balancePaid ? '#4ade8015' : undefined, color: balancePaid ? '#4ade80' : undefined, border: balancePaid ? '1px solid #4ade8030' : undefined }}
                    >
                      {balancePaid ? `Paid ${formatDateShort(b.balance_paid_at)}` : 'Mark Paid'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Guest payment signal */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>
                Guest Payment Signal
                {!b.payment_exception_override && b.balance_due_date && !b.balance_paid_at && isOverdue(b.balance_due_date) && (
                  <span style={{ color: '#f87171', fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>auto-showing</span>
                )}
              </div>
              <button
                onClick={togglePaymentSignal}
                disabled={saving === 'Payment signal'}
                style={{ ...btnG, fontSize: 11, padding: '5px 12px', background: b.payment_exception_override ? '#f8717115' : undefined, color: b.payment_exception_override ? '#f87171' : undefined, border: b.payment_exception_override ? '1px solid #f8717130' : undefined }}
              >
                {b.payment_exception_override ? 'Forced ON · clear' : 'Force "Payment Outstanding"'}
              </button>
            </div>

            {/* Invoice + Amenities */}
            <div style={{ display: 'grid', gridTemplateColumns: isHotel ? '1fr 1fr' : '1fr', gap: 10 }}>
              <Field label='Invoice #'>
                <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} onBlur={saveInvoice} placeholder='Invoice number' style={{ ...inputS, fontSize: 12 }} />
              </Field>
              {isHotel && (
                <Field label={`Amenities (${currency}) absorbed`}>
                  <input value={amenities} onChange={e => setAmenities(e.target.value)} onBlur={saveAmenities} placeholder='0' style={{ ...inputS, fontSize: 12 }} />
                </Field>
              )}
            </div>
          </div>
        )}
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: A.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>x</button>
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
          <button onClick={handleSave} disabled={saving} style={{ ...btnP, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving...' : 'Add Expense'}</button>
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
            {expense.billing_status === 'billable'  && <button disabled={acting} onClick={() => lifecycle(() => markBilled(expense.id), 'Marked as billed')} style={{ ...btnG, fontSize: 11, padding: '5px 10px', color: '#FBBF24', borderColor: 'rgba(251,191,36,0.3)' }}>Mark Billed</button>}
            {expense.billing_status === 'billed'    && <button disabled={acting} onClick={() => lifecycle(() => markPaid(expense.id),   'Marked as paid')}   style={{ ...btnG, fontSize: 11, padding: '5px 10px', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>Mark Paid</button>}
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

export default function OutlookTab({ urlId, engagementId: engagementIdProp }: { urlId: string; engagementId?: string }) {
  const [engagementId, setEngagementId] = useState<string | null>(engagementIdProp ?? null)
  const [data,      setData]      = useState<EngagementFull | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [platforms, setPlatforms] = useState<PaymentPlatform[]>([])
  const [partners,  setPartners]  = useState<SupplierPartner[]>([])
  const toast = useAdminToast()

  useEffect(() => {
    Promise.all([fetchPaymentPlatforms(), fetchPartners()])
      .then(([p, r]) => { setPlatforms(p); setPartners(r) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (engagementIdProp) { setEngagementId(engagementIdProp); return }
    supabase
      .from('travel_engagements')
      .select('id')
      .eq('url_id', urlId)
      .single()
      .then(({ data: eng, error }) => {
        if (error || !eng) { toast.error('Engagement not found'); setLoading(false); return }
        setEngagementId(eng.id)
      })
  }, [urlId, engagementIdProp])

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

  const commissionFullyReceived = summary
    ? summary.commission_outstanding <= 0
    : false

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

      {loading && <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font }}>Loading...</div>}

      {!loading && summary && (
        <>
          {/* ── Margin banner ── */}
          <div style={{
            background: A.bgCard,
            borderRadius: 16,
            border: `1px solid ${margin >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
            padding: '24px 28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              {/* Net margin — dominant */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Net Margin</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: marginColor(margin), fontFamily: A.font, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {margin >= 0 ? '+' : ''}{usdDec(margin)}
                </div>
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginTop: 6 }}>Commission received - Absorbed expenses</div>
              </div>

              {/* Metrics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, flex: 1, minWidth: 300 }}>
                <Metric label='Trip Value'    value={usdDec(summary.total_rate)} />
                <Metric
                  label='Commission'
                  value={usdDec(summary.total_commission)}
                  sub={`${usdDec(summary.net_commission_expected)} net expected`}
                />
                <Metric
                  label='Received'
                  value={usdDec(summary.commission_received)}
                  color='#4ade80'
                />
                {summary.commission_outstanding > 0
                  ? <Metric label='Outstanding' value={usdDec(summary.commission_outstanding)} color='#FBBF24' />
                  : <Metric label='Outstanding' value='Clear' color='#4ade80' />
                }
                {summary.total_net_revenue !== summary.total_commission && (
                  <Metric label='Net Revenue' value={usdDec(summary.total_net_revenue)} sub='after partner shares' />
                )}
                {summary.total_amenities > 0 && <Metric label='Amenities' value={usdDec(summary.total_amenities)} />}
                <Metric label='Absorbed' value={usdDec(summary.total_absorbed)} color={summary.total_absorbed > 0 ? '#ef4444' : A.text} />
                {summary.total_billable > 0 && <Metric label='Billable' value={usdDec(summary.total_billable)} color='#93C5FD' />}
              </div>
            </div>
          </div>

          {/* ── Bookings ── */}
          {bookings.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 12 }}>
                Bookings · {bookings.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bookings.map(b => (
                  <BookingRow key={b.id} booking={b} platforms={platforms} partners={partners} onUpdated={load} />
                ))}
              </div>
            </div>
          )}

          {/* ── Expenses ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font }}>
                Expenses{expenses.length > 0 ? ` · ${expenses.length}` : ''}
              </div>
            </div>
            {expenses.length === 0 && (
              <div style={{ fontSize: 13, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>No expenses recorded.</div>
            )}
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