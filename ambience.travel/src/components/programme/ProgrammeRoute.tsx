/* ProgrammeRoute.tsx
 * Resolves url_id from pathname and loads programme data from Supabase.
 * Replaces static bookings.ts, property.ts, houseManual.ts, listings.ts imports.
 * No React Router — reads window.location.pathname directly.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ProgrammePage from './ProgrammePage'
import ProgrammeLayout from '../layouts/ProgrammeLayout'
import type { Booking, Property, ManualSection, Listing } from '../../lib/programmeTypes'

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
  id:             string
  url_id:         string
  guest_names:    string
  guest_count:    number
  check_in:       string | null
  check_out:      string | null
  welcome_letter: string
  status:         string
  active_listing_ids: string[] | null
  properties: {
    id:                 string
    slug:               string
    name:               string
    tagline:            string
    location:           string
    hero_image:         string | null
    photos:             { src: string; caption: string; subCaption: string }[]
    owner_name:         string
    owner_role:         string
    owner_phone:        string
    manager_name:       string
    manager_role:       string
    manager_phone:      string
    emergency_contacts: { label: string; phone: string }[]
  }
}

type SectionRow = {
  id:         string
  title:      string
  icon:       string
  sort_order: number
  content:    ManualSection['content']
}

type ListingRow = {
  id:       string
  name:     string
  category: string
  genre:    string | null
  address:  string
  website:  string | null
  hours:    string | null
  note:     string | null
  favourite: boolean
}

// ── Data mappers ───────────────────────────────────────────────────────────────

function mapBooking(row: ProgrammeRow): Booking {
  return {
    id:                 row.id,
    propertyId:         row.properties.slug,
    guestNames:         row.guest_names,
    checkIn:            row.check_in ?? undefined,
    checkOut:           row.check_out ?? undefined,
    welcomeLetter:      row.welcome_letter,
    activeListingIds:   row.active_listing_ids ?? undefined,
  }
}

function mapProperty(row: ProgrammeRow['properties']): Property {
  return {
    id:       row.id,
    name:     row.name,
    tagline:  row.tagline,
    location: row.location,
    heroImage: row.hero_image ?? '',
    photos:   row.photos ?? [],
    owner: {
      name:  row.owner_name,
      role:  row.owner_role,
      phone: row.owner_phone,
    },
    manager: {
      name:  row.manager_name,
      role:  row.manager_role,
      phone: row.manager_phone,
    },
    emergencies: row.emergency_contacts ?? [],
  }
}

function mapSections(rows: SectionRow[]): ManualSection[] {
  return rows.map(row => ({
    id:      row.id,
    title:   row.title,
    icon:    row.icon,
    content: row.content,
  }))
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

// ── Loading state ──────────────────────────────────────────────────────────────

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

// ── Not found ──────────────────────────────────────────────────────────────────

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
      <a
        href='https://ambience.travel'
        style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}
      >
        Return to ambience.travel →
      </a>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type LoadedState = {
  booking:  Booking
  property: Property
  manual:   ManualSection[]
  listings: Listing[]
}

export default function ProgrammeRoute() {
  const [loaded, setLoaded]   = useState<LoadedState | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const urlId = getUrlId()

  useEffect(() => {
    if (!urlId) {
      setError('no-id')
      setLoading(false)
      return
    }

    async function load() {
      // 1 — Resolve programme + property in one query
      const { data: prog, error: progErr } = await supabase
        .from('programmes')
        .select(`
          id,
          url_id,
          guest_names,
          guest_count,
          check_in,
          check_out,
          welcome_letter,
          status,
          active_listing_ids,
          properties (
            id,
            slug,
            name,
            tagline,
            location,
            hero_image,
            photos,
            owner_name,
            owner_role,
            owner_phone,
            manager_name,
            manager_role,
            manager_phone,
            emergency_contacts
          )
        `)
        .eq('url_id', urlId)
        .single()

      if (progErr || !prog) {
        setError('not-found')
        setLoading(false)
        return
      }

      const row = prog as unknown as ProgrammeRow
      const propertyId = row.properties.id

      // 2 — House manual sections
      const { data: sectionRows, error: sectErr } = await supabase
        .from('property_sections')
        .select('id, title, icon, sort_order, content')
        .eq('property_id', propertyId)
        .order('sort_order')

      if (sectErr) {
        setError('load-failed')
        setLoading(false)
        return
      }

      // 3 — Listings
      const { data: listingRows, error: listErr } = await supabase
        .from('property_listings')
        .select('id, name, category, genre, address, website, hours, note, favourite')
        .eq('property_id', propertyId)

      if (listErr) {
        setError('load-failed')
        setLoading(false)
        return
      }

      const booking  = mapBooking(row)
      const property = mapProperty(row.properties)
      const manual   = mapSections((sectionRows ?? []) as SectionRow[])
      let   listings = mapListings((listingRows ?? []) as ListingRow[])

      if (booking.activeListingIds) {
        listings = listings.filter(l => booking.activeListingIds!.includes(l.id))
      }

      setLoaded({ booking, property, manual, listings })
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
      />
    </ProgrammeLayout>
  )
}