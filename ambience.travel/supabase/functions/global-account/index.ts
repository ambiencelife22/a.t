// global-account - user's own account surface across the global_* spine:
// profile, support tickets, ticket messages. Caller-scoped: every mode is
// requireUser-gated and filtered by the VERIFIED user.id (from the JWT, never
// the request body). The service client bypasses RLS, so explicit user_id
// filtering + ticket-ownership checks are the authorization boundary here.
//
// Reads camelize; writes snakeize. Fixes prior camel-key write/read bugs that
// were silently failing (userId/authorId/isAdminReply to snake columns,
// createdAt/updatedAt read off snake rows).
//
// NOT here: login events (global_login_events schema mismatch - separate repair).
// Auth email/password go through supabase.auth client-side, not this EF.
import { requireUser } from '../_shared/auth.ts'
import { camelizeKeys, snakeizeKeys } from '../_shared/camelize.ts'
import { json, preflight } from '../_shared/http.ts'

const TICKET_FIELDS = 'id, user_id, category, subject, body, status, priority, created_at, updated_at'
const MESSAGE_FIELDS = 'id, ticket_id, author_id, body, is_internal, is_admin_reply, created_at'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const gate = await requireUser(req)
    if (!gate.ok) return gate.response
    const db = gate.serviceClient
    const uid = gate.user.id

    const body = await req.json().catch(() => ({}))
    const mode = body.mode as string | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    // ── Profile ────────────────────────────────────────────────────────────
    if (mode === 'profile_get') {
      const { data, error } = await db
        .from('global_profiles')
        .select('id, display_name, is_admin')
        .eq('id', uid)
        .single()
      if (error) return json({ error: 'Failed to fetch profile' }, 500)
      return json({ profile: camelizeKeys(data) })
    }

    if (mode === 'profile_update_display_name') {
      const displayName = body.display_name as string | undefined
      if (displayName === undefined) return json({ error: 'display_name is required' }, 400)
      const { error } = await db
        .from('global_profiles')
        .update({ display_name: displayName })
        .eq('id', uid)
      if (error) return json({ error: 'Failed to update display name' }, 500)
      return json({ success: true })
    }

    // Resolve the caller's own person_id (TimeTrackingTab: own team-member link).
    if (mode === 'profile_by_user') {
      const { data, error } = await db
        .from('global_profiles')
        .select('person_id')
        .eq('id', uid)
        .maybeSingle()
      if (error) return json({ error: 'Failed to fetch profile' }, 500)
      return json({ row: camelizeKeys(data ?? null) })
    }

    // ── Support tickets ─────────────────────────────────────────────────────
    if (mode === 'tickets_list') {
      const { data, error } = await db
        .from('global_support_tickets')
        .select(TICKET_FIELDS)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) return json({ error: 'Failed to fetch tickets' }, 500)
      return json({ tickets: camelizeKeys(data ?? []) })
    }

    if (mode === 'ticket_create') {
      const payload = snakeizeKeys<Record<string, unknown>>(body.fields ?? {})
      const insert = {
        user_id:  uid,
        category: payload.category ?? '',
        subject:  payload.subject ?? '',
        body:     payload.body ?? '',
        status:   'open',
        priority: 'normal',
      }
      const { data, error } = await db
        .from('global_support_tickets')
        .insert(insert)
        .select(TICKET_FIELDS)
        .single()
      if (error) return json({ error: 'Failed to create ticket: ' + error.message }, 500)
      return json({ ticket: camelizeKeys(data) })
    }

    if (mode === 'ticket_close') {
      const ticketId = body.ticket_id as string | undefined
      if (!ticketId) return json({ error: 'ticket_id is required' }, 400)
      // Ownership: only the ticket's owner may close it.
      const { data: owned, error: ownErr } = await db
        .from('global_support_tickets')
        .select('id')
        .eq('id', ticketId)
        .eq('user_id', uid)
        .maybeSingle()
      if (ownErr) return json({ error: 'Failed to verify ticket' }, 500)
      if (!owned) return json({ error: 'Ticket not found' }, 404)
      const { error } = await db
        .from('global_support_tickets')
        .update({ status: 'closed' })
        .eq('id', ticketId)
        .eq('user_id', uid)
      if (error) return json({ error: 'Failed to close ticket' }, 500)
      return json({ success: true })
    }

    // ── Ticket messages ─────────────────────────────────────────────────────
    if (mode === 'ticket_messages') {
      const ticketId = body.ticket_id as string | undefined
      if (!ticketId) return json({ error: 'ticket_id is required' }, 400)
      // Ownership: caller must own the ticket to read its thread.
      const { data: owned, error: ownErr } = await db
        .from('global_support_tickets')
        .select('id')
        .eq('id', ticketId)
        .eq('user_id', uid)
        .maybeSingle()
      if (ownErr) return json({ error: 'Failed to verify ticket' }, 500)
      if (!owned) return json({ error: 'Ticket not found' }, 404)
      const { data, error } = await db
        .from('global_ticket_messages')
        .select(MESSAGE_FIELDS)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) return json({ error: 'Failed to fetch messages' }, 500)
      return json({ messages: camelizeKeys(data ?? []) })
    }

    if (mode === 'ticket_message_create') {
      const ticketId = body.ticket_id as string | undefined
      const messageBody = body.body as string | undefined
      if (!ticketId) return json({ error: 'ticket_id is required' }, 400)
      if (!messageBody) return json({ error: 'body is required' }, 400)
      // Ownership: caller must own the ticket to post to its thread.
      const { data: owned, error: ownErr } = await db
        .from('global_support_tickets')
        .select('id')
        .eq('id', ticketId)
        .eq('user_id', uid)
        .maybeSingle()
      if (ownErr) return json({ error: 'Failed to verify ticket' }, 500)
      if (!owned) return json({ error: 'Ticket not found' }, 404)
      const { error } = await db
        .from('global_ticket_messages')
        .insert({
          ticket_id:      ticketId,
          author_id:      uid,
          body:           messageBody,
          is_admin_reply: false,
        })
      if (error) return json({ error: 'Failed to add message' }, 500)
      return json({ success: true })
    }

    // ── User data ───────────────────────────────────────────────────────────
    if (mode === 'delete_all_user_data') {
      const { error } = await db
        .from('global_support_tickets')
        .delete()
        .eq('user_id', uid)
      if (error) return json({ error: 'Failed to delete user data' }, 500)
      return json({ success: true })
    }

    // ── Login events ──────────────────────────────────────────────────────────
    if (mode === 'login_event_create') {
      const insert: Record<string, unknown> = { user_id: uid }
      if (body.browser)         insert.browser = body.browser
      if (body.os)              insert.os = body.os
      if (body.browser_version) insert.browser_version = body.browser_version
      const { error } = await db.from('global_login_events').insert(insert)
      if (error) return json({ error: 'Failed to record login' }, 500)
      return json({ success: true })
    }

    if (mode === 'logins_list') {
      const { data, error } = await db
        .from('global_login_events')
        .select('id, logged_in_at, browser, os, browser_version')
        .eq('user_id', uid)
        .order('logged_in_at', { ascending: false })
        .limit(10)
      if (error) return json({ error: 'Failed to fetch logins' }, 500)
      return json({ logins: camelizeKeys(data ?? []) })
    }

    return json({ error: 'Unknown mode: ' + mode }, 400)
  } catch (err) {
    console.error('global-account unexpected error:', err)
    
    return json({ error: 'Internal server error' }, 500)
  }
})