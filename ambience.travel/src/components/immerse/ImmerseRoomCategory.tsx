// ImmerseRoomCategory.tsx — single room tier render (content panel + hero)
// Owns: RoomCategory component. Renders the room's level, basis, size/rate
//   chips, benefits grid, and hero image. Mobile reorders content → nav → hero.
// Does not own: carousel state (lives in parent: FlatHotelOptions / HotelWithRooms)
// Last updated: S31 — Room transition animation swapped from immerseFadeIn
//   (fade + slide-up 8px) to immerseFadeOnly (pure fade). Slide felt like
//   a page jump on room switch.
// Prior: S31 — Extracted from ImmerseDestinationComponents.tsx; no
//   behaviour change.
// Prior: S30G — Mobile NavRow renders between content panel and hero.
// Prior: S30G — Restored <a opening tag on RoomCategory floorplan link.
// Prior: S30F — Replaced hardcoded "+ Taxes & Fees" / "+ tax" rate suffixes
//   with reads from room.rateSuffix.

import { useState } from 'react'
import { ID, useImmerseMobile, ImmerseEyebrow, ImmersePanel } from './ImmerseComponents'
import type { ImmerseHotelOption, ImmerseRoomOption } from '../../lib/immerseTypes'

export function RoomCategory({ room, fadeIn = false, onHeroClick, carouselArrowsAndDots }: {
  room: ImmerseRoomOption
  hotel: ImmerseHotelOption
  fadeIn?: boolean
  onHeroClick?: () => void
  carouselArrowsAndDots?: React.ReactNode
}) {
  const isMobile              = useImmerseMobile()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const isActive = !isMobile && hovered
  const scale    = pressed ? 0.99 : 1

  const showRateSuffix = !room.taxInclusive && Boolean(room.rateSuffix)

  const contentPanel = (
    <ImmersePanel
      style={{
        padding: isMobile ? 22 : 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        background: ID.panel,
        boxShadow: isActive
          ? '0 16px 48px rgba(0,0,0,0.56), 0 2px 0 rgba(216,181,106,0.18)'
          : '0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(216,181,106,0.08)',
        minWidth: 0,
        border: `1px solid ${isActive ? 'rgba(216,181,106,0.22)' : ID.line}`,
        transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
      }}
    >
      <div>
        <ImmerseEyebrow>{room.levelLabel}</ImmerseEyebrow>
        <div
          style={{
            fontSize: isMobile ? 28 : 40,
            lineHeight: 0.98,
            letterSpacing: '-0.02em',
            fontWeight: 400,
            fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
            color: ID.text,
            marginBottom: 16,
          }}
        >
          {room.roomBasis}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(room.sqftMin || room.sqmMin) && (
            <div style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.dim, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {room.sqftMin
                ? room.sqftMax
                  ? `${room.sqftMin.toLocaleString()}–${room.sqftMax.toLocaleString()} sq ft`
                  : `${room.sqftMin.toLocaleString()} sq ft`
                : ''}
              {room.sqftMin && room.sqmMin ? ' · ' : ''}
              {room.sqmMin
                ? room.sqmMax
                  ? `${room.sqmMin}–${room.sqmMax} sqm`
                  : `${room.sqmMin} sqm`
                : ''}
            </div>
          )}
          {room.publicNightlyRate && (
            <div style={{ position: 'relative', padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.dim, opacity: 0.55, fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', gap: 5, alignItems: 'center', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: '-10%', top: '50%', width: '120%', height: 1, background: `linear-gradient(90deg, transparent, ${ID.dim}77, transparent)`, transform: 'rotate(-18deg)', pointerEvents: 'none' }} />
              <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>Public</span>
              <span style={{ opacity: 0.8 }}>{room.publicNightlyRate}</span>
            </div>
          )}
          {room.nonNegotiatedNightlyRate && (
            <div style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.muted, fontSize: 11, letterSpacing: '0.08em', fontWeight: 500, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: ID.dim }}>Non-Negotiated</span>
                <span>{room.nonNegotiatedNightlyRate}</span>
                <span style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>/ night</span>
              </div>
              {showRateSuffix && (
                <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {room.rateSuffix}
                </div>
              )}
            </div>
          )}
          {room.ambienceNightlyRate && (
            <div style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid rgba(216,181,106,0.45)`, background: 'rgba(216,181,106,0.10)', color: ID.gold, fontSize: 13, letterSpacing: '0.06em', fontWeight: 800, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', boxShadow: '0 0 0 1px rgba(216,181,106,0.10)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Ambience</span>
                <span>{room.ambienceNightlyRate}</span>
                <span style={{ fontSize: 10, color: ID.dim, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>/ night</span>
              </div>
              {showRateSuffix && (
                <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {room.rateSuffix}
                </div>
              )}
            </div>
          )}
          {room.floorplanSrc && (
            <a
              href={room.floorplanSrc}
              target='_blank'
              rel='noopener noreferrer'
              style={{
                padding:        '7px 13px',
                borderRadius:   999,
                border:         `1px solid ${ID.line}`,
                background:     ID.panel2,
                color:          ID.muted,
                fontSize:       11,
                letterSpacing:  '0.10em',
                textTransform:  'uppercase',
                fontWeight:     600,
                whiteSpace:     'nowrap',
                textDecoration: 'none',
                display:        'inline-flex',
                alignItems:     'center',
                gap:            6,
                cursor:         'pointer',
                transition:     'border-color 0.25s ease, color 0.25s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(216,181,106,0.45)'
                e.currentTarget.style.color       = ID.text
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = ID.line
                e.currentTarget.style.color       = ID.muted
              }}
            >
              <svg width='10' height='10' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
                <rect x='1.5' y='1.5' width='13' height='13' rx='1' stroke='currentColor' strokeWidth='1.2' />
                <line x1='1.5' y1='5.5' x2='14.5' y2='5.5' stroke='currentColor' strokeWidth='1' />
                <line x1='5.5' y1='5.5' x2='5.5' y2='14.5' stroke='currentColor' strokeWidth='1' />
              </svg>
              Floor plan
            </a>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12 }}>
        {room.roomBenefits.map(b => (
          <div
            key={b}
            style={{
              padding: '14px 15px',
              border: `1px solid ${ID.line}`,
              borderRadius: ID.radiusMd,
              background: ID.panel2,
              color: ID.muted,
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            {b}
          </div>
        ))}
      </div>
    </ImmersePanel>
  )

  const heroPanel = (
    <div
      onClick={onHeroClick}
      style={{
        minHeight: isMobile ? 260 : 480,
        overflow: 'hidden',
        border: `1px solid ${isActive ? 'rgba(216,181,106,0.22)' : ID.line}`,
        borderRadius: ID.radiusXl,
        boxShadow: isActive
          ? '0 16px 48px rgba(0,0,0,0.56), 0 2px 0 rgba(216,181,106,0.18)'
          : '0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(216,181,106,0.08)',
        minWidth: 0,
        position: 'relative',
        transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
        cursor: onHeroClick ? 'pointer' : 'default',
      }}
    >
      <img
        src={room.roomImageSrc}
        alt={room.roomImageAlt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transition: 'transform 0.65s cubic-bezier(0.16,1,0.3,1)',
          transform: isActive ? 'scale(1.04)' : 'scale(1)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(3,3,3,0.38) 100%)' }} />
    </div>
  )

  if (isMobile) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false) }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 18,
          alignItems: 'stretch',
          animation: fadeIn ? 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined,
          minWidth: 0,
          transform: `scale(${scale})`,
          transition: 'transform 0.18s ease',
        }}
      >
        {contentPanel}
        {carouselArrowsAndDots}
        {heroPanel}
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 18,
        alignItems: 'stretch',
        animation: fadeIn ? 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined,
        minWidth: 0,
        transform: `scale(${scale})`,
        transition: 'transform 0.18s ease',
      }}
    >
      {contentPanel}
      {heroPanel}
    </div>
  )
}