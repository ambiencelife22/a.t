// mapsUrl.ts — global maps URL resolution helpers
// Single source of truth for resolving clickable + embeddable maps URLs from
// any entity with a maps_url, address, or maps_embed_url field. Used by:
//   - guides (DiningCard address row)
//   - programme (property card View on map link, embedded map iframe)
//   - immerse (future — destination + hotel map links)
//
// What it owns: URL resolution + address-search fallback construction.
// What it does not own: native app routing (URL scheme handles platform).
//
// Resolution semantics:
//   resolveMapsLink — for click-to-open (native app on mobile, browser on desktop)
//   resolveMapsEmbed — for iframe embed (different URL format, no fallback)
//
// Last updated: S35 — initial. Lifted from guide-only helper to global lib.
//   Programme will refactor its inline maps_url usage to call resolveMapsLink
//   in the next programme-touching session.

/**
 * Resolves a clickable maps URL for an entity (venue, property, hotel, etc).
 *
 * Priority:
 *   1. mapsUrl if populated — Google or Apple Maps share link, native apps
 *      handle the URL scheme on iOS/Android, desktop opens in browser
 *   2. Google Maps search query against address as fallback
 *   3. null if both empty (caller should not render a link)
 *
 * Use for: address row links, "View on map" buttons, share sheet entries.
 */
export function resolveMapsLink(
  mapsUrl: string | null | undefined,
  address: string | null | undefined,
): string | null {
  if (mapsUrl && mapsUrl.trim()) {
    return mapsUrl.trim()
  }
  if (address && address.trim()) {
    const query = encodeURIComponent(address.trim())
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }
  return null
}

/**
 * Resolves a Google Maps embed URL for iframe rendering.
 *
 * Returns the embed URL if populated, null otherwise. No fallback —
 * embeds require a specific Google Maps Embed API URL format
 * (https://www.google.com/maps/embed?pb=...) that cannot be synthesized
 * from an address alone. If the embed URL is missing, the consumer should
 * either skip the iframe or fall back to a clickable link via
 * resolveMapsLink.
 *
 * Use for: property page maps iframe, destination subpage map widgets.
 */
export function resolveMapsEmbed(
  embedUrl: string | null | undefined,
): string | null {
  if (embedUrl && embedUrl.trim()) {
    return embedUrl.trim()
  }
  return null
}

/**
 * @deprecated Use resolveMapsLink. Kept as a re-export for one session to
 * avoid breaking guide consumers shipped earlier in S35. Remove in S36.
 */
export const resolveMapsUrl = resolveMapsLink