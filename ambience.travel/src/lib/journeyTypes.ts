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
  | 'activity'
  | 'dining'

export type EventStatus = 'confirmed' | 'recommended' | 'cancelled'

// ── Contact attached to an event ──────────────────────────────────────────────

export type EventContact = {
  id:    string
  name:  string
  role:  string        // e.g. "Driver", "Photographer", "Guide"
  phone: string | null
}

// ── Individual event ──────────────────────────────────────────────────────────

export type JourneyEvent = {
  id:                  string
  event_type:          EventType
  status:              EventStatus
  title:               string
  time_local:          string | null   // e.g. "08:25", "TBA"
  duration:            string | null   // e.g. "3.5hrs", "Flexible"
  description:         string | null
  confirmation_number: string | null
  location:            string | null
  supplier_name:       string | null   // denormalised from suppliers join
  sort_order:          number

  // Flight-specific
  airline:             string | null
  flight_number:       string | null
  departure_airport:   string | null
  arrival_airport:     string | null
  arrival_time:        string | null
  flight_class:        string | null
  seats:               string | null   // free text e.g. "3A, 4A"
  terminal:            string | null
  gate:                string | null

  // Transfer-specific
  driver_name:         string | null
  driver_phone:        string | null

  // Accommodation-specific
  room_type:           string | null
  check_in_date:       string | null
  check_out_date:      string | null
  inclusions:          string | null   // free text e.g. "All-Inclusive Meals"

  // Contacts
  contacts:            EventContact[]
}

// ── Day ───────────────────────────────────────────────────────────────────────

export type JourneyDay = {
  id:         string
  date:       string | null   // ISO date e.g. "2025-06-08"
  title:      string | null   // e.g. "Tanzania Arrival!"
  sort_order: number
  events:     JourneyEvent[]
}