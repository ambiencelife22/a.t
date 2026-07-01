/* GuidePageShopping.tsx — public shopping guide for a destination.
 *
 * Mirrors GuidePageDining / GuidePageExperiences / GuidePageHotels
 * structure. All shared behaviour lives in shared helpers.
 *
 * What it owns:
 *   - Shop data fetch
 *   - Happenings data fetch (surface='shopping')
 *   - Shop-type filter state
 *   - Section title rendering
 *   - PDF download trigger dispatch
 *
 * What it does not own:
 *   - Path parsing (ShoppingGuideRoute)
 *   - Destination validation (ShoppingGuideRoute)
 *   - Page chrome (GuideLayout)
 *   - Card rendering (GuideCardShopping)
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
 * Last updated: S53 — Nine-file guide-layer extraction. Every shared piece
 *   moves to the new modules; page reduces to fetch + filter + dispatch.
 * Prior: S53 — Universal eyebrow/headline pattern via GUIDE_COPY.shopping.
 * Prior: S52 — initial build.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  fetchShoppingForDestination,
  type Shop,
} from '../../queries/queriesGuidesShopping'
import {
  fetchActiveHappeningsForDestination,
  type Happening,
} from '../../queries/queriesGuidesHappenings'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { useGuideHero } from '../../hooks/useGuideHero'
import { GuideCardShopping } from './GuideCardShopping'
import { GuideComingUpSection } from './GuideComingUpSection'
import { GuideHero } from './GuideHero'
import { GuideChipFilters } from './GuideChipFilters'
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

const VARIANT = 'shopping' as const

interface GuidePageShoppingProps {
  destination:   GuideDestination
  hasFullAccess: boolean
}

// ── Page component ───────────────────────────────────────────────────────────

export default function GuidePageShopping({
  destination,
  hasFullAccess,
}: GuidePageShoppingProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [shops,          setShops]          = useState<Shop[]>([])
  const [happenings,     setHappenings]     = useState<Happening[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeShopType, setActiveShopType] = useState<string | null>(null)

  const hero    = useGuideHero(destination, VARIANT)
  const overlay = destination.overlay

  const atAGlanceBullets = useMemo(
    () => overlay?.at_a_glance_bullets ?? [],
    [overlay],
  )

  // ── Shop + happenings fetch ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [shopsResult, happeningsResult] = await Promise.allSettled([
          fetchShoppingForDestination(destination.id),
          fetchActiveHappeningsForDestination(destination.id, { surface: 'shopping' }),
        ])
        if (cancelled) return

        if (shopsResult.status === 'fulfilled') {
          setShops(shopsResult.value)
        } else {
          console.error('GuidePageShopping: failed to load shops', shopsResult.reason)
          const msg = shopsResult.reason instanceof Error ? shopsResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load shopping: ${msg}`)
          setShops([])
        }

        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        } else {
          console.error('GuidePageShopping: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('GuidePageShopping: unexpected load error', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toastRef.current.error(`Couldn't load shopping: ${msg}`)
        setShops([])
        setHappenings([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.id])

  const availableShopTypes = useMemo(() => {
    const seen    = new Set<string>()
    const ordered: string[] = []
    for (const s of shops) {
      if (s.shop_type && !seen.has(s.shop_type)) {
        seen.add(s.shop_type)
        ordered.push(s.shop_type)
      }
    }
    return ordered.sort()
  }, [shops])

  const visibleShops = useMemo(() => {
    const base = filterVisibleItems(shops, hasFullAccess)
    if (!activeShopType) return base
    return base.filter(s => s.shop_type === activeShopType)
  }, [shops, hasFullAccess, activeShopType])

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
              options={availableShopTypes}
              active={activeShopType}
              onChange={setActiveShopType}
              ariaLabel="Filter shopping by category"
            />

            <div style={sectionTitleStyle}>
              <h2 style={sectionTitleH2Style}>
                {formatSectionHeader(VARIANT, visibleShops.length)}
              </h2>
              {shouldShowAdvisorExtras(hasFullAccess) && (
                <button
                  type="button"
                  onClick={() => handleDownloadPdf({
                    variant:      VARIANT,
                    destination,
                    venues:       shops,
                    happenings,
                    copy:         { eyebrow: hero.eyebrow, headline: hero.headline, intro: hero.intro },
                    heroImageSrc: hero.imageSrc,
                    guideYear:    resolveGuideYear(overlay?.guide_year),
                    guideVersion: resolveGuideVersion(overlay?.guide_version),
                    accuracyDate: overlay?.accuracy_date ?? null,
                  })}
                  disabled={!pdfReady || pdfDownloading || shops.length === 0}
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

            {visibleShops.length === 0 ? (
              shouldShowAdvisorExtras(hasFullAccess)
                ? <EmptyState />
                : <GuideEditorialPrompt variant={VARIANT} destinationName={destination.name} />
            ) : (
              <>
                <section style={{
                  ...gridStyle,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                }}>
                  {visibleShops.map(s => (
                    <GuideCardShopping
                      key={s.id}
                      shop={s}
                      hasFullAccess={hasFullAccess}
                      destinationName={destination.name}
                    />
                  ))}
                </section>

                {shouldShowEditorialPrompt(visibleShops.length, shops.length, hasFullAccess) && (
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
                  The {GUIDE_COPY[VARIANT].itemNounPlural.toLowerCase()} listed in this guide reflect our knowledge as of {overlay.accuracy_date}. Availability and operators change. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading.
                </p>
              </div>
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