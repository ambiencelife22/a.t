/* TripDossierSection.tsx
 * Trip Dossier surface for HouseTab.
 *
 * Displays all trips linked to a household via travel_immerse_engagements,
 * with expandable booking cards showing rates, payment status, partner splits,
 * and cancellation policy.
 *
 * Data comes from adminTripQueries.fetchTripDossierForHouse — pre-fetched
 * in HouseDetail.loadAll and passed in as TripDossierData.
 *
 * Last updated: S44 — initial ship.
 */

import { useState } from 'react'
import { A } from '../../lib/adminTokens'
import { AdminEmptyState } from './_adminPrimitives'
import type { TripDossierData, DossierTrip, TripBooking, TripPartner } from '../../lib/adminTripQueries'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--'
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '--'
  // Slice to date-only before constructing to avoid UTC shift
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Small atoms ───────────────────────────────────────────────────────────────

function PaymentBadge({ paid, amount, dueDate, currency }: {
  paid:     boolean
  amount:   number | null
  dueDate:  string | null
  currency: string | null
}) {
  if (amount == null) return null
  const color = paid ? '#4ade80' : '#fbbf24'
  const label = paid ? 'Paid' : `Due ${fmtDate(dueDate)}`
  return (
    <span style={{
      fontSize:   10,
      fontWeight: 700,
      fontFamily: A.font,
      color,
      padding:    '2px 7px',
      borderRadius: 12,
      background: color + '15',
      border:     `1px solid ${color}30`,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function BookingStatusPip({ status }: { status: string | null }) {
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
      fontSize:      10,
      fontWeight:    700,
      fontFamily:    A.font,
      letterSpacing: '0.06em',
      color,
      padding:       '2px 8px',
      borderRadius:  12,
      background:    color + '12',
      border:        `1px solid ${color}30`,
    }}>
      {status ?? 'Unknown'}
    </span>
  )
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{value}</div>
    </div>
  )
}

// ── BookingCard ───────────────────────────────────────────────────────────────

function BookingCard({ booking: b, partners, mobile }: {
  booking:  TripBooking
  partners: Record<string, TripPartner>
  mobile:   boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const iataPartner  = b.iata_partner_id      ? partners[b.iata_partner_id]      : null
  const refPartner   = b.referral_partner_id   ? partners[b.referral_partner_id]  : null
  const indivPartner = b.individual_id         ? partners[b.individual_id]        : null

  const supplierName = b._hotel_name ?? b.supplier_name_override ?? null
  const currency     = b.currency ?? 'USD'
  const depositPaid  = !!b.deposit_paid_at
  const balancePaid  = !!b.balance_paid_at
  const commTotal    = b.commissionable_rate != null && b.nights != null
    ? b.commissionable_rate * b.nights
    : null

  const typeColor = b.booking_type === 'Hotel'  ? A.gold
    : b.booking_type === 'Flight' ? '#93c5fd'
    : A.border

  return (
    <div style={{
      background:   A.bg,
      border:       `1px solid ${A.border}`,
      borderLeft:   `3px solid ${typeColor}`,
      borderRadius: 8,
      overflow:     'hidden',
    }}>
      {/* Summary row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>
              {b.name ?? supplierName ?? b.booking_type ?? 'Booking'}
            </span>
            {b.booking_type && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font }}>
                {b.booking_type}
              </span>
            )}
            <BookingStatusPip status={b.status} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {supplierName && b.name !== supplierName && (
              <span style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{supplierName}</span>
            )}
            {b.start_date && (
              <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
                {fmtDate(b.start_date)}{b.end_date ? ` – ${fmtDate(b.end_date)}` : ''}
                {b.nights ? ` · ${b.nights}N` : ''}
              </span>
            )}
            {b.confirmation_number && (
              <span style={{ fontSize: 10, color: A.faint, fontFamily: 'DM Mono, monospace' }}>
                {b.confirmation_number}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {b.commission_amount != null && (
            <span style={{ fontSize: 12, fontWeight: 700, color: A.gold, fontFamily: A.font }}>
              {fmt(b.commission_amount, currency)}
            </span>
          )}
          <span style={{
            fontSize:   10,
            color:      A.faint,
            display:    'inline-block',
            transition: 'transform 150ms ease',
            transform:  expanded ? 'rotate(90deg)' : 'none',
          }}>›</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Rate grid */}
          {(b.commissionable_rate != null || b.total_rate != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
              {b.commissionable_rate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>
                    Comm. Rate{b.nights && b.nights > 1 ? '/N' : ''}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.commissionable_rate, currency)}</div>
                  {b.rate_type && <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.rate_type}</div>}
                </div>
              )}
              {commTotal != null && b.nights != null && b.nights > 1 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Comm. Total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(commTotal, currency)}</div>
                </div>
              )}
              {b.total_rate != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Total Rate/N</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.total_rate, currency)}</div>
                  {b.taxes_and_fees != null && (
                    <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.taxes_and_fees}% taxes + fees</div>
                  )}
                </div>
              )}
              {b.commission_pct != null && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 3 }}>Commission</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(b.commission_amount, currency)}</div>
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>{b.commission_pct}% gross</div>
                </div>
              )}
            </div>
          )}

          {/* Inclusions */}
          {b.inclusions && (
            <div style={{ padding: '8px 10px', background: `${A.gold}08`, border: `1px solid ${A.gold}20`, borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 4 }}>Inclusions</div>
              <div style={{ fontSize: 12, color: A.muted, fontFamily: A.font, lineHeight: 1.6 }}>{b.inclusions}</div>
            </div>
          )}

          {/* Payment */}
          {(b.deposit_amount != null || b.balance_amount != null) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Payment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.deposit_amount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Deposit </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.deposit_amount, currency)}</span>
                      {depositPaid && b.deposit_paid_at && (
                        <span style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}> · paid {fmtDate(b.deposit_paid_at)}</span>
                      )}
                    </div>
                    <PaymentBadge paid={depositPaid} amount={b.deposit_amount} dueDate={b.deposit_due_date} currency={currency} />
                  </div>
                )}
                {b.balance_amount != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, color: A.text, fontFamily: A.font }}>Balance </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: A.text, fontFamily: A.font }}>{fmt(b.balance_amount, currency)}</span>
                    </div>
                    <PaymentBadge paid={balancePaid} amount={b.balance_amount} dueDate={b.balance_due_date} currency={currency} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Partner splits */}
          {(iataPartner || refPartner || indivPartner) && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 8 }}>Commission Splits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {iataPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
                      {iataPartner.name} <span style={{ fontSize: 10, color: A.faint }}>IATA</span>
                    </span>
                    <span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>
                      {b.iata_share_pct}% · {fmt(b.iata_share_amt, currency)}
                    </span>
                  </div>
                )}
                {refPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>
                      {refPartner.name} <span style={{ fontSize: 10, color: A.faint }}>Referral</span>
                    </span>
                    <span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>
                      {b.referral_share_pct}% · {fmt(b.referral_share_amt, currency)}
                    </span>
                  </div>
                )}
                {indivPartner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: A.muted, fontFamily: A.font }}>{indivPartner.name}</span>
                    <span style={{ fontSize: 12, color: A.text, fontFamily: A.font, fontWeight: 600 }}>
                      {b.individual_share_pct}% · {fmt(b.individual_share_amt, currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancellation + notes */}
          {(b.cancellation_policy || b.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {b.cancellation_policy && (
                <div style={{ padding: '7px 10px', background: '#f8717108', border: '1px solid #f8717118', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f87171', fontFamily: A.font, marginBottom: 3 }}>Cancellation</div>
                  <div style={{ fontSize: 11, color: A.muted, fontFamily: A.font }}>{b.cancellation_policy}</div>
                </div>
              )}
              {b.notes && (
                <div style={{ fontSize: 11, color: A.faint, fontFamily: A.font, fontStyle: 'italic' }}>{b.notes}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TripBlock ─────────────────────────────────────────────────────────────────

function TripBlock({ trip, partners, mobile, expanded, onToggle }: {
  trip:     DossierTrip
  partners: Record<string, TripPartner>
  mobile:   boolean
  expanded: boolean
  onToggle: () => void
}) {
  const statusColor: Record<string, string> = {
    active:    '#4ade80',
    completed: '#86efac',
    cancelled: '#f87171',
    draft:     A.faint,
  }
  const tripColor = statusColor[trip.status ?? ''] ?? A.gold

  const totalCommission = trip.bookings.reduce((s, b) => s + (b.commission_amount ?? 0), 0)
  const totalGross      = trip.bookings.reduce((s, b) => {
    const nights = b.nights ?? 1
    const rate   = b.commissionable_rate ?? b.price ?? 0
    return s + rate * nights
  }, 0)

  return (
    <div style={{
      background:   A.bgCard,
      border:       `1px solid ${expanded ? A.gold + '40' : A.border}`,
      borderRadius: 12,
      overflow:     'hidden',
      transition:   'border-color 150ms ease',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding:        '14px 16px',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          userSelect:     'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: A.text, letterSpacing: '0.04em' }}>
            {trip.trip_code}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: tripColor, fontFamily: A.font, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {trip.status ?? 'Unknown'}
          </span>
          {trip.start_date && (
            <span style={{ fontSize: 11, color: A.faint, fontFamily: A.font }}>
              {fmtDate(trip.start_date)}{trip.end_date ? ` – ${fmtDate(trip.end_date)}` : ''}
              {trip.duration_nights ? ` · ${trip.duration_nights}N` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {totalCommission > 0 && (
            <span style={{ fontSize: 12, color: A.gold, fontFamily: A.font, fontWeight: 600 }}>
              {fmt(totalCommission)} commission
            </span>
          )}
          <span style={{
            fontSize:   14,
            color:      A.faint,
            display:    'inline-block',
            transition: 'transform 150ms ease',
            transform:  expanded ? 'rotate(90deg)' : 'none',
          }}>›</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${A.border}`, padding: '0 16px 16px' }}>

          {/* Meta strip */}
          <div style={{ display: 'flex', gap: 20, padding: '12px 0', flexWrap: 'wrap', borderBottom: `1px solid ${A.border}`, marginBottom: 14 }}>
            {trip.destinations && trip.destinations.length > 0 && (
              <MetaCell label='Destinations' value={trip.destinations.join(', ')} />
            )}
            {(trip.guest_count_adults || trip.guest_count_children) && (
              <MetaCell
                label='Guests'
                value={`${trip.guest_count_adults ?? 0} adult${(trip.guest_count_adults ?? 0) !== 1 ? 's' : ''}${trip.guest_count_children ? `, ${trip.guest_count_children} child${trip.guest_count_children !== 1 ? 'ren' : ''}` : ''}`}
              />
            )}
            {trip.trip_type && (
              <MetaCell label='Type' value={<span style={{ textTransform: 'capitalize' }}>{trip.trip_type}</span>} />
            )}
            {totalCommission > 0 && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: A.faint, fontFamily: A.font, marginBottom: 2 }}>Total Commission</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: A.gold, fontFamily: A.font }}>{fmt(totalCommission)}</div>
                {totalGross > 0 && (
                  <div style={{ fontSize: 10, color: A.faint, fontFamily: A.font }}>on {fmt(totalGross)} gross</div>
                )}
              </div>
            )}
          </div>

          {/* Bookings */}
          {trip.bookings.length === 0 ? (
            <AdminEmptyState message='No bookings on this trip yet.' />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {trip.bookings.map(b => (
                <BookingCard key={b.id} booking={b} partners={partners} mobile={mobile} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TripDossierSection — exported ─────────────────────────────────────────────

export function TripDossierSection({ dossier, mobile }: {
  dossier: TripDossierData
  mobile:  boolean
}) {
  const [expandedTrip, setExpandedTrip] = useState<string | null>(
    dossier.trips.length === 1 ? dossier.trips[0].id : null
  )

  if (dossier.trips.length === 0) {
    return <AdminEmptyState message='No trips linked to this household yet.' />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dossier.trips.map(trip => (
        <TripBlock
          key={trip.id}
          trip={trip}
          partners={dossier.partners}
          mobile={mobile}
          expanded={expandedTrip === trip.id}
          onToggle={() => setExpandedTrip(prev => prev === trip.id ? null : trip.id)}
        />
      ))}
    </div>
  )
}