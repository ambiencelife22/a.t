// ImmerseChildEngagements.tsx - shape-agnostic renderer for child engagements
// composed under a node. Groups by shape family (Transport, Dining, etc.),
// renders one card per child with shape-appropriate fields.

import { ImmerseSectionWrap, ImmerseEyebrow } from './ImmerseComponents'
import { C } from '../../types/typesLanding'

const TRANSPORT_SHAPES = new Set(['car_service','airport_transfer','private_jet','flight','heli_transfer','meet_greet','lounge_service','car_rental','public_transport','transport'])

const FAMILY_LABELS: Record<string, string> = {
  transport:         'Transport',
  dining:            'Dining',
  reservation:       'Reservations',
  experience:        'Experiences',
  acquisition:       'Acquisitions',
  arrangement:       'Arrangements',
  stay:              'Stays',
  concierge_service: 'Concierge Services',
  other:             'Other',
}

export function ImmerseChildEngagements({ items }: {
  items: Array<Record<string, unknown>>
}) {
  if (!items.length) return null

  const groups: Record<string, Array<Record<string, unknown>>> = {}
  for (const it of items) {
    const t = (it.elementType as string | null) ?? 'other'
    const family = TRANSPORT_SHAPES.has(t) ? 'transport' : t
    if (!groups[family]) groups[family] = []
    groups[family].push(it)
  }

  return (
    <ImmerseSectionWrap id="child_engagements">
      {Object.entries(groups).map(([family, rows]) => (
        <div key={family} style={{ marginBottom: 40 }}>
          <ImmerseEyebrow>{FAMILY_LABELS[family] ?? family}</ImmerseEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
            {rows.map(r => (
              <ChildEngagementCard key={r.id as string} row={r} />
            ))}
          </div>
        </div>
      ))}
    </ImmerseSectionWrap>
  )
}

function ChildEngagementCard({ row }: { row: Record<string, unknown> }) {
  const title = (row.title as string | null) ?? ''
  const elementType = (row.elementType as string | null) ?? ''
  const date = (row.activityDate as string | null) ?? ''
  const startTime = (row.activityStartTime as string | null) ?? ''

  const vehicle = row.travelVehicles as { displayName?: string; maxPassengerCapacity?: number; maxLuggageCapacity?: number } | null | undefined
  const vehicleName = vehicle?.displayName ?? null
  const passengerCount = (row.passengerCount as number | null) ?? null
  const luggageCount = (row.luggageCount as number | null) ?? null
  const serviceType = (row.serviceType as string | null) ?? null
  const pickup = (row.pickupLocation as string | null) ?? null
  const dropoff = (row.dropoffLocation as string | null) ?? null
  const serviceHours = (row.serviceHours as string | null) ?? null
  const baseRate = (row.baseRate as number | null) ?? null
  const baseRateUnit = (row.baseRateUnit as string | null) ?? null
  const baseRateCurrency = (row.baseRateCurrency as string | null) ?? null
  const overtimeRate = (row.overtimeRate as number | null) ?? null
  const overtimeRateUnit = (row.overtimeRateUnit as string | null) ?? null

  const currencyLabel = baseRateCurrency === 'EUR' ? 'EURO' : baseRateCurrency === 'USD' ? 'USD $' : baseRateCurrency
  const overtimeUnitLabel = overtimeRateUnit === 'per_hour' ? 'each additional hour' : overtimeRateUnit === 'per_half_hour' ? 'each additional half hour' : ''

  const isTransport = TRANSPORT_SHAPES.has(elementType)

  return (
    <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 9, fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A7A7A', marginBottom: 8 }}>
        {(row.elementTypeLabel as string | null) ?? elementType}
      </div>
      <div style={{ fontSize: 17, fontFamily: 'Cormorant Garamond, serif', color: '#1A1A1A', marginBottom: 8 }}>{title}</div>
      {date && (
        <div style={{ fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#7A7A7A', marginBottom: 6 }}>
          {date}{startTime ? ` · ${startTime.slice(0,5)}` : ''}
        </div>
      )}
      {isTransport && vehicleName && (
        <div style={{ fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#1A1A1A', marginBottom: 4 }}>
          {vehicleName}
          {passengerCount ? ` · ${passengerCount} passenger${passengerCount === 1 ? '' : 's'}` : ''}
          {luggageCount ? `, ${luggageCount} luggage` : ''}
        </div>
      )}
      {pickup && dropoff && (
        <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: '#7A7A7A', marginBottom: 4 }}>
          {pickup} to {dropoff}
        </div>
      )}
      {serviceType === 'disposal' && serviceHours && (
        <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: '#7A7A7A', marginBottom: 4 }}>
          Disposal · {serviceHours}
        </div>
      )}
      {baseRate !== null && baseRateCurrency && (
        <div style={{ fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#1A1A1A', marginTop: 8 }}>
          {currencyLabel} {baseRate.toLocaleString()}
        </div>
      )}
      {overtimeRate !== null && baseRateCurrency && overtimeUnitLabel && (
        <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: '#7A7A7A', marginTop: 2 }}>
          {currencyLabel} {overtimeRate.toLocaleString()} {overtimeUnitLabel}
        </div>
      )}
    </div>
  )
}