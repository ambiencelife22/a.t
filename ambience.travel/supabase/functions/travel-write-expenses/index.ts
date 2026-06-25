// supabase/functions/travel-write-expenses/index.ts
//
// Edge Function: travel-write-expenses
// Class A — admin-only. All write paths for the Financial Module v1.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated + admin (global_profiles.is_admin = true)
//   - All writes use service role. NEVER exposed on any client surface.
//
// Modes:
//   create_expense  — create expense header
//   update_expense  — patch expense header fields
//   delete_expense  — hard delete; refused if billing_status = 'billed'
//   create_item     — add line item; auto-recalcs parent total_amount
//   update_item     — patch item; recalcs parent total if amount changed
//   delete_item     — hard delete item; recalcs parent total
//   link_engagement — retroactively link proactive expense to engagement
//   mark_billed     — set billing_status = billed
//   mark_paid       — set billing_status = paid
//   write_off       — set billing_status = written_off
//
// First ship: S53G Financial Module v1

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

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

async function recalcTotal(db: any, expenseId: string): Promise<void> {
  const { data } = await db.from('travel_expense_items').select('amount').eq('expense_id', expenseId)
  const total = ((data ?? []) as Array<{ amount: number }>).reduce((s, i) => s + i.amount, 0)
  await db.from('travel_engagement_expenses').update({ total_amount: total }).eq('id', expenseId)
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

    if (mode === 'create_expense') {
      const expense_type  = (body?.expense_type as string | undefined)?.trim()
      const description   = (body?.description  as string | undefined)?.trim()
      const total_amount  = body?.total_amount  as number | undefined
      if (!expense_type)        return json({ error: 'expense_type is required' }, 400)
      if (!description)         return json({ error: 'description is required' }, 400)
      if (total_amount == null) return json({ error: 'total_amount is required' }, 400)

      const engagement_id  = (body?.engagement_id  as string | undefined) ?? null
      const booking_id     = (body?.booking_id     as string | undefined) ?? null
      const destination_id = (body?.destination_id as string | undefined) ?? null
      if (!engagement_id && !booking_id && !destination_id) {
        return json({ error: 'At least one of engagement_id, booking_id, or destination_id is required' }, 400)
      }

      // created_by = the global_team row for this admin user (look up by person_id -> auth user)
      // For now we store the auth user id directly and resolve to global_team in a future pass.
      // The column is global_team.id FK — if the caller has no team row this will error gracefully.
      const { data: teamRow } = await db
        .from('global_team')
        .select('id')
        .eq('person_id', user.id)
        .maybeSingle()

      const created_by = (teamRow as { id: string } | null)?.id ?? null
      if (!created_by) return json({ error: 'Caller has no global_team record. Add them to the team before creating expenses.' }, 403)

      const { data, error } = await db.from('travel_engagement_expenses').insert({
        engagement_id, booking_id, destination_id,
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

    if (mode === 'update_expense') {
      const id    = body?.id as string | undefined
      const patch = { ...(body?.patch as Record<string, unknown> | undefined ?? {}) }
      if (!id || Object.keys(patch).length === 0) return json({ error: 'id and patch are required' }, 400)
      delete patch.created_by; delete patch.id; delete patch.created_at
      const { data, error } = await db.from('travel_engagement_expenses').update(patch).eq('id', id).select('*').single()
      if (error) { console.error('update_expense error:', error); return json({ error: 'Failed to update expense' }, 500) }
      return json({ expense: data })
    }

    if (mode === 'delete_expense') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data: existing } = await db.from('travel_engagement_expenses').select('billing_status').eq('id', id).single()
      if ((existing as { billing_status: string } | null)?.billing_status === 'billed') {
        return json({ error: 'CANNOT_DELETE_BILLED', message: 'This expense has been invoiced. Mark it paid or write it off instead.' }, 409)
      }
      const { error } = await db.from('travel_engagement_expenses').delete().eq('id', id)
      if (error) { console.error('delete_expense error:', error); return json({ error: 'Failed to delete expense' }, 500) }
      return json({ ok: true })
    }

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

    if (mode === 'update_item') {
      const id    = body?.id as string | undefined
      const patch = { ...(body?.patch as Record<string, unknown> | undefined ?? {}) }
      if (!id || Object.keys(patch).length === 0) return json({ error: 'id and patch are required' }, 400)
      delete patch.id; delete patch.expense_id; delete patch.created_at
      const { data, error } = await db.from('travel_expense_items').update(patch).eq('id', id).select('*').single()
      if (error) { console.error('update_item error:', error); return json({ error: 'Failed to update item' }, 500) }
      if (patch.amount !== undefined) await recalcTotal(db, (data as { expense_id: string }).expense_id)
      return json({ item: data })
    }

    if (mode === 'delete_item') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const { data: item } = await db.from('travel_expense_items').select('expense_id').eq('id', id).single()
      const { error } = await db.from('travel_expense_items').delete().eq('id', id)
      if (error) { console.error('delete_item error:', error); return json({ error: 'Failed to delete item' }, 500) }
      if (item) await recalcTotal(db, (item as { expense_id: string }).expense_id)
      return json({ ok: true })
    }

    if (mode === 'link_engagement') {
      const expense_id    = body?.expense_id    as string | undefined
      const engagement_id = body?.engagement_id as string | undefined
      if (!expense_id || !engagement_id) return json({ error: 'expense_id and engagement_id are required' }, 400)
      const { data, error } = await db.from('travel_engagement_expenses')
        .update({ engagement_id, linked_at: new Date().toISOString() })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('link_engagement error:', error); return json({ error: 'Failed to link engagement' }, 500) }
      return json({ expense: data })
    }

    if (mode === 'mark_billed') {
      const expense_id = body?.expense_id as string | undefined
      if (!expense_id) return json({ error: 'expense_id is required' }, 400)
      const { data, error } = await db.from('travel_engagement_expenses')
        .update({ billing_status: 'billed', billed_at: (body?.billed_at as string | undefined) ?? new Date().toISOString() })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('mark_billed error:', error); return json({ error: 'Failed to mark billed' }, 500) }
      return json({ expense: data })
    }

    if (mode === 'mark_paid') {
      const expense_id = body?.expense_id as string | undefined
      if (!expense_id) return json({ error: 'expense_id is required' }, 400)
      const { data, error } = await db.from('travel_engagement_expenses')
        .update({ billing_status: 'paid', reimbursed_at: (body?.reimbursed_at as string | undefined) ?? new Date().toISOString() })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('mark_paid error:', error); return json({ error: 'Failed to mark paid' }, 500) }
      return json({ expense: data })
    }

    if (mode === 'write_off') {
      const expense_id = body?.expense_id as string | undefined
      if (!expense_id) return json({ error: 'expense_id is required' }, 400)
      const { data, error } = await db.from('travel_engagement_expenses')
        .update({ billing_status: 'written_off' })
        .eq('id', expense_id).select('*').single()
      if (error) { console.error('write_off error:', error); return json({ error: 'Failed to write off' }, 500) }
      return json({ expense: data })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)
  } catch (err) {
    console.error('travel-write-expenses unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
