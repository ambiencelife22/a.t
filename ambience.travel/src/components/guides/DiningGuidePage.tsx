// DiningGuidePage.tsx — public dining guide for a destination
// What it owns:
//   - Venue data fetch
//   - Filter state + URL param sync (cuisine, michelin)
//   - Frontend default copy + ?? resolution against overlay overrides
//   - Year + version resolution for PDF (NULL → current year / '1.0')
//   - Grid layout, error+empty states for the data load
//   - PDF download trigger (usePdfDownload hook, calls exportGuidePdf)
//   - Plan Your Visit block (always renders — fallback copy when overlay null)
//   - Accuracy disclaimer block (gated on overlay.accuracy_date non-null)
//   - Editorial prompt (hasFullAccess=false — teaser state, below grid)
//
// What it does not own:
//   - Path parsing (DiningGuideRoute)
//   - Destination validation (DiningGuideRoute)
//   - Page chrome (GuideLayout)
//   - Card rendering (DiningCard), filter chips (DiningGuideFilters), hero (GuideHero)
//   - PDF rendering itself (lib/guidePdf.ts owns full lifecycle)
//   - PDF library loading (lib/usePdfDownload.ts owns this)
//   - Style objects (lib/guidePageStyles.ts)
//   - PYV section chrome + fallback copy (PlanYourVisit.tsx)
//
// Hero resolution (S40):
//   overlay?.hero_image_src ?? destination.heroImageSrc ?? null
//   Canon hero lives on global_destinations. Overlay overrides only when set.
//
// Sort (S40):
//   Non-supplementary venues alphabetical first, supplementary alphabetical last.
//   A subtle divider renders above the first supplementary venue in the grid.
//   public_preview_rank is a gating mechanism only — no sort influence.
//
// Last updated: S41 — jsPDF load + handleDownloadPdf extracted to
//   usePdfDownload hook. No functional changes.
// Prior: S40C — hasFullAccess prop added. Ungated users see venues
//   where public_preview_rank IS NOT NULL (teaser cards). Editorial prompt
//   renders below grid when hasFullAccess=false.
// Prior: S40 — Neighborhoods removed from FilterState, URL sync, filter logic.
// Prior: S40 — Supplementary-last sort. Divider above first supplementary venue.
// Prior: S40 — Always alphabetical sort.
// Prior: S40 — Canon hero resolution via destination.heroImageSrc.
// Prior: S40 — PlanYourVisit extracted. Gate removed.
// Prior: S40 — Inline styles extracted to lib/guidePageStyles.ts.
// Prior: S39 Add 1 — Added Plan Your Visit block.
// Prior: S39 — Added accuracy disclaimer block.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  getDiningVenuesByDestination,
  type DiningVenue,
  type GuideDestination,
} from '../../queries/queriesGuidesDining'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { DiningCard } from './DiningCard'
import { GuideHero } from './GuideHero'
import { DiningGuideFilters, type FilterState } from './DiningGuideFilters'
import { RecognitionKeyStrip, deriveRecognitionKindsFromVenues } from './RecognitionKey'
import { PlanYourVisit } from './PlanYourVisit'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import {
  pageStyle,
  sectionTitleStyle,
  sectionTitleH2Style,
  sectionTitleCountStyle,
  downloadBtnStyle,
  downloadBtnDisabledStyle,
  downloadIconStyle,
  gridStyle,
  supplementaryDividerStyle,
  supplementaryLabelStyle,
  disclaimerStyle,
  disclaimerTextStyle,
  messageBlockStyle,
  messageTextStyle,
  emptyStateStyle,
  emptyStateTextStyle,
} from '../../styles/stylesGuidePage'

interface DiningGuidePageProps {
  destination:   GuideDestination
  hasFullAccess: boolean
}

// ── Frontend default copy ────────────────────────────────────────────────────

const DEFAULT_EYEBROW = 'Curated Dining'

function defaultHeadline(destinationName: string): string {
  return `${destinationName} Dining`
}

function defaultIntro(destinationName: string): string {
  return `A selective dining guide for ${destinationName}`
}

// ── PDF year + version defaults ──────────────────────────────────────────────

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
  return {
    cuisines:        new Set(cuisinesParam ? cuisinesParam.split(',').filter(Boolean) : []),
    michelinOnly:    params.get('michelin') === '1',
    highlightedOnly: params.get('highlighted') === '1',
  }
}

function writeFilterStateToUrl(state: FilterState) {
  const params = new URLSearchParams()
  if (state.cuisines.size > 0) params.set('cuisine', Array.from(state.cuisines).join(','))
  if (state.michelinOnly)      params.set('michelin', '1')
  if (state.highlightedOnly)   params.set('highlighted', '1')
  const qs   = params.toString()
  const next = `${window.location.pathname}${qs ? '?' + qs : ''}`
  window.history.replaceState(null, '', next)
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function DiningGuidePage({ destination, hasFullAccess }: DiningGuidePageProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [venues,      setVenues]      = useState<DiningVenue[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterState, setFilterState] = useState<FilterState>(() => readFilterStateFromUrl())

  const hasHighlightedItems = useMemo(() => venues.some(v => v.is_highlighted), [venues])

  // ── Resolved hero copy ───────────────────────────────────────────────────

  const overlay      = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? DEFAULT_EYEBROW
  const heroHeadline = overlay?.headline_override ?? defaultHeadline(destination.name)
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? destination.heroImageSrc ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? destination.heroImageAlt ?? null

  // ── Venue fetch ──────────────────────────────────────────────────────────

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
        toastRef.current.error(`Couldn't load dining venues: ${msg}`)
        setVenues([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug])

  useEffect(() => { writeFilterStateToUrl(filterState) }, [filterState])

  // ── Derived filter inputs ────────────────────────────────────────────────

  const availableCuisines = useMemo(() => {
    const set = new Set<string>()
    venues.forEach(v => { if (v.cuisine_subcategory) set.add(v.cuisine_subcategory) })
    return Array.from(set).sort()
  }, [venues])

  const hasMichelinItems = useMemo(
    () => venues.some(v => v.michelin_award === 'star' || v.michelin_award === 'bib_gourmand'),
    [venues],
  )

  const presentRecognitionKinds = useMemo(
    () => deriveRecognitionKindsFromVenues(venues),
    [venues],
  )

  const filteredVenues = useMemo(() => {
    const visible = hasFullAccess
      ? venues
      : venues.filter(v => v.public_preview_rank != null)

    const filtered = visible.filter(v => {
      if (filterState.cuisines.size > 0) {
        if (!v.cuisine_subcategory || !filterState.cuisines.has(v.cuisine_subcategory)) return false
      }
      if (filterState.michelinOnly && v.michelin_award !== 'star' && v.michelin_award !== 'bib_gourmand') return false
      if (filterState.highlightedOnly && !v.is_highlighted) return false
      return true
    })

    return filtered.sort((a, b) => {
      if (a.is_supplementary !== b.is_supplementary) return a.is_supplementary ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [venues, filterState, hasFullAccess])

  const firstSupplementaryIndex = useMemo(
    () => filteredVenues.findIndex(v => v.is_supplementary),
    [filteredVenues],
  )

  // ── Render ───────────────────────────────────────────────────────────────

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
              hasMichelinItems={hasMichelinItems}
              hasHighlightedItems={hasHighlightedItems}
            />

            <div style={sectionTitleStyle}>
              <div>
                <h2 style={sectionTitleH2Style}>Selected tables</h2>
                <p style={sectionTitleCountStyle}>
                  {hasFullAccess ? filteredVenues.length : venues.length}{' '}
                  {(hasFullAccess ? filteredVenues.length : venues.length) === 1 ? 'restaurant' : 'restaurants'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadPdf({
                  variant:      'dining',
                  destination,
                  venues,
                  copy:         { eyebrow: heroEyebrow, headline: heroHeadline, intro: heroIntro },
                  heroImageSrc,
                  guideYear:    resolveGuideYear(overlay?.guide_year),
                  guideVersion: resolveGuideVersion(overlay?.guide_version),
                  accuracyDate: overlay?.accuracy_date ?? null,
                })}
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
              <>
                <section style={gridStyle}>
                  {filteredVenues.map((v, i) => (
                    <React.Fragment key={v.id}>
                      {i === firstSupplementaryIndex && firstSupplementaryIndex > 0 && (
                        <div style={supplementaryDividerStyle}>
                          <span style={supplementaryLabelStyle}>Also nearby</span>
                        </div>
                      )}
                      <DiningCard
                        venue={v}
                        hasFullAccess={hasFullAccess}
                        destinationName={destination.name}
                      />
                    </React.Fragment>
                  ))}
                </section>

                {!hasFullAccess && (
                  <EditorialPrompt destinationName={destination.name} />
                )}
              </>
            )}

            {hasFullAccess && <PlanYourVisit overlay={overlay} variant="dining" />}

            {overlay?.accuracy_date && (
              <div style={disclaimerStyle}>
                <p style={disclaimerTextStyle}>
                  The venues and recognition listed in this guide reflect our knowledge as of {overlay.accuracy_date}. The dining industry evolves continuously — restaurants close, chefs move, and accolades are reassigned. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

// ── Editorial Prompt ─────────────────────────────────────────────────────────

function EditorialPrompt({ destinationName }: { destinationName: string }) {
  return (
    <div style={{
      marginTop:     48,
      padding:       'clamp(40px, 6vw, 64px) clamp(24px, 6vw, 48px)',
      textAlign:     'center',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           20,
      background:    ID.panel,
      borderTop:     `1px solid ${IMMERSE.tableBorder}`,
      borderBottom:  `1px solid ${IMMERSE.tableBorder}`,
      borderRadius:  24,
    }}>
      <div style={{
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color:         ID.gold,
      }}>
        {destinationName} · Dining Guide
      </div>
      <p style={{
        fontSize:   'clamp(22px, 3.5vw, 32px)',
        fontWeight: 400,
        fontFamily: FONTS.serif,
        color:      ID.text,
        lineHeight: 1.2,
        margin:     0,
        maxWidth:   480,
        fontStyle:  'italic',
      }}>
        There is more to this table.
      </p>
      <p style={{
        fontSize:   14,
        color:      ID.muted,
        lineHeight: 1.6,
        margin:     0,
        maxWidth:   400,
      }}>
        The full {destinationName} dining guide is available to invited guests.
        Contact your ambience team member to request access.
      </p>
    </div>
  )
}

// ── Loading + Empty States ───────────────────────────────────────────────────

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