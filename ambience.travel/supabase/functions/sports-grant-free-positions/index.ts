// supabase/functions/sports-grant-free-positions/index.ts
// Admin-triggered: sets free_positions_override on a user profile and sends
// the freePositions email via Resend.
//
// Auth: Pattern A — JWT verification OFF.
//   Caller sends admin session token in body as { token }.
//   Function verifies token, checks is_admin on profile, then proceeds.
//
// Input:  { token: string, targetUserId: string, override: number }
//   override — the number of BONUS positions to grant (added to base 25)
// Output: { ok: true, total: number } | { error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createServiceClient } from '../_shared/client.ts'
import { json, preflight } from '../_shared/http.ts'

const serviceClient = createServiceClient()

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const BASE_POSITIONS = 25

function renderEmail(headline: string, body: string, ctaText: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1D1A;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1A1D1A" style="background:#1A1D1A;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#E8C446;padding:18px 32px;border-radius:12px 12px 0 0;">
    <span style="font-family:'Georgia',serif;font-size:20px;color:#1A1D1A;font-weight:400;">ambience</span>
    <span style="font-family:'Georgia',serif;font-size:13px;color:#1A1D1A;font-style:italic;">.sports</span>
  </td></tr>
  <tr><td style="background:#222722;padding:36px 32px;border-radius:0 0 12px 12px;">
    <h1 style="font-family:'Georgia',serif;font-size:22px;color:#F9F6F6;font-weight:400;margin:0 0 20px;">${headline}</h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#899A89;line-height:1.7;margin:0 0 28px;">${body.replace(/\n\n/g, '</p><p style="font-family:Arial,sans-serif;font-size:15px;color:#899A89;line-height:1.7;margin:0 0 28px;">')}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#E8C446;color:#1A1D1A;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;">${ctaText}</a>
    <p style="font-family:Arial,sans-serif;font-size:11px;color:#596959;margin:32px 0 0;line-height:1.6;">
      live with intention &nbsp;·&nbsp;
      <a href="https://sports.ambience.life" style="color:#596959;">ambience.SPORTS</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'noreply@ambience.life', to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('grant-free-positions sendEmail failed:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { token?: string; targetUserId?: string; override?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { token, targetUserId, override } = body

  if (!token || !targetUserId || override == null) {
    return json({ error: 'Missing token, targetUserId, or override' }, 400)
  }

  if (typeof override !== 'number' || override < 1 || override > 1000) {
    return json({ error: 'override must be a number between 1 and 1000' }, 400)
  }

  // Verify caller is admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: callerProfile } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!callerProfile?.is_admin) {
    return json({ error: 'Forbidden — admin only' }, 403)
  }

  // Fetch target user profile + email
  const { data: targetProfile, error: profileErr } = await serviceClient
    .from('profiles')
    .select('display_name, free_positions_override, subscription_tier')
    .eq('id', targetUserId)
    .single()

  if (profileErr || !targetProfile) {
    return json({ error: 'Target user not found' }, 404)
  }

  const { data: authUser } = await serviceClient.auth.admin.getUserById(targetUserId)
  const email = authUser?.user?.email ?? null
  if (!email) {
    return json({ error: 'Target user email not found' }, 404)
  }

  const total = BASE_POSITIONS + override

  // Update free_positions_override
  const { error: updateErr } = await serviceClient
    .from('profiles')
    .update({ free_positions_override: override })
    .eq('id', targetUserId)

  if (updateErr) {
    console.error('grant-free-positions update error:', updateErr)
    return json({ error: 'DB update failed' }, 500)
  }

  // Send email
  const subject     = `We added ${override} positions to your account.`
  const headline    = `${override} more positions, on us.`
  const bodyText    = `We've added ${override} complimentary positions to your ambience.SPORTS account — bringing your total to ${total}.\n\nNo subscription needed. Open the app and they're yours. Your data is exactly where you left it.`
  const html = renderEmail(headline, bodyText, 'Open ambience.SPORTS', 'https://sports.ambience.life')

  try {
    await sendEmail(email, subject, html)
  } catch (err) {
    console.error('grant-free-positions email error (non-fatal):', err)
    // Non-fatal — DB write succeeded, email failure should not block the response
  }

  console.log(`grant-free-positions: granted ${override} to ${targetUserId} (total ${total})`)

  return json({ ok: true, override, total }, 200)
})