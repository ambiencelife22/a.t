/* lib/queries.ts
 * All Supabase query functions for ambience.travel programme product.
 * Single source of truth for DB reads and writes.
 *
 * Organised by domain:
 *   — Profile: getProfile, updateDisplayName, updateEmail, updatePassword
 *   — Programmes: getGuestProgrammes
 *   — Support tickets: createTicket, getUserTickets, getTicketMessages,
 *     addTicketMessage, closeTicket
 *   — Login events: insertLoginEvent, getRecentLogins
 *   — User data: backupUserData, deleteAllUserData, deleteAccount
 *
 * DO NOT import supabase directly in components — always go through this file.
 *
 * Last updated: S23 — Renamed programme_guests → travel_programme_guests and
 *   programmes → travel_programme_master with nested properties:travel_programme_properties
 *   alias to align with S17 table convention. support_tickets unchanged
 *   (cross-product table, not migrated).
 */

import { supabase } from './supabase'

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
  programmeType: 'stay' | 'journey'
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

// ── Programmes ─────────────────────────────────────────────────────────────

export async function getGuestProgrammes(): Promise<GuestProgramme[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // S23: Renamed programme_guests → travel_programme_guests,
  // programmes → travel_programme_master, properties → travel_programme_properties.
  // Nested PostgREST relations aliased back to old keys (programmes, properties)
  // so the downstream mapping code stays unchanged.
  // RLS on travel_programme_guests filters to profile_id = auth.uid() automatically.
  const { data, error } = await supabase
    .from('travel_programme_guests')
    .select(`
      programme_id,
      programmes:travel_programme_master!inner (
        id,
        url_id,
        programme_type,
        sub_path,
        status,
        guest_names,
        check_in,
        check_out,
        title,
        active,
        properties:travel_programme_properties (
          id,
          name,
          city,
          country,
          hero_image,
          owner_name,
          owner_phone,
          manager_name,
          manager_phone
        )
      )
    `)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .map(row => {
      const p  = row.programmes
      if (!p)        return null
      if (!p.active) return null
      const pr = p.properties

      return {
        id:            p.id,
        urlId:         p.url_id,
        programmeType: p.programme_type as 'stay' | 'journey',
        subPath:       p.sub_path,
        status:        p.status,
        guestNames:    p.guest_names,
        checkIn:       p.check_in  ?? null,
        checkOut:      p.check_out ?? null,
        title:         p.title     ?? null,
        active:        p.active,
        property: {
          id:           pr?.id            ?? '',
          name:         pr?.name          ?? '',
          city:         pr?.city          ?? null,
          country:      pr?.country       ?? null,
          heroImage:    pr?.hero_image    ?? null,
          ownerName:    pr?.owner_name    ?? null,
          ownerPhone:   pr?.owner_phone   ?? null,
          managerName:  pr?.manager_name  ?? null,
          managerPhone: pr?.manager_phone ?? null,
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
      user_id:  user.id,
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
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(rowToTicket)
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from('global_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id:           r.id,
    ticketId:     r.ticket_id,
    authorId:     r.author_id,
    body:         r.body,
    isAdminReply: r.is_admin_reply ?? false,
    createdAt:    r.created_at,
  }))
}

export async function addTicketMessage(ticketId: string, body: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('global_ticket_messages')
    .insert({
      ticket_id:      ticketId,
      author_id:      user.id,
      body,
      is_admin_reply: false,
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
      user_id:    user.id,
      ip_address: null,
      user_agent: navigator.userAgent,
    })

  // Non-fatal — table may not yet exist in travel
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
    createdAt: r.created_at,
    ipAddress: r.ip_address ?? null,
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
  // Requires server-side Edge Function — request via support ticket
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}