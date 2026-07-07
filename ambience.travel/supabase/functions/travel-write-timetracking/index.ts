// supabase/functions/travel-write-timetracking/index.ts
//
// Edge Function: travel-write-timetracking
// Writes time tracking data (entries, activity lookup, rate card).
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - travel_time_* tables have admin-only RLS, no direct client write policy
//   - This function uses the service role key to bypass RLS
//   - Never called with the anon key
//
// Money discipline:
//   - The client NEVER sends billable_amount or rate_applied.
//   - The function resolves the rate from rate_id, snapshots hourly_rate,
//     computes billable_amount = hours * rate, rounds to 2dp (r2).
//   - Billing is dormant in v1: amount is internal cost / future optionality,
//     never surfaced as a client invoice.
//
// Request body:
//   { mode: string, ...fields }
//
// Modes:
//   create_entry     → { entry }    requires house_id, work_date, hours
//   update_entry     → { entry }    requires id; recomputes snapshot if hours/rate_id change
//   delete_entry     → { deleted }  requires id
//   upsert_activity  → { activity } requires slug, label
//   upsert_rate      → { rate }     requires slug, role_label, hourly_rate
//
// Deployed at: /functions/v1/travel-write-timetracking
// Last updated: S53C — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, preflight } from '../_shared/http.ts'


const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

// hours: > 0, <= 5, in 0.25 increments. Returns the number or null if invalid.
function validateHours(h: unknown): number | null {
  const n = Number(h)
  if (!Number.isFinite(n)) return null
  if (n <= 0 || n > 5) return null
  if (Math.round(n * 4) !== n * 4) return null
  return n
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return preflight()

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }

    if (!mode) {
      return new Response(
        JSON.stringify({ error: 'mode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Verify caller is admin ─────────────────────────────────────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await serviceClient
      .from('global_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile || profile.is_admin !== true) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Rate snapshot helper ───────────────────────────────────────────────
    // Resolves rate_id + invoiceable flag → { rate_applied, effort_value, billable_amount }.
    //   effort_value    = hours * rate (ALWAYS when a rate exists) — the worth of the time.
    //   billable_amount = effort_value when invoiceable; otherwise 0. Null rate/effort when no rate.  
    // Throws 'RATE_NOT_FOUND' if a rate_id is given but does not resolve.
    async function snapshot(rateId: unknown, hours: number, isInvoiceable: boolean) {
      if (!rateId) {
        return {
          rate_applied: null as number | null,
          effort_value: null as number | null,
          billable_amount: isInvoiceable ? null : 0,
        }
      }
      const { data, error } = await serviceClient
        .from('travel_time_rates')
        .select('hourly_rate')
        .eq('id', String(rateId))
        .maybeSingle()
      if (error || !data) throw new Error('RATE_NOT_FOUND')
      const rate = Number(data.hourly_rate)
      const effort = r2(rate * hours)
      return {
        rate_applied: r2(rate),
        effort_value: effort,
        billable_amount: isInvoiceable ? effort : 0,
      }
    }

    // ── 5. Dispatch by mode ───────────────────────────────────────────────────
    switch (mode) {
      case 'create_entry': {
        const b = body as Record<string, any>
        if (!b.house_id) {
          return new Response(
            JSON.stringify({ error: 'house_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (!b.work_date) {
          return new Response(
            JSON.stringify({ error: 'work_date is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const hours = validateHours(b.hours)
        if (hours === null) {
          return new Response(
            JSON.stringify({ error: 'hours must be > 0, <= 5, in 0.25 increments' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const isInvoiceable = b.is_invoiceable === true
        let snap
        try { snap = await snapshot(b.rate_id, hours, isInvoiceable) }
        catch { return new Response(
          JSON.stringify({ error: 'rate_id not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        ) }

        const row = {
          house_id:               String(b.house_id),
          engagement_id:          b.engagement_id ? String(b.engagement_id) : null,
          house_person_id:        b.house_person_id ? String(b.house_person_id) : null,
          work_date:              String(b.work_date),
          hours,
          activity_id:            b.activity_id ? String(b.activity_id) : null,
          notes:                  b.notes ? String(b.notes) : null,
          entry_type:             b.entry_type ? String(b.entry_type) : 'billable',
          performed_by:           b.performed_by ? String(b.performed_by) : null,
          performed_by_person_id: b.performed_by_person_id ? String(b.performed_by_person_id) : null,
          started_at:             b.started_at ? String(b.started_at) : null,
          ended_at:               b.ended_at ? String(b.ended_at) : null,
          rate_id:                b.rate_id ? String(b.rate_id) : null,
          rate_applied:           snap.rate_applied,
          effort_value:           snap.effort_value,
          is_invoiceable:         isInvoiceable,
          billable_amount:        snap.billable_amount,
        }

        const { data, error } = await serviceClient
          .from('travel_time_entries')
          .insert(row)
          .select('*')
          .single()
        if (error) {
          console.error('create_entry error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to create entry' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ entry: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update_entry': {
        const b = body as Record<string, any>
        if (!b.id) {
          return new Response(
            JSON.stringify({ error: 'id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: existing, error: exErr } = await serviceClient
          .from('travel_time_entries')
          .select('*')
          .eq('id', String(b.id))
          .maybeSingle()
        if (exErr || !existing) {
          return new Response(
            JSON.stringify({ error: 'entry not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const patch: Record<string, unknown> = {}
        const passthrough = ['engagement_id','house_person_id','work_date','activity_id',
          'notes','entry_type','performed_by','performed_by_person_id','started_at','ended_at',
          'invoice_status','invoiced_at','paid_at']
        for (const f of passthrough) {
          if (f in b) patch[f] = b[f] === '' ? null : b[f]
        }

        let hours = Number(existing.hours)
        if ('hours' in b) {
          const h = validateHours(b.hours)
          if (h === null) {
            return new Response(
              JSON.stringify({ error: 'hours must be > 0, <= 5, in 0.25 increments' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          hours = h
          patch.hours = h
        }

        if ('hours' in b || 'rate_id' in b || 'is_invoiceable' in b) {
          const rateId = 'rate_id' in b ? b.rate_id : existing.rate_id
          const isInvoiceable = 'is_invoiceable' in b ? b.is_invoiceable === true : existing.is_invoiceable === true
          let snap
          try { snap = await snapshot(rateId, hours, isInvoiceable) }
          catch { return new Response(
            JSON.stringify({ error: 'rate_id not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          ) }
          patch.rate_id = rateId ? String(rateId) : null
          patch.rate_applied = snap.rate_applied
          patch.effort_value = snap.effort_value
          patch.is_invoiceable = isInvoiceable
          patch.billable_amount = snap.billable_amount
        }

        const { data, error } = await serviceClient
          .from('travel_time_entries')
          .update(patch)
          .eq('id', String(b.id))
          .select('*')
          .single()
        if (error) {
          console.error('update_entry error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to update entry' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ entry: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete_entry': {
        const { id } = body as { id?: string }
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const { error } = await serviceClient
          .from('travel_time_entries')
          .delete()
          .eq('id', id)
        if (error) {
          console.error('delete_entry error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to delete entry' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ deleted: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'upsert_activity': {
        const b = body as Record<string, any>
        if (!b.slug || !b.label) {
          return new Response(
            JSON.stringify({ error: 'slug and label are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const row = {
          slug:       String(b.slug),
          label:      String(b.label),
          sort_order: b.sort_order != null ? Number(b.sort_order) : 0,
          is_active:  b.is_active != null ? Boolean(b.is_active) : true,
        }
        const { data, error } = await serviceClient
          .from('travel_time_activities')
          .upsert(row, { onConflict: 'slug' })
          .select('*')
          .single()
        if (error) {
          console.error('upsert_activity error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to upsert activity' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ activity: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'upsert_rate': {
        const b = body as Record<string, any>
        if (!b.slug || !b.role_label || b.hourly_rate == null) {
          return new Response(
            JSON.stringify({ error: 'slug, role_label and hourly_rate are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const row = {
          slug:        String(b.slug),
          role_label:  String(b.role_label),
          hourly_rate: r2(Number(b.hourly_rate)),
          currency:    b.currency ? String(b.currency) : 'USD',
          is_active:   b.is_active != null ? Boolean(b.is_active) : true,
        }
        const { data, error } = await serviceClient
          .from('travel_time_rates')
          .upsert(row, { onConflict: 'slug' })
          .select('*')
          .single()
        if (error) {
          console.error('upsert_rate error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to upsert rate' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ rate: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (err) {
    console.error('travel-write-timetracking unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})