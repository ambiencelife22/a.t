// supabase/functions/travel-write-trip/index.ts
//
// Edge Function: travel-write-trip
// Consolidates all admin write paths for trip data into a single
// mode-keyed dispatcher.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated AND an admin — enforced via the shared
//     requireAdmin gate (_shared/auth.ts). The inline JWT->is_admin preamble
//     was removed S53G in favour of the shared gate (canon SERVICE_ROLE_KEY).
//   - All target tables have no direct anon/client write policy for this data
//
// Request body:
//   { mode: Mode, ...modeParams }
//
// Modes: upsert_brief | update_booking_brief | create_booking | create_room |
//   update_room | delete_room | create_aux_booking | update_aux_booking |
//   delete_aux_booking | create_aux_passenger | update_aux_passenger |
//   delete_aux_passenger | upsert_day | create_day_entry | update_day_entry |
//   delete_day_entry | set_public_view
//
// create_room / update_room resolve the room's guest name on return (S53G
// single-source) so callers receive resolved_guest_name without a re-read.
//
// Deployed at: /functions/v1/travel-write-trip
// Created: S52. S53G: migrated to _shared/ (auth + http + names).

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'
import { resolveRoomGuestName, formatPersonName } from '../_shared/names.ts'
type Mode =
  | 'upsert_brief'
  | 'update_booking_brief'
  | 'create_booking'
  | 'create_room'
  | 'update_room'
  | 'delete_room'
  | 'create_aux_booking'
  | 'update_aux_booking'
  | 'delete_aux_booking'
  | 'create_aux_passenger'
  | 'update_aux_passenger'
  | 'delete_aux_passenger'
  | 'create_aux_driver_detail'
  | 'update_aux_driver_detail'
  | 'delete_aux_driver_detail'
  | 'upsert_day'
  | 'create_day_entry'
  | 'update_day_entry'
  | 'delete_day_entry'
  | 'upsert_welcome_letter'
  | 'delete_welcome_letter'
  | 'set_public_view'
  | 'create_trip'
  | 'update_trip'
  | 'update_trip_primary_client'
  | 'create_request'
  | 'update_request'
  | 'delete_request'
  | 'link_programme_guest'
  | 'unlink_programme_guest'
  | 'remove_programme_guest'
// ── Room name resolution on write (S53G single-source) ─────────────────────────
// After a room write, resolve the guest name exactly as the read EFs do, so the
// returned row carries resolved_guest_name. Walk: room.person_id → global_people;
// room.booking_id → travel_bookings.trip_id → travel_trip_briefs.prepared_for.
// FK path verified via information_schema S53G:
//   travel_booking_rooms.booking_id (uuid NOT NULL)
//     → travel_bookings.trip_id (uuid NOT NULL)
//     → travel_trip_briefs.trip_id → prepared_for (text nullable)
async function resolveRoomRow(
  db: SupabaseClient,
  room: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // person (optional)
  let person: Record<string, unknown> | null = null
  if (room.person_id) {
    const { data } = await db
      .from('global_people')
      .select('id, first_name, last_name, nickname')
      .eq('id', room.person_id as string)
      .maybeSingle()
    person = data ?? null
  }

  // party label: booking_id → trip_id → brief.prepared_for
  let partyLabel: string | null = null
  const { data: booking } = await db
    .from('travel_bookings')
    .select('trip_id')
    .eq('id', room.booking_id as string)
    .maybeSingle()
  if (booking?.trip_id) {
    const { data: brief } = await db
      .from('travel_trip_briefs')
      .select('prepared_for')
      .eq('trip_id', booking.trip_id as string)
      .maybeSingle()
    partyLabel = (brief?.prepared_for as string | null) ?? null
  }

  const resolved_guest_name = resolveRoomGuestName(
    person,
    room.guest_name as string | null,
    partyLabel,
  )
  return { ...room, resolved_guest_name }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleUpsertBrief(
  db: SupabaseClient,
  tripId: string,
  houseId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  if (!patch.brief_title) {
    const { data: existing } = await db
      .from('travel_trip_briefs')
      .select('id')
      .eq('trip_id', tripId)
      .maybeSingle()

    if (!existing) {
      const { data: dest } = await db
        .from('travel_trip_destinations')
        .select('global_destinations!travel_trip_destinations_dest_fkey(name)')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      const gd = dest?.global_destinations as unknown
      const gdName = (x: unknown): string | undefined => (x && typeof x === 'object' && 'name' in x ? String((x as { name: unknown }).name) : undefined)
      const destName = Array.isArray(gd) ? gdName(gd[0]) : gdName(gd)
      if (destName) patch.brief_title = destName
    }
  }

  const { data, error } = await db
    .from('travel_trip_briefs')
    .upsert({ trip_id: tripId, house_id: houseId, ...patch }, { onConflict: 'trip_id' })
    .select()
    .single()
  if (error) return json({ error: 'Failed to upsert brief' }, 500)
  return json({ brief: data })
}

async function handleUpdateBookingBrief(
  db: SupabaseClient,
  bookingId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { error } = await db
    .from('travel_bookings')
    .update(patch)
    .eq('id', bookingId)
  if (error) return json({ error: 'Failed to update booking' }, 500)
  return json({ success: true })
}

async function handleCreateBooking(
  db: SupabaseClient,
  tripId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_bookings')
    .insert({ trip_id: tripId, ...patch })
    .select()
    .single()
  if (error) return json({ error: 'Failed to create booking' }, 500)
  return json({ booking: data })
}

async function handleCreateRoom(
  db: SupabaseClient,
  bookingId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_booking_rooms')
    .insert({ booking_id: bookingId, ...patch })
    .select()
    .single()
  if (error) return json({ error: 'Failed to create room' }, 500)
  const room = await resolveRoomRow(db, data as Record<string, unknown>)
  return json({ room })
}

async function handleUpdateRoom(
  db: SupabaseClient,
  roomId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_booking_rooms')
    .update(patch)
    .eq('id', roomId)
    .select()
    .single()
  if (error) return json({ error: 'Failed to update room' }, 500)
  const room = await resolveRoomRow(db, data as Record<string, unknown>)
  return json({ room })
}

async function handleDeleteRoom(db: SupabaseClient, roomId: string): Promise<Response> {
  const { error } = await db
    .from('travel_booking_rooms')
    .delete()
    .eq('id', roomId)
  if (error) return json({ error: 'Failed to delete room' }, 500)
  return json({ success: true })
}

async function handleCreateAuxBooking(
  db: SupabaseClient,
  tripId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_aux_bookings')
    .insert({ trip_id: tripId, ...patch })
    .select()
    .single()
  if (error) return json({ error: 'Failed to create aux booking' }, 500)
  return json({ auxBooking: data })
}

async function handleUpdateAuxBooking(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_aux_bookings')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return json({ error: 'Failed to update aux booking' }, 500)
  return json({ auxBooking: data })
}

async function handleDeleteAuxBooking(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_aux_bookings')
    .delete()
    .eq('id', id)
  if (error) return json({ error: 'Failed to delete aux booking' }, 500)
  return json({ success: true })
}

async function handleCreateAuxPassenger(
  db: SupabaseClient,
  auxBookingId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_aux_passengers')
    .insert({ aux_booking_id: auxBookingId, ...patch })
    .select()
    .single()
  if (error) return json({ error: 'Failed to create aux passenger' }, 500)
  return json({ auxPassenger: data })
}

async function handleUpdateAuxPassenger(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_aux_passengers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return json({ error: 'Failed to update aux passenger' }, 500)
  return json({ auxPassenger: data })
}

async function handleDeleteAuxPassenger(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_aux_passengers')
    .delete()
    .eq('id', id)
  if (error) return json({ error: 'Failed to delete aux passenger' }, 500)
  return json({ success: true })
}

async function handleCreateAuxDriverDetail(
  db: SupabaseClient,
  auxBookingId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_aux_driver_details')
    .insert({ aux_booking_id: auxBookingId, ...patch })
    .select()
    .single()
  if (error) return json({ error: 'Failed to create driver detail' }, 500)
  return json({ driverDetail: data })
}

async function handleUpdateAuxDriverDetail(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_aux_driver_details')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return json({ error: 'Failed to update driver detail' }, 500)
  return json({ driverDetail: data })
}

async function handleDeleteAuxDriverDetail(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_aux_driver_details')
    .delete()
    .eq('id', id)
  if (error) return json({ error: 'Failed to delete driver detail' }, 500)
  return json({ success: true })
}

async function handleUpsertDay(
  db: SupabaseClient,
  tripId: string,
  entryDate: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_days')
    .upsert({ trip_id: tripId, entry_date: entryDate, ...patch }, { onConflict: 'trip_id,entry_date' })
    .select()
    .single()
  if (error) return json({ error: 'Failed to upsert day' }, 500)
  return json({ day: data })
}

async function handleCreateDayEntry(
  db: SupabaseClient,
  tripId: string,
  entry: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_day_entries')
    .insert({ ...entry, trip_id: tripId })
    .select()
    .single()
  if (error) return json({ error: 'Failed to create day entry' }, 500)
  return json({ dayEntry: data })
}

async function handleUpdateDayEntry(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_day_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return json({ error: 'Failed to update day entry' }, 500)
  return json({ dayEntry: data })
}

async function handleDeleteDayEntry(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_day_entries')
    .delete()
    .eq('id', id)
  if (error) return json({ error: 'Failed to delete day entry' }, 500)
  return json({ success: true })
}

async function handleUpsertWelcomeLetter(
  db: SupabaseClient,
  tripId: string,
  letter: Record<string, unknown>,
): Promise<Response> {
  const row = { ...letter, trip_id: tripId, ...(letter.id ? { updated_at: new Date().toISOString() } : {}) }
  const { data, error } = await db
    .from('travel_trip_welcome_letters')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (error) return json({ error: 'Failed to upsert welcome letter' }, 500)
  return json({ letter: data })
}

async function handleDeleteWelcomeLetter(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_welcome_letters')
    .delete()
    .eq('id', id)
  if (error) return json({ error: 'Failed to delete welcome letter' }, 500)
  return json({ success: true })
}

async function handleSetPublicView(
  db: SupabaseClient,
  tripId: string,
  publicView: boolean,
): Promise<Response> {
  const { error } = await db
    .from('travel_overlay_engagements')
    .update({ public_view: publicView })
    .eq('trip_id', tripId)
  if (error) return json({ error: 'Failed to set public_view' }, 500)
  return json({ success: true })
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Trip CRUD ─────────────────────────────────────────────────────────────────

async function handleCreateTrip(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const trip_code = (body.trip_code as string | undefined)?.trim()
  if (!trip_code) return json({ error: 'trip_code is required' }, 400)

  const insert: Record<string, unknown> = {
    trip_code,
    public_title:       (body.public_title as string | undefined)?.trim() ?? null,
    start_date:         (body.start_date as string | undefined) ?? null,
    end_date:           (body.end_date as string | undefined) ?? null,
    currency:           (body.currency as string | undefined) ?? 'USD',
    primary_client_id:  (body.primary_client_id as string | undefined) ?? null,
  }

  const { data, error } = await db.from('travel_trips').insert(insert).select('id').single()
  if (error) { console.error('create_trip error:', error); return json({ error: 'Failed to create trip' }, 500) }
  return json({ trip: data })
}

async function handleUpdateTrip(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const id = body.id as string | undefined
  if (!id) return json({ error: 'id is required' }, 400)

  const patch: Record<string, unknown> = {}
  if (body.trip_code !== undefined) {
    const trimmed = (body.trip_code as string).trim()
    if (!trimmed) return json({ error: 'trip_code cannot be empty' }, 400)
    patch.trip_code = trimmed
  }
  if (body.public_title !== undefined) {
    const trimmed = (body.public_title as string | null)?.trim() ?? ''
    patch.public_title = trimmed.length > 0 ? trimmed : null
  }
  if (Object.keys(patch).length === 0) return json({ error: 'nothing to update' }, 400)

  const { error } = await db.from('travel_trips').update(patch).eq('id', id)
  if (error) { console.error('update_trip error:', error); return json({ error: 'Failed to update trip' }, 500) }
  return json({ ok: true })
}

async function handleUpdateTripPrimaryClient(db: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const id        = body.id as string | undefined
  const person_id = (body.primary_client_id as string | null) ?? null
  if (!id) return json({ error: 'id is required' }, 400)

  const { error } = await db.from('travel_trips').update({ primary_client_id: person_id }).eq('id', id)
  if (error) { console.error('update_trip_primary_client error:', error); return json({ error: 'Failed to update primary client' }, 500) }
  return json({ ok: true })
}

// ── Programme guests (admin link surface) ─────────────────────────────────────
// A programme guest links a global_people PERSON to a programme via that person's
// global_profiles.id (written to travel_programme_guests.profile_id). The guest-facing
// page reads it under RLS as profile_id = auth.uid(), so the value MUST be the auth
// user id (global_profiles.id), never the person id. We resolve person -> profile here,
// server-side, and refuse the link if the person has no profile (no login account) —
// a dead link would silently fail the guest's RLS match. Cardinality is one-person-one-
// profile (verified); the first profile is taken and duplicates would be an anomaly.
async function handleLinkProgrammeGuest(
  db: SupabaseClient,
  programmeId: string,
  personId: string,
): Promise<Response> {
  // Resolve the person's single profile (auth account).
  const { data: profile, error: profErr } = await db
    .from('global_profiles')
    .select('id')
    .eq('person_id', personId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (profErr) return json({ error: 'Failed to resolve profile' }, 500)
  if (!profile?.id) {
    // Zero-profile guard. Honest refusal, not a dead link.
    return json({ error: 'no_profile', message: 'This person has no login account yet and cannot be linked.' }, 409)
  }
  const profileId = profile.id as string

  // Person already linked to this programme? Idempotent guard.
  const { data: existing } = await db
    .from('travel_programme_guests')
    .select('id')
    .eq('programme_id', programmeId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (existing?.id) {
    return json({ error: 'already_linked', message: 'This person is already a guest on this programme.' }, 409)
  }

  // Canonical display name from the person.
  const { data: person } = await db
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .eq('id', personId)
    .maybeSingle()
  const displayName = formatPersonName(person ?? null)
  if (!displayName) return json({ error: 'no_name', message: 'This person has no usable name to display.' }, 400)

  // is_lead + sort_order computed server-side from current guest count.
  const { count } = await db
    .from('travel_programme_guests')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', programmeId)
  const guestCount = count ?? 0

  const { data: inserted, error: insErr } = await db
    .from('travel_programme_guests')
    .insert({
      programme_id: programmeId,
      profile_id:   profileId,
      display_name: displayName,
      is_lead:      guestCount === 0,
      sort_order:   guestCount,
    })
    .select('id, programme_id, display_name, profile_id, is_lead, sort_order')
    .single()
  if (insErr) return json({ error: 'Failed to link guest' }, 500)

  return json({ guest: inserted })
}

async function handleUnlinkProgrammeGuest(db: SupabaseClient, guestId: string): Promise<Response> {
  const { error } = await db
    .from('travel_programme_guests')
    .update({ profile_id: null })
    .eq('id', guestId)
  if (error) return json({ error: 'Failed to unlink guest' }, 500)
  return json({ success: true })
}

async function handleRemoveProgrammeGuest(db: SupabaseClient, guestId: string): Promise<Response> {
  // SELECT * snapshot before DELETE (Dev Standards: row-level recovery path).
  const { data: snapshot } = await db
    .from('travel_programme_guests')
    .select('*')
    .eq('id', guestId)
    .maybeSingle()

  const { error } = await db
    .from('travel_programme_guests')
    .delete()
    .eq('id', guestId)
  if (error) return json({ error: 'Failed to remove guest' }, 500)

  return json({ success: true, removed: snapshot ?? null })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    switch (mode as Mode) {
      case 'upsert_brief': {
        const { trip_id, house_id, patch } = body as { trip_id?: string; house_id?: string; patch?: Record<string, unknown> }
        if (!trip_id || !house_id || !patch) return json({ error: 'trip_id, house_id, patch required' }, 400)
        return handleUpsertBrief(db, trip_id, house_id, patch)
      }
      case 'update_booking_brief': {
        const { booking_id, patch } = body as { booking_id?: string; patch?: Record<string, unknown> }
        if (!booking_id || !patch) return json({ error: 'booking_id, patch required' }, 400)
        return handleUpdateBookingBrief(db, booking_id, patch)
      }
      case 'create_booking': {
        const { trip_id, patch } = body as { trip_id?: string; patch?: Record<string, unknown> }
        if (!trip_id || !patch) return json({ error: 'trip_id, patch required' }, 400)
        return handleCreateBooking(db, trip_id, patch)
      }
      case 'create_room': {
        const { booking_id, patch } = body as { booking_id?: string; patch?: Record<string, unknown> }
        if (!booking_id || !patch) return json({ error: 'booking_id, patch required' }, 400)
        return handleCreateRoom(db, booking_id, patch)
      }
      case 'update_room': {
        const { room_id, patch } = body as { room_id?: string; patch?: Record<string, unknown> }
        if (!room_id || !patch) return json({ error: 'room_id, patch required' }, 400)
        return handleUpdateRoom(db, room_id, patch)
      }
      case 'delete_room': {
        const { room_id } = body as { room_id?: string }
        if (!room_id) return json({ error: 'room_id required' }, 400)
        return handleDeleteRoom(db, room_id)
      }
      case 'create_aux_booking': {
        const { trip_id, patch } = body as { trip_id?: string; patch?: Record<string, unknown> }
        if (!trip_id || !patch) return json({ error: 'trip_id, patch required' }, 400)
        return handleCreateAuxBooking(db, trip_id, patch)
      }
      case 'update_aux_booking': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return json({ error: 'id, patch required' }, 400)
        return handleUpdateAuxBooking(db, id, patch)
      }
      case 'delete_aux_booking': {
        const { id } = body as { id?: string }
        if (!id) return json({ error: 'id required' }, 400)
        return handleDeleteAuxBooking(db, id)
      }
      case 'create_aux_passenger': {
        const { aux_booking_id, patch } = body as { aux_booking_id?: string; patch?: Record<string, unknown> }
        if (!aux_booking_id || !patch) return json({ error: 'aux_booking_id, patch required' }, 400)
        return handleCreateAuxPassenger(db, aux_booking_id, patch)
      }
      case 'update_aux_passenger': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return json({ error: 'id, patch required' }, 400)
        return handleUpdateAuxPassenger(db, id, patch)
      }
      case 'delete_aux_passenger': {
        const { id } = body as { id?: string }
        if (!id) return json({ error: 'id required' }, 400)
        return handleDeleteAuxPassenger(db, id)
      }
      case 'create_aux_driver_detail': {
        const { aux_booking_id, patch } = body as { aux_booking_id?: string; patch?: Record<string, unknown> }
        if (!aux_booking_id || !patch) return json({ error: 'aux_booking_id, patch required' }, 400)
        return handleCreateAuxDriverDetail(db, aux_booking_id, patch)
      }
      case 'update_aux_driver_detail': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return json({ error: 'id, patch required' }, 400)
        return handleUpdateAuxDriverDetail(db, id, patch)
      }
      case 'delete_aux_driver_detail': {
        const { id } = body as { id?: string }
        if (!id) return json({ error: 'id required' }, 400)
        return handleDeleteAuxDriverDetail(db, id)
      }
      case 'upsert_day': {
        const { trip_id, entry_date, patch } = body as { trip_id?: string; entry_date?: string; patch?: Record<string, unknown> }
        if (!trip_id || !entry_date || !patch) return json({ error: 'trip_id, entry_date, patch required' }, 400)
        return handleUpsertDay(db, trip_id, entry_date, patch)
      }
      case 'create_day_entry': {
        const { trip_id, entry } = body as { trip_id?: string; entry?: Record<string, unknown> }
        if (!trip_id || !entry) return json({ error: 'trip_id, entry required' }, 400)
        return handleCreateDayEntry(db, trip_id, entry)
      }
      case 'update_day_entry': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return json({ error: 'id, patch required' }, 400)
        return handleUpdateDayEntry(db, id, patch)
      }
      case 'delete_day_entry': {
        const { id } = body as { id?: string }
        if (!id) return json({ error: 'id required' }, 400)
        return handleDeleteDayEntry(db, id)
      }
      case 'set_public_view': {
        const { trip_id, public_view } = body as { trip_id?: string; public_view?: boolean }
        if (!trip_id || public_view === undefined) return json({ error: 'trip_id, public_view required' }, 400)
        return handleSetPublicView(db, trip_id, public_view)
      }
      case 'upsert_welcome_letter': {
        const { trip_id, letter } = body as { trip_id?: string; letter?: Record<string, unknown> }
        if (!trip_id || !letter) return json({ error: 'trip_id, letter required' }, 400)
        return handleUpsertWelcomeLetter(db, trip_id, letter)
      }
      case 'delete_welcome_letter': {
        const { id } = body as { id?: string }
        if (!id) return json({ error: 'id required' }, 400)
        return handleDeleteWelcomeLetter(db, id)
      }
      case 'create_trip':
        return handleCreateTrip(db, body as Record<string, unknown>)
      case 'update_trip':
        return handleUpdateTrip(db, body as Record<string, unknown>)
      case 'update_trip_primary_client':
        return handleUpdateTripPrimaryClient(db, body as Record<string, unknown>)
      case 'create_request': {
        const { house_id, request_body, channel, received_at, trip_id, engagement_id, handled_by, notes } = body as Record<string, unknown>
        if (!house_id || !request_body) return json({ error: 'house_id, request_body required' }, 400)
        const { error } = await db.from('travel_requests').insert({
          house_id, request_body, channel: channel ?? null,
          received_at: received_at ?? new Date().toISOString(),
          trip_id: trip_id ?? null, engagement_id: engagement_id ?? null,
          handled_by: handled_by ?? null, notes: notes ?? null, status: 'New',
        })
        if (error) return json({ error: 'Failed to create request' }, 500)
        return json({ success: true })
      }
      case 'update_request': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return json({ error: 'id, patch required' }, 400)
        const { error } = await db.from('travel_requests').update(patch).eq('id', id)
        if (error) return json({ error: 'Failed to update request' }, 500)
        return json({ success: true })
      }
      case 'delete_request': {
        const { id } = body as { id?: string }
        if (!id) return json({ error: 'id required' }, 400)
        const { error } = await db.from('travel_requests').delete().eq('id', id)
        if (error) return json({ error: 'Failed to delete request' }, 500)
        return json({ success: true })
      }
      case 'link_programme_guest': {
        const { programme_id, person_id } = body as { programme_id?: string; person_id?: string }
        if (!programme_id || !person_id) return json({ error: 'programme_id, person_id required' }, 400)
        return handleLinkProgrammeGuest(db, programme_id, person_id)
      }
      case 'unlink_programme_guest': {
        const { guest_id } = body as { guest_id?: string }
        if (!guest_id) return json({ error: 'guest_id required' }, 400)
        return handleUnlinkProgrammeGuest(db, guest_id)
      }
      case 'remove_programme_guest': {
        const { guest_id } = body as { guest_id?: string }
        if (!guest_id) return json({ error: 'guest_id required' }, 400)
        return handleRemoveProgrammeGuest(db, guest_id)
      }
      default:
        return json({ error: `Unknown mode: ${mode}` }, 400)
    }

  } catch (e) {
    console.error('travel-write-trip unexpected error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})