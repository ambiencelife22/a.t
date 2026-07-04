import { next } from '@vercel/edge'

export const config = {
  matcher: [
    '/:urlId([A-Za-z0-9]{11})',
    '/:urlId([A-Za-z0-9]{11})/proposal',
    '/:urlId([A-Za-z0-9]{11})/proposal/:dest',
  ],
}

const URL_ID_RE = /^[A-Za-z0-9]{11}$/

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

const SITE_NAME = 'ambience.TRAVEL'
const CANONICAL_HOST = 'https://immerse.ambience.travel'
const EMBLEM_URL = 'https://immerse.ambience.travel/emblem.png'
const DEFAULT_DESC = 'Meaningful travel, thoughtfully designed.'

function stripVersion(s) {
  if (!s) return ''
  return String(s).replace(/\s*\(v\d+\)\s*$/i, '').trim()
}

function esc(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function genericMeta(path) {
  return { title: SITE_NAME, description: DEFAULT_DESC, image: EMBLEM_URL, url: CANONICAL_HOST + path }
}

function buildHtml(meta) {
  const title = esc(meta.title)
  const desc = esc(meta.description)
  const image = esc(meta.image)
  const url = esc(meta.url)
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
    '    <meta property="og:url" content="' + url + '" />\n' +
    '    <meta name="twitter:card" content="summary_large_image" />\n' +
    '    <meta name="twitter:title" content="' + title + '" />\n' +
    '    <meta name="twitter:description" content="' + desc + '" />\n' +
    '    <meta name="twitter:image" content="' + image + '" />\n' +
    '    <link rel="icon" href="/favicon.ico" sizes="any" />\n' +
    '    <meta name="theme-color" content="#1A1D1A" />\n' +
    '  </head>\n  <body>\n    <a href="' + url + '">' + title + '</a>\n  </body>\n</html>'
}

function htmlResponse(html) {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}

function parsePath(pathname) {
  const parts = pathname.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean)
  const urlId = parts[0] || ''
  const destSlug = parts[1] === 'proposal' && parts[2] ? parts[2] : null
  return { urlId, destSlug }
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_RE.test(ua)) return next()

  const { pathname } = new URL(request.url)
  const { urlId, destSlug } = parsePath(pathname)

  if (!URL_ID_RE.test(urlId)) return next()

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

  if (!SUPABASE_URL || !ANON) return htmlResponse(buildHtml(genericMeta(pathname)))

  try {
    const reqBody = { url_id: urlId }
    if (destSlug) reqBody.destination_slug = destSlug

    const efRes = await fetch(SUPABASE_URL + '/functions/v1/travel-get-immerse-proposal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ANON, apikey: ANON },
      body: JSON.stringify(reqBody),
    })

    if (!efRes.ok) return htmlResponse(buildHtml(genericMeta(pathname)))

    const data = await efRes.json()

    if (destSlug && data && data.destination) {
      const dest = data.destination
      const tmpl = dest.destTemplate || {}
      const row = dest.destRow || {}
      const globalHero = dest.globalHero || {}
      const title = tmpl.title || SITE_NAME
      const description = tmpl.subtitle || tmpl.intro_body || DEFAULT_DESC
      const image = row.hero_image_src_override || tmpl.hero_image_src || globalHero.hero_image_src || EMBLEM_URL
      return htmlResponse(buildHtml({ title, description, image, url: CANONICAL_HOST + pathname }))
    }

    const row = data && data.engagement && data.engagement.engagementRow
    if (!row) return htmlResponse(buildHtml(genericMeta(pathname)))

    const title = stripVersion(row.title) || SITE_NAME
    const description = row.hero_tagline || row.subtitle || DEFAULT_DESC
    const image = row.hero_image_src || EMBLEM_URL
    return htmlResponse(buildHtml({ title, description, image, url: CANONICAL_HOST + pathname }))
  } catch (_e) {
    return htmlResponse(buildHtml(genericMeta(pathname)))
  }
}
