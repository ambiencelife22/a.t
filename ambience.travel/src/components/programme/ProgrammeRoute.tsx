/* ProgrammeRoute.tsx
 * Resolves url_id from pathname and loads programme data from Supabase.
 * Stay programmes only — renders ProgrammePage with property sections, listings.
 * No React Router — reads window.location.pathname directly.
 *
 * Last updated: S53 — Journey programme branch retired. JourneyPage,
 *   mapEvent, mapDays, DayRow, EventRow, ContactRow, JourneyLoaded all
 *   removed. ProgrammeRoute now serves stay-type programmes exclusively.
 *   Journey itinerary surfaces are superseded by ImmerseTripPage +
 *   Programme tab. Unknown programme_type (incl. legacy 'journey' rows)
 *   resolves to not-found.
 * Prior: S17 — All table refs updated to travel_programme_* convention;
 *   joined resources aliased to preserve downstream mapper code unchanged.
 *   Popstate listener added for back/forward navigation re-resolution.
 */

import { useEffect, useState } from 'react'
import { supabase, supabaseAnon } from '../../lib/supabase'
import { getSession } from '../../utils/utilsAuth'
import ProgrammeAccessDenied from './ProgrammeAccessDenied'
import ProgrammePage from './ProgrammePage'
import ProgrammeLayout from '../layouts/ProgrammeLayout'
import type { Booking, Property, ManualSection, Listing } from '../../types/typesProgramme'

// ── URL resolution ─────────────────────────────────────────────────────────────

function getUrlId(): string | null {
  const pathname = window.location.pathname
  const hostname = window.location.hostname

  if (hostname === 'programme.ambience.travel') {
    const parts = pathname.replace(/^\//, '').split('/')
    return parts[parts.length - 1] || null
  }

  const match = pathname.match(/^\/programme\/[^/]+\/([^/]+)/)
  return match ? match[1] : null
}

// ── DB row types ───────────────────────────────────────────────────────────────

type ProgrammeRow = {
  id:              string
  url_id:          string
  programme_type:  string
  guest_names:     string
  guest_count:     number
  check_in:        string | null
  check_out:       string | null
  welcome_letter:  string
  status:          string
  active:          boolean
  is_public:            boolean
  public_wifi:          boolean
  public_alarm:         boolean
  public_owner_phone:   boolean
  public_manager_phone: boolean
  no_alarm:             boolean
  public_arrival: boolean
  active_listing_ids:   string[] | null
  alarm_code_provided:  boolean
  properties: {
    id:                 string
    slug:               string
    name:               string
    tagline:            string
    city:               string
    country:            string
    hero_image:         string | null
    photos:             { src: string; caption: string; subCaption: string }[]
    maps_url:           string | null
    maps_embed_url:     string | null
    owner_name:         string
    owner_phone:        string
    manager_name:       string
    manager_phone:      string
    emergency_contacts: { label: string; phone: string }[]
    active:             boolean
  }
}

type SectionRow = {
  id:         string
  title:      string
  icon:       string
  sort_order: number
  variant:    string
  content:    ManualSection['content']
}

type ProgrammeSectionRow = {
  id:           string
  section_id:   string
  content:      ManualSection['content']
}

type ListingRow = {
  id:        string
  name:      string
  category:  string
  genre:     string | null
  address:   string
  website:   string | null
  hours:     string | null
  note:      string | null
  favourite: boolean
}

// ── Data mappers ───────────────────────────────────────────────────────────────

function mapBooking(row: ProgrammeRow): Booking {
  return {
    id:                  row.id,
    propertyId:          row.properties.slug,
    guestNames:          row.guest_names,
    checkIn:             row.check_in ?? undefined,
    checkOut:            row.check_out ?? undefined,
    welcomeLetter:       row.welcome_letter,
    activeListingIds:    row.active_listing_ids ?? undefined,
    alarmCodeProvided:   row.alarm_code_provided,
  }
}

function mapProperty(row: ProgrammeRow['properties']): Property {
  return {
    id:        row.id,
    name:      row.name,
    tagline:   row.tagline,
    location:  [row.city, row.country].filter(Boolean).join(', '),
    heroImage: row.hero_image ?? '',
    photos:    row.photos ?? [],
    mapsUrl:      row.maps_url ?? null,
    mapsEmbedUrl: row.maps_embed_url ?? null,
    owner: {
      name:  row.owner_name,
      role:  'Owner',
      phone: row.owner_phone,
    },
    manager: {
      name:  row.manager_name,
      role:  'Property Manager',
      phone: row.manager_phone,
    },
    emergencies: row.emergency_contacts ?? [],
  }
}

function mapSections(
  rows: SectionRow[],
  variant: string,
  overrides: ProgrammeSectionRow[],
): ManualSection[] {
  const defaultRows = rows.filter(r => r.variant === 'default')
  const variantByTitle = new Map(
    rows.filter(r => r.variant === variant).map(r => [r.title, r])
  )
  const resolved = defaultRows.map(row => {
    const v = variantByTitle.get(row.title)
    if (v) return v
    return row
  })

  const overrideBySection = new Map(overrides.map(o => [o.section_id, o]))

  return resolved.map(row => {
    const override = overrideBySection.get(row.id)
    return {
      id:      row.id,
      title:   row.title,
      icon:    row.icon,
      content: override ? override.content : row.content,
    }
  })
}

function mapListings(rows: ListingRow[]): Listing[] {
  return rows.map(row => ({
    id:       row.id,
    name:     row.name,
    category: row.category as Listing['category'],
    genre:    row.genre ?? undefined,
    address:  row.address,
    website:  row.website ?? undefined,
    hours:    row.hours ?? undefined,
    note:     row.note ?? undefined,
    favorite: row.favourite,
  }))
}

// ── Loading / error states ────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: 13, color: '#7A8476', letterSpacing: '0.06em' }}>
        Loading your programme…
      </div>
    </div>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div style={{
      minHeight:      'calc(100vh - 60px)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#171917' }}>{message}</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}>
        Return to ambience.travel →
      </a>
    </div>
  )
}

// ── Loaded state types ────────────────────────────────────────────────────────

type LoadedState = {
  type:               'stay'
  booking:            Booking
  property:           Property
  manual:             ManualSection[]
  listings:           Listing[]
  isPublic:           boolean
  publicWifi:         boolean
  publicAlarm:        boolean
  publicOwnerPhone:   boolean
  publicManagerPhone: boolean
  noAlarm:            boolean
  publicArrival: boolean
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgrammeRoute() {
  const [loaded, setLoaded]               = useState<LoadedState | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)
  const [userEmail, setUserEmail]         = useState('')
  const [fallbackProgramme, setFallback]  = useState<{ url: string; guestNames: string } | undefined>(undefined)

  // S17: track pathname so back/forward navigation re-resolves the programme
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    function sync() { setPathname(window.location.pathname) }
    window.addEventListener('popstate', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  const urlId = getUrlId()

  useEffect(() => {
    if (!urlId) {
      setError('no-id')
      setLoading(false)
      return
    }

    async function load() {
      // 0 — Resolve programme first (anon read — works for public programmes)
      const { data: prog, error: progErr } = await supabaseAnon
        .from('travel_programme_master')
        .select(`
          id,
          url_id,
          programme_type,
          guest_names,
          guest_count,
          check_in,
          check_out,
          welcome_letter,
          status,
          active,
          active_listing_ids,
          alarm_code_provided,
          is_public,
          public_wifi,
          public_alarm,
          public_owner_phone,
          public_manager_phone,
          no_alarm,
          public_arrival,
          properties:travel_programme_properties (
            id,
            slug,
            name,
            tagline,
            city,
            country,
            hero_image,
            photos,
            maps_url,
            maps_embed_url,
            owner_name,
            owner_phone,
            manager_name,
            manager_phone,
            emergency_contacts,
            active
          )
        `)
        .eq('url_id', urlId)
        .single()

      // 1a — Check for session first — admins/guests viewing public programmes see full content
      const session = await getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      }

      // 1b — If programme is public and no session, render with gates active
      if (!progErr && prog) {
        const publicRow = prog as unknown as ProgrammeRow
        if (publicRow.is_public && !session) {
          await continueLoad(publicRow, true)
          return
        }
        // Authenticated user viewing public programme — no gates
        if (publicRow.is_public && session) {
          await continueLoad(publicRow, false)
          return
        }
      }

      if (!session) {
        setError('access-denied')
        setLoading(false)
        return
      }

      if (progErr || !prog) {
        // Check if this user has any other accessible programmes
        const { data: fallback } = await supabase
          .from('travel_programme_guests')
          .select('programmes:travel_programme_master(url_id, sub_path, guest_names)')
          .eq('profile_id', session?.user?.id ?? '')
          .not('travel_programme_master', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (fallback?.programmes) {
          const p = fallback.programmes as unknown as { url_id: string; sub_path: string; guest_names: string }
          const hostname = window.location.hostname
          const base = hostname === 'programme.ambience.travel'
            ? 'https://programme.ambience.travel'
            : `${window.location.protocol}//${window.location.host}`
          setFallback({
            url:        `${base}/${p.sub_path}/${p.url_id}`,
            guestNames: p.guest_names,
          })
        }

        setError('access-denied')
        setLoading(false)
        return
      }

      await continueLoad(prog as unknown as ProgrammeRow, false)
    }

    async function continueLoad(row: ProgrammeRow, isPublic: boolean) {
      const booking  = mapBooking(row)

      if (!row.active) {
        setError('not-found')
        setLoading(false)
        return
      }

      if (!row.properties) {
        setError('load-failed')
        setLoading(false)
        return
      }

      if (!row.properties.active) {
        setError('not-found')
        setLoading(false)
        return
      }

      const property = mapProperty(row.properties)

      // ── Stay branch ──────────────────────────────────────────────────────────

      if (row.programme_type === 'stay') {
        const propertyId = row.properties.id

        const client = isPublic ? supabaseAnon : supabase
        const [sectResult, listResult, overrideResult] = await Promise.all([
          client
            .from('travel_programme_property_sections')
            .select('id, title, icon, sort_order, variant, content')
            .eq('property_id', propertyId)
            .order('sort_order'),
          client
            .from('travel_programme_property_listings')
            .select('id, name, category, genre, address, website, hours, note, favourite')
            .eq('property_id', propertyId),
          client
            .from('travel_programme_sections')
            .select('id, section_id, content')
            .eq('programme_id', row.id),
        ])

        if (sectResult.error || listResult.error) {
          setError('load-failed')
          setLoading(false)
          return
        }

        const sectionVariant = row.no_alarm ? 'no_alarm' : 'default'
        const overrides = (overrideResult.data ?? []) as ProgrammeSectionRow[]
        const manual   = mapSections((sectResult.data ?? []) as SectionRow[], sectionVariant, overrides)
        let   listings = mapListings((listResult.data ?? []) as ListingRow[])

        if (booking.activeListingIds) {
          listings = listings.filter(l => booking.activeListingIds!.includes(l.id))
        }

        setLoaded({ type: 'stay', booking, property, manual, listings, isPublic,
          publicWifi:         row.public_wifi,
          publicAlarm:        row.public_alarm,
          publicOwnerPhone:   row.public_owner_phone,
          publicManagerPhone: row.public_manager_phone,
          noAlarm:            row.no_alarm,
          publicArrival: row.public_arrival,
        })
        setLoading(false)
        return
      }

      // Unknown programme type (incl. legacy 'journey' rows — surface retired S53)
      setError('not-found')
      setLoading(false)
    }

    load()
  }, [urlId])

  if (!urlId) {
    return (
      <ProgrammeLayout>
        <NotFound message='No booking ID provided.' />
      </ProgrammeLayout>
    )
  }

  if (loading) {
    return (
      <ProgrammeLayout>
        <LoadingScreen />
      </ProgrammeLayout>
    )
  }

  if (error === 'access-denied') {
    return <ProgrammeAccessDenied email={userEmail} fallbackProgramme={fallbackProgramme} />
  }

  if (error === 'not-found') {
    return (
      <ProgrammeLayout>
        <NotFound message='This guide is not available.' />
      </ProgrammeLayout>
    )
  }

  if (error || !loaded) {
    return (
      <ProgrammeLayout>
        <NotFound message='Something went wrong. Please try again.' />
      </ProgrammeLayout>
    )
  }

  return (
    <ProgrammeLayout guestNames={loaded.booking.guestNames}>
      <ProgrammePage
        booking={loaded.booking}
        property={loaded.property}
        manual={loaded.manual}
        listings={loaded.listings}
        isPublic={loaded.isPublic}
        publicWifi={loaded.publicWifi}
        publicAlarm={loaded.publicAlarm}
        publicOwnerPhone={loaded.publicOwnerPhone}
        publicManagerPhone={loaded.publicManagerPhone}
        noAlarm={loaded.noAlarm}
        publicArrival={loaded.publicArrival}
      />
    </ProgrammeLayout>
  )
}