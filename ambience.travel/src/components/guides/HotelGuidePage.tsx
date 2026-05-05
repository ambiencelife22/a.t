// HotelGuidePage.tsx — public hotels guide for a destination
// Mirrors DiningGuidePage. Hero outside <main>, content inside.
// Filter shape simpler than dining — no cuisine taxonomy on hotels.
// Active filters: forbes (4/5), preferred-partners-only.
//
// Last updated: S37

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'
import { useToast } from '../../lib/ToastContext'
import {
  getHotelsByDestination,
  type HotelVenue,
  type HotelGuideDestination,
} from '../../lib/hotelGuideQueries'
import { HotelCard } from './HotelCard'
import { GuideHero } from './GuideHero'
import { HotelGuideFilters, type HotelFilterState } from './HotelGuideFilters'

interface HotelGuidePageProps {
  destination: HotelGuideDestination
}

const DEFAULT_EYEBROW = 'Curated Stays'

function defaultHeadline(destinationName: string): string {
  return `${destinationName} Hotels`
}

function defaultIntro(destinationName: string): string {
  return `A selective hotel guide for ${destinationName}.`
}

function readFilterStateFromUrl(): HotelFilterState {
  const params = new URLSearchParams(window.location.search)
  return {
    minStars:        params.get('stars') ? parseInt(params.get('stars')!, 10) : null,
    forbesOnly:      params.get('forbes') === '1',
    partnersOnly:    params.get('partners') === '1',
  }
}

function writeFilterStateToUrl(state: HotelFilterState) {
  const params = new URLSearchParams()
  if (state.minStars) params.set('stars', String(state.minStars))
  if (state.forbesOnly) params.set('forbes', '1')
  if (state.partnersOnly) params.set('partners', '1')
  const qs = params.toString()
  const next = `${window.location.pathname}${qs ? '?' + qs : ''}`
  window.history.replaceState(null, '', next)
}

export default function HotelGuidePage({ destination }: HotelGuidePageProps) {
  const { toast } = useToast()
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const [hotels, setHotels] = useState<HotelVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [filterState, setFilterState] = useState<HotelFilterState>(() => readFilterStateFromUrl())

  const overlay = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? DEFAULT_EYEBROW
  const heroHeadline = overlay?.headline_override ?? defaultHeadline(destination.name)
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? null

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const items = await getHotelsByDestination(destination.slug)
        if (cancelled) return
        setHotels(items)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('HotelGuidePage: failed to load hotels', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toastRef.current.error(`Couldn't load hotels — ${msg}`)
        setHotels([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug])

  useEffect(() => {
    writeFilterStateToUrl(filterState)
  }, [filterState])

  const hasForbes = useMemo(
    () => hotels.some(h => h.forbes_rating !== null),
    [hotels],
  )
  const hasPartners = useMemo(
    () => hotels.some(h => h.is_preferred_partner),
    [hotels],
  )

  const filteredHotels = useMemo(() => {
    return hotels.filter(h => {
      if (filterState.minStars && (h.stars === null || h.stars < filterState.minStars)) return false
      if (filterState.forbesOnly && h.forbes_rating === null) return false
      if (filterState.partnersOnly && !h.is_preferred_partner) return false
      return true
    })
  }, [hotels, filterState])

  return (
    <>
      <GuideHero
        eyebrow={heroEyebrow}
        headline={heroHeadline}
        intro={heroIntro}
        imageSrc={heroImageSrc}
        imageAlt={heroImageAlt}
      />

      <main style={pageStyle}>
        {loading ? (
          <LoadingState />
        ) : (
          <>
            <HotelGuideFilters
              state={filterState}
              onChange={setFilterState}
              hasForbes={hasForbes}
              hasPartners={hasPartners}
            />

            <div style={sectionTitleStyle}>
              <h2 style={sectionTitleH2Style}>Selected stays</h2>
              <p style={sectionTitleCountStyle}>
                {filteredHotels.length} {filteredHotels.length === 1 ? 'hotel' : 'hotels'}
              </p>
            </div>

            {filteredHotels.length === 0 ? (
              <EmptyState />
            ) : (
              <section style={gridStyle}>
                {filteredHotels.map(h => (
                  <HotelCard
                    key={h.id}
                    hotel={h}
                    hasFullAccess={true}
                    destinationName={destination.name}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}

function LoadingState() {
  return (
    <div style={messageBlockStyle}>
      <p style={messageTextStyle}>Setting the scene.</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={emptyStateStyle}>
      <p style={emptyStateTextStyle}>
        Nothing here for those filters yet. Try widening the search.
      </p>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  width: 'min(1480px, 100%)',
  margin: '0 auto',
  padding: '42px 34px 64px',
}

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 20,
  margin: '34px 4px 22px',
}

const sectionTitleH2Style: React.CSSProperties = {
  margin: 0,
  fontFamily: FONTS.serif,
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: '-0.04em',
  color: ID.text,
}

const sectionTitleCountStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 14,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
  gap: 22,
}

const messageBlockStyle: React.CSSProperties = {
  padding: '120px 24px',
  textAlign: 'center',
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 30,
  background: 'rgba(255,255,255,0.025)',
}

const messageTextStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 15,
  lineHeight: 1.55,
  fontStyle: 'italic',
}

const emptyStateStyle: React.CSSProperties = {
  padding: '80px 24px',
  textAlign: 'center',
  border: `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 30,
  background: 'rgba(255,255,255,0.025)',
}

const emptyStateTextStyle: React.CSSProperties = {
  margin: 0,
  color: ID.muted,
  fontSize: 16,
  lineHeight: 1.55,
  fontStyle: 'italic',
}