// typesHappenings.ts — Canonical registries for travel_happenings.
//
// What it owns:
//   - HAPPENING_CATEGORIES — canonical category list (mirrors DB CHECK constraint)
//   - HappeningCategory — type union
//   - HAPPENING_CATEGORY_META — display metadata (for future admin dropdowns,
//     filter chips, eyebrow rendering)
//   - isValidHappeningCategory — runtime validator
//
// Sync requirement: the values in HAPPENING_CATEGORIES MUST match the DB
// CHECK constraint travel_happenings_category_check exactly. To add a new
// category:
//   1. Migration: ALTER TABLE drop + recreate the CHECK with the new value
//   2. Add the value to HAPPENING_CATEGORIES below
//   3. Add a HAPPENING_CATEGORY_META entry
//   4. Future Edge Function happenings writer revalidates from this registry
//
// Last updated: S52 — initial registry. Six categories cover the v1 VVIP
//   happening taxonomy: music concerts/festivals, cultural exhibitions,
//   sport events, culinary pop-ups/residencies, fashion runway/launches,
//   wellness retreats.

export const HAPPENING_CATEGORIES = [
  'Music',
  'Cultural',
  'Sport',
  'Culinary',
  'Fashion',
  'Wellness',
] as const

export type HappeningCategory = typeof HAPPENING_CATEGORIES[number]

// ── Meta ──────────────────────────────────────────────────────────────────────
// Per-category display metadata. Description is for admin form helper text;
// not currently surfaced on client UI.

export interface HappeningCategoryMeta {
  label:       string
  description: string
}

export const HAPPENING_CATEGORY_META: Record<HappeningCategory, HappeningCategoryMeta> = {
  Music:    { label: 'Music',    description: 'Concerts, festivals, opera, jazz performances.' },
  Cultural: { label: 'Cultural', description: 'Art fairs, gallery openings, exhibitions, theatre.' },
  Sport:    { label: 'Sport',    description: 'Polo, regattas, motorsport, tennis, racing.' },
  Culinary: { label: 'Culinary', description: 'Pop-up restaurants, chef residencies, wine festivals, tastings.' },
  Fashion:  { label: 'Fashion',  description: 'Runway shows, capsule launches, trunk shows.' },
  Wellness: { label: 'Wellness', description: 'Retreats, pop-up spas, immersive workshops.' },
}

export function getHappeningCategoryMeta(category: HappeningCategory): HappeningCategoryMeta {
  return HAPPENING_CATEGORY_META[category]
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function isValidHappeningCategory(value: unknown): value is HappeningCategory {
  return typeof value === 'string'
    && (HAPPENING_CATEGORIES as readonly string[]).includes(value)
}

// ── Surfaces ──────────────────────────────────────────────────────────────────
// A happening can be surfaced on one or more guide pages. Mirror of DB CHECK
// constraint on travel_happenings.surfaces.

export const HAPPENING_SURFACES = [
  'experiences',
  'dining',
  'shopping',
] as const

export type HappeningSurface = typeof HAPPENING_SURFACES[number]

export function isValidHappeningSurface(value: unknown): value is HappeningSurface {
  return typeof value === 'string'
    && (HAPPENING_SURFACES as readonly string[]).includes(value)
}