/* typesGuides.ts — shared guide type foundation.
 *
 * One canonical overlay shape across all four guide variants
 * (dining, experiences, hotels, shopping). All four travel_*_guides
 * tables share the identical 13-column DB shape. This file is the single
 * source of truth for the guide layer — editor, public reader, route layer.
 *
 * What it owns:
 *   - GuideVariant union
 *   - GUIDE_TABLE_NAMES (overlay tables)
 *   - GUIDE_GRANT_TABLE_NAMES (writable grants tables)
 *   - GUIDE_GRANT_VIEW_NAMES (readable per-user grants views)
 *   - GUIDE_ROUTE_SEGMENTS (URL path segments)
 *   - GuideOverlay — canonical overlay shape (public reader + editor)
 *   - GuideOverlayDraft, GuideOverlayPatch — editor aliases
 *   - GuideDestination — generic destination shape, replaces four
 *     near-identical per-variant types
 *   - GrantStatus — shared grant check result
 *   - GUIDE_COPY — per-variant copy defaults
 *
 * What it does not own:
 *   - Venue types (variant-specific, in queriesGuides<X>.ts)
 *   - Query functions (queriesGuides.ts for shared, queriesGuides<X>.ts
 *     for variant-specific reads)
 *
 * Last updated: S53 — Generic GuideDestination + GrantStatus consolidation.
 *   Eliminates duplicated overlay/destination types across four query files
 *   and the route layer. Adds GUIDE_GRANT_VIEW_NAMES + GUIDE_ROUTE_SEGMENTS
 *   for the generic destination fetch and the useGuideRoute hook.
 * Prior: S52 — initial build.
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

// ── Route segment mapping (URL path) ────────────────────────────────────────

export const GUIDE_ROUTE_SEGMENTS: Record<GuideVariant, string> = {
  dining:      'dining',
  experiences: 'experiences',
  hotels:      'hotels',
  shopping:    'shopping',
}

// ── Overlay shape ───────────────────────────────────────────────────────────

/**
 * The canonical guide overlay shape. Every travel_*_guides table carries
 * exactly these fields. The editor authors them; the PDF reads them; the
 * public guide page reads them. One type, four tables.
 */
export interface GuideOverlay {
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

/** Alias for editor clarity. Same shape. */
export type GuideOverlayDraft = GuideOverlay

/** Partial overlay for editor save dispatch (diff of draft vs original). */
export type GuideOverlayPatch = Partial<GuideOverlay>

// ── Destination shape (generic) ─────────────────────────────────────────────

/**
 * Canonical destination shape for guide pages. Single type used by all four
 * variants. Replaces GuideDestination, ExperiencesGuideDestination,
 * ShoppingGuideDestination, HotelGuideDestination — they all collapse here.
 */
export interface GuideDestination {
  id:           string
  slug:         string
  name:         string
  heroImageSrc: string | null
  heroImageAlt: string | null
  overlay:      GuideOverlay | null
}

// ── Grant status (shared) ───────────────────────────────────────────────────

export type GrantStatus =
  | { status: 'granted' }
  | { status: 'no_grant' }
  | { status: 'no_session' }
  | { status: 'ungated' }  // variants without grant infrastructure (hotels, shopping)

// ── Per-variant copy defaults ───────────────────────────────────────────────

export interface GuideVariantCopy {
  defaultHeadline: string
  productLabel:    string
  itemNoun:        string
  itemNounPlural:  string
}

export const GUIDE_COPY: Record<GuideVariant, GuideVariantCopy> = {
  dining: {
    defaultHeadline: 'The Dining Guide',
    productLabel:    'Dining Guide',
    itemNoun:        'venue',
    itemNounPlural:  'venues',
  },
  experiences: {
    defaultHeadline: 'The Experiences Guide',
    productLabel:    'Experiences Guide',
    itemNoun:        'experience',
    itemNounPlural:  'experiences',
  },
  hotels: {
    defaultHeadline: 'The Hotels Guide',
    productLabel:    'Hotels Guide',
    itemNoun:        'hotel',
    itemNounPlural:  'hotels',
  },
  shopping: {
    defaultHeadline: 'The Shopping Guide',
    productLabel:    'Shopping Guide',
    itemNoun:        'shop',
    itemNounPlural:  'shops',
  },
}

// ── Variant helpers ─────────────────────────────────────────────────────────

export function variantHasGrants(variant: GuideVariant): boolean {
  return variant === 'dining' || variant === 'experiences'
}