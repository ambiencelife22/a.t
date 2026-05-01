// ImmerseHotelOptions.tsx — hotel selector + per-hotel detail + room/hotel carousel
// Owns: ImmerseHotelOptions (export), FlatHotelOptions, RegionedHotelOptions,
//   HotelWithRooms, SelectorAndCarousel scaffolding, HotelButton, HotelDetailPanel,
//   LightboxOverlay
// Does not own: RoomCategory (ImmerseRoomCategory.tsx), NavRow + arrow styles
//   (ImmerseCarouselNav.tsx), keyframes (src/index.css)
//
// Last updated: S32K — Desktop flow arrows added to SelectorAndCarousel for flat
//   destinations. Matches HotelWithRooms pattern (centered, 64px gap, flow-style).
//   Renders between carousel and NavRow dots, only when !gutterArrowsAroundHero.
//
// S32 — LightboxOverlay rendered via React Portal into document.body.
// Prior: S31 — Regioned room-switch desktop arrows centered in the flow row.
// Prior: S31 — Hotel transition animation swapped to immerseFadeOnly.

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow } from './ImmerseComponents'
import { C } from '../../lib/landingTypes'
import { NavRow, desktopGutterArrowStyle, desktopFlowArrowStyle } from './ImmerseCarouselNav'
import { RoomCategory } from './ImmerseRoomCategory'
import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseRegionGroup } from '../../lib/immerseTypes'

// ─── Hotel options (switches on hotels.kind) ─────────────────────────────────

export function ImmerseHotelOptions({ data }: { data: ImmerseDestinationData }) {
  if (data.hotels.kind === 'flat') {
    return <FlatHotelOptions data={data} hotels={data.hotels.hotels} />
  }
  return <RegionedHotelOptions data={data} regions={data.hotels.regions} />
}

// ─── Flat (NYC, St-Barths, Miami) ────────────────────────────────────────────

function FlatHotelOptions({ data, hotels }: { data: ImmerseDestinationData; hotels: ImmerseHotelOption[] }) {
  const [activeHotel, setActiveHotel] = useState(0)
  const [activeRoom, setActiveRoom]   = useState(0)
  const [prevRoom, setPrevRoom]       = useState<number | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [roomLightboxIdx, setRoomLightboxIdx] = useState<number | null>(null)

  function goHotel(idx: number) {
    setActiveHotel(idx)
    setActiveRoom(0)
  }

  if (hotels.length === 0) return null
  const hotel = hotels[activeHotel]
  if (!hotel) return null

  function goRoom(idx: number) {
    const total = hotel.rooms.length
    const clamped = Math.max(0, Math.min(total - 1, idx))
    setPrevRoom(activeRoom)
    setActiveRoom(clamped)
    setTimeout(() => setPrevRoom(null), 450)
  }

  return (
    <SelectorAndCarousel
      data={data}
      cards={hotels}
      activeIdx={activeHotel}
      onCardClick={goHotel}
      detailHotel={hotel}
      onLightbox={setLightboxIdx}
      lightboxIdx={lightboxIdx}
      setLightboxIdx={setLightboxIdx}
      carouselItems={hotel.rooms}
      activeCarouselIdx={activeRoom}
      prevCarouselIdx={prevRoom}
      onCarouselChange={goRoom}
      renderCarouselItem={(room, key, fadeIn) => (
        <RoomCategory
          key={key}
          room={room}
          hotel={hotel}
          fadeIn={fadeIn}
          onHeroClick={() => setRoomLightboxIdx(0)}
          carouselArrowsAndDots={
            hotel.rooms.length > 1 ? (
              <NavRow
                isMobile={true}
                total={hotel.rooms.length}
                activeIdx={activeRoom}
                prevIdx={prevRoom}
                onChange={goRoom}
                preserveScrollPosition
              />
            ) : null
          }
        />
      )}
      activeRoomGallery={hotel.rooms[activeRoom]?.roomGallery}
      activeRoomImageSrc={hotel.rooms[activeRoom]?.roomImageSrc}
      activeRoomBasis={hotel.rooms[activeRoom]?.levelLabel}
      roomLightboxIdx={roomLightboxIdx}
      setRoomLightboxIdx={setRoomLightboxIdx}
      lightboxLabel={hotel.name}
      roomLightboxLabel={hotel.rooms[activeRoom] ? `${hotel.name} · ${hotel.rooms[activeRoom].levelLabel}` : hotel.name}
      detailHotelArrowsAndDots={null}
    />
  )
}

// ─── Regioned (Nordic Winter, Europe Finale) ─────────────────────────────────

function RegionedHotelOptions({ data, regions }: { data: ImmerseDestinationData; regions: ImmerseRegionGroup[] }) {
  const [activeRegion, setActiveRegion] = useState(0)
  const [activeHotel, setActiveHotel]   = useState(0)
  const [prevHotel, setPrevHotel]       = useState<number | null>(null)
  const [lightboxIdx, setLightboxIdx]   = useState<number | null>(null)

  function goRegion(idx: number) {
    setActiveRegion(idx)
    setActiveHotel(0)
  }

  if (regions.length === 0) return null
  const region = regions[activeRegion]
  if (!region) return null

  const regionCards: ImmerseHotelOption[] = regions.map(r => ({
    id:           r.regionId,
    storageSlug:  r.slug,
    rank:         r.rank,
    rankLabel:    r.rankLabel,
    name:         r.title,
    bullets:      r.bullets,
    imageSrc:     r.heroImageSrc ?? '',
    imageAlt:     r.heroImageAlt ?? r.title,
    stayLabel:    r.stayLabel,
    rooms:        [],
    gallery:      r.regionGallery ?? [],
  }))

  const detailRegion = regionCards[activeRegion]
  if (!detailRegion) return null

  function goHotel(idx: number) {
    const total = region.hotels.length
    const clamped = Math.max(0, Math.min(total - 1, idx))
    setPrevHotel(activeHotel)
    setActiveHotel(clamped)
    setTimeout(() => setPrevHotel(null), 450)
  }

  return (
    <SelectorAndCarousel
      data={data}
      cards={regionCards}
      activeIdx={activeRegion}
      onCardClick={goRegion}
      detailHotel={detailRegion}
      onLightbox={setLightboxIdx}
      lightboxIdx={lightboxIdx}
      setLightboxIdx={setLightboxIdx}
      carouselItems={region.hotels}
      activeCarouselIdx={activeHotel}
      prevCarouselIdx={prevHotel}
      onCarouselChange={goHotel}
      renderCarouselItem={(hotel, key, fadeIn) => (
        <HotelWithRooms
          key={key}
          hotel={hotel}
          fadeIn={fadeIn}
          regionTitle={region.title}
          hotelArrowsAndDots={
            region.hotels.length > 1 ? (
              <NavRow
                isMobile={true}
                total={region.hotels.length}
                activeIdx={activeHotel}
                prevIdx={prevHotel}
                onChange={goHotel}
              />
            ) : null
          }
          hotelDesktopArrows={
            region.hotels.length > 1
              ? {
                  onPrev: activeHotel > 0 ? () => goHotel(activeHotel - 1) : undefined,
                  onNext: activeHotel < region.hotels.length - 1 ? () => goHotel(activeHotel + 1) : undefined,
                }
              : undefined
          }
        />
      )}
      activeRoomGallery={undefined}
      activeRoomImageSrc={undefined}
      activeRoomBasis={undefined}
      roomLightboxIdx={null}
      setRoomLightboxIdx={() => {}}
      lightboxLabel={region.title}
      roomLightboxLabel=""
      detailHotelArrowsAndDots={null}
      gutterArrowsAroundHero
    />
  )
}

// ─── HotelWithRooms ──────────────────────────────────────────────────────────

function HotelWithRooms({ hotel, fadeIn, regionTitle, hotelArrowsAndDots, hotelDesktopArrows }: {
  hotel:              ImmerseHotelOption
  fadeIn:             boolean
  regionTitle:        string
  hotelArrowsAndDots: React.ReactNode
  hotelDesktopArrows?: { onPrev?: () => void; onNext?: () => void }
}) {
  const isMobile      = useImmerseMobile()
  const [activeRoom, setActiveRoom] = useState(0)
  const [prevRoom, setPrevRoom]     = useState<number | null>(null)
  const [hotelLightboxIdx, setHotelLightboxIdx] = useState<number | null>(null)
  const [roomLightboxIdx, setRoomLightboxIdx]   = useState<number | null>(null)
  const [dragStart, setDragStart]   = useState<number | null>(null)
  const carouselRef                 = useRef<HTMLDivElement>(null)

  const total = hotel.rooms.length

  const gallery        = hotel.gallery ?? []
  const lightboxImages = [hotel.imageSrc, ...gallery.filter(s => s !== hotel.imageSrc)]

  const activeRoomData     = hotel.rooms[activeRoom]
  const roomGallery        = activeRoomData?.roomGallery ?? []
  const displayRoomGallery = roomGallery.filter(s => s !== activeRoomData?.roomImageSrc)
  const roomLightboxImages = activeRoomData?.roomImageSrc
    ? [activeRoomData.roomImageSrc, ...displayRoomGallery]
    : roomGallery

  function goRoom(idx: number) {
    const clamped = Math.max(0, Math.min(total - 1, idx))
    setPrevRoom(activeRoom)
    setActiveRoom(clamped)
    setTimeout(() => setPrevRoom(null), 450)
  }

  useEffect(() => {
    setActiveRoom(0)
    setPrevRoom(null)
  }, [hotel.id])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    let startX = 0
    function onTouchStart(e: TouchEvent) { startX = e.touches[0].clientX }
    function onTouchMove(e: TouchEvent)  { if (Math.abs(startX - e.touches[0].clientX) > 10) e.preventDefault() }
    function onTouchEnd(e: TouchEvent)   {
      const d = startX - e.changedTouches[0].clientX
      if (d > 40)  goRoom(activeRoom + 1)
      if (d < -40) goRoom(activeRoom - 1)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [activeRoom, total])

  const roomLightboxLabel = activeRoomData
    ? `${hotel.name} · ${activeRoomData.levelLabel}`
    : hotel.name

  return (
    <div
      style={{
        display: 'grid',
        gap: 36,
        animation: fadeIn ? 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined,
        minWidth: 0,
        width: '100%',
      }}
    >
      <HotelDetailPanel
        hotel={hotel}
        activeRoom={activeRoom}
        isMobile={isMobile}
        onRoomChange={goRoom}
        onLightbox={setHotelLightboxIdx}
        arrowsAndDots={hotelArrowsAndDots}
        hotelDesktopArrows={hotelDesktopArrows}
      />

      {total > 0 && activeRoomData && (
        <div style={{ width: '100%', minWidth: 0 }}>
          <div
            ref={carouselRef}
            style={{ position: 'relative', userSelect: 'none', minWidth: 0 }}
            onMouseDown={e => setDragStart(e.clientX)}
            onMouseUp={e => {
              if (dragStart !== null) {
                const d = dragStart - e.clientX
                if (d > 40)  goRoom(activeRoom + 1)
                if (d < -40) goRoom(activeRoom - 1)
                setDragStart(null)
              }
            }}
            onMouseLeave={() => setDragStart(null)}
          >
            <RoomCategory
              key={`${hotel.id}-${activeRoom}`}
              room={activeRoomData}
              hotel={hotel}
              fadeIn
              onHeroClick={() => setRoomLightboxIdx(0)}
              carouselArrowsAndDots={
                total > 1 ? (
                  <NavRow
                    isMobile={true}
                    total={total}
                    activeIdx={activeRoom}
                    prevIdx={prevRoom}
                    onChange={goRoom}
                    preserveScrollPosition
                  />
                ) : null
              }
            />
          </div>

          {!isMobile && total > 1 && (
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 64,
              }}
            >
              <button
                onClick={() => activeRoom > 0 && goRoom(activeRoom - 1)}
                disabled={activeRoom === 0}
                style={desktopFlowArrowStyle(activeRoom === 0)}
                aria-label='Previous room'
              >‹</button>
              <button
                onClick={() => activeRoom < total - 1 && goRoom(activeRoom + 1)}
                disabled={activeRoom === total - 1}
                style={desktopFlowArrowStyle(activeRoom === total - 1)}
                aria-label='Next room'
              >›</button>
            </div>
          )}

          {activeRoomData.roomImageSrc && displayRoomGallery.length >= 1 && (
            <div style={{ marginTop: 40 }} key={`room-gallery-${hotel.id}-${activeRoom}`}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 12 }}>
                Gallery · {roomLightboxImages.length} photos
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 10,
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {displayRoomGallery.map((src, i) => (
                  <div
                    key={i}
                    onClick={() => setRoomLightboxIdx(i + 1)}
                    style={{
                      width: '100%',
                      height: isMobile ? 118 : 160,
                      borderRadius: ID.radiusMd,
                      overflow: 'hidden',
                      border: `1px solid ${ID.line}`,
                      cursor: 'pointer',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 200}ms both`,
                      position: 'relative',
                      transition: 'border-color 0.3s ease, transform 0.3s ease',
                    }}
                  >
                    <img
                      src={src}
                      alt={`${activeRoomData.levelLabel} ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hotelLightboxIdx !== null && lightboxImages.length > 0 && (
        <LightboxOverlay
          images={lightboxImages}
          index={hotelLightboxIdx}
          hotelName={`${regionTitle} · ${hotel.name}`}
          onClose={() => setHotelLightboxIdx(null)}
          onPrev={() => setHotelLightboxIdx(hotelLightboxIdx > 0 ? hotelLightboxIdx - 1 : hotelLightboxIdx)}
          onNext={() => setHotelLightboxIdx(hotelLightboxIdx < lightboxImages.length - 1 ? hotelLightboxIdx + 1 : hotelLightboxIdx)}
        />
      )}

      {roomLightboxIdx !== null && roomLightboxImages.length > 0 && (
        <LightboxOverlay
          images={roomLightboxImages}
          index={roomLightboxIdx}
          hotelName={roomLightboxLabel}
          onClose={() => setRoomLightboxIdx(null)}
          onPrev={() => setRoomLightboxIdx(roomLightboxIdx > 0 ? roomLightboxIdx - 1 : roomLightboxIdx)}
          onNext={() => setRoomLightboxIdx(roomLightboxIdx < roomLightboxImages.length - 1 ? roomLightboxIdx + 1 : roomLightboxIdx)}
        />
      )}
    </div>
  )
}

// ─── Shared selector + carousel scaffolding ──────────────────────────────────

type SelectorAndCarouselProps<T> = {
  data:                       ImmerseDestinationData
  cards:                      ImmerseHotelOption[]
  activeIdx:                  number
  onCardClick:                (i: number) => void
  detailHotel:                ImmerseHotelOption
  detailHotelArrowsAndDots:   React.ReactNode
  onLightbox:                 (i: number) => void
  lightboxIdx:                number | null
  setLightboxIdx:             (i: number | null) => void
  carouselItems:              T[]
  activeCarouselIdx:          number
  prevCarouselIdx:            number | null
  onCarouselChange:           (i: number) => void
  renderCarouselItem:         (item: T, key: string, fadeIn: boolean) => React.ReactNode
  activeRoomGallery?:         string[]
  activeRoomImageSrc?:        string
  activeRoomBasis?:           string
  roomLightboxIdx:            number | null
  setRoomLightboxIdx:         (i: number | null) => void
  lightboxLabel:              string
  roomLightboxLabel:          string
  gutterArrowsAroundHero?:    boolean
}

function SelectorAndCarousel<T>({
  data,
  cards,
  activeIdx,
  onCardClick,
  detailHotel,
  detailHotelArrowsAndDots,
  onLightbox,
  lightboxIdx,
  setLightboxIdx,
  carouselItems,
  activeCarouselIdx,
  prevCarouselIdx,
  onCarouselChange,
  renderCarouselItem,
  activeRoomGallery,
  activeRoomImageSrc,
  activeRoomBasis,
  roomLightboxIdx,
  setRoomLightboxIdx,
  lightboxLabel,
  roomLightboxLabel,
  gutterArrowsAroundHero = false,
}: SelectorAndCarouselProps<T>) {
  const { ref, visible }                 = useImmerseVisible()
  const { ref: ref2, visible: visible2 } = useImmerseVisible()
  const isMobile                         = useImmerseMobile()
  const [dragStart, setDragStart]        = useState<number | null>(null)
  const carouselRef                      = useRef<HTMLDivElement>(null)

  const total = carouselItems.length

  const gallery        = detailHotel.gallery ?? []
  const lightboxImages = [detailHotel.imageSrc, ...gallery.filter(src => src !== detailHotel.imageSrc)]

  const roomGallery        = activeRoomGallery ?? []
  const displayRoomGallery = roomGallery.filter((s: string) => s !== activeRoomImageSrc)
  const roomLightboxImages = activeRoomImageSrc
    ? [activeRoomImageSrc, ...displayRoomGallery]
    : roomGallery

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    let startX = 0
    function onTouchStart(e: TouchEvent) { startX = e.touches[0].clientX }
    function onTouchMove(e: TouchEvent)  { if (Math.abs(startX - e.touches[0].clientX) > 10) e.preventDefault() }
    function onTouchEnd(e: TouchEvent)   {
      const d = startX - e.changedTouches[0].clientX
      if (d > 40)  onCarouselChange(activeCarouselIdx + 1)
      if (d < -40) onCarouselChange(activeCarouselIdx - 1)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [activeCarouselIdx, total, onCarouselChange])

  return (
    <>
      <ImmerseSectionWrap
        id='hotel-options'
        refProp={ref as React.RefObject<HTMLElement>}
        style={{
          borderRadius: '30px 30px 30px 30px',
          background: ID.bg,
          position: 'relative',
          zIndex: 2,
          marginTop: -24,
          overflow: 'hidden',
          animation: visible ? 'immerseBorderFadeIn 0.8s ease 0.1s both' : undefined,
          boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
        }}
      >
        <div style={{ marginBottom: 20, ...immerseFadeUp(visible, 0) }}>
          <ImmerseEyebrow style={visible ? { animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) both' } : { opacity: 0 }}>
            {data.hotelsEyebrow}
          </ImmerseEyebrow>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : `repeat(${cards.length}, minmax(0, 1fr))`,
            gap: 10,
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            ...immerseFadeUp(visible, 60),
          }}
        >
          {cards.map((c, i) => (
            <HotelButton
              key={c.id}
              hotel={c}
              active={i === activeIdx}
              isMobile={isMobile}
              onClick={() => onCardClick(i)}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 24,
            width: '100%',
            minWidth: 0,
            animation: 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both',
          }}
          key={activeIdx}
        >
          <HotelDetailPanel
            hotel={detailHotel}
            activeRoom={activeCarouselIdx}
            isMobile={isMobile}
            onRoomChange={onCarouselChange}
            onLightbox={setLightboxIdx}
            arrowsAndDots={detailHotelArrowsAndDots}
          />
        </div>
      </ImmerseSectionWrap>

      <section
        ref={ref2 as React.RefObject<HTMLElement>}
        style={{
          padding: '58px 0',
          borderTop: '1px solid rgba(216,181,106,0.12)',
          borderBottom: '1px solid rgba(216,181,106,0.08)',
          marginTop: -36,
          paddingTop: 94,
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          transition: 'margin-top 0.55s cubic-bezier(0.16,1,0.3,1)',
          background: '#060606',
        }}
      >
        {visible2 && (
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
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            backgroundColor: C.gold,
            mixBlendMode: 'screen',
            animation: 'immerseGoldBreatheSolid 14s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: isMobile ? 'calc(100% - 24px)' : 'min(1220px, calc(100% - 36px))',
            margin: '0 auto',
          }}
        >
          <div style={{ ...immerseFadeUp(visible2, 0) }}>
            <div
              ref={carouselRef}
              style={{ position: 'relative', userSelect: 'none', minWidth: 0 }}
              onMouseDown={e => setDragStart(e.clientX)}
              onMouseUp={e => {
                if (dragStart !== null) {
                  const d = dragStart - e.clientX
                  if (d > 40)  onCarouselChange(activeCarouselIdx + 1)
                  if (d < -40) onCarouselChange(activeCarouselIdx - 1)
                  setDragStart(null)
                }
              }}
              onMouseLeave={() => setDragStart(null)}
            >
              {carouselItems[activeCarouselIdx] && renderCarouselItem(
                carouselItems[activeCarouselIdx],
                `${activeIdx}-${activeCarouselIdx}`,
                true,
              )}
              {!isMobile && gutterArrowsAroundHero && activeCarouselIdx > 0 && (
                <button
                  onClick={() => onCarouselChange(activeCarouselIdx - 1)}
                  style={desktopGutterArrowStyle('left')}
                >‹</button>
              )}
              {!isMobile && gutterArrowsAroundHero && activeCarouselIdx < total - 1 && (
                <button
                  onClick={() => onCarouselChange(activeCarouselIdx + 1)}
                  style={desktopGutterArrowStyle('right')}
                >›</button>
              )}
            </div>

            {!isMobile && !gutterArrowsAroundHero && total > 1 && (
              <div
                style={{
                  marginTop: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 64,
                }}
              >
                <button
                  onClick={() => activeCarouselIdx > 0 && onCarouselChange(activeCarouselIdx - 1)}
                  disabled={activeCarouselIdx === 0}
                  style={desktopFlowArrowStyle(activeCarouselIdx === 0)}
                  aria-label='Previous room'
                >‹</button>
                <button
                  onClick={() => activeCarouselIdx < total - 1 && onCarouselChange(activeCarouselIdx + 1)}
                  disabled={activeCarouselIdx === total - 1}
                  style={desktopFlowArrowStyle(activeCarouselIdx === total - 1)}
                  aria-label='Next room'
                >›</button>
              </div>
            )}

            {!isMobile && total > 1 && (
              <NavRow
                isMobile={false}
                total={total}
                activeIdx={activeCarouselIdx}
                prevIdx={prevCarouselIdx}
                onChange={onCarouselChange}
              />
            )}

            {activeRoomImageSrc && displayRoomGallery.length >= 1 && (
              <div style={{ marginTop: 40 }} key={`room-gallery-${activeIdx}-${activeCarouselIdx}`}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 12 }}>
                  Gallery · {roomLightboxImages.length} photos
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 10,
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  {displayRoomGallery.map((src: string, i: number) => (
                    <div
                      key={i}
                      onClick={() => setRoomLightboxIdx(i + 1)}
                      style={{
                        width: '100%',
                        height: isMobile ? 118 : 160,
                        borderRadius: ID.radiusMd,
                        overflow: 'hidden',
                        border: `1px solid ${ID.line}`,
                        cursor: 'pointer',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 200}ms both`,
                        position: 'relative',
                        transition: 'border-color 0.3s ease, transform 0.3s ease',
                      }}
                    >
                      <img
                        src={src}
                        alt={`${activeRoomBasis ?? ''} ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {lightboxIdx !== null && lightboxImages.length > 0 && (
        <LightboxOverlay
          images={lightboxImages}
          index={lightboxIdx}
          hotelName={lightboxLabel}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(lightboxIdx > 0 ? lightboxIdx - 1 : lightboxIdx)}
          onNext={() => setLightboxIdx(lightboxIdx < lightboxImages.length - 1 ? lightboxIdx + 1 : lightboxIdx)}
        />
      )}

      {roomLightboxIdx !== null && roomLightboxImages.length > 0 && (
        <LightboxOverlay
          images={roomLightboxImages}
          index={roomLightboxIdx}
          hotelName={roomLightboxLabel}
          onClose={() => setRoomLightboxIdx(null)}
          onPrev={() => setRoomLightboxIdx(roomLightboxIdx > 0 ? roomLightboxIdx - 1 : roomLightboxIdx)}
          onNext={() => setRoomLightboxIdx(roomLightboxIdx < roomLightboxImages.length - 1 ? roomLightboxIdx + 1 : roomLightboxIdx)}
        />
      )}
    </>
  )
}

// ─── Hotel button ─────────────────────────────────────────────────────────────

function HotelButton({ hotel, active, isMobile, onClick }: { hotel: ImmerseHotelOption; active: boolean; isMobile: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: '100%',
        minWidth: 0,
        padding: isMobile ? '14px 16px' : '16px 20px',
        borderRadius: ID.radiusMd,
        border: `1px solid ${active ? ID.gold : hovered ? 'rgba(216,181,106,0.30)' : ID.line}`,
        background: active ? 'rgba(216,181,106,0.08)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.25s ease, background 0.25s ease, transform 0.15s ease, box-shadow 0.25s ease',
        boxSizing: 'border-box',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        boxShadow: active ? '0 0 0 1px rgba(216,181,106,0.18), 0 4px 20px rgba(216,181,106,0.08)' : 'none',
        animation: active ? 'immerseGoldBorderPulse 3s ease-in-out infinite' : undefined,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: active ? ID.gold : ID.dim, fontWeight: 700, marginBottom: 6 }}>
        {hotel.rankLabel}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: active ? ID.text : ID.muted, lineHeight: 1.1 }}>
        {hotel.name}
      </div>
      <div style={{ fontSize: 11, color: active ? ID.dim : ID.lineSoft, marginTop: 4, letterSpacing: '0.08em' }}>
        {hotel.stayLabel}
      </div>
    </button>
  )
}

// ─── Hotel detail panel ───────────────────────────────────────────────────────

function HotelDetailPanel({ hotel, onLightbox, arrowsAndDots, hotelDesktopArrows }: {
  hotel: ImmerseHotelOption
  activeRoom: number
  isMobile: boolean
  onRoomChange: (i: number) => void
  onLightbox: (i: number) => void
  arrowsAndDots?: React.ReactNode
  hotelDesktopArrows?: { onPrev?: () => void; onNext?: () => void }
}) {
  const isMobile = useImmerseMobile()
  const gallery        = hotel.gallery ?? []
  const displayGallery = gallery.filter((src: string) => src !== hotel.imageSrc)
  const lightboxImages = [hotel.imageSrc, ...gallery.filter((src: string) => src !== hotel.imageSrc)]

  return (
    <div style={{ display: 'grid', gap: 24, width: '100%', minWidth: 0 }}>
      <div
        onClick={() => onLightbox(0)}
        style={{
          position: 'relative',
          borderRadius: ID.radiusXl,
          overflow: 'hidden',
          height: isMobile ? 220 : 420,
          width: '100%',
          minWidth: 0,
          cursor: 'pointer',
        }}
      >
        <img
          src={hotel.imageSrc}
          alt={hotel.imageAlt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transformOrigin: 'center center',
            animation: 'immerseKenBurns 14s ease-in-out infinite alternate',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', background: 'radial-gradient(ellipse at center, transparent 38%, rgba(3,3,3,0.52) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '24px 16px 16px' : '64px 36px 28px', background: 'linear-gradient(0deg, rgba(3,3,3,0.72) 0%, rgba(3,3,3,0) 100%)' }}>
          <div style={{ fontSize: isMobile ? 28 : 'clamp(44px,5vw,72px)', lineHeight: isMobile ? 1.02 : 0.95, letterSpacing: '-0.03em', fontWeight: 400, fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif', color: ID.text }}>
            {hotel.name}
          </div>
        </div>
      </div>

      {isMobile && arrowsAndDots}

      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingLeft:  !isMobile && hotelDesktopArrows ? 80 : 0,
          paddingRight: !isMobile && hotelDesktopArrows ? 80 : 0,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
          {hotel.bullets.map((b, i) => (
            <div
              key={b}
              style={{
                padding: isMobile ? '7px 12px' : '8px 14px',
                borderRadius: 999,
                border: `1px solid ${ID.line}`,
                background: ID.panel2,
                color: ID.muted,
                fontSize: isMobile ? 11 : 12,
                letterSpacing: '0.04em',
                animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60 + 200}ms both`,
              }}
            >
              {b}
            </div>
          ))}
        </div>

        {!isMobile && hotelDesktopArrows?.onPrev && (
          <button
            onClick={hotelDesktopArrows.onPrev}
            style={{ ...desktopGutterArrowStyle('left'), left: 0 }}
            aria-label='Previous hotel'
          >‹</button>
        )}
        {!isMobile && hotelDesktopArrows?.onNext && (
          <button
            onClick={hotelDesktopArrows.onNext}
            style={{ ...desktopGutterArrowStyle('right'), right: 0 }}
            aria-label='Next hotel'
          >›</button>
        )}
      </div>

      {gallery.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 10 }}>
            Gallery · {lightboxImages.length} photos
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 10,
              width: '100%',
            }}
          >
            {displayGallery.map((src, i) => (
              <div
                key={i}
                onClick={() => onLightbox(i + 1)}
                style={{
                  width: '100%',
                  height: isMobile ? 118 : 160,
                  borderRadius: ID.radiusMd,
                  overflow: 'hidden',
                  border: `1px solid ${ID.line}`,
                  cursor: 'pointer',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 400}ms both`,
                  position: 'relative',
                  transition: 'border-color 0.3s ease, transform 0.3s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(216,181,106,0.45)'
                  e.currentTarget.style.transform = 'scale(1.01)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = ID.line
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <img src={src} alt={`${hotel.name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', background: 'radial-gradient(ellipse at center, transparent 35%, rgba(3,3,3,0.44) 100%)' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lightbox overlay ─────────────────────────────────────────────────────────

function LightboxOverlay({ images, index, hotelName, onClose, onPrev, onNext }: {
  images: string[]
  index: number
  hotelName: string
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(3,3,3,0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'immerseFadeIn 0.25s ease both',
      }}
    >
      <button onClick={onClose} style={{ position: 'fixed', top: 24, right: 28, background: 'none', border: 'none', color: 'rgba(245,242,236,0.5)', fontSize: 28, cursor: 'pointer', zIndex: 1000 }}>×</button>
      <div style={{ position: 'fixed', top: 28, left: '50%', transform: 'translateX(-50%)', color: ID.dim, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, zIndex: 1000 }}>
        {hotelName} · {index + 1} / {images.length}
      </div>
      {index > 0 && <button onClick={e => { e.stopPropagation(); onPrev() }} style={{ position: 'fixed', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(245,242,236,0.36)', fontSize: 42, cursor: 'pointer', zIndex: 1000 }}>‹</button>}
      {index < images.length - 1 && <button onClick={e => { e.stopPropagation(); onNext() }} style={{ position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(245,242,236,0.36)', fontSize: 42, cursor: 'pointer', zIndex: 1000 }}>›</button>}
      <img
        key={index}
        src={images[index]}
        alt={`${hotelName} image ${index + 1}`}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 'calc(100vw - 120px)',
          maxHeight: 'calc(100vh - 120px)',
          objectFit: 'contain',
          borderRadius: ID.radiusLg,
          boxShadow: '0 32px 80px rgba(0,0,0,0.64)',
          animation: 'immerseFadeIn 0.3s ease both',
          display: 'block',
        }}
      />
    </div>,
    document.body
  )
}