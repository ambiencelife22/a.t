// supabase/functions/global-admin-tickets/index.ts
// Handles all admin support ticket operations using the service role client.
// JWT verification OFF — consistent with all other Edge Functions.
// Verifies is_admin on every action before proceeding.
//
// Actions: get_all, update_status, update_priority, add_message,
//          delete_ticket, create_ticket

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
const supabaseService = Deno.env.get('SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const body = await req.json()
    const { token, action } = body

    const serviceClient = createClient(supabaseUrl, supabaseService, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify caller is authenticated and is an admin
    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { data: profile } = await serviceClient
      .from('global_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const headers = {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    }

    // ── get_all ──────────────────────────────────────────────────────────────
    if (action === 'get_all') {
      const { data: tickets, error } = await serviceClient
        .from('global_support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) { throw error }

      // Enrich with user email from auth.users
      const userIds = [...new Set(tickets.map((t: any) => t.user_id))]
      const emailMap: Record<string, string> = {}
      const displayMap: Record<string, string> = {}
      for (const uid of userIds) {
        const { data: u } = await serviceClient.auth.admin.getUserById(uid as string)
        if (u?.user) {
          emailMap[uid as string]   = u.user.email ?? ''
          displayMap[uid as string] = (u.user.user_metadata?.display_name as string) ?? ''
        }
      }

      const enriched = tickets.map((t: any) => ({
        ...t,
        user_email:        emailMap[t.user_id]   ?? '',
        user_display_name: displayMap[t.user_id] ?? '',
      }))

      return new Response(JSON.stringify({ tickets: enriched }), { headers })
    }

    // ── create_ticket ─────────────────────────────────────────────────────────
    if (action === 'create_ticket') {
      const { userId, category, subject, body: ticketBody, priority } = body
      if (!userId || !category || !subject || !ticketBody) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
      }
      const { data: ticket, error } = await serviceClient
        .from('global_support_tickets')
        .insert({
          user_id:  userId,
          category: category,
          subject:  subject,
          body:     ticketBody,
          priority: priority ?? 'normal',
          status:   'open',
        })
        .select()
        .single()
      if (error) { throw error }
      return new Response(JSON.stringify({ ticket }), { headers })
    }

    // ── update_status ─────────────────────────────────────────────────────────
    if (action === 'update_status') {
      const { ticketId, status } = body
      const { error } = await serviceClient
        .from('global_support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
      if (error) { throw error }
      return new Response(JSON.stringify({ ok: true }), { headers })
    }

    // ── update_priority ───────────────────────────────────────────────────────
    if (action === 'update_priority') {
      const { ticketId, priority } = body
      const { error } = await serviceClient
        .from('global_support_tickets')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
      if (error) { throw error }
      return new Response(JSON.stringify({ ok: true }), { headers })
    }

    // ── add_message ───────────────────────────────────────────────────────────
    if (action === 'add_message') {
      const { ticketId, authorId, body: msgBody, isInternal } = body
      const { data: msg, error } = await serviceClient
        .from('global_ticket_messages')
        .insert({
          ticket_id:   ticketId,
          author_id:   authorId,
          body:        msgBody,
          is_internal: isInternal ?? false,
        })
        .select()
        .single()
      if (error) { throw error }

      // Update ticket updated_at
      await serviceClient
        .from('global_support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId)

      return new Response(JSON.stringify({ message: msg }), { headers })
    }

    // ── delete_ticket ─────────────────────────────────────────────────────────
    if (action === 'delete_ticket') {
      const { ticketId } = body
      const { error } = await serviceClient
        .from('global_support_tickets')
        .delete()
        .eq('id', ticketId)
      if (error) { throw error }
      return new Response(JSON.stringify({ ok: true }), { headers })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), { status: 500 })
  }
})