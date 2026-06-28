// supabase/functions/travel-read-expenses/index.ts
//
// Edge Function: travel-read-expenses
// Class A — admin-only. All read paths for the Financial Module v1.
//
// Modes:
//   by_engagement      { engagement_id }  → { expenses[], summary }
//   by_engagement_full { engagement_id }  → { engagement, bookings[], expenses[], summary }
//     bookings[] each contain nested rooms[] from travel_booking_rooms
//   by_destination     { destination_id } → { expenses[] }
//   summary            { engagement_id }  → financial summary
//   pipeline           {}                 → all confirmed trips with financials
//
// Last updated: S53G v3 — by_engagement_full: rooms nested under bookings,
//   net_revenue computed as commission minus partner shares,
//   booking_type_label resolved from travel_accom_hotels for hotel bookings.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type Mode = 'by_engagement' | 'by_engagement_full' | 'by_destination' | 'summary' | 'pipeline'

const EXPENSE_SELECT = `
  id, engagement_id, booking_id, destination_id, team_member_id,
  expense_type, description, total_amount, currency, billing_status,
  paid_at, billed_at, reimbursed_at, linked_at, notes,
  created_by, created_at, updated_at,
  items:travel_expense_items(
    id, expense_id, item_type, description, amount,
    receipt_ref, deductibility, recipient_id, paid_by, paid_at, sort_order
  )
`

const BOOKING_FINANCIAL_SELECT = `
  id, name, booking_type, accom_hotel_id, start_date, end_date, nights, currency,
  cost,
  total_rate, total_rate_usd,
  commissionable_rate, commissionable_rate_usd,
  commission_pct, commission_amount, commission_amount_usd, commission_paid_at,
  net_revenue, net_revenue_usd,
  taxes_and_fees, taxes_and_fees_usd,
  referral_share_amt, iata_share_amt, individual_share_amt,
  deposit_amount, deposit_due_date, deposit_paid_at,
  balance_amount, balance_due_date, balance_paid_at,
  invoice_number, rate_type, sort_order
`

const ROOM_SELECT = `
  id, booking_id, room_name, confirmation_number, guest_name,
  nights, rate, tax_pct, total, sort_order, check_in_time,
  deposit_amount, balance_amount, brief_image_src
`

function deriveSummary(expenses: Array<Record<string, unknown>>) {
  const absorbed    = expenses.filter(e => e.billing_status === 'absorbed' || e.billing_status === 'written_off').reduce((s, e) => s + (e.total_amount as number), 0)
  const billable    = expenses.filter(e => e.billing_status === 'billable').reduce((s, e) => s + (e.total_amount as number), 0)
  const outstanding = expenses.filter(e => e.billing_status === 'billed').reduce((s, e) => s + (e.total_amount as number), 0)
  const paid        = expenses.filter(e => e.billing_status === 'paid').reduce((s, e) => s + (e.total_amount as number), 0)
  return { total_absorbed: absorbed, total_billable: billable, total_outstanding: outstanding, total_paid: paid }
}

function groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of arr) {
    const k = item[key] as string
    ;(out[k] ??= []).push(item)
  }
  return out
}

// Net revenue = commission minus all partner shares
function computeNetRevenue(b: Record<string, unknown>): number {
  const comm     = (b.commission_amount_usd ?? b.commission_amount ?? 0) as number
  const referral = (b.referral_share_amt   ?? 0) as number
  const iata     = (b.iata_share_amt       ?? 0) as number
  const indiv    = (b.individual_share_amt ?? 0) as number
  return Math.round((comm - referral - iata - indiv) * 100) / 100
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as Mode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    // ── by_engagement ────────────────────────────────────────────────────────
    if (mode === 'by_engagement') {
      const engagement_id = body?.engagement_id as string | undefined
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .select(EXPENSE_SELECT)
        .eq('engagement_id', engagement_id)
        .order('created_at', { ascending: false })
      if (error) { console.error(error); return json({ error: 'Failed to fetch expenses' }, 500) }
      const expenses = (data ?? []) as Array<Record<string, unknown>>
      return json({ expenses, summary: deriveSummary(expenses) })
    }

    // ── by_engagement_full ───────────────────────────────────────────────────
    if (mode === 'by_engagement_full') {
      const engagement_id = body?.engagement_id as string | undefined
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)

      const [engRes, bookingsRes, expensesRes] = await Promise.all([
        db.from('travel_immerse_engagements')
          .select('id, title, url_id, travel_trips!trip_id(trip_code, start_date, end_date)')
          .eq('id', engagement_id)
          .single(),
        db.from('travel_bookings')
          .select(BOOKING_FINANCIAL_SELECT)
          .eq('engagement_id', engagement_id)
          .order('sort_order', { ascending: true }),
        db.from('travel_engagement_expenses')
          .select(EXPENSE_SELECT)
          .eq('engagement_id', engagement_id)
          .order('created_at', { ascending: false }),
      ])

      if (engRes.error) { console.error(engRes.error); return json({ error: 'Failed to fetch engagement' }, 500) }
      if (bookingsRes.error) { console.error(bookingsRes.error); return json({ error: 'Failed to fetch bookings' }, 500) }
      if (expensesRes.error) { console.error(expensesRes.error); return json({ error: 'Failed to fetch expenses' }, 500) }

      const bookings = (bookingsRes.data ?? []) as Array<Record<string, unknown>>
      const expenses = (expensesRes.data ?? []) as Array<Record<string, unknown>>

      // Fetch rooms for all bookings
      const bookingIds = bookings.map(b => b.id as string)
      const roomsByBooking: Record<string, Array<Record<string, unknown>>> = {}
      if (bookingIds.length > 0) {
        const { data: rooms } = await db
          .from('travel_booking_rooms')
          .select(ROOM_SELECT)
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
        for (const r of (rooms ?? []) as Array<Record<string, unknown>>) {
          const bid = r.booking_id as string
          ;(roomsByBooking[bid] ??= []).push(r)
        }
      }

      // Resolve hotel names for hotel bookings
      const hotelIds = [...new Set(bookings.map(b => b.accom_hotel_id).filter(Boolean))] as string[]
      const hotelById: Record<string, string> = {}
      if (hotelIds.length > 0) {
        const { data: hotels } = await db
          .from('travel_accom_hotels')
          .select('id, name')
          .in('id', hotelIds)
        for (const h of (hotels ?? []) as Array<Record<string, unknown>>) {
          hotelById[h.id as string] = h.name as string
        }
      }

      // Summary — computed from original bookings (Record<string, unknown>[]) before enrichment
      const total_commission    = bookings.reduce((s, b) => s + ((b.commission_amount_usd ?? b.commission_amount ?? 0) as number), 0)
      const commission_received = bookings.filter(b => b.commission_paid_at).reduce((s, b) => s + ((b.commission_amount_usd ?? b.commission_amount ?? 0) as number), 0)
      const total_net_revenue   = bookings.reduce((s, b) => s + computeNetRevenue(b), 0)
      const total_rate          = bookings.reduce((s, b) => s + ((b.total_rate_usd ?? b.total_rate ?? 0) as number), 0)
      const total_amenities     = bookings.reduce((s, b) => s + ((b.cost ?? 0) as number), 0)
      const total_referral      = bookings.reduce((s, b) => s + ((b.referral_share_amt ?? 0) as number), 0)
      const total_iata          = bookings.reduce((s, b) => s + ((b.iata_share_amt ?? 0) as number), 0)
      const total_individual    = bookings.reduce((s, b) => s + ((b.individual_share_amt ?? 0) as number), 0)
      const deposit_outstanding = bookings.filter(b => b.deposit_amount && !b.deposit_paid_at).reduce((s, b) => s + ((b.deposit_amount ?? 0) as number), 0)
      const balance_outstanding = bookings.filter(b => b.balance_amount && !b.balance_paid_at).reduce((s, b) => s + ((b.balance_amount ?? 0) as number), 0)

      // Enrich bookings with rooms + resolved hotel name + net_revenue
      const enrichedBookings = bookings.map(b => ({
        ...b,
        hotel_name:      b.accom_hotel_id ? (hotelById[b.accom_hotel_id as string] ?? b.name) : b.name,
        net_revenue_usd: computeNetRevenue(b),
        rooms:           roomsByBooking[b.id as string] ?? [],
      }))

      const expenseSummary = deriveSummary(expenses)
      const net_margin = total_net_revenue - expenseSummary.total_absorbed

      const summary = {
        total_commission,
        commission_received,
        commission_outstanding:  total_commission - commission_received,
        total_rate,
        total_amenities,
        total_net_revenue,
        total_referral,
        total_iata,
        total_individual,
        deposit_outstanding,
        balance_outstanding,
        ...expenseSummary,
        net_margin,
      }

      return json({ engagement: engRes.data, bookings: enrichedBookings, expenses, summary })
    }

    // ── by_destination ───────────────────────────────────────────────────────
    if (mode === 'by_destination') {
      const destination_id = body?.destination_id as string | undefined
      if (!destination_id) return json({ error: 'destination_id is required' }, 400)
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .select(EXPENSE_SELECT)
        .eq('destination_id', destination_id)
        .is('engagement_id', null)
        .order('created_at', { ascending: false })
      if (error) { console.error(error); return json({ error: 'Failed to fetch expenses' }, 500) }
      return json({ expenses: data ?? [] })
    }

    // ── summary ──────────────────────────────────────────────────────────────
    if (mode === 'summary') {
      const engagement_id = body?.engagement_id as string | undefined
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)

      const [{ data: bookings }, { data: expenses }] = await Promise.all([
        db.from('travel_bookings').select('commission_amount, commission_amount_usd, commission_paid_at, cost, referral_share_amt, iata_share_amt, individual_share_amt').eq('engagement_id', engagement_id),
        db.from('travel_engagement_expenses').select('total_amount, billing_status').eq('engagement_id', engagement_id),
      ])

      const bs = (bookings ?? []) as Array<Record<string, unknown>>
      const es = (expenses ?? []) as Array<{ total_amount: number; billing_status: string }>

      const total_commission    = bs.reduce((s, b) => s + ((b.commission_amount_usd ?? b.commission_amount ?? 0) as number), 0)
      const commission_received = bs.filter(b => b.commission_paid_at).reduce((s, b) => s + ((b.commission_amount_usd ?? b.commission_amount ?? 0) as number), 0)
      const total_net_revenue   = bs.reduce((s, b) => s + computeNetRevenue(b), 0)
      const total_absorbed      = es.filter(e => e.billing_status === 'absorbed' || e.billing_status === 'written_off').reduce((s, e) => s + e.total_amount, 0)
      const total_billable      = es.filter(e => e.billing_status === 'billable').reduce((s, e) => s + e.total_amount, 0)
      const total_outstanding   = es.filter(e => e.billing_status === 'billed').reduce((s, e) => s + e.total_amount, 0)
      const net_margin          = total_net_revenue - total_absorbed

      return json({ summary: { total_commission, commission_received, commission_outstanding: total_commission - commission_received, total_net_revenue, total_absorbed, total_billable, total_outstanding, net_margin } })
    }

    // ── pipeline ─────────────────────────────────────────────────────────────
    if (mode === 'pipeline') {
      const { data: engRows, error: engErr } = await db
        .from('travel_immerse_engagements')
        .select(`id, trip_id, url_id, title, travel_lifecycle_statuses!engagement_status_id(slug), travel_trips!trip_id(trip_code, start_date, end_date, primary_client_id)`)
        .is('parent_engagement_id', null)
        .not('trip_id', 'is', null)
        .order('created_at', { ascending: false })
      if (engErr) { console.error(engErr); return json({ error: 'Failed to fetch pipeline' }, 500) }

      const confirmedSlugs = new Set(['confirmed', 'paid', 'in_service', 'closed_won'])
      const confirmed = ((engRows ?? []) as Array<Record<string, unknown>>).filter(e => {
        const s = e.travel_lifecycle_statuses as { slug: string } | { slug: string }[] | null
        const slug = Array.isArray(s) ? s[0]?.slug : s?.slug
        return slug && confirmedSlugs.has(slug)
      })
      if (confirmed.length === 0) return json({ trips: [] })

      const engIds = confirmed.map(e => e.id as string)
      const [{ data: bookings }, { data: expensesAll }] = await Promise.all([
        db.from('travel_bookings').select('engagement_id, commission_amount, commission_amount_usd, commission_paid_at, cost, total_rate_usd, total_rate, referral_share_amt, iata_share_amt, individual_share_amt').in('engagement_id', engIds),
        db.from('travel_engagement_expenses').select('engagement_id, total_amount, billing_status').in('engagement_id', engIds),
      ])

      const bByEng = groupBy((bookings ?? []) as Array<Record<string, unknown>>, 'engagement_id')
      const eByEng = groupBy((expensesAll ?? []) as Array<Record<string, unknown>>, 'engagement_id')

      const trips = confirmed.map(e => {
        const trip = e.travel_trips as Record<string, unknown> | null
        const bs   = (bByEng[e.id as string] ?? []) as Array<Record<string, unknown>>
        const es   = (eByEng[e.id as string] ?? []) as Array<{ total_amount: number; billing_status: string }>

        const total_commission    = bs.reduce((s, b) => s + ((b.commission_amount_usd ?? b.commission_amount ?? 0) as number), 0)
        const commission_received = bs.filter(b => b.commission_paid_at).reduce((s, b) => s + ((b.commission_amount_usd ?? b.commission_amount ?? 0) as number), 0)
        const total_net_revenue   = bs.reduce((s, b) => s + computeNetRevenue(b), 0)
        const total_amenities     = bs.reduce((s, b) => s + ((b.cost ?? 0) as number), 0)
        const total_rate          = bs.reduce((s, b) => s + ((b.total_rate_usd ?? b.total_rate ?? 0) as number), 0)
        const total_absorbed      = es.filter(x => x.billing_status === 'absorbed' || x.billing_status === 'written_off').reduce((s, x) => s + x.total_amount, 0) + total_amenities
        const total_billable      = es.filter(x => x.billing_status === 'billable').reduce((s, x) => s + x.total_amount, 0)
        const total_outstanding   = es.filter(x => x.billing_status === 'billed').reduce((s, x) => s + x.total_amount, 0)
        const net_margin          = total_net_revenue - total_absorbed
        const s = e.travel_lifecycle_statuses as { slug: string } | { slug: string }[] | null
        const status_slug = Array.isArray(s) ? s[0]?.slug : s?.slug

        return {
          engagement_id: e.id, url_id: e.url_id, title: e.title, status_slug,
          trip_code: trip?.trip_code ?? null, start_date: trip?.start_date ?? null,
          end_date: trip?.end_date ?? null, primary_client_id: trip?.primary_client_id ?? null,
          total_commission, commission_received,
          commission_outstanding: total_commission - commission_received,
          total_rate, total_amenities, total_net_revenue,
          total_absorbed, total_billable, total_outstanding, net_margin,
        }
      })
      return json({ trips })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)
  } catch (err) {
    console.error('travel-read-expenses unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})