// typesPpd.ts — Canonical PPD (personally protected data) key registries.
//
// What it owns:
//   - PPD_PEOPLE_KEYS: canonical list of data_key values for a_ppd_people.
//     Covers identity, travel documents, loyalty programmes, emergency
//     contacts, dietary/medical notes.
//   - PPD_CONTACT_KEYS: canonical list of data_key values for a_ppd_contacts.
//     Mirrors the DB CHECK constraint on a_ppd_contacts.data_key.
//   - PPD_PEOPLE_KEY_GROUPS: grouped registry for the admin UI dropdown
//     (Identity / Travel Documents / Loyalty / Contact / Medical).
//   - Validators (isValidPpdPeopleKey, isValidPpdContactKey) used by the
//     a-write-ppd Edge Function to enforce taxonomy before INSERT.
//
// What it does not own:
//   - PPD reads/writes (see queriesAdminHouse.ts + a-get-ppd + a-write-ppd)
//   - UI rendering
//
// Source of truth for:
//   - a_ppd_people.data_key allowed values (no DB CHECK \u2014 enforced in code)
//   - a_ppd_contacts.data_key allowed values (also enforced by DB CHECK)
//   - Admin UI dropdown options for adding new PPD entries
//
// To add a new PPD key:
//   1. Add to PPD_PEOPLE_KEYS (preserves dropdown order)
//   2. Add to the appropriate group in PPD_PEOPLE_KEY_GROUPS
//   3. No DB migration required \u2014 a_ppd_people has no CHECK constraint
//   4. For contact keys: DB CHECK constraint must be updated first via migration,
//      then add to PPD_CONTACT_KEYS array
//
// Last updated: S52 \u2014 initial extraction. Constants previously hardcoded inline
//   in HouseTab.tsx (violation of single-source rule). Moved here as canonical
//   registry for the a-write-ppd Edge Function validation + admin UI consumption.

// ── People PPD keys ───────────────────────────────────────────────────────────
// Ordered by category, then logical workflow within category.

export const PPD_PEOPLE_KEYS = [
  // Identity
  'Date of Birth',
  'Nationality',

  // Travel Documents
  'Passport Number',
  'Passport Country',
  'Passport Expiry',
  'Passport Issue Date',
  'Known Traveller Number',
  'Global Entry',
  'TSA PreCheck',
  'Visa Notes',

  // Loyalty Programmes
  'Frequent Flyer Program',
  'Frequent Flyer Number',
  'Hotel Loyalty Program',
  'Hotel Loyalty Number',

  // Contact
  'Mobile',
  'Emergency Contact Name',
  'Emergency Contact Mobile',
  'Home Address',

  // Medical
  'Dietary Medical Note',
] as const

export type PpdPeopleKey = typeof PPD_PEOPLE_KEYS[number]

// ── Contact PPD keys ──────────────────────────────────────────────────────────
// Mirrors a_ppd_contacts.data_key CHECK constraint exactly.
// DB CHECK enforces this list \u2014 update the migration before changing here.

export const PPD_CONTACT_KEYS = [
  'Phone',
  'Email',
  'WhatsApp',
  'Address',
  'Other',
] as const

export type PpdContactKey = typeof PPD_CONTACT_KEYS[number]

// ── Grouped registry for admin UI ─────────────────────────────────────────────
// Used by HouseTab.tsx PPD dropdown to render an optgroup-style picker.

export interface PpdKeyGroup {
  label:   string
  options: readonly PpdPeopleKey[]
}

export const PPD_PEOPLE_KEY_GROUPS: PpdKeyGroup[] = [
  {
    label:   'Identity',
    options: ['Date of Birth', 'Nationality'],
  },
  {
    label:   'Travel Documents',
    options: [
      'Passport Number',
      'Passport Country',
      'Passport Expiry',
      'Passport Issue Date',
      'Known Traveller Number',
      'Global Entry',
      'TSA PreCheck',
      'Visa Notes',
    ],
  },
  {
    label:   'Loyalty Programmes',
    options: [
      'Frequent Flyer Program',
      'Frequent Flyer Number',
      'Hotel Loyalty Program',
      'Hotel Loyalty Number',
    ],
  },
  {
    label:   'Contact',
    options: [
      'Mobile',
      'Emergency Contact Name',
      'Emergency Contact Mobile',
      'Home Address',
    ],
  },
  {
    label:   'Medical',
    options: ['Dietary Medical Note'],
  },
]

// ── Validators ────────────────────────────────────────────────────────────────
// Used by a-write-ppd Edge Function. Reject INSERT if data_key not in registry.

export function isValidPpdPeopleKey(value: string | null | undefined): value is PpdPeopleKey {
  if (!value) return false
  return (PPD_PEOPLE_KEYS as readonly string[]).includes(value)
}

export function isValidPpdContactKey(value: string | null | undefined): value is PpdContactKey {
  if (!value) return false
  return (PPD_CONTACT_KEYS as readonly string[]).includes(value)
}