// ExperiencesGuidePage.tsx — public experiences guide for a destination
// What it owns:
//   - Venue data fetch
//   - Filter state (experience_category)
//   - Frontend default copy + ?? resolution against overlay overrides
//   - Year + version resolution for PDF (NULL → current year / '1.0')
//   - Grid layout, error + empty states
//   - PDF download trigger (usePdfDownload hook, calls exportGuidePdf)
//   - At-a-glance bullets block
//   - Plan Your Visit block
//   - Accuracy disclaimer block
//
// What it does not own:
//   - Path parsing (ExperiencesGuideRoute)
//   - Destination validation (ExperiencesGuideRoute)
//   - Page chrome (GuideLayout)
//   - Card rendering (ExperienceCard), hero (GuideHero)
//   - PDF rendering itself (lib/guidePdf.ts owns full lifecycle)
//   - PDF library loading (lib/usePdfDownload.ts owns this)
//   - Style objects (lib/guidePageStyles.ts)
//   - PYV section chrome + fallback copy (PlanYourVisit.tsx)
//
// No filter state for Michelin/highlighted — travel_experiences has no
// such columns. Category filter only.
//
// PDF download gated on hasFullAccess — teaser users cannot download.
//
// Last updated: S41 — PDF download added via usePdfDownload hook.
// Prior: S40B — experience_category filter added. Category chips
//   render above the grid when multiple categories are present.
// Prior: S41 — initial build.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../lib/ToastContext'
import {
  getExperienceVenuesByDestination,
  type ExperienceVenue,
  type ExperiencesGuideDestination,
} from '../../lib/experiencesGuideQueries'
import { useGuidePdf } from '../../lib/useGuidePdf'
import { ExperienceCard } from './ExperienceCard'
import { GuideHero } from './GuideHero'
import { PlanYourVisit } from './PlanYourVisit'
import { ID, IMMERSE, FONTS } from '../../lib/landingColors'
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
} from '../../lib/guidePageStyles'

interface ExperiencesGuidePageProps {
  destination:   ExperiencesGuideDestination
  hasFullAccess: boolean
}

// ── Frontend default copy ────────────────────────────────────────────────────

const DEFAULT_EYEBROW = 'Curated Experiences'

function defaultHeadline(destinationName: string): string {
  return `${destinationName} Experiences`
}

function defaultIntro(destinationName: string): string {
  return `A selective experiences guide for ${destinationName}`
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
            <span style={{ color: ID.gold, fontSize: 10, marginTop: 4, flexShrink: 0 }}>◆</span>
            <span style={{ fontSize: 14, color: ID.text, lineHeight: 1.6 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Category filters ─────────────────────────────────────────────────────────

interface CategoryFiltersProps {
  categories: string[]
  active:     string | null
  onChange:   (cat: string | null) => void
}

function CategoryFilters({ categories, active, onChange }: CategoryFiltersProps) {
  if (categories.length <= 1) return null
  return (
    <nav style={filtersStyle} aria-label="Filter experiences by category">
      <Chip active={active === null} onClick={() => onChange(null)}>All</Chip>
      {categories.map(cat => (
        <Chip key={cat} active={active === cat} onClick={() => onChange(cat)}>{cat}</Chip>
      ))}
    </nav>
  )
}

interface ChipProps {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius:  999,
        padding:       '10px 14px',
        fontSize:      13,
        fontFamily:    'inherit',
        cursor:        'pointer',
        transition:    'background 180ms ease, color 180ms ease, border-color 180ms ease',
        letterSpacing: '0.005em',
        ...(active ? {
          border:     `1px solid ${ID.text}`,
          background: ID.text,
          color:      '#141610',
          fontWeight: 600,
        } : {
          border:     `1px solid ${IMMERSE.tableBorder}`,
          color:      '#d7cfbf',
          background: 'rgba(255,255,255,0.025)',
        }),
      }}
    >
      {children}
    </button>
  )
}

const filtersStyle: React.CSSProperties = {
  display:      'flex',
  gap:          10,
  flexWrap:     'wrap',
  padding:      16,
  border:       `1px solid ${IMMERSE.tableBorder}`,
  borderRadius: 26,
  background:   'rgba(255,255,255,0.03)',
  marginBottom: 26,
}

// ── Page component ───────────────────────────────────────────────────────────

export default function ExperiencesGuidePage({
  destination,
  hasFullAccess,
}: ExperiencesGuidePageProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [venues,         setVenues]         = useState<ExperienceVenue[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const overlay      = destination.overlay
  const heroEyebrow  = overlay?.eyebrow_override  ?? DEFAULT_EYEBROW
  const heroHeadline = overlay?.headline_override ?? defaultHeadline(destination.name)
  const heroIntro    = overlay?.intro_override    ?? defaultIntro(destination.name)
  const heroImageSrc = overlay?.hero_image_src    ?? destination.heroImageSrc ?? null
  const heroImageAlt = overlay?.hero_image_alt    ?? destination.heroImageAlt ?? null

  const atAGlanceBullets = useMemo(
    () => overlay?.at_a_glance_bullets ?? [],
    [overlay],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const items = await getExperienceVenuesByDestination(destination.slug)
        if (cancelled) return
        setVenues(items)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('ExperiencesGuidePage: failed to load venues', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toastRef.current.error(`Couldn't load experiences: ${msg}`)
        setVenues([])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [destination.slug])

  const availableCategories = useMemo(() => {
    const seen    = new Set<string>()
    const ordered: string[] = []
    for (const v of venues) {
      if (v.experience_category && !seen.has(v.experience_category)) {
        seen.add(v.experience_category)
        ordered.push(v.experience_category)
      }
    }
    return ordered
  }, [venues])

  const visibleVenues = useMemo(() => {
    const base = hasFullAccess ? venues : []
    if (!activeCategory) return base
    return base.filter(v => v.experience_category === activeCategory)
  }, [venues, hasFullAccess, activeCategory])

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

            <CategoryFilters
              categories={availableCategories}
              active={activeCategory}
              onChange={setActiveCategory}
            />

            <div style={sectionTitleStyle}>
              <div>
                <h2 style={sectionTitleH2Style}>Selected experiences</h2>
                <p style={sectionTitleCountStyle}>
                  {visibleVenues.length}{' '}
                  {visibleVenues.length === 1 ? 'experience' : 'experiences'}
                </p>
              </div>
              {hasFullAccess && (
                <button
                  type="button"
                  onClick={() => handleDownloadPdf({
                    variant:      'experiences',
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
              )}
            </div>

            {visibleVenues.length === 0 ? (
              hasFullAccess
                ? <EmptyState />
                : <EditorialPrompt destinationName={destination.name} />
            ) : (
              <>
                <section style={gridStyle}>
                  {visibleVenues.map(v => (
                    <ExperienceCard
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
              <PlanYourVisit overlay={overlay} variant="experiences" />
            )}

            {overlay?.accuracy_date && (
              <div style={disclaimerStyle}>
                <p style={disclaimerTextStyle}>
                  The experiences listed in this guide reflect our knowledge as of {overlay.accuracy_date}. Availability, pricing, and operators change — ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

// ── Editorial prompt ─────────────────────────────────────────────────────────

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
      borderTop:     '1px solid rgba(255,255,255,0.06)',
      borderBottom:  '1px solid rgba(255,255,255,0.06)',
      borderRadius:  24,
    }}>
      <div style={{
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase' as const,
        color:         ID.gold,
      }}>
        {destinationName} · Experiences Guide
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
        There is more to discover here.
      </p>
      <p style={{
        fontSize:   14,
        color:      ID.muted,
        lineHeight: 1.6,
        margin:     0,
        maxWidth:   400,
      }}>
        The full {destinationName} experiences guide is available to invited guests.
        Contact your ambience team member to request access.
      </p>
    </div>
  )
}

// ── Loading + empty states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={messageBlockStyle}>
      <p style={messageTextStyle}>Finding the right doors.</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={emptyStateStyle}>
      <p style={emptyStateTextStyle}>No experiences here yet.</p>
    </div>
  )
}