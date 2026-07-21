// supabase/functions/a-read-house/index.ts
//
// Edge Function: a-read-house
// Read path for ambience.HOUSE reference data.
//
// Security model:
//   - JWT REQUIRED - verify_jwt = true (platform gate)
//   - Caller authenticated + admin (global_profiles.is_admin = true)
//   - Reads execute via service role to bypass RLS uniformly
//   - Auth via shared requireAdmin gate; SERVICE_ROLE_KEY lives in _shared/client.ts
//
// Modes:
//   roles - returns all active house roles ordered by sort_order → { roles }
//
// Deployed at: /functions/v1/a-read-house

import { requireAdmin } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { mode } = body as { mode?: string }
    if (!mode) return json({ error: 'mode is required' }, 400)

    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const { serviceClient } = gate

    if (mode === 'roles') {
      const { data, error } = await serviceClient
        .from('a_house_roles')
        .select('id, slug, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) {
        console.error('roles error:', error)
        return json({ error: 'Failed to fetch roles' }, 500)
      }
      return json({ roles: data ?? [] }, 200)
    }

    if (mode === 'houses') {
      const { data, error } = await serviceClient
        .from('a_houses')
        .select('id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, public_name, created_at, updated_at')
        .order('display_name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch houses' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    if (mode === 'house_by_id') {
      const { data, error } = await serviceClient
        .from('a_houses')
        .select('id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, public_name, created_at, updated_at')
        .eq('id', body.id).maybeSingle()
      if (error) return json({ error: 'Failed to fetch house' }, 500)
      return json({ row: data ?? null }, 200)
    }

    if (mode === 'house_by_house_id') {
      const { data, error } = await serviceClient
        .from('a_houses')
        .select('id, a_house_id, display_name, designation, status, summary, service_style_notes, travel_style_notes, avoid_notes, service_notes, missing_info_notes, salutation_rule, brief_language, public_name, created_at, updated_at')
        .eq('a_house_id', body.a_house_id).maybeSingle()
      if (error) return json({ error: 'Failed to fetch house' }, 500)
      return json({ row: data ?? null }, 200)
    }

    if (mode === 'people') {
      const { data, error } = await serviceClient
        .from('a_house_people')
        .select('id, house_id, person_id, member_ref, role, notes, sort_order, created_at, updated_at')
        .eq('house_id', body.house_id)
        .order('sort_order', { ascending: true })
      if (error) return json({ error: 'Failed to fetch people' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    if (mode === 'labels') {
      const { data, error } = await serviceClient
        .from('a_house_public_labels')
        .select('*')
        .eq('house_id', body.house_id)
        .order('sort_order', { ascending: true })
      if (error) return json({ error: 'Failed to fetch labels' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    if (mode === 'profile_for_person') {
      const { data, error } = await serviceClient
        .from('global_profiles')
        .select('id, display_name')
        .eq('person_id', body.person_id).maybeSingle()
      if (error) return json({ error: 'Failed to fetch profile' }, 500)
      return json({ row: data ?? null }, 200)
    }

    if (mode === 'preferences') {
      const { data, error } = await serviceClient
        .from('a_house_preferences')
        .select('id, house_id, person_id, category, pref_key, pref_value, notes, source, confidence, created_at, updated_at')
        .eq('house_id', body.house_id)
      if (error) return json({ error: 'Failed to fetch preferences' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    if (mode === 'dining_history') {
      const { data, error } = await serviceClient
        .from('a_house_dininghistory')
        .select('id, house_id, restaurant_name, city, country, status, visit_date, journey_id, venue_id, notes, created_at, updated_at')
        .eq('house_id', body.house_id)
      if (error) return json({ error: 'Failed to fetch dining history' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    if (mode === 'destinations') {
      const { data, error } = await serviceClient
        .from('a_house_destinations')
        .select('id, house_id, destination_name, country, city, trip_type, status, visit_date, journey_id, notes, created_at, updated_at')
        .eq('house_id', body.house_id)
      if (error) return json({ error: 'Failed to fetch destinations' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    if (mode === 'contacts') {
      const { data, error } = await serviceClient
        .from('a_house_contacts')
        .select('id, house_id, person_id, contact_type, name, role, company, is_primary, notes, created_at, updated_at')
        .eq('house_id', body.house_id)
      if (error) return json({ error: 'Failed to fetch contacts' }, 500)
      return json({ rows: data ?? [] }, 200)
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('a-read-house unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
