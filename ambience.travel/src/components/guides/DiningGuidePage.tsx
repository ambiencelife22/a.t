// DiningGuidePage.tsx — public dining guide for a destination
// What it owns:
//   - Venue data fetch
//   - Filter state + URL param sync (cuisine, michelin, neighborhood)
//   - Frontend default copy + ?? resolution against overlay overrides
//   - Year + version resolution for PDF (NULL → current year / '1.0')
//   - Grid layout, error+empty states for the data load
//   - PDF download trigger (loads jsPDF, calls exportGuidePdf)
//
// What it does not own:
//   - Path parsing (DiningGuideRoute)
//   - Destination validation (DiningGuideRoute)
//   - Page chrome (GuideLayout)
//   - Card rendering (DiningCard), filter chips (DiningGuideFilters), hero (GuideHero)
//   - PDF rendering itself (lib/guidePdf.ts owns full lifecycle, including
//     loading /emblem.png + /ambience_travel.svg)
//
// Last updated: S37 — Widened Michelin filter chip to match both stars and
//   Bib Gourmand (was stars-only). Bib counts as Michelin recognition; one
//   chip captures both tiers.
// Prior: S37 — Added RecognitionKeyStrip above filters. Migrated Michelin
//   filter chip to read michelin_award='star' instead of legacy boolean.
// Prior: S37 — Year + version pulled from overlay with render-time defaults.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'
import { useToast } from '../../lib/ToastContext'
import {
  getDiningVenuesByDestination,
  type DiningVenue,
  type GuideDestination,
} from '../../lib/diningGuideQueries'
import { exportGuidePdf } from '../../lib/guidePdf'
import { DiningCard } from './DiningCard'
import { GuideHero } from './GuideHero'
import { DiningGuideFilters, type FilterState } from './DiningGuideFilters'
import { RecognitionKeyStrip, deriveRecognitionKindsFromVenues } from './RecognitionKey'

interface DiningGuidePageProps {
  destination: GuideDestination
}

// ── Frontend default copy ───────────────────────────────────────────────────

const DEFAULT_EYEBROW = 'Curated Dining'

function defaultHeadline(destinationName: string): string {
  return `${destinationName} Dining`
}

function defaultIntro(destinationName: string): string {
  return `A selective dining guide for ${destinationName}`
}

// ── PDF year + version defaults (S37) ────────────────────────────────────────
// NULL on either column → render-time default. Live page does not surface
// these today; they exist solely for the PDF cover.

const DEFAULT_GUIDE_VERSION = '1.0'

function resolveGuideYear(overlayYear: number | null | undefined): number {
  if (overlayYear != null) return overlayYear
  return new Date().getFullYear()
}

function resolveGuideVersion(overlayVersion: string | null | undefined): string {
  if (overlayVersion != null && overlayVersion.trim().length > 0) return overlayVersion
  return DEFAULT_GUIDE_VERSION
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
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const [venues, setVenues] = useState<DiningVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [filterState, setFilterState] = useState<FilterState>(() => readFilterStateFromUrl())

  // ── PDF library loader ─────────────────────────────────────────────────────
  // Loads jsPDF only — we use canvas for SVG rasterisation, no autoTable.
  // Idempotent: reuses existing script tag if mounted by another page.
  const [pdfReady, setPdfReady] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)

  useEffect(() => {
    const w = window as any
    if (w.jspdf?.jsPDF) { setPdfReady(true); return }

    function loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
        if (existing) {
          if ((window as any).jspdf?.jsPDF) { resolve(); return }
          existing.addEventListener('load', () => resolve())
          existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
          return
        }
        const s = document.createElement('script')
        s.src = src
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
    }

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      .then(() => setPdfReady(true))
      .catch((err) => { console.error('PDF library load error:', err) })
  }, [])

  // ── Resolved hero copy ─────────────────────────────────────────────────────

  const overlay = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? DEFAULT_EYEBROW
  const heroHeadline = overlay?.headline_override ?? defaultHeadline(destination.name)
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? null

  // ── Venue fetch ────────────────────────────────────────────────────────────

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
        toastRef.current.error(`Couldn't load dining venues — ${msg}`)
        setVenues([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug])

  useEffect(() => {
    writeFilterStateToUrl(filterState)
  }, [filterState])

  // ── Derived filter inputs ──────────────────────────────────────────────────

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
    () => venues.some((v) => v.michelin_award === 'star' || v.michelin_award === 'bib_gourmand'),
    [venues],
  )

  // Recognition kinds present in the *full* venue list — drives the page-top
  // key strip. Computed against `venues` not `filteredVenues` so the legend
  // doesn't disappear/reappear as filters narrow the view.
  const presentRecognitionKinds = useMemo(
    () => deriveRecognitionKindsFromVenues(venues),
    [venues],
  )

  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      if (filterState.cuisines.size > 0) {
        if (!v.cuisine_subcategory || !filterState.cuisines.has(v.cuisine_subcategory)) {
          return false
        }
      }
      if (filterState.michelinOnly && v.michelin_award !== 'star' && v.michelin_award !== 'bib_gourmand') {
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

  // ── PDF download handler ───────────────────────────────────────────────────

  async function handleDownloadPdf() {
    if (!pdfReady) {
      toastRef.current.info('PDF library is still loading. Try again in a moment.')
      return
    }
    if (venues.length === 0) {
      toastRef.current.info('No venues to export yet.')
      return
    }
    setPdfDownloading(true)
    try {
      const guideYear    = resolveGuideYear(overlay?.guide_year)
      const guideVersion = resolveGuideVersion(overlay?.guide_version)

      await exportGuidePdf({
        variant: 'dining',
        destination,
        venues,
        copy: {
          eyebrow:  heroEyebrow,
          headline: heroHeadline,
          intro:    heroIntro,
        },
        heroImageSrc,
        guideYear,
        guideVersion,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toastRef.current.error(`PDF export failed — ${msg}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
            <RecognitionKeyStrip presentKinds={presentRecognitionKinds} />

            <DiningGuideFilters
              state={filterState}
              onChange={setFilterState}
              availableCuisines={availableCuisines}
              availableNeighborhoods={availableNeighborhoods}
              hasMichelinItems={hasMichelinItems}
            />

            <div style={sectionTitleStyle}>
              <div>
                <h2 style={sectionTitleH2Style}>Selected tables</h2>
                <p style={sectionTitleCountStyle}>
                  {filteredVenues.length} {filteredVenues.length === 1 ? 'restaurant' : 'restaurants'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!pdfReady || pdfDownloading || venues.length === 0}
                style={{
                  ...downloadBtnStyle,
                  ...(pdfReady && !pdfDownloading ? {} : downloadBtnDisabledStyle),
                }}
                title={pdfReady ? 'Download this guide as a PDF' : 'PDF library loading…'}
              >
                <span aria-hidden style={downloadIconStyle}>↓</span>
                {pdfDownloading ? 'Preparing…' : 'Download PDF'}
              </button>
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
          </>
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
  margin: '4px 0 0',
  color: ID.muted,
  fontSize: 14,
}

const downloadBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 18px',
  border: `1px solid ${IMMERSE.goldBorder}`,
  borderRadius: 999,
  background: IMMERSE.goldTint,
  color: ID.gold,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  transition: 'background 180ms ease, border-color 180ms ease',
  whiteSpace: 'nowrap',
}

const downloadBtnDisabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

const downloadIconStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
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