// ImmerseDestComponents.tsx — section components for /immerse/ destination subpages
// Owns: ImmerseDestIntro, ImmerseContentGrid, ImmerseDestPricing,
//   ContentCard (private), PricingRow (private), PricingPanel (private),
//   PRICING_CLOSER_DEFAULT (private — referenced by lib/immerseTypes comments)
// Does not own: hotel options carousel (ImmerseHotelOptions.tsx), room render
//   (ImmerseRoomCategory.tsx), nav helpers (ImmerseCarouselNav.tsx), keyframes
//   (src/index.css)
// Last updated: S31 — Extracted from ImmerseDestinationComponents.tsx; inline
//   <style> keyframe block removed (now global in src/index.css). No
//   behaviour change.
// Prior: S23 addendum — bullets_heading render added in ContentCard.
// Prior: S23 — Added PRICING_CLOSER_DEFAULT constant + closer render row in
//   ImmerseDestPricing.

import { useState } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow, ImmerseTitle, ImmerseBody, ImmersePanel } from './ImmerseComponents'
import { C } from '../../lib/landingTypes'
import { PricingTable, Td, TotalTd, NotesList } from './ImmerseEngagementComponents'
import type { ImmerseDestinationData, ImmerseContentCard } from '../../lib/immerseTypes'

const TBA = 'To be advised'

const PRICING_CLOSER_DEFAULT = {
  item:            '',
  basis:           '',
  stay:            '',
  indicativeRange: 'Pricing Based On Selection',
}

// ─── Intro ────────────────────────────────────────────────────────────────────

export function ImmerseDestIntro({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible } = useImmerseVisible()

  const destShorthand = data.shorthand ?? data.title
  const eyebrow       = `Destination · ${destShorthand}`

  return (
    <ImmerseSectionWrap
      refProp={ref as React.RefObject<HTMLElement>}
      style={{
        background: C.bgAlt,
        animation: visible ? 'immerseBorderFadeIn 0.8s ease 0.1s both' : undefined,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <ImmerseEyebrow style={{ color: C.faint, ...(visible ? { animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) both' } : { opacity: 0 }) }}>
          {eyebrow}
        </ImmerseEyebrow>
        <ImmerseTitle serif style={{ fontSize: 'clamp(28px,4vw,50px)', color: C.text, ...immerseFadeUp(visible, 60) }}>
          {data.title}
        </ImmerseTitle>
        <ImmerseBody style={{ color: C.muted, ...immerseFadeUp(visible, 120) }}>
          {data.introBody}
        </ImmerseBody>
      </div>
    </ImmerseSectionWrap>
  )
}

// ─── Content card grid (Dining + Experiences) ──────────────────────────────────

type ContentGridProps = {
  eyebrow: string
  title: string
  body: string
  items: ImmerseContentCard[]
  dark?: boolean
  id?: string
}

export function ImmerseContentGrid({ eyebrow, title, body, items, dark = false, id }: ContentGridProps) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  const eyebrowColor = dark ? ID.gold : C.faint
  const titleColor   = dark ? ID.text : C.text
  const bodyColor    = dark ? ID.muted : C.muted
  const sectionBg    = dark ? {} : { background: C.bgAlt, position: 'relative' as const, zIndex: 1 }
  const darkExtras   = dark ? {
    borderRadius: '0 0 30px 30px',
    boxShadow: '0 2px 0 rgba(216,181,106,0.08)',
    position: 'relative' as const,
    zIndex: 2,
  } : {}

  return (
    <ImmerseSectionWrap
      id={id}
      refProp={ref as React.RefObject<HTMLElement>}
      style={{
        ...sectionBg,
        ...darkExtras,
        animation: visible ? 'immerseBorderFadeIn 0.8s ease 0.1s both' : undefined,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.8fr 1.2fr',
          gap: 18,
          alignItems: 'end',
          marginBottom: 18,
          ...immerseFadeUp(visible, 0),
        }}
      >
        <div>
          <ImmerseEyebrow
            style={{ color: eyebrowColor, ...(visible ? { animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) both' } : { opacity: 0 }) }}
            shimmer={false}
          >
            {eyebrow}
          </ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(28px,4vw,50px)', margin: 0, color: titleColor }}>
            {title}
          </ImmerseTitle>
        </div>
        <ImmerseBody style={{ color: bodyColor }}>{body}</ImmerseBody>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap: 14,
          ...immerseFadeUp(visible, 80),
        }}
      >
        {items.map((item, i) => (
          <ContentCard key={item.id} item={item} index={i} inverted={dark} />
        ))}
      </div>
    </ImmerseSectionWrap>
  )
}

function ContentCard({ item, index = 0, inverted = false }: { item: ImmerseContentCard; index?: number; inverted?: boolean }) {
  const [hovered, setHovered] = useState(false)

  const cardBg       = inverted ? C.bgAlt : ID.panel2
  const cardBorder   = inverted ? C.border : ID.line
  const nameColor    = inverted ? C.text : ID.text
  const mutedColor   = inverted ? C.muted : ID.muted
  const dividerColor = inverted ? C.border : ID.line

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? 'rgba(216,181,106,0.28)' : cardBorder}`,
        borderRadius: 24,
        overflow: 'hidden',
        background: cardBg,
        boxShadow: hovered ? '0 10px 24px rgba(0,0,0,0.18)' : 'none',
        display: 'flex',
        animation: `immerseFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 90}ms both`,
        flexDirection: 'column',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        cursor: 'default',
      }}
    >
      <div style={{ height: 210, overflow: 'hidden', position: 'relative' }}>
        <img
          src={item.imageSrc}
          alt={item.imageAlt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.65s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 36%, rgba(3,3,3,0.36) 100%)' }} />
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              flex: 1,
              height: 1,
              background: `linear-gradient(90deg, ${ID.gold}44 0%, ${ID.gold}99 50%, transparent 100%)`,
              backgroundSize: '200% auto',
              animation: `immerseRuleShimmer 1.2s cubic-bezier(0.16,1,0.3,1) ${index * 90 + 400}ms both`,
            }}
          />
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: inverted ? C.gold : ID.gold, fontWeight: 700 }}>
            {item.kicker}
          </div>
          <div
            style={{
              flex: 1,
              height: 1,
              background: `linear-gradient(270deg, ${ID.gold}44 0%, ${ID.gold}99 50%, transparent 100%)`,
              backgroundSize: '200% auto',
              animation: `immerseRuleShimmer 1.2s cubic-bezier(0.16,1,0.3,1) ${index * 90 + 400}ms both`,
            }}
          />
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.01em', fontWeight: 400, fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif', color: nameColor, marginBottom: 8 }}>
          {item.name}
        </div>
        <div style={{ color: mutedColor, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>{item.tagline}</div>
        <div style={{ color: mutedColor, fontSize: 13, lineHeight: 1.7, marginBottom: item.bullets?.length ? 12 : 0 }}>{item.body}</div>
        {item.bullets && item.bullets.length > 0 && (
          <>
            <div style={{ height: 1, background: dividerColor, margin: '10px 0' }} />
            {item.bulletsHeading && (
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: inverted ? C.gold : ID.gold, fontWeight: 700, marginBottom: 8 }}>
                {item.bulletsHeading}
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {item.bullets.map(b => (
                <div key={b} style={{ color: mutedColor, fontSize: 12, lineHeight: 1.55, paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 6, width: 4, height: 4, borderRadius: '50%', background: inverted ? C.gold : ID.gold, display: 'block' }} />
                  {b}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Destination pricing ──────────────────────────────────────────────────────

export function ImmerseDestPricing({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  const closerItem            = data.pricingCloser.item            ?? PRICING_CLOSER_DEFAULT.item
  const closerBasis           = data.pricingCloser.basis           ?? PRICING_CLOSER_DEFAULT.basis
  const closerIndicativeRange = data.pricingCloser.indicativeRange ?? PRICING_CLOSER_DEFAULT.indicativeRange

  return (
    <section
      id='pricing'
      ref={ref as React.RefObject<HTMLElement>}
      style={{
        padding: '58px 0',
        borderTop: '1px solid rgba(216,181,106,0.12)',
        borderBottom: '1px solid rgba(216,181,106,0.08)',
        position: 'relative',
        background: '#060606',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundColor: C.gold,
          mixBlendMode: 'screen',
          animation: 'immerseGoldBreatheSolid 14s ease-in-out infinite',
        }}
      />

      {visible && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 1,
          width: '100%',
          background: 'rgba(216,181,106,0.55)',
          animation: 'immerseGoldScan 1.1s cubic-bezier(0.16,1,0.3,1) both',
          pointerEvents: 'none',
          zIndex: 2,
        }} />
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: isMobile ? 'calc(100% - 24px)' : 'min(1220px, calc(100% - 36px))',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 18,
            ...immerseFadeUp(visible, 0),
          }}
        >
          <PricingPanel style={{ padding: 30, background: ID.panel }}>
            <ImmerseEyebrow style={visible ? { animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both' } : { opacity: 0 }}>
              {data.pricingEyebrow}
            </ImmerseEyebrow>
            <ImmerseTitle serif style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>
              {data.pricingTitle}
            </ImmerseTitle>
            <ImmerseBody style={{ marginBottom: 14 }}>
              {data.pricingBody}
            </ImmerseBody>
            <PricingTable>
              {data.pricingRows.map(row => (
                row.isTotal ? (
                  <PricingRow key={row.id} isTotal>
                    <TotalTd col={1}>{row.item}</TotalTd>
                    <TotalTd col={2} colSpan={2}>{row.basis}</TotalTd>
                    <TotalTd col={4}>{row.indicativeRange}</TotalTd>
                  </PricingRow>
                ) : (
                  <PricingRow key={row.id}>
                    <Td col={1}>{row.item}</Td>
                    <Td col={2}>{row.basis}</Td>
                    <Td col={3}>{row.stay}</Td>
                    <Td col={4}>{row.indicativeRange}</Td>
                  </PricingRow>
                )
              ))}
              <PricingRow isTotal>
                <TotalTd col={1}>{closerItem}</TotalTd>
                <TotalTd col={2} colSpan={2}>{closerBasis}</TotalTd>
                <TotalTd col={4}>{closerIndicativeRange}</TotalTd>
              </PricingRow>
            </PricingTable>
          </PricingPanel>

          <PricingPanel style={{ padding: 30, background: ID.panel }}>
            <ImmerseEyebrow style={visible ? { animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both' } : { opacity: 0 }}>
              {data.pricingNotesHeading || TBA}
            </ImmerseEyebrow>
            <ImmerseTitle serif style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>
              {data.pricingNotesTitle || TBA}
            </ImmerseTitle>
            <NotesList notes={data.pricingNotes.length > 0 ? data.pricingNotes : [TBA]} />
          </PricingPanel>
        </div>
      </div>
    </section>
  )
}

function PricingRow({ children, isTotal = false }: { children: React.ReactNode; isTotal?: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? isTotal
            ? 'rgba(216,181,106,0.06)'
            : 'rgba(216,181,106,0.03)'
          : 'transparent',
        transition: 'background 0.25s ease',
        cursor: 'default',
      }}
    >
      {children}
    </tr>
  )
}

function PricingPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'contents' }}
    >
      <ImmersePanel
        style={{
          ...style,
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          boxShadow: hovered
            ? '0 20px 56px rgba(0,0,0,0.56), 0 2px 0 rgba(216,181,106,0.16)'
            : '0 8px 32px rgba(0,0,0,0.40), 0 1px 0 rgba(216,181,106,0.08)',
          border: `1px solid ${hovered ? 'rgba(216,181,106,0.20)' : ID.line}`,
          transition: 'transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease',
        }}
      >
        {children}
      </ImmersePanel>
    </div>
  )
}