// supabase/functions/travel-read-programme-admin/index.ts
//
// Edge Function: travel-read-programme-admin
// Reads programme admin data across five tables.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true
//   - requireAdmin gate (_shared/auth.ts) — service role via createServiceClient
//   - All five tables have no direct client read policy for admin surfaces;
//     reads bypass RLS via service role.
//
// Modes:
//   programmes          — list all travel_programme_master rows + joined property
//   properties          — list all travel_programme_properties rows
//   listings            — list travel_programme_property_listings by property_id
//   property_sections   — list travel_programme_property_sections by property_id
//   programme_sections  — list travel_programme_sections by programme_id
//
// Request body: { mode: string, ...modeParams }
// Response:     { data: Row[] }
//
// Last updated: S53G — initial build. Migrates 29 direct supabase.from() calls
//   out of ProgrammeAdmin.tsx.

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type ReadMode =
  | 'programmes'
  | 'properties'
  | 'listings'
  | 'property_sections'
  | 'programme_sections'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode, property_id, programme_id } = body as {
      mode:          ReadMode
      property_id?:  string
      programme_id?: string
    }

    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient: db } = gate

    // ── programmes ─────────────────────────────────────────────────────────
    if (mode === 'programmes') {
      const { data, error } = await db
        .from('travel_programme_master')
        .select(`
          id, url_id, programme_type, sub_path, status, active, is_public,
          public_wifi, public_alarm, public_owner_phone, public_manager_phone,
          no_alarm, public_arrival, guest_names, guest_count, check_in, check_out,
          welcome_letter, property_id, active_listing_ids, alarm_code_provided,
          properties:travel_programme_properties(id, name, slug)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('travel_programme_master fetch error:', error)
        return json({ error: 'Failed to fetch programmes' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── properties ─────────────────────────────────────────────────────────
    if (mode === 'properties') {
      const { data, error } = await db
        .from('travel_programme_properties')
        .select(`
          id, slug, name, tagline, city, country, hero_image, maps_url,
          maps_embed_url, owner_name, owner_phone, manager_name, manager_phone,
          emergency_contacts, active
        `)
        .order('name')

      if (error) {
        console.error('travel_programme_properties fetch error:', error)
        return json({ error: 'Failed to fetch properties' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── listings ───────────────────────────────────────────────────────────
    if (mode === 'listings') {
      if (!property_id) return json({ error: 'property_id is required for listings mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_property_listings')
        .select('id, name, category, genre, address, website, hours, note, favourite, property_id')
        .eq('property_id', property_id)
        .order('category')

      if (error) {
        console.error('travel_programme_property_listings fetch error:', error)
        return json({ error: 'Failed to fetch listings' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── property_sections ──────────────────────────────────────────────────
    if (mode === 'property_sections') {
      if (!property_id) return json({ error: 'property_id is required for property_sections mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_property_sections')
        .select('id, title, icon, sort_order, variant, content, property_id')
        .eq('property_id', property_id)
        .order('sort_order')

      if (error) {
        console.error('travel_programme_property_sections fetch error:', error)
        return json({ error: 'Failed to fetch property sections' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── programme_sections ─────────────────────────────────────────────────
    if (mode === 'programme_sections') {
      if (!programme_id) return json({ error: 'programme_id is required for programme_sections mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_sections')
        .select('id, section_id, content')
        .eq('programme_id', programme_id)

      if (error) {
        console.error('travel_programme_sections fetch error:', error)
        return json({ error: 'Failed to fetch programme sections' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    // ── property_sections_admin (title+icon only — for ProgrammeSectionOverrides) ──
    // Separate mode to avoid over-fetching content in the override selector.
    if (mode === 'property_sections_meta') {
      if (!property_id) return json({ error: 'property_id is required for property_sections_meta mode' }, 400)

      const { data, error } = await db
        .from('travel_programme_property_sections')
        .select('id, title, icon')
        .eq('property_id', property_id)
        .eq('variant', 'default')
        .order('sort_order')

      if (error) {
        console.error('travel_programme_property_sections meta fetch error:', error)
        return json({ error: 'Failed to fetch property sections meta' }, 500)
      }
      return json({ data: data ?? [] }, 200)
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-read-programme-admin unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})