// supabase/functions/travel-get-immerse-proposal/index.ts
//
// Edge Function: travel-get-immerse-proposal
// Single source for ALL client-facing proposal data — overview and subpages.
// Replaces: travel-get-engagement-stage + all 4 client-side dest query files
//   (queriesImmerseDestCore, queriesImmerseDestHotels, queriesImmerseDestCards,
//   queriesImmerseDestPricing) + scattered anon queries in queriesImmerseEngagement.
//
// Security model:
//   - Public endpoint — no auth required
//   - url_id is the access token (11-char alphanumeric)
//   - All DB reads use service role to bypass RLS
//   - Returns 404 when url_id doesn't exist OR public_view = false
//     (indistinguishable — no leak about which url_ids exist)
//
// Request body:
//   { url_id: string, destination_slug?: string }
//
// Response (overview — no destination_slug):
//   { mode: 'overview', engagement: EngagementPayload }
//
// Response (subpage — destination_slug provided):
//   { mode: 'subpage', engagement: EngagementPayload, destination: DestinationPayload }
//
// Response (404):
//   { error: 'Not found' }
//
// Key fix vs old client-side code: fetchEngagementDestRow matches on
//   engagement_id + global_destination_id ONLY — no destination_url_slug filter.
//   The old code's `IS NULL` filter on url_slug caused subpages to fail
//   when dest_rows had a non-null url_slug set for routing purposes.
//
// Deployed at: /functions/v1/travel-get-immerse-proposal
// Created: S53H — consolidation of 20+ client-side anon queries into one EF.
// S53O — brought onto the shared service-client factory + shared json/preflight
//   (was still on inline makeDb() + hand-rolled ok()/err() — missed by the
//   S53H Batch 2 sweep). Bespoke public url_id auth preserved (no admin gate).
//   Overlay rename in progress: travel_immerse_* -> travel_overlay_* (Phase A);
//   this EF is the sole reader of most overlay tables and repoints per migration.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createServiceClient } from '../_shared/client.ts'
import { json, preflight } from '../_shared/http.ts'

const URL_ID_RE = /^[A-Za-z0-9]{11}$/

// ── Entry ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const { url_id, destination_slug } = body as {
      url_id?: string
      destination_slug?: string
    }

    if (!url_id || !URL_ID_RE.test(url_id)) {
      return json({ error: 'Invalid url_id' }, 400)
    }

    const db = createServiceClient()

    // ── Gate: fetch + visibility ───────────────────────────────────────────────
    const { data: engRow, error: engErr } = await db
      .from('travel_engagements')
      .select(ENGAGEMENT_COLS)
      .eq('url_id', url_id)
      .single()

    if (engErr || !engRow) return json({ error: 'Not found' }, 404)
    if (!engRow.public_view) return json({ error: 'not_public' }, 403)

    // ── Overview payload (always built — needed for nav on subpages too) ───────
    const engagementId = engRow.id as string
    const engagement   = await buildEngagementPayload(db, engRow)

    if (!destination_slug) {
      return json({ mode: 'overview', engagement })
    }

    // ── Subpage payload ────────────────────────────────────────────────────────
    const destination = await buildDestinationPayload(db, engagementId, destination_slug)
    if (!destination) return json({ error: 'Destination not found' }, 404)

    return json({ mode: 'subpage', engagement, destination })

  } catch (e) {
    console.error('travel-get-immerse-proposal error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})

// ── Engagement column list ────────────────────────────────────────────────────

const ENGAGEMENT_COLS = `
  id, url_id, slug, journey_id, audience, journey_types,
  person_id, status_label, public_view, proposal_visibility,
  engagement_status_id, itinerary_status_id,
  travel_lifecycle_statuses (id, slug, label, sort_order, is_active),
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

// ── Build engagement payload ──────────────────────────────────────────────────

async function buildEngagementPayload(db: SupabaseClient, engRow: Record<string, unknown>) {
  const engagementId = engRow.id as string

  const [displayRes, stopsRes, destRowsRes, pricingRes, welcomeRes, linksRes] = await Promise.all([
    db.from('travel_overlay_engagement_display')
      .select('house_display_name')
      .eq('engagement_id', engagementId)
      .maybeSingle(),
    db.from('travel_overlay_route_stops')
      .select('id, sort_order, title, stay_label, note, image_src, image_alt, destination_row_id, nights')
      .eq('engagement_id', engagementId)
      .order('sort_order'),
    db.from('travel_overlay_engagement_destination_rows')
      .select(`
        id, sort_order, number_label, title, mood, summary, stay_label, nights,
        image_src, image_alt, subpage_status, destination_url_slug,
        hero_eyebrow_override,
        global_destinations ( slug, name, hero_image_src, hero_image_alt )
      `)
      .eq('engagement_id', engagementId)
      .neq('subpage_status', 'hidden')
      .order('sort_order'),
    db.from('travel_overlay_engagement_pricing_rows')
      .select(`
        id, sort_order, recommended_basis, stay_label, indicative_range,
        global_destinations ( slug, name )
      `)
      .eq('engagement_id', engagementId)
      .order('sort_order'),
    db.from('travel_welcome_letter')
      .select('eyebrow, title, body, signoff_body, signoff_name')
      .limit(1)
      .maybeSingle(),
    db.from('travel_engagement_links')
      .select('id, link_type, label, url, sort_order, is_highlighted')
      .eq('engagement_id', engagementId)
      .eq('is_active', true)
      .eq('show_on_proposal', true)
      .order('sort_order', { ascending: true }),
  ])

  // Hero image fallbacks for destination rows — fetch template rows
  const destRows = (destRowsRes.data ?? []) as Record<string, unknown>[]
  const globalIds = destRows
    .map(r => (r.global_destinations as Record<string, unknown> | null)?.id)
    .filter((x): x is string => !!x)

  const templateHeroMap: Record<string, { hero_image_src: string | null; hero_image_alt: string | null }> = {}
  if (globalIds.length > 0) {
    const { data: templateRows } = await db
      .from('travel_destinations')
      .select('global_destination_id, hero_image_src, hero_image_alt')
      .in('global_destination_id', globalIds)
      .is('url_slug', null)
    for (const t of (templateRows ?? []) as Record<string, unknown>[]) {
      templateHeroMap[t.global_destination_id as string] = {
        hero_image_src: t.hero_image_src as string | null,
        hero_image_alt: t.hero_image_alt as string | null,
      }
    }
  }

  const displayData = displayRes.data ?? null
  const guestDisplayName =
    (displayData?.house_display_name as string | null | undefined) ?? null

  return {
    engagementRow:  engRow,
    display:        displayData,
    guestDisplayName,
    routeStops:     stopsRes.data ?? [],
    destinationRows: destRows,
    templateHeroMap,
    tripPricingRows: pricingRes.data ?? [],
    welcomeLetter:  welcomeRes.data ?? null,
    links:          linksRes.data ?? [],
  }
}

// ── Build destination payload ─────────────────────────────────────────────────
// KEY DESIGN: resolves dest_row by trip_id + global_destination_id only.
// No destination_url_slug filter — the url_slug on dest_rows is for routing,
// not for lookup. Filtering on it caused the St Barths "not found" loop.

async function buildDestinationPayload(
  db:            SupabaseClient,
  engagementId:  string,
  urlSlug:       string,
): Promise<Record<string, unknown> | null> {

  // 1. Resolve global_destination_id from slug
  //    First check variant table (url_slug), then global_destinations (slug)
  let globalDestinationId: string | null = null
  let destTemplate: Record<string, unknown> | null = null
  let isVariant = false

  const { data: variantRow } = await db
    .from('travel_destinations')
    .select('*')
    .eq('url_slug', urlSlug)
    .maybeSingle()

  if (variantRow) {
    globalDestinationId = variantRow.global_destination_id as string
    destTemplate        = variantRow as Record<string, unknown>
    isVariant           = true
  }

  if (!variantRow) {
    const { data: globalRow } = await db
      .from('global_destinations')
      .select('id')
      .eq('slug', urlSlug)
      .maybeSingle()
    if (!globalRow) return null
    globalDestinationId = globalRow.id as string
  }

  if (!globalDestinationId) return null

  // 2. Fetch canonical template if not already fetched (variant case above)
  if (!isVariant) {
    const { data: tmpl } = await db
      .from('travel_destinations')
      .select('*')
      .eq('global_destination_id', globalDestinationId)
      .is('url_slug', null)
      .maybeSingle()
    destTemplate = (tmpl ?? null) as Record<string, unknown> | null
    if (!destTemplate) return null
  }

  // 3. Fetch engagement dest_row.
  //    When the slug matched a variant (isVariant=true), pick the row with that
  //    exact destination_url_slug. When canonical, pick the null-slug primary row.
  //    This handles destinations with multiple rows (e.g. newyork + newyork2)
  //    without .maybeSingle() failing on >1 result.
  const destRowQuery = db
    .from('travel_overlay_engagement_destination_rows')
    .select(`
      id,
      global_destination_id,
      hero_image_src_override, hero_image_alt_override,
      hero_image_src_2_override, hero_image_alt_2_override,
      hero_title_2_override, hero_subtitle_2_override,
      hero_eyebrow_override,
      intro_title_override, intro_body_override,
      dining_eyebrow_override, dining_title_override, dining_body_override,
      experiences_eyebrow_override, experiences_title_override, experiences_body_override,
      pricing_body_override,
      pricing_notes_heading_override, pricing_notes_title_override,
      pricing_notes_override,
      pricing_closer_item_override, pricing_closer_basis_override,
      pricing_closer_stay_override, pricing_closer_indicative_range_override,
      destination_url_slug
    `)
    .eq('engagement_id', engagementId)
    .eq('global_destination_id', globalDestinationId)

  const { data: destRow } = await (isVariant
    ? destRowQuery.eq('destination_url_slug', urlSlug).maybeSingle()
    : destRowQuery.is('destination_url_slug', null).maybeSingle()
  )

  if (!destRow) return null

  const destinationRowId = destRow.id as string
  const destinationId        = destTemplate!.id as string
  const effectiveUrlSlug     = (destRow.destination_url_slug as string | null) ?? null

  // 4. Fetch global hero fallback
  const { data: globalHero } = await db
    .from('global_destinations')
    .select('hero_image_src, hero_image_alt')
    .eq('id', globalDestinationId)
    .maybeSingle()

  // 5. Parallel fetch: hotels, cards, pricing
  const [hotelsPayload, cardsPayload, pricingRows] = await Promise.all([
    fetchHotels(db, engagementId, destinationId, effectiveUrlSlug),
    fetchCards(db, engagementId, globalDestinationId, effectiveUrlSlug),
    fetchPricingRows(db, destinationRowId),
  ])

  return {
    destTemplate,
    destRow,
    globalHero:          globalHero ?? null,
    destinationId,
    globalDestinationId,
    destinationRowId,
    destinationUrlSlug:  effectiveUrlSlug,
    isVariant,
    hotels:              hotelsPayload,
    cards:               cardsPayload,
    pricingRows,
  }
}

// ── Hotels ────────────────────────────────────────────────────────────────────

async function fetchHotels(
  db:            SupabaseClient,
  engagementId:  string,
  destinationId: string,
  urlSlug:       string | null,
) {
  // Check for regions
  const { data: regions } = await db
    .from('travel_destination_regions')
    .select('id, slug, title, shorthand, hero_image_src, hero_image_alt, region_gallery')
    .eq('destination_id', destinationId)
    .eq('is_active', true)

  if ((regions?.length ?? 0) > 0) {
    return { kind: 'regioned', regions: await fetchRegionGroups(db, engagementId, regions!, urlSlug) }
  }

  return { kind: 'flat', hotels: await fetchFlatHotels(db, engagementId, destinationId, urlSlug) }
}

async function fetchFlatHotels(
  db:            SupabaseClient,
  engagementId:  string,
  destinationId: string,
  urlSlug:       string | null,
) {
  const { data } = await db
    .from('travel_overlay_engagement_destination_hotels')
    .select(`
      id, hotel_id, rank, rank_label, bullets,
      stay_label, sort_order, resort_map_src,
      travel_accom_hotels (
        id, name, short_slug,
        hero_image_src, hero_image_alt, image_credit,
        bullets, michelin_keys
      )
    `)
    .eq('engagement_id', engagementId)
    .eq('destination_id', destinationId)
    .eq('is_active', true)
    .order('sort_order')

  if (!data?.length) return []

  const hotelIds = data
    .map(r => (r.travel_accom_hotels as unknown as Record<string, unknown> | null)?.id as string | undefined)
    .filter((x): x is string => !!x)

  const [roomsByHotel, galleryByHotel] = await Promise.all([
    fetchRoomsForHotels(db, engagementId, hotelIds, urlSlug),
    fetchHotelGallery(db, engagementId, hotelIds),
  ])

  return data.map(r => buildHotelOption(r, roomsByHotel, galleryByHotel))
}

async function fetchRegionGroups(
  db:            SupabaseClient,
  engagementId:  string,
  regions:       Record<string, unknown>[],
  urlSlug:       string | null,
) {
  const regionIds = regions.map(r => r.id as string)

  const [tripRegionsRes, regionHotelsRes] = await Promise.all([
    db.from('travel_overlay_engagement_regions')
      .select('region_id, rank, rank_label, bullets, stay_label, sort_order')
      .eq('engagement_id', engagementId)
      .eq('is_active', true)
      .in('region_id', regionIds),
    db.from('travel_overlay_engagement_region_hotels')
      .select(`
        id, region_id, hotel_id, rank, rank_label, bullets,
        stay_label, sort_order,
        travel_accom_hotels (
          id, name, short_slug,
          hero_image_src, hero_image_alt, image_credit,
          bullets, michelin_keys
        )
      `)
      .eq('engagement_id', engagementId)
      .eq('is_active', true)
      .in('region_id', regionIds)
      .order('sort_order'),
  ])

  const hotelRows = regionHotelsRes.data ?? []
  const hotelIds  = hotelRows
    .map(r => (r.travel_accom_hotels as unknown as Record<string, unknown> | null)?.id as string | undefined)
    .filter((x): x is string => !!x)

  const [roomsByHotel, galleryByHotel] = await Promise.all([
    fetchRoomsForHotels(db, engagementId, hotelIds, urlSlug),
    fetchHotelGallery(db, engagementId, hotelIds),
  ])

  const hotelsByRegion = new Map<string, unknown[]>()
  for (const r of hotelRows) {
    const regionId = r.region_id as string
    if (!hotelsByRegion.has(regionId)) hotelsByRegion.set(regionId, [])
    hotelsByRegion.get(regionId)!.push(buildHotelOption(r, roomsByHotel, galleryByHotel))
  }

  const tripRegionMap = new Map<string, Record<string, unknown>>()
  for (const tr of (tripRegionsRes.data ?? [])) {
    tripRegionMap.set(tr.region_id as string, tr as Record<string, unknown>)
  }

  return regions
    .map(region => ({
      ...region,
      tripRegion: tripRegionMap.get(region.id as string) ?? null,
      hotels:     hotelsByRegion.get(region.id as string) ?? [],
    }))
    .sort((a, b) => {
      const sa = (a.tripRegion as Record<string, unknown> | null)?.sort_order as number ?? 99
      const sb = (b.tripRegion as Record<string, unknown> | null)?.sort_order as number ?? 99
      return sa - sb
    })
}

function buildHotelOption(
  r: Record<string, unknown>,
  roomsByHotel: Record<string, unknown[]>,
  galleryByHotel: Record<string, string[]>,
) {
  const h = r.travel_accom_hotels as unknown as Record<string, unknown> | null
  const hotelId        = (h?.id ?? r.hotel_id) as string
  const overlayBullets = r.bullets as string[] | null
  const canonBullets   = Array.isArray(h?.bullets) ? h!.bullets as string[] : []
  return {
    id:           hotelId,
    storageSlug:  (h?.short_slug ?? '') as string,
    rank:         r.rank ?? 'primary',
    rankLabel:    r.rank_label ?? '',
    name:         (h?.name ?? '') as string,
    bullets:      overlayBullets ?? canonBullets,
    imageSrc:     h?.hero_image_src ?? null,
    imageAlt:     h?.hero_image_alt ?? '',
    imageCredit:  h?.image_credit   ?? null,
    stayLabel:    r.stay_label ?? '',
    resortMapSrc: r.resort_map_src ?? null,
    michelinKeys: h?.michelin_keys ?? null,
    rooms:        roomsByHotel[hotelId]   ?? [],
    gallery:      galleryByHotel[hotelId] ?? [],
  }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

async function fetchRoomsForHotels(
  db:            SupabaseClient,
  engagementId:  string,
  hotelIds:      string[],
  urlSlug:       string | null,
): Promise<Record<string, unknown[]>> {
  if (!hotelIds.length) return {}

  const { data: canonRooms } = await db
    .from('travel_accom_rooms')
    .select(`
      id, hotel_id, room_name, room_benefits,
      room_image_src, room_image_alt, room_gallery,
      floorplan_src, sqft_min, sqft_max, sqm_min, sqm_max,
      rate_suffix, sort_order, bedding_configurations
    `)
    .in('hotel_id', hotelIds)
    .order('sort_order')

  if (!canonRooms?.length) return {}

  const canonIds  = canonRooms.map(r => r.id as string)
  const canonById = new Map<string, Record<string, unknown>>()
  for (const c of canonRooms) canonById.set(c.id as string, c as Record<string, unknown>)

  let overlayQ = db
    .from('travel_overlay_rooms')
    .select(`
      id, connected_overlay_id, room_id,
      level_label, room_name_override, room_basis, room_benefits,
      room_inclusions, hero_image_src_override, floorplan_src_override,
      public_nightly_rate, non_negotiated_nightly_rate, ambience_nightly_rate,
      tax_inclusive, rate_suffix_override,
      rate_cadence_id, travel_rate_cadences ( label ),
      tax_treatment_id, travel_tax_treatments (label ),
      room_alert, room_alert_level,
      sqft_min, sqft_max, sqm_min, sqm_max,
      sqft_min_override, sqft_max_override, sqm_min_override, sqm_max_override,
      sort_order, bedding_type
    `)
    .eq('engagement_id', engagementId)
    .eq('is_active', true)
    .in('room_id', canonIds)
    .order('sort_order')

  if (urlSlug) {
    overlayQ = overlayQ.or(`destination_url_slug.eq.${urlSlug},destination_url_slug.is.null`)
  }

  const { data: overlayRooms } = await overlayQ
  if (!overlayRooms?.length) return {}

  const [galleryByRoom, connectionByRoom] = await Promise.all([
    fetchRoomGallery(db, canonIds),
    fetchRoomConnections(db, canonIds),
  ])

  const grouped: Record<string, unknown[]> = {}
  for (const o of overlayRooms) {
    const canon = canonById.get(o.room_id as string)
    if (!canon) continue

    const hotelId   = canon.hotel_id as string
    const roomBenefits = Array.isArray(o.room_benefits) && (o.room_benefits as string[]).length > 0
      ? o.room_benefits as string[]
      : Array.isArray(canon.room_benefits) ? canon.room_benefits as string[] : []

    const galleryCanon  = galleryByRoom[canon.id as string] ?? []
    const galleryJsonb  = Array.isArray(canon.room_gallery) ? canon.room_gallery as string[] : []
    const roomGallery   = galleryCanon.length > 0 ? galleryCanon : galleryJsonb

    const cadenceJoin  = (o as Record<string, unknown>).travel_rate_cadences as { label: string | null } | null
    const taxJoin      = (o as Record<string, unknown>).travel_tax_treatments as { label: string | null } | null
    const connection   = connectionByRoom[canon.id as string]

    if (!grouped[hotelId]) grouped[hotelId] = []
    grouped[hotelId].push({
      tierLabel:                o.level_label ?? '',
      levelLabel:               o.room_name_override ?? canon.room_name ?? '',
      roomBasis:                o.room_basis ?? '',
      roomBenefits,
      roomImageSrc:             o.hero_image_src_override ?? canon.room_image_src ?? null,
      roomImageAlt:             canon.room_image_alt ?? '',
      roomGallery,
      floorplanSrc:             o.floorplan_src_override ?? canon.floorplan_src ?? null,
      publicNightlyRate:        o.public_nightly_rate         ?? null,
      nonNegotiatedNightlyRate: o.non_negotiated_nightly_rate ?? null,
      ambienceNightlyRate:      o.ambience_nightly_rate       ?? null,
      taxInclusive:             o.tax_inclusive               ?? false,
      rateSuffix:               o.rate_suffix_override ?? canon.rate_suffix ?? null,
      rateCadence:              cadenceJoin?.label ?? null,
      taxTreatment:             taxJoin?.label     ?? null,
      roomAlert:                o.room_alert       ?? null,
      roomAlertLevel:           o.room_alert_level ?? null,
      roomId:                   canon.id as string,
      overlayId:                o.id as string,
      connectedOverlayId:       o.connected_overlay_id ?? null,
      connectedRoomId:          connection?.partnerId ?? null,
      connectingNote:           o.connected_overlay_id ? (connection?.note ?? null) : null,
      sqftMin: o.sqft_min_override ?? canon.sqft_min ?? o.sqft_min ?? null,
      sqftMax: o.sqft_max_override ?? canon.sqft_max ?? o.sqft_max ?? null,
      sqmMin:  o.sqm_min_override  ?? canon.sqm_min  ?? o.sqm_min  ?? null,
      sqmMax:  o.sqm_max_override  ?? canon.sqm_max  ?? o.sqm_max  ?? null,
      beddingConfigurations: Array.isArray(canon.bedding_configurations) ? canon.bedding_configurations : null,
    })
  }

  return grouped
}

async function fetchHotelGallery(
  db:        SupabaseClient,
  engId:     string,
  hotelIds:  string[],
): Promise<Record<string, string[]>> {
  if (!hotelIds.length) return {}

  const [canonRes, overlayRes] = await Promise.all([
    db.from('travel_accom_hotel_gallery')
      .select('accom_hotel_id, sort_order, image_src')
      .in('accom_hotel_id', hotelIds)
      .order('sort_order'),
    db.from('travel_overlay_engagement_hotel_gallery_overrides')
      .select('accom_hotel_id, sort_order, image_src')
      .eq('engagement_id', engId)
      .in('accom_hotel_id', hotelIds),
  ])

  const overlayBySlot = new Map<string, string>()
  for (const o of (overlayRes.data ?? [])) {
    overlayBySlot.set(`${o.accom_hotel_id}::${o.sort_order}`, o.image_src as string)
  }

  const grouped: Record<string, string[]> = {}
  for (const r of (canonRes.data ?? [])) {
    const hotelId = r.accom_hotel_id as string
    const slotKey = `${hotelId}::${r.sort_order}`
    const src     = overlayBySlot.get(slotKey) ?? (r.image_src as string)
    if (!grouped[hotelId]) grouped[hotelId] = []
    grouped[hotelId].push(src)
  }
  return grouped
}

async function fetchRoomGallery(
  db:      SupabaseClient,
  roomIds: string[],
): Promise<Record<string, string[]>> {
  if (!roomIds.length) return {}
  const { data } = await db
    .from('travel_accom_room_gallery')
    .select('accom_room_id, image_src')
    .in('accom_room_id', roomIds)
    .order('sort_order')
  const grouped: Record<string, string[]> = {}
  for (const r of (data ?? [])) {
    const k = r.accom_room_id as string
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(r.image_src as string)
  }
  return grouped
}

async function fetchRoomConnections(
  db:      SupabaseClient,
  roomIds: string[],
): Promise<Record<string, { partnerId: string; note?: string }>> {
  if (!roomIds.length) return {}
  const [aRes, bRes] = await Promise.all([
    db.from('travel_accom_room_connections').select('room_a_id, room_b_id, notes').in('room_a_id', roomIds),
    db.from('travel_accom_room_connections').select('room_a_id, room_b_id, notes').in('room_b_id', roomIds),
  ])
  const map: Record<string, { partnerId: string; note?: string }> = {}
  for (const r of [...(aRes.data ?? []), ...(bRes.data ?? [])]) {
    const a = r.room_a_id as string, b = r.room_b_id as string
    const note = (r.notes as string | null) ?? undefined
    if (!map[a]) map[a] = { partnerId: b, note }
    if (!map[b]) map[b] = { partnerId: a, note }
  }
  return map
}

// ── Cards ─────────────────────────────────────────────────────────────────────

async function fetchCards(
  db:                  SupabaseClient,
  engagementId:        string,
  globalDestinationId: string,
  urlSlug:             string | null,
) {
  // deno-lint-ignore no-explicit-any
  const slugFilter = (q: any) =>
    urlSlug ? q.eq('destination_url_slug', urlSlug) : q.is('destination_url_slug', null)

  const [diningRes, expRes] = await Promise.all([
    slugFilter(
      db.from('travel_overlay_engagement_content_card_selections')
        .select(`
          sort_order, dining_venue_id,
          travel_dining_venues!inner (
            id, global_destination_id, kicker, name, tagline, body,
            bullets_heading, bullets, image_src, image_alt,
            image_credit, image_credit_url, image_license
          )
        `)
        .eq('engagement_id', engagementId)
        .eq('is_active', true)
        .not('dining_venue_id', 'is', null)
        .eq('travel_dining_venues.global_destination_id', globalDestinationId)
        .order('sort_order')
    ),
    slugFilter(
      db.from('travel_overlay_engagement_content_card_selections')
        .select(`
          sort_order, experience_id,
          travel_experiences!inner (
            id, global_destination_id, kicker, name, tagline, body,
            bullets_heading, bullets, image_src, image_alt,
            image_credit, image_credit_url, image_license
          )
        `)
        .eq('engagement_id', engagementId)
        .eq('is_active', true)
        .not('experience_id', 'is', null)
        .eq('travel_experiences.global_destination_id', globalDestinationId)
        .order('sort_order')
    ),
  ])

  type Sel = { sort_order: number; cardType: 'dining' | 'experience'; fkId: string; canon: Record<string, unknown> }
  const selections: Sel[] = []

  for (const r of (diningRes.data ?? [])) {
    const canon = r.travel_dining_venues as unknown as Record<string, unknown> | null
    if (!canon || !r.dining_venue_id) continue
    selections.push({ sort_order: r.sort_order as number, cardType: 'dining', fkId: r.dining_venue_id as string, canon })
  }
  for (const r of (expRes.data ?? [])) {
    const canon = r.travel_experiences as unknown as Record<string, unknown> | null
    if (!canon || !r.experience_id) continue
    selections.push({ sort_order: r.sort_order as number, cardType: 'experience', fkId: r.experience_id as string, canon })
  }

  if (!selections.length) return { dining: [], experiences: [] }

  const diningIds = selections.filter(s => s.cardType === 'dining').map(s => s.fkId)
  const expIds    = selections.filter(s => s.cardType === 'experience').map(s => s.fkId)

  const overrideQueries: Promise<{ data: Record<string, unknown>[] | null }>[] = []
  if (diningIds.length) overrideQueries.push(
    db.from('travel_overlay_engagement_content_card_overrides')
      .select(`dining_venue_id, experience_id, kicker_override, name_override, tagline_override,
               body_override, bullets_heading_override, bullets_override,
               image_src_override, image_alt_override, image_credit_override,
               image_credit_url_override, image_license_override`)
      .eq('engagement_id', engagementId).eq('is_active', true).in('dining_venue_id', diningIds) as any
  )
  if (expIds.length) overrideQueries.push(
    db.from('travel_overlay_engagement_content_card_overrides')
      .select(`dining_venue_id, experience_id, kicker_override, name_override, tagline_override,
               body_override, bullets_heading_override, bullets_override,
               image_src_override, image_alt_override, image_credit_override,
               image_credit_url_override, image_license_override`)
      .eq('engagement_id', engagementId).eq('is_active', true).in('experience_id', expIds) as any
  )

  const overrideResults = await Promise.all(overrideQueries)
  const ovByDining = new Map<string, Record<string, unknown>>()
  const ovByExp    = new Map<string, Record<string, unknown>>()
  for (const res of overrideResults) {
    for (const ov of ((res as any).data ?? []) as Record<string, unknown>[]) {
      if (ov.dining_venue_id) ovByDining.set(ov.dining_venue_id as string, ov)
      if (ov.experience_id)   ovByExp.set(ov.experience_id as string, ov)
    }
  }

  selections.sort((a, b) => a.sort_order - b.sort_order)

  const cards = selections.map(s => {
    const ov  = s.cardType === 'dining' ? ovByDining.get(s.fkId) : ovByExp.get(s.fkId)
    const r   = s.canon
    const bulletsOv    = ov?.bullets_override
    const bulletsCanon = Array.isArray(r.bullets) ? r.bullets as string[] : null
    return {
      _cardType:      s.cardType,
      id:             r.id,
      kicker:         ov?.kicker_override           ?? r.kicker          ?? '',
      name:           ov?.name_override             ?? r.name            ?? '',
      tagline:        ov?.tagline_override          ?? r.tagline         ?? '',
      body:           ov?.body_override             ?? r.body            ?? '',
      bulletsHeading: ov?.bullets_heading_override  ?? r.bullets_heading ?? '',
      bullets:        Array.isArray(bulletsOv) ? bulletsOv as string[] : bulletsCanon ?? undefined,
      imageSrc:       ov?.image_src_override        ?? r.image_src       ?? null,
      imageAlt:       ov?.image_alt_override        ?? r.image_alt       ?? '',
      imageCredit:    ov?.image_credit_override     ?? r.image_credit    ?? null,
      imageCreditUrl: ov?.image_credit_url_override ?? r.image_credit_url ?? null,
      imageLicense:   ov?.image_license_override    ?? r.image_license   ?? null,
    }
  })

  return {
    dining:      cards.filter(c => c._cardType === 'dining').map(({ _cardType, ...c }) => c),
    experiences: cards.filter(c => c._cardType === 'experience').map(({ _cardType, ...c }) => c),
  }
}

// ── Pricing ───────────────────────────────────────────────────────────────────

async function fetchPricingRows(
  db:                   SupabaseClient,
  destinationRowId: string,
) {
  const { data } = await db
    .from('travel_overlay_destination_pricing_rows')
    .select('id, item, basis, stay, indicative_range, sort_order')
    .eq('destination_row_id', destinationRowId)
    .order('sort_order')
  return (data ?? []).map(r => ({
    id:              r.id,
    item:            r.item             ?? '',
    basis:           r.basis            ?? '',
    stay:            r.stay             ?? '',
    indicativeRange: r.indicative_range ?? '',
    isTotal:         false,
  }))
}