// supabase/functions/travel-read-trip-admin/index.ts
//
// Edge Function: travel-read-trip-admin
// Consolidates all admin read paths for trip data into a single
// mode-keyed dispatcher.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - All target tables have no direct anon/client read policy for this data
//   - This function uses the service role key to bypass RLS
//   - Never called with the anon key
//
// Request body:
//   { mode: Mode, ...modeParams }
//
// Modes:
//   dossier      { house_id: string }
//   brief        { trip_id: string }
//   rooms        { booking_id: string }
//   days         { trip_id: string }
//   day_entries  { trip_id: string }
//   aux_bookings { trip_id: string }
//   public_view  { trip_id: string }
//
// Response (200):
//   mode-specific payload (see each handler)
//
// Response (400): { error: 'Invalid request' }
// Response (401): { error: 'Unauthorized' }
// Response (403): { error: 'Forbidden' }
// Response (500): { error: 'Internal server error' }
//
// Deployed at: /functions/v1/travel-read-trip-admin
// Created: S52

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Mode =
  | 'dossier'
  | 'brief'
  | 'rooms'
  | 'days'
  | 'day_entries'
  | 'aux_bookings'
  | 'public_view'

// ── Auth helpers ──────────────────────────────────────────────────────────────

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

// ── Mode handlers ─────────────────────────────────────────────────────────────

async function handleDossier(db: SupabaseClient, houseId: string): Promise<Response> {
  // 1. Trip IDs via bookings
  const { data: bookTripData, error: bookTripErr } = await db
    .from('travel_bookings')
    .select('trip_id')
    .eq('house_id', houseId)
    .not('trip_id', 'is', null)

  if (bookTripErr) return err('Failed to fetch bookings', 500)
  const bookTripRows = (bookTripData ?? []) as { trip_id: string }[]
  if (bookTripRows.length === 0) return ok({ trips: [], partners: {}, house: null })

  const tripIds = [...new Set(bookTripRows.map(r => r.trip_id))]

  // 2. Trips
  const { data: tripData, error: tripErr } = await db
    .from('travel_trips')
    .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, guest_count_adults, guest_count_children')
    .in('id', tripIds)
    .order('start_date', { ascending: false })

  if (tripErr) return err('Failed to fetch trips', 500)
  const tripRows = (tripData ?? []) as Record<string, unknown>[]
  if (tripRows.length === 0) return ok({ trips: [], partners: {}, house: null })

  // 3. Bookings
  const { data: bookData, error: bookErr } = await db
    .from('travel_bookings')
    .select('id, trip_id, house_id, engagement_id, booking_type, name, status, confirmation_number, start_date, end_date, nights, commissionable_rate, total_rate, taxes_and_fees, currency, rate_type, inclusions, price, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, commission_pct, commission_amount, net_revenue, commission_paid_at, invoice_number, iata_partner_id, iata_share_pct, iata_share_amt, referral_partner_id, referral_share_pct, referral_share_amt, individual_id, individual_share_pct, individual_share_amt, accom_hotel_id, supplier_id, supplier_name_override, party_composition, primary_contact_name, primary_contact_role, supplier_contact_name, supplier_contact_whatsapp, brief_category, brief_show, brief_image_src, booked_by, cancellation_policy, booking_policy, notes, sort_order, created_at, updated_at')
    .eq('house_id', houseId)
    .order('sort_order', { ascending: true })

  if (bookErr) return err('Failed to fetch booking details', 500)
  const bookingRows = (bookData ?? []) as Record<string, unknown>[]

  // 4. Hotels
  const hotelIds = [...new Set(
    bookingRows
      .map(b => b.accom_hotel_id as string | null)
      .filter((id): id is string => !!id)
  )]
  const hotelMap: Record<string, { name: string; hero_image_src: string | null }> = {}
  if (hotelIds.length > 0) {
    const { data: hotelData } = await db
      .from('travel_accom_hotels')
      .select('id, name, hero_image_src')
      .in('id', hotelIds)
    for (const h of (hotelData ?? []) as { id: string; name: string; hero_image_src: string | null }[]) {
      hotelMap[h.id] = { name: h.name, hero_image_src: h.hero_image_src }
    }
  }

  const bookingIds = bookingRows.map(b => b.id as string)

  // 5. Parallel fetches
  const [partnerResult, houseResult, briefResult, roomResult, destResult, engResult] = await Promise.all([
    db.from('travel_partners')
      .select('id, name, partner_type, default_share_pct, currency, is_active'),
    db.from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),
    db.from('travel_trip_briefs')
      .select('*')
      .in('trip_id', tripIds),
    bookingIds.length > 0
      ? db.from('travel_booking_rooms')
          .select('*')
          .in('booking_id', bookingIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db.from('travel_trip_destinations')
      .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
      .in('trip_id', tripIds)
      .order('sort_order', { ascending: true }),
    db.from('travel_immerse_engagements')
      .select('trip_id, url_id')
      .in('trip_id', tripIds)
      .not('trip_id', 'is', null),
  ])

  if (partnerResult.error) return err('Failed to fetch partners', 500)

  return ok({
    bookingRows,
    hotelMap,
    tripRows,
    partners:  partnerResult.data ?? [],
    house:     houseResult.data ?? null,
    briefs:    briefResult.data ?? [],
    rooms:     roomResult.data  ?? [],
    dests:     destResult.data  ?? [],
    engagements: engResult.data ?? [],
  })
}

async function handleBrief(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_briefs')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle()
  if (error) return err('Failed to fetch brief', 500)
  return ok({ brief: data ?? null })
}

async function handleRooms(db: SupabaseClient, bookingId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_booking_rooms')
    .select('*')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch rooms', 500)
  return ok({ rooms: data ?? [] })
}

async function handleDays(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('entry_date', { ascending: true })
  if (error) return err('Failed to fetch days', 500)
  return ok({ days: data ?? [] })
}

async function handleDayEntries(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_day_entries')
    .select('*')
    .eq('trip_id', tripId)
    .order('entry_date', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch day entries', 500)
  return ok({ dayEntries: data ?? [] })
}

async function handleAuxBookings(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_trip_aux_bookings')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (error) return err('Failed to fetch aux bookings', 500)
  return ok({ auxBookings: data ?? [] })
}

async function handlePublicView(db: SupabaseClient, tripId: string): Promise<Response> {
  const { data, error } = await db
    .from('travel_immerse_engagements')
    .select('public_view')
    .eq('trip_id', tripId)
    .single()
  if (error || !data) return ok({ publicView: false })
  return ok({ publicView: !!(data as { public_view: boolean }).public_view })
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { mode, house_id, trip_id, booking_id } = body as {
      mode:        string | undefined
      house_id?:   string
      trip_id?:    string
      booking_id?: string
    }

    if (!mode) return err('mode is required', 400)

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authResult = await verifyAdminCaller(req, serviceClient)
    if (authResult instanceof Response) return authResult

    switch (mode as Mode) {
      case 'dossier':
        if (!house_id) return err('house_id is required for dossier mode', 400)
        return handleDossier(serviceClient, house_id)

      case 'brief':
        if (!trip_id) return err('trip_id is required for brief mode', 400)
        return handleBrief(serviceClient, trip_id)

      case 'rooms':
        if (!booking_id) return err('booking_id is required for rooms mode', 400)
        return handleRooms(serviceClient, booking_id)

      case 'days':
        if (!trip_id) return err('trip_id is required for days mode', 400)
        return handleDays(serviceClient, trip_id)

      case 'day_entries':
        if (!trip_id) return err('trip_id is required for day_entries mode', 400)
        return handleDayEntries(serviceClient, trip_id)

      case 'aux_bookings':
        if (!trip_id) return err('trip_id is required for aux_bookings mode', 400)
        return handleAuxBookings(serviceClient, trip_id)

      case 'public_view':
        if (!trip_id) return err('trip_id is required for public_view mode', 400)
        return handlePublicView(serviceClient, trip_id)

      default:
        return err(`Unknown mode: ${mode}`, 400)
    }

  } catch (e) {
    console.error('travel-read-trip-admin unexpected error:', e)
    return err('Internal server error', 500)
  }
})