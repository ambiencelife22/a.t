// ImmerseJourneyComponents.tsx — section components for /immerse/ journey overview pages
// Owns: ImmerseRouteStrip, ImmerseDestinationRows, ImmerseJourneyPricing
// Last updated: S12

import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow, ImmerseTitle, ImmerseBody, ImmersePanel, ImmerseStayBox } from './ImmerseComponents'
import type { ImmerseJourneyData, ImmerseRouteStop, ImmerseDestinationRow, ImmerseJourneyPricingRow } from '../../../lib/immerseTypes'

// ─── Route strip ──────────────────────────────────────────────────────────────

export function ImmerseRouteStrip({ data }: { data: ImmerseJourneyData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  return (
    <ImmerseSectionWrap id='route' refProp={ref as React.RefObject<HTMLElement>}>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.82fr 1.18fr',
          gap:                 18,
          alignItems:          'start',
          marginBottom:        22,
        }}
      >
        <div>
          <ImmerseEyebrow style={immerseFadeUp(visible, 0)}>Route overview</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,4vw,50px)', ...immerseFadeUp(visible, 60) }}>
            {data.routeHeading}
          </ImmerseTitle>
        </div>
        <ImmerseBody style={immerseFadeUp(visible, 120)}>{data.routeBody}</ImmerseBody>
      </div>

      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)',
          gap:                 12,
          ...immerseFadeUp(visible, 160),
        }}
      >
        {data.routeStops.map(stop => (
          <RouteStopCard key={stop.id} stop={stop} />
        ))}
      </div>
    </ImmerseSectionWrap>
  )
}

function RouteStopCard({ stop }: { stop: ImmerseRouteStop }) {
  return (
    <div
      style={{
        border:       `1px solid ${ID.line}`,
        borderRadius: ID.radiusLg,
        overflow:     'hidden',
        background:   ID.panel2,
        boxShadow:    ID.shadow,
      }}
    >
      <div style={{ height: 135 }}>
        <img src={stop.imageSrc} alt={stop.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ padding: 13 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ID.gold, fontWeight: 700, marginBottom: 6 }}>
          {stop.stayLabel}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: ID.text, marginBottom: 5 }}>
          {stop.title}
        </div>
        <div style={{ color: ID.muted, fontSize: 12, lineHeight: 1.58 }}>
          {stop.note}
        </div>
      </div>
    </div>
  )
}

// ─── Destination rows ─────────────────────────────────────────────────────────

export function ImmerseDestinationRows({ data }: { data: ImmerseJourneyData }) {
  const { ref, visible } = useImmerseVisible()

  return (
    <ImmerseSectionWrap id='destinations' refProp={ref as React.RefObject<HTMLElement>}>
      <ImmerseEyebrow style={{ marginBottom: 22, ...immerseFadeUp(visible, 0) }}>
        {data.destinationHeading}
      </ImmerseEyebrow>
      <div style={{ display: 'grid', gap: 16 }}>
        {data.destinationRows.map((row, i) => (
          <DestinationRow key={row.id} row={row} delay={i * 80} visible={visible} />
        ))}
      </div>
    </ImmerseSectionWrap>
  )
}

function DestinationRow({ row, delay, visible }: { row: ImmerseDestinationRow; delay: number; visible: boolean }) {
  const isMobile = useImmerseMobile()

  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: isMobile ? '1fr' : '340px 1fr auto',
        gap:                 18,
        alignItems:          'stretch',
        overflow:            'hidden',
        border:              `1px solid ${ID.line}`,
        borderRadius:        28,
        background:          ID.panel2,
        boxShadow:           ID.shadow,
        ...immerseFadeUp(visible, delay),
      }}
    >
      <div style={{ minHeight: isMobile ? 200 : 250 }}>
        <img src={row.imageSrc} alt={row.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>

      <div style={{ padding: isMobile ? '22px 22px 0' : '26px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.gold, fontWeight: 700 }}>
          {row.numberLabel}
        </div>
        <div style={{ fontSize: 38, lineHeight: 0.98, letterSpacing: '-0.05em', fontWeight: 800, color: ID.text }}>
          {row.title}
        </div>
        <div style={{ color: ID.muted, fontSize: 14 }}>{row.mood}</div>
        <div style={{ color: ID.muted, fontSize: 14, lineHeight: 1.72, maxWidth: 680 }}>{row.summary}</div>
      </div>

      <div
        style={{
          padding:        isMobile ? '16px 22px 22px' : '26px 26px 26px 0',
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'space-between',
          alignItems:     isMobile ? 'flex-start' : 'flex-end',
          gap:            14,
          minWidth:       isMobile ? 'auto' : 220,
        }}
      >
        <ImmerseStayBox label={row.stayLabel} />
        <a
          href={row.href}
          style={{
            width:          isMobile ? 'auto' : '100%',
            minHeight:      42,
            borderRadius:   12,
            border:         `1px solid ${ID.lineSoft}`,
            color:          ID.text,
            textDecoration: 'none',
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       12,
            letterSpacing:  '0.08em',
            textTransform:  'uppercase',
            fontWeight:     800,
            background:     'transparent',
            padding:        isMobile ? '0 20px' : '0',
          }}
        >
          Destination subpage
        </a>
      </div>
    </div>
  )
}

// ─── Journey pricing ──────────────────────────────────────────────────────────

export function ImmerseJourneyPricing({ data }: { data: ImmerseJourneyData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  return (
    <ImmerseSectionWrap id='pricing' refProp={ref as React.RefObject<HTMLElement>}>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap:                 18,
          ...immerseFadeUp(visible, 0),
        }}
      >
        <ImmersePanel style={{ padding: 30 }}>
          <ImmerseEyebrow>{data.pricingHeading}</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>{data.pricingTitle}</ImmerseTitle>
          <ImmerseBody style={{ marginBottom: 14 }}>{data.pricingBody}</ImmerseBody>
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

        <ImmersePanel style={{ padding: 30 }}>
          <ImmerseEyebrow>{data.pricingNotesHeading}</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>{data.pricingNotesTitle}</ImmerseTitle>
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
            <th key={h} style={{ color: ID.gold, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, textAlign: 'left', padding: '12px 8px', borderBottom: `1px solid ${ID.line}` }}>
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
  const hidden   = isMobile && (col === 2 || col === 3)
  if (hidden) return null
  return (
    <td style={{ color: ID.text, textAlign: 'left', padding: '12px 8px', borderBottom: `1px solid ${ID.line}`, verticalAlign: 'top', fontSize: 13 }}>
      {children}
    </td>
  )
}

export function TotalTd({ children, col, colSpan }: { children?: React.ReactNode; col?: number; colSpan?: number }) {
  const isMobile = window.innerWidth < 768
  const hidden   = isMobile && (col === 2 || col === 3)
  if (hidden) return null
  return (
    <td colSpan={colSpan} style={{ color: ID.gold, fontWeight: 800, fontSize: 14, textAlign: 'left', padding: '12px 8px', borderBottom: `1px solid ${ID.line}`, verticalAlign: 'top' }}>
      {children}
    </td>
  )
}

export function NotesList({ notes }: { notes: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 20, marginTop: 14 }}>
      {notes.map(note => (
        <div
          key={note}
          style={{
            padding:      '18px 18px',
            border:       `1px solid ${ID.line}`,
            borderRadius: ID.radiusMd,
            background:   ID.panel2,
            color:        ID.muted,
            fontSize:     14,
            lineHeight:   1.8,
          }}
        >
          {note}
        </div>
      ))}
    </div>
  )
}