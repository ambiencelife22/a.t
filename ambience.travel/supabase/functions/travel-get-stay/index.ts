// supabase/functions/travel-get-stay/index.ts
//
// Edge Function: travel-get-stay
// Class B. Client-facing (anon allowed). Guest-facing stay portal read.
//
// PURPOSE (S53N security fix): closes a live credential-exposure hole.
// The redaction is SERVER-SIDE: on the gated (anon) path the secrets (alarm
// code, wifi password, real address, owner/manager phones) are NEVER placed in
// the response.
//
// AUTH PATTERN:
//   - my_stays  : requires a session -> requireUser gate (rejects anon).
//   - resolve   : anon allowed. Session present -> FULL. Anon -> service client
//     obtained ONLY after the stay is confirmed public (is_public=true).
//
// Modes:
//   resolve   - by url_id: stay + property + sections + listings (redacted if gated)
//   my_stays  - by session: the caller's linked stays
//
// Tables read: travel_hosted_stay, travel_hosted_property,
//   travel_hosted_property_section, travel_hosted_property_listing,
//   travel_hosted_stay_section, travel_hosted_stay_guest
//
// Last updated: hosted-stay migration - programme_* to hosted_*. Guest identity
//   profile_id to person_id. has_alarm is the inverse of the old no_alarm:
//   has_alarm=true means an alarm EXISTS (old no_alarm=true meant none exists),
//   so the alarm-gating logic is inverted. programme_type discriminator dropped
//   (every hosted_stay row is a stay).

import { createServiceClient } from '../_shared/client.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, preflight } from '../_shared/http.ts'

type Mode = 'resolve' | 'my_stays'

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading';   text: string }
  | { type: 'note';      text: string }
  | { type: 'warning';   text: string }
  | { type: 'list';      items: string[] }
  | { type: 'wifi';      network: string; password: string }

type Section = { id: string; title: string; icon: string; content: Block[] }

// Redaction on the gated path. hasAlarm=true means an alarm EXISTS: withhold the
// code unless the host made it public (showAlarm). If no alarm exists, nothing
// to hide. showWifi/showArrival gate their sections the same way.
function redactSections(
  sections: Section[],
  gated: boolean,
  flags: { showWifi: boolean; showAlarm: boolean; showArrival: boolean; hasAlarm: boolean },
): Section[] {
  if (!gated) return sections

  return sections.map(section => {
    if (section.title === 'Alarm' && !flags.showAlarm && flags.hasAlarm) {
      return {
        ...section,
        content: [{ type: 'note', text: 'Alarm code details are available. Please ask your host.' }],
      }
    }
    if (section.title === 'Arrival' && !flags.showArrival) {
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
      (block.type === 'wifi' && !flags.showWifi)
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

    // -- my_stays -- requires a session.
    if (mode === 'my_stays') {
      const gate = await requireUser(req)
      if (!gate.ok) return json({ stays: [] }, 200)
      const { serviceClient: db, user } = gate

      const { data, error } = await db
        .from('travel_hosted_stay_guest')
        .select(`
          stay_id,
          stay:travel_hosted_stay!inner (
            id, url_id, sub_path, status, guest_names,
            check_in, check_out, title, is_active,
            property:travel_hosted_property (
              id, name, city, country, hero_image,
              owner_name, owner_phone, manager_name, manager_phone
            )
          )
        `)
        .eq('person_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('my_stays error:', error)
        return json({ error: 'Failed to fetch stays' }, 500)
      }

      const stays = (data ?? [])
        // deno-lint-ignore no-explicit-any
        .map((row: any) => row.stay)
        .filter((s: unknown) => s && (s as { is_active?: boolean }).is_active)
      return json({ stays }, 200)
    }

    // -- resolve -- anon allowed.
    if (mode === 'resolve') {
      const urlId = body?.url_id as string | undefined
      if (!urlId) return json({ error: 'url_id is required' }, 400)

      const gate = await requireUser(req)
      const hasSession = gate.ok
      const db = hasSession ? gate.serviceClient : createServiceClient()

      const { data: stay, error: stayErr } = await db
        .from('travel_hosted_stay')
        .select(`
          id, url_id, guest_names, guest_count, check_in, check_out,
          welcome_letter, status, is_active, active_listing_ids, has_alarm_code,
          is_public, show_wifi, show_alarm, show_owner_phone,
          show_manager_phone, has_alarm, show_arrival,
          property:travel_hosted_property (
            id, slug, name, tagline, city, country, hero_image, photos,
            maps_url, maps_embed_url, owner_name, owner_phone, manager_name,
            manager_phone, emergency_contacts, is_active
          )
        `)
        .eq('url_id', urlId)
        .single()

      if (stayErr || !stay) return json({ error: 'not-found' }, 404)
      // deno-lint-ignore no-explicit-any
      const s = stay as any

      if (!s.is_active || !s.property || !s.property.is_active) return json({ error: 'not-found' }, 404)

      const gated = !hasSession
      if (gated && !s.is_public) return json({ error: 'access-denied' }, 403)

      const propertyId = s.property.id
      // has_alarm=true means an alarm exists -> default sections. No alarm -> no_alarm variant.
      const sectionVariant = s.has_alarm ? 'default' : 'no_alarm'

      const [sectRes, listRes, overrideRes] = await Promise.all([
        db.from('travel_hosted_property_section')
          .select('id, title, icon, sort_order, variant, content')
          .eq('property_id', propertyId).order('sort_order'),
        db.from('travel_hosted_property_listing')
          .select('id, name, category, genre, address, website, hours, note, is_favourite')
          .eq('property_id', propertyId),
        db.from('travel_hosted_stay_section')
          .select('id, section_id, content')
          .eq('stay_id', s.id),
      ])

      if (sectRes.error || listRes.error) {
        console.error('sections/listings error:', sectRes.error ?? listRes.error)
        return json({ error: 'load-failed' }, 500)
      }

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

      sections = redactSections(sections, gated, {
        showWifi:    s.show_wifi,
        showAlarm:   s.show_alarm,
        showArrival: s.show_arrival,
        hasAlarm:    s.has_alarm,
      })

      // deno-lint-ignore no-explicit-any
      let listings = (listRes.data ?? []) as any[]
      if (Array.isArray(s.active_listing_ids)) {
        listings = listings.filter(l => s.active_listing_ids.includes(l.id))
      }

      const prop = s.property
      const ownerPhone   = (!gated || s.show_owner_phone)   ? prop.owner_phone   : null
      const managerPhone = (!gated || s.show_manager_phone) ? prop.manager_phone : null
      const mapsUrl      = (!gated || s.show_arrival)       ? prop.maps_url       : null
      const mapsEmbedUrl = (!gated || s.show_arrival)       ? prop.maps_embed_url : null

      return json({
        stay: {
          id:                s.id,
          urlId:             s.url_id,
          guestNames:        s.guest_names,
          checkIn:           s.check_in,
          checkOut:          s.check_out,
          welcomeLetter:     s.welcome_letter,
          activeListingIds:  s.active_listing_ids,
          hasAlarmCode:      s.has_alarm_code,
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
          showWifi:         s.show_wifi,
          showAlarm:        s.show_alarm,
          showOwnerPhone:   s.show_owner_phone,
          showManagerPhone: s.show_manager_phone,
          hasAlarm:         s.has_alarm,
          showArrival:      s.show_arrival,
        },
      }, 200)
    }

    return json({ error: `Unknown mode: ${mode}` }, 400)

  } catch (err) {
    console.error('travel-get-stay unexpected error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
