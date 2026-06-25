// supabase/functions/travel-read-expenses/index.ts
//
// Edge Function: travel-read-expenses
// Class A — admin-only. All read paths for the Financial Module v1.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated + admin (global_profiles.is_admin = true)
//   - Service role reads. NEVER exposed on any client surface.
//
// Modes:
//   by_engagement  { engagement_id }  → { expenses[], summary }
//   by_destination { destination_id } → { expenses[] } (proactive/uninstructed only)
//   summary        { engagement_id }  → { net_margin, total_commission, commission_received, total_absorbed, total_billable, total_outstanding }
//   pipeline       {}                 → { trips[] } all confirmed engagements with financials
//
// First ship: S53G Financial Module v1
import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type Mode = 'by_engagement' | 'by_destination' | 'summary' | 'pipeline'

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

function deriveSummary(expenses: Array<Record<string, unknown>>) {
  const absorbed     = expenses.filter(e => e.billing_status === 'absorbed' || e.billing_status === 'written_off').reduce((s, e) => s + (e.total_amount as number), 0)
  const billable     = expenses.filter(e => e.billing_status === 'billable').reduce((s, e) => s + (e.total_amount as number), 0)
  const outstanding  = expenses.filter(e => e.billing_status === 'billed').reduce((s, e) => s + (e.total_amount as number), 0)
  const paid         = expenses.filter(e => e.billing_status === 'paid').reduce((s, e) => s + (e.total_amount as number), 0)
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as Mode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

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

    if (mode === 'summary') {
      const engagement_id = body?.engagement_id as string | undefined
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)

      const [{ data: bookings }, { data: expenses }] = await Promise.all([
        db.from('travel_bookings').select('commission_amount, commission_paid_at').eq('engagement_id', engagement_id),
        db.from('travel_engagement_expenses').select('total_amount, billing_status').eq('engagement_id', engagement_id),
      ])

      const bs = (bookings ?? []) as Array<{ commission_amount: number | null; commission_paid_at: string | null }>
      const es = (expenses ?? []) as Array<{ total_amount: number; billing_status: string }>

      const total_commission      = bs.reduce((s, b) => s + (b.commission_amount ?? 0), 0)
      const commission_received   = bs.filter(b => b.commission_paid_at).reduce((s, b) => s + (b.commission_amount ?? 0), 0)
      const total_absorbed        = es.filter(e => e.billing_status === 'absorbed' || e.billing_status === 'written_off').reduce((s, e) => s + e.total_amount, 0)
      const total_billable        = es.filter(e => e.billing_status === 'billable').reduce((s, e) => s + e.total_amount, 0)
      const total_outstanding     = es.filter(e => e.billing_status === 'billed').reduce((s, e) => s + e.total_amount, 0)
      const net_margin            = total_commission - total_absorbed

      return json({ summary: { total_commission, commission_received, commission_outstanding: total_commission - commission_received, total_absorbed, total_billable, total_outstanding, net_margin } })
    }

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
        db.from('travel_bookings').select('engagement_id, commission_amount, commission_paid_at, cost').in('engagement_id', engIds),
        db.from('travel_engagement_expenses').select('engagement_id, total_amount, billing_status').in('engagement_id', engIds),
      ])

      const bByEng = groupBy((bookings ?? []) as Array<Record<string, unknown>>, 'engagement_id')
      const eByEng = groupBy((expensesAll ?? []) as Array<Record<string, unknown>>, 'engagement_id')

      const trips = confirmed.map(e => {
        const trip = e.travel_trips as Record<string, unknown> | null
        const bs = (bByEng[e.id as string] ?? []) as Array<{ commission_amount: number | null; commission_paid_at: string | null; cost: number | null }>
        const es = (eByEng[e.id as string] ?? []) as Array<{ total_amount: number; billing_status: string }>
        const total_commission      = bs.reduce((s, b) => s + (b.commission_amount ?? 0), 0)
        const commission_received   = bs.filter(b => b.commission_paid_at).reduce((s, b) => s + (b.commission_amount ?? 0), 0)
        const total_amenities       = bs.reduce((s, b) => s + (b.cost ?? 0), 0)
        const total_absorbed        = es.filter(x => x.billing_status === 'absorbed' || x.billing_status === 'written_off').reduce((s, x) => s + x.total_amount, 0) + total_amenities
        const total_billable        = es.filter(x => x.billing_status === 'billable').reduce((s, x) => s + x.total_amount, 0)
        const total_outstanding     = es.filter(x => x.billing_status === 'billed').reduce((s, x) => s + x.total_amount, 0)
        const net_margin            = total_commission - total_absorbed
        const s = e.travel_lifecycle_statuses as { slug: string } | { slug: string }[] | null
        const status_slug = Array.isArray(s) ? s[0]?.slug : s?.slug
        return { engagement_id: e.id, url_id: e.url_id, title: e.title, status_slug, trip_code: trip?.trip_code ?? null, start_date: trip?.start_date ?? null, end_date: trip?.end_date ?? null, primary_client_id: trip?.primary_client_id ?? null, total_commission, commission_received, commission_outstanding: total_commission - commission_received, total_absorbed, total_billable, total_outstanding, net_margin }
      })
      return json({ trips })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)
  } catch (err) {
    console.error('travel-read-expenses unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
