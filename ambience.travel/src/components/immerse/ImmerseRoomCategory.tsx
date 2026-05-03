// ImmerseRoomCategory.tsx — single room tier render (content panel + hero)
// Owns: RoomCategory component. Renders the room's level, basis, size/rate
//   chips, benefits grid, and hero image. Mobile reorders content → nav → hero.
// Does not own: carousel state (lives in parent: FlatHotelOptions / HotelWithRooms)
//
// Last updated: S32K — Replaced hardcoded "/ night" rate suffix with data-
//   driven room.rateCadence. Cadence comes from travel_immerse_rate_cadences
//   reference table (Per Night, Per Stay, Per Week, Per Month — extensible).
//   No hardcoded cadence text in this component anymore. The leading slash
//   was dropped because cadence labels are self-contained ("Per Night").
// Prior: S32K — Room name rendering fixed. Eyebrow now shows tierLabel
//   (engagement-specific tier: "Highlighted", "Alternative 1"), title shows
//   levelLabel (room name: "Oceanfront One Bedroom Suite", "Corner Suite").
//   Prior bug: was rendering roomBasis ("Room Only") as title.
//
// S32 — Three rendering fixes on the chip row:
//   (1) Square footage range collapses when min === max (was: '678–678 SQ FT'
//       now: '678 SQ FT'). Same for sqm. Was caused by sqftMax being truthy
//       even when equal to sqftMin.
//   (2) Rate chips (Non-Negotiated, Ambience) detect non-numeric rate strings
//       (e.g. 'Winter Pricing Not Yet Available') and switch to a single-line
//       label-and-copy layout. The '/ night' suffix is suppressed for non-
//       numeric rates because '<message> / night' reads as gibberish.
//   (3) Non-numeric rate chips drop white-space: nowrap so the long copy can
//       wrap on narrow viewports instead of bleeding off the card edge.
//   Detection: rate string starts with currency symbol ($/€/£/¥) or digit →
//   numeric. Anything else → copy. Cheap and handles every realistic case.
// Prior: S31 — Room transition animation swapped from immerseFadeIn
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

// S32: detect numeric rate strings ($1,200 / €420 / 1500). Anything else
// (including 'Winter Pricing Not Yet Available', 'On Request', 'TBD') is
// treated as informational copy and rendered without the cadence suffix.
function isNumericRate(rate: string): boolean {
  return /^[$€£¥]?\s*\d/.test(rate.trim())
}

// S32: collapse degenerate ranges (678-678 → 678). Both bounds optional.
function formatSqRange(min: number | undefined, max: number | undefined, unit: string): string {
  if (!min) return ''
  if (!max || max === min) return `${min.toLocaleString()} ${unit}`
  return `${min.toLocaleString()}–${max.toLocaleString()} ${unit}`
}

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

  // S32: collapsed sq ranges + numeric vs copy rate detection
  const sqftPart = formatSqRange(room.sqftMin, room.sqftMax, 'sq ft')
  const sqmPart  = formatSqRange(room.sqmMin,  room.sqmMax,  'sqm')
  const sqLabel  = [sqftPart, sqmPart].filter(Boolean).join(' · ')

  const nonNegIsNumeric  = room.nonNegotiatedNightlyRate ? isNumericRate(room.nonNegotiatedNightlyRate) : false
  const ambienceIsNumeric = room.ambienceNightlyRate     ? isNumericRate(room.ambienceNightlyRate)     : false

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
        <ImmerseEyebrow>{room.tierLabel}</ImmerseEyebrow>
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
          {room.levelLabel}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {sqLabel && (
            <div style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.dim, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {sqLabel}
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
            <div style={{
              padding: '7px 13px',
              borderRadius: nonNegIsNumeric ? 999 : 14,
              border: `1px solid ${ID.line}`,
              background: ID.panel2,
              color: ID.muted,
              fontSize: 11,
              letterSpacing: '0.08em',
              fontWeight: 500,
              whiteSpace: nonNegIsNumeric ? 'nowrap' : 'normal',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: 'flex-start',
              maxWidth: '100%',
              minWidth: 0,
            }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: nonNegIsNumeric ? 'nowrap' : 'wrap' }}>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: ID.dim }}>Non-Negotiated</span>
                <span>{room.nonNegotiatedNightlyRate}</span>
                {nonNegIsNumeric && room.rateCadence && (
                  <span style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{room.rateCadence}</span>
                )}
              </div>
              {showRateSuffix && nonNegIsNumeric && (
                <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {room.rateSuffix}
                </div>
              )}
            </div>
          )}

          {room.ambienceNightlyRate && (
            <div style={{
              padding: '8px 14px',
              borderRadius: ambienceIsNumeric ? 999 : 14,
              border: `1px solid rgba(216,181,106,0.45)`,
              background: 'rgba(216,181,106,0.10)',
              color: ID.gold,
              fontSize: 13,
              letterSpacing: '0.06em',
              fontWeight: 800,
              whiteSpace: ambienceIsNumeric ? 'nowrap' : 'normal',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: 'flex-start',
              boxShadow: '0 0 0 1px rgba(216,181,106,0.10)',
              maxWidth: '100%',
              minWidth: 0,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: ambienceIsNumeric ? 'nowrap' : 'wrap' }}>
                <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Ambience</span>
                <span>{room.ambienceNightlyRate}</span>
                {ambienceIsNumeric && room.rateCadence && (
                  <span style={{ fontSize: 10, color: ID.dim, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{room.rateCadence}</span>
                )}
              </div>
              {showRateSuffix && ambienceIsNumeric && (
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