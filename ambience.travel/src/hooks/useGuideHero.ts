/* useGuideHero.ts - shared hero copy + image resolution.
 *
 * Every guide page resolves its hero the same way:
 *   eyebrow  ← overlay.eyebrowOverride  ?? destination.name
 *   headline ← overlay.headlineOverride ?? GUIDE_COPY[variant].defaultHeadline
 *   intro    ← overlay.introOverride    ?? resolveDefaultIntro(variant, ...)
 *   image    ← overlay.heroImageSrc    ?? destination.heroImageSrc ?? null
 *   alt      ← overlay.heroImageAlt    ?? destination.heroImageAlt ?? null
 *
 * Extracted from the four page files that shipped an identical copy of
 * this resolution in each. One implementation now.
 *
 * What it owns:
 *   - useGuideHero(destination, variant) → ResolvedHero
 *
 * What it does not own:
 *   - Rendering (GuideHero component)
 *   - PDF hero copy (guidePdf.ts reads the same fields directly)
 */

import { useMemo } from 'react'
import {
  GUIDE_COPY,
  resolveDefaultIntro,
  type GuideDestination,
  type GuideVariant,
} from '../types/typesGuides'

export interface ResolvedHero {
  eyebrow:  string
  headline: string
  intro:    string
  imageSrc: string | null
  imageAlt: string | null
}

export function useGuideHero(
  destination: GuideDestination,
  variant:     GuideVariant,
): ResolvedHero {
  return useMemo(() => {
    const overlay = destination.overlay
    return {
      eyebrow:  overlay?.eyebrowOverride  ?? destination.name,
      headline: overlay?.headlineOverride ?? GUIDE_COPY[variant].defaultHeadline,
      intro:    overlay?.introOverride    ?? resolveDefaultIntro(variant, destination.name),
      imageSrc: overlay?.heroImageSrc    ?? destination.heroImageSrc ?? null,
      imageAlt: overlay?.heroImageAlt    ?? destination.heroImageAlt ?? null,
    }
  }, [destination, variant])
}