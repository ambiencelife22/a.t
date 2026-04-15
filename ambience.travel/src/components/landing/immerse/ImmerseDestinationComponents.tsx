// ImmerseDestinationComponents.tsx — section components for /immerse/ destination subpages
// Owns: ImmerseDestIntro, ImmerseHotelOptions, ImmerseContentGrid, ImmerseDestPricing
// Last updated: S10

import { useState } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow, ImmerseTitle, ImmerseBody, ImmersePanel, ImmerseStayBox } from './ImmerseComponents'
import { C } from '../../../lib/landingTypes'
import { PricingTable, Td, TotalTd, NotesList } from './ImmerseJourneyComponents'
import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseContentCard, ImmersePricingRow } from '../../../lib/immerseTypes'

// ─── Intro ────────────────────────────────────────────────────────────────────

export function ImmerseDestIntro({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  return (
    <ImmerseSectionWrap refProp={ref as React.RefObject<HTMLElement>} style={{ background: C.bgAlt }}>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.86fr 1.14fr',
          gap:                 18,
          alignItems:          'start',
        }}
      >
        <div>
          <ImmerseEyebrow style={{ color: C.faint, ...immerseFadeUp(visible, 0) }}>{data.introEyebrow}</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,4vw,50px)', color: C.text, ...immerseFadeUp(visible, 60) }}>
            {data.introTitle}
          </ImmerseTitle>
        </div>
        <ImmerseBody style={{ color: C.muted, ...immerseFadeUp(visible, 120) }}>{data.introBody}</ImmerseBody>
      </div>
    </ImmerseSectionWrap>
  )
}

// ─── Hotel options ────────────────────────────────────────────────────────────

export function ImmerseHotelOptions({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  return (
    <ImmerseSectionWrap id='hotel-options' refProp={ref as React.RefObject<HTMLElement>}>
      {/* Section heading */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.8fr 1.2fr',
          gap:                 18,
          alignItems:          'end',
          marginBottom:        18,
          ...immerseFadeUp(visible, 0),
        }}
      >
        <div>
          <ImmerseEyebrow>{data.hotelsEyebrow}</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,4vw,50px)', margin: 0 }}>{data.hotelsTitle}</ImmerseTitle>
        </div>
        <ImmerseBody>{data.hotelsBody}</ImmerseBody>
      </div>

      {/* Option cards */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap:                 14,
          marginBottom:        18,
          ...immerseFadeUp(visible, 80),
        }}
      >
        {data.hotels.map(hotel => (
          <HotelOptionCard key={hotel.id} hotel={hotel} />
        ))}
      </div>

      {/* Room categories */}
      <div style={{ display: 'grid', gap: 18, ...immerseFadeUp(visible, 160) }}>
        {data.hotels.map(hotel => (
          <RoomCategory key={hotel.id} hotel={hotel} />
        ))}
      </div>
    </ImmerseSectionWrap>
  )
}

function HotelOptionCard({ hotel }: { hotel: ImmerseHotelOption }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border:        `1px solid ${hovered ? 'rgba(216,181,106,0.40)' : ID.line}`,
        borderRadius:  24,
        overflow:      'hidden',
        background:    ID.panel2,
        boxShadow:     ID.shadow,
        display:       'flex',
        flexDirection: 'column',
        transition:    'border-color 0.3s ease',
        cursor:        'default',
      }}
    >
      <div style={{ height: 230, overflow: 'hidden' }}>
        <img
          src={hotel.imageSrc}
          alt={hotel.imageAlt}
          style={{
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            display:    'block',
            transform:  hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ID.gold, fontWeight: 700, marginBottom: 8 }}>
          {hotel.rankLabel}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 800, color: ID.text, marginBottom: 8 }}>
          {hotel.name}
        </div>
        <div style={{ color: ID.muted, fontSize: 13, marginBottom: 12 }}>{hotel.tagline}</div>
        <div style={{ color: ID.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>{hotel.description}</div>

        <div style={{ display: 'grid', gap: 7, marginBottom: 14 }}>
          {hotel.bullets.map(b => (
            <div key={b} style={{ color: ID.muted, fontSize: 12, lineHeight: 1.55, paddingLeft: 14, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, borderRadius: '50%', background: ID.gold, display: 'block' }} />
              {b}
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${ID.line}`, paddingTop: 14, marginTop: 'auto' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ID.gold, fontWeight: 700, marginBottom: 5 }}>
            Indicative nightly range
          </div>
          <div style={{ fontSize: 25, lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 800, color: ID.text, marginBottom: 5 }}>
            {hotel.nightlyRange}
          </div>
          <div style={{ color: ID.muted, fontSize: 12, lineHeight: 1.55 }}>{hotel.nightlyNote}</div>
        </div>
      </div>
    </div>
  )
}

function RoomCategory({ hotel }: { hotel: ImmerseHotelOption }) {
  const isMobile = useImmerseMobile()

  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.02fr 0.98fr',
        gap:                 18,
        alignItems:          'stretch',
      }}
    >
      <div
        style={{
          minHeight:    isMobile ? 260 : 480,
          overflow:     'hidden',
          border:       `1px solid ${ID.line}`,
          borderRadius: ID.radiusXl,
          boxShadow:    ID.shadow,
        }}
      >
        <img src={hotel.roomImageSrc} alt={hotel.roomImageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>

      <ImmersePanel style={{ padding: isMobile ? 22 : 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
        <div>
          <ImmerseEyebrow>{hotel.roomCategory}</ImmerseEyebrow>
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'flex-start',
              gap:            16,
              flexDirection:  isMobile ? 'column' : 'row',
            }}
          >
            <div>
              <div style={{ fontSize: isMobile ? 28 : 40, lineHeight: 0.98, letterSpacing: '-0.055em', fontWeight: 800, color: ID.text, marginBottom: 8 }}>
                {hotel.roomBasis}
              </div>
              <ImmerseBody>{hotel.description}</ImmerseBody>
            </div>
            <ImmerseStayBox label={hotel.stayLabel} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12 }}>
          {hotel.roomBenefits.map(b => (
            <div
              key={b}
              style={{
                padding:      '14px 15px',
                border:       `1px solid ${ID.line}`,
                borderRadius: ID.radiusMd,
                background:   ID.panel2,
                color:        ID.muted,
                fontSize:     14,
                lineHeight:   1.65,
              }}
            >
              {b}
            </div>
          ))}
        </div>
      </ImmersePanel>
    </div>
  )
}

// ─── Content card grid (dining + activities) ──────────────────────────────────

type ContentGridProps = {
  eyebrow: string
  title:   string
  body:    string
  items:   ImmerseContentCard[]
}

export function ImmerseContentGrid({ eyebrow, title, body, items }: ContentGridProps) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  return (
    <ImmerseSectionWrap refProp={ref as React.RefObject<HTMLElement>}>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.8fr 1.2fr',
          gap:                 18,
          alignItems:          'end',
          marginBottom:        18,
          ...immerseFadeUp(visible, 0),
        }}
      >
        <div>
          <ImmerseEyebrow>{eyebrow}</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,4vw,50px)', margin: 0 }}>{title}</ImmerseTitle>
        </div>
        <ImmerseBody>{body}</ImmerseBody>
      </div>

      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap:                 14,
          ...immerseFadeUp(visible, 80),
        }}
      >
        {items.map(item => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </ImmerseSectionWrap>
  )
}

function ContentCard({ item }: { item: ImmerseContentCard }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border:        `1px solid ${ID.line}`,
        borderRadius:  24,
        overflow:      'hidden',
        background:    ID.panel2,
        boxShadow:     ID.shadow,
        display:       'flex',
        flexDirection: 'column',
        transition:    'border-color 0.3s ease',
        cursor:        'default',
      }}
    >
      <div style={{ height: 210, overflow: 'hidden' }}>
        <img
          src={item.imageSrc}
          alt={item.imageAlt}
          style={{
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            display:    'block',
            transform:  hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ID.gold, fontWeight: 700, marginBottom: 8 }}>
          {item.kicker}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 800, color: ID.text, marginBottom: 8 }}>
          {item.name}
        </div>
        <div style={{ color: ID.muted, fontSize: 13, marginBottom: 12 }}>{item.tagline}</div>
        <div style={{ color: ID.muted, fontSize: 13, lineHeight: 1.7 }}>{item.body}</div>
      </div>
    </div>
  )
}

// ─── Destination pricing ──────────────────────────────────────────────────────

export function ImmerseDestPricing({ data }: { data: ImmerseDestinationData }) {
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
          <ImmerseEyebrow>{data.pricingEyebrow}</ImmerseEyebrow>
          <ImmerseTitle style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>{data.pricingTitle}</ImmerseTitle>
          <ImmerseBody style={{ marginBottom: 14 }}>{data.pricingBody}</ImmerseBody>
          <PricingTable>
            {data.pricingRows.map(row => (
              row.isTotal
                ? (
                  <tr key={row.id}>
                    <TotalTd col={1}>{row.item}</TotalTd>
                    <TotalTd col={2} colSpan={2}>{row.basis}</TotalTd>
                    <TotalTd col={4}>{row.indicativeRange}</TotalTd>
                  </tr>
                )
                : (
                  <tr key={row.id}>
                    <Td col={1}>{row.item}</Td>
                    <Td col={2}>{row.basis}</Td>
                    <Td col={3}>{row.stay}</Td>
                    <Td col={4}>{row.indicativeRange}</Td>
                  </tr>
                )
            ))}
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