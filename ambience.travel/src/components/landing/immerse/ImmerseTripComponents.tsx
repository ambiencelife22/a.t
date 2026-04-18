// ImmerseTripComponents.tsx — section components for /immerse/ trip overview pages
// Owns: ImmerseRouteStrip, ImmerseDestinationRows, ImmerseTripPricing
// Does not own: hero (ImmerseHero), destination subpages (ImmerseDestinationComponents)
// Last updated: S19E — route strip bricks now match height within each row,
// non-clickable bricks retain equal visual weight, and all bricks use gentler depth

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

function getDestinationPageHref(row: ImmerseDestinationRow, urlId: string) {
  const isPublic = urlId === 'honeymoon'

  if (!row.destinationSlug) return null

  return isPublic
    ? `/immerse/honeymoon/${row.destinationSlug}`
    : `/immerse/${urlId}/${row.destinationSlug}`
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

const BRICK_DEPTH = '0 8px 24px rgba(15, 18, 22, 0.045)'
const BRICK_DEPTH_HOVER = '0 12px 28px rgba(15, 18, 22, 0.065)'

// ─── Route strip ──────────────────────────────────────────────────────────────

export function ImmerseRouteStrip({ data }: { data: ImmerseTripData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile = useImmerseMobile()

  return (
    <ImmerseSectionWrap
      id='route'
      refProp={ref as React.RefObject<HTMLElement>}
      style={{ background: '#FBF9F6' }}
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
        boxShadow: BRICK_DEPTH,
        cursor: isClickable ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        if (!isClickable) return
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'rgba(216,181,106,0.28)'
        e.currentTarget.style.boxShadow = BRICK_DEPTH_HOVER
      }}
      onMouseLeave={e => {
        if (!isClickable) return
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = ID.line
        e.currentTarget.style.boxShadow = BRICK_DEPTH
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
            background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.46) 100%)',
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
              color: '#F6F2EA',
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

export function ImmerseDestinationRows({ data }: { data: ImmerseTripData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile = useImmerseMobile()

  return (
    <ImmerseSectionWrap id='destinations' refProp={ref as React.RefObject<HTMLElement>}>
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
          <ImmerseTitle serif style={{ fontSize: 'clamp(30px,4vw,52px)', ...immerseFadeUp(visible, 60) }}>
            {data.destinationSubtitle ?? 'Three destinations. One continuous feeling.'}
          </ImmerseTitle>
        </div>
        <ImmerseBody style={{ fontSize: 15, ...immerseFadeUp(visible, 120) }}>
          {data.destinationBody ?? 'Each stop should feel distinct, highly visual, and worth entering on its own.'}
        </ImmerseBody>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
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
  const isMobile = useImmerseMobile()
  const anchorId = getDestinationAnchorId(row)
  const pageHref = getDestinationPageHref(row, urlId)

  return (
    <div
      id={anchorId}
      style={{
        position: 'relative',
        scrollMarginTop: 96,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '360px 1fr auto',
          gap: 18,
          alignItems: 'stretch',
          overflow: 'hidden',
          border: `1px solid ${ID.line}`,
          borderRadius: 30,
          background: ID.panel2,
          boxShadow: BRICK_DEPTH,
          transition: 'transform 0.32s ease, border-color 0.32s ease, box-shadow 0.32s ease',
          ...immerseFadeUp(visible, delay),
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = 'rgba(216,181,106,0.28)'
          e.currentTarget.style.boxShadow = BRICK_DEPTH_HOVER
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.borderColor = ID.line
          e.currentTarget.style.boxShadow = BRICK_DEPTH
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
              background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.22) 100%)',
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
              color: ID.text,
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

          <div style={{ color: ID.muted, fontSize: 14, lineHeight: 1.72, maxWidth: 640 }}>
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
        </div>
      </div>

      {pageHref && (
        <a
          href={pageHref}
          style={{
            position: 'absolute',
            right: isMobile ? 22 : 28,
            bottom: isMobile ? 22 : 28,
            textDecoration: 'none',
            color: ID.text,
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 14px',
            border: `1px solid ${ID.line}`,
            borderRadius: 999,
            background: '#FFFFFF',
            transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
            zIndex: 3,
            boxShadow: '0 4px 14px rgba(15,18,22,0.05)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.borderColor = 'rgba(216,181,106,0.45)'
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(15,18,22,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.borderColor = ID.line
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,18,22,0.05)'
          }}
        >
          Explore this segment →
        </a>
      )}
    </div>
  )
}

// ─── Trip pricing ─────────────────────────────────────────────────────────────

export function ImmerseTripPricing({ data }: { data: ImmerseTripData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile = useImmerseMobile()

  return (
    <ImmerseSectionWrap
      id='pricing'
      refProp={ref as React.RefObject<HTMLElement>}
      style={{ background: '#0A0A0A', borderTop: '1px solid rgba(216,181,106,0.10)' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 18,
          ...immerseFadeUp(visible, 0),
        }}
      >
        <ImmersePanel style={{ padding: 30, background: '#111111' }}>
          <ImmerseEyebrow shimmer={false}>{data.pricingHeading}</ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(30px,3.8vw,46px)', color: '#F6F2EA' }}>
            {data.pricingTitle}
          </ImmerseTitle>
          <ImmerseBody style={{ marginBottom: 14, color: 'rgba(245,242,236,0.72)' }}>
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

        <ImmersePanel style={{ padding: 30, background: '#111111' }}>
          <ImmerseEyebrow shimmer={false}>{data.pricingNotesHeading}</ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(30px,3.8vw,46px)', color: '#F6F2EA' }}>
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
                borderBottom: `1px solid rgba(255,255,255,0.08)`,
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
        color: '#F6F2EA',
        textAlign: 'left',
        padding: '12px 8px',
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
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
            color: 'rgba(245,242,236,0.78)',
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