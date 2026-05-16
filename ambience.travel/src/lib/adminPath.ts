// adminPath.ts — Hash parsing + URL builders for AmbienceAdmin (#admin)
// Pure functions. No state. No side effects.
//
// Hash sub-routing:
//   #admin                                       → default landing
//   #admin/immerse/engagements                   → engagements list
//   #admin/immerse/engagements/<url_id>          → engagement detail
//   #admin/immerse/showcases                     → showcases (skeleton)
//   #admin/guides/dining                         → dining guides overlay list
//   #admin/guides/experiences                    → experiences guides overlay list
//   #admin/library/dining                        → all dining venues
//   #admin/library/dining/<dest-uuid>            → dining venues scoped to destination
//   #admin/house                                 → household list
//   #admin/programme/programmes                  → wrapped existing tab
//   #admin/programme/letters                     → wrapped existing tab
//   #admin/programme/listings                    → wrapped existing tab
//   #admin/programme/sections                    → wrapped existing tab
//   #admin/programme/properties                  → wrapped existing tab
//   #admin/programme/access-denied               → wrapped existing tab
//   #admin/programme/client-profile              → wrapped existing tab
//
// Last updated: S41 — Added 'experiences' guide tab. buildGuideUrl now
//   accepts optional surface param ('dining' | 'experiences'), defaults
//   to 'dining' for backward compatibility.
// Prior: S40D — Added 'house' product (ambience.HOUSE CRM).
// Prior: S36 — Library/dining accepts optional <dest-uuid> segment for
//   destination-scoped venue editing (drill-in from Guides tab).
// Prior: S36 — Added 'guides' + 'library' products with 'dining' tab each.
// Prior: S33

import { isTripUrlId } from './immersePath'

export type AdminProduct = 'immerse' | 'programme' | 'guides' | 'library' | 'house'

export type AdminTab =
  | { product: 'immerse';   tab: 'engagements'; urlId: string | null }
  | { product: 'immerse';   tab: 'showcases' }
  | { product: 'guides';    tab: 'dining' }
  | { product: 'guides';    tab: 'experiences' }
  | { product: 'guides';    tab: 'hotels' }
  | { product: 'library';   tab: 'dining'; destinationId: string | null }
  | { product: 'library';   tab: 'hotels'; destinationId: string | null }
  | { product: 'house';     tab: 'households' }
  | { product: 'programme'; tab: ProgrammeTabId }

export type ProgrammeTabId =
  | 'programmes'
  | 'letters'
  | 'listings'
  | 'sections'
  | 'properties'
  | 'access-denied'
  | 'client-profile'

const PROGRAMME_TABS: ProgrammeTabId[] = [
  'programmes', 'letters', 'listings', 'sections',
  'properties', 'access-denied', 'client-profile',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DEFAULT_TAB: AdminTab = { product: 'immerse', tab: 'engagements', urlId: null }

export function parseAdminHash(hash: string): AdminTab {
  const stripped = hash.replace(/^#admin\/?/, '').replace(/^\/+/, '')
  if (!stripped) return DEFAULT_TAB

  const parts = stripped.split('/').filter(Boolean)
  const [product, tab, ...rest] = parts

  if (product === 'immerse') {
    if (tab === 'engagements') {
      const urlId = rest[0] ?? null
      if (urlId && !isTripUrlId(urlId)) {
        return { product: 'immerse', tab: 'engagements', urlId: null }
      }
      return { product: 'immerse', tab: 'engagements', urlId }
    }
    if (tab === 'showcases') return { product: 'immerse', tab: 'showcases' }
    return DEFAULT_TAB
  }

  if (product === 'guides') {
    if (tab === 'dining')      return { product: 'guides', tab: 'dining' }
    if (tab === 'experiences') return { product: 'guides', tab: 'experiences' }
    if (tab === 'hotels')      return { product: 'guides', tab: 'hotels' }
    return DEFAULT_TAB
  }

  if (product === 'library') {
    if (tab === 'dining' || tab === 'hotels') {
      const destinationId = rest[0] ?? null
      if (destinationId && !UUID_RE.test(destinationId)) {
        return { product: 'library', tab: tab as 'dining' | 'hotels', destinationId: null }
      }
      return { product: 'library', tab: tab as 'dining' | 'hotels', destinationId }
    }
    return DEFAULT_TAB
  }

  if (product === 'house') {
    return { product: 'house', tab: 'households' }
  }

  if (product === 'programme') {
    if (PROGRAMME_TABS.includes(tab as ProgrammeTabId)) {
      return { product: 'programme', tab: tab as ProgrammeTabId }
    }
    return DEFAULT_TAB
  }

  return DEFAULT_TAB
}

export function buildAdminHash(target: AdminTab): string {
  if (target.product === 'immerse') {
    if (target.tab === 'engagements') {
      return target.urlId
        ? `#admin/immerse/engagements/${target.urlId}`
        : '#admin/immerse/engagements'
    }
    return '#admin/immerse/showcases'
  }
  if (target.product === 'guides') {
    if (target.tab === 'experiences') return '#admin/guides/experiences'
    if (target.tab === 'hotels')      return '#admin/guides/hotels'
    return '#admin/guides/dining'
  }
  if (target.product === 'library') {
    const surface = target.tab
    return target.destinationId
      ? `#admin/library/${surface}/${target.destinationId}`
      : `#admin/library/${surface}`
  }
  if (target.product === 'house') {
    return '#admin/house'
  }
  return `#admin/programme/${target.tab}`
}

export function navigateAdmin(target: AdminTab): void {
  window.location.hash = buildAdminHash(target)
}

const IMMERSE_HOST = 'immerse.ambience.travel'

export function buildEngagementUrl(urlId: string): string {
  if (typeof window === 'undefined') {
    return `https://${IMMERSE_HOST}/${urlId}`
  }
  const host = window.location.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') {
    return `${window.location.origin}/immerse/${urlId}`
  }
  if (host === IMMERSE_HOST) {
    return `${window.location.origin}/${urlId}`
  }
  return `https://${IMMERSE_HOST}/${urlId}`
}

const GUIDES_HOST = 'guides.ambience.travel'

export function buildGuideUrl(
  destinationSlug: string,
  surface: 'dining' | 'experiences' | 'hotels' = 'dining',
): string {
  if (typeof window === 'undefined') {
    return `https://${GUIDES_HOST}/${destinationSlug}/${surface}`
  }
  const host = window.location.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') {
    return `${window.location.origin}/guides/${destinationSlug}/${surface}`
  }
  if (host === GUIDES_HOST) {
    return `${window.location.origin}/${destinationSlug}/${surface}`
  }
  return `https://${GUIDES_HOST}/${destinationSlug}/${surface}`
}

export function generateUrlId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint32Array(11)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 11; i += 1) {
    out += alphabet[arr[i] % alphabet.length]
  }
  return out
}