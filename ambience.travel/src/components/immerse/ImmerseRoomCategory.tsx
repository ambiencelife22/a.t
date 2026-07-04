// ImmerseRoomCategory.tsx — single room tier render (content panel + hero)
// Owns: RoomCategory component. Renders the room's level, basis, size/rate
//   chips, benefits grid, and hero image. Mobile reorders content → nav → hero.
// Does not own: carousel state (lives in parent: FlatHotelOptions / HotelWithRooms)
//
// Last updated: S53C — room alert badge (roomAlert/roomAlertLevel), connecting
//   note line (connectingNote), and tax treatment preferred over legacy
//   rateSuffix. Rate-suffix display now resolves taxTreatment ?? rateSuffix.
// Prior: S53B Closing+3 — Public rate pill now only renders with
//   strikethrough + "PUBLIC" prefix when at least one comparison rate
//   (nonNegotiatedNightlyRate or ambienceNightlyRate) is set. When public
//   is alone, it renders as a neutral rate pill (no strikethrough, no
//   "Public" label) since strikethrough without a comparison reads as a
//   bug, not as savings context.
// Prior: S32K — Replaced hardcoded "/ night" rate suffix with data-driven
//   room.rateCadence. Cadence comes from travel_immerse_rate_cadences
//   reference table (Per Night, Per Stay, Per Week, Per Month — extensible).
// Prior: S32K — Room name rendering fixed. Eyebrow now shows tierLabel
//   (engagement-specific tier: "Highlighted", "Alternative 1"), title shows
//   levelLabel (room name: "Oceanfront One Bedroom Suite", "Corner Suite").
// S32: detect numeric rate strings ($1,200 / €420 / EURO 5,400 / GBP 800 / 1500).
//   non-numeric is treated as informational copy.
// Prior: S31 — Animation swapped to immerseFadeOnly.
// Prior: S30G — Mobile NavRow between content and hero.
// Prior: S30F — rateSuffix data-driven.

import { useState } from 'react'
import { ID, useImmerseMobile, ImmerseEyebrow, ImmersePanel } from './ImmerseComponents'
import { beddingConfigurationsLabel } from '../../utils/utilsBooking'
import type { ImmerseHotelOption, ImmerseRoomOption } from '../../types/typesImmerse'

// S32: detect numeric rate strings ($1,200 / €420 / 1500)
// (including 'Winter Pricing Not Yet Available', 'On Request', 'TBD') is
// treated as informational copy and rendered without the cadence suffix.
function isNumericRate(rate: string): boolean {
  return /^([$€£¥]|EURO|USD|GBP|JPY|CHF|AED|SAR)?\s*[$€£¥]?\s*\d/i.test(rate.trim())
}

// S32: collapse degenerate ranges (678-678 → 678). Both bounds optional.
function formatSqRange(min: number | undefined, max: number | undefined, unit: string): string {
  if (!min) return ''
  if (!max || max === min) return `${min.toLocaleString()} ${unit}`
  return `${min.toLocaleString()}-${max.toLocaleString()} ${unit}`
}

// S53C — alert badge palette by level.
function alertPalette(level: string | undefined): { border: string; bg: string; fg: string } {
  if (level === 'warning') return { border: 'rgba(214,108,90,0.5)',  bg: 'rgba(214,108,90,0.12)',  fg: '#e8a08f' }
  if (level === 'pending') return { border: 'rgba(216,181,106,0.5)', bg: 'rgba(216,181,106,0.10)', fg: ID.gold }
  return { border: 'rgba(120,150,190,0.45)', bg: 'rgba(120,150,190,0.10)', fg: '#9db4d4' } // info / default
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

  // S53C — prefer structured tax treatment over legacy free-text rate suffix.
  const rateTaxLabel  = room.taxTreatment ?? room.rateSuffix
  const showRateSuffix = !room.taxInclusive && Boolean(rateTaxLabel)

  // S32: collapsed sq ranges + numeric vs copy rate detection
  const sqftPart = formatSqRange(room.sqftMin, room.sqftMax, 'sq ft')
  const sqmPart  = formatSqRange(room.sqmMin,  room.sqmMax,  'sqm')
  const sqLabel  = [sqftPart, sqmPart].filter(Boolean).join(' · ')

  const nonNegIsNumeric  = room.nonNegotiatedNightlyRate ? isNumericRate(room.nonNegotiatedNightlyRate) : false
  const ambienceIsNumeric = room.ambienceNightlyRate     ? isNumericRate(room.ambienceNightlyRate)     : false

  // S53B Closing+3: only treat public as a strikethrough comparison if a
  // comparison rate is actually present.
  const publicIsNumeric  = room.publicNightlyRate ? isNumericRate(room.publicNightlyRate) : false
  const hasComparisonRate = Boolean(room.nonNegotiatedNightlyRate || room.ambienceNightlyRate)

  const alert = room.roomAlert ? alertPalette(room.roomAlertLevel) : null

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
          {beddingConfigurationsLabel(room.beddingConfigurations) && (
            <div style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.dim, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {beddingConfigurationsLabel(room.beddingConfigurations)}
            </div>
          )}

          {/* S53B Closing+3 — public rate pill:
              • With a comparison rate (non-negotiated or ambience) present:
                strikethrough + "PUBLIC" prefix to read as the crossed-out
                pre-negotiation reference.
              • Without a comparison rate: render as a plain neutral rate pill
                with no strikethrough and no label — the price IS the price. */}
          {room.publicNightlyRate && hasComparisonRate && (
            <div style={{ position: 'relative', padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.dim, opacity: 0.55, fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', gap: 5, alignItems: 'center', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: '-10%', top: '50%', width: '120%', height: 1, background: `linear-gradient(90deg, transparent, ${ID.dim}77, transparent)`, transform: 'rotate(-18deg)', pointerEvents: 'none' }} />
              <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>Public</span>
              <span style={{ opacity: 0.8 }}>{room.publicNightlyRate}</span>
            </div>
          )}

          {room.publicNightlyRate && !hasComparisonRate && (
            <div style={{
              padding: '7px 13px',
              borderRadius: publicIsNumeric ? 999 : 14,
              border: `1px solid ${ID.line}`,
              background: ID.panel2,
              color: ID.muted,
              fontSize: 11,
              letterSpacing: '0.08em',
              fontWeight: 500,
              whiteSpace: publicIsNumeric ? 'nowrap' : 'normal',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: 'flex-start',
              maxWidth: '100%',
              minWidth: 0,
            }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: publicIsNumeric ? 'nowrap' : 'wrap' }}>
                <span>{room.publicNightlyRate}</span>
                {publicIsNumeric && room.rateCadence && (
                  <span style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{room.rateCadence}</span>
                )}
              </div>
              {showRateSuffix && publicIsNumeric && (
                <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {rateTaxLabel}
                </div>
              )}
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
                  {rateTaxLabel}
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
                  {rateTaxLabel}
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

        {/* S53C — connecting-rooms note. Renders when this room is part of a
            connecting pair. Sits below the chips as a single descriptor line. */}
        {room.connectingNote && (
          <div style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 13px',
            borderRadius: 12,
            border: `1px solid rgba(216,181,106,0.28)`,
            background: 'rgba(216,181,106,0.06)',
            color: ID.muted,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            <svg width='13' height='13' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' style={{ flexShrink: 0 }}>
              <path d='M6 8h4M5 5.5a2.5 2.5 0 000 5h1M11 5.5a2.5 2.5 0 010 5h-1' stroke={ID.gold} strokeWidth='1.2' strokeLinecap='round' />
            </svg>
            <span>{room.connectingNote}</span>
          </div>
        )}

        {/* S53C — room alert badge. Distinct from amenities; styled by level
            (pending / warning / info). Renders only when roomAlert is set. */}
        {alert && (
          <div style={{
            marginTop: room.connectingNote ? 10 : 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 13px',
            borderRadius: 12,
            border: `1px solid ${alert.border}`,
            background: alert.bg,
            color: alert.fg,
            fontSize: 12,
            letterSpacing: '0.02em',
            lineHeight: 1.5,
            fontWeight: 600,
          }}>
            <svg width='13' height='13' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' style={{ flexShrink: 0 }}>
              <circle cx='8' cy='8' r='6.4' stroke='currentColor' strokeWidth='1.2' />
              <path d='M8 4.6v4.2M8 11.1h.01' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
            </svg>
            <span>{room.roomAlert}</span>
          </div>
        )}
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
        src={room.roomImageSrc || undefined}
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