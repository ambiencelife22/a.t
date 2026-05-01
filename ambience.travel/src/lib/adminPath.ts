// adminPath.ts — Hash parsing + URL builders for AmbienceAdmin (#admin)
// Pure functions. No state. No side effects. Mirrors immersePath.ts shape.
//
// Hash sub-routing:
//   #admin                                  → default landing
//   #admin/immerse/engagements              → engagements list
//   #admin/immerse/engagements/<url_id>     → engagement detail
//   #admin/immerse/showcases                → showcases (skeleton)
//   #admin/programme/programmes             → wrapped existing tab
//   #admin/programme/letters                → wrapped existing tab
//   #admin/programme/listings               → wrapped existing tab
//   #admin/programme/sections               → wrapped existing tab
//   #admin/programme/properties             → wrapped existing tab
//   #admin/programme/access-denied          → wrapped existing tab
//   #admin/programme/client-profile         → wrapped existing tab
//
// Last updated: S33

import { isTripUrlId } from './immersePath'

export type AdminProduct = 'immerse' | 'programme'

export type AdminTab =
  | { product: 'immerse';   tab: 'engagements'; urlId: string | null }
  | { product: 'immerse';   tab: 'showcases' }
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

// Default landing — engagements list
export const DEFAULT_TAB: AdminTab = { product: 'immerse', tab: 'engagements', urlId: null }

export function parseAdminHash(hash: string): AdminTab {
  // Strip leading '#admin' and any leading slashes
  const stripped = hash.replace(/^#admin\/?/, '').replace(/^\/+/, '')
  if (!stripped) return DEFAULT_TAB

  const parts = stripped.split('/').filter(Boolean)
  const [product, tab, ...rest] = parts

  if (product === 'immerse') {
    if (tab === 'engagements') {
      const urlId = rest[0] ?? null
      if (urlId && !isTripUrlId(urlId)) {
        // Bad url_id segment — fall back to list
        return { product: 'immerse', tab: 'engagements', urlId: null }
      }
      return { product: 'immerse', tab: 'engagements', urlId }
    }
    if (tab === 'showcases') return { product: 'immerse', tab: 'showcases' }
    return DEFAULT_TAB
  }

  if (product === 'programme') {
    if (PROGRAMME_TABS.includes(tab as ProgrammeTabId)) {
      return { product: 'programme', tab: tab as ProgrammeTabId }
    }
    return DEFAULT_TAB
  }

  return DEFAULT_TAB
}

// Build a hash for navigating within admin
export function buildAdminHash(target: AdminTab): string {
  if (target.product === 'immerse') {
    if (target.tab === 'engagements') {
      return target.urlId
        ? `#admin/immerse/engagements/${target.urlId}`
        : '#admin/immerse/engagements'
    }
    return '#admin/immerse/showcases'
  }
  return `#admin/programme/${target.tab}`
}

// Programmatic navigation — sets hash, listeners pick up via 'hashchange'
export function navigateAdmin(target: AdminTab): void {
  window.location.hash = buildAdminHash(target)
}

// Build the guest-facing immerse URL for a given engagement url_id.
// Environment-aware — same pattern as ProgrammeAdmin's buildGuestUrl.
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

// Generate an 11-char alphanumeric url_id matching ^[A-Za-z0-9]{11}$
// Excludes ambiguous chars 0/O/1/l/I per Seed Reference v8 §13
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