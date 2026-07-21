/* GuidePageExperiences.tsx - public experiences guide for a destination.
 *
 * Mirrors GuidePageDining / GuidePageShopping / GuidePageHotels structure.
 * All shared behaviour lives in shared helpers.
 *
 * What it owns:
 *   - Venue data fetch
 *   - Happenings data fetch (surface='experiences')
 *   - Category filter state
 *   - Section title rendering
 *   - PDF download trigger dispatch
 *
 * What it does not own:
 *   - Path parsing (ExperiencesGuideRoute)
 *   - Destination validation (ExperiencesGuideRoute)
 *   - Page chrome (GuideLayout)
 *   - Card rendering (GuideCardExperiences)
 *   - Hero rendering (GuideHero) and hero copy resolution (useGuideHero)
 *   - Chip filter chrome (GuideChipFilters)
 *   - Gating decisions (utilsGuideGating)
 *   - Editorial prompt chrome (GuideEditorialPrompt)
 *   - At-a-glance chrome (GuideAtAGlance)
 *   - Plan Your Visit chrome (GuidePlanYourVisit)
 *   - ComingUp chrome (GuideComingUpSection)
 *   - Section header + count formatting (typesGuides: formatSectionHeader)
 *   - PDF year/version resolution (utilsGuidePdf)
 *   - Style objects (stylesGuidePage)
 *
 * Last updated: S53 - Guard clauses only.
 * Prior: S53 - Nine-file guide-layer extraction. Every shared piece
 *   moves to the new modules; page reduces to fetch + filter + dispatch.
 * Prior: S53 - Universal eyebrow/headline pattern via GUIDE_COPY.experiences.
 *   Venues bugfix, duplicated happenings handler removed.
 * Prior: S52 - Selected shopping section removed. ComingUp swapped to
 *   shared component. Happenings fetch passes surface='experiences'.
 * Prior: S41 - initial build.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  getExperienceVenuesByDestination,
  type ExperienceVenue,
} from '../../queries/queriesGuidesExperiences'
import {
  fetchActiveHappeningsForDestination,
  type Happening,
} from '../../queries/queriesGuidesHappenings'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { useGuideHero } from '../../hooks/useGuideHero'
import { GuideCardExperiences } from './GuideCardExperiences'
import { GuideComingUpSection } from './GuideComingUpSection'
import { GuideHero } from './GuideHero'
import { GuideChipFilters } from './GuideChipFilters'
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

const VARIANT = 'experiences' as const

interface GuidePageExperiencesProps {
  destination:   GuideDestination
  hasFullAccess: boolean
}

// ── Page component ───────────────────────────────────────────────────────────

export default function GuidePageExperiences({
  destination,
  hasFullAccess,
}: GuidePageExperiencesProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [venues,         setVenues]         = useState<ExperienceVenue[]>([])
  const [happenings,     setHappenings]     = useState<Happening[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const hero    = useGuideHero(destination, VARIANT)
  const overlay = destination.overlay

  const atAGlanceBullets = useMemo(
    () => overlay?.atAGlanceBullets ?? [],
    [overlay],
  )

  // ── Venue + happenings fetch ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [venuesResult, happeningsResult] = await Promise.allSettled([
          getExperienceVenuesByDestination(destination.slug),
          fetchActiveHappeningsForDestination(destination.id, { surface: 'experiences' }),
        ])
        if (cancelled) return

        if (venuesResult.status === 'rejected') {
          console.error('GuidePageExperiences: failed to load experiences', venuesResult.reason)
          const msg = venuesResult.reason instanceof Error ? venuesResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load experiences: ${msg}`)
          setVenues([])
        }
        if (venuesResult.status === 'fulfilled') {
          setVenues(venuesResult.value)
        }

        if (happeningsResult.status === 'rejected') {
          console.error('GuidePageExperiences: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }
        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('GuidePageExperiences: unexpected load error', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toastRef.current.error(`Couldn't load experiences: ${msg}`)
        setVenues([])
        setHappenings([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug, destination.id])

  const availableCategories = useMemo(() => {
    const seen    = new Set<string>()
    const ordered: string[] = []
    for (const v of venues) {
      if (v.experienceCategory && !seen.has(v.experienceCategory)) {
        seen.add(v.experienceCategory)
        ordered.push(v.experienceCategory)
      }
    }
    return ordered
  }, [venues])

  const visibleVenues = useMemo(() => {
    const base = sortByName(filterVisibleItems(venues, hasFullAccess))
    if (!activeCategory) return base
    return base.filter(v => v.experienceCategory === activeCategory)
  }, [venues, hasFullAccess, activeCategory])

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

            <GuideChipFilters
              options={availableCategories}
              active={activeCategory}
              onChange={setActiveCategory}
              ariaLabel="Filter experiences by category"
            />

            <div style={sectionTitleStyle}>
              <h2 style={sectionTitleH2Style}>
                {formatSectionHeader(VARIANT, visibleVenues.length)}
              </h2>
              {shouldShowAdvisorExtras(hasFullAccess) && (
                <button
                  type="button"
                  onClick={() => handleDownloadPdf({
                    variant:      VARIANT,
                    destination,
                    venues,
                    happenings,
                    copy:         { eyebrow: hero.eyebrow, headline: hero.headline, intro: hero.intro },
                    heroImageSrc: hero.imageSrc,
                    guideYear:    resolveGuideYear(overlay?.guideYear),
                    guideVersion: resolveGuideVersion(overlay?.guideVersion),
                    accuracyDate: overlay?.accuracyDate ?? null,
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
              )}
            </div>

            {visibleVenues.length === 0 ? (
              shouldShowAdvisorExtras(hasFullAccess)
                ? <EmptyState />
                : <GuideEditorialPrompt variant={VARIANT} destinationName={destination.name} />
            ) : (
              <>
                <section style={gridStyle}>
                  {visibleVenues.map(v => (
                    <GuideCardExperiences
                      key={v.id}
                      venue={v}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}
                </section>

                {shouldShowEditorialPrompt(visibleVenues.length, venues.length, hasFullAccess) && (
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

// ── Loading + empty states ───────────────────────────────────────────────────

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