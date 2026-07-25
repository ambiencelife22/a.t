// travel-admin-guides - admin CRUD for the four guide variants
// (dining / experiences / hotels / shopping): venues, guides (overlays), grants,
// plus dining JSON ingest. Admin-gated. Variant-parameterised: the variant maps
// to its tables server-side. All writes snakeize camel payloads at the boundary.
//
// Table maps absorb two live inconsistencies (normalization is a separate
// migration, tracked in the gatekeeper):
//   - venue tables are unevenly named (travel_experiences, travel_shopping)
//   - hotels key destinations via destination_id, not global_destination_id
import { requireAdmin } from '../_shared/auth.ts'
import { snakeizeKeys } from '../_shared/camelize.ts'
import { json, preflight } from '../_shared/http.ts'

const GUIDE_TABLE: Record<string, string> = {
  dining:      'travel_dining_guides',
  experiences: 'travel_experiences_guides',
  hotels:      'travel_hotel_guides',
  shopping:    'travel_shopping_guides',
}
const VENUE_TABLE: Record<string, string> = {
  dining:      'travel_dining_venues',
  experiences: 'travel_experiences',
  hotels:      'travel_accom_hotels',
  shopping:    'travel_shopping',
}
// Column on the venue table that holds the destination UUID.
const VENUE_DEST_COL: Record<string, string> = {
  hotels: 'destination_id',
}
const GRANT_TABLE: Record<string, string> = {
  dining:      'travel_dining_guide_grants',
  experiences: 'travel_experiences_guide_grants',
}
const GUIDE_FIELDS = 'id, global_destination_id, hero_image_src, hero_image_alt, eyebrow_override, headline_override, intro_override, is_active, accuracy_date, at_a_glance_bullets, guide_year, guide_version, plan_your_visit_heading, plan_your_visit_intro, plan_your_visit_bullets'
const DINING_VENUE_FIELDS = 'id, global_destination_id, name, cuisine_subcategory, kicker, tagline, body, bullets_heading, bullets, michelin_award, michelin_stars, michelin_green_star, worlds_50_best, address, maps_url, website, neighborhood, price_band, public_preview_rank, tags, image_src, image_alt, image_credit, image_credit_url, image_license, image_2_src, image_2_alt, is_active, sort_order'
const EXP_VENUE_FIELDS = 'id, global_destination_id, name, kicker, tagline, body, bullets_heading, bullets, address, maps_url, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order'
const HOTEL_VENUE_FIELDS = 'id, destination_id, name, short_slug, hero_image_src, hero_image_alt, bullets, sort_order, is_active, is_preferred_partner, is_supplementary, stars, michelin_keys, forbes_rating, description, internal_notes, address, city, zip_code, latitude, longitude, google_maps_url, website, phone, reservations_phone, main_email, reservations_email, sales_email, concierge_email, guest_relations_email, front_office_email, image_credit, image_credit_url, image_license'
const SHOP_VENUE_FIELDS = 'id, global_destination_id, name, brand, shop_type, tagline, body, bullets, address, maps_url, by_appointment, image_src, image_alt, image_credit, image_credit_url, image_license, is_active, sort_order'
const VENUE_FIELDS: Record<string, string> = {
  dining:      DINING_VENUE_FIELDS,
  experiences: EXP_VENUE_FIELDS,
  hotels:      HOTEL_VENUE_FIELDS,
  shopping:    SHOP_VENUE_FIELDS,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  try {
    const gate = await requireAdmin(req)
    if (!gate.ok) return gate.response
    const db = gate.serviceClient

    const body = await req.json().catch(() => ({}))
    const mode = body.mode as string | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)
    const variant = body.variant as string | undefined
    const destCol = (variant && VENUE_DEST_COL[variant]) ? VENUE_DEST_COL[variant] : 'global_destination_id'

    if (mode === 'destination_options') {
      const { data, error } = await db.from('global_destinations').select('id, slug, name').order('name', { ascending: true })
      if (error) return json({ error: 'Failed to fetch destinations' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'destinations_with_counts') {
      const venueTable = VENUE_TABLE[variant!]
      const guideTable = GUIDE_TABLE[variant!]
      if (!venueTable || !guideTable) return json({ error: 'Unknown variant' }, 400)
      const [venuesRes, guidesRes] = await Promise.all([
        db.from(venueTable).select(destCol).eq('is_active', true),
        db.from(guideTable).select('global_destination_id'),
      ])
      if (venuesRes.error) return json({ error: 'Failed to fetch venues' }, 500)
      if (guidesRes.error) return json({ error: 'Failed to fetch guides' }, 500)
      const countByDest = new Map<string, number>()
      for (const v of venuesRes.data ?? []) {
        const id = (v as unknown as Record<string, unknown>)[destCol] as string
        if (!id) continue
        countByDest.set(id, (countByDest.get(id) ?? 0) + 1)
      }
      const overlaySet = new Set<string>((guidesRes.data ?? []).map((g) => (g as { global_destination_id: string }).global_destination_id))
      const rows = Array.from(countByDest.entries()).map(([id, count]) => ({ id, count, hasOverlay: overlaySet.has(id) }))
      return json({ rows })
    }

    if (mode === 'venues') {
      const venueTable = VENUE_TABLE[variant!]
      if (!venueTable) return json({ error: 'Unknown variant' }, 400)
      let q = db.from(venueTable).select(VENUE_FIELDS[variant!]).order('sort_order', { ascending: true })
      if (body.destination_id) q = q.eq(destCol, body.destination_id)
      const { data, error } = await q
      if (error) return json({ error: 'Failed to fetch venues' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'guides') {
      const guideTable = GUIDE_TABLE[variant!]
      if (!guideTable) return json({ error: 'Unknown variant' }, 400)
      const { data, error } = await db.from(guideTable).select(GUIDE_FIELDS)
      if (error) return json({ error: 'Failed to fetch guides' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'venue_update') {
      const venueTable = VENUE_TABLE[variant!]
      if (!venueTable) return json({ error: 'Unknown variant' }, 400)
      const patch = snakeizeKeys<Record<string, unknown>>(body.patch ?? {})
      delete patch.id
      const { error } = await db.from(venueTable).update(patch).eq('id', body.id)
      if (error) return json({ error: 'Failed to update venue' }, 500)
      return json({ success: true })
    }

    if (mode === 'venue_delete') {
      const venueTable = VENUE_TABLE[variant!]
      if (!venueTable) return json({ error: 'Unknown variant' }, 400)
      const { error } = await db.from(venueTable).delete().eq('id', body.id)
      if (error) return json({ error: 'Failed to delete venue' }, 500)
      return json({ success: true })
    }

    if (mode === 'guide_update') {
      const guideTable = GUIDE_TABLE[variant!]
      if (!guideTable) return json({ error: 'Unknown variant' }, 400)
      const patch = snakeizeKeys<Record<string, unknown>>(body.patch ?? {})
      delete patch.id; delete patch.global_destination_id
      const { error } = await db.from(guideTable).update(patch).eq('id', body.id)
      if (error) return json({ error: 'Failed to update guide' }, 500)
      return json({ success: true })
    }

    if (mode === 'guide_create') {
      const guideTable = GUIDE_TABLE[variant!]
      if (!guideTable) return json({ error: 'Unknown variant' }, 400)
      const { data, error } = await db.from(guideTable).insert({ global_destination_id: body.global_destination_id, is_active: true }).select('id').single()
      if (error) return json({ error: 'Failed to create guide' }, 500)
      return json({ id: data.id })
    }

    if (mode === 'guide_delete') {
      const guideTable = GUIDE_TABLE[variant!]
      if (!guideTable) return json({ error: 'Unknown variant' }, 400)
      const { error } = await db.from(guideTable).delete().eq('id', body.id)
      if (error) return json({ error: 'Failed to delete guide' }, 500)
      return json({ success: true })
    }

    if (mode === 'grants') {
      const grantTable = GRANT_TABLE[variant!]
      if (!grantTable) return json({ error: 'Variant has no grants' }, 400)
      const sel = 'id, user_id, global_destination_id, granted_at, profile:global_profiles!user_id(person_id)'
      const { data, error } = await db.from(grantTable).select(sel).eq('global_destination_id', body.global_destination_id).order('granted_at', { ascending: true })
      if (error) return json({ error: 'Failed to fetch grants' }, 500)
      return json({ rows: data ?? [] })
    }

    if (mode === 'grant_create') {
      const grantTable = GRANT_TABLE[variant!]
      if (!grantTable) return json({ error: 'Variant has no grants' }, 400)
      const { error } = await db.from(grantTable).insert({ user_id: body.user_id, global_destination_id: body.global_destination_id })
      if (error) return json({ error: 'Failed to create grant' }, 500)
      return json({ success: true })
    }

    if (mode === 'grant_delete') {
      const grantTable = GRANT_TABLE[variant!]
      if (!grantTable) return json({ error: 'Variant has no grants' }, 400)
      const { error } = await db.from(grantTable).delete().eq('id', body.id)
      if (error) return json({ error: 'Failed to delete grant' }, 500)
      return json({ success: true })
    }

    if (mode === 'profile_by_person') {
      const { data, error } = await db.from('global_profiles').select('id').eq('person_id', body.person_id).maybeSingle()
      if (error) return json({ error: 'Failed to fetch profile' }, 500)
      return json({ row: data ?? null })
    }

    if (mode === 'ingest_dining') {
      const gdid = body.global_destination_id as string
      const existing = await db.from('travel_dining_venues').select('name').eq('global_destination_id', gdid)
      if (existing.error) return json({ error: 'pre-flight failed' }, 500)
      const existingNames = new Set((existing.data ?? []).map((r) => (r as { name: string }).name.toLowerCase().trim()))
      const maxSortRes = await db.from('travel_dining_venues').select('sort_order').eq('global_destination_id', gdid).order('sort_order', { ascending: false }).limit(1)
      if (maxSortRes.error) return json({ error: 'sort_order pre-flight failed' }, 500)
      let nextSort = ((maxSortRes.data?.[0] as { sort_order: number } | undefined)?.sort_order ?? 0) + 1
      const skipped: Array<{ name: string; reason: string }> = []
      const inserts: Array<Record<string, unknown>> = []
      const records = (body.restaurants ?? []) as Array<Record<string, unknown>>
      for (const r of records) {
        const name = (r.name as string | undefined) ?? ''
        if (name.trim().length === 0) { skipped.push({ name: '(missing)', reason: 'missing name' }); continue }
        const normalised = name.toLowerCase().trim()
        if (existingNames.has(normalised)) { skipped.push({ name, reason: 'name already exists for this destination' }); continue }
        existingNames.add(normalised)
        const tags = r.tags as string[] | undefined
        inserts.push({
          name,
          global_destination_id: gdid,
          sort_order:            nextSort++,
          is_active:             true,
          cuisine_subcategory:   (r.subCategory as string | undefined) ?? null,
          address:               (r.address as string | undefined) ?? null,
          website:               (r.website as string | undefined) ?? null,
          body:                  (r.description as string | undefined) ?? null,
          tags:                  tags && tags.length > 0 ? tags : null,
        })
      }
      if (inserts.length === 0) return json({ inserted: 0, skipped })
      const { error } = await db.from('travel_dining_venues').insert(inserts)
      if (error) return json({ error: 'Insert failed' }, 500)
      return json({ inserted: inserts.length, skipped })
    }

    return json({ error: 'Unknown mode: ' + mode }, 400)
  } catch (err) {
    console.error('travel-admin-guides unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})