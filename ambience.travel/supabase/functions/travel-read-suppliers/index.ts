// supabase/functions/travel-read-suppliers/index.ts
//
// Edge Function: travel-read-suppliers
// Class A — admin-only. Global reference reads for suppliers and trade partners.
//
// Modes:
//   partners          — all active travel_partners (referral, iata, individual)
//   payment_platforms — all active travel_payment_platforms
//   rate_types        — all active travel_rate_types
//
// Single source for supplier/partner reference data platform-wide.
// travel-read-journey-admin reads travel_partners directly — debt to migrate here
// once supplier management is built out.
//
// Last updated: S53H — initial ship.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type Mode = 'partners' | 'payment_platforms' | 'rate_types'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as Mode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    // ── partners ──────────────────────────────────────────────────────────────
    if (mode === 'partners') {
      const { data, error } = await db
        .from('travel_partners')
        .select('id, name, partner_type, default_share_pct, currency, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) { console.error('partners error:', error); return json({ error: 'Failed to fetch partners' }, 500) }
      return json({ partners: data ?? [] })
    }

    // ── payment_platforms ─────────────────────────────────────────────────────
    if (mode === 'payment_platforms') {
      const { data, error } = await db
        .from('travel_payment_platforms')
        .select('id, slug, label, default_fee_pct, default_fee_flat, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) { console.error('payment_platforms error:', error); return json({ error: 'Failed to fetch payment platforms' }, 500) }
      return json({ platforms: data ?? [] })
    }

    // ── rate_types ────────────────────────────────────────────────────────────
    if (mode === 'rate_types') {
      const { data, error } = await db
        .from('travel_rate_types')
        .select('id, slug, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) { console.error('rate_types error:', error); return json({ error: 'Failed to fetch rate types' }, 500) }
      return json({ rate_types: data ?? [] })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)
  } catch (err) {
    console.error('travel-read-suppliers unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})