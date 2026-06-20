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
import { resolveRoomGuestName } from '../_shared/names.ts'

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
  | 'upsert_day'
  | 'create_day_entry'
  | 'update_day_entry'
  | 'delete_day_entry'
  | 'set_public_view'

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

async function handleSetPublicView(
  db: SupabaseClient,
  tripId: string,
  publicView: boolean,
): Promise<Response> {
  const { error } = await db
    .from('travel_immerse_engagements')
    .update({ public_view: publicView })
    .eq('trip_id', tripId)
  if (error) return json({ error: 'Failed to set public_view' }, 500)
  return json({ success: true })
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
      default:
        return json({ error: `Unknown mode: ${mode}` }, 400)
    }

  } catch (e) {
    console.error('travel-write-trip unexpected error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})