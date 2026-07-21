/* GuidePageHotels.tsx - public hotels guide for a destination.
 *
 * Mirrors GuidePageDining / GuidePageShopping / GuidePageExperiences
 * structure. All shared behaviour lives in shared helpers.
 *
 * What it owns:
 *   - Hotel data fetch
 *   - Happenings data fetch (surface='hotels')
 *   - Filter state (stars, forbes, partners)
 *   - Section title rendering
 *   - PDF download trigger dispatch
 *
 * What it does not own:
 *   - Path parsing (HotelGuideRoute)
 *   - Destination validation (HotelGuideRoute)
 *   - Page chrome (GuideLayout)
 *   - Card rendering (GuideCardHotels)
 *   - Hero rendering (GuideHero) and hero copy resolution (useGuideHero)
 *   - Filter chrome (GuideFiltersHotels)
 *   - Gating decisions (utilsGuideGating)
 *   - Editorial prompt chrome (GuideEditorialPrompt)
 *   - At-a-glance chrome (GuideAtAGlance)
 *   - Plan Your Visit chrome (GuidePlanYourVisit)
 *   - ComingUp chrome (GuideComingUpSection)
 *   - Section header + count formatting (typesGuides: formatSectionHeader)
 *   - PDF year/version resolution (utilsGuidePdf)
 *   - Style objects (stylesGuidePage)
 *
 * Filter shape simpler than dining - no cuisine taxonomy on hotels.
 * Active filters: stars threshold, forbes-rated-only, preferred-partners-only.
 *
 * Last updated: S53 - Guard clauses only.
 * Prior: S53 - Nine-file guide-layer extraction. Every shared piece
 *   moves to the new modules; page reduces to fetch + filter + dispatch.
 * Prior: S53 - Brought to feature parity with dining/experiences/shopping.
 *   Added hasFullAccess prop, happenings fetch, PDF download, at-a-glance,
 *   ComingUp, GuidePlanYourVisit, accuracy disclaimer, editorial prompt.
 * Prior: S37 - initial.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  getHotelsByDestination,
  type HotelVenue,
} from '../../queries/queriesGuidesHotels'
import {
  fetchActiveHappeningsForDestination,
  type Happening,
} from '../../queries/queriesGuidesHappenings'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { useGuideHero } from '../../hooks/useGuideHero'
import { GuideCardHotels } from './GuideCardHotels'
import { GuideFiltersHotels, type HotelFilterState } from './GuideFiltersHotels'
import { GuideHero } from './GuideHero'
import { GuideComingUpSection } from './GuideComingUpSection'
import { GuidePlanYourVisit } from './GuidePlanYourVisit'
import { GuideAtAGlance } from './GuideAtAGlance'
import { GuideEditorialPrompt } from './GuideEditorialPrompt'
import { GuideDisclaimer } from './GuideDisclaimer'
import {
  GUIDE_COPY,
  formatSectionHeader,
  type GuideDestination,
} from '../../types/typesGuides'
import {
  filterVisibleItems,
  shouldShowAdvisorExtras,
  shouldShowEditorialPrompt,
sortByName,
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


  messageBlockStyle,
  messageTextStyle,
  emptyStateStyle,
  emptyStateTextStyle,
} from '../../styles/stylesGuidePage'

const VARIANT = 'hotels' as const

interface GuidePageHotelsProps {
  destination:   GuideDestination
  hasFullAccess: boolean
}

// ── URL filter state sync ────────────────────────────────────────────────────

function readFilterStateFromUrl(): HotelFilterState {
  const params = new URLSearchParams(window.location.search)
  return {
    minStars:     params.get('stars') ? parseInt(params.get('stars')!, 10) : null,
    forbesOnly:   params.get('forbes') === '1',
    partnersOnly: params.get('partners') === '1',
  }
}

function writeFilterStateToUrl(state: HotelFilterState) {
  const params = new URLSearchParams()
  if (state.minStars)     params.set('stars',    String(state.minStars))
  if (state.forbesOnly)   params.set('forbes',   '1')
  if (state.partnersOnly) params.set('partners', '1')
  const qs   = params.toString()
  const next = `${window.location.pathname}${qs ? '?' + qs : ''}`
  window.history.replaceState(null, '', next)
}

// ── Page component ───────────────────────────────────────────────────────────

export default function GuidePageHotels({
  destination,
  hasFullAccess,
}: GuidePageHotelsProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [hotels,      setHotels]      = useState<HotelVenue[]>([])
  const [happenings,  setHappenings]  = useState<Happening[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterState, setFilterState] = useState<HotelFilterState>(() => readFilterStateFromUrl())

  const hero    = useGuideHero(destination, VARIANT)
  const overlay = destination.overlay

  const atAGlanceBullets = useMemo(
    () => overlay?.atAGlanceBullets ?? [],
    [overlay],
  )

  // ── Hotel + happenings fetch ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [hotelsResult, happeningsResult] = await Promise.allSettled([
          getHotelsByDestination(destination.slug),
          fetchActiveHappeningsForDestination(destination.id, { surface: 'hotels' }),
        ])
        if (cancelled) return

        if (hotelsResult.status === 'rejected') {
          console.error('GuidePageHotels: failed to load hotels', hotelsResult.reason)
          const msg = hotelsResult.reason instanceof Error ? hotelsResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load hotels: ${msg}`)
          setHotels([])
        }
        if (hotelsResult.status === 'fulfilled') {
          setHotels(hotelsResult.value)
        }

        if (happeningsResult.status === 'rejected') {
          console.error('GuidePageHotels: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }
        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('GuidePageHotels: unexpected load error', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toastRef.current.error(`Couldn't load hotels: ${msg}`)
        setHotels([])
        setHappenings([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug, destination.id])

  useEffect(() => { writeFilterStateToUrl(filterState) }, [filterState])

  // ── Derived filter inputs ────────────────────────────────────────────────

  const hasForbes = useMemo(
    () => hotels.some(h => h.forbesRating !== null),
    [hotels],
  )
  const hasPartners = useMemo(
    () => hotels.some(h => h.isPreferredPartner),
    [hotels],
  )

  const filteredHotels = useMemo(() => {
    const base = sortByName(filterVisibleItems(hotels, hasFullAccess))
    return base.filter(h => {
      if (filterState.minStars && (h.stars === null || h.stars < filterState.minStars)) return false
      if (filterState.forbesOnly && h.forbesRating === null) return false
      if (filterState.partnersOnly && !h.isPreferredPartner) return false
      return true
    })
  }, [hotels, filterState, hasFullAccess])

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

            <GuideFiltersHotels
              state={filterState}
              onChange={setFilterState}
              hasForbes={hasForbes}
              hasPartners={hasPartners}
            />

            <div style={sectionTitleStyle}>
              <h2 style={sectionTitleH2Style}>
                {formatSectionHeader(VARIANT, filteredHotels.length)}
              </h2>
              {shouldShowAdvisorExtras(hasFullAccess) && (
                <button
                  type="button"
                  onClick={() => handleDownloadPdf({
                    variant:      VARIANT,
                    destination,
                    venues:       hotels,
                    happenings,
                    copy:         { eyebrow: hero.eyebrow, headline: hero.headline, intro: hero.intro },
                    heroImageSrc: hero.imageSrc,
                    guideYear:    resolveGuideYear(overlay?.guideYear),
                    guideVersion: resolveGuideVersion(overlay?.guideVersion),
                    accuracyDate: overlay?.accuracyDate ?? null,
                  })}
                  disabled={!pdfReady || pdfDownloading || hotels.length === 0}
                  style={{
                    ...downloadBtnStyle,
                    ...(pdfReady && !pdfDownloading ? {} : downloadBtnDisabledStyle),
                  }}
                  title={pdfReady ? 'Download this guide as a PDF' : 'PDF library loading\u2026'}
                >
                  <span aria-hidden style={downloadIconStyle}>{'\u2193'}</span>
                  {pdfDownloading ? 'Preparing\u2026' : 'Download PDF'}
                </button>
              )}
            </div>

            {filteredHotels.length === 0 ? (
              shouldShowAdvisorExtras(hasFullAccess)
                ? <EmptyState />
                : <GuideEditorialPrompt variant={VARIANT} destinationName={destination.name} />
            ) : (
              <>
                <section style={gridStyle}>
                  {filteredHotels.map(h => (
                    <GuideCardHotels
                      key={h.id}
                      hotel={h}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}
                </section>

                {shouldShowEditorialPrompt(filteredHotels.length, hotels.length, hasFullAccess) && (
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

            {overlay?.accuracyDate && (
              <GuideDisclaimer variant={VARIANT} accuracyDate={overlay.accuracyDate} />
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