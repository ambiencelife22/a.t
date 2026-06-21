// ShoppingGuidePage.tsx — public shopping guide for a destination
// Mirrors ExperiencesGuidePage structure.
// What it owns:
//   - Shop data fetch
//   - Happenings data fetch (surface='shopping' — pop-ups, trunk shows,
//     capsule launches)
//   - Filter state (shop_type)
//   - Frontend default copy + ?? resolution against overlay overrides
//   - Year + version resolution for PDF (NULL → current year / '1.0')
//   - Grid layout, error + empty states
//   - PDF download trigger (variant: 'shopping')
//   - At-a-glance bullets block
//   - "Coming Up" happenings block
//   - Plan Your Visit block
//   - Accuracy disclaimer block
//
// What it does not own:
//   - Path parsing (ShoppingGuideRoute)
//   - Destination validation (ShoppingGuideRoute)
//   - Page chrome (GuideLayout)
//   - Card rendering (ShopCard, HappeningCard), hero (GuideHero)
//   - PDF rendering itself (lib/guidePdf.ts owns full lifecycle)
//   - Style objects (lib/guidePageStyles.ts)
//
// Filter: shop_type chips (Fashion / Jewelry / Sandals / etc.).
//   Locked taxonomy from typesShopping.ts SHOP_TYPES.
//
// PDF download gated on hasFullAccess — teaser users cannot download.
//   pdfGuide.ts 'shopping' variant handles the rendering.
//
// Happenings section: gated on hasFullAccess + only renders when shopping-
// surfaced happenings exist. Page has no trip context — fetches all future
// happenings with surfaces @> ['shopping'].
//
// Last updated: S52 — initial build.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../providers/ToastContext'
import {
  fetchShoppingForDestination,
  type Shop,
  type ShoppingGuideDestination,
} from '../../queries/queriesGuidesShopping'
import {
  fetchActiveHappeningsForDestination,
  type Happening,
} from '../../queries/queriesGuidesHappenings'
import { useGuidePdf } from '../../hooks/useGuidePdf'
import { ShopCard } from './ShoppingCard'
import { ComingUpSection } from './ComingUpSection'
import { GuideHero } from './GuideHero'
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

interface ShoppingGuidePageProps {
  destination:   ShoppingGuideDestination
  hasFullAccess: boolean
}

// ── Frontend default copy ────────────────────────────────────────────────────

const DEFAULT_EYEBROW = 'Selected Shopping'

function defaultHeadline(destinationName: string): string {
  return `${destinationName} Shopping`
}

function defaultIntro(destinationName: string): string {
  return `A selective shopping guide for ${destinationName}`
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
            <span style={{ color: ID.gold, fontSize: 10, marginTop: 4, flexShrink: 0 }}>{'\u25C6'}</span>
            <span style={{ fontSize: 14, color: ID.text, lineHeight: 1.6 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Shop type filters ────────────────────────────────────────────────────────

interface ShopTypeFiltersProps {
  shopTypes: string[]
  active:    string | null
  onChange:  (t: string | null) => void
}

function ShopTypeFilters({ shopTypes, active, onChange }: ShopTypeFiltersProps) {
  if (shopTypes.length <= 1) return null
  return (
    <nav style={filtersStyle} aria-label="Filter shopping by category">
      <Chip active={active === null} onClick={() => onChange(null)}>All</Chip>
      {shopTypes.map(t => (
        <Chip key={t} active={active === t} onClick={() => onChange(t)}>{t}</Chip>
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

export default function ShoppingGuidePage({
  destination,
  hasFullAccess,
}: ShoppingGuidePageProps) {
  const { toast } = useToast()
  const toastRef  = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  const { pdfReady, pdfDownloading, handleDownloadPdf } = useGuidePdf()

  const [shops,          setShops]          = useState<Shop[]>([])
  const [happenings,     setHappenings]     = useState<Happening[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeShopType, setActiveShopType] = useState<string | null>(null)

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
        const [shopsResult, happeningsResult] = await Promise.allSettled([
          fetchShoppingForDestination(destination.id),
          fetchActiveHappeningsForDestination(destination.id, { surface: 'shopping' }),
        ])
        if (cancelled) return

        if (shopsResult.status === 'fulfilled') {
          setShops(shopsResult.value)
        }
        if (shopsResult.status !== 'fulfilled') {
          console.error('ShoppingGuidePage: failed to load shops', shopsResult.reason)
          const msg = shopsResult.reason instanceof Error ? shopsResult.reason.message : 'Unknown error'
          toastRef.current.error(`Couldn't load shopping: ${msg}`)
          setShops([])
        }

        if (happeningsResult.status === 'fulfilled') {
          setHappenings(happeningsResult.value)
        }
        if (happeningsResult.status !== 'fulfilled') {
          // Soft-fail — happenings are supplementary. Log only.
          console.error('ShoppingGuidePage: failed to load happenings', happeningsResult.reason)
          setHappenings([])
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('ShoppingGuidePage: unexpected load error', err)
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
    const base = hasFullAccess ? shops : []
    if (!activeShopType) return base
    return base.filter(s => s.shop_type === activeShopType)
  }, [shops, hasFullAccess, activeShopType])

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

            <ShopTypeFilters
              shopTypes={availableShopTypes}
              active={activeShopType}
              onChange={setActiveShopType}
            />

            <div style={sectionTitleStyle}>
              <div>
                <h2 style={sectionTitleH2Style}>Selected shopping</h2>
                <p style={sectionTitleCountStyle}>
                  {visibleShops.length}{' '}
                  {visibleShops.length === 1 ? 'venue' : 'venues'}
                </p>
              </div>
              {hasFullAccess && (
                <button
                  type="button"
                  onClick={() => handleDownloadPdf({
                    variant:      'shopping',
                    destination,
                    venues:       shops,
                    happenings,
                    copy:         { eyebrow: heroEyebrow, headline: heroHeadline, intro: heroIntro },
                    heroImageSrc,
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
              hasFullAccess
                ? <EmptyState />
                : <EditorialPrompt destinationName={destination.name} />
            ) : (
              <>
                <section style={{
                  ...gridStyle,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                }}>
                  {visibleShops.map(s => (
                    <ShopCard
                      key={s.id}
                      shop={s}
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
              <PlanYourVisit overlay={overlay} variant="shopping" />
            )}

            {overlay?.accuracy_date && (
              <div style={disclaimerStyle}>
                <p style={disclaimerTextStyle}>
                  The venues listed in this guide reflect our knowledge as of {overlay.accuracy_date}. Availability and operators change, ambience makes every effort to keep this information current but cannot guarantee its accuracy at the time of reading.
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
        {destinationName} {'\u00B7'} Shopping Guide
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
        The full {destinationName} shopping guide is available to invited guests.
        Contact your ambience team member to request access.
      </p>
    </div>
  )
}

// ── Loading + empty states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={messageBlockStyle}>
      <p style={messageTextStyle}>Finding the right doorways.</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={emptyStateStyle}>
      <p style={emptyStateTextStyle}>No shopping curated here yet.</p>
    </div>
  )
}