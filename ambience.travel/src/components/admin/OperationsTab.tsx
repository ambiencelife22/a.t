/* OperationsTab.tsx
 * Operations Console — cross-client financial dashboard.
 *
 * Surfaces: summary strip, bookings table filterable by status/type/partner.
 * Data: fetchOpsPortfolio() from adminOperationsQueries — no house_id filter.
 *
 * Layout:
 *   - Summary strip: 6 KPI cards (gross, commission, paid, unpaid, deposits, balances)
 *   - Filter bar: status, booking type, partner
 *   - Bookings list: grouped by trip, expandable booking cards
 *
 * Last updated: S44 — initial ship.
 */

import { useEffect, useMemo, useState } from 'react'
import { A } from '../../tokens/tokensAdmin'
import {
  inputStyle,
  btnPrimary as btnP,
  btnGhost as btnG,
} from '../../styles/stylesAdmin'
import { AdminSection, AdminEmptyState, useAdminToast } from './_adminPrimitives'
import {
  fetchOpsPortfolio,
  type OpsPortfolio, type OpsTrip, type OpsBooking, type OpsSummary,
} from '../../queries/queriesAdminOperations'
import type { TripPartner } from '../../queries/queriesAdminTrip'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isOverdue(dateIso: string | null): boolean {
  if (!dateIso) return false
  return new Date(dateIso.slice(0, 10) + 'T00:00:00') < new Date()
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: {
  label:   string
  value:   string
  sub?:    string
  accent?: string
}) {
  return (
    <div style={{
      background:   A.bgCard,
      border:       `1px solid ${accent ? accent + '30' : A.border}`,
      borderTop:    accent ? `2px solid ${accent}` : `1px solid ${A.border}`,
      borderRadius: 10,
      padding:      '14px 16px',
      display:      'flex',
      flexDirection:'column',
      gap:          4,
      minWidth:     0,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? A.text, fontFamily: A.font, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{sub}</div>
      )}
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ summary, bookingCount }: { summary: OpsSummary; bookingCount: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
      <KpiCard
        label='Total Gross'
        value={fmt(summary.total_gross)}
        sub={`${summary.total_bookings} bookings · ${summary.confirmed_bookings} confirmed`}
        accent={A.gold}
      />
      <KpiCard
        label='Total Commission'
        value={fmt(summary.total_commission)}
        accent={A.gold}
      />
      <KpiCard
        label='Commission Paid'
        value={fmt(summary.commission_paid)}
        accent='#4ade80'
      />
      <KpiCard
        label='Commission Unpaid'
        value={fmt(summary.commission_unpaid)}
        accent={summary.commission_unpaid > 0 ? '#fbbf24' : A.faint}
      />
      <KpiCard
        label='Deposits Outstanding'
        value={fmt(summary.deposits_outstanding)}
        accent={summary.deposits_outstanding > 0 ? '#f87171' : A.faint}
      />
      <KpiCard
        label='Balances Outstanding'
        value={fmt(summary.balances_outstanding)}
        accent={summary.balances_outstanding > 0 ? '#f87171' : A.faint}
      />
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type Filters = {
  status:      string
  bookingType: string
  partnerId:   string
  search:      string
}

function FilterBar({ filters, onChange, partners, bookingTypes, statuses }: {
  filters:      Filters
  onChange:     (f: Partial<Filters>) => void
  partners:     TripPartner[]
  bookingTypes: string[]
  statuses:     string[]
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
      <input
        style={{ ...inputStyle, width: 200, flex: '1 1 160px' }}
        placeholder='Search trip, house, hotel...'
        value={filters.search}
        onChange={e => onChange({ search: e.target.value })}
      />
      <select
        style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
        value={filters.status}
        onChange={e => onChange({ status: e.target.value })}
      >
        <option value=''>All statuses</option>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
        value={filters.bookingType}
        onChange={e => onChange({ bookingType: e.target.value })}
      >
        <option value=''>All types</option>
        {bookingTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select
        style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
        value={filters.partnerId}
        onChange={e => onChange({ partnerId: e.target.value })}
      >
        <option value=''>All partners</option>
        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {(filters.status || filters.bookingType || filters.partnerId || filters.search) && (
        <button
          onClick={() => onChange({ status: '', bookingType: '', partnerId: '', search: '' })}
          style={{ ...btnG, padding: '6px 12px', fontSize: 11 }}
        >
          Clear
        </button>
      )}
    </div>
  )
}

// ── Booking status pip ────────────────────────────────────────────────────────

function StatusPip({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    Confirmed: '#4ade80',
    Quoted:    '#fbbf24',
    Pending:   '#93c5fd',
    Cancelled: '#f87171',
    Completed: '#86efac',
  }
  const color = map[status ?? ''] ?? A.faint
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, fontFamily: A.font,
      color, padding: '2px 7px', borderRadius: 10,
      background: color + '12', border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>
      {status ?? 'Unknown'}
    </span>
  )
}

// ── Payment cell ──────────────────────────────────────────────────────────────

function PaymentCell({ amount, dueDate, paidAt, label }: {
  amount:  number | null
  dueDate: string | null
  paidAt:  string | null
  label:   string
}) {
  if (!amount) return <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>--</span>
  const paid     = !!paidAt
  const overdue  = !paid && isOverdue(dueDate)
  const color    = paid ? '#4ade80' : overdue ? '#f87171' : '#fbbf24'
  const sublabel = paid ? `Paid ${fmtDate(paidAt)}` : dueDate ? `Due ${fmtDate(dueDate)}` : 'No due date'
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(amount)}</div>
      <div style={{ fontSize: 10, color, fontFamily: A.font }}>{sublabel}</div>
    </div>
  )
}

// ── Booking row (expanded detail) ─────────────────────────────────────────────

function BookingRow({ booking: b, partners }: {
  booking:  OpsBooking
  partners: Record<string, TripPartner>
}) {
  const [expanded, setExpanded] = useState(false)

  const iataPartner  = b.iata_partner_id      ? partners[b.iata_partner_id]      : null
  const refPartner   = b.referral_partner_id   ? partners[b.referral_partner_id]  : null
  const indivPartner = b.individual_id         ? partners[b.individual_id]        : null
  const currency     = b.currency ?? 'USD'

  const typeColor = b.booking_type === 'Hotel'  ? A.gold
    : b.booking_type === 'Flight' ? '#93c5fd'
    : A.border

  const supplierName = b._hotel_name ?? b.supplier_name_override ?? null

  return (
    <div style={{
      borderLeft:   `3px solid ${typeColor}`,
      background:   A.bg,
      border:       `1px solid ${A.border}`,
      borderRadius: 7,
      overflow:     'hidden',
    }}>
      {/* Summary row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display:    'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap:        12,
          padding:    '10px 14px',
          cursor:     'pointer',
          alignItems: 'center',
        }}
      >
        {/* Name + supplier */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.name ?? supplierName ?? b.booking_type ?? 'Booking'}
            </span>
            <StatusPip status={b.status} />
          </div>
          {supplierName && b.name && b.name !== supplierName && (
            <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font, marginTop: 2 }}>{supplierName}</div>
          )}
          {b.start_date && (
            <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2 }}>
              {fmtDate(b.start_date)}{b.nights ? ` · ${b.nights}N` : ''}
            </div>
          )}
        </div>

        {/* Commission */}
        <div>
          {b.commission_amount != null ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(b.commission_amount, currency)}</div>
              <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>
                {b.commission_pct}% · {b.commission_paid_at ? 'Paid' : 'Unpaid'}
              </div>
            </>
          ) : <span style={{ fontSize: 11, color: A.faint }}>--</span>}
        </div>

        {/* Deposit */}
        <PaymentCell amount={b.deposit_amount} dueDate={b.deposit_due_date} paidAt={b.deposit_paid_at} label='Deposit' />

        {/* Balance */}
        <PaymentCell amount={b.balance_amount} dueDate={b.balance_due_date} paidAt={b.balance_paid_at} label='Balance' />

        {/* Expand chevron */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 12, color: A.faint,
            display: 'inline-block',
            transition: 'transform 150ms ease',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}>›</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Rate */}
          {(b.commissionable_rate != null || b.total_rate != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {b.commissionable_rate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Comm. Rate/N</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.commissionable_rate, currency)}</div>
                  {b.rate_type && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.rate_type}</div>}
                </div>
              )}
              {b.total_rate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Total Rate/N</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.total_rate, currency)}</div>
                  {b.taxes_and_fees != null && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.taxes_and_fees}% taxes</div>}
                </div>
              )}
              {b.confirmation_number && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Confirmation</div>
                  <div style={{ fontSize: 11, color: A.text, fontFamily: 'DM Mono, monospace' }}>{b.confirmation_number}</div>
                </div>
              )}
            </div>
          )}

          {/* Partner splits */}
          {(iataPartner || refPartner || indivPartner) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 6 }}>Commission Splits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {iataPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{iataPartner.name} <span style={{ fontSize: 10, color: A.faint }}>IATA</span></span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{b.iata_share_pct}% · {fmt(b.iata_share_amt ?? 0, currency)}</span>
                  </div>
                )}
                {refPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{refPartner.name} <span style={{ fontSize: 10, color: A.faint }}>Referral</span></span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{b.referral_share_pct}% · {fmt(b.referral_share_amt ?? 0, currency)}</span>
                  </div>
                )}
                {indivPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{indivPartner.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: A.text, fontFamily: A.font }}>{b.individual_share_pct}% · {fmt(b.individual_share_amt ?? 0, currency)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancellation */}
          {b.cancellation_policy && (
            <div style={{ padding: '6px 10px', background: '#f8717108', border: '1px solid #f8717118', borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f87171', fontFamily: A.font, marginBottom: 2 }}>Cancellation</div>
              <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{b.cancellation_policy}</div>
            </div>
          )}

          {b.notes && (
            <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{b.notes}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Trip group ────────────────────────────────────────────────────────────────

function TripGroup({ trip, partners, defaultExpanded }: {
  trip:            OpsTrip
  partners:        Record<string, TripPartner>
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const tripCommission = trip.bookings.reduce((s, b) => s + (b.commission_amount ?? 0), 0)

  const statusColor: Record<string, string> = {
    active: '#4ade80', completed: '#86efac', cancelled: '#f87171', draft: A.faint,
  }
  const tripColor = statusColor[trip.status ?? ''] ?? A.gold

  return (
    <div style={{
      background:   A.bgCard,
      border:       `1px solid ${expanded ? A.gold + '30' : A.border}`,
      borderRadius: 10,
      overflow:     'hidden',
      transition:   'border-color 150ms ease',
    }}>
      {/* Trip header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px',
          cursor:         'pointer',
          gap:            12,
          userSelect:     'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          {/* Trip code */}
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>
            {trip.trip_code}
          </span>
          {/* House name */}
          {trip._house_name && (
            <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{trip._house_name}</span>
          )}
          {/* Status */}
          <span style={{ fontSize: 10, fontWeight: 700, color: tripColor, fontFamily: A.font, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {trip.status ?? 'Unknown'}
          </span>
          {/* Dates */}
          {trip.start_date && (
            <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {fmtDate(trip.start_date)}{trip.end_date ? ` – ${fmtDate(trip.end_date)}` : ''}
              {trip.duration_nights ? ` · ${trip.duration_nights}N` : ''}
            </span>
          )}
          {/* Booking count */}
          <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>
            {trip.bookings.length} booking{trip.bookings.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {tripCommission > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: A.gold, fontFamily: A.font }}>
              {fmt(tripCommission)}
            </span>
          )}
          <span style={{
            fontSize: 13, color: A.faint,
            display: 'inline-block',
            transition: 'transform 150ms ease',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}>›</span>
        </div>
      </div>

      {/* Bookings */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: 12,
            padding: '0 14px 6px',
          }}>
            {['Booking', 'Commission', 'Deposit', 'Balance', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                {h}
              </div>
            ))}
          </div>
          {trip.bookings.length === 0
            ? <AdminEmptyState message='No bookings on this trip.' />
            : trip.bookings.map(b => (
              <BookingRow key={b.id} booking={b} partners={partners} />
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Payment pipeline section ──────────────────────────────────────────────────

function PaymentPipeline({ trips }: { trips: OpsTrip[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const items: Array<{
    type:      'deposit' | 'balance'
    booking:   OpsBooking
    dueDate:   string
    amount:    number
    overdue:   boolean
    tripCode:  string
    houseName: string | null
  }> = []

  for (const trip of trips) {
    for (const b of trip.bookings) {
      if (b.deposit_amount && !b.deposit_paid_at && b.deposit_due_date) {
        items.push({
          type:      'deposit',
          booking:   b,
          dueDate:   b.deposit_due_date,
          amount:    b.deposit_amount,
          overdue:   isOverdue(b.deposit_due_date),
          tripCode:  trip.trip_code,
          houseName: trip._house_name,
        })
      }
      if (b.balance_amount && !b.balance_paid_at && b.balance_due_date) {
        items.push({
          type:      'balance',
          booking:   b,
          dueDate:   b.balance_due_date,
          amount:    b.balance_amount,
          overdue:   isOverdue(b.balance_due_date),
          tripCode:  trip.trip_code,
          houseName: trip._house_name,
        })
      }
    }
  }

  // Sort by due date ascending
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  if (items.length === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <AdminSection title={`Payment Pipeline · ${items.length} outstanding`} style={{ borderLeftColor: '#f8717160' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => {
          const color = item.overdue ? '#f87171' : '#fbbf24'
          return (
            <div key={i} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              padding:      '10px 14px',
              background:   A.bgCard,
              border:       `1px solid ${A.border}`,
              borderLeft:   `3px solid ${color}`,
              borderRadius: 7,
              flexWrap:     'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>
                    {item.booking.name ?? item.booking._hotel_name ?? 'Booking'}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color, fontFamily: A.font, textTransform: 'uppercase' }}>
                    {item.overdue ? 'Overdue' : 'Due'} {fmtDate(item.dueDate)}
                  </span>
                  <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>{item.tripCode}</span>
                  {item.houseName && <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{item.houseName}</span>}
                </div>
                <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font, marginTop: 2, textTransform: 'capitalize' }}>
                  {item.type}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: A.font, flexShrink: 0 }}>
                {fmt(item.amount, item.booking.currency ?? 'USD')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── OperationsTab — exported ──────────────────────────────────────────────────

export function OperationsTab() {
  const [portfolio, setPortfolio] = useState<OpsPortfolio | null>(null)
  const [loading, setLoading]     = useState(true)
  const { error }                 = useAdminToast()
  const [filters, setFilters]     = useState<Filters>({
    status: '', bookingType: '', partnerId: '', search: '',
  })

  useEffect(() => {
    fetchOpsPortfolio()
      .then(setPortfolio)
      .catch(e => error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // Derive filter options from data
  const { statuses, bookingTypes, partnerList } = useMemo(() => {
    if (!portfolio) return { statuses: [], bookingTypes: [], partnerList: [] }
    const statusSet = new Set<string>()
    const typeSet   = new Set<string>()
    for (const trip of portfolio.trips) {
      for (const b of trip.bookings) {
        if (b.status)       statusSet.add(b.status)
        if (b.booking_type) typeSet.add(b.booking_type)
      }
    }
    const partnerList = Object.values(portfolio.partners).filter(p => p.is_active)
    return {
      statuses:     [...statusSet].sort(),
      bookingTypes: [...typeSet].sort(),
      partnerList,
    }
  }, [portfolio])

  // Filter trips/bookings
  const filteredTrips = useMemo(() => {
    if (!portfolio) return []
    const { status, bookingType, partnerId, search } = filters
    const q = search.toLowerCase().trim()

    return portfolio.trips
      .map(trip => {
        let bookings = trip.bookings

        if (status)      bookings = bookings.filter(b => b.status === status)
        if (bookingType) bookings = bookings.filter(b => b.booking_type === bookingType)
        if (partnerId)   bookings = bookings.filter(b =>
          b.iata_partner_id === partnerId ||
          b.referral_partner_id === partnerId ||
          b.individual_id === partnerId
        )
        if (q) bookings = bookings.filter(b =>
          (b.name ?? '').toLowerCase().includes(q) ||
          (b._hotel_name ?? '').toLowerCase().includes(q) ||
          trip.trip_code.toLowerCase().includes(q) ||
          (trip._house_name ?? '').toLowerCase().includes(q)
        )

        return { ...trip, bookings }
      })
      .filter(trip => trip.bookings.length > 0)
  }, [portfolio, filters])

  const totalFilteredBookings = filteredTrips.reduce((s, t) => s + t.bookings.length, 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font, letterSpacing: '0.06em' }}>Loading portfolio...</div>
      </div>
    )
  }

  if (!portfolio) return <AdminEmptyState message='Failed to load operations data.' />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: A.gold, fontFamily: A.font, marginBottom: 4 }}>
          ambience · TRAVEL
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: A.text, fontFamily: A.font, letterSpacing: '-0.02em', marginBottom: 2 }}>
          Operations Console
        </div>
        <div style={{ fontSize: 12, color: A.faint, fontFamily: A.font }}>
          {portfolio.trips.length} trip{portfolio.trips.length !== 1 ? 's' : ''} · {portfolio.trips.reduce((s, t) => s + t.bookings.length, 0)} bookings
        </div>
      </div>

      {/* KPI strip */}
      <SummaryStrip summary={portfolio.summary} bookingCount={totalFilteredBookings} />

      {/* Payment pipeline */}
      <PaymentPipeline trips={portfolio.trips} />

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={patch => setFilters(f => ({ ...f, ...patch }))}
        partners={partnerList}
        bookingTypes={bookingTypes}
        statuses={statuses}
      />

      {/* Results count */}
      {(filters.status || filters.bookingType || filters.partnerId || filters.search) && (
        <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, marginBottom: 10 }}>
          {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''} · {totalFilteredBookings} booking{totalFilteredBookings !== 1 ? 's' : ''}
        </div>
      )}

      {/* Trip groups */}
      {filteredTrips.length === 0 ? (
        <AdminEmptyState message='No bookings match the current filters.' />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredTrips.map((trip, i) => (
            <TripGroup
              key={trip.id}
              trip={trip}
              partners={portfolio.partners}
              defaultExpanded={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}