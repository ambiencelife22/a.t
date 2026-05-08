// guidePdfFonts.ts — Cormorant Garamond TTF registration for jsPDF
// What it owns: fetch + base64 + addFont() for Cormorant regular + italic.
// What it does not own: PDF rendering, font fallback logic.
//
// jsPDF requires TTF or OTF — woff2 won't parse. TTFs vendored at:
//   /public/fonts/cormorant-garamond-latin.ttf
//   /public/fonts/cormorant-garamond-latin-italic.ttf
//
// Helvetica is the canonical sans for guide PDFs (jsPDF built-in, no fetch).
// We don't register a sans here — that ships zero-cost via doc.setFont('helvetica', ...).
//
// Cached at module level — multi-PDF sessions reuse fetched TTFs.
//
// Last updated: S37 — Initial ship.

const FONT_URLS = {
  regular: '/fonts/CormorantGaramond-Regular.ttf',
  italic:  '/fonts/CormorantGaramond-Italic.ttf',
} as const

const FONT_VFS_NAMES = {
  regular: 'CormorantGaramond-Regular.ttf',
  italic:  'CormorantGaramond-Italic.ttf',
} as const

export const PDF_FONTS = {
  serif: 'CormorantGaramond',
  sans:  'helvetica',
} as const

let cachedFontData: { regular: string; italic: string } | null = null

/**
 * Fetches a TTF and returns its bytes as a base64 string.
 * jsPDF expects base64 (without data: prefix) for addFileToVFS.
 */
async function fetchFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch font ${url}: ${res.status} ${res.statusText}`)
  }
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // Convert to base64 in chunks to avoid stack overflow on large buffers.
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
  }
  return btoa(binary)
}

/**
 * Pre-fetch + base64-encode the Cormorant TTFs.
 * Cached after first call. Throws if either fetch fails.
 */
export async function loadGuideFonts(): Promise<{ regular: string; italic: string }> {
  if (cachedFontData) return cachedFontData
  const [regular, italic] = await Promise.all([
    fetchFontAsBase64(FONT_URLS.regular),
    fetchFontAsBase64(FONT_URLS.italic),
  ])
  cachedFontData = { regular, italic }
  return cachedFontData
}

/**
 * Registers Cormorant Garamond on a jsPDF doc instance.
 * Call after `new jsPDF(...)`, before any setFont('CormorantGaramond', ...).
 */
export function registerGuideFonts(doc: any, fontData: { regular: string; italic: string }) {
  doc.addFileToVFS(FONT_VFS_NAMES.regular, fontData.regular)
  doc.addFont(FONT_VFS_NAMES.regular, PDF_FONTS.serif, 'normal')

  doc.addFileToVFS(FONT_VFS_NAMES.italic, fontData.italic)
  doc.addFont(FONT_VFS_NAMES.italic, PDF_FONTS.serif, 'italic')
}