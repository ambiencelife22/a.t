// HotelGuidePage.tsx — public hotels guide for a destination
// Mirrors DiningGuidePage / ExperiencesGuidePage / ShoppingGuidePage.
//
// What it owns:
//   - Hotel data fetch
//   - Happenings data fetch (S53 — surface='hotels', for hotel-led events
//     like residencies, takeovers, anniversary programmes)
//   - Filter state + URL param sync (stars, forbes, partners)
//   - Overlay resolution against typesGuides defaults
//   - Year + version resolution for PDF
//   - Grid layout, error + empty states
//   - PDF download trigger (variant: 'hotels')
//   - At-a-glance bullets block
//   - "Coming Up" happenings block
//   - Plan Your Visit block
//   - Accuracy disclaimer block
//   - Editorial prompt (hasFullAccess=false teaser state)
//
// What it does not own:
//   - Path parsing (HotelGuideRoute)
//   - Destination validation (HotelGuideRoute)
//   - Page chrome (GuideLayout)
//   - Card rendering (HotelCard, HappeningCard), hero (GuideHero)
//   - Filter chrome (HotelGuideFilters)
//   - PDF rendering itself (lib/guidePdf.ts owns full lifecycle)
//   - Style objects (stylesGuidePage.ts)
//   - PYV section chrome + fallback copy (PlanYourVisit.tsx)
//   - Per-variant default copy (typesGuides.ts — GUIDE_COPY)
//
// Filter shape simpler than dining — no cuisine taxonomy on hotels.
// Active filters: stars threshold, forbes-rated-only, preferred-partners-only.
//
// PDF download gated on hasFullAccess — teaser users cannot download.
//   Currently hotels are ungated (no grant view exists), so hasFullAccess
//   is universally true via useGuideRoute's 'ungated' → full access mapping.
//
// Happenings section: gated on hasFullAccess + only renders when hotel-
// surfaced happenings exist. Page has no trip context — fetches all future
// happenings with surfaces @> ['hotels'].
//
// Last updated: S53 — Brought to feature parity with dining/experiences/
//   shopping pages. Added hasFullAccess prop, happenings fetch, PDF download,
//   at-a-glance, ComingUp, PlanYourVisit, accuracy disclaimer, editorial
//   prompt. Universal eyebrow/headline pattern via GUIDE_COPY.hotels.
//   GuideDestination consumed from typesGuides. Inline styles removed in
//   favour of stylesGuidePage shared module.
// Prior: S37 — initial.

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
import { HotelCard } from './HotelCard'
import { HotelGuideFilters, type HotelFilterState } from './HotelGuideFilters'
import { GuideHero } from './GuideHero'
import { ComingUpSection } from './ComingUpSection'
import { PlanYourVisit } from './PlanYourVisit'
import { ID, IMMERSE, FONTS } from '../../tokens/tokensLanding'
import { GUIDE_COPY, type GuideDestination } from '../../types/typesGuides'
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

interface HotelGuidePageProps {
  destination:   GuideDestination
  hasFullAccess: boolean
}

// ── Frontend default copy ────────────────────────────────────────────────────
// Eyebrow + headline defaults live in typesGuides.ts (GUIDE_COPY).
// Intro default stays local pending future centralization.

function defaultIntro(destinationName: string): string {
  return `A selective hotel guide for ${destinationName}.`
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

// ── At-a-glance block ────────────────────────────────────────────────────────

function AtAGlance({ bullets }: { bullets: string[] }) {
  if (bullets.length === 0) return null
  return (
    <div style={{
      margin:       '0 0 32px',
      padding:      '20px 24px',
      background:   ID.panel,
      borderRadius: 12,
      borderLeft:   `3px solid ${ID.gold}`,
    }}>
      <div style={{
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase' as const,
        color:         ID.gold,
        marginBottom:  12,
      }}>
        At a Glance
      </div>
      <ul style={{
        margin:        0,
        padding:       0,
        listStyle:     'none',
        display:       'flex',
        flexDirection: 'column' as const,
        gap:           8,
      }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: ID.gold, fontSize: 10, marginTop: 4, flexShrink: 0 }}>{'\u25C6'}</span>
            <span style={{ fontSize: 14, color: ID.text, lineHeight: 1.6 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Page component ───────────────────────────────────────────────────────────

export default function HotelGuidePage({
  destination,
  hasFullAccess,
}: HotelGuidePageProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [hotels,      setHotels]      = useState<HotelVenue[]>([])
  const [happenings,  setHappenings]  = useState<Happening[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterState, setFilterState] = useState<HotelFilterState>(() => readFilterStateFromUrl())

  // ── Resolved hero copy ───────────────────────────────────────────────────

  const overlay      = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? destination.name
  const heroHeadline = overlay?.headline_override ?? GUIDE_COPY.hotels.defaultHeadline
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? destination.heroImageSrc ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? destination.heroImageAlt ?? null

  const atAGlanceBullets = useMemo(
    () => overlay?.at_a_glance_bullets ?? [],
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

        if (hotelsResult.status === 'fulfilled') {
          setHotels(hotelsResult.value)
        }
        if (hotelsResult.status !== 'fulfilled') {
          console.error('HotelGuidePage: failed to load hotels', hotelsResult.reason)
          const msg = hotelsResult.reason instanceof Error ? hotelsResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load hotels — ${msg}`)
          setHotels([])
        }

        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        }
        if (happeningsResult.status !== 'fulfilled') {
          // Soft-fail — happenings are supplementary. Log only.
          console.error('HotelGuidePage: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('HotelGuidePage: unexpected load error', err)
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
    () => hotels.some(h => h.forbes_rating !== null),
    [hotels],
  )
  const hasPartners = useMemo(
    () => hotels.some(h => h.is_preferred_partner),
    [hotels],
  )

  const filteredHotels = useMemo(() => {
    const base = hasFullAccess ? hotels : []
    return base.filter(h => {
      if (filterState.minStars && (h.stars === null || h.stars < filterState.minStars)) return false
      if (filterState.forbesOnly && h.forbes_rating === null) return false
      if (filterState.partnersOnly && !h.is_preferred_partner) return false
      return true
    })
  }, [hotels, filterState, hasFullAccess])

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
            {atAGlanceBullets.length > 0 && (
              <AtAGlance bullets={atAGlanceBullets} />
            )}

            <HotelGuideFilters
              state={filterState}
              onChange={setFilterState}
              hasForbes={hasForbes}
              hasPartners={hasPartners}
            />

            <div style={sectionTitleStyle}>
              <div>
                <h2 style={sectionTitleH2Style}>Selected stays</h2>
                <p style={sectionTitleCountStyle}>
                  {filteredHotels.length}{' '}
                  {filteredHotels.length === 1
                    ? GUIDE_COPY.hotels.itemNoun
                    : GUIDE_COPY.hotels.itemNounPlural}
                </p>
              </div>
              {hasFullAccess && (
                <button
                  type="button"
                  onClick={() => handleDownloadPdf({
                    variant:      'hotels',
                    destination,
                    venues:       hotels,
                    happenings,
                    copy:         { eyebrow: heroEyebrow, headline: heroHeadline, intro: heroIntro },
                    heroImageSrc,
                    guideYear:    resolveGuideYear(overlay?.guide_year),
                    guideVersion: resolveGuideVersion(overlay?.guide_version),
                    accuracyDate: overlay?.accuracy_date ?? null,
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
              hasFullAccess
                ? <EmptyState />
                : <EditorialPrompt destinationName={destination.name} />
            ) : (
              <>
                <section style={gridStyle}>
                  {filteredHotels.map(h => (
                    <HotelCard
                      key={h.id}
                      hotel={h}
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

            {hasFullAccess && (
              <PlanYourVisit overlay={overlay} variant="hotels" />
            )}

            {overlay?.accuracy_date && (
              <div style={disclaimerStyle}>
                <p style={disclaimerTextStyle}>
                  The hotels listed in this guide reflect our knowledge as of {overlay.accuracy_date}. Availability, rates, and ownership change. ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading. This guide, including any exported PDF, is provided for inspiration and planning purposes only.
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
      textAlign:     'center' as const,
      display:       'flex',
      flexDirection: 'column' as const,
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
        textTransform: 'uppercase' as const,
        color:         ID.gold,
      }}>
        {destinationName} {'\u00B7'} {GUIDE_COPY.hotels.productLabel}
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
        There is more to this house.
      </p>
      <p style={{
        fontSize:   14,
        color:      ID.muted,
        lineHeight: 1.6,
        margin:     0,
        maxWidth:   400,
      }}>
        The full {destinationName} hotels guide is available to invited guests.
        Contact your ambience team member to request access.
      </p>
    </div>
  )
}

// ── Loading + Empty States ───────────────────────────────────────────────────

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