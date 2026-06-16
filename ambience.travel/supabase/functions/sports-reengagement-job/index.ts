/* sports-reengagement-job/index.ts
   Scheduled Edge Function — runs daily via pg_cron (job 'reengagement-job', 10:00 UTC).
   Three re-engagement sends per lapse event:
     Day 30  — calm, factual. "Still here."
     Day 60  — warm, light. "We kept your seat."
     Day 90  — concrete gift. "We added 25 positions." (free-tier users only)

   One send guarantee per send (guard columns IS NULL). 30+60 cleared on
   resubscribe in stripe-webhook; Day-90 guard NOT cleared (grant is permanent).

   Auth: no user session — called by pg_cron. Validated by CRON_SECRET header.

   S66F Phase 2: subscription state moved global_profiles -> global_subscriptions
   (per person_id, product='sports'). Both queries DRIVE off global_subscriptions;
   account id resolved per person_id for the auth email lookup; all stamps and the
   Day-90 free_positions_override written back to the subscription row (upsert on
   Day-90 since the row may not exist for a long-lapsed free user). Env key -> canon.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'

const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
const supabaseService = Deno.env.get('SERVICE_ROLE_KEY')!
const cronSecret      = Deno.env.get('CRON_SECRET') ?? ''
const resend          = new Resend(Deno.env.get('RESEND_API_KEY'))

const APP_URL         = 'https://sports.ambience.life'
const BASE_POSITIONS  = 25
const BONUS_POSITIONS = 25
const TOTAL_POSITIONS = BASE_POSITIONS + BONUS_POSITIONS
const SPORTS_PRODUCT  = 'sports'

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

// ── Send helper — never throws ────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const { error } = await resend.emails.send({
    from:    'ambience.SPORTS <noreply@ambience.life>',
    to,
    subject,
    html,
  })
  if (error) {
    console.error(`reengagement-job: Resend error for ${to}`, error)
    return false
  }
  return true
}

// Resolve account id (auth email lookup needs it) per person_id.
// deno-lint-ignore no-explicit-any
async function accountIdsByPerson(
  serviceClient: any,
  personIds: string[],
): Promise<Record<string, string>> {
  if (personIds.length === 0) return {}
  const { data } = await serviceClient
    .from('global_profiles')
    .select('id, person_id')
    .in('person_id', personIds)
  const out: Record<string, string> = {}
  for (const a of data ?? []) out[(a as any).person_id] = (a as any).id
  return out
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

  const incomingSecret = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && incomingSecret !== cronSecret) {
    console.error('reengagement-job: unauthorized')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const serviceClient = createClient(supabaseUrl, supabaseService, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now            = new Date()
  const day30Threshold = new Date(now)
  const day60Threshold = new Date(now)
  const day90Threshold = new Date(now)
  day30Threshold.setDate(day30Threshold.getDate() - 30)
  day60Threshold.setDate(day60Threshold.getDate() - 60)
  day90Threshold.setDate(day90Threshold.getDate() - 90)

  // ── Day 30 + 60: canceled paid users ────────────────────────────────────────
  // Drive off global_subscriptions (product='sports').
  const { data: subs, error } = await serviceClient
    .from('global_subscriptions')
    .select('person_id, current_period_end, re_engagement_30_sent_at, re_engagement_60_sent_at')
    .eq('product', SPORTS_PRODUCT)
    .eq('subscription_status', 'canceled')
    .neq('subscription_tier', 'free')

  if (error) {
    console.error('reengagement-job: query error', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
  }

  const acctByPerson = await accountIdsByPerson(serviceClient, (subs ?? []).map(s => s.person_id))

  let sent30 = 0
  let sent60 = 0
  let failed = 0

  for (const sub of (subs ?? [])) {
    if (!sub.current_period_end) { continue }

    const periodEnd  = new Date(sub.current_period_end)
    const eligible30 = periodEnd <= day30Threshold && !sub.re_engagement_30_sent_at
    const eligible60 = periodEnd <= day60Threshold && !sub.re_engagement_60_sent_at
    if (!eligible30 && !eligible60) { continue }

    const accountId = acctByPerson[sub.person_id]
    if (!accountId) {
      console.error(`reengagement-job: no account for person ${sub.person_id}`)
      failed++
      continue
    }

    const { data: { user: authUser }, error: authError } = await serviceClient.auth.admin.getUserById(accountId)
    if (authError || !authUser?.email) {
      console.error(`reengagement-job: no email for account ${accountId}`, authError)
      failed++
      continue
    }

    // ── Day 30 ───────────────────────────────────────────────────────────────
    if (eligible30) {
      const html = renderEmail({
        heading:    'Still here.',
        body: [
          'Your complete ambience.SPORTS history is intact — every position, every book, every dollar logged.',
          'Nothing has been deleted. Pick up exactly where you left off.',
        ],
        ctaLabel:   'Pick up where you left off',
        ctaUrl:     `${APP_URL}/#plan-selection`,
        footerNote: 'This is the only reminder we\'ll send.',
      })

      const ok30 = await sendEmail(authUser.email, 'Your ambience.SPORTS data is waiting', html)
      if (!ok30) { failed++; continue }
      await serviceClient
        .from('global_subscriptions')
        .update({ re_engagement_30_sent_at: now.toISOString() })
        .eq('person_id', sub.person_id)
        .eq('product', SPORTS_PRODUCT)
      console.log(`reengagement-job: day-30 sent to ${authUser.email}`)
      sent30++
    }

    // ── Day 60 ───────────────────────────────────────────────────────────────
    if (eligible60) {
      const html = renderEmail({
        heading:    'We kept your seat.',
        body: [
          'Your ambience.SPORTS data has been patiently waiting 60 days for you. Every position, every book, every dollar — exactly as you left it. Remarkably loyal, for a database.',
          'Re-launching your full access whenever you\'re ready 🚀',
        ],
        ctaLabel:   'Pick up where you left off',
        ctaUrl:     `${APP_URL}/#plan-selection`,
        footerNote: 'This is the only reminder we\'ll send.',
      })

      const ok60 = await sendEmail(authUser.email, 'We kept your seat.', html)
      if (!ok60) { failed++; continue }
      await serviceClient
        .from('global_subscriptions')
        .update({ re_engagement_60_sent_at: now.toISOString() })
        .eq('person_id', sub.person_id)
        .eq('product', SPORTS_PRODUCT)
      console.log(`reengagement-job: day-60 sent to ${authUser.email}`)
      sent60++
    }
  }

  // ── Day 90: free-tier users only — grant bonus positions ──────────────────
  // Separate query — different tier, different guard column, different action.
  const { data: day90Subs, error: err90 } = await serviceClient
    .from('global_subscriptions')
    .select('person_id, current_period_end, re_engagement_positions_sent_at')
    .eq('product', SPORTS_PRODUCT)
    .eq('subscription_tier', 'free')
    .is('re_engagement_positions_sent_at', null)
    .not('current_period_end', 'is', null)
    .lte('current_period_end', day90Threshold.toISOString())

  if (err90) {
    console.error('reengagement-job: day-90 query error', err90)
  }

  const acctByPerson90 = await accountIdsByPerson(serviceClient, (day90Subs ?? []).map(s => s.person_id))

  let sentPositions = 0

  for (const sub of (day90Subs ?? [])) {
    const accountId = acctByPerson90[sub.person_id]
    if (!accountId) {
      console.error(`reengagement-job: day-90 no account for person ${sub.person_id}`)
      failed++
      continue
    }

    const { data: { user: authUser }, error: authError } = await serviceClient.auth.admin.getUserById(accountId)
    if (authError || !authUser?.email) {
      console.error(`reengagement-job: day-90 no email for account ${accountId}`, authError)
      failed++
      continue
    }

    // Write DB first — stamp guard + grant positions. Upsert on (person_id, product)
    // since a long-lapsed free user may have no subscription row. If email fails
    // after this, positions are still granted (acceptable).
    const { error: upsertErr } = await serviceClient
      .from('global_subscriptions')
      .upsert(
        {
          person_id:                        sub.person_id,
          product:                          SPORTS_PRODUCT,
          free_positions_override:          BONUS_POSITIONS,
          re_engagement_positions_sent_at:  now.toISOString(),
        },
        { onConflict: 'person_id,product' }
      )

    if (upsertErr) {
      console.error(`reengagement-job: day-90 upsert error for person ${sub.person_id}`, upsertErr)
      failed++
      continue
    }

    const html = renderEmail({
      heading:  `${BONUS_POSITIONS} more positions, on us.`,
      body: [
        `We've added ${BONUS_POSITIONS} complimentary positions to your ambience.SPORTS account — bringing your total to ${TOTAL_POSITIONS}.`,
        'No subscription needed. Open the app and they\'re yours. Your data is exactly where you left it.',
      ],
      ctaLabel: 'Open ambience.SPORTS',
      ctaUrl:   APP_URL,
    })

    const ok90 = await sendEmail(
      authUser.email,
      `We added ${BONUS_POSITIONS} positions to your account.`,
      html,
    )
    if (!ok90) {
      console.error(`reengagement-job: day-90 email failed for ${authUser.email} (positions still granted)`)
      failed++
      continue
    }
    console.log(`reengagement-job: day-90 positions granted + email sent to ${authUser.email}`)
    sentPositions++
  }

  console.log(`reengagement-job: done — sent30=${sent30} sent60=${sent60} sentPositions=${sentPositions} failed=${failed}`)
  return new Response(
    JSON.stringify({ sent30, sent60, sentPositions, failed }),
    { status: 200, headers: CORS },
  )
})