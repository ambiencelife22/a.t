/* global-notify-ticket/index.ts
   Edge Function — called from queries.ts when a support ticket is opened or its status changes.
   JWT verify is OFF. Auth pattern: session token in body, verified via getUser().
   Uses service role to fetch ticket + user email. Sends appropriate email via Resend.
   A failed send logs and returns 200 — must never block the admin action that triggered it.
   CORS pattern matches all other Edge Functions (admin-tickets is the canonical reference).

   Events:
     opened     → TicketOpenedEmail
     in_progress → TicketUpdatedEmail
     resolved   → TicketResolvedEmail

   Body: { token: string, ticketId: string, event: 'opened' | 'in_progress' | 'resolved' }
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'

const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
const supabaseService = Deno.env.get('SERVICE_ROLE_KEY')!
const supabaseAnon    = Deno.env.get('SUPABASE_ANON_KEY')!
const resend          = new Resend(Deno.env.get('RESEND_API_KEY'))

const APP_URL = 'https://sports.ambience.life'

// ── HTML renderer ─────────────────────────────────────────────────────────────
// Single shell — same dark layout as send-welcome-email. Written once here,
// content slotted in per event. _lib/renderEmail.ts is the source of truth
// for the Admin preview; this is the deployed equivalent for Edge Functions.

function renderEmail(opts: {
  heading:    string
  body:       string[]
  ctaLabel:   string
  ctaUrl:     string
  footerNote?: string
}): string {
  const paragraphs = opts.body
    .map(p => `<div class="body">${p}</div>`)
    .join('\n  ')

  const footerNote = opts.footerNote
    ? `<div class="footer-note">${opts.footerNote}</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1A1D1A; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .header { background:#E8C547; padding:16px 32px; text-align:center; }
  .logo { color:#1A1D1A; font-size:18px; font-weight:700; letter-spacing:0.05em; }
  .container { max-width:560px; margin:0 auto; padding:40px 32px; }
  .heading { color:#FFFFFF; font-size:24px; font-weight:700; margin-bottom:24px; letter-spacing:-0.01em; }
  .body { color:#D1D5DB; font-size:15px; line-height:1.6; margin-bottom:16px; }
  .footer-note { color:#9CA3AF; font-size:13px; line-height:1.6; margin-top:24px; padding-top:24px; border-top:1px solid #2D3030; }
  .cta-wrap { text-align:center; margin-top:32px; }
  .cta { display:inline-block; background:#E8C547; color:#1A1D1A; font-weight:700; font-size:15px; padding:14px 32px; border-radius:6px; text-decoration:none; }
  .footer { max-width:560px; margin:0 auto; padding:0 32px 40px; text-align:center; }
  .tagline { color:#E8C547; font-size:13px; letter-spacing:0.08em; margin-bottom:8px; margin-top:0; }
  .footer-text { color:#6B7280; font-size:12px; margin:4px 0; }
  .footer-link { color:#6B7280; }
</style>
</head>
<body>
  <!-- bgcolor table — forces dark background in Apple Mail and Gmail which ignore body background-color -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1D1A" style="background:#1A1D1A; min-height:100%;">
    <tr><td>
      <div class="header"><div class="logo">ambience.SPORTS</div></div>
      <div class="container">
        <div class="heading">${opts.heading}</div>
        ${paragraphs}
        ${footerNote}
        <div class="cta-wrap">
          <a class="cta" href="${opts.ctaUrl}">${opts.ctaLabel}</a>
        </div>
      </div>
      <div class="footer">
        <div class="tagline">live with intention</div>
        <div class="footer-text">© ambience · <a class="footer-link" href="${APP_URL}">${APP_URL.replace('https://', '')}</a></div>
        <div class="footer-text"><a class="footer-link" href="${APP_URL}/#unsubscribe">unsubscribe</a></div>
      </div>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Content per event ─────────────────────────────────────────────────────────

type TicketEvent = 'opened' | 'in_progress' | 'resolved'

interface TicketEmailContent {
  subject:  string
  heading:  string
  body:     string[]
  ctaLabel: string
  footerNote?: string
}

function getTicketEmailContent(
  event:      TicketEvent,
  ticketId:   string,
  subject:    string,
  category:   string,
  adminReply?: string,
): TicketEmailContent {
  const shortId   = ticketId.slice(0, 8).toUpperCase()

  if (event === 'opened') {
    return {
      subject:  `We received your support request — #${shortId}`,
      heading:  'Request received.',
      body: [
        `Your support request has been logged. We'll be in touch shortly.`,
        `<strong style="color:#FFFFFF">Category:</strong> ${formatCategory(category)}<br/><strong style="color:#FFFFFF">Subject:</strong> ${subject}<br/><strong style="color:#FFFFFF">Reference:</strong> #${shortId}`,
      ],
      ctaLabel: 'View ticket status',
    }
  }

  if (event === 'in_progress') {
    const bodyParagraphs = [
      `Your support request #${shortId} is now in progress. We're looking into it.`,
    ]
    if (adminReply) {
      bodyParagraphs.push(`<strong style="color:#FFFFFF">From the team:</strong><br/>${adminReply}`)
    }
    return {
      subject:  `Update on your support request — #${shortId}`,
      heading:  "We're on it.",
      body:     bodyParagraphs,
      ctaLabel: 'View full thread',
      footerNote: 'You can reply directly in the app if you have additional information.',
    }
  }

  // resolved
  const bodyParagraphs = [
    `Your support request #${shortId} has been resolved.`,
  ]
  if (adminReply) {
    bodyParagraphs.push(`<strong style="color:#FFFFFF">Resolution:</strong><br/>${adminReply}`)
  }
  return {
    subject:  `Your support request has been resolved — #${shortId}`,
    heading:  'Resolved.',
    body:     bodyParagraphs,
    ctaLabel: 'View ticket',
    footerNote: `If this didn't solve your issue, reply in the app or open a new request. This ticket will close automatically in 7 days.`,
  }

  function formatCategory(cat: string): string {
    const map: Record<string, string> = {
      bug_report:      'Bug report',
      feature_request: 'Feature request',
      billing:         'Billing',
      account:         'Account',
      other:           'Other',
    }
    return map[cat] ?? cat
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  try {
    const body     = await req.json()
    const token    = body?.token    as string | undefined
    const ticketId = body?.ticketId as string | undefined
    const event    = body?.event    as TicketEvent | undefined

    if (!token || !ticketId || !event) {
      console.error('notify-ticket: missing required fields', { token: !!token, ticketId, event })
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: CORS })
    }

    if (!['opened', 'in_progress', 'resolved'].includes(event)) {
      console.error('notify-ticket: invalid event', event)
      return new Response(JSON.stringify({ error: 'Invalid event' }), { status: 400, headers: CORS })
    }

    // Verify the caller is an authenticated user
    const anonClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user: callerUser }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !callerUser) {
      console.error('notify-ticket: auth failed', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    // Service role — fetch ticket + user email
    const serviceClient = createClient(supabaseUrl, supabaseService, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: ticket, error: ticketError } = await serviceClient
      .from('global_support_tickets')
      .select('id, user_id, category, subject, status')
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      console.error('notify-ticket: ticket not found', ticketId, ticketError)
      return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 200, headers: CORS })
    }

    // Fetch the user's email from auth.users via service role
    const { data: { user: ticketUser }, error: userError } = await serviceClient.auth.admin.getUserById(ticket.user_id)
    if (userError || !ticketUser?.email) {
      console.error('notify-ticket: user not found', ticket.user_id, userError)
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 200, headers: CORS })
    }

    // Fetch the most recent admin reply for in_progress / resolved
    let adminReply: string | undefined
    if (event === 'in_progress' || event === 'resolved') {
      const { data: messages } = await serviceClient
        .from('global_ticket_messages')
        .select('body, is_admin_reply')
        .eq('ticket_id', ticketId)
        .eq('is_admin_reply', true)
        .eq('is_internal', false)
        .order('created_at', { ascending: false })
        .limit(1)

      if (messages && messages.length > 0) {
        adminReply = messages[0].body
      }
    }

    const content = getTicketEmailContent(event, ticket.id, ticket.subject, ticket.category, adminReply)
    const html    = renderEmail({
      heading:   content.heading,
      body:      content.body,
      ctaLabel:  content.ctaLabel,
      ctaUrl:    `${APP_URL}/#profile`,
      footerNote: content.footerNote,
    })

    const { error: sendError } = await resend.emails.send({
      from:    'ambience.SPORTS <noreply@ambience.life>',
      to:      ticketUser.email,
      subject: content.subject,
      html,
    })

    if (sendError) {
      console.error('notify-ticket: Resend error', sendError)
      return new Response(JSON.stringify({ error: sendError }), { status: 200, headers: CORS })
    }

    console.log(`notify-ticket: sent event=${event} ticket=${ticketId} to=${ticketUser.email}`)
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS })

  } catch (err: any) {
    console.error('notify-ticket: unexpected error', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), { status: 200, headers: CORS })
  }
})