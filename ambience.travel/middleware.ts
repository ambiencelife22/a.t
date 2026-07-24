// middleware.ts
//
// Vercel Edge Middleware - per-engagement Open Graph link previews.
//
// WHY THIS EXISTS:
//   The immerse surface is a client-rendered Vite SPA. Link scrapers (WhatsApp,
//   iMessage, Slack, Facebook) do not run JavaScript: they read the raw HTML
//   head. Without server-injected tags every shared link previews as the generic
//   site card. This middleware intercepts scraper requests, resolves the
//   engagement's title, tagline and hero, and returns HTML carrying per-
//   engagement og:* tags. Real users fall through to the SPA untouched.
//
//   Middleware, not a serverless function: edge middleware runs BEFORE rewrites,
//   so it needs no route config and cannot be bypassed by the SPA catch-all.
//   An api/og function was tried in parallel and never ran - deleted S53N.
//
// DEPTH-AWARE:
//   Matches the engagement overview AND destination subpages
//   (/{urlId}/proposal/{dest}), so a shared subpage link previews that
//   destination rather than the engagement.
//
// PRIVACY (Mission: privacy first):
//   Reads through travel-get-immerse-proposal, which enforces public_view.
//   Hidden (403) or missing (404) engagements return the GENERIC ambience card,
//   never the hidden engagement's title or hero. Identical output for both, so
//   no url_id existence leak. The preview carries destination, title and tagline
//   only - never a guest name, because it renders for everyone in whatever chat
//   the link lands in.
//
// BRANDING:
//   The hero is the card (clean, cinematic). Branding rides in og:site_name, the
//   preview's built-in attribution row, rather than compositing an emblem onto
//   the image.

import { next } from '@vercel/edge'

export const config = {
  matcher: [
    '/:urlId([A-Za-z0-9]{11})',
    '/:urlId([A-Za-z0-9]{11})/proposal',
    '/:urlId([A-Za-z0-9]{11})/proposal/:dest',
  ],
}

const URL_ID_RE = /^[A-Za-z0-9]{11}$/

// Scraper user agents. Anything matching gets the injected OG document;
// everything else (real browsers) falls through to the SPA.
const BOT_RE = new RegExp(
  [
    'facebookexternalhit', 'facebot',
    'WhatsApp',
    'Twitterbot',
    'Slackbot', 'Slack-ImgProxy',
    'LinkedInBot',
    'Discordbot',
    'TelegramBot',
    'Applebot',
    'redditbot',
    'Pinterest',
    'vkShare',
    'W3C_Validator',
    'Googlebot', 'bingbot',
    'embedly', 'Iframely', 'quora link preview', 'outbrain',
    'nuzzel', 'Skype', 'Line', 'Viber', 'SkypeUriPreview',
  ].join('|'),
  'i',
)

const SITE_NAME      = 'ambience.TRAVEL'
const CANONICAL_HOST = 'https://immerse.ambience.travel'
const EMBLEM_URL     = 'https://immerse.ambience.travel/emblem.png'
const DEFAULT_DESC   = 'Meaningful travel, thoughtfully designed.'

type Meta = {
  title:       string
  description: string
  image:       string
  url:         string
}

type ProposalBody = {
  url_id:            string
  destination_slug?: string
}

// Strip internal version suffixes: "Together, In The Alps (v2)" -> "Together, In The Alps"
function stripVersion(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/\s*\(v\d+\)\s*$/i, '').trim()
}

// Open Graph card image, derived from the page hero.
//
// Heroes are large full-bleed webp (2MB+). Scrapers do not reliably render webp
// and skip oversized images, so previews fell back to the generic card. Supabase
// image transformation returns a correctly sized JPEG from the same source, so
// ONE hero asset serves both contexts: no separate OG file to author or keep in
// sync. 1200x630 is the Open Graph card ratio; quality=75 lands around 200KB.
function ogImage(src: string | null | undefined): string {
  if (!src) return ''
  const s = String(src)
  const t = s.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  if (t === s) return s
  return t + '?width=1200&height=630&resize=cover&quality=75'
}

// HTML-escape for safe attribute injection.
function esc(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// The generic ambience card - hidden, missing or errored engagements. Carries
// zero engagement-specific data, so it is safe for public_view=false.
function genericMeta(path: string): Meta {
  return { title: SITE_NAME, description: DEFAULT_DESC, image: EMBLEM_URL, url: CANONICAL_HOST + path }
}

function buildHtml(meta: Meta): string {
  const title = esc(meta.title)
  const desc  = esc(meta.description)
  const image = esc(meta.image)
  const url   = esc(meta.url)
  return '<!doctype html>\n<html lang="en">\n  <head>\n' +
    '    <meta charset="UTF-8" />\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '    <title>' + title + '</title>\n' +
    '    <meta name="description" content="' + desc + '" />\n' +
    '    <meta property="og:type" content="website" />\n' +
    '    <meta property="og:site_name" content="' + esc(SITE_NAME) + '" />\n' +
    '    <meta property="og:title" content="' + title + '" />\n' +
    '    <meta property="og:description" content="' + desc + '" />\n' +
    '    <meta property="og:image" content="' + image + '" />\n' +
    '    <meta property="og:image:width" content="1200" />\n' +
    '    <meta property="og:image:height" content="630" />\n' +
    '    <meta property="og:url" content="' + url + '" />\n' +
    '    <meta name="twitter:card" content="summary_large_image" />\n' +
    '    <meta name="twitter:title" content="' + title + '" />\n' +
    '    <meta name="twitter:description" content="' + desc + '" />\n' +
    '    <meta name="twitter:image" content="' + image + '" />\n' +
    '    <link rel="icon" href="/favicon.ico" sizes="any" />\n' +
    '    <meta name="theme-color" content="#1A1D1A" />\n' +
    '  </head>\n  <body>\n    <a href="' + url + '">' + title + '</a>\n  </body>\n</html>'
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type':  'text/html; charset=utf-8',
      // Short cache: previews refresh within minutes of an engagement edit.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}

function parsePath(pathname: string): { urlId: string; destSlug: string | null } {
  const parts = pathname.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean)
  const urlId = parts[0] || ''
  const destSlug = parts[1] === 'proposal' && parts[2] ? parts[2] : null
  return { urlId, destSlug }
}

export default async function middleware(request: Request): Promise<Response> {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_RE.test(ua)) return next()

  const { pathname } = new URL(request.url)
  const { urlId, destSlug } = parsePath(pathname)

  if (!URL_ID_RE.test(urlId)) return next()

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const ANON         = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

  // Missing env fails safe to the generic card - a scraper must never see a 500.
  if (!SUPABASE_URL || !ANON) return htmlResponse(buildHtml(genericMeta(pathname)))

  try {
    const reqBody: ProposalBody = { url_id: urlId }
    if (destSlug) reqBody.destination_slug = destSlug

    const efRes = await fetch(SUPABASE_URL + '/functions/v1/travel-get-immerse-proposal', {
      method:  'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ANON, apikey: ANON },
      body:    JSON.stringify(reqBody),
    })

    // 403 (not_public) or 404 (not found) both return the generic card:
    // identical output, so no url_id existence signal.
    if (!efRes.ok) return htmlResponse(buildHtml(genericMeta(pathname)))

    const data = await efRes.json()

    // Destination subpage: preview that destination, not the engagement.
    if (destSlug && data && data.destination) {
      const dest       = data.destination
      const tmpl       = dest.destTemplate || {}
      const row        = dest.destRow || {}
      const globalHero = dest.globalHero || {}
      const title       = tmpl.title || SITE_NAME
      const description = tmpl.subtitle || tmpl.intro_body || DEFAULT_DESC
      const image       = ogImage(row.hero_image_src_override || tmpl.hero_image_src || globalHero.hero_image_src) || EMBLEM_URL
      return htmlResponse(buildHtml({ title, description, image, url: CANONICAL_HOST + pathname }))
    }

    const row = data && data.engagement && data.engagement.engagementRow
    if (!row) return htmlResponse(buildHtml(genericMeta(pathname)))

    const title       = stripVersion(row.title) || SITE_NAME
    const description = row.hero_tagline || row.subtitle || DEFAULT_DESC
    const image       = ogImage(row.hero_image_src) || EMBLEM_URL
    return htmlResponse(buildHtml({ title, description, image, url: CANONICAL_HOST + pathname }))
  } catch (_e) {
    // Any failure returns the generic card. A scraper must never see a 500.
    return htmlResponse(buildHtml(genericMeta(pathname)))
  }
}
