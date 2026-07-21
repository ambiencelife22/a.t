// supabase/functions/travel-write-programme-admin/index.ts
//
// Edge Function: travel-write-programme-admin
// Writes programme admin data across five tables.
//
// Security model:
//   - JWT REQUIRED - verify_jwt = true
//   - requireAdmin gate (_shared/auth.ts) - service role via createServiceClient
//   - All writes bypass RLS via service role.
//
// Modes:
//   update_programme         - update travel_programme_master by id
//   create_programme         - insert into travel_programme_master
//   delete_programme         - delete travel_programme_master by id
//   toggle_programme_field   - update a single boolean field on travel_programme_master
//   update_welcome_letter    - update welcome_letter on travel_programme_master
//   update_property          - update travel_programme_properties by id
//   delete_property          - delete travel_programme_properties by id
//   toggle_property_active   - toggle active on travel_programme_properties
//   create_listing           - insert into travel_programme_property_listings
//   update_listing           - update travel_programme_property_listings by id
//   delete_listing           - delete travel_programme_property_listings by id
//   upsert_programme_section - insert or update travel_programme_sections
//   delete_programme_section - delete travel_programme_sections by id
//   update_section_content   - update content on travel_programme_property_sections by id
//   reorder_property_sections - swap sort_order between two travel_programme_property_sections rows
//   update_section_meta      - update title + icon on travel_programme_property_sections by id
//
// Request body: { mode: string, ...modeParams }
// Response:     { ok: true } | { error: string }
//
// Last updated: S53G - initial build. Migrates 29 direct supabase.from() calls
//   out of ProgrammeAdmin.tsx.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'
import { formatPersonName } from '../_shared/names.ts'
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type WriteMode =
  | 'update_programme'
  | 'create_programme'
  | 'delete_programme'
  | 'toggle_programme_field'
  | 'update_welcome_letter'
  | 'update_property'
  | 'delete_property'
  | 'toggle_property_active'
  | 'create_listing'
  | 'update_listing'
  | 'delete_listing'
  | 'upsert_programme_section'
  | 'delete_programme_section'
  | 'update_section_content'
  | 'reorder_property_sections'
  | 'update_section_meta'
  | 'link_programme_guest'
  | 'unlink_programme_guest'
  | 'remove_programme_guest'

async function handleLinkProgrammeGuest(
  db: SupabaseClient,
  programmeId: string,
  personId: string,
): Promise<Response> {
  const { data: profile, error: profErr } = await db
    .from('global_profiles')
    .select('id')
    .eq('person_id', personId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (profErr) return json({ error: 'Failed to resolve profile' }, 500)
  if (!profile?.id) {
    return json({ error: 'no_profile', message: 'This person has no login account yet and cannot be linked.' }, 409)
  }
  const profileId = profile.id as string
  const { data: existing } = await db
    .from('travel_programme_guests')
    .select('id')
    .eq('programme_id', programmeId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (existing?.id) {
    return json({ error: 'already_linked', message: 'This person is already a guest on this programme.' }, 409)
  }
  const { data: person } = await db
    .from('global_people')
    .select('id, first_name, last_name, nickname')
    .eq('id', personId)
    .maybeSingle()
  const displayName = formatPersonName(person ?? null)
  if (!displayName) return json({ error: 'no_name', message: 'This person has no usable name to display.' }, 400)
  const { count } = await db
    .from('travel_programme_guests')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', programmeId)
  const guestCount = count ?? 0
  const { data: inserted, error: insErr } = await db
    .from('travel_programme_guests')
    .insert({
      programme_id: programmeId,
      profile_id:   profileId,
      display_name: displayName,
      is_lead:      guestCount === 0,
      sort_order:   guestCount,
    })
    .select('id, programme_id, display_name, profile_id, is_lead, sort_order')
    .single()
  if (insErr) return json({ error: 'Failed to link guest' }, 500)
  return json({ guest: inserted })
}

async function handleUnlinkProgrammeGuest(db: SupabaseClient, guestId: string): Promise<Response> {
  const { error } = await db
    .from('travel_programme_guests')
    .update({ profile_id: null })
    .eq('id', guestId)
  if (error) return json({ error: 'Failed to unlink guest' }, 500)
  return json({ success: true })
}

async function handleRemoveProgrammeGuest(db: SupabaseClient, guestId: string): Promise<Response> {
  const { data: snapshot } = await db
    .from('travel_programme_guests')
    .select('*')
    .eq('id', guestId)
    .maybeSingle()
  const { error } = await db
    .from('travel_programme_guests')
    .delete()
    .eq('id', guestId)
  if (error) return json({ error: 'Failed to remove guest' }, 500)
  return json({ success: true, removed: snapshot ?? null })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode: WriteMode }

    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    // ── update_programme ───────────────────────────────────────────────────
    if (mode === 'update_programme') {
      const { id, payload } = body as { id: string; payload: Record<string, unknown> }
      if (!id || !payload) return json({ error: 'id and payload are required' }, 400)

      const { error } = await db
        .from('travel_programme_master')
        .update(payload)
        .eq('id', id)

      if (error) {
        console.error('update_programme error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── create_programme ───────────────────────────────────────────────────
    if (mode === 'create_programme') {
      const { payload } = body as { payload: Record<string, unknown> }
      if (!payload) return json({ error: 'payload is required' }, 400)

      const { error } = await db
        .from('travel_programme_master')
        .insert(payload)

      if (error) {
        console.error('create_programme error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── delete_programme ───────────────────────────────────────────────────
    if (mode === 'delete_programme') {
      const { id } = body as { id: string }
      if (!id) return json({ error: 'id is required' }, 400)

      const { error } = await db
        .from('travel_programme_master')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('delete_programme error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── toggle_programme_field ─────────────────────────────────────────────
    if (mode === 'toggle_programme_field') {
      const { id, field, value } = body as { id: string; field: string; value: boolean }
      if (!id || field === undefined || value === undefined) return json({ error: 'id, field, value are required' }, 400)

      const ALLOWED_FIELDS = new Set([
        'active', 'is_public', 'public_wifi', 'public_alarm',
        'public_owner_phone', 'public_manager_phone', 'no_alarm', 'public_arrival',
      ])
      if (!ALLOWED_FIELDS.has(field)) return json({ error: `Field ${field} is not toggleable` }, 400)

      const { error } = await db
        .from('travel_programme_master')
        .update({ [field]: value })
        .eq('id', id)

      if (error) {
        console.error('toggle_programme_field error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── update_welcome_letter ──────────────────────────────────────────────
    if (mode === 'update_welcome_letter') {
      const { id, welcome_letter } = body as { id: string; welcome_letter: string }
      if (!id || welcome_letter === undefined) return json({ error: 'id and welcome_letter are required' }, 400)

      const { error } = await db
        .from('travel_programme_master')
        .update({ welcome_letter })
        .eq('id', id)

      if (error) {
        console.error('update_welcome_letter error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── update_property ────────────────────────────────────────────────────
    if (mode === 'update_property') {
      const { id, payload } = body as { id: string; payload: Record<string, unknown> }
      if (!id || !payload) return json({ error: 'id and payload are required' }, 400)

      const { error } = await db
        .from('travel_programme_properties')
        .update(payload)
        .eq('id', id)

      if (error) {
        console.error('update_property error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── delete_property ────────────────────────────────────────────────────
    if (mode === 'delete_property') {
      const { id } = body as { id: string }
      if (!id) return json({ error: 'id is required' }, 400)

      const { error } = await db
        .from('travel_programme_properties')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('delete_property error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── toggle_property_active ─────────────────────────────────────────────
    if (mode === 'toggle_property_active') {
      const { id, value } = body as { id: string; value: boolean }
      if (!id || value === undefined) return json({ error: 'id and value are required' }, 400)

      const { error } = await db
        .from('travel_programme_properties')
        .update({ active: value })
        .eq('id', id)

      if (error) {
        console.error('toggle_property_active error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── create_listing ─────────────────────────────────────────────────────
    if (mode === 'create_listing') {
      const { payload } = body as { payload: Record<string, unknown> }
      if (!payload) return json({ error: 'payload is required' }, 400)

      const { error } = await db
        .from('travel_programme_property_listings')
        .insert(payload)

      if (error) {
        console.error('create_listing error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── update_listing ─────────────────────────────────────────────────────
    if (mode === 'update_listing') {
      const { id, payload } = body as { id: string; payload: Record<string, unknown> }
      if (!id || !payload) return json({ error: 'id and payload are required' }, 400)

      const { error } = await db
        .from('travel_programme_property_listings')
        .update(payload)
        .eq('id', id)

      if (error) {
        console.error('update_listing error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── delete_listing ─────────────────────────────────────────────────────
    if (mode === 'delete_listing') {
      const { id } = body as { id: string }
      if (!id) return json({ error: 'id is required' }, 400)

      const { error } = await db
        .from('travel_programme_property_listings')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('delete_listing error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── upsert_programme_section ───────────────────────────────────────────
    // insert when existing_id is null, update otherwise
    if (mode === 'upsert_programme_section') {
      const { existing_id, programme_id, section_id, content } = body as {
        existing_id:  string | null
        programme_id: string
        section_id:   string
        content:      unknown
      }
      if (!programme_id || !section_id || content === undefined) {
        return json({ error: 'programme_id, section_id, content are required' }, 400)
      }

      if (existing_id) {
        const { error } = await db
          .from('travel_programme_sections')
          .update({ content })
          .eq('id', existing_id)

        if (error) {
          console.error('upsert_programme_section update error:', error)
          return json({ error: error.message }, 500)
        }
      }

      if (!existing_id) {
        const { error } = await db
          .from('travel_programme_sections')
          .insert({ programme_id, section_id, content })

        if (error) {
          console.error('upsert_programme_section insert error:', error)
          return json({ error: error.message }, 500)
        }
      }
      return json({ ok: true }, 200)
    }

    // ── delete_programme_section ───────────────────────────────────────────
    if (mode === 'delete_programme_section') {
      const { id } = body as { id: string }
      if (!id) return json({ error: 'id is required' }, 400)

      const { error } = await db
        .from('travel_programme_sections')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('delete_programme_section error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── update_section_content ─────────────────────────────────────────────
    if (mode === 'update_section_content') {
      const { id, content } = body as { id: string; content: unknown }
      if (!id || content === undefined) return json({ error: 'id and content are required' }, 400)

      const { error } = await db
        .from('travel_programme_property_sections')
        .update({ content })
        .eq('id', id)

      if (error) {
        console.error('update_section_content error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── reorder_property_sections ──────────────────────────────────────────
    // Swaps sort_order between two rows atomically (two updates).
    if (mode === 'reorder_property_sections') {
      const { id_a, sort_order_a, id_b, sort_order_b } = body as {
        id_a:         string
        sort_order_a: number
        id_b:         string
        sort_order_b: number
      }
      if (!id_a || !id_b || sort_order_a === undefined || sort_order_b === undefined) {
        return json({ error: 'id_a, id_b, sort_order_a, sort_order_b are required' }, 400)
      }

      const [resA, resB] = await Promise.all([
        db.from('travel_programme_property_sections').update({ sort_order: sort_order_b }).eq('id', id_a),
        db.from('travel_programme_property_sections').update({ sort_order: sort_order_a }).eq('id', id_b),
      ])

      if (resA.error || resB.error) {
        console.error('reorder_property_sections error:', resA.error ?? resB.error)
        return json({ error: 'Failed to reorder sections' }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── update_section_meta ────────────────────────────────────────────────
    if (mode === 'update_section_meta') {
      const { id, title, icon } = body as { id: string; title: string; icon: string }
      if (!id || !title) return json({ error: 'id and title are required' }, 400)

      const { error } = await db
        .from('travel_programme_property_sections')
        .update({ title, icon })
        .eq('id', id)

      if (error) {
        console.error('update_section_meta error:', error)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 200)
    }

    // ── link_programme_guest ───────────────────────────────────────────────
    if (mode === 'link_programme_guest') {
      const { programme_id, person_id } = body as { programme_id?: string; person_id?: string }
      if (!programme_id || !person_id) return json({ error: 'programme_id, person_id required' }, 400)
      return handleLinkProgrammeGuest(db, programme_id, person_id)
    }
    // ── unlink_programme_guest ─────────────────────────────────────────────
    if (mode === 'unlink_programme_guest') {
      const { guest_id } = body as { guest_id?: string }
      if (!guest_id) return json({ error: 'guest_id required' }, 400)
      return handleUnlinkProgrammeGuest(db, guest_id)
    }
    // ── remove_programme_guest ─────────────────────────────────────────────
    if (mode === 'remove_programme_guest') {
      const { guest_id } = body as { guest_id?: string }
      if (!guest_id) return json({ error: 'guest_id required' }, 400)
      return handleRemoveProgrammeGuest(db, guest_id)
    }
    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-write-programme-admin unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})