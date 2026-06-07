// supabase/functions/travel-read-engagement-admin/index.ts
//
// Edge Function: travel-read-engagement-admin
// Class A — admin-only. Single source for all admin-side engagement reads.
//
// Security model:
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - Reads execute via service role to bypass RLS uniformly
//
// Request body:
//   { mode: ReadMode, ...mode-specific params }
//
// Modes:
//   list                — fetchEngagementList()           → EngagementListRow[]
//   detail              — fetchEngagementDetail(url_id)   → EngagementDetailRow | null
//   child_counts        — fetchChildCounts(engagement_id) → ChildCounts
//   engagement_statuses — fetchEngagementStatuses()       → StatusLookup[]
//   itinerary_statuses  — fetchItineraryStatuses()        → StatusLookup[]
//   people              — fetchPeople(query)              → PersonOption[]
//   trips               — fetchTrips(query)               → TripOption[]
//   person_by_id        — fetchPersonById(id)             → PersonOption | null
//   trip_by_id          — fetchTripById(id)               → TripOption | null
//   welcome_letter      — fetchWelcomeLetterCanonical()   → WelcomeLetterCanonical | null
//
// Deployed at: /functions/v1/travel-read-engagement-admin
// First ship: S54
// S54 cleanup: removed max_sort_order mode (sort_order now computed server-side
//   inside travel-write-engagement.create_engagement; no remaining caller).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ReadMode =
  | 'list'
  | 'detail'
  | 'child_counts'
  | 'engagement_statuses'
  | 'itinerary_statuses'
  | 'people'
  | 'trips'
  | 'person_by_id'
  | 'trip_by_id'
  | 'welcome_letter'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const childCountTables = [
  'travel_immerse_trip_destination_rows',
  'travel_immerse_trip_pricing_rows',
  'travel_immerse_trip_destination_hotels',
  'travel_immerse_trip_region_hotels',
  'travel_immerse_route_stops',
  'travel_immerse_trip_content_card_selections',
  'travel_immerse_trip_content_card_overrides',
  'travel_immerse_rooms',
] as const

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as ReadMode | undefined

    if (!mode) {
      return json({ error: 'mode is required' }, 400)
    }

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── 3. Verify caller is admin ─────────────────────────────────────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profile, error: profileError } = await serviceClient
      .from('global_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile || profile.is_admin !== true) {
      return json({ error: 'Forbidden' }, 403)
    }

    // ── 4. Mode dispatch ─────────────────────────────────────────────────────

    if (mode === 'list') {
      const { data, error } = await serviceClient
        .from('travel_immerse_engagements')
        .select(`
          id, url_id, title, audience, is_public_template,
          engagement_status_id, itinerary_status_id, sort_order, created_at,
          iteration_label, trip_id,
          engagement_status:travel_engagement_statuses(slug, label),
          itinerary_status:travel_itinerary_statuses(slug, label),
          trip:travel_trips(
            trip_code, public_title, start_date, primary_client_id,
            primary_client:global_people!travel_trips_primary_client_id_fkey(
              id, first_name, last_name, nickname
            )
          )
        `)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('list error:', error)
        return json({ error: 'Failed to fetch engagement list' }, 500)
      }

      const rows = (data ?? []).map((r: any) => ({
        id:                      r.id,
        url_id:                  r.url_id,
        title:                   r.title,
        audience:                r.audience,
        is_public_template:      r.is_public_template,
        engagement_status_id:    r.engagement_status_id,
        itinerary_status_id:     r.itinerary_status_id,
        sort_order:              r.sort_order,
        created_at:              r.created_at,
        iteration_label:         r.iteration_label ?? '',
        engagement_status_slug:  r.engagement_status?.slug  ?? null,
        engagement_status_label: r.engagement_status?.label ?? null,
        itinerary_status_slug:   r.itinerary_status?.slug   ?? null,
        itinerary_status_label:  r.itinerary_status?.label  ?? null,
        trip_id:                 r.trip_id,
        trip_code:               r.trip?.trip_code         ?? null,
        trip_public_title:       r.trip?.public_title      ?? null,
        trip_start_date:         r.trip?.start_date        ?? null,
        client_first_name:       r.trip?.primary_client?.first_name ?? null,
        client_last_name:        r.trip?.primary_client?.last_name  ?? null,
        client_nickname:         r.trip?.primary_client?.nickname   ?? null,
        client_id:               r.trip?.primary_client?.id         ?? null,
      }))

      return json({ rows })
    }

    if (mode === 'detail') {
      const url_id = body?.url_id as string | undefined
      if (!url_id) return json({ error: 'url_id is required' }, 400)

      const { data, error } = await serviceClient
        .from('travel_immerse_engagements')
        .select('*')
        .eq('url_id', url_id)
        .maybeSingle()

      if (error) {
        console.error('detail error:', error)
        return json({ error: 'Failed to fetch engagement detail' }, 500)
      }

      return json({ row: data ?? null })
    }

    if (mode === 'child_counts') {
      const engagement_id = body?.engagement_id as string | undefined
      if (!engagement_id) return json({ error: 'engagement_id is required' }, 400)

      const results = await Promise.all(
        childCountTables.map(t =>
          serviceClient.from(t).select('id', { count: 'exact', head: true }).eq('trip_id', engagement_id),
        ),
      )

      const counts = {
        destination_rows:   results[0].count ?? 0,
        pricing_rows:       results[1].count ?? 0,
        destination_hotels: results[2].count ?? 0,
        region_hotels:      results[3].count ?? 0,
        route_stops:        results[4].count ?? 0,
        card_selections:    results[5].count ?? 0,
        card_overrides:     results[6].count ?? 0,
        rooms:              results[7].count ?? 0,
      }

      return json({ counts })
    }

    if (mode === 'engagement_statuses') {
      const { data, error } = await serviceClient
        .from('travel_engagement_statuses')
        .select('id, slug, label, sort_order')
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('engagement_statuses error:', error)
        return json({ error: 'Failed to fetch engagement statuses' }, 500)
      }

      return json({ rows: data ?? [] })
    }

    if (mode === 'itinerary_statuses') {
      const { data, error } = await serviceClient
        .from('travel_itinerary_statuses')
        .select('id, slug, label, sort_order')
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('itinerary_statuses error:', error)
        return json({ error: 'Failed to fetch itinerary statuses' }, 500)
      }

      return json({ rows: data ?? [] })
    }

    if (mode === 'people') {
      const query = (body?.query as string | undefined) ?? ''
      let q = serviceClient
        .from('global_people')
        .select('id, first_name, last_name, nickname')
        .order('first_name', { ascending: true })
        .limit(20)

      const trimmed = query.trim()
      if (trimmed) {
        q = q.or(
          `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%`,
        )
      }

      const { data, error } = await q
      if (error) {
        console.error('people error:', error)
        return json({ error: 'Failed to fetch people' }, 500)
      }

      return json({ rows: data ?? [] })
    }

    if (mode === 'trips') {
      const query = (body?.query as string | undefined) ?? ''
      let q = serviceClient
        .from('travel_trips')
        .select('id, trip_code, start_date')
        .order('start_date', { ascending: false, nullsFirst: false })
        .limit(20)

      const trimmed = query.trim()
      if (trimmed) {
        q = q.ilike('trip_code', `%${trimmed}%`)
      }

      const { data, error } = await q
      if (error) {
        console.error('trips error:', error)
        return json({ error: 'Failed to fetch trips' }, 500)
      }

      return json({ rows: data ?? [] })
    }

    if (mode === 'person_by_id') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)

      const { data, error } = await serviceClient
        .from('global_people')
        .select('id, first_name, last_name, nickname')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('person_by_id error:', error)
        return json({ error: 'Failed to fetch person' }, 500)
      }

      return json({ row: data ?? null })
    }

    if (mode === 'trip_by_id') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)

      const { data, error } = await serviceClient
        .from('travel_trips')
        .select('id, trip_code, start_date')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('trip_by_id error:', error)
        return json({ error: 'Failed to fetch trip' }, 500)
      }

      return json({ row: data ?? null })
    }

    if (mode === 'welcome_letter') {
      const { data, error } = await serviceClient
        .from('travel_immerse_welcome_letter')
        .select('eyebrow, title, body, signoff_body, signoff_name')
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('welcome_letter error:', error)
        return json({ error: 'Failed to fetch welcome letter' }, 500)
      }

      return json({ row: data ?? null })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-read-engagement-admin unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})