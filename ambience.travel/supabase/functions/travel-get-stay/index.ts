// supabase/functions/travel-get-stay/index.ts
//
// Edge Function: travel-get-stay
// Class B. Client-facing (anon allowed). Guest-facing stay portal read.
//
// PURPOSE (S53N security fix): closes a live credential-exposure hole.
// Previously ProgrammeRoute.tsx read travel_programme_* tables DIRECTLY from
// the browser and delivered the FULL payload (alarm codes, wifi password, real
// address, owner/manager phones) to un-logged-in guests, gating them only in
// the React render (show ? realValue : <GatedValue/>). The secrets sat in the
// browser network response regardless. This EF moves the redaction SERVER-SIDE:
// on the gated (anon) path the secrets are NEVER placed in the response.
//
// AUTH PATTERN (honors _shared/auth.ts + _shared/client.ts contracts):
//   - my_stays  : requires a session -> requireUser gate (rejects anon, correct).
//   - resolve   : anon allowed. Try requireUser non-fatally:
//                   * session present -> FULL access (no redaction).
//                   * anon            -> service client obtained ONLY after the
//                     stay is confirmed public (is_public=true) = the Class B
//                     "verification" the client.ts contract requires for public
//                     EFs. Anon + not-public -> access-denied.
//   Never hand-rolls an anon client (that construction is private to auth.ts).
//   The service client is constructed only after the caller is established as
//   either a verified user OR an anon viewing a public record.
//
// Auth SCOPE is unchanged from prior ProgrammeRoute behavior: any valid session
//   -> full. FOLLOW-UP (logged, NOT done here): tighten to "this stay's linked
//   guest -> full" via travel_programme_guests.profile_id. Separate change.
//
// Modes:
//   resolve   - by url_id: stay + property + sections + listings (redacted if gated)
//   my_stays  - by session: the caller's linked stays (replaces getGuestProgrammes)
//
// Tables read (current names; renamed in the later property-spine rename):
//   travel_programme_master, travel_programme_properties,
//   travel_programme_property_sections, travel_programme_property_listings,
//   travel_programme_sections, travel_programme_guests
//
// Last updated: S53N - initial build (security fix, ahead of the rename).

import { createServiceClient } from '../_shared/client.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type Mode = 'resolve' | 'my_stays'

// -- Section content block shape (JSONB) --
type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading';   text: string }
  | { type: 'note';      text: string }
  | { type: 'warning';   text: string }
  | { type: 'list';      items: string[] }
  | { type: 'wifi';      network: string; password: string }

type Section = { id: string; title: string; icon: string; content: Block[] }

// -- Redaction: strip secrets from the section list on the gated path --
// gated=true means anon viewer of a public stay. Per-field public_* flags let
// the host selectively reveal individual secrets even on the public path.
// "Entry & Keys" is withheld conservatively (physical-access detail).
function redactSections(
  sections: Section[],
  gated: boolean,
  flags: { publicWifi: boolean; publicAlarm: boolean; publicArrival: boolean; noAlarm: boolean },
): Section[] {
  if (!gated) return sections

  return sections.map(section => {
    if (section.title === 'Alarm' && !flags.publicAlarm && !flags.noAlarm) {
      return {
        ...section,
        content: [{ type: 'note', text: 'Alarm code details are available. Please ask your host.' }],
      }
    }
    if (section.title === 'Arrival' && !flags.publicArrival) {
      return {
        ...section,
        content: [
          { type: 'paragraph', text: 'On arrival, your host will greet you at street level, give you the keys, and escort you up.' },
          { type: 'note',      text: 'Please ask your host for arrival details.' },
        ],
      }
    }
    if (section.title === 'Entry & Keys') {
      return {
        ...section,
        content: [{ type: 'note', text: 'Entry and key details are available. Please ask your host.' }],
      }
    }
    const content = section.content.map(block =>
      (block.type === 'wifi' && !flags.publicWifi)
        ? { type: 'wifi' as const, network: '', password: '' }
        : block,
    )
    return { ...section, content }
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode as Mode | undefined
    if (!mode) return json({ error: 'mode is required' }, 400)

    // -- my_stays -- requires a session. requireUser is the correct gate.
    if (mode === 'my_stays') {
      const gate = await requireUser(req)
      if (!gate.ok) return json({ stays: [] }, 200) // no session -> no stays
      const { serviceClient: db, user } = gate

      const { data, error } = await db
        .from('travel_programme_guests')
        .select(`
          programme_id,
          stay:travel_programme_master!inner (
            id, url_id, programme_type, sub_path, status, guest_names,
            check_in, check_out, title, active,
            property:travel_programme_properties (
              id, name, city, country, hero_image,
              owner_name, owner_phone, manager_name, manager_phone
            )
          )
        `)
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('my_stays error:', error)
        return json({ error: 'Failed to fetch stays' }, 500)
      }

      const stays = (data ?? [])
        // deno-lint-ignore no-explicit-any
        .map((row: any) => row.stay)
        .filter((s: unknown) => s && (s as { active?: boolean }).active)
      return json({ stays }, 200)
    }

    // -- resolve -- anon allowed.
    if (mode === 'resolve') {
      const urlId = body?.url_id as string | undefined
      if (!urlId) return json({ error: 'url_id is required' }, 400)

      // Try the session gate non-fatally. Success -> verified user -> full.
      // Failure -> anon; fall through to public path (gated). Service client
      // is constructed only after confirming the stay is public.
      const gate = await requireUser(req)
      const hasSession = gate.ok
      const db = hasSession ? gate.serviceClient : createServiceClient()

      const { data: stay, error: stayErr } = await db
        .from('travel_programme_master')
        .select(`
          id, url_id, programme_type, guest_names, guest_count, check_in, check_out,
          welcome_letter, status, active, active_listing_ids, alarm_code_provided,
          is_public, public_wifi, public_alarm, public_owner_phone,
          public_manager_phone, no_alarm, public_arrival,
          property:travel_programme_properties (
            id, slug, name, tagline, city, country, hero_image, photos,
            maps_url, maps_embed_url, owner_name, owner_phone, manager_name,
            manager_phone, emergency_contacts, active
          )
        `)
        .eq('url_id', urlId)
        .single()

      if (stayErr || !stay) return json({ error: 'not-found' }, 404)
      // deno-lint-ignore no-explicit-any
      const s = stay as any

      if (!s.active || !s.property || !s.property.active) return json({ error: 'not-found' }, 404)
      if (s.programme_type !== 'stay') return json({ error: 'not-found' }, 404)

      // Access decision. Anon may only view public stays.
      const gated = !hasSession
      if (gated && !s.is_public) return json({ error: 'access-denied' }, 403)

      const propertyId = s.property.id
      const sectionVariant = s.no_alarm ? 'no_alarm' : 'default'

      const [sectRes, listRes, overrideRes] = await Promise.all([
        db.from('travel_programme_property_sections')
          .select('id, title, icon, sort_order, variant, content')
          .eq('property_id', propertyId).order('sort_order'),
        db.from('travel_programme_property_listings')
          .select('id, name, category, genre, address, website, hours, note, favourite')
          .eq('property_id', propertyId),
        db.from('travel_programme_sections')
          .select('id, section_id, content')
          .eq('programme_id', s.id),
      ])

      if (sectRes.error || listRes.error) {
        console.error('sections/listings error:', sectRes.error ?? listRes.error)
        return json({ error: 'load-failed' }, 500)
      }

      // Resolve default vs variant sections + per-stay overrides.
      // deno-lint-ignore no-explicit-any
      const allRows = (sectRes.data ?? []) as any[]
      const defaults = allRows.filter(r => r.variant === 'default')
      const variantByTitle = new Map(
        allRows.filter(r => r.variant === sectionVariant).map(r => [r.title, r]),
      )
      const resolvedBase = defaults.map(r => variantByTitle.get(r.title) ?? r)

      // deno-lint-ignore no-explicit-any
      const overrides = (overrideRes.data ?? []) as any[]
      const overrideBySection = new Map(overrides.map(o => [o.section_id, o]))

      let sections: Section[] = resolvedBase.map(r => {
        const ov = overrideBySection.get(r.id)
        return {
          id: r.id, title: r.title, icon: r.icon,
          content: (ov ? ov.content : r.content) as Block[],
        }
      })

      // -- THE WALL: redact secrets on the gated path, server-side --
      sections = redactSections(sections, gated, {
        publicWifi:    s.public_wifi,
        publicAlarm:   s.public_alarm,
        publicArrival: s.public_arrival,
        noAlarm:       s.no_alarm,
      })

      // Listings: filter to active_listing_ids if set.
      // deno-lint-ignore no-explicit-any
      let listings = (listRes.data ?? []) as any[]
      if (Array.isArray(s.active_listing_ids)) {
        listings = listings.filter(l => s.active_listing_ids.includes(l.id))
      }

      // Property phones + location: withhold on the gated path unless revealed.
      const prop = s.property
      const ownerPhone   = (!gated || s.public_owner_phone)   ? prop.owner_phone   : null
      const managerPhone = (!gated || s.public_manager_phone) ? prop.manager_phone : null
      const mapsUrl      = (!gated || s.public_arrival)       ? prop.maps_url       : null
      const mapsEmbedUrl = (!gated || s.public_arrival)       ? prop.maps_embed_url : null

      return json({
        stay: {
          id:                s.id,
          urlId:             s.url_id,
          guestNames:        s.guest_names,
          checkIn:           s.check_in,
          checkOut:          s.check_out,
          welcomeLetter:     s.welcome_letter,
          activeListingIds:  s.active_listing_ids,
          alarmCodeProvided: s.alarm_code_provided,
        },
        property: {
          id:           prop.id,
          name:         prop.name,
          tagline:      prop.tagline,
          city:         prop.city,
          country:      prop.country,
          heroImage:    prop.hero_image,
          photos:       prop.photos ?? [],
          mapsUrl,
          mapsEmbedUrl,
          ownerName:    prop.owner_name,
          ownerPhone,
          managerName:  prop.manager_name,
          managerPhone,
          emergencyContacts: prop.emergency_contacts ?? [],
        },
        sections,
        listings,
        gated,
        flags: {
          publicWifi:         s.public_wifi,
          publicAlarm:        s.public_alarm,
          publicOwnerPhone:   s.public_owner_phone,
          publicManagerPhone: s.public_manager_phone,
          noAlarm:            s.no_alarm,
          publicArrival:      s.public_arrival,
        },
      }, 200)
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-get-stay unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})