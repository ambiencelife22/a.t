// guidePdfFonts.ts — Cormorant Garamond + Source Sans 3 TTF registration for jsPDF
// What it owns: fetch + base64 + addFont() for both font families.
// What it does not own: PDF rendering, font fallback logic.
//
// jsPDF requires TTF or OTF (woff2 won't parse). TTFs vendored at:
//   /public/fonts/CormorantGaramond-Regular.ttf
//   /public/fonts/CormorantGaramond-Italic.ttf
//   /public/fonts/SourceSans3-Light.ttf
//   /public/fonts/SourceSans3-LightItalic.ttf
//   /public/fonts/SourceSans3-Medium.ttf
//   /public/fonts/SourceSans3-Bold.ttf
//
// Cormorant is the serif headline / display family.
// Source Sans 3 is the sans body family. Light + LightItalic register under
// 'normal' / 'italic' weights so call sites use the same setSans(...) calls.
// Medium + Bold reserved for pills, eyebrows, and contrast moments.
//
// Cached at module level. Multi-PDF sessions reuse fetched TTFs.
//
// Last updated: S37. Swapped Regular+Italic for Light+LightItalic. Light
//   pairs more delicately with Cormorant's elegance; Regular ran slightly
//   heavy at body sizes against the serif headlines.
// Prior: S37. Added Source Sans 3 (4 weights). Replaced Helvetica fallback.
// Prior: S37. Initial ship (Cormorant only).

// ── Vendored asset URLs ─────────────────────────────────────────────────────

const FONT_URLS = {
  serifRegular: '/fonts/CormorantGaramond-Regular.ttf',
  serifItalic:  '/fonts/CormorantGaramond-Italic.ttf',
  sansRegular:  '/fonts/SourceSans3-Light.ttf',
  sansItalic:   '/fonts/SourceSans3-LightItalic.ttf',
  sansMedium:   '/fonts/SourceSans3-Medium.ttf',
  sansBold:     '/fonts/SourceSans3-Bold.ttf',
} as const

const FONT_VFS_NAMES = {
  serifRegular: 'CormorantGaramond-Regular.ttf',
  serifItalic:  'CormorantGaramond-Italic.ttf',
  sansRegular:  'SourceSans3-Light.ttf',
  sansItalic:   'SourceSans3-LightItalic.ttf',
  sansMedium:   'SourceSans3-Medium.ttf',
  sansBold:     'SourceSans3-Bold.ttf',
} as const

// ── Public font name constants ──────────────────────────────────────────────
// Used everywhere we call doc.setFont(...). Single source of truth so
// renaming a family is a one-line change.

export const PDF_FONTS = {
  serif: 'CormorantGaramond',
  sans:  'SourceSans3',
} as const

/**
 * Family alias for the medium weight. Internal. guidePdf's setSans helper
 * resolves 'medium' to this family + 'normal' weight pair.
 */
export const PDF_FONTS_SANS_MEDIUM_FAMILY = 'SourceSans3-Medium'

// ── Cached payload ──────────────────────────────────────────────────────────

interface FontData {
  serifRegular: string
  serifItalic:  string
  sansRegular:  string
  sansItalic:   string
  sansMedium:   string
  sansBold:     string
}

let cachedFontData: FontData | null = null

// ── Fetch helper ────────────────────────────────────────────────────────────

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

// ── Public loader ───────────────────────────────────────────────────────────

/**
 * Pre-fetch + base64-encode all 6 TTFs (2 Cormorant + 4 Source Sans 3).
 * Runs in parallel. Cached after first call. Throws if any fetch fails.
 *
 * Roughly 600kb on first load. Subsequent guide exports in the same session
 * reuse the cached payload (zero network).
 */
export async function loadGuideFonts(): Promise<FontData> {
  if (cachedFontData) return cachedFontData
  const [serifRegular, serifItalic, sansRegular, sansItalic, sansMedium, sansBold] = await Promise.all([
    fetchFontAsBase64(FONT_URLS.serifRegular),
    fetchFontAsBase64(FONT_URLS.serifItalic),
    fetchFontAsBase64(FONT_URLS.sansRegular),
    fetchFontAsBase64(FONT_URLS.sansItalic),
    fetchFontAsBase64(FONT_URLS.sansMedium),
    fetchFontAsBase64(FONT_URLS.sansBold),
  ])
  cachedFontData = { serifRegular, serifItalic, sansRegular, sansItalic, sansMedium, sansBold }
  return cachedFontData
}

// ── Public registrar ────────────────────────────────────────────────────────

/**
 * Registers Cormorant Garamond + Source Sans 3 on a jsPDF doc instance.
 * Call after `new jsPDF(...)`, before any setFont() invocation.
 *
 * jsPDF font weight strings: 'normal', 'bold', 'italic', 'bolditalic'.
 * Source Sans Medium ships under 'normal' weight on a separate family alias
 * (PDF_FONTS_SANS_MEDIUM_FAMILY) so callers can switch via setFont(family, weight).
 * setSans(doc, 'medium', size) in guidePdf.ts handles this aliasing.
 */
export function registerGuideFonts(doc: any, fontData: FontData) {
  // Serif (Cormorant)
  doc.addFileToVFS(FONT_VFS_NAMES.serifRegular, fontData.serifRegular)
  doc.addFont(FONT_VFS_NAMES.serifRegular, PDF_FONTS.serif, 'normal')

  doc.addFileToVFS(FONT_VFS_NAMES.serifItalic, fontData.serifItalic)
  doc.addFont(FONT_VFS_NAMES.serifItalic, PDF_FONTS.serif, 'italic')

  // Sans (Source Sans 3): regular + italic + bold under canonical family
  doc.addFileToVFS(FONT_VFS_NAMES.sansRegular, fontData.sansRegular)
  doc.addFont(FONT_VFS_NAMES.sansRegular, PDF_FONTS.sans, 'normal')

  doc.addFileToVFS(FONT_VFS_NAMES.sansItalic, fontData.sansItalic)
  doc.addFont(FONT_VFS_NAMES.sansItalic, PDF_FONTS.sans, 'italic')

  doc.addFileToVFS(FONT_VFS_NAMES.sansBold, fontData.sansBold)
  doc.addFont(FONT_VFS_NAMES.sansBold, PDF_FONTS.sans, 'bold')

  // Medium under a separate family alias. jsPDF doesn't have a 'medium'
  // weight in its built-in style map; aliasing is the standard workaround.
  doc.addFileToVFS(FONT_VFS_NAMES.sansMedium, fontData.sansMedium)
  doc.addFont(FONT_VFS_NAMES.sansMedium, PDF_FONTS_SANS_MEDIUM_FAMILY, 'normal')
}