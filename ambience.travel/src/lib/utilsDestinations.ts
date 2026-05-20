// destinations.ts — canonical destination reference for ambience.travel
// Single source of truth for all destination names, IDs, and shorthands.
// Import from here wherever destination names appear — never hardcode strings.
// Last updated: S11

import destinationsRaw from '../data/destinations.json'

// ─── Type ─────────────────────────────────────────────────────────────────────

export type Destination = {
  id:                   number
  destinationId:        string   // slug — used in routes, DB, and URL paths
  destinationName:      string   // full canonical name — use in prose and dropdowns
  destinationShorthand: string   // abbreviated name — use in pills, labels, tight UI
}

// ─── Data ─────────────────────────────────────────────────────────────────────

export const DESTINATIONS: Destination[] = destinationsRaw as Destination[]

// Operational destinations — excludes the zz-prefixed admin entries
export const DESTINATIONS_ACTIVE: Destination[] = DESTINATIONS.filter(
  d => !d.destinationId.startsWith('zz-')
)

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getDestinationById(id: number): Destination | undefined {
  return DESTINATIONS.find(d => d.id === id)
}

export function getDestinationBySlug(slug: string): Destination | undefined {
  return DESTINATIONS.find(d => d.destinationId === slug)
}

export function getDestinationName(slug: string): string {
  return getDestinationBySlug(slug)?.destinationName ?? slug
}

export function getDestinationShorthand(slug: string): string {
  return getDestinationBySlug(slug)?.destinationShorthand ?? slug
}