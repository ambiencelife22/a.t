// src/types/typesTimeline.ts
// Client-side mirror of the TimelineItem shape produced by
// supabase/functions/_shared/timeline.ts. The EF builds the trip timeline
// server-side (single source) and returns it as `entries`; the programme tab
// and PDF render this shape directly. The Deno _shared module cannot be imported
// across the Vite boundary, so the TYPE is mirrored here. Keep in sync with
// _shared/timeline.ts TimelineItem (the runtime producer).

export type TimelineRoom = {
  id:                  string
  guest:               string | null
  room_name:           string | null
  party_composition:   string | null
  confirmation_number: string | null
  notes:               string | null
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

export type TimelinePassenger = {
  id:                       string
  passenger_label:          string | null
  resolved_passenger_label: string | null
  confirmation_number:      string | null
  seat_numbers:             string | null
  sort_order:               number
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
  rooms:               TimelineRoom[]
  passengers:          TimelinePassenger[]
  driver_details:      TimelineDriverDetail[]
  source_booking_id:   string | null
  source_aux_id:       string | null
  brief_show:          boolean
}
