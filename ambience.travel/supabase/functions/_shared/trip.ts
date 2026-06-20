// supabase/functions/_shared/trip.ts
//
// Single-source trip assembly for the client EFs (travel-get-trip-confirmation
// and travel-get-trip-programme). Both EFs previously duplicated, verbatim:
//   - url_id -> trip_id -> house_id resolution (incl 404 cases)
//   - trip / brief / house / destinations fetch
//   - bookings + rooms fetch, room guest-name resolution, hotel + canon-room
//     image lookups
// That duplication drifted (confirmation carried a stale inline resolvePartyName
// that returned '' instead of null). This module is the one home for the fetch
// and name-resolution; each EF still composes its own DISPLAY shape from the
// returned pieces (image-display rules legitimately differ per surface — same
// principle as roomDisplay living in pdfShared while layout stays per-PDF).
//
// What stays in each EF (genuinely EF-specific, not duplicated):
//   confirmation : contacts resolution, guides, fullBookings financial null-out
//   programme    : standalone entries + dining/exp images, buildTimeline, buildDays
//
// Created: S55 — _shared/trip.ts extraction (single-source quest #1).

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolvePartyName } from './names.ts'

// ── url_id -> trip_id -> house_id ─────────────────────────────────────────────
// Returns the ids, or null when the trip cannot be resolved (caller returns 404).

export async function resolveTripIds(
  db: SupabaseClient,
  urlId: string,
): Promise<{ tripId: string; houseId: string } | null> {
  const { data: eng, error: engErr } = await db
    .from('travel_immerse_engagements')
    .select('trip_id')
    .eq('url_id', urlId)
    .not('trip_id', 'is', null)
    .limit(1)
    .single()
  if (engErr || !eng?.trip_id) return null
  const tripId = eng.trip_id as string

  const { data: booking, error: bookErr } = await db
    .from('travel_bookings')
    .select('house_id')
    .eq('trip_id', tripId)
    .not('house_id', 'is', null)
    .limit(1)
    .single()
  if (bookErr || !booking?.house_id) return null

  return { tripId, houseId: booking.house_id as string }
}

// ── Core fetch: trip + brief + house + destinations ───────────────────────────
// Brief select is the SUPERSET of both EFs' needs (confirmation: contacts/tabs/
// welcome; programme: programme_notes). Extra columns are harmless to either.
// Returns trip=null when the trip row is missing (caller returns 404).

export interface TripCore {
  trip:         Record<string, unknown> | null
  brief:        Record<string, unknown> | null
  house:        Record<string, unknown> | null
  destinations: Array<Record<string, unknown>>
}

export async function fetchTripCore(
  db: SupabaseClient,
  tripId: string,
  houseId: string,
): Promise<TripCore> {
  const [tripResult, briefResult, houseResult, destResult] = await Promise.all([
    db.from('travel_trips')
      .select('id, trip_code, status, start_date, end_date, duration_nights, trip_type, guest_count_adults, guest_count_children')
      .eq('id', tripId)
      .single(),

    db.from('travel_trip_briefs')
      .select(`
        id, trip_id, house_id, brief_title, brief_subtitle, prepared_for,
        hero_image_src, hero_image_alt, logo_variant,
        snapshot_destination, snapshot_dates, snapshot_guests, snapshot_status,
        journey_steps, advisor_name, advisor_email, advisor_phone,
        show_advisor_phone, show_advisor_email,
        hotel_contact_note, important_notes, footer_tagline,
        programme_notes, programme_show_images, welcome_letter,
        show_tab_confirmation, show_tab_programme, show_tab_brief,
        show_tab_contacts, show_tab_welcome,
        contact_person_ids, contact_name_format,
        created_at, updated_at
      `)
      .eq('trip_id', tripId)
      .maybeSingle(),

    db.from('a_houses')
      .select('id, display_name, salutation_rule, travel_style_notes, avoid_notes, service_notes')
      .eq('id', houseId)
      .single(),

    db.from('travel_trip_destinations')
      .select('id, trip_id, destination_id, sort_order, global_destinations!travel_trip_destinations_dest_fkey(slug, name, storage_path, hero_image_src)')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true }),
  ])

  const destinations = ((destResult.data ?? []) as Array<Record<string, unknown>>).map(row => {
    const gdRaw = row.global_destinations
    const gd = Array.isArray(gdRaw) ? gdRaw[0] : gdRaw
    return {
      id:             row.id,
      destination_id: row.destination_id,
      sort_order:     row.sort_order,
      slug:           (gd?.slug as string) ?? '',
      name:           (gd?.name as string) ?? '',
      storage_path:   (gd?.storage_path as string | null) ?? null,
      hero_image_src: (gd?.hero_image_src as string | null) ?? null,
    }
  })

  return {
    trip:  tripResult.data ?? null,
    brief: briefResult.data ?? null,
    house: houseResult.data ?? null,
    destinations,
  }
}

// ── Bookings fetch + enrich ───────────────────────────────────────────────────
// Fetches bookings (caller passes the column list it needs), their rooms, and
// the canon-room + hotel lookups. Resolves each room's guest name via the canon
// resolver. Returns the raw enriched pieces; each EF composes its own image /
// display shape from the maps (confirmation = per-room resolved_image_src +
// hotel hero; programme = per-booking displayImg chain).
//
// Rooms already carry resolved_guest_name. roomsByBooking groups them.

export interface TripBookingsData {
  bookings:       Array<Record<string, unknown>>
  roomsByBooking: Record<string, Array<Record<string, unknown>>>
  canonRoomById:  Record<string, { image_src: string | null; image_alt: string | null }>
  hotelById:      Record<string, { name: string; hero_image_src: string | null }>
}

export async function fetchTripBookings(
  db: SupabaseClient,
  bookings: Array<Record<string, unknown>>,
  partyLabel: string | null,
): Promise<TripBookingsData> {
  const bookingIds = bookings.map(b => b.id as string)

  // Rooms for all bookings. Select the superset of columns both EFs read;
  // additional_guests is confirmation-only but harmless to programme.
  const roomsResult = bookingIds.length > 0
    ? await db.from('travel_booking_rooms')
        .select('id, booking_id, room_id, person_id, room_name, confirmation_number, guest_name, party_composition, notes, nights, brief_image_src, additional_guests, sort_order, created_at, updated_at')
        .in('booking_id', bookingIds)
        .order('sort_order', { ascending: true })
    : { data: [], error: null }
  const rooms = (roomsResult.data ?? []) as Array<Record<string, unknown>>

  // Canon rooms (image_src + alt) via room_id.
  const roomIds = [...new Set(rooms.map(r => r.room_id).filter(Boolean))] as string[]
  const canonRoomById: Record<string, { image_src: string | null; image_alt: string | null }> = {}
  if (roomIds.length > 0) {
    const { data: canonRooms } = await db
      .from('travel_accom_rooms')
      .select('id, room_image_src, room_image_alt')
      .in('id', roomIds)
    for (const r of (canonRooms ?? []) as Array<Record<string, unknown>>) {
      canonRoomById[r.id as string] = {
        image_src: (r.room_image_src as string | null) ?? null,
        image_alt: (r.room_image_alt as string | null) ?? null,
      }
    }
  }

  // Canon hotels (name + hero) via accom_hotel_id.
  const hotelIds = [...new Set(bookings.map(b => b.accom_hotel_id).filter(Boolean))] as string[]
  const hotelById: Record<string, { name: string; hero_image_src: string | null }> = {}
  if (hotelIds.length > 0) {
    const { data: hotels } = await db
      .from('travel_accom_hotels')
      .select('id, name, hero_image_src')
      .in('id', hotelIds)
    for (const h of (hotels ?? []) as Array<Record<string, unknown>>) {
      hotelById[h.id as string] = {
        name:           (h.name as string) ?? '',
        hero_image_src: (h.hero_image_src as string | null) ?? null,
      }
    }
  }

  // Resolve room guest people (batch) and group rooms by booking with
  // resolved_guest_name attached.
  const roomPersonIds = [...new Set(rooms.map(r => r.person_id).filter(Boolean))] as string[]
  const roomPeopleById: Record<string, Record<string, unknown>> = {}
  if (roomPersonIds.length > 0) {
    const { data: rp } = await db
      .from('global_people')
      .select('id, first_name, last_name, nickname')
      .in('id', roomPersonIds)
    for (const g of (rp ?? []) as Array<Record<string, unknown>>) roomPeopleById[g.id as string] = g
  }

  const roomsByBooking: Record<string, Array<Record<string, unknown>>> = {}
  for (const r of rooms) {
    const bid = r.booking_id as string
    const resolved_guest_name = resolvePartyName(
      r.person_id ? roomPeopleById[r.person_id as string] : null,
      r.guest_name as string | null,
      partyLabel,
    )
    ;(roomsByBooking[bid] ??= []).push({ ...r, resolved_guest_name })
  }

  return { bookings, roomsByBooking, canonRoomById, hotelById }
}