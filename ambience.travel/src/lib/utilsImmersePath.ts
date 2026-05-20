// immersePath.ts — Canonical helpers for the /immerse/ surface.
// Owns: IMMERSE_HOST constant, isImmerseHost(), isTripUrlId(), getOverviewUrl().
// Does not own: route resolution (App.resolveRoute, ImmerseEngagementRoute.
//   resolveImmerseRoute) — those are surface-specific and stay in their
//   files; both consume the helpers below.
//
// Subdomain awareness:
//   immerse.ambience.travel/<url_id>[/<dest>]   → no /immerse/ prefix
//   ambience.travel/immerse/<url_id>[/<dest>]   → /immerse/ prefix
//   localhost:5173/immerse/<url_id>[/<dest>]    → /immerse/ prefix
//
// Last updated: S32F — Lifted from inline definitions in App.tsx,
//   ImmerseEngagementRoute.tsx, DestinationPage.tsx. Per Dev Standards §II
//   "no duplicated logic from canonical lib" — three independent copies of
//   IMMERSE_HOST + isImmerseHost() existed pre-S32F, plus the 11-char url_id
//   regex appearing in two files. Single source of truth now.

export const IMMERSE_HOST = 'immerse.ambience.travel'

// True when the page is being served from the immerse subdomain.
// Guards window access for SSR safety even though current build is CSR-only.
export function isImmerseHost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === IMMERSE_HOST
}

// Canonical trip url_id shape: 11 alphanumeric chars.
// Same regex enforced by the DB CHECK constraint on travel_immerse_trips.url_id.
// Public templates use a 'pub' visual prefix that matches this regex too.
const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

export function isTripUrlId(seg: string): boolean {
  return URL_ID_REGEX.test(seg)
}

// Build the overview URL for an engagement, subdomain-aware.
//   immerse.ambience.travel    → `/${urlId}`
//   ambience.travel / dev      → `/immerse/${urlId}`
export function getOverviewUrl(urlId: string): string {
  return isImmerseHost() ? `/${urlId}` : `/immerse/${urlId}`
}