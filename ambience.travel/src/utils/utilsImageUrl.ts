// imageUrl.ts — Storage URL rewriter for ambience.travel
// Strips the Supabase project-host prefix from storage URLs returned by
// queries, leaving a path-only string that resolves against the apex
// domain via the /img/* rewrite in vercel.json. The project ref never
// appears in rendered HTML.
//
// Defensive + idempotent: if a URL is already path-only (after a future
// DB cleanup migration), or doesn't match the storage host at all
// (e.g. an external image_credit_url pointing at a brand site), it
// passes through unchanged.
//
// Last updated: S30D
//
// SUPABASE_STORAGE_PREFIX is hard-coded rather than read from
// import.meta.env.VITE_SUPABASE_URL. Reading from the env would tie
// the rewriter to a runtime variable, which breaks the "this is a
// string-strip, not a URL builder" model — and means a staging project
// on a different ref would silently render broken URLs instead of
// leaving the staging prefix visible. Keep it explicit.

const SUPABASE_STORAGE_PREFIX =
  'https://rjobcbpnhymuczjhqzmh.supabase.co/storage/v1/object/public/ambience-assets'

export function rewriteImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith(SUPABASE_STORAGE_PREFIX)) {
    return '/img' + url.slice(SUPABASE_STORAGE_PREFIX.length)
  }
  return url
}

// Array variant — for gallery jsonb columns and any other URL[] fields.
// Filters out empty results so callers get a clean string[].
export function rewriteImageUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return []
  const out: string[] = []
  for (const u of urls) {
    const r = rewriteImageUrl(u)
    if (r) out.push(r)
  }
  return out
}