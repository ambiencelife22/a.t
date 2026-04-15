// ImmerseDestinationComponents.tsx — section components for /immerse/ destination subpages
// Owns: ImmerseDestIntro, ImmerseHotelOptions, ImmerseContentGrid, ImmerseDestPricing
// Last updated: S11

import { useState, useRef, useEffect } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow, ImmerseTitle, ImmerseBody, ImmersePanel, ImmerseStayBox } from './ImmerseComponents'
import { C } from '../../../lib/landingTypes'
import { PricingTable, Td, TotalTd, NotesList } from './ImmerseJourneyComponents'
import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseRoomOption, ImmerseContentCard, ImmersePricingRow } from '../../../lib/immerseTypes'

// ─── Intro ────────────────────────────────────────────────────────────────────

export function ImmerseDestIntro({ data }: { data: ImmerseDestinationData }) {
  const { ref, visible } = useImmerseVisible()
  const isMobile         = useImmerseMobile()

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
          {data.introEyebrow}
        </ImmerseEyebrow>
        <ImmerseTitle style={{ fontSize: 'clamp(28px,4vw,50px)', color: C.text, ...immerseFadeUp(visible, 60) }}>
          {data.introTitle}
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
  const [galleryOpen, setGalleryOpen]    = useState(false)
  const [dragStart,   setDragStart]      = useState<number | null>(null)
  const carouselRef                      = useRef<HTMLDivElement>(null)
  const hotelCarouselRef                 = useRef<HTMLDivElement>(null)

  const hotel       = data.hotels[activeHotel]
  const rooms       = hotel.rooms
  const totalRooms  = rooms.length
  const totalHotels = data.hotels.length
  const gallery     = hotel.gallery ?? []

  function goHotel(idx: number) {
    const clamped = Math.max(0, Math.min(totalHotels - 1, idx))
    if (clamped === activeHotel) {
      setGalleryOpen(prev => !prev)
      return
    }
    setActiveHotel(clamped)
    setActiveRoom(0)
    setGalleryOpen(true)
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

  // Hotel carousel (mobile) — non-passive touch
  useEffect(() => {
    const el = hotelCarouselRef.current
    if (!el) return
    let startX = 0
    function onTouchStart(e: TouchEvent) { startX = e.touches[0].clientX }
    function onTouchMove(e: TouchEvent)  { if (Math.abs(startX - e.touches[0].clientX) > 10) e.preventDefault() }
    function onTouchEnd(e: TouchEvent)   { const d = startX - e.changedTouches[0].clientX; if (d > 40) goHotel(activeHotel + 1); if (d < -40) goHotel(activeHotel - 1) }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchmove', onTouchMove); el.removeEventListener('touchend', onTouchEnd) }
  }, [activeHotel, totalHotels, isMobile])

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
          </div>
        </div>

        {/* Hotel option cards — desktop: 3-col grid. Mobile: swipe carousel */}
        {isMobile ? (
          <div style={{ ...immerseFadeUp(visible, 80) }}>
            <div
              style={{ position: 'relative', userSelect: 'none', touchAction: 'pan-y' }}
              onMouseDown={e => setDragStart(e.clientX)}
              onMouseUp={e => { if (dragStart !== null) { const d = dragStart - e.clientX; if (d > 40) goHotel(activeHotel + 1); if (d < -40) goHotel(activeHotel - 1); setDragStart(null) } }}
              onMouseLeave={() => setDragStart(null)}
            >
              <HotelOptionCard
                hotel={data.hotels[activeHotel]}
                active={true}
                galleryOpen={galleryOpen}
                onClick={() => goHotel(activeHotel)}
              />
              <div ref={hotelCarouselRef} style={{ position: 'absolute', inset: 0, zIndex: 10 }} />
            </div>
            {totalHotels > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {data.hotels.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goHotel(i)}
                    style={{
                      width:        i === activeHotel ? 22 : 7,
                      height:       7,
                      borderRadius: 999,
                      background:   i === activeHotel ? ID.gold : ID.lineSoft,
                      border:       'none',
                      cursor:       'pointer',
                      padding:      0,
                      transition:   'width 0.3s ease, background 0.3s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap:                 14,
              ...immerseFadeUp(visible, 80),
            }}
          >
            {data.hotels.map((h, i) => (
              <HotelOptionCard
                key={h.id}
                hotel={h}
                active={i === activeHotel}
                galleryOpen={i === activeHotel && galleryOpen}
                onClick={() => goHotel(i)}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Gallery strip — animates open below cards */}
        <div
          style={{
            overflow:   'hidden',
            maxHeight:  galleryOpen && gallery.length > 0 ? 360 : 0,
            opacity:    galleryOpen && gallery.length > 0 ? 1 : 0,
            transition: 'max-height 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
            marginTop:  galleryOpen && gallery.length > 0 ? 18 : 0,
          }}
        >
          <div
            style={{
              display:          'flex',
              gap:              12,
              overflowX:        'auto',
              paddingBottom:    12,
              scrollbarWidth:   'none',
              msOverflowStyle:  'none',
            }}
          >
            {gallery.map((src, i) => (
              <div
                key={i}
                style={{
                  flexShrink:   0,
                  width:        isMobile ? 240 : 320,
                  height:       isMobile ? 180 : 260,
                  borderRadius: ID.radiusLg,
                  overflow:     'hidden',
                  border:       `1px solid ${ID.line}`,
                  boxShadow:    '0 8px 24px rgba(0,0,0,0.36)',
                }}
              >
                <img
                  src={src}
                  alt={`${hotel.name} gallery image ${i + 1}`}
                  style={{
                    width:      '100%',
                    height:     '100%',
                    objectFit:  'cover',
                    display:    'block',
                    transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)' }}
                />
              </div>
            ))}
          </div>
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
        .gallery-strip::-webkit-scrollbar { display: none; }
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

            {/* Room carousel */}
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
          </div>
        </div>
      </section>
    </>
  )
}

function HotelOptionCard({ hotel, active, galleryOpen, onClick, index = 0 }: { hotel: ImmerseHotelOption; active: boolean; galleryOpen: boolean; onClick: () => void; index?: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border:        `1px solid ${active ? (galleryOpen ? ID.gold : 'rgba(216,181,106,0.55)') : hovered ? 'rgba(216,181,106,0.28)' : ID.line}`,
        borderRadius:  24,
        overflow:      'hidden',
        background:    active ? ID.panel : ID.panel2,
        boxShadow:     active ? '0 8px 32px rgba(0,0,0,0.48)' : ID.shadow,
        display:       'flex',
        flexDirection: 'column',
        transition:    'border-color 0.3s ease, opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease',
        cursor:        'pointer',
        opacity:       active ? 1 : 0.58,
        transform:     active ? 'scale(1)' : 'scale(0.97)',
        animation:     `immerseFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 90}ms both`,
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
            transform:  hovered && !active ? 'scale(1.04)' : 'scale(1)',
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

        {/* Gallery hint when active */}
        {active && hotel.gallery && hotel.gallery.length > 0 && (
          <div
            style={{
              marginTop:     12,
              paddingTop:    12,
              borderTop:     `1px solid ${ID.line}`,
              display:       'flex',
              alignItems:    'center',
              gap:           6,
              color:         ID.gold,
              fontSize:      10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight:    700,
              opacity:       0.72,
            }}
          >
            <span style={{ transition: 'transform 0.3s ease', transform: galleryOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
            {galleryOpen ? 'Hide gallery' : `View gallery · ${hotel.gallery.length} images`}
          </div>
        )}
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
          <ImmerseEyebrow>{room.roomCategory}</ImmerseEyebrow>
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
                {room.roomBasis}
              </div>
              <ImmerseBody>{hotel.description}</ImmerseBody>
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

          <ImmersePanel style={{ padding: 30, background: ID.panel }}>
            <ImmerseEyebrow>{data.pricingNotesHeading}</ImmerseEyebrow>
            <ImmerseTitle style={{ fontSize: 'clamp(28px,3.6vw,44px)' }}>{data.pricingNotesTitle}</ImmerseTitle>
            <NotesList notes={data.pricingNotes} />
          </ImmersePanel>
        </div>
      </div>
    </section>
  )
}