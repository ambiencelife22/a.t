/* journeyTypes.ts
 * Shared TypeScript types for ambience.travel journey programmes.
 * Covers programme_days, programme_events, programme_event_contacts.
 */

// ── Event types ───────────────────────────────────────────────────────────────

export type EventType =
  | 'flight'
  | 'transfer'
  | 'check_in'
  | 'check_out'
  | 'experience'
  | 'dining'

export type EventStatus = 'confirmed' | 'recommended' | 'cancelled'

// ── Contact attached to an event ──────────────────────────────────────────────

export type EventContact = {
  id:    string
  name:  string
  role:  string
  phone: string | null
}

// ── Individual event ──────────────────────────────────────────────────────────

export type JourneyEvent = {
  id:                  string
  event_type:          EventType
  status:              EventStatus
  title:               string
  time_local:          string | null
  duration:            string | null
  description:         string | null
  confirmation_number: string | null
  location:            string | null
  supplier_name:       string | null
  sort_order:          number
  airline:             string | null
  flight_number:       string | null
  departure_airport:   string | null
  arrival_airport:     string | null
  arrival_time:        string | null
  flight_class:        string | null
  seats:               string | null
  terminal:            string | null
  gate:                string | null
  driver_name:         string | null
  driver_phone:        string | null
  room_type:           string | null
  check_in_date:       string | null
  check_out_date:      string | null
  inclusions:          string | null
  contacts:            EventContact[]
}

// ── Day ───────────────────────────────────────────────────────────────────────

export type JourneyDay = {
  id:         string
  date:       string | null
  title:      string | null
  sort_order: number
  events:     JourneyEvent[]
}