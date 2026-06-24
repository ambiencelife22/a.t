// supabase/functions/travel-get-engagement-stage/index.ts
//
// Edge Function: travel-get-engagement-stage
// Returns the full engagement row + content flags for stage computation.
// This is the ONLY public path for engagement data — anon clients call this,
// not the engagement table directly, so we can:
//   - Bypass RLS on operational tables with the service role key
//   - Gate exposure on engagement.public_view flag
//   - Rate-limit, log, and harden centrally
//
// Security model:
//   - Public endpoint — no auth required
//   - url_id is the access token (11-char alphanumeric)
//   - All DB reads use the service role key to bypass RLS
//   - Returns 404 when url_id doesn't exist OR public_view = false
//     (indistinguishable — no leak about which url_ids exist)
//
// Request body:
//   { url_id: string }
//
// Response (200):
//   { engagement: <row with status joins>, hasTripContent: boolean }
//
// Response (404):
//   { error: 'Not found' }
//
// Deployed at: /functions/v1/travel-get-engagement-stage
// Last updated: S53B Closing — added hero_eyebrow_override to the
//   ENGAGEMENT_SELECT_COLUMNS list. Without it, the new engagement-level
//   hero eyebrow override field never reaches the client.
// Prior: S50 — renamed from get-engagement-stage to
//   travel-get-engagement-stage per product-prefix convention.
//   No functional changes.
// Prior: S48 — initial ship.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const URL_ID_REGEX = /^[A-Za-z0-9]{11}$/

const ENGAGEMENT_SELECT_COLUMNS = `
  id, url_id, slug, trip_id, audience, journey_types,
  person_id, status_label, public_view, proposal_visibility,
  engagement_status_id, itinerary_status_id,
  travel_engagement_statuses (id, slug, label, sort_order, is_active),
  travel_itinerary_statuses  (id, slug, label, sort_order, is_active),
  eyebrow, title, hero_tagline, subtitle,
  hero_image_src, hero_image_alt, hero_image_src_2, hero_image_alt_2,
  hero_title_2, hero_subtitle_2, hero_pills,
  hero_eyebrow_override,
  welcome_eyebrow_override, welcome_title_override, welcome_body_override,
  welcome_signoff_body_override, welcome_signoff_name_override,
  route_heading, route_body, route_eyebrow,
  destination_heading, destination_subtitle, destination_body,
  pricing_heading, pricing_title, pricing_body,
  pricing_total_label, pricing_total_value,
  pricing_notes_heading, pricing_notes_title, pricing_notes
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { url_id } = body as { url_id?: string }

    if (!url_id || !URL_ID_REGEX.test(url_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid url_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: engagement, error: engErr } = await db
      .from('travel_immerse_engagements')
      .select(ENGAGEMENT_SELECT_COLUMNS)
      .eq('url_id', url_id)
      .single()

    if (engErr || !engagement) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gate on public_view — hidden engagements look identical to non-existent
    // ones. Same 404 response, no information leak.
    if (!(engagement as any).public_view) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tripId = (engagement as any).trip_id as string | null
    let hasTripContent = false

    if (tripId) {
      const [bookingsRes, daysRes, auxRes] = await Promise.all([
        db.from('travel_bookings')          .select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
        db.from('travel_trip_days')         .select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
        db.from('travel_trip_aux_bookings') .select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
      ])
      hasTripContent =
        (bookingsRes.count ?? 0) > 0 ||
        (daysRes.count     ?? 0) > 0 ||
        (auxRes.count      ?? 0) > 0
    }

    return new Response(
      JSON.stringify({ engagement, hasTripContent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('travel-get-engagement-stage unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})