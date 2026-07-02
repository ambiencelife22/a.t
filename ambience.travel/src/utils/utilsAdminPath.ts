// utilsAdminPath.ts — Hash parsing + URL builders for AmbienceAdmin (#admin)
// Pure functions. No state. No side effects.
//
// S53G — Admin redesign Phase 1: new 5-group taxonomy.
//   New products: trips (pipeline + detail), clients, content, residences, studio.
//   Old products aliased: immerse, guides, library, house, operations, time,
//   calendar, finance, programme — all still parse correctly so no live URL breaks
//   during the transition. Aliases route to their new equivalents where possible,
//   or to DEFAULT_TAB as a safe fallback.
//
// New URL schema (confirmed with D, S53G admin redesign plan v2):
//   #admin                                         → studio dashboard (default landing)
//   #admin/trips                                   → trips pipeline list
//   #admin/trips/<url_id>                          → trip detail — overview tab
//   #admin/trips/<url_id>/bookings                 → trip detail — bookings + finance tab
//   #admin/trips/<url_id>/tasks                    → trip detail — tasks tab
//   #admin/trips/<url_id>/contacts                 → trip detail — contacts tab
//   #admin/trips/<url_id>/activity                 → trip detail — activity tab
//   #admin/trips/<trip_uuid>/programme             → full-page programme editor (ItineraryEditorPage)
//   #admin/trips/<trip_uuid>/brief                 → full-page brief editor (BriefEditorPage)
//   #admin/clients                                 → households list
//   #admin/clients/<house_id>                      → household detail
//   #admin/content/dining                          → dining (library + guides unified)
//   #admin/content/hotels                          → hotels library
//   #admin/content/experiences                     → experiences library
//   #admin/content/shopping                        → shopping library
//   #admin/residences                              → residences list (was programme/programmes)
//   #admin/residences/letters                      → welcome letters
//   #admin/residences/listings                     → listings
//   #admin/residences/sections                     → property sections
//   #admin/residences/properties                   → properties
//   #admin/residences/access-denied                → access denied
//   #admin/residences/client-profile               → client profile
//   #admin/studio                                  → studio dashboard
//   #admin/studio/finance                          → financial pipeline
//   #admin/studio/finance/engagement/<id>          → engagement financials
//   #admin/studio/time                             → effort log
//   #admin/studio/time/analytics                   → time analytics
//
// Legacy aliases (still parse, redirect to nearest new equivalent):
//   #admin/immerse/engagements[/<url_id>]          → trips[/<url_id>]
//   #admin/immerse/showcases                       → trips (showcases TBD)
//   #admin/guides/*                                → content/*
//   #admin/library/*                               → content/*
//   #admin/house                                   → clients
//   #admin/operations/bookings                     → studio/finance (nearest equivalent)
//   #admin/time[/analytics]                        → studio/time[/analytics]
//   #admin/calendar                                → calendar (CalendarTab)
//   #admin/finance[/engagement/<id>]               → studio/finance[/engagement/<id>]
//   #admin/programme/<tab>                         → residences/<tab> (tab slugs unchanged)
//
// Prior: S53G — Added finance product (pipeline + engagement).
// Prior: S53C — Added time product (effort log + analytics).
// Prior: S47  — trips union extended with itinerary tab.
// Prior: S45  — Added operations product.
// Prior: S40D — Added house product.
// Prior: S36  — Added guides + library products.
// Prior: S33

import { isTripUrlId } from '../utils/utilsImmersePath'

// ── Product types ─────────────────────────────────────────────────────────────

export type AdminProduct =
  // New 5-group taxonomy (S53G)
  | 'trips'
  | 'clients'
  | 'content'
  | 'residences'
  | 'studio'
  // Legacy aliases (kept for transition, will dissolve in Phase 7)
  | 'immerse'
  | 'guides'
  | 'library'
  | 'house'
  | 'operations'
  | 'time'
  | 'calendar'
  | 'finance'
  | 'programme'

// ── Tab ID types ──────────────────────────────────────────────────────────────

// Detail tabs rendered inline within EngagementDetail (url_id based routing)
export type EngagementDetailTabId = 'overview' | 'bookings' | 'tasks' | 'contacts' | 'activity'

// Full-page editor tabs (trip uuid based routing)
export type EngagementEditorTabId = 'programme' | 'brief'

// Union for external consumers
export type EngagementTabId = EngagementDetailTabId | EngagementEditorTabId

export type ContentTabId = 'dining' | 'experiences' | 'hotels' | 'shopping'

export type ResidenceTabId =
  | 'list'
  | 'letters'
  | 'listings'
  | 'sections'
  | 'properties'
  | 'access-denied'
  | 'client-profile'

export type StudioTabId =
  | 'dashboard'
  | 'finance'
  | 'time'
  | 'time-analytics'

// Legacy alias — kept until Phase 7 dissolution
export type ProgrammeTabId =
  | 'programmes'
  | 'letters'
  | 'listings'
  | 'sections'
  | 'properties'
  | 'access-denied'
  | 'client-profile'

// ── AdminTab union ────────────────────────────────────────────────────────────

export type AdminTab =
  // ── New taxonomy ──
  | { product: 'trips';      tab: 'list' }
  | { product: 'trips';      tab: EngagementDetailTabId; urlId: string }      // inline detail tabs (url_id based)
  | { product: 'trips';      tab: 'programme';     tripId: string }     // full-page editor (uuid based)
  | { product: 'trips';      tab: 'brief';         tripId: string }     // full-page editor (uuid based)
  | { product: 'clients';    tab: 'list' }
  | { product: 'clients';    tab: 'detail';     houseId: string }
  | { product: 'content';    tab: ContentTabId; destinationId?: string | null }
  | { product: 'residences'; tab: ResidenceTabId }
  | { product: 'studio';     tab: StudioTabId }
  | { product: 'studio';     tab: 'finance-engagement'; engagementId: string }
  // ── Legacy aliases (transition only — dissolve Phase 7) ──
  | { product: 'immerse';    tab: 'engagements'; urlId: string | null }
  | { product: 'immerse';    tab: 'showcases' }
  | { product: 'guides';     tab: 'dining' }
  | { product: 'guides';     tab: 'experiences' }
  | { product: 'guides';     tab: 'hotels' }
  | { product: 'guides';     tab: 'shopping' }
  | { product: 'library';    tab: 'dining';  destinationId: string | null }
  | { product: 'library';    tab: 'hotels';  destinationId: string | null }
  | { product: 'house';      tab: 'houses' }
  | { product: 'calendar';   tab: 'calendar' }
  | { product: 'operations'; tab: 'bookings' }
  | { product: 'time';       tab: 'entries' }
  | { product: 'time';       tab: 'analytics' }
  | { product: 'finance';    tab: 'pipeline' }
  | { product: 'finance';    tab: 'engagement'; engagementId: string }
  | { product: 'programme';  tab: ProgrammeTabId }

// ── Constants ─────────────────────────────────────────────────────────────────

const RESIDENCE_TABS: ResidenceTabId[] = [
  'list', 'letters', 'listings', 'sections',
  'properties', 'access-denied', 'client-profile',
]

// Legacy programme tab slugs map to residence slugs (1:1 except programmes -> list)
const PROGRAMME_TO_RESIDENCE: Record<string, ResidenceTabId> = {
  programmes:      'list',
  letters:         'letters',
  listings:        'listings',
  sections:        'sections',
  properties:      'properties',
  'access-denied': 'access-denied',
  'client-profile':'client-profile',
}

const CONTENT_TABS: ContentTabId[] = ['dining', 'experiences', 'hotels', 'shopping']

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const URL_ID_RE  = /^[A-Za-z0-9]{11}$/

export const DEFAULT_TAB: AdminTab = { product: 'studio', tab: 'dashboard' }

// ── parseAdminHash ────────────────────────────────────────────────────────────

export function parseAdminHash(hash: string): AdminTab {
  const stripped = hash.replace(/^#admin\/?/, '').replace(/^\/+/, '')
  if (!stripped) return DEFAULT_TAB

  const parts = stripped.split('/').filter(Boolean)
  const [product, seg1, seg2, seg3] = parts

  // ── New taxonomy ──────────────────────────────────────────────────────────

  if (product === 'trips') {
    if (!seg1) return { product: 'trips', tab: 'list' }

    // Full-page editors: #admin/trips/<uuid>/programme|brief
    if (UUID_RE.test(seg1)) {
      if (seg2 === 'programme') return { product: 'trips', tab: 'programme', tripId: seg1 }
      if (seg2 === 'brief')     return { product: 'trips', tab: 'brief',     tripId: seg1 }
    }

    // Detail tabs: #admin/trips/<url_id>[/<tab>]
    if (URL_ID_RE.test(seg1) || isTripUrlId(seg1)) {
      const detailTab = seg2 as EngagementTabId | undefined
      if (!detailTab || detailTab === 'overview')  return { product: 'trips', tab: 'overview',  urlId: seg1 }
      if (detailTab === 'bookings')                return { product: 'trips', tab: 'bookings',  urlId: seg1 }
      if (detailTab === 'contacts')                return { product: 'trips', tab: 'contacts',  urlId: seg1 }
      if (detailTab === 'tasks')                   return { product: 'trips', tab: 'tasks',     urlId: seg1 }
      if (detailTab === 'activity')                return { product: 'trips', tab: 'activity',  urlId: seg1 }
      return { product: 'trips', tab: 'overview', urlId: seg1 }
    }

    return { product: 'trips', tab: 'list' }
  }

  if (product === 'clients') {
    if (!seg1) return { product: 'clients', tab: 'list' }
    if (UUID_RE.test(seg1)) return { product: 'clients', tab: 'detail', houseId: seg1 }
    return { product: 'clients', tab: 'list' }
  }

  if (product === 'content') {
    if (CONTENT_TABS.includes(seg1 as ContentTabId)) {
      const destinationId = seg2 && UUID_RE.test(seg2) ? seg2 : null
      return { product: 'content', tab: seg1 as ContentTabId, destinationId }
    }
    return { product: 'content', tab: 'dining' }
  }

  if (product === 'residences') {
    if (!seg1 || seg1 === 'list') return { product: 'residences', tab: 'list' }
    if (RESIDENCE_TABS.includes(seg1 as ResidenceTabId)) {
      return { product: 'residences', tab: seg1 as ResidenceTabId }
    }
    return { product: 'residences', tab: 'list' }
  }

  if (product === 'studio') {
    if (!seg1 || seg1 === 'dashboard') return { product: 'studio', tab: 'dashboard' }
    if (seg1 === 'finance') {
      if (seg2 === 'engagement' && seg3 && UUID_RE.test(seg3)) {
        return { product: 'studio', tab: 'finance-engagement', engagementId: seg3 }
      }
      return { product: 'studio', tab: 'finance' }
    }
    if (seg1 === 'time') {
      if (seg2 === 'analytics') return { product: 'studio', tab: 'time-analytics' }
      return { product: 'studio', tab: 'time' }
    }
    return { product: 'studio', tab: 'dashboard' }
  }

  // ── Legacy aliases (parse + forward to nearest new equivalent) ────────────

  if (product === 'immerse') {
    if (seg1 === 'engagements') {
      // Forward to trips — url_id is the same
      const urlId = seg2 ?? null
      if (urlId && !isTripUrlId(urlId)) return { product: 'trips', tab: 'list' }
      if (urlId) return { product: 'trips', tab: 'overview', urlId }
      return { product: 'trips', tab: 'list' }
    }
    return { product: 'trips', tab: 'list' }
  }

  if (product === 'guides') {
    if (CONTENT_TABS.includes(seg1 as ContentTabId)) {
      return { product: 'content', tab: seg1 as ContentTabId }
    }
    return { product: 'content', tab: 'dining' }
  }

  if (product === 'library') {
    if (seg1 === 'dining' || seg1 === 'hotels') {
      const destinationId = seg2 && UUID_RE.test(seg2) ? seg2 : null
      return { product: 'content', tab: seg1 as ContentTabId, destinationId }
    }
    return { product: 'content', tab: 'dining' }
  }

  if (product === 'house') {
    return { product: 'clients', tab: 'list' }
  }

  if (product === 'calendar') {
    return { product: 'calendar', tab: 'calendar' }
  }

  if (product === 'operations') {
    return { product: 'studio', tab: 'finance' }
  }

  if (product === 'time') {
    if (seg1 === 'analytics') return { product: 'studio', tab: 'time-analytics' }
    return { product: 'studio', tab: 'time' }
  }

  if (product === 'finance') {
    if (seg1 === 'engagement' && seg2 && UUID_RE.test(seg2)) {
      return { product: 'studio', tab: 'finance-engagement', engagementId: seg2 }
    }
    return { product: 'studio', tab: 'finance' }
  }

  if (product === 'programme') {
    const mapped = PROGRAMME_TO_RESIDENCE[seg1]
    if (mapped) return { product: 'residences', tab: mapped }
    return { product: 'residences', tab: 'list' }
  }

  return DEFAULT_TAB
}

// ── buildAdminHash ────────────────────────────────────────────────────────────

export function buildAdminHash(target: AdminTab): string {
  // ── New taxonomy ──
  if (target.product === 'trips') {
    if (target.tab === 'list') return '#admin/trips'
    if (target.tab === 'programme' || target.tab === 'brief') {
      const t = target as { tab: EngagementEditorTabId; tripId: string }
      return `#admin/trips/${t.tripId}/${t.tab}`
    }
    // Detail tabs keyed by url_id (overview, bookings, contacts, activity)
    const t = target as { tab: EngagementDetailTabId; urlId: string }
    return `#admin/trips/${t.urlId}${t.tab === 'overview' ? '' : `/${t.tab}`}`
  }
  if (target.product === 'clients') {
    if (target.tab === 'detail') return `#admin/clients/${target.houseId}`
    return '#admin/clients'
  }
  if (target.product === 'content') {
    const base = `#admin/content/${target.tab}`
    return target.destinationId ? `${base}/${target.destinationId}` : base
  }
  if (target.product === 'residences') {
    if (target.tab === 'list') return '#admin/residences'
    return `#admin/residences/${target.tab}`
  }
  if (target.product === 'studio') {
    if (target.tab === 'dashboard')         return '#admin/studio'
    if (target.tab === 'finance')           return '#admin/studio/finance'
    if (target.tab === 'finance-engagement') return `#admin/studio/finance/engagement/${target.engagementId}`
    if (target.tab === 'time')              return '#admin/studio/time'
    if (target.tab === 'time-analytics')    return '#admin/studio/time/analytics'
    return '#admin/studio'
  }

  // ── Legacy aliases — build old-style URLs so existing links still work ────
  // These will be removed in Phase 7 once all call sites are migrated.
  if (target.product === 'immerse') {
    if (target.tab === 'engagements') {
      return target.urlId
        ? `#admin/immerse/engagements/${target.urlId}`
        : '#admin/immerse/engagements'
    }
    return '#admin/immerse/showcases'
  }
  if (target.product === 'guides') {
    return `#admin/guides/${target.tab}`
  }
  if (target.product === 'library') {
    return target.destinationId
      ? `#admin/library/${target.tab}/${target.destinationId}`
      : `#admin/library/${target.tab}`
  }
  if (target.product === 'house')      return '#admin/house'
  if (target.product === 'calendar')   return '#admin/calendar'
  if (target.product === 'operations') return '#admin/operations/bookings'
  if (target.product === 'time') {
    return target.tab === 'analytics' ? '#admin/time/analytics' : '#admin/time'
  }
  if (target.product === 'finance') {
    if (target.tab === 'engagement') return `#admin/finance/engagement/${target.engagementId}`
    return '#admin/finance'
  }
  if (target.product === 'programme') {
    return `#admin/programme/${target.tab}`
  }

  return '#admin/studio'
}

// ── navigateAdmin ─────────────────────────────────────────────────────────────

export function navigateAdmin(target: AdminTab): void {
  window.location.hash = buildAdminHash(target)
}

// ── URL builders ──────────────────────────────────────────────────────────────

const IMMERSE_HOST = 'immerse.ambience.travel'

export function buildEngagementUrl(urlId: string): string {
  if (typeof window === 'undefined') return `https://${IMMERSE_HOST}/${urlId}`
  const host = window.location.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') {
    return `${window.location.origin}/immerse/${urlId}`
  }
  if (host === IMMERSE_HOST) return `${window.location.origin}/${urlId}`
  return `https://${IMMERSE_HOST}/${urlId}`
}

const GUIDES_HOST = 'guides.ambience.travel'

export function buildGuideUrl(
  destinationSlug: string,
  surface: ContentTabId = 'dining',
): string {
  if (typeof window === 'undefined') return `https://${GUIDES_HOST}/${destinationSlug}/${surface}`
  const host = window.location.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') {
    return `${window.location.origin}/guides/${destinationSlug}/${surface}`
  }
  if (host === GUIDES_HOST) return `${window.location.origin}/${destinationSlug}/${surface}`
  return `https://${GUIDES_HOST}/${destinationSlug}/${surface}`
}