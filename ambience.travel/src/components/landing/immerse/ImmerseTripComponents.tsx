// ImmerseTripComponents.tsx — section components for /immerse/ trip overview pages
// Owns: ImmerseRouteStrip, ImmerseDestinationRows, ImmerseTripPricing
// Does not own: hero (ImmerseHero), destination subpages (ImmerseDestinationComponents)
// Last updated: S20 — DestinationRow rewrite:
//   (1) Whole card now clickable (anchor wraps card) when subpageStatus === 'live'
//   (2) 'preview' state renders opacity 0.5, cursor not-allowed, no hover lift,
//       "Coming soon" badge in bottom-right (replaces Discover More CTA slot)
//   (3) Defensive fix for /null/ bug — destination_slug literal "null" string is rejected

import {
  ID,
  useImmerseMobile,
  useImmerseVisible,
  immerseFadeUp,
  ImmerseSectionWrap,
  ImmerseEyebrow,
  ImmerseTitle,
  ImmerseBody,
  ImmersePanel,
  ImmerseStayBox,
} from './ImmerseComponents'
import { IMMERSE } from '../../../lib/landingColors'
import type { ImmerseTripData, ImmerseRouteStop, ImmerseDestinationRow } from '../../../lib/immerseTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugifyAnchor(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getDestinationAnchorId(row: ImmerseDestinationRow) {
  if (row.anchorId) return row.anchorId
  if (row.destinationSlug) return `dest-${row.destinationSlug}`
  if (row.title) return `dest-${slugifyAnchor(row.title)}`
  return `dest-${row.id}`
}

// S20: defensive — destination_slug literal text "null" was the source of the
// /immerse/honeymoon/null bug. Reject it explicitly along with empty/whitespace.
function hasUsableDestinationSlug(row: ImmerseDestinationRow): boolean {
  const slug = row.destinationSlug
  if (!slug) return false
  const trimmed = slug.trim()
  if (trimmed === '') return false
  if (trimmed.toLowerCase() === 'null') return false
  return true
}

function getDestinationPageHref(row: ImmerseDestinationRow, urlId: string) {
  if (!hasUsableDestinationSlug(row)) return null

  const isPublic = urlId === 'honeymoon'
  if (isPublic) return `/immerse/honeymoon/${row.destinationSlug}`
  return `/immerse/${urlId}/${row.destinationSlug}`
}

function scrollToDestination(anchorId: string) {
  const el = document.getElementById(anchorId)
  if (!el) return

  const top = el.getBoundingClientRect().top + window.scrollY - 96

  window.history.replaceState(null, '', `#${anchorId}`)
  window.scrollTo({
    top,
    behavior: 'smooth',
  })
}

// ─── Route strip ──────────────────────────────────────────────────────────────

export function ImmerseRouteStrip({ data }: { data: ImmerseTripData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile = useImmerseMobile()

  return (
    <ImmerseSectionWrap
      id='route'
      refProp={ref as React.RefObject<HTMLElement>}
      style={{ background: ID.bg }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr',
          gap: 18,
          alignItems: 'end',
          marginBottom: 22,
        }}
      >
        <div>
          <ImmerseEyebrow style={immerseFadeUp(visible, 0)} shimmer={false}>
            {data.routeEyebrow ?? 'Route overview'}
          </ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(30px,4vw,52px)', ...immerseFadeUp(visible, 60) }}>
            {data.routeHeading}
          </ImmerseTitle>
        </div>
        <ImmerseBody style={{ fontSize: 15, ...immerseFadeUp(visible, 120) }}>
          {data.routeBody}
        </ImmerseBody>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          alignItems: 'stretch',
          ...immerseFadeUp(visible, 180),
        }}
      >
        {data.routeStops.map((stop, i) => {
          const linkedRow = data.destinationRows[i] ?? null
          const anchorId = linkedRow ? getDestinationAnchorId(linkedRow) : null

          return (
            <RouteStopCard
              key={stop.id}
              stop={stop}
              index={i}
              anchorId={anchorId}
            />
          )
        })}
      </div>
    </ImmerseSectionWrap>
  )
}

function RouteStopCard({
  stop,
  index,
  anchorId,
}: {
  stop: ImmerseRouteStop
  index: number
  anchorId: string | null
}) {
  const isClickable = Boolean(anchorId)

  const card = (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${ID.line}`,
        borderRadius: 26,
        overflow: 'hidden',
        background: ID.panel2,
        transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        animation: `immerseFadeIn 0.55s cubic-bezier(0.16,1,0.3,1) ${index * 90}ms both`,
        boxShadow: IMMERSE.brickDepth,
        cursor: isClickable ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        if (!isClickable) return
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = IMMERSE.goldBorderSoft
        e.currentTarget.style.boxShadow = IMMERSE.brickDepthHover
      }}
      onMouseLeave={e => {
        if (!isClickable) return
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = ID.line
        e.currentTarget.style.boxShadow = IMMERSE.brickDepth
      }}
    >
      <div style={{ height: 220, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={stop.imageSrc}
          alt={stop.imageAlt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: IMMERSE.imageOverlayStrong,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 18,
            bottom: 16,
            right: 18,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: ID.gold,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {stop.stayLabel}
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 0.96,
              letterSpacing: '-0.03em',
              fontWeight: 400,
              fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
              color: ID.text,
            }}
          >
            {stop.title}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'flex-start',
          background: ID.panel2,
        }}
      >
        <div
          style={{
            color: ID.muted,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          {stop.note}
        </div>
      </div>
    </div>
  )

  if (!anchorId) {
    return <div style={{ display: 'block', height: '100%' }}>{card}</div>
  }

  return (
    <a
      href={`#${anchorId}`}
      onClick={e => {
        e.preventDefault()
        scrollToDestination(anchorId)
      }}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        height: '100%',
      }}
      aria-label={`Jump to ${stop.title}`}
    >
      {card}
    </a>
  )
}

// ─── Destination rows ─────────────────────────────────────────────────────────
// Renders on a cream (light) surface. All text + borders inside this section
// switch to the light-context token family so the cards read correctly against
// the light background. Gold accents (eyebrow, number label, mood) stay gold.
//
// S20: each row reads row.subpageStatus to decide render mode:
//   'live'    — whole card is an anchor, normal hover, "Discover More →" CTA
//   'preview' — plain div, opacity 0.5, no hover lift, "Coming soon" badge
//   'hidden'  — already filtered server-side; never reaches this component

export function ImmerseDestinationRows({ data }: { data: ImmerseTripData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile = useImmerseMobile()

  return (
    <ImmerseSectionWrap
      id='destinations'
      refProp={ref as React.RefObject<HTMLElement>}
      style={{
        background: IMMERSE.lightSurface,
        borderRadius: '0 0 36px 36px',
        boxShadow: IMMERSE.lightSurfaceDepth,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr',
          gap: 18,
          alignItems: 'end',
          marginBottom: 22,
        }}
      >
        <div>
          <ImmerseEyebrow style={immerseFadeUp(visible, 0)} shimmer={false}>
            {data.destinationHeading}
          </ImmerseEyebrow>
          <ImmerseTitle
            serif
            style={{
              fontSize: 'clamp(30px,4vw,52px)',
              color: IMMERSE.textOnLight,
              ...immerseFadeUp(visible, 60),
            }}
          >
            {data.destinationSubtitle ?? 'Three destinations. One continuous feeling.'}
          </ImmerseTitle>
        </div>
        <ImmerseBody style={{ fontSize: 15, color: IMMERSE.mutedOnLight, ...immerseFadeUp(visible, 120) }}>
          {data.destinationBody ?? 'Each stop should feel distinct, highly visual, and worth entering on its own.'}
        </ImmerseBody>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 16,
        }}
      >
        {data.destinationRows.map((row, i) => (
          <DestinationRow
            key={row.id}
            row={row}
            urlId={data.urlId}
            delay={i * 90}
            visible={visible}
          />
        ))}
      </div>
    </ImmerseSectionWrap>
  )
}

// S20: rewritten so the entire card is the click target (when live).
// 'preview' state renders the same card visually but at opacity 0.5,
// non-clickable, with a "Coming soon" badge replacing the CTA pill.
function DestinationRow({
  row,
  urlId,
  delay,
  visible,
}: {
  row: ImmerseDestinationRow
  urlId: string
  delay: number
  visible: boolean
}) {
  const isMobile  = useImmerseMobile()
  const anchorId  = getDestinationAnchorId(row)
  const pageHref  = getDestinationPageHref(row, urlId)
  const isPreview = row.subpageStatus === 'preview'
  const isLive    = row.subpageStatus === 'live' && Boolean(pageHref)

  const cardOpacity = isPreview ? 0.5 : 1
  const cardCursor  = isLive ? 'pointer' : (isPreview ? 'not-allowed' : 'default')

  const cardInner = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '360px 1fr auto',
        gap: 18,
        alignItems: 'stretch',
        overflow: 'hidden',
        border: `1px solid ${IMMERSE.lineOnLight}`,
        borderRadius: 30,
        background: IMMERSE.panelOnLight,
        boxShadow: IMMERSE.brickDepth,
        transition: 'transform 0.32s ease, border-color 0.32s ease, box-shadow 0.32s ease',
        opacity: cardOpacity,
        cursor: cardCursor,
        position: 'relative',
        ...immerseFadeUp(visible, delay),
      }}
      onMouseEnter={e => {
        if (!isLive) return
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = IMMERSE.goldBorderOnLight
        e.currentTarget.style.boxShadow = IMMERSE.brickDepthHover
      }}
      onMouseLeave={e => {
        if (!isLive) return
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = IMMERSE.lineOnLight
        e.currentTarget.style.boxShadow = IMMERSE.brickDepth
      }}
    >
      <div style={{ minHeight: isMobile ? 260 : 300, position: 'relative' }}>
        <img
          src={row.imageSrc}
          alt={row.imageAlt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: IMMERSE.imageOverlaySoft,
          }}
        />
      </div>

      <div
        style={{
          padding: isMobile ? '22px 22px 8px' : '28px 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: ID.gold,
            fontWeight: 700,
          }}
        >
          {row.numberLabel}
        </div>

        <div
          style={{
            fontSize: isMobile ? 42 : 54,
            lineHeight: 0.94,
            letterSpacing: '-0.04em',
            fontWeight: 400,
            fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
            color: IMMERSE.textOnLight,
          }}
        >
          {row.title}
        </div>

        <div
          style={{
            color: ID.gold,
            fontSize: 12,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {row.mood}
        </div>

        <div style={{ color: IMMERSE.mutedOnLight, fontSize: 14, lineHeight: 1.72, maxWidth: 640 }}>
          {row.summary}
        </div>
      </div>

      <div
        style={{
          padding: isMobile ? '0 22px 22px' : '28px 28px 28px 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'flex-end',
          gap: 14,
          minWidth: isMobile ? 'auto' : 220,
        }}
      >
        <ImmerseStayBox label={row.stayLabel} />

        <CornerBadge isLive={isLive} isPreview={isPreview} />
      </div>
    </div>
  )

  // Live: whole card is the anchor — entire surface clickable, keyboard-accessible.
  if (isLive && pageHref) {
    return (
      <div
        id={anchorId}
        style={{ position: 'relative', scrollMarginTop: 96 }}
      >
        <a
          href={pageHref}
          aria-label={`Open ${row.title}`}
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          {cardInner}
        </a>
      </div>
    )
  }

  // Preview (and any other non-live state): plain div wrapper. No anchor.
  // aria-disabled communicates state to screen readers.
  return (
    <div
      id={anchorId}
      aria-disabled={isPreview ? true : undefined}
      style={{ position: 'relative', scrollMarginTop: 96 }}
    >
      {cardInner}
    </div>
  )
}

// S20: corner CTA / status badge — lives in the bottom-right slot of the card.
// Live state shows the gold-bordered "Discover More →" pill (visual only — the
// whole card is the click target now). Preview shows a muted "Coming Soon" pill.
function CornerBadge({ isLive, isPreview }: { isLive: boolean; isPreview: boolean }) {
  if (isLive) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          textDecoration: 'none',
          color: IMMERSE.textOnLight,
          fontSize: 13,
          fontWeight: 700,
          padding: '10px 14px',
          border: `1px solid ${IMMERSE.lineOnLight}`,
          borderRadius: 999,
          background: IMMERSE.panelOnLight,
          boxShadow: IMMERSE.ctaDepth,
          whiteSpace: 'nowrap',
        }}
      >
        Discover More →
      </div>
    )
  }

  if (isPreview) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          color: IMMERSE.mutedOnLight,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          padding: '10px 14px',
          border: `1px dashed ${IMMERSE.lineOnLight}`,
          borderRadius: 999,
          background: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        Coming Soon
      </div>
    )
  }

  return null
}

// ─── Trip pricing ─────────────────────────────────────────────────────────────

export function ImmerseTripPricing({ data }: { data: ImmerseTripData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile = useImmerseMobile()

  return (
    <ImmerseSectionWrap
      id='pricing'
      refProp={ref as React.RefObject<HTMLElement>}
      style={{
        background: ID.bg,
        borderTop: `1px solid ${ID.line}`,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 24,
          ...immerseFadeUp(visible, 0),
        }}
      >
        <ImmersePanel
          style={{
            padding: 30,
            background: ID.panel2,
            boxShadow: IMMERSE.brickDepth,
          }}
        >
          <ImmerseEyebrow shimmer={false}>{data.pricingHeading}</ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(30px,3.8vw,46px)', color: ID.text }}>
            {data.pricingTitle}
          </ImmerseTitle>
          <ImmerseBody style={{ marginBottom: 14, color: ID.muted }}>
            {data.pricingBody}
          </ImmerseBody>
          <PricingTable>
            {data.pricingRows.map(row => (
              <tr key={row.id}>
                <Td col={1}>{row.destination}</Td>
                <Td col={2}>{row.recommendedBasis}</Td>
                <Td col={3}>{row.stayLabel}</Td>
                <Td col={4}>{row.indicativeRange}</Td>
              </tr>
            ))}
            <tr>
              <TotalTd col={1}>{data.pricingTotalLabel}</TotalTd>
              <TotalTd col={2}>Hotel-led concept total</TotalTd>
              <TotalTd col={3}></TotalTd>
              <TotalTd col={4}>{data.pricingTotalValue}</TotalTd>
            </tr>
          </PricingTable>
        </ImmersePanel>

        <ImmersePanel
          style={{
            padding: 30,
            background: ID.panel2,
            boxShadow: IMMERSE.brickDepth,
          }}
        >
          <ImmerseEyebrow shimmer={false}>{data.pricingNotesHeading}</ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(30px,3.8vw,46px)', color: ID.text }}>
            {data.pricingNotesTitle}
          </ImmerseTitle>
          <NotesList notes={data.pricingNotes} />
        </ImmersePanel>
      </div>
    </ImmerseSectionWrap>
  )
}

// ─── Shared table helpers ─────────────────────────────────────────────────────

export function PricingTable({ children }: { children: React.ReactNode }) {
  const isMobile = window.innerWidth < 768

  const headers = isMobile
    ? ['Item', 'Indicative range']
    : ['Item', 'Basis', 'Stay', 'Indicative range']

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th
              key={h}
              style={{
                color: ID.gold,
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 700,
                textAlign: 'left',
                padding: '12px 8px',
                borderBottom: `1px solid ${IMMERSE.tableBorder}`,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function Td({ children, col }: { children: React.ReactNode; col?: number }) {
  const isMobile = window.innerWidth < 768
  const hidden = isMobile && (col === 2 || col === 3)
  if (hidden) return null

  return (
    <td
      style={{
        color: ID.text,
        textAlign: 'left',
        padding: '12px 8px',
        borderBottom: `1px solid ${IMMERSE.tableBorderSoft}`,
        verticalAlign: 'top',
        fontSize: 13,
      }}
    >
      {children}
    </td>
  )
}

export function TotalTd({ children, col, colSpan }: { children?: React.ReactNode; col?: number; colSpan?: number }) {
  const isMobile = window.innerWidth < 768
  const hidden = isMobile && (col === 2 || col === 3)
  if (hidden) return null

  return (
    <td
      colSpan={colSpan}
      style={{
        color: ID.gold,
        fontWeight: 800,
        fontSize: 13,
        textAlign: 'left',
        padding: '14px 8px',
        borderBottom: 'none',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  )
}

export function NotesList({ notes }: { notes: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
      {notes.map(note => (
        <div
          key={note}
          style={{
            color: ID.muted,
            fontSize: 14,
            lineHeight: 1.72,
            paddingLeft: 16,
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 9,
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: ID.gold,
              display: 'block',
            }}
          />
          {note}
        </div>
      ))}
    </div>
  )
}