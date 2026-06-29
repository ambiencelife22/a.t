// DiningGuidePage.tsx — public dining guide for a destination
// What it owns:
//   - Venue data fetch
//   - Happenings data fetch (S52)
//   - Filter state + URL param sync (cuisine, michelin)
//   - Frontend default copy + ?? resolution against overlay overrides
//   - Year + version resolution for PDF
//   - Grid layout with three groups: primary, supplementary, recently closed
//   - PDF download trigger (usePdfDownload hook)
//   - "Coming Up" happenings block (S52)
//   - Plan Your Visit block
//   - Accuracy disclaimer block
//   - Editorial prompt (hasFullAccess=false teaser state)
//
// What it does not own:
//   - Path parsing (DiningGuideRoute)
//   - Destination validation
//   - Page chrome (GuideLayout)
//   - Card rendering (DiningCard, HappeningCard), filters, hero
//   - ComingUp section chrome
//   - PDF rendering itself
//   - PDF library loading (useGuidePdf hook)
//   - Style objects (guidePageStyles.ts)
//   - PYV section chrome + fallback copy (PlanYourVisit.tsx)
//   - Section break rendering (GuideSectionBreak.tsx)
//
// Render groups (S52):
//   1. Primary (is_supplementary=false, operational venues)
//   2. Supplementary (is_supplementary=true, operational venues)
//      Editorial section break above: "Also Nearby"
//   3. Recently closed (venue_status='permanently_closed' AND
//      closed_visible_until >= today)
//      Editorial section break above: "Recently Closed"
//   Beyond closed_visible_until, permanently_closed venues are filtered out
//   entirely. All groups alphabetical within group.
//
// Last updated: S52 — GuideSectionBreak component replaces the lightweight
//   supplementaryDivider treatment. "Also nearby" and "Recently closed" now
//   render as full editorial section breaks with eyebrow + serif heading +
//   descriptor. Treats each as a deliberate chapter rather than a row separator.
// Prior: S52 — Three-group render added.
// Prior: S52 — happenings infrastructure added.
// Prior: S41 — jsPDF load + handleDownloadPdf extracted to usePdfDownload hook.
// Prior: S40C — hasFullAccess prop added.
// Prior: S40 — Neighborhoods removed from FilterState.
// Prior: S40 — Supplementary-last sort. Divider above first supplementary venue.
// Prior: S40 — Canon hero resolution via destination.heroImageSrc.
// Prior: S40 — PlanYourVisit extracted. Gate removed.
// Prior: S40 — Inline styles extracted to lib/guidePageStyles.ts.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  getDiningVenuesByDestination,
  type DiningVenue,
  type GuideDestination,
} from '../../queries/queriesGuidesDining'
import {
  fetchActiveHappeningsForDestination,
  type Happening,
} from '../../queries/queriesGuidesHappenings'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { DiningCard } from './DiningCard'
import { GuideHero } from './GuideHero'
import { GuideSectionBreak } from './GuideSectionBreak'
import { DiningGuideFilters, type FilterState } from './DiningGuideFilters'
import { RecognitionKeyStrip, deriveRecognitionKindsFromVenues } from './RecognitionKey'
import { ComingUpSection } from './ComingUpSection'
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
  disclaimerStyle,
  disclaimerTextStyle,
  messageBlockStyle,
  messageTextStyle,
  emptyStateStyle,
  emptyStateTextStyle,
} from '../../styles/stylesGuidePage'

import { GUIDE_COPY } from '../../types/typesGuides'

interface DiningGuidePageProps {
  destination:   GuideDestination
  hasFullAccess: boolean
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

// ── Today as YYYY-MM-DD (local) — for closed_visible_until comparisons ──────

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
  const [happenings,  setHappenings]  = useState<Happening[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterState, setFilterState] = useState<FilterState>(() => readFilterStateFromUrl())

  const hasHighlightedItems = useMemo(() => venues.some(v => v.is_highlighted), [venues])

  // ── Resolved hero copy ───────────────────────────────────────────────────

  const overlay      = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? destination.name
  const heroHeadline = overlay?.headline_override ?? GUIDE_COPY.dining.defaultHeadline
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? destination.heroImageSrc ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? destination.heroImageAlt ?? null

  // ── Venue + happenings fetch ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [venuesResult, happeningsResult] = await Promise.allSettled([
          getDiningVenuesByDestination(destination.slug),
          fetchActiveHappeningsForDestination(destination.id, { surface: 'dining' }),
        ])
        if (cancelled) return

        if (venuesResult.status === 'fulfilled') {
          setVenues(venuesResult.value)
        }
        if (venuesResult.status !== 'fulfilled') {
          console.error('DiningGuidePage: failed to load venues', venuesResult.reason)
          const msg = venuesResult.reason instanceof Error ? venuesResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load dining venues: ${msg}`)
          setVenues([])
        }

        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        }
        if (happeningsResult.status !== 'fulfilled') {
          console.error('DiningGuidePage: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('DiningGuidePage: unexpected load error', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toastRef.current.error(`Couldn't load dining venues: ${msg}`)
        setVenues([])
        setHappenings([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug, destination.id])

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

  // ── Group venues: primary, supplementary, recently closed ────────────────

  const today = useMemo(() => todayISO(), [])

  const { primaryVenues, supplementaryVenues, recentlyClosedVenues } = useMemo(() => {
    function passesFilters(v: DiningVenue): boolean {
      if (filterState.cuisines.size > 0) {
        if (!v.cuisine_subcategory || !filterState.cuisines.has(v.cuisine_subcategory)) return false
      }
      if (filterState.michelinOnly && v.michelin_award !== 'star' && v.michelin_award !== 'bib_gourmand') return false
      if (filterState.highlightedOnly && !v.is_highlighted) return false
      return true
    }

    function isRecentlyClosed(v: DiningVenue): boolean {
      if (v.venue_status !== 'permanently_closed') return false
      if (!v.closed_visible_until) return false
      return v.closed_visible_until >= today
    }

    const visible = hasFullAccess
      ? venues
      : venues.filter(v => v.public_preview_rank != null)

    const primary:       DiningVenue[] = []
    const supplementary: DiningVenue[] = []
    const closed:        DiningVenue[] = []

    for (const v of visible) {
      if (!passesFilters(v)) continue

      if (isRecentlyClosed(v)) {
        closed.push(v)
        continue
      }

      if (v.venue_status === 'permanently_closed') continue

      if (v.is_supplementary) {
        supplementary.push(v)
      } else {
        primary.push(v)
      }
    }

    const byName = (a: DiningVenue, b: DiningVenue) => a.name.localeCompare(b.name)
    primary.sort(byName)
    supplementary.sort(byName)
    closed.sort(byName)

    return {
      primaryVenues:        primary,
      supplementaryVenues:  supplementary,
      recentlyClosedVenues: closed,
    }
  }, [venues, filterState, hasFullAccess, today])

  const totalVisible =
    primaryVenues.length + supplementaryVenues.length + recentlyClosedVenues.length

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
                  {hasFullAccess ? totalVisible : venues.length}{' '}
                  {(hasFullAccess ? totalVisible : venues.length) === 1 ? 'restaurant' : 'restaurants'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadPdf({
                  variant:      'dining',
                  destination,
                  venues,
                  happenings,
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

            {totalVisible === 0 ? (
              <EmptyState />
            ) : (
              <>
                <section style={gridStyle}>
                  {primaryVenues.map(v => (
                    <DiningCard
                      key={v.id}
                      venue={v}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}

                  {supplementaryVenues.length > 0 && primaryVenues.length > 0 && (
                    <GuideSectionBreak
                      eyebrow="Beyond The Highlighted"
                      heading="Also Nearby"
                      descriptor={`Additional tables guests have considered.`}
                    />
                  )}
                  {supplementaryVenues.map(v => (
                    <DiningCard
                      key={v.id}
                      venue={v}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}

                  {recentlyClosedVenues.length > 0 &&
                    (primaryVenues.length > 0 || supplementaryVenues.length > 0) && (
                    <GuideSectionBreak
                      eyebrow="For Reference"
                      heading="Recently Closed"
                      descriptor="Tables that have recently closed their doors. Kept here briefly so the record stays current and any prior recommendation has context."
                    />
                  )}
                  {recentlyClosedVenues.map(v => (
                    <DiningCard
                      key={v.id}
                      venue={v}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}
                </section>

                {!hasFullAccess && (
                  <EditorialPrompt destinationName={destination.name} />
                )}
              </>
            )}

            {hasFullAccess && (
              <ComingUpSection
                happenings={happenings}
                hasFullAccess={hasFullAccess}
                destinationName={destination.name}
              />
            )}

            {hasFullAccess && <PlanYourVisit overlay={overlay} variant="dining" />}

            {overlay?.accuracy_date && (
              <div style={disclaimerStyle}>
                <p style={disclaimerTextStyle}>
                  The venues and recognition listed in this guide reflect our knowledge as of {overlay.accuracy_date}. The dining industry evolves continuously... restaurants close, chefs move, and accolades are reassigned. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.
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