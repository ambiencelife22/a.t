/* global-send-welcome-email/index.ts
   Edge Function — called from App.tsx on profile load when welcome_email_sent_at is NULL.
   JWT verify is OFF. user_id and email arrive in the request body.
   Uses service role to fetch display_name and set welcome_email_sent_at after sending.
   A failed send logs and returns 200 — must never block dashboard load.
   Auth pattern: data in body only (bespoke). Client + json/preflight from _shared.

   S66F Phase 2:
     - display_name read moved global_profiles -> sports_user_prefs (person-scoped).
     - welcome_email_sent_at write moved global_profiles -> global_subscriptions
       (per person_id, product='sports'). Per-product stamp: a SPORTS welcome and
       a future TRAVEL welcome are independent. UPSERT on (person_id, product) —
       the subscription row may not exist yet.

   S53I EF consolidation Phase 2:
     - inline createClient(...) -> createServiceClient() (_shared/client.ts).
     - raw new Response(JSON.stringify(...)) -> shared json (_shared/http.ts).
     - inline OPTIONS handler -> preflight (_shared/http.ts).
     - bespoke body-only auth preserved; no gate (JWT verify is OFF by design).
*/
import { Resend } from 'npm:resend@4'
import { createServiceClient } from '../_shared/client.ts'
import { json, preflight } from '../_shared/http.ts'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const SPORTS_PRODUCT = 'sports'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body   = await req.json()
    const userId = body?.user_id as string | undefined
    const email  = body?.email   as string | undefined

    if (!userId || !email) {
      console.error('send-welcome-email: missing user_id or email', body)
      return json({ error: 'Missing user_id or email' }, 400)
    }

    const serviceClient = createServiceClient()

    // Resolve person_id from the account (display_name + stamp are person-scoped now)
    const { data: account } = await serviceClient
      .from('global_profiles')
      .select('person_id')
      .eq('id', userId)
      .single()

    const personId = account?.person_id as string | undefined

    // Fetch display name from sports_user_prefs (by person_id)
    let displayName: string | undefined
    if (personId) {
      const { data: prefs } = await serviceClient
        .from('sports_user_prefs')
        .select('display_name')
        .eq('person_id', personId)
        .maybeSingle()
      displayName = prefs?.display_name ?? undefined
    }

    const firstName = displayName?.split(' ')[0] ?? null
    const greeting  = firstName ? `Welcome, ${firstName}.` : 'Welcome.'

    const html = `<!DOCTYPE html>
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
        <div class="heading">${greeting}</div>
        <div class="body">ambience.SPORTS tracks your wagering operation with the kind of clarity most people never have. Every position, every book, every dollar — visible.</div>
        <div class="body">Start by logging your first position. The picture builds from there.</div>
        <div class="cta-wrap">
          <a class="cta" href="https://sports.ambience.life">Open ambience.SPORTS</a>
        </div>
      </div>
      <div class="footer">
        <div class="tagline">live with intention</div>
        <div class="footer-text">© ambience · <a class="footer-link" href="https://sports.ambience.life">sports.ambience.life</a></div>
        <div class="footer-text"><a class="footer-link" href="https://sports.ambience.life/#unsubscribe">unsubscribe</a></div>
      </div>
    </td></tr>
  </table>
</body>
</html>`

    const { error: sendError } = await resend.emails.send({
      from:    'ambience.SPORTS <noreply@ambience.life>',
      to:      email,
      subject: 'Welcome to ambience.SPORTS',
      html,
    })

    if (sendError) {
      console.error('send-welcome-email: Resend error', sendError)
      return json({ error: sendError }, 200)
    }

    // Mark welcome email as sent — prevents re-send on subsequent logins.
    // Per-product stamp on the SPORTS subscription row; upsert as it may not exist.
    if (personId) {
      await serviceClient
        .from('global_subscriptions')
        .upsert(
          { person_id: personId, product: SPORTS_PRODUCT, welcome_email_sent_at: new Date().toISOString() },
          { onConflict: 'person_id,product' }
        )
    }
    if (!personId) {
      console.error('send-welcome-email: no person_id for user', userId, '— stamp not written')
    }

    console.log(`send-welcome-email: sent to ${email}`)
    return json({ success: true }, 200)

  } catch (err: any) {
    console.error('send-welcome-email: unexpected error', err)
    return json({ error: err.message ?? 'Unknown error' }, 200)
  }
})
