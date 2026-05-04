// DiningGuidePage.tsx — public dining guide for a destination
// What it owns:
//   - Venue data fetch
//   - Filter state + URL param sync (cuisine, michelin, neighborhood)
//   - Frontend default copy + ?? resolution against overlay overrides
//   - Grid layout, error+empty states for the data load
//
// What it does not own:
//   - Path parsing (DiningGuideRoute resolves slug → destination)
//   - Destination validation (DiningGuideRoute validates upstream)
//   - Error redirects with toast (DiningGuideRoute handles bad-slug cases)
//   - Page chrome (GuideLayout — fixed nav, drawer, back-to-top)
//   - Card rendering (DiningCard), filter chips (DiningGuideFilters), hero (GuideHero)
//
// Receives destination as a guaranteed-non-null prop. Overlay fields on the
// destination are nullable — page resolves each via ?? against frontend
// defaults (Variant 1 column-based override per Seed Reference v8 §5).
//
// Layout pattern: hero is rendered as a sibling of the constrained content,
// not inside it. Mirrors ImmerseEngagementPage — hero owns its own width;
// filters + grid live inside a max-1480px container. No negative-margin
// escape tricks.
//
// Last updated: S36 — Hero lifted to sibling of <main>. Removed negative-
//   margin viewport-escape pattern from GuideHero call site. Pattern now
//   matches ImmerseEngagementPage (hero outside constrained content).
// Prior: S35 — GuideHero refactored to full-bleed parallax pattern.
//   Panel title/body block dropped entirely (no overlay caption). Page now
//   resolves only eyebrow/headline/intro/image via the ?? chain — panel
//   resolution lines + DEFAULT_PANEL_TITLE/BODY constants removed.
// Prior: S35 — Hero copy now overlay-driven via ?? chain. headline,
//   intro, eyebrow, panel title/body each fall through:
//     overlay field → frontend default
//   Hero image flows direct from overlay.hero_image_src (null = gradient
//   fallback in GuideHero).
// Prior: S35 — Refactored to prop-driven (slug parsing moved upstream).
//   Renamed imports: DiningGuideHero → GuideHero, GuideFilters →
//   DiningGuideFilters.

import React, { useEffect, useMemo, useState } from 'react'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'
import { useToast } from '../../lib/ToastContext'
import {
  getDiningVenuesByDestination,
  type DiningVenue,
  type GuideDestination,
} from '../../lib/diningGuideQueries'
import { DiningCard } from './DiningCard'
import { GuideHero } from './GuideHero'
import { DiningGuideFilters, type FilterState } from './DiningGuideFilters'

interface DiningGuidePageProps {
  destination: GuideDestination
}

// ── Frontend default copy ───────────────────────────────────────────────────
// Overlay fields fall through to these defaults when NULL.

const DEFAULT_EYEBROW = 'Curated Dining'

function defaultHeadline(destinationName: string): string {
  return `${destinationName} Dining`
}

function defaultIntro(destinationName: string): string {
  return `A selective dining guide for ${destinationName}`
}

// ── URL filter state sync ────────────────────────────────────────────────────

function readFilterStateFromUrl(): FilterState {
  const params = new URLSearchParams(window.location.search)
  const cuisinesParam = params.get('cuisine')
  const neighborhoodsParam = params.get('neighborhood')
  return {
    cuisines: new Set(cuisinesParam ? cuisinesParam.split(',').filter(Boolean) : []),
    michelinOnly: params.get('michelin') === '1',
    neighborhoods: new Set(neighborhoodsParam ? neighborhoodsParam.split(',').filter(Boolean) : []),
  }
}

function writeFilterStateToUrl(state: FilterState) {
  const params = new URLSearchParams()
  if (state.cuisines.size > 0) {
    params.set('cuisine', Array.from(state.cuisines).join(','))
  }
  if (state.michelinOnly) {
    params.set('michelin', '1')
  }
  if (state.neighborhoods.size > 0) {
    params.set('neighborhood', Array.from(state.neighborhoods).join(','))
  }
  const qs = params.toString()
  const next = `${window.location.pathname}${qs ? '?' + qs : ''}`
  window.history.replaceState(null, '', next)
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function DiningGuidePage({ destination }: DiningGuidePageProps) {
  const { toast } = useToast()
  const [venues, setVenues] = useState<DiningVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [filterState, setFilterState] = useState<FilterState>(() => readFilterStateFromUrl())

  // Resolve hero copy via overlay → default chain (?? not || per architecture)
  const overlay = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? DEFAULT_EYEBROW
  const heroHeadline = overlay?.headline_override ?? defaultHeadline(destination.name)
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? null

  // Fetch venues for the resolved destination
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const items = await getDiningVenuesByDestination(destination.slug)
        if (cancelled) return
        setVenues(items)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('DiningGuidePage: failed to load venues', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast.error(`Couldn't load dining venues — ${msg}`)
        setVenues([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug, toast])

  // Sync filter state to URL whenever it changes
  useEffect(() => {
    writeFilterStateToUrl(filterState)
  }, [filterState])

  // Derived filter options
  const availableCuisines = useMemo(() => {
    const set = new Set<string>()
    venues.forEach((v) => {
      if (v.cuisine_subcategory) set.add(v.cuisine_subcategory)
    })
    return Array.from(set).sort()
  }, [venues])

  const availableNeighborhoods = useMemo(() => {
    const set = new Set<string>()
    venues.forEach((v) => {
      if (v.neighborhood) set.add(v.neighborhood)
    })
    return Array.from(set).sort()
  }, [venues])

  const hasMichelinItems = useMemo(
    () => venues.some((v) => v.michelin),
    [venues],
  )

  // Filter logic
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      if (filterState.cuisines.size > 0) {
        if (!v.cuisine_subcategory || !filterState.cuisines.has(v.cuisine_subcategory)) {
          return false
        }
      }
      if (filterState.michelinOnly && !v.michelin) {
        return false
      }
      if (filterState.neighborhoods.size > 0) {
        if (!v.neighborhood || !filterState.neighborhoods.has(v.neighborhood)) {
          return false
        }
      }
      return true
    })
  }, [venues, filterState])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
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
          <LoadingState />
        </main>
      </>
    )
  }

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
        <DiningGuideFilters
          state={filterState}
          onChange={setFilterState}
          availableCuisines={availableCuisines}
          availableNeighborhoods={availableNeighborhoods}
          hasMichelinItems={hasMichelinItems}
        />

        <div style={sectionTitleStyle}>
          <h2 style={sectionTitleH2Style}>Selected tables</h2>
          <p style={sectionTitleCountStyle}>
            {filteredVenues.length} {filteredVenues.length === 1 ? 'restaurant' : 'restaurants'}
          </p>
        </div>

        {filteredVenues.length === 0 ? (
          <EmptyState />
        ) : (
          <section style={gridStyle}>
            {filteredVenues.map((v) => (
              <DiningCard
                key={v.id}
                venue={v}
                hasFullAccess={true}
                destinationName={destination.name}
              />
            ))}
          </section>
        )}
      </main>
    </>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={messageBlockStyle}>
      <p style={messageTextStyle}>Setting the table.</p>
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

// ── Styles ───────────────────────────────────────────────────────────────────

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
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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