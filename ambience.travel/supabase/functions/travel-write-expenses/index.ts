// supabase/functions/travel-write-expenses/index.ts
//
// Edge Function: travel-write-expenses
// Class A — admin-only. All write paths for the Financial Module v1.
//
// Modes:
//   create_expense           — create expense header
//   update_expense           — patch expense header fields
//   delete_expense           — hard delete; refused if billing_status = 'billed'
//   create_item              — add line item; auto-recalcs parent total_amount
//   update_item              — patch item; recalcs parent total if amount changed
//   delete_item              — hard delete item; recalcs parent total
//   link_engagement          — retroactively link proactive expense to engagement
//   mark_billed              — set billing_status = billed
//   mark_paid                — set billing_status = paid
//   write_off                — set billing_status = written_off
//   mark_commission_received — record commission receipt with platform + fee
//   update_booking_financial — patch financial fields on a booking
//   set_hotel_platform       — set default_payment_platform_id on travel_accom_hotels
//
// Last updated: S53G v2 — mark_commission_received, update_booking_financial,
//   set_hotel_platform added. created_by chain fixed. recalcTotal typed.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Mode =
  | 'create_expense'
  | 'update_expense'
  | 'delete_expense'
  | 'create_item'
  | 'update_item'
  | 'delete_item'
  | 'link_engagement'
  | 'mark_billed'
  | 'mark_paid'
  | 'write_off'
  | 'mark_commission_received'
  | 'update_booking_financial'
  | 'set_hotel_platform'

async function recalcTotal(db: SupabaseClient, expenseId: string): Promise<void> {
  const { data } = await db
    .from('travel_expense_items')
    .select('amount')
    .eq('expense_id', expenseId)
  const total = ((data ?? []) as Array<{ amount: number }>).reduce((s, i) => s + i.amount, 0)
  await db.from('travel_engagement_expenses').update({ total_amount: total }).eq('id', expenseId)
}

async function resolveTeamMemberId(db: SupabaseClient, authUserId: string): Promise<string | null> {
  const { data: profile } = await db
    .from('global_profiles')
    .select('person_id')
    .eq('id', authUserId)
    .maybeSingle()
  const personId = (profile as { person_id: string | null } | null)?.person_id ?? null
  if (!personId) return null
  const { data: teamRow } = await db
    .from('global_team')
    .select('id')
    .eq('person_id', personId)
    .maybeSingle()
  return (teamRow as { id: string } | null)?.id ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as Mode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db, user } = gate

    // ── create_expense ───────────────────────────────────────────────────────
    if (mode === 'create_expense') {
      const expense_type  = (body?.expense_type as string | undefined)?.trim()
      const description   = (body?.description  as string | undefined)?.trim()
      const total_amount  = body?.total_amount  as number | undefined
      if (!expense_type)        return json({ error: 'expense_type is required' }, 400)
      if (!description)         return json({ error: 'description is required' }, 400)
      if (total_amount == null) return json({ error: 'total_amount is required' }, 400)

      const iteration_id  = (body?.iteration_id  as string | undefined) ?? null
      const booking_id     = (body?.booking_id     as string | undefined) ?? null
      const destination_id = (body?.destination_id as string | undefined) ?? null
      if (!iteration_id && !booking_id && !destination_id) {
        return json({ error: 'At least one of iteration_id, booking_id, or destination_id is required' }, 400)
      }

      const created_by = await resolveTeamMemberId(db, user.id)
      if (!created_by) {
        return json({ error: 'Caller has no global_team record. Add them to the team before creating expenses.' }, 403)
      }

      const { data, error } = await db.from('travel_engagement_expenses').insert({
        iteration_id, booking_id, destination_id,
        team_member_id: (body?.team_member_id as string | undefined) ?? null,
        expense_type, description, total_amount,
        currency:       (body?.currency       as string | undefined) ?? 'USD',
        billing_status: (body?.billing_status as string | undefined) ?? 'absorbed',
        paid_at:        (body?.paid_at        as string | undefined) ?? null,
        notes:          (body?.notes          as string | undefined) ?? null,
        created_by,
      }).select('*').single()
      if (error) { console.error('create_expense error:', error); return json({ error: 'Failed to create expense' }, 500) }
      return json({ expense: data })
    }

    // ── update_expense ───────────────────────────────────────────────────────
    if (mode === 'update_expense') {
      const id    = body?.id as string | undefined
      const patch = { ...(body?.patch as Record<string, unknown> | undefined ?? {}) }
      if (!id || Object.keys(patch).length === 0) return json({ error: 'id and patch are required' }, 400)
      delete patch.created_by; delete patch.id; delete patch.created_at
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .update(patch).eq('id', id).select('*').single()
      if (error) { console.error('update_expense error:', error); return json({ error: 'Failed to update expense' }, 500) }
      return json({ expense: data })
    }

    // ── delete_expense ───────────────────────────────────────────────────────
    if (mode === 'delete_expense') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data: existing } = await db
        .from('travel_engagement_expenses')
        .select('billing_status').eq('id', id).single()
      if ((existing as { billing_status: string } | null)?.billing_status === 'billed') {
        return json({ error: 'CANNOT_DELETE_BILLED', message: 'This expense has been invoiced. Mark it paid or write it off instead.' }, 409)
      }
      const { error } = await db.from('travel_engagement_expenses').delete().eq('id', id)
      if (error) { console.error('delete_expense error:', error); return json({ error: 'Failed to delete expense' }, 500) }
      return json({ ok: true })
    }

    // ── create_item ──────────────────────────────────────────────────────────
    if (mode === 'create_item') {
      const expense_id  = body?.expense_id  as string | undefined
      const item_type   = (body?.item_type   as string | undefined)?.trim()
      const description = (body?.description as string | undefined)?.trim()
      const amount      = body?.amount as number | undefined
      if (!expense_id)    return json({ error: 'expense_id is required' }, 400)
      if (!item_type)     return json({ error: 'item_type is required' }, 400)
      if (!description)   return json({ error: 'description is required' }, 400)
      if (amount == null) return json({ error: 'amount is required' }, 400)
      const { data, error } = await db.from('travel_expense_items').insert({
        expense_id, item_type, description, amount,
        receipt_ref:   (body?.receipt_ref   as string | undefined) ?? null,
        deductibility: (body?.deductibility as string | undefined) ?? 'full',
        recipient_id:  (body?.recipient_id  as string | undefined) ?? null,
        paid_by:       (body?.paid_by       as string | undefined) ?? null,
        paid_at:       (body?.paid_at       as string | undefined) ?? null,
        sort_order:    (body?.sort_order    as number | undefined) ?? 0,
      }).select('*').single()
      if (error) { console.error('create_item error:', error); return json({ error: 'Failed to create item' }, 500) }
      await recalcTotal(db, expense_id)
      return json({ item: data })
    }

    // ── update_item ──────────────────────────────────────────────────────────
    if (mode === 'update_item') {
      const id    = body?.id as string | undefined
      const patch = { ...(body?.patch as Record<string, unknown> | undefined ?? {}) }
      if (!id || Object.keys(patch).length === 0) return json({ error: 'id and patch are required' }, 400)
      delete patch.id; delete patch.expense_id; delete patch.created_at
      const { data, error } = await db
        .from('travel_expense_items')
        .update(patch).eq('id', id).select('*').single()
      if (error) { console.error('update_item error:', error); return json({ error: 'Failed to update item' }, 500) }
      if (patch.amount !== undefined) await recalcTotal(db, (data as { expense_id: string }).expense_id)
      return json({ item: data })
    }

    // ── delete_item ──────────────────────────────────────────────────────────
    if (mode === 'delete_item') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data: item } = await db
        .from('travel_expense_items')
        .select('expense_id').eq('id', id).single()
      const { error } = await db.from('travel_expense_items').delete().eq('id', id)
      if (error) { console.error('delete_item error:', error); return json({ error: 'Failed to delete item' }, 500) }
      if (item) await recalcTotal(db, (item as { expense_id: string }).expense_id)
      return json({ ok: true })
    }

    // ── link_engagement ──────────────────────────────────────────────────────
    if (mode === 'link_engagement') {
      const expense_id    = body?.expense_id    as string | undefined
      const iteration_id = body?.iteration_id as string | undefined
      if (!expense_id || !iteration_id) return json({ error: 'expense_id and iteration_id are required' }, 400)
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .update({ iteration_id, linked_at: new Date().toISOString() })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('link_engagement error:', error); return json({ error: 'Failed to link engagement' }, 500) }
      return json({ expense: data })
    }

    // ── mark_billed ──────────────────────────────────────────────────────────
    if (mode === 'mark_billed') {
      const expense_id = body?.expense_id as string | undefined
      if (!expense_id) return json({ error: 'expense_id is required' }, 400)
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .update({ billing_status: 'billed', billed_at: (body?.billed_at as string | undefined) ?? new Date().toISOString() })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('mark_billed error:', error); return json({ error: 'Failed to mark billed' }, 500) }
      return json({ expense: data })
    }

    // ── mark_paid ────────────────────────────────────────────────────────────
    if (mode === 'mark_paid') {
      const expense_id = body?.expense_id as string | undefined
      if (!expense_id) return json({ error: 'expense_id is required' }, 400)
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .update({ billing_status: 'paid', reimbursed_at: (body?.reimbursed_at as string | undefined) ?? new Date().toISOString() })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('mark_paid error:', error); return json({ error: 'Failed to mark paid' }, 500) }
      return json({ expense: data })
    }

    // ── write_off ────────────────────────────────────────────────────────────
    if (mode === 'write_off') {
      const expense_id = body?.expense_id as string | undefined
      if (!expense_id) return json({ error: 'expense_id is required' }, 400)
      const { data, error } = await db
        .from('travel_engagement_expenses')
        .update({ billing_status: 'written_off' })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('write_off error:', error); return json({ error: 'Failed to write off' }, 500) }
      return json({ expense: data })
    }

    // ── mark_commission_received ─────────────────────────────────────────────
    // Records commission receipt with platform, gross amount, fee, and net.
    // fee_amt may be supplied directly or computed from fee_pct × received_amount.
    // Sets commission_paid_at to now() if not already set.
    if (mode === 'mark_commission_received') {
      const booking_id              = body?.booking_id              as string | undefined
      const platform_id             = body?.platform_id             as string | undefined
      const received_amount         = body?.received_amount         as number | undefined
      const fee_pct                 = body?.fee_pct                 as number | undefined
      const fee_amt                 = body?.fee_amt                 as number | undefined
      const received_at             = (body?.received_at            as string | undefined) ?? new Date().toISOString()
      const transaction_ref         = (body?.transaction_ref        as string | undefined) ?? null
      const remitting_partner_id    = (body?.remitting_partner_id   as string | undefined) ?? null

      if (!booking_id)       return json({ error: 'booking_id is required' }, 400)
      if (received_amount == null) return json({ error: 'received_amount is required' }, 400)

      // Compute fee and net
      const resolvedFeePct = fee_pct ?? null
      const resolvedFeeAmt = fee_amt != null
        ? fee_amt
        : (resolvedFeePct != null ? Math.round(received_amount * resolvedFeePct / 100 * 100) / 100 : 0)
      const net_received = Math.round((received_amount - resolvedFeeAmt) * 100) / 100

      const patch: Record<string, unknown> = {
        commission_received_amount:      received_amount,
        commission_payment_fee_pct:      resolvedFeePct,
        commission_payment_fee_amt:      resolvedFeeAmt,
        commission_net_received:         net_received,
        commission_paid_at:              received_at,
        commission_transaction_ref:      transaction_ref,
        commission_remitting_partner_id: remitting_partner_id,
      }
      if (platform_id) patch.commission_payment_platform_id = platform_id

      const { data, error } = await db
        .from('travel_bookings')
        .update(patch)
        .eq('id', booking_id)
        .select('id, commission_received_amount, commission_payment_fee_pct, commission_payment_fee_amt, commission_net_received, commission_paid_at, commission_payment_platform_id')
        .single()
      if (error) { console.error('mark_commission_received error:', error); return json({ error: 'Failed to record commission receipt' }, 500) }
      return json({ booking: data })
    }

    // ── update_booking_financial ─────────────────────────────────────────────
    // Patches financial fields on a booking. Allowed fields only — never id,
    // trip_id, iteration_id, created_at. Operator edits commission_pct,
    // invoice_number, rate_type_id, selling_price, etc.
    if (mode === 'update_booking_financial') {
      const booking_id = body?.booking_id as string | undefined
      const patch      = { ...(body?.patch as Record<string, unknown> | undefined ?? {}) }
      if (!booking_id || Object.keys(patch).length === 0) {
        return json({ error: 'booking_id and patch are required' }, 400)
      }
      // Guard: strip identity + relational fields that must never be patched here
      const BLOCKED = new Set(['id', 'trip_id', 'iteration_id', 'created_at', 'updated_at', 'house_id'])
      for (const k of BLOCKED) delete patch[k]
      if (Object.keys(patch).length === 0) return json({ error: 'No patchable fields provided' }, 400)

      const { data, error } = await db
        .from('travel_bookings')
        .update(patch)
        .eq('id', booking_id)
        .select('id')
        .single()
      if (error) { console.error('update_booking_financial error:', error); return json({ error: 'Failed to update booking' }, 500) }
      return json({ ok: true, id: (data as { id: string }).id })
    }

    // ── set_hotel_platform ───────────────────────────────────────────────────
    // Sets the default payment platform on a hotel.
    if (mode === 'set_hotel_platform') {
      const hotel_id    = body?.hotel_id    as string | undefined
      const platform_id = body?.platform_id as string | undefined
      if (!hotel_id) return json({ error: 'hotel_id is required' }, 400)
      const { error } = await db
        .from('travel_accom_hotels')
        .update({ default_payment_platform_id: platform_id ?? null })
        .eq('id', hotel_id)
      if (error) { console.error('set_hotel_platform error:', error); return json({ error: 'Failed to set hotel platform' }, 500) }
      return json({ ok: true })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)
  } catch (err) {
    console.error('travel-write-expenses unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})