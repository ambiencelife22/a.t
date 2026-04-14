/* programmeTypes.ts
 * Shared TypeScript types for the ambience.travel programme product.
 */

// ── Property ──────────────────────────────────────────────────────────────────

export type PropertyPhoto = {
  src:        string
  caption:    string
  subCaption: string
}

export type Property = {
  id:          string
  name:        string
  tagline:     string
  location:    string
  heroImage:   string
  photos:      PropertyPhoto[]  // cycling property photos — N images with captions
  mapsUrl:     string | null
  mapsEmbedUrl: string | null
  owner:       Contact
  manager:     Contact
  emergencies: EmergencyContact[]
}

export type Contact = {
  name:  string
  phone: string
  role:  string
}

export type EmergencyContact = {
  label: string
  phone: string
}

// ── House Manual ──────────────────────────────────────────────────────────────

export type ManualSection = {
  id:      string
  title:   string
  icon:    string   // emoji
  content: ManualBlock[]
}

export type ManualBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading';   text: string }
  | { type: 'list';      items: string[] }
  | { type: 'warning';   text: string }
  | { type: 'note';      text: string }
  | { type: 'wifi';      network: string; password: string }

// ── Listings ──────────────────────────────────────────────────────────────────

export type ListingCategory = 'lunch' | 'dinner' | 'takeaway' | 'activity' | 'shopping'

export type Listing = {
  id:       string
  name:     string
  category: ListingCategory
  address:  string
  website?: string
  genre?:   string
  hours?:   string
  note?:    string
  favorite?: boolean
  images?:  string[]
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export type Booking = {
  id:             string           // URL slug — random, unguessable
  propertyId:     string
  guestNames:     string           // e.g. "Ragnar & Gunnar"
  checkIn?:       string           // ISO date — absent for preview/undated bookings
  checkOut?:      string           // ISO date — absent for preview/undated bookings
  welcomeLetter:  string           // markdown-lite plain text
  activeListingIds?: string[]      // if undefined, show all
  alarmCodeProvided?: boolean      // if false, show no-code alternate alarm text
  passwordHash?:  string           // optional — if set, require password
}