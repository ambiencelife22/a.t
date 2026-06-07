/* sports-trial-reminder-job/index.ts
   Scheduled Edge Function — runs daily via pg_cron.
   Finds all users whose trial ends in exactly 3 days and sends TrialEndingEmail.
   One send per trial — guarded by trial_reminder_sent_at.

   Schedule: daily at 09:00 UTC (pg_cron job 'trial-reminder-job').
   Auth: no user session — called by pg_cron. Validated by CRON_SECRET header.

   S66F Phase 2: subscription state moved global_profiles -> global_subscriptions
   (per person_id, product='sports'); display_name -> sports_user_prefs. The query
   now DRIVES off global_subscriptions (filter columns live there), resolves the
   account id (auth lookup needs it) and display_name per person in batched passes.
   trial_reminder_sent_at written back to global_subscriptions. Env key -> canon.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
const supabaseService = Deno.env.get('SERVICE_ROLE_KEY')!
const cronSecret      = Deno.env.get('CRON_SECRET') ?? ''
const resend          = new Resend(Deno.env.get('RESEND_API_KEY'))

const APP_URL = 'https://sports.ambience.life'
const SPORTS_PRODUCT = 'sports'

// ── HTML renderer — same shell as all ambience emails ─────────────────────────

function renderEmail(opts: {
  heading:     string
  body:        string[]
  ctaLabel:    string
  ctaUrl:      string
  footerNote?: string
}): string {
  const paragraphs = opts.body
    .map(p => `  <div class="body">${p}</div>`)
    .join('\n')

  const footerNote = opts.footerNote
    ? `  <div class="footer-note">${opts.footerNote}</div>`
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

  // Validate cron secret — prevents arbitrary invocation
  const incomingSecret = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && incomingSecret !== cronSecret) {
    console.error('trial-reminder-job: unauthorized')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const serviceClient = createClient(supabaseUrl, supabaseService, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Trial-ends window: 2–4 days out (avoids timezone edge cases)
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() + 2)
  const windowEnd = new Date()
  windowEnd.setDate(windowEnd.getDate() + 4)

  // DRIVE off global_subscriptions — the filter columns live here now.
  const { data: subs, error } = await serviceClient
    .from('global_subscriptions')
    .select('person_id, trial_ends_at, trial_reminder_sent_at')
    .eq('product', SPORTS_PRODUCT)
    .eq('subscription_status', 'trialing')
    .gte('trial_ends_at', windowStart.toISOString())
    .lte('trial_ends_at', windowEnd.toISOString())
    .is('trial_reminder_sent_at', null)

  if (error) {
    console.error('trial-reminder-job: query error', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
  }

  if (!subs || subs.length === 0) {
    console.log('trial-reminder-job: no eligible users')
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: CORS })
  }

  const personIds = subs.map(s => s.person_id)

  // Resolve account id (needed for auth email lookup) per person_id.
  const { data: accounts } = await serviceClient
    .from('global_profiles')
    .select('id, person_id')
    .in('person_id', personIds)
  const accountByPerson: Record<string, string> = {}
  for (const a of accounts ?? []) accountByPerson[a.person_id] = a.id

  // Resolve display_name per person_id.
  const { data: prefs } = await serviceClient
    .from('sports_user_prefs')
    .select('person_id, display_name')
    .in('person_id', personIds)
  const nameByPerson: Record<string, string | null> = {}
  for (const p of prefs ?? []) nameByPerson[p.person_id] = p.display_name ?? null

  let sent = 0
  let failed = 0

  for (const sub of subs) {
    const accountId = accountByPerson[sub.person_id]
    if (!accountId) {
      console.error(`trial-reminder-job: no account for person ${sub.person_id}`)
      failed++
      continue
    }

    // Fetch email from auth.users (keyed by account id)
    const { data: { user: authUser }, error: authError } = await serviceClient.auth.admin.getUserById(accountId)
    if (authError || !authUser?.email) {
      console.error(`trial-reminder-job: no email for account ${accountId}`, authError)
      failed++
      continue
    }

    // Compute days left
    const trialEnd  = new Date(sub.trial_ends_at)
    const now       = new Date()
    const msLeft    = trialEnd.getTime() - now.getTime()
    const daysLeft  = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))

    // Fetch entry count (sports_bets keyed by account user_id)
    const { count: entryCount } = await serviceClient
      .from('sports_bets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', accountId)

    const firstName = nameByPerson[sub.person_id]?.split(' ')[0] ?? null
    const entryLine = entryCount
      ? `You've logged ${entryCount} position${entryCount === 1 ? '' : 's'} so far.`
      : 'Your full history is waiting on the other side.'

    const html = renderEmail({
      heading: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`,
      body: [
        `Your ambience.SPORTS trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}${firstName ? `, ${firstName}` : ''}.`,
        entryLine,
        'Continue with Pro to keep full access — entry logging, analytics, and every book in one view.',
      ],
      ctaLabel: 'Continue with Pro',
      ctaUrl:   `${APP_URL}/#plan-selection`,
    })

    const { error: sendError } = await resend.emails.send({
      from:    'ambience.SPORTS <noreply@ambience.life>',
      to:      authUser.email,
      subject: 'Your trial ends in 3 days',
      html,
    })

    if (sendError) {
      console.error(`trial-reminder-job: Resend error for ${authUser.email}`, sendError)
      failed++
      continue
    }

    // Stamp reminder sent on the subscription row — prevents re-send
    await serviceClient
      .from('global_subscriptions')
      .update({ trial_reminder_sent_at: new Date().toISOString() })
      .eq('person_id', sub.person_id)
      .eq('product', SPORTS_PRODUCT)

    console.log(`trial-reminder-job: sent to ${authUser.email} (${daysLeft} days left)`)
    sent++
  }

  console.log(`trial-reminder-job: done — sent=${sent} failed=${failed}`)
  return new Response(JSON.stringify({ sent, failed }), { status: 200, headers: CORS })
})