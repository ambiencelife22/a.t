// travel-read-guides - client-facing catalog reads for the four guide variants
// (dining / experiences / hotels / shopping) + happenings. Guest surface.
// Public catalog via service role; per-user grant check uses caller JWT so RLS scopes it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, preflight } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/client.ts'

const serviceClient = createServiceClient()

const GUIDE_TABLE_NAMES: Record<string, string> = {
  dining: 'travel_dining_guides', experiences: 'travel_experiences_guides',
  hotels: 'travel_hotel_guides', shopping: 'travel_shopping_guides',
}

const GUIDE_GRANT_VIEW_NAMES: Record<string, string> = {
  dining: 'travel_dining_guide_for_user', experiences: 'travel_experiences_guide_for_user',
}

const OVERLAY_FIELDS = 'hero_image_src, hero_image_alt, eyebrow_override, headline_override, intro_override, is_active, accuracy_date, at_a_glance_bullets, guide_year, guide_version, plan_your_visit_heading, plan_your_visit_intro, plan_your_visit_bullets'
const DINING_FIELDS = 'id, name, cuisine_subcategory, kicker, tagline, body, bullets_heading, bullets, michelin_award, michelin_stars, michelin_green_star, worlds_50_best, address, maps_url, website, neighborhood, price_band, public_preview_rank, tags, image_src, image_alt, image_credit, image_credit_url, image_license, image_2_src, image_2_alt, sort_order, is_supplementary, is_highlighted, venue_status, closed_visible_until'
const EXP_FIELDS = 'id, name, kicker, tagline, body, bullets_heading, bullets, address, maps_url, image_src, image_alt, image_credit, image_credit_url, image_license, sort_order, experienceCategory:travel_experience_categories(label), public_preview_rank'
const HOTEL_FIELDS = 'id, slug, short_slug, name, description, address, city, zip_code, latitude, longitude, google_maps_url, website, hero_image_src, hero_image_alt, image_credit, image_credit_url, image_license, bullets, stars, michelin_keys, forbes_rating, is_preferred_partner, is_supplementary, brand_id, brand2_id, sort_order, public_preview_rank'
const HAPPENING_FIELDS = 'id, global_destination_id, name, category, tagline, body, bullets, start_date, end_date, venue_name, address, maps_url, website, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order, public_preview_rank, surfaces, created_at, updated_at'
const SHOP_FIELDS = 'id, global_destination_id, name, brand, shop_type, tagline, body, bullets, address, maps_url, by_appointment, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order, public_preview_rank, created_at, updated_at'

async function resolveDestId(slug: string): Promise<string | null> {
  const { data } = await serviceClient.from('global_destinations').select('id').eq('slug', slug).single()
  return (data as { id?: string } | null)?.id ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode as string | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    if (mode === 'destination') {
      const overlayTable = GUIDE_TABLE_NAMES[body.variant as string]
      if (!overlayTable) return json({ error: 'Unknown variant' }, 400)
      const sel = 'id, slug, name, hero_image_src, hero_image_alt, overlay:' + overlayTable + '(' + OVERLAY_FIELDS + ')'
      const { data, error } = await serviceClient.from('global_destinations').select(sel).eq('slug', body.destination_slug).single()
      if (error) {
        if (error.code === 'PGRST116') return json({ row: null })
        return json({ error: 'Failed to fetch destination' }, 500)
      }
      return json({ row: data ?? null })
    }

    if (mode === 'grant') {
      const viewName = GUIDE_GRANT_VIEW_NAMES[body.variant as string]
      if (!viewName) return json({ status: 'ungated' })
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ status: 'no_session' })
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data, error } = await userClient.from(viewName).select('global_destination_id').eq('destination_slug', body.destination_slug).maybeSingle()
      if (error) return json({ error: 'Grant check failed' }, 500)
      return json({ status: data ? 'granted' : 'no_grant' })
    }

    if (mode === 'dining_by_destination') {
      const destId = await resolveDestId(body.destination_slug as string)
      if (!destId) return json({ rows: [] })
      const { data, error } = await serviceClient.from('travel_dining_venues').select(DINING_FIELDS).eq('global_destination_id', destId).eq('is_active', true).order('is_supplementary', { ascending: true }).order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch dining venues' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'experiences_by_destination') {
      const destId = await resolveDestId(body.destination_slug as string)
      if (!destId) return json({ rows: [] })
      const { data, error } = await serviceClient.from('travel_experiences').select(EXP_FIELDS).eq('global_destination_id', destId).eq('is_active', true).order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch experiences' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'hotels_by_destination') {
      const destId = await resolveDestId(body.destination_slug as string)
      if (!destId) return json({ rows: [] })
      const { data, error } = await serviceClient.from('travel_accom_hotels').select(HOTEL_FIELDS).eq('destination_id', destId).eq('is_active', true).order('is_supplementary', { ascending: true }).order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch hotels' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'happenings_by_destination') {
      let q = serviceClient.from('travel_happenings').select(HAPPENING_FIELDS).eq('global_destination_id', body.global_destination_id)
      if (body.surface) q = q.contains('surfaces', [body.surface])
      const hasWindow = !!(body.start_date || body.end_date)
      if (hasWindow && body.end_date)   q = q.lte('start_date', body.end_date)
      if (hasWindow && body.start_date) q = q.gte('end_date',   body.start_date)
      if (!hasWindow) {
        const today = new Date().toISOString().slice(0, 10)
        q = q.gte('end_date', today)
      }
      const { data, error } = await q.order('start_date', { ascending: true }).order('sort_order', { ascending: true }).order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch happenings' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'happening_by_id') {
      const { data, error } = await serviceClient.from('travel_happenings').select(HAPPENING_FIELDS).eq('id', body.id).maybeSingle()
      if (error) return json({ error: 'Failed to fetch happening' }, 500)
      return json({ row: data ?? null })
    }

    if (mode === 'shopping_by_destination') {
      const { data, error } = await serviceClient.from('travel_shopping').select(SHOP_FIELDS).eq('global_destination_id', body.global_destination_id).order('sort_order', { ascending: true }).order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch shopping' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'destinations_all') {
      const { data, error } = await serviceClient
        .from('global_destinations')
        .select('id, slug, name, storage_path')
        .order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch destinations' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'destinations_all') {
      const { data, error } = await serviceClient
        .from('global_destinations')
        .select('id, slug, name, storage_path')
        .order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch destinations' }, 500)
      return json({ rows: data ?? [] })
    }

    return json({ error: 'Unknown mode: ' + mode }, 400)
  } catch (err) {
    console.error('travel-read-guides unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
