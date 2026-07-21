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
  priority:  'low' | 'medium' | 'high'
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
  id:        string
  createdAt: string
  ipAddress: string | null
  userAgent: string | null
  city:      string | null
  country:   string | null
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<TravelProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('global_profiles')
    .select('id, display_name, is_admin')
    .eq('id', user.id)
    .single()

  if (error) throw error

  return {
    id:          data.id,
    displayName: data.display_name ?? null,
    isAdmin:     data.is_admin ?? false,
    email:       user.email ?? '',
  }
}

export async function updateDisplayName(name: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('global_profiles')
    .update({ display_name: name })
    .eq('id', user.id)

  if (error) throw error
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('global_support_tickets')
    .insert({
      userId:  user.id,
      category: fields.category,
      subject:  fields.subject,
      body:     fields.body,
      status:   'open',
      priority: 'medium',
    })
    .select()
    .single()

  if (error) throw error
  return rowToTicket(data)
}

export async function getUserTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('global_support_tickets')
    .select('id, user_id, category, subject, body, status, priority, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(rowToTicket)
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from('global_ticket_messages')
    .select('id, ticket_id, author_id, body, is_internal, is_admin_reply, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id:           r.id,
    ticketId:     r.ticket_id,
    authorId:     r.authorId,
    body:         r.body,
    isAdminReply: r.isAdminReply ?? false,
    createdAt:    r.createdAt,
  }))
}

export async function addTicketMessage(ticketId: string, body: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('global_ticket_messages')
    .insert({
      ticket_id:      ticketId,
      authorId:      user.id,
      body,
      isAdminReply: false,
    })

  if (error) throw error
}

export async function closeTicket(ticketId: string): Promise<void> {
  const { error } = await supabase
    .from('global_support_tickets')
    .update({ status: 'closed' })
    .eq('id', ticketId)

  if (error) throw error
}

// ── Login events ───────────────────────────────────────────────────────────

export async function insertLoginEvent(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('global_login_events')
    .insert({
      userId:    user.id,
      ipAddress: null,
      user_agent: navigator.userAgent,
    })

  // Non-fatal - table may not yet exist in travel
  if (error) console.warn('insertLoginEvent:', error.message)
}

export async function getRecentLogins(): Promise<RecentLogin[]> {
  const { data, error } = await supabase
    .from('global_login_events')
    .select('id, created_at, ip_address, user_agent, city, country')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.warn('getRecentLogins:', error.message)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id:        r.id,
    createdAt: r.createdAt,
    ipAddress: r.ipAddress ?? null,
    userAgent: r.user_agent ?? null,
    city:      r.city       ?? null,
    country:   r.country    ?? null,
  }))
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('global_support_tickets')
    .delete()
    .eq('user_id', user.id)

  if (error) throw error
}

export async function deleteAccount(): Promise<void> {
  // Requires server-side Edge Function - request via support ticket
  throw new Error('Please contact your travel adviser to delete your account.')
}

// ── Private helpers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTicket(r: any): SupportTicket {
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