// supabase/functions/travel-write-engagement/index.ts
//
// Edge Function: travel-write-engagement
// Class A — admin-only. Single source for all admin-side engagement WRITES.
// Write mirror of travel-read-engagement-admin (S54).
//
// Security model (identical to the read mirror):
//   - JWT REQUIRED — verify_jwt = true (Supabase platform-level gate)
//   - Caller must be authenticated (valid JWT in Authorization header)
//   - Caller must be an admin (global_profiles.is_admin = true)
//   - Writes execute via service role to bypass RLS uniformly
//   - SERVICE_ROLE_KEY (canon S66F; read mirror verified clean S54).
//
// Request body:
//   { mode: WriteMode, ...mode-specific params }
//
// Modes:
//   create_engagement     — insert a proposal-stage engagement      → { row }
//   update_engagement     — partial scalar update by id             → { row }
//   set_engagement_status — set engagement_status by slug (absorbs  → { row }
//                           "promote": promotion is just advancing
//                           this independent axis; no trip side effect)
//   set_itinerary_status  — set itinerary_status by slug            → { row }
//   reorder               — batch [{id, sort_order}]                → { updated }
//   set_visibility        — toggle public_view (the live show/hide  → { row }
//                           gate; NOT is_public / is_public_template)
//   update_welcome_letter — update the singleton welcome letter     → { row }
//   archive               — REVERSIBLE: engagement_status -> chosen  → { row }
//                           terminal slug (cancelled|lost), itinerary
//                           -> archived. Content preserved; reactivatable.
//   delete_engagement     — HARD delete, financial-guarded. Refuses   → { deleted }
//                           (409) if any booking / time_entry / request
//                           exists (Retention Spec v1). 12 travel_immerse_*
//                           content tables cascade; records are protected.
//
// Design notes:
//   - The two status axes are INDEPENDENT. Engagement status (commercial:
//     new_request..completed) and itinerary status (content maturity:
//     draft..confirmed) move on separate clocks; neither gates the other.
//     So there is no composite "promote" — it is set_engagement_status.
//   - Status params are SLUGS (human-readable); the EF resolves slug -> id
//     against the lookup tables. Callers never pass status uuids.
//   - url_id is an 11-char access token with a UNIQUE constraint; create
//     generates and retries on collision.
//   - Archive (reversible) and Delete (irreversible) are DISTINCT operations,
//     both gated through this EF. Delete refuses while financial/operational
//     records exist; those engagements archive instead. Full retention
//     (global_retained_records: snapshot-then-delete + GDPR pseudonymization)
//     is specced separately and supersedes the guard when built.
//
// Deployed at: /functions/v1/travel-write-engagement
// First ship: S54 (this file)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type WriteMode =
  | 'create_engagement'
  | 'update_engagement'
  | 'set_engagement_status'
  | 'set_itinerary_status'
  | 'reorder'
  | 'set_visibility'
  | 'update_welcome_letter'
  | 'archive'
  | 'delete_engagement'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Scalar fields a caller may set on create/update. Deliberately EXCLUDES:
//   id, url_id, sort_order, created_at, updated_at (managed),
//   engagement_status_id, itinerary_status_id (own modes),
//   public_view, is_public, is_public_template (visibility mode / separate).
const EDITABLE_SCALARS = [
  'title', 'audience', 'engagement_type', 'trip_format', 'journey_types',
  'iteration_label', 'trip_id', 'person_id', 'slug', 'status_label',
  'eyebrow', 'hero_tagline', 'subtitle',
  'hero_image_src', 'hero_image_alt', 'hero_image_src_2', 'hero_image_alt_2',
  'hero_title_2', 'hero_subtitle_2', 'hero_pills', 'hero_eyebrow_override',
  'welcome_eyebrow_override', 'welcome_title_override', 'welcome_body_override',
  'welcome_signoff_body_override', 'welcome_signoff_name_override',
  'route_heading', 'route_body', 'route_eyebrow',
  'destination_heading', 'destination_subtitle', 'destination_body',
  'pricing_heading', 'pricing_title', 'pricing_body',
  'pricing_total_label', 'pricing_total_value',
  'pricing_notes_heading', 'pricing_notes_title', 'pricing_notes',
  'public_journey_slug',
] as const

const WELCOME_LETTER_FIELDS = [
  'eyebrow', 'title', 'body', 'signoff_body', 'signoff_name',
] as const

// No-ambiguous-chars set (excludes I, O, l, 0, 1) — url_ids are client-facing
// access tokens, often read aloud or typed from a screenshot. Mirrors the
// original client generateUrlId alphabet (preserved when generation moved
// server-side S54).
const URL_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

function generateUrlId(): string {
  let out = ''
  const bytes = new Uint8Array(11)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 11; i++) out += URL_ID_ALPHABET[bytes[i] % URL_ID_ALPHABET.length]
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as WriteMode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    // ── 2. Verify caller is authenticated ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

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

    // ── Helpers (closure over serviceClient) ─────────────────────────────────

    // Resolve an engagement status slug -> id. Returns null if not found.
    // (const arrow expressions, not function declarations, so they may close
    //  over the request-scoped serviceClient without tripping no-inner-declarations.)
    const engagementStatusId = async (slug: string): Promise<string | null> => {
      const { data } = await serviceClient
        .from('travel_engagement_statuses').select('id').eq('slug', slug).maybeSingle()
      return data?.id ?? null
    }

    const itineraryStatusId = async (slug: string): Promise<string | null> => {
      const { data } = await serviceClient
        .from('travel_itinerary_statuses').select('id').eq('slug', slug).maybeSingle()
      return data?.id ?? null
    }

    // Pick only whitelisted scalar keys from an input object.
    const pickEditable = (src: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {}
      for (const k of EDITABLE_SCALARS) {
        if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k]
      }
      return out
    }

    // Return the full engagement row by id (post-write echo).
    const rowById = async (id: string) => {
      const { data } = await serviceClient
        .from('travel_immerse_engagements').select('*').eq('id', id).maybeSingle()
      return data ?? null
    }

    // ── 4. Mode dispatch ─────────────────────────────────────────────────────

    if (mode === 'create_engagement') {
      const input = (body?.engagement as Record<string, unknown>) ?? {}

      // Seed statuses (verified S54): new_request / draft.
      const engStatusSlug = (body?.engagement_status_slug as string) ?? 'new_request'
      const itinStatusSlug = (body?.itinerary_status_slug as string) ?? 'draft'
      const [engId, itinId] = await Promise.all([
        engagementStatusId(engStatusSlug),
        itineraryStatusId(itinStatusSlug),
      ])
      if (!engId)  return json({ error: `Unknown engagement status: ${engStatusSlug}` }, 400)
      if (!itinId) return json({ error: `Unknown itinerary status: ${itinStatusSlug}` }, 400)

      // next sort_order
      const { data: maxRow } = await serviceClient
        .from('travel_immerse_engagements')
        .select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
      const nextSort = (maxRow?.sort_order ?? -1) + 1

      const base = pickEditable(input)

      // Generate a unique url_id, retry on collision (UNIQUE constraint).
      let lastErr: unknown = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateUrlId()
        const { data, error } = await serviceClient
          .from('travel_immerse_engagements')
          .insert({
            ...base,
            url_id:               candidate,
            engagement_status_id: engId,
            itinerary_status_id:  itinId,
            sort_order:           nextSort,
          })
          .select('*')
          .single()

        if (!error && data) return json({ row: data })

        // 23505 = unique_violation; only retry if it's the url_id collision.
        if (error && (error as { code?: string }).code === '23505') { lastErr = error; continue }
        console.error('create_engagement error:', error)
        return json({ error: 'Failed to create engagement' }, 500)
      }
      console.error('create_engagement url_id collision exhausted:', lastErr)
      return json({ error: 'Failed to allocate url_id' }, 500)
    }

    if (mode === 'update_engagement') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)
      const patch = pickEditable((body?.patch as Record<string, unknown>) ?? {})
      if (Object.keys(patch).length === 0) return json({ row: await rowById(id) })

      const { error } = await serviceClient
        .from('travel_immerse_engagements').update(patch).eq('id', id)
      if (error) {
        console.error('update_engagement error:', error)
        return json({ error: 'Failed to update engagement' }, 500)
      }
      return json({ row: await rowById(id) })
    }

    if (mode === 'set_engagement_status') {
      const id = body?.id as string | undefined
      const slug = body?.slug as string | undefined
      if (!id || !slug) return json({ error: 'id and slug are required' }, 400)
      const statusId = await engagementStatusId(slug)
      if (!statusId) return json({ error: `Unknown engagement status: ${slug}` }, 400)

      const { error } = await serviceClient
        .from('travel_immerse_engagements')
        .update({ engagement_status_id: statusId }).eq('id', id)
      if (error) {
        console.error('set_engagement_status error:', error)
        return json({ error: 'Failed to set engagement status' }, 500)
      }
      return json({ row: await rowById(id) })
    }

    if (mode === 'set_itinerary_status') {
      const id = body?.id as string | undefined
      const slug = body?.slug as string | undefined
      if (!id || !slug) return json({ error: 'id and slug are required' }, 400)
      const statusId = await itineraryStatusId(slug)
      if (!statusId) return json({ error: `Unknown itinerary status: ${slug}` }, 400)

      const { error } = await serviceClient
        .from('travel_immerse_engagements')
        .update({ itinerary_status_id: statusId }).eq('id', id)
      if (error) {
        console.error('set_itinerary_status error:', error)
        return json({ error: 'Failed to set itinerary status' }, 500)
      }
      return json({ row: await rowById(id) })
    }

    if (mode === 'reorder') {
      const items = body?.items as Array<{ id: string; sort_order: number }> | undefined
      if (!Array.isArray(items) || items.length === 0) {
        return json({ error: 'items array is required' }, 400)
      }
      // Sequential updates; small N (admin reorder). Each is a single-column write.
      let updated = 0
      for (const it of items) {
        if (!it?.id || typeof it.sort_order !== 'number') continue
        const { error } = await serviceClient
          .from('travel_immerse_engagements')
          .update({ sort_order: it.sort_order }).eq('id', it.id)
        if (error) {
          console.error('reorder error on', it.id, error)
          return json({ error: `Failed to reorder at ${it.id}` }, 500)
        }
        updated++
      }
      return json({ updated })
    }

    if (mode === 'set_visibility') {
      const id = body?.id as string | undefined
      const publicView = body?.public_view
      if (!id || typeof publicView !== 'boolean') {
        return json({ error: 'id and public_view (boolean) are required' }, 400)
      }
      const { error } = await serviceClient
        .from('travel_immerse_engagements')
        .update({ public_view: publicView }).eq('id', id)
      if (error) {
        console.error('set_visibility error:', error)
        return json({ error: 'Failed to set visibility' }, 500)
      }
      return json({ row: await rowById(id) })
    }

    if (mode === 'update_welcome_letter') {
      const patchIn = (body?.patch as Record<string, unknown>) ?? {}
      const patch: Record<string, unknown> = {}
      for (const k of WELCOME_LETTER_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(patchIn, k)) patch[k] = patchIn[k]
      }
      if (Object.keys(patch).length === 0) return json({ error: 'no welcome letter fields to update' }, 400)

      // Singleton: update the single existing row. Fetch its id first.
      const { data: existing, error: fetchErr } = await serviceClient
        .from('travel_immerse_welcome_letter').select('id').limit(1).maybeSingle()
      if (fetchErr || !existing) {
        console.error('update_welcome_letter fetch error:', fetchErr)
        return json({ error: 'Welcome letter row not found' }, 500)
      }
      const { data, error } = await serviceClient
        .from('travel_immerse_welcome_letter')
        .update(patch).eq('id', existing.id)
        .select('eyebrow, title, body, signoff_body, signoff_name').single()
      if (error) {
        console.error('update_welcome_letter error:', error)
        return json({ error: 'Failed to update welcome letter' }, 500)
      }
      return json({ row: data })
    }

    if (mode === 'archive') {
      const id = body?.id as string | undefined
      // terminal engagement slug: 'cancelled' | 'lost' (default cancelled)
      const terminalSlug = (body?.engagement_slug as string) ?? 'cancelled'
      if (!id) return json({ error: 'id is required' }, 400)
      if (terminalSlug !== 'cancelled' && terminalSlug !== 'lost') {
        return json({ error: `archive engagement_slug must be cancelled|lost` }, 400)
      }
      const [engId, itinId] = await Promise.all([
        engagementStatusId(terminalSlug),
        itineraryStatusId('archived'),
      ])
      if (!engId)  return json({ error: `Unknown engagement status: ${terminalSlug}` }, 400)
      if (!itinId) return json({ error: `Unknown itinerary status: archived` }, 400)

      const { error } = await serviceClient
        .from('travel_immerse_engagements')
        .update({ engagement_status_id: engId, itinerary_status_id: itinId })
        .eq('id', id)
      if (error) {
        console.error('archive error:', error)
        return json({ error: 'Failed to archive engagement' }, 500)
      }
      return json({ row: await rowById(id) })
    }

    if (mode === 'delete_engagement') {
      const id = body?.id as string | undefined
      if (!id) return json({ error: 'id is required' }, 400)

      // Mission guard (Retention Spec v1, pre-archive-table): financial and
      // operational records are NEVER destroyed. Refuse the delete if any
      // booking, time entry, or request exists for this engagement. Such
      // engagements must be ARCHIVED (reversible) until global_retained_records
      // is built to snapshot-then-delete them. Absolute rule, no exceptions.
      const [bookings, timeEntries, requests] = await Promise.all([
        serviceClient.from('travel_bookings').select('id', { count: 'exact', head: true }).eq('engagement_id', id),
        serviceClient.from('travel_time_entries').select('id', { count: 'exact', head: true }).eq('engagement_id', id),
        serviceClient.from('travel_requests').select('id', { count: 'exact', head: true }).eq('engagement_id', id),
      ])
      const nB = bookings.count ?? 0
      const nT = timeEntries.count ?? 0
      const nR = requests.count ?? 0

      if (nB > 0 || nT > 0 || nR > 0) {
        return json({
          error: 'CANNOT_DELETE_HAS_RECORDS',
          message:
            `This engagement has ${nB} booking(s), ${nT} time entr(ies), and ${nR} request(s). ` +
            `Financial and operational records can't be deleted. Archive the engagement instead.`,
          counts: { bookings: nB, time_entries: nT, requests: nR },
        }, 409)
      }

      // No financial records — safe to hard delete. The 12 travel_immerse_*
      // content tables cascade automatically (verified ON DELETE CASCADE).
      const { error } = await serviceClient
        .from('travel_immerse_engagements')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('delete_engagement error:', error)
        return json({ error: 'Failed to delete engagement' }, 500)
      }
      return json({ deleted: true, id })
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-write-engagement unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})