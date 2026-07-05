/* ProgrammeRoute.tsx
 * Resolves url_id from pathname and renders the stay portal.
 * Stay programmes only. No React Router; reads window.location.pathname.
 *
 * Last updated: S53N - SECURITY FIX + layering. The component no longer touches
 *   the DB or the EF directly. It calls the queries layer (getStayByUrlId /
 *   getMyStaysRaw in queriesProgramme.ts), which owns EF invocation and mapping.
 *   Proper EF -> types -> queries -> front. Secrets are redacted server-side by
 *   travel-get-stay on the gated path; the component only renders what it is
 *   given, keeping "Ask your host" placeholders as a display fallback.
 * Prior: S53 - Journey programme branch retired; stay-type only.
 */

import { useEffect, useState } from 'react'
import { getSession } from '../../utils/utilsAuth'
import { getStayByUrlId, getMyStaysRaw } from '../../queries/queriesProgramme'
import type { StayResolved } from '../../queries/queriesProgramme'
import ProgrammeAccessDenied from './ProgrammeAccessDenied'
import ProgrammePage from './ProgrammePage'
import ProgrammeLayout from '../layouts/ProgrammeLayout'
import type { Booking, Property, ManualSection, Listing } from '../../types/typesProgramme'

// -- URL resolution --

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

// -- View-model mapping (pure; from the query-layer StayResolved shape) --

function toBooking(r: StayResolved): Booking {
  return {
    id:                r.stay.id,
    propertyId:        r.property.id,
    guestNames:        r.stay.guestNames,
    checkIn:           r.stay.checkIn ?? undefined,
    checkOut:          r.stay.checkOut ?? undefined,
    welcomeLetter:     r.stay.welcomeLetter,
    activeListingIds:  r.stay.activeListingIds ?? undefined,
    alarmCodeProvided: r.stay.alarmCodeProvided,
  }
}

function toProperty(r: StayResolved): Property {
  return {
    id:           r.property.id,
    name:         r.property.name,
    tagline:      r.property.tagline,
    location:     [r.property.city, r.property.country].filter(Boolean).join(', '),
    heroImage:    r.property.heroImage ?? '',
    photos:       r.property.photos ?? [],
    mapsUrl:      r.property.mapsUrl ?? null,
    mapsEmbedUrl: r.property.mapsEmbedUrl ?? null,
    owner:   { name: r.property.ownerName,   role: 'Owner',            phone: r.property.ownerPhone   ?? '' },
    manager: { name: r.property.managerName, role: 'Property Manager', phone: r.property.managerPhone ?? '' },
    emergencies: r.property.emergencyContacts ?? [],
  }
}

function toManual(r: StayResolved): ManualSection[] {
  return r.sections.map(s => ({
    id: s.id, title: s.title, icon: s.icon,
    content: s.content as ManualSection['content'],
  }))
}

function toListings(r: StayResolved): Listing[] {
  return r.listings.map(l => ({
    id:       l.id,
    name:     l.name,
    category: l.category as Listing['category'],
    genre:    l.genre ?? undefined,
    address:  l.address,
    website:  l.website ?? undefined,
    hours:    l.hours ?? undefined,
    note:     l.note ?? undefined,
    favorite: l.favourite,
  }))
}

// -- Loading / error states --

function LoadingScreen() {
  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: '#7A8476', letterSpacing: '0.06em' }}>
        Loading your programme...
      </div>
    </div>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#171917' }}>{message}</div>
      <a href='https://ambience.travel' style={{ fontSize: 13, color: '#C9B88E', textDecoration: 'none' }}>
        Return to ambience.travel
      </a>
    </div>
  )
}

// -- Loaded state --

type LoadedState = {
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

// -- Main component --

export default function ProgrammeRoute() {
  const [loaded, setLoaded]              = useState<LoadedState | null>(null)
  const [error, setError]                = useState<string | null>(null)
  const [loading, setLoading]            = useState(true)
  const [userEmail, setUserEmail]        = useState('')
  const [fallbackProgramme, setFallback] = useState<{ url: string; guestNames: string } | undefined>(undefined)

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
      const session = await getSession()
      if (session?.user?.email) setUserEmail(session.user.email)

      const result = await getStayByUrlId(urlId!)

      if (!result.ok) {
        if (result.reason === 'access-denied') {
          // "Your other stays" fallback for a signed-in user.
          if (session) {
            const mine = await getMyStaysRaw()
            const first = mine[0]
            if (first) {
              const hostname = window.location.hostname
              const base = hostname === 'programme.ambience.travel'
                ? 'https://programme.ambience.travel'
                : `${window.location.protocol}//${window.location.host}`
              setFallback({ url: `${base}/${first.sub_path}/${first.url_id}`, guestNames: first.guest_names })
            }
          }
          setError('access-denied')
          setLoading(false)
          return
        }
        setError(result.reason)
        setLoading(false)
        return
      }

      const r = result.data
      setLoaded({
        booking:            toBooking(r),
        property:           toProperty(r),
        manual:             toManual(r),
        listings:           toListings(r),
        isPublic:           r.gated,
        publicWifi:         r.flags.publicWifi,
        publicAlarm:        r.flags.publicAlarm,
        publicOwnerPhone:   r.flags.publicOwnerPhone,
        publicManagerPhone: r.flags.publicManagerPhone,
        noAlarm:            r.flags.noAlarm,
        publicArrival:      r.flags.publicArrival,
      })
      setLoading(false)
    }

    load()
  }, [urlId, pathname])

  if (!urlId) {
    return <ProgrammeLayout><NotFound message='No booking ID provided.' /></ProgrammeLayout>
  }

  if (loading) {
    return <ProgrammeLayout><LoadingScreen /></ProgrammeLayout>
  }

  if (error === 'access-denied') {
    return <ProgrammeAccessDenied email={userEmail} fallbackProgramme={fallbackProgramme} />
  }

  if (error === 'not-found') {
    return <ProgrammeLayout><NotFound message='This guide is not available.' /></ProgrammeLayout>
  }

  if (error || !loaded) {
    return <ProgrammeLayout><NotFound message='Something went wrong. Please try again.' /></ProgrammeLayout>
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