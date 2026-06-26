// supabase/functions/a-write-ppd/index.ts
//
// Edge Function: a-write-ppd
// Writes (INSERT or DELETE) to a_ppd_people and a_ppd_contacts.
// This is the ONLY path for PPD writes — frontend code never touches
// these tables directly.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate, JWT ON)
//   - Caller must be authenticated AND admin — enforced via requireAdmin
//     (_shared/auth.ts). The gate returns a service client that bypasses RLS.
//   - a_ppd_* tables have no direct client write policy
//   - All writes logged to console.info with actor + action + table + id
//
// Request body:
//   {
//     action:  "insert" | "delete",
//     table:   "people"  | "contacts",
//     payload: {
//       // For action="insert" table="people":
//       //   { house_id, person_id?, data_key, data_value, access_note? }
//       // For action="insert" table="contacts":
//       //   { house_id, contact_id, data_key, data_value, access_note? }
//       // For action="delete" (either table):
//       //   { id }
//     }
//   }
//
// Response:
//   { ok: true, row: <inserted row> }     — on insert success
//   { ok: true }                          — on delete success
//   { error: string }                     — on failure (status reflects reason)
//
// Validation:
//   - data_key for people writes validated against PPD_PEOPLE_KEYS (in-code)
//   - data_key for contact writes validated against DB CHECK + in-code list
//   - house_id always required for insert
//   - person_id or contact_id required per table
//   - id required for delete
//
// Deployed at: /functions/v1/a-write-ppd
// Last updated: S53H — migrated to shared canon: requireAdmin gate (was a
//   hand-rolled anon→getUser→service→is_admin preamble), imported json (was a
//   local re-roll of _shared/http.ts json). No change to validation or write logic.
// Prior: S52 — initial ship. Closes the highest-priority gap identified in the
//   Client Data Edge Function Plan (PPD writes were previously RLS-only).

import { preflight, json } from '../_shared/http.ts'
import { requireAdmin } from '../_shared/auth.ts'

// ── Canonical PPD key registries ──────────────────────────────────────────────
// Mirrors src/types/typesPpd.ts on the frontend. Both files MUST stay in sync.
// To add a key: update typesPpd.ts first, then update these arrays.

const PPD_PEOPLE_KEYS: ReadonlyArray<string> = [
  'Date of Birth',
  'Nationality',
  'Passport Number',
  'Passport Country',
  'Passport Expiry',
  'Passport Issue Date',
  'Known Traveller Number',
  'Global Entry',
  'TSA PreCheck',
  'Visa Notes',
  'Frequent Flyer Program',
  'Frequent Flyer Number',
  'Hotel Loyalty Program',
  'Hotel Loyalty Number',
  'Mobile',
  'Emergency Contact Name',
  'Emergency Contact Mobile',
  'Home Address',
  'Dietary Medical Note',
]

const PPD_CONTACT_KEYS: ReadonlyArray<string> = [
  'Phone',
  'Email',
  'WhatsApp',
  'Address',
  'Other',
]

// ── Types ─────────────────────────────────────────────────────────────────────

type Action = 'insert' | 'delete'
type Table  = 'people'  | 'contacts'

interface RequestBody {
  action?:  Action
  table?:   Table
  payload?: Record<string, unknown>
}

// ── Response helpers — built on the shared json() ─────────────────────────────
// Local sugar over _shared/http.ts json. Shape: json(body, status).

const ok          = (body: Record<string, unknown>): Response => json(body, 200)
const badRequest  = (message: string):               Response => json({ error: message }, 400)
const serverError = (message: string):               Response => json({ error: message }, 500)

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return preflight()

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({} as RequestBody)) as RequestBody
    const { action, table, payload } = body

    if (action !== 'insert' && action !== 'delete') {
      return badRequest('action must be "insert" or "delete"')
    }
    if (table !== 'people' && table !== 'contacts') {
      return badRequest('table must be "people" or "contacts"')
    }
    if (!payload || typeof payload !== 'object') {
      return badRequest('payload required')
    }

    // ── 2. Verify caller is an authenticated admin ───────────────────────────
    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient, user } = gate

    // ── 3. Dispatch on action ─────────────────────────────────────────────────
    const tableName = table === 'people' ? 'a_ppd_people' : 'a_ppd_contacts'

    if (action === 'delete') {
      const id = payload.id
      if (typeof id !== 'string' || id.length === 0) {
        return badRequest('payload.id required for delete')
      }

      const { error: delError } = await serviceClient
        .from(tableName)
        .delete()
        .eq('id', id)

      if (delError) {
        console.error(`a-write-ppd delete error on ${tableName}:`, delError)
        return serverError(`Failed to delete from ${tableName}`)
      }

      console.info(`a-write-ppd actor=${user.id} action=delete table=${tableName} id=${id}`)
      return ok({ ok: true })
    }

    // action === 'insert'
    const houseId    = payload.house_id
    const dataKey    = payload.data_key
    const dataValue  = payload.data_value
    const accessNote = payload.access_note ?? null

    if (typeof houseId !== 'string' || houseId.length === 0) {
      return badRequest('payload.house_id required')
    }
    if (typeof dataKey !== 'string' || dataKey.length === 0) {
      return badRequest('payload.data_key required')
    }
    if (typeof dataValue !== 'string' || dataValue.length === 0) {
      return badRequest('payload.data_value required')
    }
    if (accessNote !== null && typeof accessNote !== 'string') {
      return badRequest('payload.access_note must be string or null')
    }

    // Validate data_key against canonical registry per table
    if (table === 'people' && !PPD_PEOPLE_KEYS.includes(dataKey)) {
      return badRequest(`Invalid data_key for people PPD: "${dataKey}"`)
    }
    if (table === 'contacts' && !PPD_CONTACT_KEYS.includes(dataKey)) {
      return badRequest(`Invalid data_key for contact PPD: "${dataKey}"`)
    }

    // Build insert row per table
    let insertRow: Record<string, unknown> = {}

    if (table === 'people') {
      const personId = payload.person_id ?? null
      if (personId !== null && typeof personId !== 'string') {
        return badRequest('payload.person_id must be string or null')
      }
      insertRow = {
        house_id:    houseId,
        person_id:   personId,
        data_key:    dataKey,
        data_value:  dataValue,
        access_note: accessNote,
      }
    }
    if (table === 'contacts') {
      // contacts — contact_id required
      const contactId = payload.contact_id
      if (typeof contactId !== 'string' || contactId.length === 0) {
        return badRequest('payload.contact_id required for contacts insert')
      }
      insertRow = {
        house_id:    houseId,
        contact_id:  contactId,
        data_key:    dataKey,
        data_value:  dataValue,
        access_note: accessNote,
      }
    }

    const { data: insertedRow, error: insertError } = await serviceClient
      .from(tableName)
      .insert(insertRow)
      .select('*')
      .single()

    if (insertError) {
      console.error(`a-write-ppd insert error on ${tableName}:`, insertError)
      return serverError(`Failed to insert into ${tableName}`)
    }

    console.info(`a-write-ppd actor=${user.id} action=insert table=${tableName} id=${insertedRow?.id ?? 'unknown'}`)
    return ok({ ok: true, row: insertedRow })

  } catch (err) {
    console.error('a-write-ppd unexpected error:', err)
    return serverError('Internal server error')
  }
})