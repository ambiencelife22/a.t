/* typesGuides.ts - shared guide type foundation.
 *
 * One overlay shape across all four guide variants (dining, experiences,
 * hotels, shopping). All four travel_*_guides tables share the identical
 * 13-column DB shape. This file is the single source of truth for the
 * guide layer - editor, public reader, route layer.
 *
 * What it owns:
 *   - GuideVariant union
 *   - GUIDE_TABLE_NAMES (overlay tables)
 *   - GUIDE_GRANT_TABLE_NAMES (writable grants tables)
 *   - GUIDE_GRANT_VIEW_NAMES (readable per-user grants views)
 *   - GUIDE_ROUTE_SEGMENTS (URL path segments)
 *   - GuideOverlay - overlay shape (public reader + editor)
 *   - GuideOverlayDraft, GuideOverlayPatch - editor aliases
 *   - GuideDestination - generic destination shape used by all four variants
 *   - GrantStatus - shared grant check result
 *   - GUIDE_COPY - per-variant copy defaults, including section labels,
 *     item nouns, teaser italic lines, empty and loading state text,
 *     and default intro template
 *   - formatItemCount, formatSectionHeader, resolveDefaultIntro
 *   - variantHasGrants(variant)
 *
 * What it does not own:
 *   - Venue types (variant-specific, in queriesGuides<X>.ts)
 *   - Query functions (queriesGuides.ts for shared, queriesGuides<X>.ts
 *     for variant-specific reads)
 *   - Gating logic (utilsGuideGating.ts)
 *   - PDF year/version resolvers (utilsGuidePdf.ts)
 *
 * Last updated: S53 - GUIDE_COPY extended with sectionLabel, teaserItalic,
 *   emptyStateText, loadingStateText, defaultIntroTemplate. Nine-file
 *   guide-layer extraction consolidates all inline copy into this file.
 * Prior: S53 - Generic GuideDestination + GrantStatus consolidation.
 * Prior: S52 - initial build.
 */

export type GuideVariant = 'dining' | 'experiences' | 'hotels' | 'shopping'

// ── DB table + view mappings ─────────────────────────────────────────────────

export const GUIDE_TABLE_NAMES: Record<GuideVariant, string> = {
  dining:      'travel_dining_guides',
  experiences: 'travel_experiences_guides',
  hotels:      'travel_hotel_guides',
  shopping:    'travel_shopping_guides',
}

export const GUIDE_GRANT_TABLE_NAMES: Partial<Record<GuideVariant, string>> = {
  dining:      'travel_dining_guide_grants',
  experiences: 'travel_experiences_guide_grants',
  // hotels + shopping have no grants table yet
}

export const GUIDE_GRANT_VIEW_NAMES: Partial<Record<GuideVariant, string>> = {
  dining:      'travel_dining_guide_for_user',
  experiences: 'travel_experiences_guide_for_user',
  // hotels + shopping have no grants view yet
}

// ── Route segment mapping (URL path) ─────────────────────────────────────────

export const GUIDE_ROUTE_SEGMENTS: Record<GuideVariant, string> = {
  dining:      'dining',
  experiences: 'experiences',
  hotels:      'hotels',
  shopping:    'shopping',
}

// ── Overlay shape ────────────────────────────────────────────────────────────

/**
 * The guide overlay shape. Every travel_*_guides table carries exactly
 * these fields. The editor authors them, the PDF reads them, the guide
 * page reads them. One type, four tables.
 */
export interface GuideOverlay {
  heroImageSrc:          string | null
  heroImageAlt:          string | null
  eyebrowOverride:        string | null
  headlineOverride:       string | null
  introOverride:          string | null
  isActive:               boolean
  accuracyDate:           string | null
  atAGlanceBullets:     string[] | null
  guideYear:              number | null
  guideVersion:           string | null
  planYourVisitHeading: string | null
  planYourVisitIntro:   string | null
  planYourVisitBullets: string[] | null
}

/** Alias for editor clarity. Same shape. */
export type GuideOverlayDraft = GuideOverlay

/** Partial overlay for editor save dispatch (diff of draft vs original). */
export type GuideOverlayPatch = Partial<GuideOverlay>

// ── Destination shape (generic) ──────────────────────────────────────────────

/**
 * Destination shape for guide pages. Single type used by all four variants.
 * Replaces the prior per-variant destination types that carried identical
 * shape with different names.
 */
export interface GuideDestination {
  id:           string
  slug:         string
  name:         string
  heroImageSrc: string | null
  heroImageAlt: string | null
  overlay:      GuideOverlay | null
}

// ── Grant status (shared) ────────────────────────────────────────────────────

export type GrantStatus =
  | { status: 'granted' }
  | { status: 'no_grant' }
  | { status: 'no_session' }
  | { status: 'ungated' }

// ── Per-variant copy ─────────────────────────────────────────────────────────

/**
 * Every copy string a guide page or card needs, per variant. Consolidates
 * strings that used to live inline across four page files and four card
 * files.
 *
 * Field roles:
 *   defaultHeadline      - hero H1 when overlay.headlineOverride is null
 *   productLabel         - long-form label ("Dining Guide") for footers,
 *                          editorial prompt eyebrow, PDF metadata
 *   sectionLabel         - short section title suffix ("Selected {label}")
 *   itemNoun             - singular count noun ("Table")
 *   itemNounPlural       - plural count noun ("Tables")
 *   teaserItalic         - italic line inside the editorial prompt below
 *                          the grid ("There is more to this table.")
 *   emptyStateText       - text when the filtered set is empty and viewer
 *                          has advisor access
 *   loadingStateText     - text while the fetch is in flight
 *   defaultIntroTemplate - hero intro template with {destinationName} slot
 *                          when overlay.introOverride is null
 */
export interface GuideVariantCopy {
  defaultHeadline:      string
  productLabel:         string
  sectionLabel:         string
  itemNoun:             string
  itemNounPlural:       string
  teaserItalic:         string
  emptyStateText:       string
  loadingStateText:     string
  defaultIntroTemplate: string
}

export const GUIDE_COPY: Record<GuideVariant, GuideVariantCopy> = {
  dining: {
    defaultHeadline:      'The Dining Guide',
    productLabel:         'Dining Guide',
    sectionLabel:         'Dining',
    itemNoun:             'Table',
    itemNounPlural:       'Tables',
    teaserItalic:         'There is more to this table.',
    emptyStateText:       'Nothing here for those filters yet. Try widening the search.',
    loadingStateText:     'Setting the table.',
    defaultIntroTemplate: 'A dining guide for {destinationName}.',
  },
  experiences: {
    defaultHeadline:      'The Experiences Guide',
    productLabel:         'Experiences Guide',
    sectionLabel:         'Experiences',
    itemNoun:             'Experience',
    itemNounPlural:       'Experiences',
    teaserItalic:         'There is more to discover here.',
    emptyStateText:       'No experiences here yet.',
    loadingStateText:     'Finding the right doors.',
    defaultIntroTemplate: 'An experiences guide for {destinationName}.',
  },
  hotels: {
    defaultHeadline:      'The Hotels Guide',
    productLabel:         'Hotels Guide',
    sectionLabel:         'Hotels',
    itemNoun:             'Hotel',
    itemNounPlural:       'Hotels',
    teaserItalic:         'There is more to this house.',
    emptyStateText:       'Nothing here for those filters yet. Try widening the search.',
    loadingStateText:     'Setting the scene.',
    defaultIntroTemplate: 'A hotel guide for {destinationName}.',
  },
  shopping: {
    defaultHeadline:      'The Shopping Guide',
    productLabel:         'Shopping Guide',
    sectionLabel:         'Shopping',
    itemNoun:             'Shop',
    itemNounPlural:       'Shops',
    teaserItalic:         'There is more to discover here.',
    emptyStateText:       'No shopping curated here yet.',
    loadingStateText:     'Finding the right doorways.',
    defaultIntroTemplate: 'A shopping guide for {destinationName}.',
  },
}

/**
 * "N Item" or "N Items" pattern.
 */
export function formatItemCount(variant: GuideVariant, count: number): string {
  const c = GUIDE_COPY[variant]
  return `${count} ${count === 1 ? c.itemNoun : c.itemNounPlural}`
}

/**
 * "Selected {SectionLabel} \u00B7 N Item(s)" pattern.
 */
export function formatSectionHeader(variant: GuideVariant, count: number): string {
  const c = GUIDE_COPY[variant]
  return `Selected ${c.sectionLabel} \u00B7 ${formatItemCount(variant, count)}`
}

/**
 * Default hero intro for a variant, given a destination name.
 * Called when overlay.introOverride is null.
 */
export function resolveDefaultIntro(
  variant:         GuideVariant,
  destinationName: string,
): string {
  return GUIDE_COPY[variant].defaultIntroTemplate.replace(
    '{destinationName}',
    destinationName,
  )
}

// ── Variant helpers ──────────────────────────────────────────────────────────

export function variantHasGrants(variant: GuideVariant): boolean {
  return variant === 'dining' || variant === 'experiences'
}