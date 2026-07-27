/* queries/queriesProgramme.ts
 * All Supabase query functions for ambience.travel programme product.
 * Single source of truth for DB reads and writes.
 *
 * Organised by domain:
 *   - Profile: getProfile, updateDisplayName, updateEmail, updatePassword
 *   - Programmes: getGuestProgrammes
 *   - Support tickets: createTicket, getUserTickets, getTicketMessages,
 *     addTicketMessage, closeTicket
 *   - Login events: insertLoginEvent, getRecentLogins
 *   - User data: backupUserData, deleteAllUserData, deleteAccount
 *
 * DO NOT import supabase directly in components - always go through this file.
 *
* Last updated: S53 - GuestProgramme.programmeType narrowed to 'stay' only.
 *   Journey programme surface retired (superseded by ImmerseTripPage +
 *   Programme tab). S23 entry preserved below.
 * Prior: S23 - Renamed programme_guests → travel_programme_guests and
 *   programmes → travel_programme_master with nested properties:travel_programme_properties
 *   alias to align with S17 table convention. support_tickets unchanged
 *   (cross-product table, not migrated).
 */

import { supabase, supabaseAnon } from '../lib/supabase'

// ── global-account EF invoke ─────────────────────────────────────────────────
// All profile + ticket DB access routes through the global-account EF
// (requireUser-gated, filtered by the verified user server-side). Reads arrive
// camelized; writes are snakeized at the EF boundary.
async function invokeAccount<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('global-account', { body })
  if (error) throw new Error(`account (${body.mode}): ${error.message}`)
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface TravelProfile {
  id:          string
  displayName: string | null
  isAdmin:     boolean
  email:       string
}

export interface GuestProgramme {
  id:            string
  urlId:         string
  programmeType: 'stay'
  subPath:       string
  status:        string
  guestNames:    string
  checkIn:       string | null
  checkOut:      string | null
  title:         string | null
  active:        boolean
  property: {
    id:           string
    name:         string
    city:         string | null
    country:      string | null
    heroImage:    string | null
    ownerName:    string | null
    ownerPhone:   string | null
    managerName:  string | null
    managerPhone: string | null
  }
}

// Resolved stay for the guest portal (via travel-get-stay `resolve` mode).
// Secrets are already redacted server-side on the gated path; withheld values
// arrive null/empty and the UI renders "Ask your host" placeholders.
export interface StaySection {
  id:      string
  title:   string
  icon:    string
  content: unknown[]   // ManualSection['content'] shape; typed at the view layer
}
 
export interface StayListing {
  id:        string
  name:      string
  category:  string
  genre:     string | null
  address:   string
  website:   string | null
  hours:     string | null
  note:      string | null
  favourite: boolean
}
 
export interface StayResolved {
  stay: {
    id:                string
    urlId:             string
    guestNames:        string
    checkIn:           string | null
    checkOut:          string | null
    welcomeLetter:     string
    activeListingIds:  string[] | null
    alarmCodeProvided: boolean
  }
  property: {
    id:                string
    name:              string
    tagline:           string
    city:              string | null
    country:           string | null
    heroImage:         string | null
    photos:            { src: string; caption: string; subCaption: string }[]
    mapsUrl:           string | null
    mapsEmbedUrl:      string | null
    ownerName:         string
    ownerPhone:        string | null
    managerName:       string
    managerPhone:      string | null
    emergencyContacts: { label: string; phone: string }[]
  }
  sections: StaySection[]
  listings: StayListing[]
  gated:    boolean
  flags: {
    publicWifi:         boolean
    publicAlarm:        boolean
    publicOwnerPhone:   boolean
    publicManagerPhone: boolean
    noAlarm:            boolean
    publicArrival:      boolean
  }
}

// Discriminated result: the EF's error codes surfaced as a typed outcome so the
// component renders states without knowing the transport.
export type StayResult =
  | { ok: true;  data: StayResolved }
  | { ok: false; reason: 'not-found' | 'access-denied' | 'load-failed' }

export interface SupportTicket {
  id:        string
  category:  string
  subject:   string
  body:      string
  status:    'open' | 'in_progress' | 'resolved' | 'closed'
  priority:  'low' | 'normal' | 'high' | 'urgent'
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id:           string
  ticketId:     string
  authorId:     string
  body:         string
  isAdminReply: boolean
  createdAt:    string
}

export interface RecentLogin {
  id:             string
  loggedInAt:     string
  browser:        string | null
  os:             string | null
  browserVersion: string | null
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<TravelProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { profile } = await invokeAccount<{ profile: { id: string; displayName: string | null; isAdmin: boolean } }>({
    mode: 'profile_get',
  })

  return {
    id:          profile.id,
    displayName: profile.displayName ?? null,
    isAdmin:     profile.isAdmin ?? false,
    email:       user.email ?? '',
  }
}

export async function updateDisplayName(name: string): Promise<void> {
  await invokeAccount({ mode: 'profile_update_display_name', display_name: name })
}

// Resolve the caller's own linked person_id (global_profiles.person_id) via EF.
export async function getMyPersonId(): Promise<string | null> {
  const { row } = await invokeAccount<{ row: { personId: string | null } | null }>({
    mode: 'profile_by_user',
  })
  return row?.personId ?? null
}

export async function updateEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) throw error
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// S53N: resolve a single stay for the guest portal. Owns the EF invocation and
// response passthrough so ProgrammeRoute never touches the transport. The EF
// has already redacted secrets on the gated path.
export async function getStayByUrlId(urlId: string): Promise<StayResult> {
  const { data, error } = await supabaseAnon.functions.invoke('travel-get-stay', {
    body: { mode: 'resolve', url_id: urlId },
  })
 
  if (error) return { ok: false, reason: 'load-failed' }
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = data as any
  if (resp?.error) {
    const reason = resp.error === 'not-found'     ? 'not-found'
                 : resp.error === 'access-denied' ? 'access-denied'
                 : 'load-failed'
    return { ok: false, reason }
  }
 
  return { ok: true, data: resp as StayResolved }
}
 
// S53N: the guest's own linked stays, for the "your other stays" fallback in
// the portal. Thin wrapper over the my_stays EF mode returning the raw list
// (url_id, sub_path, guest_names) the fallback needs.
export async function getMyStaysRaw(): Promise<{ urlId: string; sub_path: string; guestNames: string }[]> {
  const { data, error } = await supabaseAnon.functions.invoke('travel-get-stay', {
    body: { mode: 'my_stays' },
  })
  if (error) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any)?.stays ?? []) as { urlId: string; sub_path: string; guestNames: string }[]
}

// ── Programmes ─────────────────────────────────────────────────────────────
 
// S53N: routed through the travel-get-stay EF (my_stays mode). The direct
// supabase.from('travel_programme_guests') read is removed - all DB access
// goes through the EF wall. The EF returns the caller's linked, active stays.
export async function getGuestProgrammes(): Promise<GuestProgramme[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
 
  const { data, error } = await supabaseAnon.functions.invoke('travel-get-stay', {
    body: { mode: 'my_stays' },
  })
  if (error) throw error
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stays = (data as any)?.stays ?? []
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (stays as any[])
    .map(p => {
      if (!p)        return null
      if (!p.active) return null
      const pr = p.property
 
      return {
        id:            p.id,
        urlId:         p.urlId,
        programmeType: p.programme_type as 'stay',
        subPath:       p.sub_path,
        status:        p.status,
        guestNames:    p.guestNames,
        checkIn:       p.checkIn  ?? null,
        checkOut:      p.checkOut ?? null,
        title:         p.title     ?? null,
        active:        p.active,
        property: {
          id:           pr?.id            ?? '',
          name:         pr?.name          ?? '',
          city:         pr?.city          ?? null,
          country:      pr?.country       ?? null,
          heroImage:    pr?.hero_image    ?? null,
          ownerName:    pr?.ownerName    ?? null,
          ownerPhone:   pr?.ownerPhone   ?? null,
          managerName:  pr?.managerName  ?? null,
          managerPhone: pr?.managerPhone ?? null,
        },
      } satisfies GuestProgramme
    })
    .filter((p): p is GuestProgramme => p !== null)
}

// ── Support Tickets ────────────────────────────────────────────────────────

export async function createTicket(fields: {
  category: string
  subject:  string
  body:     string
}): Promise<SupportTicket> {
  const { ticket } = await invokeAccount<{ ticket: RawTicket }>({ mode: 'ticket_create', fields })
  return rowToTicket(ticket)
}

export async function getUserTickets(): Promise<SupportTicket[]> {
  const { tickets } = await invokeAccount<{ tickets: RawTicket[] }>({ mode: 'tickets_list' })
  return (tickets ?? []).map(rowToTicket)
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { messages } = await invokeAccount<{ messages: RawMessage[] }>({
    mode: 'ticket_messages', ticket_id: ticketId,
  })
  return (messages ?? []).map(r => ({
    id:           r.id,
    ticketId:     r.ticketId,
    authorId:     r.authorId,
    body:         r.body,
    isAdminReply: r.isAdminReply ?? false,
    createdAt:    r.createdAt,
  }))
}

export async function addTicketMessage(ticketId: string, body: string): Promise<void> {
  await invokeAccount({ mode: 'ticket_message_create', ticket_id: ticketId, body })
}

export async function closeTicket(ticketId: string): Promise<void> {
  await invokeAccount({ mode: 'ticket_close', ticket_id: ticketId })
}

// ── Login events ───────────────────────────────────────────────────────────

// Parse a user agent into structured browser/os/version for storage. The table
// stores these columns (not the raw UA string).
function parseUA(ua: string | null): { browser: string | null; os: string | null; browserVersion: string | null } {
  if (!ua) return { browser: null, os: null, browserVersion: null }
  let browser: string | null = null
  if (ua.includes('Edg'))          browser = 'Edge'
  if (!browser && ua.includes('Chrome'))  browser = 'Chrome'
  if (!browser && ua.includes('Firefox')) browser = 'Firefox'
  if (!browser && ua.includes('Safari'))  browser = 'Safari'
  let os: string | null = null
  if (ua.includes('Mac OS'))  os = 'macOS'
  if (!os && ua.includes('Windows')) os = 'Windows'
  if (!os && ua.includes('Android')) os = 'Android'
  if (!os && (ua.includes('iPhone') || ua.includes('iPad'))) os = 'iOS'
  if (!os && ua.includes('Linux'))   os = 'Linux'
  const m = browser ? ua.match(new RegExp(browser === 'Edge' ? 'Edg' : browser + '\\/([0-9]+)')) : null
  const browserVersion = m ? m[1] : null
  return { browser, os, browserVersion }
}

export async function insertLoginEvent(): Promise<void> {
  const ua = parseUA(typeof navigator === 'undefined' ? null : navigator.userAgent)
  await invokeAccount({
    mode:            'login_event_create',
    browser:         ua.browser,
    os:              ua.os,
    browser_version: ua.browserVersion,
  }).catch(() => {})
}

export async function getRecentLogins(): Promise<RecentLogin[]> {
  const { logins } = await invokeAccount<{ logins: RecentLogin[] }>({ mode: 'logins_list' })
    .catch(() => ({ logins: [] as RecentLogin[] }))
  return logins ?? []
}

// ── User data ──────────────────────────────────────────────────────────────

export async function backupUserData(): Promise<object> {
  const [profile, tickets, programmes] = await Promise.all([
    getProfile(),
    getUserTickets(),
    getGuestProgrammes(),
  ])

  return {
    exportedAt: new Date().toISOString(),
    profile,
    tickets,
    programmes,
  }
}

export async function deleteAllUserData(): Promise<void> {
  await invokeAccount({ mode: 'delete_all_user_data' })
}

export async function deleteAccount(): Promise<void> {
  // Requires server-side Edge Function - request via support ticket
  throw new Error('Please contact your travel adviser to delete your account.')
}

// ── Private helpers ────────────────────────────────────────────────────────

// EF returns camelized ticket/message rows.
interface RawTicket {
  id:        string
  category:  string
  subject:   string
  body:      string
  status:    SupportTicket['status']
  priority:  SupportTicket['priority']
  createdAt: string
  updatedAt: string
}
interface RawMessage {
  id:           string
  ticketId:     string
  authorId:     string
  body:         string
  isAdminReply: boolean
  createdAt:    string
}
function rowToTicket(r: RawTicket): SupportTicket {
  return {
    id:        r.id,
    category:  r.category,
    subject:   r.subject,
    body:      r.body,
    status:    r.status,
    priority:  r.priority,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}