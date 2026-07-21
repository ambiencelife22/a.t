// _shared/elementFields.ts
// SINGLE SOURCE for the flat<->normalized element field mapping. Consumed by BOTH
// the read-flatten (buildElementFlat) and the write-split (travel-write-journey),
// so they cannot drift. Never hand-mirror the split in a handler, import here.
//
// Stage 7: flat travel_engagement_aux_bookings -> NODE (travel_engagements) + 1:1
// detail (transport OR dining). Bare types (airport_transfer, meet_greet) = node only.

// NODE columns. Cross-cutting (same meaning across every element type).
// Left = flat field name (read contract / patch). Right = actual node column.
export const NODE_FIELD_MAP: Record<string, string> = {
  engagement_type_id:           'engagement_type_id',
  name:                         'title',
  start_date:                   'activity_date',
  end_date:                     'activity_end_date',
  start_time:                   'activity_start_time',
  end_time:                     'activity_end_time',
  original_start_time:          'original_start_time',
  original_end_time:            'original_end_time',
  confirmation_number:          'confirmation_number',
  brief_show:                   'brief_show',
  cancellation_penalty_applied: 'cancellation_penalty_applied',
  show_cancellation:            'show_cancellation',
  schedule_status:              'schedule_status',
  schedule_note:                'schedule_note',
  sort_order:                   'sort_order',
}

// travel_engagement_transport_detail columns (flight). Flat name == column name.
export const TRANSPORT_FIELDS = [
  'depart_airport_id', 'arrive_airport_id', 'aircraft_type_id', 'cabin_class_id',
  'supplier_id', 'airline_name', 'flight_number', 'origin', 'destination',
  'notes', 'booked_by',
] as const

// travel_engagement_reservation_detail columns. Flat name == column name.
export const DINING_FIELDS = [
  'supplier_id', 'dining_venue_id', 'guest_name', 'guest_count', 'dining_status', 'contact_name',
  'contact_phone', 'cancellation_note', 'booking_terms_override', 'notes', 'booked_by',
] as const

// travel_engagement_experience_detail columns. Flat name == column name.
export const EXPERIENCE_FIELDS = [
  'supplier_id', 'person_id', 'guest_count', 'price_per_person', 'currency',
  'package_name', 'package_inclusions', 'schedule', 'notes',
] as const

// Flat patch carries these as FREE TEXT; tables store registry FKs. Write-split
// resolves text -> id. flat text field -> { registry table, match col, detail fk col }.
export const TRANSPORT_TEXT_TO_FK: Record<string, { table: string; match: string; fk: string }> = {
  cabin_class:    { table: 'travel_cabin_classes',  match: 'label', fk: 'cabin_class_id' },
  aircraft_type:  { table: 'travel_aircraft_types', match: 'label', fk: 'aircraft_type_id' },
  depart_airport: { table: 'travel_airports',       match: 'iata',  fk: 'depart_airport_id' },
  arrive_airport: { table: 'travel_airports',       match: 'iata',  fk: 'arrive_airport_id' },
}


export const DROPPED_FIELDS = ['seat_type'] as const

// Detail table for an element type. null = bare node (no detail row).
export function detailTableForType(slug: string | null): string | null {
  if (slug === 'flight') return 'travel_engagement_transport_detail'
  // dining + reservation share one detail shape: a canonical supplier + party/time/terms.
  if (slug === 'dining' || slug === 'reservation') return 'travel_engagement_reservation_detail'
  if (slug === 'spa_wellness' || slug === 'tour' || slug === 'experience') return 'travel_engagement_experience_detail'
  return null
}