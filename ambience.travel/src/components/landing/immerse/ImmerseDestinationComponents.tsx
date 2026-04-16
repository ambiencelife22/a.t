// ImmerseDestinationComponents.tsx — section components for /immerse/ destination subpages
// Owns: ImmerseDestIntro, ImmerseHotelOptions, ImmerseContentGrid, ImmerseDestPricing
// Last updated: S11

import { useState, useRef, useEffect } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow, ImmerseTitle, ImmerseBody, ImmersePanel, ImmerseStayBox } from './ImmerseComponents'
import { C } from '../../../lib/landingTypes'
import { getDestinationName, getDestinationShorthand } from '../../../lib/destinations'
import { PricingTable, Td, TotalTd, NotesList } from './ImmerseJourneyComponents'
import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseRoomOption, ImmerseContentCard, ImmersePricingRow } from '../../../lib/immerseTypes'

// ─── Intro ────────────────────────────────────────────────────────────────────

export function ImmerseDestIntro({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  // Resolve canonical destination name from lib/destinations
  const destShorthand = getDestinationShorthand(data.destinationId)
  const eyebrow       = `Destination · ${destShorthand}`

  return (
    <ImmerseSectionWrap
      refProp={ref as React.RefObject<HTMLElement>}
      style={{ background: C.bgAlt }}
    >
      <div
        style={{
          maxWidth:      720,
          margin:        '0 auto',
          textAlign:     'center',
          display:       'flex',
          flexDirection: 'column',
          gap:           16,
        }}
      >
        <ImmerseEyebrow style={{ color: C.faint, ...immerseFadeUp(visible, 0) }}>
          {eyebrow}
        </ImmerseEyebrow>
        <ImmerseTitle serif style={{ fontSize: 'clamp(28px,4vw,50px)', color: C.text, ...immerseFadeUp(visible, 60) }}>
          {getDestinationName(data.destinationId)}
        </ImmerseTitle>
        <ImmerseBody style={{ color: C.muted, ...immerseFadeUp(visible, 120) }}>
          {data.introBody}
        </ImmerseBody>
      </div>
    </ImmerseSectionWrap>
  )
}

// ─── Hotel options ────────────────────────────────────────────────────────────

export function ImmerseHotelOptions({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible }                 = useImmerseVisible()
  const { ref: ref2, visible: visible2 } = useImmerseVisible()
  const isMobile                         = useImmerseMobile()
  const [activeHotel, setActiveHotel]    = useState(0)
  const [activeRoom,  setActiveRoom]     = useState(0)
  const [lightboxIdx, setLightboxIdx]    = useState<number | null>(null)
  const [dragStart,   setDragStart]      = useState<number | null>(null)
  const carouselRef                      = useRef<HTMLDivElement>(null)

  const hotel       = data.hotels[activeHotel]
  const rooms       = hotel.rooms
  const totalRooms  = rooms.length
  const gallery     = hotel.gallery ?? []

  function goHotel(idx: number) {
    setActiveHotel(idx)
    setActiveRoom(0)
  }

  function goRoom(idx: number) {
    const clamped = Math.max(0, Math.min(totalRooms - 1, idx))
    setActiveRoom(clamped)
  }

  // Room carousel — non-passive touch
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    let startX = 0
    function onTouchStart(e: TouchEvent) { startX = e.touches[0].clientX }
    function onTouchMove(e: TouchEvent)  { if (Math.abs(startX - e.touches[0].clientX) > 10) e.preventDefault() }
    function onTouchEnd(e: TouchEvent)   { const d = startX - e.changedTouches[0].clientX; if (d > 40) goRoom(activeRoom + 1); if (d < -40) goRoom(activeRoom - 1) }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchmove', onTouchMove); el.removeEventListener('touchend', onTouchEnd) }
  }, [activeRoom, totalRooms, isMobile])

  return (
    <>
      <ImmerseSectionWrap id='hotel-options' refProp={ref as React.RefObject<HTMLElement>} style={{
        borderRadius: '30px 30px 30px 30px',
        background:   ID.bg,
        position:     'relative',
        zIndex:       2,
        marginTop:    -24,
        boxShadow:    '0 -12px 48px rgba(0,0,0,0.48), 0 12px 48px rgba(0,0,0,0.56), 0 2px 0 rgba(216,181,106,0.10)',
      }}>
        {/* Section eyebrow */}
        <div style={{ marginBottom: 20, ...immerseFadeUp(visible, 0) }}>
          <ImmerseEyebrow>{data.hotelsEyebrow}</ImmerseEyebrow>
        </div>

        {/* Hotel button strip */}
        <div
          style={{
            display:   'flex',
            gap:       10,
            flexWrap:  isMobile ? 'wrap' : 'nowrap',
            ...immerseFadeUp(visible, 60),
          }}
        >
          {data.hotels.map((h, i) => (
            <HotelButton
              key={h.id}
              hotel={h}
              active={i === activeHotel}
              onClick={() => goHotel(i)}
            />
          ))}
        </div>

        {/* Hotel detail panel — animates in below buttons */}
        <div
          style={{
            marginTop:  24,
            animation:  'immerseFadeIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
          }}
          key={activeHotel}
        >
          <HotelDetailPanel
            hotel={hotel}
            activeRoom={activeRoom}
            isMobile={isMobile}
            onRoomChange={goRoom}
            onLightbox={setLightboxIdx}
          />
        </div>
      </ImmerseSectionWrap>

      {/* Room categories — full-width animated warm gradient band */}
      <style>{`
        @keyframes immerseRoomGlow {
          0%   { background-position: 0% 0%,   100% 0%,   0% 100%; }
          35%  { background-position: 55% 35%,  10% 90%,  90% 10%; }
          50%  { background-position: 60% 40%,   0% 100%, 100%  0%; }
          65%  { background-position: 58% 42%,   5% 95%,  95%  5%; }
          100% { background-position: 100% 100%, 50% 50%,  0%  0%; }
        }
        @keyframes immerseFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
      <section
        ref={ref2 as React.RefObject<HTMLElement>}
        style={{
          padding:            '58px 0',
          backgroundImage:    [
            'linear-gradient(135deg, rgba(216,181,106,0.14) 0%, rgba(180,140,80,0.09) 40%, rgba(120,90,50,0.04) 70%, rgba(6,6,6,0) 100%)',
            'linear-gradient(220deg, rgba(200,160,90,0.09) 0%, rgba(160,110,60,0.05) 40%, rgba(6,6,6,0) 65%)',
            'linear-gradient(310deg, rgba(216,181,106,0.06) 0%, rgba(6,6,6,0) 50%)',
          ].join(', '),
          backgroundSize:     '200% 200%, 240% 240%, 180% 180%',
          backgroundPosition: '0% 0%, 100% 0%, 0% 100%',
          animation:          'immerseRoomGlow 24s ease-in-out infinite alternate',
          borderTop:          '1px solid rgba(216,181,106,0.12)',
          borderBottom:       '1px solid rgba(216,181,106,0.08)',
          marginTop:          -36,
          paddingTop:         94,
          position:           'relative',
          zIndex:             1,
          transition:         'margin-top 0.55s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ width: 'min(1220px, calc(100% - 36px))', margin: '0 auto' }}>
          <div style={{ ...immerseFadeUp(visible2, 0) }}>
            <div
              ref={carouselRef}
              style={{ position: 'relative', userSelect: 'none' }}
              onMouseDown={e  => setDragStart(e.clientX)}
              onMouseUp={e    => { if (dragStart !== null) { const d = dragStart - e.clientX; if (d > 40) goRoom(activeRoom + 1); if (d < -40) goRoom(activeRoom - 1); setDragStart(null) } }}
              onMouseLeave={() => setDragStart(null)}
            >
              <RoomCategory
                key={`${activeHotel}-${activeRoom}`}
                room={rooms[activeRoom]}
                hotel={hotel}
                fadeIn
              />
              {activeRoom > 0 && (
                <button
                  onClick={() => goRoom(activeRoom - 1)}
                  style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: ID.muted, fontSize: 22, cursor: 'pointer', opacity: 0.38, padding: '8px 6px', lineHeight: 1, transition: 'opacity 0.2s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.78')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.38')}
                >‹</button>
              )}
              {activeRoom < totalRooms - 1 && (
                <button
                  onClick={() => goRoom(activeRoom + 1)}
                  style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: ID.muted, fontSize: 22, cursor: 'pointer', opacity: 0.38, padding: '8px 6px', lineHeight: 1, transition: 'opacity 0.2s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.78')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.38')}
                >›</button>
              )}
            </div>
            {totalRooms > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                {rooms.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goRoom(i)}
                    style={{
                      width:        i === activeRoom ? 22 : 7,
                      height:       7,
                      borderRadius: 999,
                      background:   i === activeRoom ? ID.gold : ID.lineSoft,
                      border:       'none',
                      cursor:       'pointer',
                      padding:      0,
                      transition:   'width 0.3s ease, background 0.3s ease',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Gallery strip — same hotel gallery, below rooms */}
            {gallery.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 12 }}>
                  Gallery · {gallery.length} photos
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {gallery.map((src, i) => (
                    <div
                      key={i}
                      onClick={() => setLightboxIdx(i)}
                      style={{
                        flexShrink:   0,
                        width:        isMobile ? 180 : 240,
                        height:       isMobile ? 120 : 160,
                        borderRadius: ID.radiusMd,
                        overflow:     'hidden',
                        border:       `1px solid ${ID.line}`,
                        cursor:       'pointer',
                      }}
                    >
                      <img
                        src={src}
                        alt={`${hotel.name} ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.06)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxIdx !== null && gallery.length > 0 && (
        <LightboxOverlay
          images={gallery}
          index={lightboxIdx}
          hotelName={hotel.name}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i)}
          onNext={() => setLightboxIdx(i => i !== null && i < gallery.length - 1 ? i + 1 : i)}
        />
      )}
    </>
  )
}

// ─── Hotel button — minimal pill-style selector ───────────────────────────────

function HotelButton({ hotel, active, onClick }: { hotel: ImmerseHotelOption; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:          '1 1 auto',
        padding:       '16px 20px',
        borderRadius:  ID.radiusMd,
        border:        `1px solid ${active ? ID.gold : hovered ? 'rgba(216,181,106,0.30)' : ID.line}`,
        background:    active ? 'rgba(216,181,106,0.08)' : 'transparent',
        cursor:        'pointer',
        textAlign:     'left',
        transition:    'border-color 0.25s ease, background 0.25s ease',
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: active ? ID.gold : ID.dim, fontWeight: 700, marginBottom: 6, transition: 'color 0.25s ease' }}>
        {hotel.rankLabel}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: active ? ID.text : ID.muted, lineHeight: 1.1, transition: 'color 0.25s ease' }}>
        {hotel.name}
      </div>
      <div style={{ fontSize: 11, color: active ? ID.dim : ID.lineSoft, marginTop: 4, letterSpacing: '0.08em', transition: 'color 0.25s ease' }}>
        {hotel.stayLabel}
      </div>
    </button>
  )
}

// ─── Hotel detail panel — full content below button strip ─────────────────────

function HotelDetailPanel({ hotel, activeRoom, isMobile, onRoomChange, onLightbox }: {
  hotel:        ImmerseHotelOption
  activeRoom:   number
  isMobile:     boolean
  onRoomChange: (i: number) => void
  onLightbox:   (i: number) => void
}) {
  const gallery = hotel.gallery ?? []

  return (
    <div style={{ display: 'grid', gap: 24 }}>

      {/* Hero image + name */}
      <div
        style={{
          position:     'relative',
          borderRadius: ID.radiusXl,
          overflow:     'hidden',
          height:       isMobile ? 260 : 420,
        }}
      >
        <img
          src={hotel.imageSrc}
          alt={hotel.imageAlt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Name overlay */}
        <div
          style={{
            position:   'absolute',
            bottom:     0,
            left:       0,
            right:      0,
            padding:    isMobile ? '32px 22px 22px' : '64px 36px 28px',
            background: 'linear-gradient(0deg, rgba(3,3,3,0.72) 0%, rgba(3,3,3,0) 100%)',
          }}
        >
          <div
            style={{
              fontSize:      isMobile ? 36 : 'clamp(44px,5vw,72px)',
              lineHeight:    0.95,
              letterSpacing: '-0.03em',
              fontWeight:    400,
              fontFamily:    '"Cormorant Garamond", "Cormorant", "Times New Roman", serif',
              color:         ID.text,
            }}
          >
            {hotel.name}
          </div>
        </div>
      </div>

      {/* Bullets */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {hotel.bullets.map(b => (
          <div
            key={b}
            style={{
              padding:       '8px 14px',
              borderRadius:  999,
              border:        `1px solid ${ID.line}`,
              background:    ID.panel2,
              color:         ID.muted,
              fontSize:      12,
              letterSpacing: '0.04em',
            }}
          >
            {b}
          </div>
        ))}
      </div>

      {/* Gallery strip */}
      {gallery.length > 0 && (
        <div>
          <div
            style={{
              fontSize:      10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color:         ID.dim,
              fontWeight:    700,
              marginBottom:  10,
            }}
          >
            Gallery · {gallery.length} photos
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {gallery.map((src, i) => (
              <div
                key={i}
                onClick={() => onLightbox(i)}
                style={{
                  flexShrink:   0,
                  width:        isMobile ? 180 : 240,
                  height:       isMobile ? 120 : 160,
                  borderRadius: ID.radiusMd,
                  overflow:     'hidden',
                  border:       `1px solid ${ID.line}`,
                  cursor:       'pointer',
                }}
              >
                <img
                  src={src}
                  alt={`${hotel.name} ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LightboxOverlay({ images, index, hotelName, onClose, onPrev, onNext }: {
  images:    string[]
  index:     number
  hotelName: string
  onClose:   () => void
  onPrev:    () => void
  onNext:    () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         999,
        background:     'rgba(3,3,3,0.94)',
        backdropFilter: 'blur(12px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        animation:      'immerseFadeIn 0.25s ease both',
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position:   'fixed',
          top:        24,
          right:      28,
          background: 'none',
          border:     'none',
          color:      'rgba(245,242,236,0.5)',
          fontSize:   28,
          cursor:     'pointer',
          lineHeight: 1,
          padding:    8,
          transition: 'color 0.2s ease',
          zIndex:     1000,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = ID.text)}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,242,236,0.5)')}
      >×</button>

      {/* Counter */}
      <div
        style={{
          position:      'fixed',
          top:           28,
          left:          '50%',
          transform:     'translateX(-50%)',
          color:         ID.dim,
          fontSize:      11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight:    700,
          zIndex:        1000,
        }}
      >
        {hotelName} · {index + 1} / {images.length}
      </div>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          style={{
            position:   'fixed',
            left:       20,
            top:        '50%',
            transform:  'translateY(-50%)',
            background: 'none',
            border:     'none',
            color:      'rgba(245,242,236,0.36)',
            fontSize:   42,
            cursor:     'pointer',
            lineHeight: 1,
            padding:    '8px 12px',
            transition: 'color 0.2s ease',
            zIndex:     1000,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = ID.text)}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,242,236,0.36)')}
        >‹</button>
      )}

      {/* Next */}
      {index < images.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          style={{
            position:   'fixed',
            right:      20,
            top:        '50%',
            transform:  'translateY(-50%)',
            background: 'none',
            border:     'none',
            color:      'rgba(245,242,236,0.36)',
            fontSize:   42,
            cursor:     'pointer',
            lineHeight: 1,
            padding:    '8px 12px',
            transition: 'color 0.2s ease',
            zIndex:     1000,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = ID.text)}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,242,236,0.36)')}
        >›</button>
      )}

      {/* Image */}
      <img
        key={index}
        src={images[index]}
        alt={`${hotelName} image ${index + 1}`}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth:     'calc(100vw - 120px)',
          maxHeight:    'calc(100vh - 120px)',
          objectFit:    'contain',
          borderRadius: ID.radiusLg,
          boxShadow:    '0 32px 80px rgba(0,0,0,0.64)',
          animation:    'immerseFadeIn 0.3s ease both',
          display:      'block',
        }}
      />

      {/* Dot strip */}
      <div
        style={{
          position:  'fixed',
          bottom:    28,
          left:      '50%',
          transform: 'translateX(-50%)',
          display:   'flex',
          gap:       8,
          zIndex:    1000,
        }}
      >
        {images.map((_, i) => (
          <div
            key={i}
            style={{
              width:        i === index ? 22 : 7,
              height:       7,
              borderRadius: 999,
              background:   i === index ? ID.gold : 'rgba(245,242,236,0.22)',
              transition:   'width 0.3s ease, background 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}


function RoomCategory({ room, hotel, fadeIn = false }: { room: ImmerseRoomOption; hotel: ImmerseHotelOption; fadeIn?: boolean }) {
  const isMobile = useImmerseMobile()

  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.02fr 0.98fr',
        gap:                 18,
        alignItems:          'stretch',
        animation:           fadeIn ? 'immerseFadeIn 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined,
      }}
    >
      <div
        style={{
          minHeight:    isMobile ? 260 : 480,
          overflow:     'hidden',
          border:       `1px solid ${ID.line}`,
          borderRadius: ID.radiusXl,
          boxShadow:    '0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(216,181,106,0.08)',
        }}
      >
        <img
          src={room.roomImageSrc}
          alt={room.roomImageAlt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.4s ease' }}
        />
      </div>

      <ImmersePanel style={{ padding: isMobile ? 22 : 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18, background: ID.panel, boxShadow: '0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(216,181,106,0.08)' }}>
        <div>
          <ImmerseEyebrow>{room.levelLabel}</ImmerseEyebrow>
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
              <div style={{ fontSize: isMobile ? 28 : 40, lineHeight: 0.98, letterSpacing: '-0.02em', fontWeight: 400, fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif', color: ID.text, marginBottom: 6 }}>
                {room.roomBasis}
              </div>
              {(room.sqft || room.sqm) && (
                <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: ID.dim, fontWeight: 600, marginBottom: 4 }}>
                  {room.sqft ? `${room.sqft.toLocaleString()} sq ft` : ''}{room.sqft && room.sqm ? ' / ' : ''}{room.sqm ? `${room.sqm} sqm` : ''}
                </div>
              )}
              {(room.nightlyRate || room.publicNightlyRate) && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
                  {room.nightlyRate && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: ID.gold, letterSpacing: '0.04em' }}>
                      {room.nightlyRate} <span style={{ fontSize: 10, fontWeight: 600, color: ID.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>per night</span>
                    </div>
                  )}
                  {room.publicNightlyRate && (
                    <div style={{ fontSize: 11, color: ID.dim, letterSpacing: '0.08em' }}>
                      Public rate: {room.publicNightlyRate}
                    </div>
                  )}
                </div>
              )}
            </div>
            <ImmerseStayBox label={hotel.stayLabel} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12 }}>
          {room.roomBenefits.map(b => (
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
  dark?:   boolean
  id?:     string
}

export function ImmerseContentGrid({ eyebrow, title, body, items, dark = false, id }: ContentGridProps) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

  const eyebrowColor  = dark ? ID.gold  : C.faint
  const titleColor    = dark ? ID.text  : C.text
  const bodyColor     = dark ? ID.muted : C.muted
  const sectionBg     = dark ? {}       : { background: C.bgAlt }

  return (
    <ImmerseSectionWrap id={id} refProp={ref as React.RefObject<HTMLElement>} style={sectionBg}>
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
          <ImmerseEyebrow style={{ color: eyebrowColor }} shimmer={false}>{eyebrow}</ImmerseEyebrow>
          <ImmerseTitle serif style={{ fontSize: 'clamp(28px,4vw,50px)', margin: 0, color: titleColor }}>{title}</ImmerseTitle>
        </div>
        <ImmerseBody style={{ color: bodyColor }}>{body}</ImmerseBody>
      </div>

      <div
        style={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
          gap:                 14,
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

  const cardBg       = inverted ? C.bgAlt   : ID.panel2
  const cardBorder   = inverted ? C.border  : ID.line
  const nameColor    = inverted ? C.text    : ID.text
  const mutedColor   = inverted ? C.muted   : ID.muted
  const ruleColor    = inverted ? `${C.gold}88` : `${ID.gold}55`
  const dividerColor = inverted ? C.border  : ID.line

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border:        `1px solid ${cardBorder}`,
        borderRadius:  24,
        overflow:      'hidden',
        background:    cardBg,
        boxShadow:     inverted ? '0 4px 24px rgba(0,0,0,0.10)' : ID.shadow,
        display:       'flex',
        animation:     `immerseFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 90}ms both`,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${ruleColor}, transparent)` }} />
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: inverted ? C.gold : ID.gold, fontWeight: 700 }}>
            {item.kicker}
          </div>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, ${ruleColor}, transparent)` }} />
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.01em', fontWeight: 400, fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif', color: nameColor, marginBottom: 8 }}>
          {item.name}
        </div>
        <div style={{ color: mutedColor, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>{item.tagline}</div>
        <div style={{ color: mutedColor, fontSize: 13, lineHeight: 1.7, marginBottom: item.bullets?.length ? 12 : 0 }}>{item.body}</div>
        {item.bullets && item.bullets.length > 0 && (
          <>
            <div style={{ height: 1, background: dividerColor, margin: '10px 0' }} />
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

  return (
    <section
      id='pricing'
      ref={ref as React.RefObject<HTMLElement>}
      style={{
        padding:            '58px 0',
        backgroundImage:    [
          'linear-gradient(135deg, rgba(216,181,106,0.14) 0%, rgba(180,140,80,0.09) 40%, rgba(120,90,50,0.04) 70%, rgba(6,6,6,0) 100%)',
          'linear-gradient(220deg, rgba(200,160,90,0.09) 0%, rgba(160,110,60,0.05) 40%, rgba(6,6,6,0) 65%)',
          'linear-gradient(310deg, rgba(216,181,106,0.06) 0%, rgba(6,6,6,0) 50%)',
        ].join(', '),
        backgroundSize:     '200% 200%, 240% 240%, 180% 180%',
        backgroundPosition: '0% 0%, 100% 0%, 0% 100%',
        animation:          'immerseRoomGlow 24s ease-in-out infinite alternate',
        borderTop:          '1px solid rgba(216,181,106,0.12)',
        borderBottom:       '1px solid rgba(216,181,106,0.08)',
      }}
    >
      <div style={{ width: 'min(1220px, calc(100% - 36px))', margin: '0 auto' }}>
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap:                 18,
            ...immerseFadeUp(visible, 0),
          }}
        >
          <ImmersePanel style={{ padding: 30, background: ID.panel }}>
            <ImmerseEyebrow>{data.pricingEyebrow}</ImmerseEyebrow>
            <ImmerseTitle serif style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>{data.pricingTitle}</ImmerseTitle>
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

          <ImmersePanel style={{ padding: 30, background: ID.panel }}>
            <ImmerseEyebrow>{data.pricingNotesHeading}</ImmerseEyebrow>
            <ImmerseTitle serif style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>{data.pricingNotesTitle}</ImmerseTitle>
            <NotesList notes={data.pricingNotes} />
          </ImmersePanel>
        </div>
      </div>
    </section>
  )
}