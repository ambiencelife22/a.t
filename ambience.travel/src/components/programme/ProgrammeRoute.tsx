/* ProgrammeRoute.tsx
 * Resolves url_id from pathname and loads programme data from Supabase.
 * Branches on programme_type:
 *   stay    → ProgrammePage (property sections, listings)
 *   journey → JourneyPage  (programme days, events, contacts)
 * No React Router — reads window.location.pathname directly.
 */

import { useEffect, useState } from 'react'
import { supabase, supabaseAnon } from '../../lib/supabase'
import { getSession } from '../../lib/auth'
import ProgrammeAccessDenied from './ProgrammeAccessDenied'
import ProgrammePage from './ProgrammePage'
import JourneyPage from './JourneyPage'
import ProgrammeLayout from '../layouts/ProgrammeLayout'
import type { Booking, Property, ManualSection, Listing } from '../../lib/programmeTypes'
import type { JourneyDay, JourneyEvent, EventContact, EventType, EventStatus } from '../../lib/journeyTypes'

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
  public_arrival:       boolean
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

type DayRow = {
  id:         string
  date:       string | null
  title:      string | null
  sort_order: number
}

type EventRow = {
  id:                  string
  day_id:              string
  event_type:          string
  status:              string
  title:               string
  time_local:          string | null
  duration:            string | null
  description:         string | null
  confirmation_number: string | null
  location:            string | null
  sort_order:          number
  airline:             string | null
  flight_number:       string | null
  departure_airport:   string | null
  arrival_airport:     string | null
  arrival_time:        string | null
  flight_class:        string | null
  seats:               string | null
  terminal:            string | null
  gate:                string | null
  driver_name:         string | null
  driver_phone:        string | null
  room_type:           string | null
  check_in_date:       string | null
  check_out_date:      string | null
  inclusions:          string | null
  supplier_name:       string | null
}

type ContactRow = {
  id:       string
  event_id: string
  name:     string
  role:     string
  phone:    string | null
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

type GatingFlags = {
  arrival: boolean
}

function mapSections(
  rows: SectionRow[],
  variant: string,
  overrides: ProgrammeSectionRow[],
  isPublic: boolean = false,
  gating: GatingFlags = { arrival: false },
): ManualSection[] {
  const defaultRows = rows.filter(r => r.variant === 'default')
  const variantByTitle = new Map(
    rows.filter(r => r.variant === variant).map(r => [r.title, r])
  )
  const gatedByTitle = new Map(
    rows.filter(r => r.variant === 'gated').map(r => [r.title, r])
  )

  const resolved = defaultRows.map(row => {
    // Public + gated flag off → use gated variant if available
    if (isPublic) {
      if (row.title === 'Arrival' && !gating.arrival) {
        const g = gatedByTitle.get(row.title)
        if (g) return g
      }
    }
    // Use named variant (e.g. no_alarm) if available
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

function mapEvent(row: EventRow, contacts: ContactRow[]): JourneyEvent {
  return {
    id:                  row.id,
    event_type:          row.event_type as EventType,
    status:              row.status as EventStatus,
    title:               row.title,
    time_local:          row.time_local,
    duration:            row.duration,
    description:         row.description,
    confirmation_number: row.confirmation_number,
    location:            row.location,
    supplier_name:       row.supplier_name,
    sort_order:          row.sort_order,
    airline:             row.airline,
    flight_number:       row.flight_number,
    departure_airport:   row.departure_airport,
    arrival_airport:     row.arrival_airport,
    arrival_time:        row.arrival_time,
    flight_class:        row.flight_class,
    seats:               row.seats,
    terminal:            row.terminal,
    gate:                row.gate,
    driver_name:         row.driver_name,
    driver_phone:        row.driver_phone,
    room_type:           row.room_type,
    check_in_date:       row.check_in_date,
    check_out_date:      row.check_out_date,
    inclusions:          row.inclusions,
    contacts:            contacts
      .filter(c => c.event_id === row.id)
      .map(c => ({
        id:    c.id,
        name:  c.name,
        role:  c.role,
        phone: c.phone,
      } as EventContact)),
  }
}

function mapDays(dayRows: DayRow[], eventRows: EventRow[], contactRows: ContactRow[]): JourneyDay[] {
  return dayRows.map(day => ({
    id:         day.id,
    date:       day.date,
    title:      day.title,
    sort_order: day.sort_order,
    events:     eventRows
      .filter(e => e.day_id === day.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(e => mapEvent(e, contactRows)),
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

type StayLoaded = {
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
  publicArrival:      boolean
}

type JourneyLoaded = {
  type:               'journey'
  booking:            Booking
  property:           Property
  days:               JourneyDay[]
  isPublic:           boolean
  publicWifi:         boolean
  publicAlarm:        boolean
  publicOwnerPhone:   boolean
  publicManagerPhone: boolean
}

type LoadedState = StayLoaded | JourneyLoaded

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgrammeRoute() {
  const [loaded, setLoaded]               = useState<LoadedState | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)
  const [userEmail, setUserEmail]         = useState('')
  const [fallbackProgramme, setFallback]  = useState<{ url: string; guestNames: string } | undefined>(undefined)

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
        .from('programmes')
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
          properties (
            id,
            slug,
            name,
            tagline,
            city,
            country,
            hero_image,
            photos,
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

      // 1a — If programme is public, skip all auth and render immediately
      if (!progErr && prog) {
        const publicRow = prog as unknown as ProgrammeRow
        if (publicRow.is_public) {
          await continueLoad(publicRow, true)
          return
        }
      }

      // 1b — Programme is not public — require a session
      const session = await getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      }

      if (!session) {
        setError('access-denied')
        setLoading(false)
        return
      }

      if (progErr || !prog) {
        // Check if this user has any other accessible programmes
        const { data: fallback } = await supabase
          .from('programme_guests')
          .select('programmes(url_id, sub_path, guest_names)')
          .eq('profile_id', session?.user?.id ?? '')
          .not('programmes', 'is', null)
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
            .from('property_sections')
            .select('id, title, icon, sort_order, variant, content')
            .eq('property_id', propertyId)
            .order('sort_order'),
          client
            .from('property_listings')
            .select('id, name, category, genre, address, website, hours, note, favourite')
            .eq('property_id', propertyId),
          client
            .from('programme_sections')
            .select('id, section_id, content')
            .eq('programme_id', row.id),
        ])

        if (sectResult.error || listResult.error) {
          setError('load-failed')
          setLoading(false)
          return
        }

        const sectionVariant = row.no_alarm ? 'no_alarm' : 'default'
        const gatedVariant   = 'gated'
        const overrides = (overrideResult.data ?? []) as ProgrammeSectionRow[]
        const manual   = mapSections((sectResult.data ?? []) as SectionRow[], sectionVariant, overrides, isPublic, {
          arrival: row.public_arrival,
        })
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
          publicArrival:      row.public_arrival,
        })
        setLoading(false)
        return
      }

      // ── Journey branch ───────────────────────────────────────────────────────

      if (row.programme_type === 'journey') {
        const programmeId = row.id

        const { data: dayData, error: dayErr } = await supabase
          .from('programme_days')
          .select('id, date, title, sort_order')
          .eq('programme_id', programmeId)
          .order('sort_order')

        if (dayErr) {
          setError('load-failed')
          setLoading(false)
          return
        }

        const dayRows = (dayData ?? []) as DayRow[]
        const dayIds  = dayRows.map(d => d.id)

        if (dayIds.length === 0) {
          setLoaded({ type: 'journey', booking, property, days: [], isPublic,
            publicWifi:         row.public_wifi,
            publicAlarm:        row.public_alarm,
            publicOwnerPhone:   row.public_owner_phone,
            publicManagerPhone: row.public_manager_phone,
          })
          setLoading(false)
          return
        }

        const { data: evData, error: evErr } = await supabase
          .from('programme_events')
          .select(`
            id, day_id, event_type, status, title,
            time_local, duration, description, confirmation_number,
            location, sort_order,
            airline, flight_number, departure_airport, arrival_airport,
            arrival_time, flight_class, seats, terminal, gate,
            driver_name, driver_phone,
            room_type, check_in_date, check_out_date, inclusions,
            supplier_name
          `)
          .in('day_id', dayIds)

        if (evErr) {
          setError('load-failed')
          setLoading(false)
          return
        }

        const eventRows = (evData ?? []) as EventRow[]
        const eventIds  = eventRows.map(e => e.id)

        const { data: ctData, error: ctErr } = eventIds.length > 0
          ? await supabase
              .from('programme_event_contacts')
              .select('id, event_id, name, role, phone')
              .in('event_id', eventIds)
          : { data: [], error: null }

        if (ctErr) {
          setError('load-failed')
          setLoading(false)
          return
        }

        const contactRows = (ctData ?? []) as ContactRow[]
        const days        = mapDays(dayRows, eventRows, contactRows)

        setLoaded({ type: 'journey', booking, property, days, isPublic,
          publicWifi:         row.public_wifi,
          publicAlarm:        row.public_alarm,
          publicOwnerPhone:   row.public_owner_phone,
          publicManagerPhone: row.public_manager_phone,
        })
        setLoading(false)
        return
      }

      // Unknown programme type
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

  if (loaded.type === 'stay') {
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

  return (
    <ProgrammeLayout guestNames={loaded.booking.guestNames}>
      <JourneyPage
        booking={loaded.booking}
        property={loaded.property}
        days={loaded.days}
        isPublic={loaded.isPublic}
      />
    </ProgrammeLayout>
  )
}