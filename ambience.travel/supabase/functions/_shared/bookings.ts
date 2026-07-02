// supabase/functions/_shared/bookings.ts
//
// Canonical per-booking lookups. One source for "booking-adjacent" fetches that
// were previously inlined across the read EFs (hotel-name maps in
// travel-read-expenses, travel-read-trip-admin dossier + calendar, and
// _shared/trip.ts). Every consumer routes through these atoms — no parallel copies.
//
// Created: S53K — hotel-lookup consolidation + commission-splits fetch (born shared).

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// booking accom_hotel_ids -> { name, hero_image_src }. Superset shape: callers
// read .name and/or .hero_image_src as needed (calendar adapts to a bare-string
// map at its call site). name defaults to '' (never null) to match every prior
// inline copy's contract.
export async function fetchHotelsByIds(
  db: SupabaseClient,
  hotelIds: string[],
): Promise<Record<string, { name: string; hero_image_src: string | null }>> {
  const out: Record<string, { name: string; hero_image_src: string | null }> = {}
  if (hotelIds.length === 0) return out
  const { data } = await db
    .from('travel_accom_hotels')
    .select('id, name, hero_image_src')
    .in('id', hotelIds)
  for (const h of (data ?? []) as Array<Record<string, unknown>>) {
    out[h.id as string] = {
      name:           (h.name as string) ?? '',
      hero_image_src: (h.hero_image_src as string | null) ?? null,
    }
  }
  return out
}

// booking ids -> commission split nodes (travel_commission_splits), grouped by
// booking. resolved_amount is the overlay (override); estimated_amount is canon
// (the rule's suggestion). computeNetRevenue reads flow + these amounts.
export async function fetchSplitsByBooking(
  db: SupabaseClient,
  bookingIds: string[],
): Promise<Record<string, Array<Record<string, unknown>>>> {
  const out: Record<string, Array<Record<string, unknown>>> = {}
  if (bookingIds.length === 0) return out
  const { data } = await db
    .from('travel_commission_splits')
    .select('id, booking_id, partner_id, flow, rule_pct, rule_base, estimated_amount, resolved_amount, is_estimated, parent_split_id, sort_order')
    .in('booking_id', bookingIds)
    .order('sort_order', { ascending: true })
  for (const s of (data ?? []) as Array<Record<string, unknown>>) {
    const bid = s.booking_id as string
    ;(out[bid] ??= []).push(s)
  }
  return out
}