/* GuidePageDining.tsx — public dining guide for a destination.
 *
 * What it owns:
 *   - Venue data fetch
 *   - Happenings data fetch
 *   - Filter state + URL param sync (cuisine, michelin, highlighted)
 *   - Group derivation (primary, supplementary, recently closed)
 *   - Section title rendering
 *   - PDF download trigger dispatch
 *
 * What it does not own:
 *   - Path parsing (DiningGuideRoute)
 *   - Destination validation (DiningGuideRoute)
 *   - Page chrome (GuideLayout)
 *   - Card rendering (GuideCardDining)
 *   - Hero rendering (GuideHero) and hero copy resolution (useGuideHero)
 *   - Gating decisions (utilsGuideGating)
 *   - Editorial prompt chrome (GuideEditorialPrompt)
 *   - At-a-glance chrome (GuideAtAGlance)
 *   - Plan Your Visit chrome (GuidePlanYourVisit)
 *   - ComingUp chrome (GuideComingUpSection)
 *   - Section header + count formatting (typesGuides: formatSectionHeader)
 *   - PDF year/version resolution (utilsGuidePdf)
 *   - Style objects (stylesGuidePage)
 *
 * Last updated: S53 — Nine-file guide-layer extraction. All shared behaviour
 *   moves to utilsGuideGating, useGuideHero, GuideEditorialPrompt, GuideAtAGlance,
 *   and the extended GUIDE_COPY. Inline editorial prompt, loading state,
 *   empty state, hero resolution, PDF resolvers, and gating math all gone.
 * Prior: S52 — GuideSectionBreak component. Three-group render.
 *   Happenings infrastructure.
 * Prior: S41 — usePdfDownload hook extraction.
 * Prior: S40C — hasFullAccess prop added.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  getDiningVenuesByDestination,
  type DiningVenue,
} from '../../queries/queriesGuidesDining'
import {
  fetchActiveHappeningsForDestination,
  type Happening,
} from '../../queries/queriesGuidesHappenings'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { useGuideHero } from '../../hooks/useGuideHero'
import { GuideCardDining } from './GuideCardDining'
import { GuideHero } from './GuideHero'
import { GuideSectionBreak } from './GuideSectionBreak'
import { GuideFiltersDining, type FilterState } from './GuideFiltersDining'
import { GuideRecognitionKeyStrip, deriveRecognitionKindsFromVenues } from './GuideRecognitionKey'
import { GuideComingUpSection } from './GuideComingUpSection'
import { GuidePlanYourVisit } from './GuidePlanYourVisit'
import { GuideAtAGlance } from './GuideAtAGlance'
import { GuideEditorialPrompt } from './GuideEditorialPrompt'
import {
  GUIDE_COPY,
  formatSectionHeader,
  type GuideDestination,
} from '../../types/typesGuides'
import {
  filterVisibleItems,
  shouldShowAdvisorExtras,
  shouldShowEditorialPrompt,
} from '../../utils/utilsGuideGating'
import {
  resolveGuideYear,
  resolveGuideVersion,
} from '../../utils/utilsGuidePdf'
import {
  pageStyle,
  sectionTitleStyle,
  sectionTitleH2Style,
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

const VARIANT = 'dining' as const

interface GuidePageDiningProps {
  destination:   GuideDestination
  hasFullAccess: boolean
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

export default function GuidePageDining({ destination, hasFullAccess }: GuidePageDiningProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [venues,      setVenues]      = useState<DiningVenue[]>([])
  const [happenings,  setHappenings]  = useState<Happening[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterState, setFilterState] = useState<FilterState>(() => readFilterStateFromUrl())

  const hero    = useGuideHero(destination, VARIANT)
  const overlay = destination.overlay

  const atAGlanceBullets = useMemo(
    () => overlay?.at_a_glance_bullets ?? [],
    [overlay],
  )

  const hasHighlightedItems = useMemo(() => venues.some(v => v.is_highlighted), [venues])

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
        } else {
          console.error('GuidePageDining: failed to load venues', venuesResult.reason)
          const msg = venuesResult.reason instanceof Error ? venuesResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load dining venues: ${msg}`)
          setVenues([])
        }

        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        } else {
          console.error('GuidePageDining: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('GuidePageDining: unexpected load error', err)
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

    const visible = filterVisibleItems(venues, hasFullAccess)

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
        eyebrow={hero.eyebrow}
        headline={hero.headline}
        intro={hero.intro}
        imageSrc={hero.imageSrc}
        imageAlt={hero.imageAlt}
      />

      <main style={pageStyle}>
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {atAGlanceBullets.length > 0 && <GuideAtAGlance bullets={atAGlanceBullets} />}

            <GuideRecognitionKeyStrip presentKinds={presentRecognitionKinds} />

            <GuideFiltersDining
              state={filterState}
              onChange={setFilterState}
              availableCuisines={availableCuisines}
              hasMichelinItems={hasMichelinItems}
              hasHighlightedItems={hasHighlightedItems}
            />

            <div style={sectionTitleStyle}>
              <h2 style={sectionTitleH2Style}>
                {formatSectionHeader(VARIANT, totalVisible)}
              </h2>
              <button
                type="button"
                onClick={() => handleDownloadPdf({
                  variant:      VARIANT,
                  destination,
                  venues,
                  happenings,
                  copy:         { eyebrow: hero.eyebrow, headline: hero.headline, intro: hero.intro },
                  heroImageSrc: hero.imageSrc,
                  guideYear:    resolveGuideYear(overlay?.guide_year),
                  guideVersion: resolveGuideVersion(overlay?.guide_version),
                  accuracyDate: overlay?.accuracy_date ?? null,
                })}
                disabled={!pdfReady || pdfDownloading || venues.length === 0}
                style={{
                  ...downloadBtnStyle,
                  ...(pdfReady && !pdfDownloading ? {} : downloadBtnDisabledStyle),
                }}
                title={pdfReady ? 'Download this guide as a PDF' : 'PDF library loading\u2026'}
              >
                <span aria-hidden style={downloadIconStyle}>{'\u2193'}</span>
                {pdfDownloading ? 'Preparing\u2026' : 'Download PDF'}
              </button>
            </div>

            {totalVisible === 0 ? (
              <EmptyState />
            ) : (
              <>
                <section style={gridStyle}>
                  {primaryVenues.map(v => (
                    <GuideCardDining
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
                    <GuideCardDining
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
                    <GuideCardDining
                      key={v.id}
                      venue={v}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}
                </section>

                {shouldShowEditorialPrompt(totalVisible, venues.length, hasFullAccess) && (
                  <GuideEditorialPrompt variant={VARIANT} destinationName={destination.name} />
                )}
              </>
            )}

            {shouldShowAdvisorExtras(hasFullAccess) && (
              <GuideComingUpSection
                happenings={happenings}
                hasFullAccess={hasFullAccess}
                destinationName={destination.name}
              />
            )}

            {shouldShowAdvisorExtras(hasFullAccess) && (
              <GuidePlanYourVisit overlay={overlay} variant={VARIANT} />
            )}

            {overlay?.accuracy_date && (
              <div style={disclaimerStyle}>
                <p style={disclaimerTextStyle}>
                  The venues and recognition listed in this guide reflect our knowledge as of {overlay.accuracy_date}. The dining industry evolves continuously; restaurants close, chefs move, and accolades are reassigned. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

// ── Loading + Empty States ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={messageBlockStyle}>
      <p style={messageTextStyle}>{GUIDE_COPY[VARIANT].loadingStateText}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={emptyStateStyle}>
      <p style={emptyStateTextStyle}>{GUIDE_COPY[VARIANT].emptyStateText}</p>
    </div>
  )
}