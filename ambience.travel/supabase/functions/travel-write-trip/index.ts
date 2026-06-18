// supabase/functions/travel-write-trip/index.ts
//
// Edge Function: travel-write-trip
// Consolidates all admin write paths for trip data into a single
// mode-keyed dispatcher.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - All target tables have no direct anon/client write policy for this data
//   - This function uses the service role key to bypass RLS
//   - Never called with the anon key
//
// Request body:
//   { mode: Mode, ...modeParams }
//
// Modes:
//   upsert_brief          { trip_id, house_id, patch }
//   update_booking_brief  { booking_id, patch }
//   create_room           { booking_id, patch }
//   update_room           { room_id, patch }
//   delete_room           { room_id }
//   create_aux_booking    { trip_id, patch }
//   update_aux_booking    { id, patch }
//   delete_aux_booking    { id }
//   create_aux_passenger  { aux_booking_id, patch }
//   update_aux_passenger  { id, patch }
//   delete_aux_passenger  { id }
//   upsert_day            { trip_id, entry_date, patch }
//   create_day_entry      { trip_id, entry }
//   update_day_entry      { id, patch }
//   delete_day_entry      { id }
//   set_public_view       { trip_id, public_view }
//   derive_itinerary      { trip, aux_bookings }
//
// Response (200): mode-specific payload
// Response (400): { error: 'Invalid request' }
// Response (401): { error: 'Unauthorized' }
// Response (403): { error: 'Forbidden' }
// Response (500): { error: 'Internal server error' }
//
// Deployed at: /functions/v1/travel-write-trip
// Created: S52

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Mode =
  | 'upsert_brief'
  | 'update_booking_brief'
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
  | 'derive_itinerary'

// ── Auth ──────────────────────────────────────────────────────────────────────

async function verifyAdminCaller(
  req: Request,
  serviceClient: SupabaseClient,
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: userError } = await anonClient.auth.getUser()
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('global_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.is_admin !== true) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return { userId: user.id }
}

function ok(payload: unknown): Response {
  return new Response(
    JSON.stringify(payload),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function err(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleUpsertBrief(
  db: SupabaseClient,
  tripId: string,
  houseId: string,
  patch: Record<string, unknown>,
): Promise<Response> {
  // Auto-seed brief_title from primary destination on first create
  // Only when caller didn't explicitly set brief_title in the patch
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

      const gd = dest?.global_destinations
      const destName = Array.isArray(gd) ? gd[0]?.name : (gd as any)?.name
      if (destName) {
        patch.brief_title = destName
      }
    }
  }

  const { data, error } = await db
    .from('travel_trip_briefs')
    .upsert({ trip_id: tripId, house_id: houseId, ...patch }, { onConflict: 'trip_id' })
    .select()
    .single()
  if (error) return err('Failed to upsert brief', 500)
  return ok({ brief: data })
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
  if (error) return err('Failed to update booking', 500)
  return ok({ success: true })
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
  if (error) return err('Failed to create room', 500)
  return ok({ room: data })
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
  if (error) return err('Failed to update room', 500)
  return ok({ room: data })
}

async function handleDeleteRoom(db: SupabaseClient, roomId: string): Promise<Response> {
  const { error } = await db
    .from('travel_booking_rooms')
    .delete()
    .eq('id', roomId)
  if (error) return err('Failed to delete room', 500)
  return ok({ success: true })
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
  if (error) return err('Failed to create aux booking', 500)
  return ok({ auxBooking: data })
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
  if (error) return err('Failed to update aux booking', 500)
  return ok({ auxBooking: data })
}

async function handleDeleteAuxBooking(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_aux_bookings')
    .delete()
    .eq('id', id)
  if (error) return err('Failed to delete aux booking', 500)
  return ok({ success: true })
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
  if (error) return err('Failed to create aux passenger', 500)
  return ok({ auxPassenger: data })
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
  if (error) return err('Failed to update aux passenger', 500)
  return ok({ auxPassenger: data })
}

async function handleDeleteAuxPassenger(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_aux_passengers')
    .delete()
    .eq('id', id)
  if (error) return err('Failed to delete aux passenger', 500)
  return ok({ success: true })
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
  if (error) return err('Failed to upsert day', 500)
  return ok({ day: data })
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
  if (error) return err('Failed to create day entry', 500)
  return ok({ dayEntry: data })
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
  if (error) return err('Failed to update day entry', 500)
  return ok({ dayEntry: data })
}

async function handleDeleteDayEntry(db: SupabaseClient, id: string): Promise<Response> {
  const { error } = await db
    .from('travel_trip_day_entries')
    .delete()
    .eq('id', id)
  if (error) return err('Failed to delete day entry', 500)
  return ok({ success: true })
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
  if (error) return err('Failed to set public_view', 500)
  return ok({ success: true })
}

// ── derive_itinerary — server-side orchestration ───────────────────────────────
// Runs the full itinerary derivation in a single EF call.
// Eliminates the multi-round-trip loop that existed when this ran client-side.
// Partial derives are no longer possible — all days and entries are created
// server-side atomically before returning.

type DossierBooking = {
  id:                  string
  trip_id:             string
  booking_type:        string | null
  name:                string | null
  confirmation_number: string | null
  start_date:          string | null
  end_date:            string | null
  brief_show:          boolean
  booked_by:           string | null
  inclusions:          string | null
  _hotel_name:         string | null
}

type AuxBooking = {
  id:                  string
  start_date:          string | null
  start_time:          string | null
  end_time:            string | null
  name:                string | null
  booking_type:        string | null
  origin:              string | null
  destination:         string | null
  booked_by:           string | null
  confirmation_number: string | null
  guest_label:         string | null
  notes:               string | null
}

type DossierTrip = {
  id:         string
  start_date: string | null
  end_date:   string | null
  bookings:   DossierBooking[]
}

async function upsertDay(
  db: SupabaseClient,
  tripId: string,
  date: string,
  sortOrder: number,
): Promise<Record<string, unknown>> {
  const { data, error } = await db
    .from('travel_trip_days')
    .upsert(
      { trip_id: tripId, entry_date: date, sort_order: sortOrder, show: true },
      { onConflict: 'trip_id,entry_date' }
    )
    .select()
    .single()
  if (error) throw new Error(`upsertDay ${date}: ${error.message}`)
  return data as Record<string, unknown>
}

async function createEntry(
  db: SupabaseClient,
  entry: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await db
    .from('travel_trip_day_entries')
    .insert(entry)
    .select()
    .single()
  if (error) throw new Error(`createEntry: ${error.message}`)
  return data as Record<string, unknown>
}

async function handleDeriveItinerary(
  db: SupabaseClient,
  trip: DossierTrip,
  auxBookings: AuxBooking[],
): Promise<Response> {
  if (!trip.start_date || !trip.end_date) {
    return ok({ days: [], entries: [] })
  }

  const dates: string[] = []
  const cursor = new Date(trip.start_date + 'T00:00:00')
  const end    = new Date(trip.end_date   + 'T00:00:00')
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

  try {
    // Upsert all days in parallel
    const days = await Promise.all(
      dates.map((date, i) => upsertDay(db, trip.id, date, i))
    )

    const entries: Record<string, unknown>[] = []

    // Hotel check-in / check-out entries
    for (const b of trip.bookings.filter(bk => bk.brief_show !== false)) {
      if (b.start_date && b.booking_type === 'Hotel') {
        const hotelName = b._hotel_name ?? b.name ?? 'Hotel'

        const checkIn = await createEntry(db, {
          trip_id:             trip.id,
          entry_date:          b.start_date,
          start_time:          null,
          end_time:            null,
          title:               `Check-in \u2014 ${hotelName}`,
          subtitle:            b.name ?? null,
          category:            'Hotel',
          booked_by:           b.booked_by ?? 'ambience',
          confirmation_number: b.confirmation_number,
          guest_label:         null,
          notes:               b.inclusions ?? null,
          brief_show:          true,
          sort_order:          10,
          is_auto_derived:     true,
          source_booking_id:   b.id,
          source_aux_id:       null,
        })
        entries.push(checkIn)

        if (b.end_date) {
          const checkOut = await createEntry(db, {
            trip_id:             trip.id,
            entry_date:          b.end_date,
            start_time:          null,
            end_time:            null,
            title:               `Check-out \u2014 ${hotelName}`,
            subtitle:            null,
            category:            'Hotel',
            booked_by:           b.booked_by ?? 'ambience',
            confirmation_number: b.confirmation_number,
            guest_label:         null,
            notes:               null,
            brief_show:          true,
            sort_order:          90,
            is_auto_derived:     true,
            source_booking_id:   b.id,
            source_aux_id:       null,
          })
          entries.push(checkOut)
        }
      }
    }

    // Aux booking entries
    for (const aux of auxBookings) {
      if (!aux.start_date) continue
      const catIcon = aux.booking_type ?? 'Other'
      const entry = await createEntry(db, {
        trip_id:             trip.id,
        entry_date:          aux.start_date,
        start_time:          aux.start_time,
        end_time:            aux.end_time,
        title:               aux.name ?? catIcon,
        subtitle:            aux.origin && aux.destination
                               ? `${aux.origin} \u2192 ${aux.destination}`
                               : null,
        category:            catIcon,
        booked_by:           aux.booked_by ?? 'Own Arrangements',
        confirmation_number: aux.confirmation_number,
        guest_label:         aux.guest_label,
        notes:               aux.notes,
        brief_show:          true,
        sort_order:          aux.start_time
                               ? parseInt(aux.start_time.replace(':', ''), 10)
                               : 50,
        is_auto_derived:     true,
        source_booking_id:   null,
        source_aux_id:       aux.id,
      })
      entries.push(entry)
    }

    return ok({ days, entries })

  } catch (e) {
    console.error('derive_itinerary error:', e)
    return err('Failed to derive itinerary', 500)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }

    if (!mode) return err('mode is required', 400)

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authResult = await verifyAdminCaller(req, serviceClient)
    if (authResult instanceof Response) return authResult

    switch (mode as Mode) {
      case 'upsert_brief': {
        const { trip_id, house_id, patch } = body as { trip_id?: string; house_id?: string; patch?: Record<string, unknown> }
        if (!trip_id || !house_id || !patch) return err('trip_id, house_id, patch required', 400)
        return handleUpsertBrief(serviceClient, trip_id, house_id, patch)
      }

      case 'update_booking_brief': {
        const { booking_id, patch } = body as { booking_id?: string; patch?: Record<string, unknown> }
        if (!booking_id || !patch) return err('booking_id, patch required', 400)
        return handleUpdateBookingBrief(serviceClient, booking_id, patch)
      }

      case 'create_room': {
        const { booking_id, patch } = body as { booking_id?: string; patch?: Record<string, unknown> }
        if (!booking_id || !patch) return err('booking_id, patch required', 400)
        return handleCreateRoom(serviceClient, booking_id, patch)
      }

      case 'update_room': {
        const { room_id, patch } = body as { room_id?: string; patch?: Record<string, unknown> }
        if (!room_id || !patch) return err('room_id, patch required', 400)
        return handleUpdateRoom(serviceClient, room_id, patch)
      }

      case 'delete_room': {
        const { room_id } = body as { room_id?: string }
        if (!room_id) return err('room_id required', 400)
        return handleDeleteRoom(serviceClient, room_id)
      }

      case 'create_aux_booking': {
        const { trip_id, patch } = body as { trip_id?: string; patch?: Record<string, unknown> }
        if (!trip_id || !patch) return err('trip_id, patch required', 400)
        return handleCreateAuxBooking(serviceClient, trip_id, patch)
      }

      case 'update_aux_booking': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return err('id, patch required', 400)
        return handleUpdateAuxBooking(serviceClient, id, patch)
      }

      case 'delete_aux_booking': {
        const { id } = body as { id?: string }
        if (!id) return err('id required', 400)
        return handleDeleteAuxBooking(serviceClient, id)
      }

      case 'create_aux_passenger': {
        const { aux_booking_id, patch } = body as { aux_booking_id?: string; patch?: Record<string, unknown> }
        if (!aux_booking_id || !patch) return err('aux_booking_id, patch required', 400)
        return handleCreateAuxPassenger(serviceClient, aux_booking_id, patch)
      }

      case 'update_aux_passenger': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return err('id, patch required', 400)
        return handleUpdateAuxPassenger(serviceClient, id, patch)
      }

      case 'delete_aux_passenger': {
        const { id } = body as { id?: string }
        if (!id) return err('id required', 400)
        return handleDeleteAuxPassenger(serviceClient, id)
      }

      case 'upsert_day': {
        const { trip_id, entry_date, patch } = body as { trip_id?: string; entry_date?: string; patch?: Record<string, unknown> }
        if (!trip_id || !entry_date || !patch) return err('trip_id, entry_date, patch required', 400)
        return handleUpsertDay(serviceClient, trip_id, entry_date, patch)
      }

      case 'create_day_entry': {
        const { trip_id, entry } = body as { trip_id?: string; entry?: Record<string, unknown> }
        if (!trip_id || !entry) return err('trip_id, entry required', 400)
        return handleCreateDayEntry(serviceClient, trip_id, entry)
      }

      case 'update_day_entry': {
        const { id, patch } = body as { id?: string; patch?: Record<string, unknown> }
        if (!id || !patch) return err('id, patch required', 400)
        return handleUpdateDayEntry(serviceClient, id, patch)
      }

      case 'delete_day_entry': {
        const { id } = body as { id?: string }
        if (!id) return err('id required', 400)
        return handleDeleteDayEntry(serviceClient, id)
      }

      case 'set_public_view': {
        const { trip_id, public_view } = body as { trip_id?: string; public_view?: boolean }
        if (!trip_id || public_view === undefined) return err('trip_id, public_view required', 400)
        return handleSetPublicView(serviceClient, trip_id, public_view)
      }

      case 'derive_itinerary': {
        const { trip, aux_bookings } = body as { trip?: DossierTrip; aux_bookings?: AuxBooking[] }
        if (!trip || !aux_bookings) return err('trip, aux_bookings required', 400)
        return handleDeriveItinerary(serviceClient, trip, aux_bookings)
      }

      default:
        return err(`Unknown mode: ${mode}`, 400)
    }

  } catch (e) {
    console.error('travel-write-trip unexpected error:', e)
    return err('Internal server error', 500)
  }
})