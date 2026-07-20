// supabase/functions/_shared/typesTimeline.ts
// ONE source for the trip-timeline shapes. Imported by BOTH the server producer
// (_shared/timeline.ts) and the frontend (src/types/typesTimeline.ts via the
// @shared Vite alias). Types-only, zero runtime imports, so it crosses the
// Deno/Vite boundary cleanly. Adding a field here reaches both surfaces at once —
// no more hand-synced drift (schedule_status and driver_details both drifted
// before this file existed).

export type TimelineRoom = {
  id:                  string
  guest:               string | null
  additional_guests:   string[]
  room_name:           string | null
  party_composition:   string | null
  confirmation_number: string | null
  notes:               string | null
  bedding_type:        string | null
}

export type TimelinePassenger = {
  id:                       string
  passenger_label:          string | null
  resolved_passenger_label: string | null
  confirmation_number:      string | null
  seat_numbers:             string | null
  sort_order:               number
}

export type TimelineDriverDetail = {
  id:           string
  driver_name:  string | null
  driver_phone: string | null
  car_model:    string | null
  plate:        string | null
  vehicle_role: string | null
  sort_order:   number
}

export type TimelineItem = {
  id:                  string
  kind:                'hotel_checkin' | 'hotel_checkout' | 'aux' | 'entry'
  entry_date:          string
  start_time:          string | null
  end_time:            string | null
  category:            string | null
  categoryLabel:       string | null
  title:               string
  subtitle:            string | null
  notes:               string | null
  confirmation_number: string | null
  booked_by:           string | null
  image_src:           string | null
  guest_label:         string | null
  status:              string | null
  check_in_note:                string | null
  check_out_note:               string | null
  standard_checkin_time:        string | null
  approved_checkin_time:        string | null
  expected_arrival_time:        string | null
  contact_name:                 string | null
  contact_phone:                string | null
  guest_name:                   string | null
  guest_count:                  number | null
  dining_status:                string | null
  cancellation_penalty_applied: boolean | null
  cancellation_note:            string | null
  show_cancellation:            boolean | null
  schedule_status:              string | null
  requested_checkout_time:      string | null
  late_checkout_approved_time:  string | null
  original_start_time:          string | null
  original_end_time:            string | null
  schedule_note:                string | null
  venue: {
    address:         string | null
    maps_url:        string | null
    phone:           string | null
    dress_code:      string | null
    children_policy: string | null
    table_hold_note: string | null
    booking_terms:   string | null
  } | null
  rooms:               TimelineRoom[]
  passengers:          TimelinePassenger[]
  driver_details:      TimelineDriverDetail[]
  source_booking_id:   string | null
  source_aux_id:       string | null
  brief_show:          boolean
}