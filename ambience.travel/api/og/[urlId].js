// api/og/[urlId].js
//
// Vercel Serverless Function — per-engagement Open Graph link previews.
//
// WHY THIS EXISTS:
//   The immerse surface is a client-rendered Vite SPA. Link scrapers
//   (WhatsApp, iMessage, Slack, etc.) do not run JS — they read the raw
//   HTML <head>. Without server-injected OG tags every shared link shows the
//   generic site title. This function intercepts scraper requests to
//   /{urlId}, fetches the engagement's title/tagline/hero, and returns HTML
//   with per-engagement og:* tags. Real users are passed straight through to
//   the SPA unchanged.
//
// PRIVACY (Mission: privacy first):
//   Reads through travel-get-immerse-proposal, which enforces public_view.
//   Hidden (403) or missing (404) engagements return the GENERIC ambience
//   card — never the hidden engagement's title or hero. No url_id existence
//   leak: hidden and missing produce identical branded output.
//
// BRANDING:
//   Hero image is the card (clean, cinematic). Branding rides in
//   og:site_name = "ambience.TRAVEL" — the preview's built-in attribution
//   row — so branding is present without compositing an emblem onto the hero.

import fs from 'node:fs'
import path from 'node:path'

const URL_ID_RE = /^[A-Za-z0-9]{11}$/

// Scraper user-agents. Anything matching gets injected OG HTML; everything
// else (real browsers) falls through to the SPA.
const BOT_RE = new RegExp(
  [
    'facebookexternalhit', 'facebot',
    'WhatsApp',
    'Twitterbot',
    'Slackbot', 'Slack-ImgProxy',
    'LinkedInBot',
    'Discordbot',
    'TelegramBot',
    'Applebot',                 // iMessage rich links
    'redditbot',
    'Pinterest',
    'vkShare',
    'W3C_Validator',
    'Googlebot', 'bingbot',     // search preview parity
    'embedly', 'Iframely', 'quora link preview', 'outbrain',
    'nuzzel', 'Skype', 'Line', 'Viber', 'SkypeUriPreview',
    'developers.google.com/+/web/snippet',
  ].join('|'),
  'i',
)

const SITE_NAME = 'ambience.TRAVEL'
const CANONICAL_HOST = 'https://immerse.ambience.travel'
const EMBLEM_URL = 'https://immerse.ambience.travel/emblem.png' // branded fallback image
const DEFAULT_DESC = 'Meaningful travel, thoughtfully designed.'

// Strip internal version suffixes: "Together, In The Alps (v2)" -> "Together, In The Alps"
function stripVersion(s) {
  if (!s) return ''
  return String(s).replace(/\s*\(v\d+\)\s*$/i, '').trim()
}

// HTML-escape for safe attribute injection.
function esc(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Open Graph card image, derived from the page hero.
//
// Heroes are large full-bleed webp (2MB+). Scrapers do not reliably render
// webp and skip oversized images, which is why previews fell back to the
// generic card. Supabase image transformation returns a correctly sized JPEG
// from the same source, so ONE hero asset serves both contexts: no separate
// OG file to author and keep in sync.
//
// 1200x630 is the Open Graph card ratio. quality=75 keeps it around 200KB.
function ogImage(src) {
  if (!src) return ''
  const t = String(src).replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  if (t === String(src)) return String(src)   // not a Supabase storage URL, use as-is
  return `${t}?width=1200&height=630&resize=cover&quality=75`
}

// The generic ambience card — used for hidden, missing, or errored engagements.
// Carries zero engagement-specific data. Safe for public_view=false.
function genericMeta(urlId) {
  return {
    title: SITE_NAME,
    description: DEFAULT_DESC,
    image: EMBLEM_URL,
    url: `${CANONICAL_HOST}/${urlId ?? ''}`,
  }
}

function buildHtml(meta) {
  const title = esc(meta.title)
  const desc = esc(meta.description)
  const image = esc(meta.image)
  const url = esc(meta.url)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(SITE_NAME)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${url}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />

    <link rel="icon" href="/favicon.ico" sizes="any" />
    <meta name="theme-color" content="#1A1D1A" />
  </head>
  <body>
    <!-- Scraper-only shell. Real users are served the SPA and never see this. -->
    <a href="${url}">${title}</a>
  </body>
</html>`
}

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || ''
  const urlId = (req.query && req.query.urlId) || ''

  // Not a scraper → hand back to the SPA untouched. The vercel.json rewrite
  // only routes here; serving index.html preserves the normal app for users.
  if (!BOT_RE.test(ua)) {
    res.setHeader('x-og-passthrough', '1')
    return serveSpa(res)
  }

  // Malformed url_id → generic card, no EF call.
  if (!URL_ID_RE.test(urlId)) {
    return send(res, buildHtml(genericMeta(urlId)))
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  // If env is missing, fail safe to generic — never 500 a scraper.
  if (!SUPABASE_URL || !ANON) {
    return send(res, buildHtml(genericMeta(urlId)))
  }

  try {
    const efRes = await fetch(
      `${SUPABASE_URL}/functions/v1/travel-get-immerse-proposal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: JSON.stringify({ url_id: urlId }),
      },
    )

    // 403 (not_public) or 404 (not found) → generic, no leak. Identical output
    // for both, so no url_id existence signal.
    if (!efRes.ok) {
      return send(res, buildHtml(genericMeta(urlId)))
    }

    const data = await efRes.json()
    const row = data && data.engagement && data.engagement.engagementRow
    if (!row) {
      return send(res, buildHtml(genericMeta(urlId)))
    }

    const title = stripVersion(row.title) || SITE_NAME
    const description = row.hero_tagline || row.subtitle || DEFAULT_DESC
    const image = ogImage(row.hero_image_src) || EMBLEM_URL

    return send(res, buildHtml({
      title,
      description,
      image,
      url: `${CANONICAL_HOST}/${urlId}`,
    }))
  } catch (_e) {
    // Any failure → generic card. A scraper must never see a 500.
    return send(res, buildHtml(genericMeta(urlId)))
  }
}

function send(res, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Short cache: previews can refresh within minutes of an engagement edit.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(html)
}

// Serve the built SPA index.html to real users. On Vercel the built asset is
// at the deployment root; read and return it so the client app boots normally.
function serveSpa(res) {
  try {
    // Vercel build output: index.html sits at the output root.
    const candidates = [
      path.join(process.cwd(), 'index.html'),
      path.join(process.cwd(), 'dist', 'index.html'),
      path.join(process.cwd(), 'public', 'index.html'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const html = fs.readFileSync(p, 'utf8')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.status(200).send(html)
      }
    }
  } catch (_e) {
    // fall through
  }
  // Last resort: redirect to the canonical SPA entry so the user still lands.
  res.setHeader('Location', '/')
  return res.status(302).end()
}