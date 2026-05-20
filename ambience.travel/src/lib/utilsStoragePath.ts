// storagePath.ts — destination storage path resolver, DB-driven
// Owns:    composing the full storage folder path from a destination's
//          canonical storage_path column + category + optional hotel slug.
// Not owned: cascade UI (see GeoCascade.tsx), uploads (adminAssetQueries.ts),
//            DB queries for destinations (caller's job).
//
// The destination's storage_path column is the source of truth (added s33b_03).
// This helper just composes the trailing segments — category folder + hotel
// folder when category=accom. Returns null when storage_path is null (admin
// uses custom-path mode in that case).
//
// Last updated: S33B

export type AssetCategory = 'hero' | 'accom' | 'dining' | 'experiences'

export type StoragePathInput = {
  // The destination's canonical storage_path (from global_destinations).
  // null when the destination has no canonical path configured yet.
  destinationStoragePath: string | null
  category:               AssetCategory
  // Required when category='accom'. The hotel's storage slug (typically
  // hotel.short_slug, falling back to hotel.slug when null).
  hotelStorageSlug?: string
}

/**
 * Compose the full storage folder path. No leading or trailing slash.
 * Returns null when the destination has no storage_path or when accom is
 * requested without a hotel slug.
 */
export function resolveStoragePath(input: StoragePathInput): string | null {
  if (!input.destinationStoragePath) return null

  if (input.category === 'hero') {
    return input.destinationStoragePath
  }
  if (input.category === 'accom') {
    if (!input.hotelStorageSlug) return null
    return `${input.destinationStoragePath}/accom/${input.hotelStorageSlug}`
  }
  // dining + experiences are flat subfolders under the destination
  return `${input.destinationStoragePath}/${input.category}`
}