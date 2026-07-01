// supabase/functions/travel-read-ops-admin/index.ts
//
// Edge Function: travel-read-ops-admin
// Single source for all admin-side operations portfolio reads.
// Replaces 8 direct supabase.from() calls in queriesAdminOperations.ts.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (platform gate)
//   - Caller must be authenticated + admin (global_profiles.is_admin = true)
//   - Reads execute via service role to bypass RLS uniformly
//   - Auth via requireAdmin (_shared/auth.ts)
//
// Modes:
//   portfolio — full cross-client trip+booking+partner+house assembly → OpsPortfolio
//
// House resolution: travel_bookings.house_id → a_houses (direct FK).
// Replaces the legacy engagement→person→house chain (fragile, indirect).
//
// Deployed at: /functions/v1/travel-read-ops-admin
// Created: S53G

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    if (mode === 'portfolio') {
      // ── 1. Trips ────────────────────────────────────────────────────────────
      const { data: tripData, error: tripErr } = await db
        .from('travel_trips')
        .select('id, trip_code, confirmed_engagement_id, start_date, end_date, duration_nights, trip_type, destinations')
        .order('start_date', { ascending: false, nullsFirst: false })

      if (tripErr) {
        console.error('portfolio trips error:', tripErr)
        return json({ error: 'Failed to fetch trips' }, 500)
      }

      const tripRows = (tripData ?? []) as Array<Record<string, unknown>>
      if (tripRows.length === 0) {
        return json({ trips: [], partners: {}, summary: emptySummary() })
      }

      const tripIds = tripRows.map(t => t.id as string)

      // ── 2. Parallel: bookings + partners + engagement statuses ───────────────
      const [bookResult, partnerResult, engStatusResult] = await Promise.all([
        db.from('travel_bookings')
          .select('id, trip_id, house_id, engagement_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, currency, commissionable_rate, total_rate, taxes_and_fees, rate_type, price, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, payment_exception_override, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, cost, cancellation_policy, notes, sort_order, created_at')
          .in('trip_id', tripIds)
          .order('start_date', { ascending: true, nullsFirst: false }),

        db.from('travel_partners')
          .select('id, name, partner_type, default_share_pct, currency, is_active'),

        // Winning engagement status slugs for stage derivation
        db.from('travel_immerse_engagements')
          .select('id, travel_lifecycle_statuses(slug)')
          .in('id', tripRows
            .map(t => t.confirmed_engagement_id as string | null)
            .filter((id): id is string => !!id)
          ),
      ])

      if (bookResult.error)   return json({ error: 'Failed to fetch bookings' }, 500)
      if (partnerResult.error) return json({ error: 'Failed to fetch partners' }, 500)

      const bookingRows = (bookResult.data ?? []) as Array<Record<string, unknown>>

      // ── 3. Hotel names ───────────────────────────────────────────────────────
      const hotelIds = [...new Set(
        bookingRows.map(b => b.accom_hotel_id as string | null).filter((id): id is string => !!id)
      )]
      const hotelNameMap = new Map<string, string>()
      if (hotelIds.length > 0) {
        const { data: hotelData } = await db
          .from('travel_accom_hotels')
          .select('id, name')
          .in('id', hotelIds)
        for (const h of (hotelData ?? []) as Array<{ id: string; name: string }>) {
          hotelNameMap.set(h.id, h.name)
        }
      }

      // ── 4. House names — direct from booking.house_id ────────────────────────
      const houseIds = [...new Set(
        bookingRows.map(b => b.house_id as string | null).filter((id): id is string => !!id)
      )]
      const houseMap = new Map<string, { name: string; id: string }>()
      if (houseIds.length > 0) {
        const { data: houseData } = await db
          .from('a_houses')
          .select('id, display_name')
          .in('id', houseIds)
        for (const h of (houseData ?? []) as Array<{ id: string; display_name: string }>) {
          houseMap.set(h.id, { name: h.display_name, id: h.id })
        }
      }

      // trip_id -> { house_name, house_id } via first booking with house_id
      const tripHouseMap = new Map<string, { name: string; id: string }>()
      for (const b of bookingRows) {
        const tid = b.trip_id as string
        const hid = b.house_id as string | null
        if (!tripHouseMap.has(tid) && hid) {
          const house = houseMap.get(hid)
          if (house) tripHouseMap.set(tid, house)
        }
      }

      // ── 5. Stage derivation ──────────────────────────────────────────────────
      const slugByEngId = new Map<string, string>()
      for (const e of (engStatusResult.data ?? []) as Array<{ id: string; travel_lifecycle_statuses: { slug: string } | { slug: string }[] | null }>) {
        const s = Array.isArray(e.travel_lifecycle_statuses) ? e.travel_lifecycle_statuses[0] : e.travel_lifecycle_statuses
        if (s?.slug) slugByEngId.set(e.id, s.slug)
      }

      // Slug → stage derivation (mirrors computeEngagementStage client-side logic)
      function deriveStage(slug: string | undefined): string | null {
        if (!slug) return null
        if (['confirmed', 'paid', 'in_service', 'closed_won'].includes(slug)) return 'trip'
        if (['cancelled', 'closed_lost'].includes(slug)) return 'cancelled'
        if (slug === 'requested') return 'draft'
        return 'proposal'
      }

      // ── 6. Assemble ──────────────────────────────────────────────────────────
      const bookingsByTrip = new Map<string, Array<Record<string, unknown>>>()
      for (const b of bookingRows) {
        const tid = b.trip_id as string
        ;(bookingsByTrip.get(tid) ?? bookingsByTrip.set(tid, []).get(tid)!).push(b)
      }

      const partnerMap: Record<string, unknown> = {}
      for (const p of (partnerResult.data ?? []) as Array<Record<string, unknown>>) {
        partnerMap[p.id as string] = p
      }

      const trips = tripRows.map(t => {
        const tid   = t.id as string
        const house = tripHouseMap.get(tid)
        const engId = t.confirmed_engagement_id as string | null
        const stage = deriveStage(engId ? slugByEngId.get(engId) : undefined)

        const bookings = (bookingsByTrip.get(tid) ?? []).map(b => ({
          ...b,
          _hotel_name: b.accom_hotel_id ? (hotelNameMap.get(b.accom_hotel_id as string) ?? null) : null,
          _trip_code:  t.trip_code,
          _house_name: house?.name ?? null,
          _house_id:   house?.id   ?? null,
        }))

        return {
          id:              tid,
          trip_code:       t.trip_code,
          stage,
          start_date:      t.start_date,
          end_date:        t.end_date,
          duration_nights: t.duration_nights,
          trip_type:       t.trip_type,
          destinations:    t.destinations,
          bookings,
          _house_name:     house?.name ?? null,
          _house_id:       house?.id   ?? null,
        }
      })

      // ── 7. Summary (server-side aggregation) ─────────────────────────────────
      const summary = {
        total_bookings:       0,
        confirmed_bookings:   0,
        total_commission:     0,
        commission_paid:      0,
        commission_unpaid:    0,
        deposits_outstanding: 0,
        balances_outstanding: 0,
        total_gross:          0,
      }

      for (const trip of trips) {
        for (const b of trip.bookings as Array<Record<string, unknown>>) {
          summary.total_bookings++
          if (b.status === 'Confirmed') summary.confirmed_bookings++

          const commission = (b.commission_amount as number | null) ?? 0
          summary.total_commission += commission
          if (b.commission_paid_at) summary.commission_paid   += commission
          else                       summary.commission_unpaid += commission

          const nights = (b.nights as number | null) ?? 1
          const rate   = (b.commissionable_rate as number | null) ?? (b.price as number | null) ?? 0
          summary.total_gross += rate * nights

          if (b.deposit_amount && !b.deposit_paid_at)
            summary.deposits_outstanding += (b.deposit_amount as number)
          if (b.balance_amount && !b.balance_paid_at)
            summary.balances_outstanding += (b.balance_amount as number)
        }
      }

      return json({ trips, partners: partnerMap, summary })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-read-ops-admin unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

function emptySummary() {
  return {
    total_bookings: 0, confirmed_bookings: 0,
    total_commission: 0, commission_paid: 0, commission_unpaid: 0,
    deposits_outstanding: 0, balances_outstanding: 0, total_gross: 0,
  }
}