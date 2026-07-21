// typesShopping.ts - Canonical registries for travel_shopping.
//
// What it owns:
//   - SHOP_TYPES - canonical type list (mirrors DB CHECK constraint)
//   - ShopType - type union
//   - SHOP_TYPE_META - display metadata (descriptions for admin form helpers)
//   - isValidShopType - runtime validator
//
// Sync requirement: the values in SHOP_TYPES MUST match the DB CHECK constraint
// travel_shopping_type_check exactly. To add a new type:
//   1. Migration: ALTER TABLE drop + recreate the CHECK with the new value
//   2. Add the value to SHOP_TYPES below
//   3. Add a SHOP_TYPE_META entry
//
// Last updated: S52 - initial registry. Seven types cover the v1 shopping
//   taxonomy across destinations (Saint-Tropez, London, NYC, Paris, etc.).
//   Designed to serve the guest's mental model ("what kind of place is this?")
//   with mutually exclusive primary identities.

export const SHOP_TYPES = [
  'Fashion',
  'Jewelry',
  'Fragrance',
  'Sandals',
  'Concept',
  'Resale',
  'Department Store',
] as const

export type ShopType = typeof SHOP_TYPES[number]

// ── Meta ──────────────────────────────────────────────────────────────────────

export interface ShopTypeMeta {
  label:       string
  description: string
}

export const SHOP_TYPE_META: Record<ShopType, ShopTypeMeta> = {
  'Fashion':          { label: 'Fashion',          description: 'Clothing-led houses: maisons, secondary fashion, resortwear.' },
  'Jewelry':          { label: 'Jewelry',          description: 'Primarily jewelry and watches.' },
  'Fragrance':        { label: 'Fragrance',        description: 'Perfumeries and fragrance ateliers.' },
  'Sandals':          { label: 'Sandals',          description: 'Local sandal ateliers (Saint-Tropez heritage craft).' },
  'Concept':          { label: 'Concept',          description: 'Curated multi-brand boutiques.' },
  'Resale':           { label: 'Resale',           description: 'Vintage and consignment of luxury pieces.' },
  'Department Store': { label: 'Department Store', description: 'Multi-floor multi-brand retail destinations.' },
}

export function getShopTypeMeta(t: ShopType): ShopTypeMeta {
  return SHOP_TYPE_META[t]
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function isValidShopType(value: unknown): value is ShopType {
  return typeof value === 'string'
    && (SHOP_TYPES as readonly string[]).includes(value)
}