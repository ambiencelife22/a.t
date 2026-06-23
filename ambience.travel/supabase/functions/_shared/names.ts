// supabase/functions/_shared/names.ts
// Shared name resolution for travel EFs. Extracted S53G from the verbatim
// (and already-drifted) copies in travel-get-trip-confirmation and
// travel-get-trip-programme.
//
// Precedence (single-source): linked person (global_people) → free-text
// override → party label (brief.prepared_for). A person is the source when
// linked; the override is a deliberate one-off; the party label is the trip's
// single client address.
//
// resolvePartyName returns string | null. null means "nothing resolved" —
// callers fall back with ?? per Reference Guide v5 p7 (never ||, which would
// also swallow empty strings). The prior '' sentinel forced || downstream and
// is gone.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Format a global_people row into a display name. Returns '' when no usable
// name exists (caller treats '' as "no person").
export function formatPersonName(gp: Record<string, unknown> | null | undefined): string {
  if (!gp) return ''
  const first = String(gp.first_name ?? '').trim()
  const last  = String(gp.last_name ?? '').trim()
  const nick  = String(gp.nickname ?? '').trim()
  const full  = [first, last].filter(Boolean).join(' ').trim()
  return (nick || full || first || '').trim()
}

// Resolve the canonical party name. null when nothing resolves.
export function resolvePartyName(
  person:     Record<string, unknown> | null | undefined,
  override:   string | null | undefined,
  partyLabel: string | null | undefined,
): string | null {
  const p = formatPersonName(person)
  if (p) return p
  const o = (override ?? '').trim()
  if (o) return o
  const label = (partyLabel ?? '').trim()
  return label === '' ? null : label
}

// Attach resolved_passenger_label to each aux booking's passengers.
// Batch-resolves linked global_people once, then maps per passenger.
export async function attachPassengers(
  db: SupabaseClient,
  aux: Record<string, unknown>[],
  partyLabel: string | null,
): Promise<Record<string, unknown>[]> {
  if (aux.length === 0) return aux
  const ids = aux.map(a => a.id as string)
  const { data: pax } = await db
    .from('travel_trip_aux_passengers')
    .select('id, aux_booking_id, person_id, passenger_label, confirmation_number, seat_numbers, sort_order')
    .in('aux_booking_id', ids)
    .order('sort_order', { ascending: true })

  const personIds = [...new Set((pax ?? []).map((p: Record<string, unknown>) => p.person_id).filter(Boolean))] as string[]
  const peopleById: Record<string, Record<string, unknown>> = {}
  if (personIds.length > 0) {
    const { data: gp } = await db
      .from('global_people')
      .select('id, first_name, last_name, nickname')
      .in('id', personIds)
    for (const g of (gp ?? []) as Record<string, unknown>[]) peopleById[g.id as string] = g
  }

  const byAux: Record<string, Record<string, unknown>[]> = {}
  for (const p of (pax ?? []) as Record<string, unknown>[]) {
    const resolved = resolvePartyName(
      p.person_id ? peopleById[p.person_id as string] : null,
      p.passenger_label as string | null,
      partyLabel,
    )
    ;(byAux[p.aux_booking_id as string] ??= []).push({ ...p, resolved_passenger_label: resolved })
  }
  return aux.map(a => ({ ...a, passengers: byAux[a.id as string] ?? [] }))
}

// Attach client-facing driver vehicles to each ground-car aux booking
// (transfer / airport transfer / car service). Parallel to attachPassengers.
// CLIENT-FACING: selects name/phone/car_model/plate/vehicle_role only — company is
// operator-internal and deliberately OMITTED here, so neither the confirmation nor
// the programme page can leak it. Bookings with no driver rows get an empty array.
export async function attachDriverDetails(
  db: SupabaseClient,
  aux: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (aux.length === 0) return aux
  const ids = aux.map(a => a.id as string)
  const { data: veh } = await db
    .from('travel_aux_driver_details')
    .select('id, aux_booking_id, driver_name, driver_phone, car_model, plate, vehicle_role, sort_order')
    .in('aux_booking_id', ids)
    .order('sort_order', { ascending: true })

  const byAux: Record<string, Record<string, unknown>[]> = {}
  for (const v of (veh ?? []) as Record<string, unknown>[]) {
    ;(byAux[v.aux_booking_id as string] ??= []).push({
      id:           v.id,
      driver_name:  v.driver_name,
      driver_phone: v.driver_phone,
      car_model:    v.car_model,
      plate:        v.plate,
      vehicle_role: v.vehicle_role,
    })
  }
  return aux.map(a => ({ ...a, driver_details: byAux[a.id as string] ?? [] }))
}

// Resolve a room's guest name. Single-source helper for the write EF's
// resolve-on-return: given a room's person_id and guest_name override plus the
// trip's party label, return the resolved name (or null). The write path fetches
// person + prepared_for, then calls this.
export function resolveRoomGuestName(
  person:     Record<string, unknown> | null | undefined,
  guestName:  string | null | undefined,
  partyLabel: string | null | undefined,
): string | null {
  return resolvePartyName(person, guestName, partyLabel)
}