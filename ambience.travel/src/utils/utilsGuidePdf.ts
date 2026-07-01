/* utilsGuidePdf.ts — PDF year + version resolution.
 *
 * Both fields resolve identically across all four guide variants:
 *   year    — overlay value if set, else current calendar year
 *   version — overlay value if set and non-empty, else '1.0'
 *
 * Extracted from the four page files that shipped an identical copy of
 * this logic in each. One implementation now.
 *
 * What it owns:
 *   - DEFAULT_GUIDE_VERSION
 *   - resolveGuideYear(overlayYear)
 *   - resolveGuideVersion(overlayVersion)
 *
 * What it does not own:
 *   - PDF rendering (guidePdf.ts owns full lifecycle)
 *   - Overlay resolution against defaults (per-page hero resolution)
 */

export const DEFAULT_GUIDE_VERSION = '1.0'

export function resolveGuideYear(overlayYear: number | null | undefined): number {
  if (overlayYear != null) return overlayYear
  return new Date().getFullYear()
}

export function resolveGuideVersion(overlayVersion: string | null | undefined): string {
  if (overlayVersion != null && overlayVersion.trim().length > 0) return overlayVersion
  return DEFAULT_GUIDE_VERSION
}