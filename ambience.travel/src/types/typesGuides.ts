/* typesGuides.ts — shared guide type foundation.
 *
 * One canonical overlay shape across all four guide variants
 * (dining, experiences, hotels, shopping). All four travel_*_guides
 * tables share the identical 17-column DB shape (verified S52 kickoff
 * via information_schema). This file is the single source of truth
 * for the editor layer.
 *
 * What it owns:
 *   - GuideVariant union
 *   - GuideTableName mapping
 *   - GuideOverlayDraft — the canonical 17-field shape for the editor
 *   - GuideOverlayPatch — partial of the draft for save dispatch
 *   - Per-variant copy defaults (eyebrow, headline, intro placeholders)
 *
 * What it does not own:
 *   - Venue types (variant-specific, live in their own query files)
 *   - Grants types (variant-specific, live in queriesAdminGuides.ts)
 *   - Query functions (live in queriesAdminGuides.ts)
 *
 * Last updated: S52 — initial build.
 */

export type GuideVariant = 'dining' | 'experiences' | 'hotels' | 'shopping'

export const GUIDE_TABLE_NAMES: Record<GuideVariant, string> = {
  dining:      'travel_dining_guides',
  experiences: 'travel_experiences_guides',
  hotels:      'travel_hotel_guides',
  shopping:    'travel_shopping_guides',
}

export const GUIDE_GRANT_TABLE_NAMES: Partial<Record<GuideVariant, string>> = {
  dining:      'travel_dining_guide_grants',
  experiences: 'travel_experiences_guide_grants',
  // hotels + shopping have no grants table yet — P1 carry
}

/**
 * The canonical guide overlay shape. Every travel_*_guides table carries
 * exactly these fields. The editor authors all of them; the PDF reads
 * all of them.
 *
 * Note: id + global_destination_id are present in every variant's admin
 * type (AdminDiningGuide etc.) but are not part of the editor draft —
 * they're identity, not content.
 */
export interface GuideOverlayDraft {
  hero_image_src:          string | null
  hero_image_alt:          string | null
  eyebrow_override:        string | null
  headline_override:       string | null
  intro_override:          string | null
  is_active:               boolean
  accuracy_date:           string | null
  at_a_glance_bullets:     string[] | null
  guide_year:              number | null
  guide_version:           string | null
  plan_your_visit_heading: string | null
  plan_your_visit_intro:   string | null
  plan_your_visit_bullets: string[] | null
}

/**
 * Partial overlay for save dispatch. Editor builds this from diff of
 * draft vs. original to avoid touching unchanged fields.
 */
export type GuideOverlayPatch = Partial<GuideOverlayDraft>

/**
 * Per-variant defaults for editor placeholders and PDF copy fallbacks.
 * Used when overlay field is NULL.
 */
export interface GuideVariantCopy {
  defaultEyebrow:  string
  productLabel:    string  // "Dining Guide" / "Hotels Guide" etc. — used in modal header + page chrome
  itemNoun:        string  // "venue" / "experience" / "hotel" / "shop" — for count rendering
  itemNounPlural:  string
}

export const GUIDE_COPY: Record<GuideVariant, GuideVariantCopy> = {
  dining: {
    defaultEyebrow: 'Curated Dining',
    productLabel:   'Dining Guide',
    itemNoun:       'venue',
    itemNounPlural: 'venues',
  },
  experiences: {
    defaultEyebrow: 'Curated Experiences',
    productLabel:   'Experiences Guide',
    itemNoun:       'experience',
    itemNounPlural: 'experiences',
  },
  hotels: {
    defaultEyebrow: 'Curated Hotels',
    productLabel:   'Hotels Guide',
    itemNoun:       'hotel',
    itemNounPlural: 'hotels',
  },
  shopping: {
    defaultEyebrow: 'Selected Shopping',
    productLabel:   'Shopping Guide',
    itemNoun:       'shop',
    itemNounPlural: 'shops',
  },
}

/**
 * Returns true if the variant supports per-user access grants.
 * dining + experiences have grants; hotels + shopping do not (yet).
 * Used to gate the Access tab visibility in GuideEditModal.
 */
export function variantHasGrants(variant: GuideVariant): boolean {
  return variant === 'dining' || variant === 'experiences'
}