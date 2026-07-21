/* utilsGuideGating.ts - canonical guide gating rules.
 *
 * Single source of truth for how any guide surface (dining, shopping,
 * experiences, hotels, and any future variant) decides:
 *   - which items are visible to the current viewer,
 *   - whether an item's full body renders or only its teaser line,
 *   - whether the editorial prompt renders below the grid,
 *   - whether advisor extras (PDF, GuidePlanYourVisit, GuideComingUpSection)
 *     render.
 *
 * All four guide pages, all four cards, and the happening card route
 * through here. No inline gating math anywhere otherwise in src/.
 *
 * ── The contract ───────────────────────────────────────────────────────────
 * Every gateable item declares public_preview_rank as a required nullable
 * integer. Non-null rank means the item is visible to public viewers and
 * renders in full-body mode. Null means the item is gated to full-access
 * viewers only.
 *
 * All five caller types (DiningVenue, ExperienceVenue, Shop, HotelVenue,
 * Happening) satisfy this contract structurally. The four underlying
 * tables (travel_dining_venues, travel_experiences, travel_shopping,
 * travel_accom_hotels, travel_happenings) all carry the column, all
 * backfilled with sequential rank per destination. One contract, one
 * source of truth, uniform across every guide surface.
 *
 * ── What it owns ───────────────────────────────────────────────────────────
 *   - Gateable - the structural contract every guide item satisfies
 *   - isPubliclyPreviewable(item)
 *   - filterVisibleItems(items, hasFullAccess)
 *   - cardBodyMode(item, hasFullAccess)
 *   - shouldShowEditorialPrompt(visibleCount, totalCount, hasFullAccess)
 *   - shouldShowAdvisorExtras(hasFullAccess)
 *
 * ── What it does not own ───────────────────────────────────────────────────
 *   - Grant resolution (useGuideRoute owns that)
 *   - Filter state (per-page filter shape stays per-page)
 *   - How rank is assigned (SQL backfill + admin UI)
 *
 * ── Current state ──────────────────────────────────────────────────────────
 * Every guide item across every destination carries a non-null rank
 * post-S53. All items visible to all viewers. When auth-gating returns,
 * null out preview_rank on the items to be gated - nothing here changes.
 */

export type CardBodyMode = 'full' | 'teaser'

/**
 * The gating contract every guide item satisfies.
 * Required, nullable - every item declares this field; null means gated.
 */
export interface Gateable {
  publicPreviewRank: number | null
}

/**
 * Is this item publicly previewable?
 * Central definition so a semantic change (e.g. moving from "non-null rank"
 * to a boolean is_public column) doesn't require a repo-wide sweep.
 */
export function isPubliclyPreviewable(item: Gateable): boolean {
  return item.publicPreviewRank !== null
}

/**
 * From a full item set, return only the ones the current viewer can see.
 * Full-access viewers see everything. Public viewers see items with a
 * non-null preview rank.
 */
export function filterVisibleItems<T extends Gateable>(
  items:         T[],
  hasFullAccess: boolean,
): T[] {
  if (hasFullAccess) return items
  return items.filter(isPubliclyPreviewable)
}

/**
 * Should the card render its full body, or the teaser line?
 * Full body when either: the viewer has full access, or the item is
 * publicly previewable.
 */
// Canonical guide venue sort: alphabetical by name, accent-aware (localeCompare
// handles accents like e-acute and i-diaeresis). The ONE sort authority for every
// guide venue list - dining, experiences, shopping, hotels. public_preview_rank is
// gating only and never influences order. Never re-implement inline.
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

export function cardBodyMode(item: Gateable, hasFullAccess: boolean): CardBodyMode{
  if (hasFullAccess)               return 'full'
  if (isPubliclyPreviewable(item)) return 'full'
  return 'teaser'
}

/**
 * Should the "Contact your ambience team" editorial prompt render?
 * Only when something is actually being gated for this viewer. If
 * visibleCount equals totalCount, nothing is being teased and the prompt
 * has no meaning.
 */
export function shouldShowEditorialPrompt(
  visibleCount:  number,
  totalCount:    number,
  hasFullAccess: boolean,
): boolean {
  if (hasFullAccess)              return false
  if (visibleCount >= totalCount) return false
  return true
}

/**
 * Should advisor extras (PDF download, GuidePlanYourVisit,
 * GuideComingUpSection) render? Always gated on advisor access,
 * independent of the item set. Kept here so a policy change (e.g. PDF
 * becomes public) touches one file.
 */
export function shouldShowAdvisorExtras(hasFullAccess: boolean): boolean {
  return hasFullAccess
}