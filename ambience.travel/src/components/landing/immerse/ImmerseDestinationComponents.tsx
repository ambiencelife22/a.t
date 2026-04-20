// ImmerseDestinationComponents.tsx — section components for /immerse/ destination subpages
// Owns: ImmerseDestIntro, ImmerseHotelOptions, ImmerseContentGrid, ImmerseDestPricing
// Last updated: S23 addendum — bullets_heading render added in ContentCard.
//   Renders a small gold-uppercase header above the bullets list when
//   item.bulletsHeading is populated. Canonical default: "Highlights".
//   Per-card override via travel_immerse_trip_content_card_overrides.
// Last updated: S23 — Added PRICING_CLOSER_DEFAULT constant and closer render row
//   in ImmerseDestPricing. The closer row sits beneath the data.pricingRows map
//   and renders a single is_total-styled row with PRICING_CLOSER_DEFAULT values
//   merged with per-trip overrides from data.pricingCloser. Default closer
//   reads "Pricing Based On Selection" in the indicative_range column with the
//   other three columns blank. Per-trip override fields (4 nullable columns
//   on travel_immerse_trip_destination_rows: pricing_closer_{item,basis,stay,
//   indicative_range}_override) replace the default once a price is quoted.
//   Resolution order: trip override (data.pricingCloser.X) → constant default
//   (PRICING_CLOSER_DEFAULT.X). Closer is structurally separate from
//   data.pricingRows and never lives in travel_immerse_destination_pricing_rows.

import { useState, useRef, useEffect } from 'react'
import { ID, useImmerseMobile, useImmerseVisible, immerseFadeUp, ImmerseSectionWrap, ImmerseEyebrow, ImmerseTitle, ImmerseBody, ImmersePanel } from './ImmerseComponents'
import { C } from '../../../lib/landingTypes'
import { PricingTable, Td, TotalTd, NotesList } from './ImmerseTripComponents'
import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseRegionGroup, ImmerseRoomOption, ImmerseContentCard } from '../../../lib/immerseTypes'

// S22: Single literal fallback when DB returns no value for pricing notes.
// No hardcoded content maps anywhere — DB is the source of truth, this is
// purely a "we don't have data yet" placeholder.
const TBA = 'To be advised'

// S23: Canonical default pricing closer row. Renders as a single is_total row
// at the bottom of every destination's pricing table. Per-trip overrides (4
// nullable columns on travel_immerse_trip_destination_rows) replace these
// values once a price has been quoted for the trip. Closer is structurally
// separate from data.pricingRows and never lives in
// travel_immerse_destination_pricing_rows.
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

// ─── Hotel options (switches on hotels.kind) ─────────────────────────────────

export function ImmerseHotelOptions({ data }: { data: ImmerseDestinationData }) {
  if (data.hotels.kind === 'flat') {
    return <FlatHotelOptions data={data} hotels={data.hotels.hotels} />
  }
  return <RegionedHotelOptions data={data} regions={data.hotels.regions} />
}

// ─── Flat (NYC, St-Barths) ────────────────────────────────────────────────────
// Selector cards = hotels. Carousel = active hotel's rooms.

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
        <RoomCategory key={key} room={room} hotel={hotel} fadeIn={fadeIn} onHeroClick={() => setRoomLightboxIdx(0)} />
      )}
      activeRoomGallery={hotel.rooms[activeRoom]?.roomGallery}
      activeRoomImageSrc={hotel.rooms[activeRoom]?.roomImageSrc}
      activeRoomBasis={hotel.rooms[activeRoom]?.roomBasis}
      roomLightboxIdx={roomLightboxIdx}
      setRoomLightboxIdx={setRoomLightboxIdx}
      lightboxLabel={hotel.name}
      roomLightboxLabel={hotel.rooms[activeRoom] ? `${hotel.name} · ${hotel.rooms[activeRoom].roomBasis}` : hotel.name}
    />
  )
}

// ─── Regioned (Nordic Winter, Europe Finale) ─────────────────────────────────
// Selector cards = regions. Carousel = active region's hotels.
// Each region is mapped onto a synthetic ImmerseHotelOption for the selector +
// detail panel; each hotel-in-region is mapped onto a synthetic ImmerseRoomOption
// for the carousel so the existing RoomCategory renders it.

function RegionedHotelOptions({ data, regions }: { data: ImmerseDestinationData; regions: ImmerseRegionGroup[] }) {
  const [activeRegion, setActiveRegion] = useState(0)
  const [activeHotel, setActiveHotel]   = useState(0)
  const [prevHotel, setPrevHotel]       = useState<number | null>(null)
  const [lightboxIdx, setLightboxIdx]   = useState<number | null>(null)
  const [hotelLightboxIdx, setHotelLightboxIdx] = useState<number | null>(null)

  function goRegion(idx: number) {
    setActiveRegion(idx)
    setActiveHotel(0)
  }

  if (regions.length === 0) return null
  const region = regions[activeRegion]
  if (!region) return null

  // Map regions → ImmerseHotelOption shape for the selector + detail panel
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
    gallery:      [],
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

  // Map each hotel-in-region → ImmerseRoomOption so RoomCategory renders it
  const hotelsAsRooms: ImmerseRoomOption[] = region.hotels.map(h => ({
    levelLabel:   h.rankLabel,
    roomBasis:    h.name,
    roomBenefits: h.bullets,
    roomImageSrc: h.imageSrc,
    roomImageAlt: h.imageAlt,
    roomGallery:  h.gallery,
  }))

  const activeHotelInRegion = region.hotels[activeHotel]

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
      carouselItems={hotelsAsRooms}
      activeCarouselIdx={activeHotel}
      prevCarouselIdx={prevHotel}
      onCarouselChange={goHotel}
      renderCarouselItem={(item, key, fadeIn) => (
        <RoomCategory key={key} room={item} hotel={detailRegion} fadeIn={fadeIn} onHeroClick={() => setHotelLightboxIdx(0)} />
      )}
      activeRoomGallery={activeHotelInRegion?.gallery}
      activeRoomImageSrc={activeHotelInRegion?.imageSrc}
      activeRoomBasis={activeHotelInRegion?.name}
      roomLightboxIdx={hotelLightboxIdx}
      setRoomLightboxIdx={setHotelLightboxIdx}
      lightboxLabel={region.title}
      roomLightboxLabel={activeHotelInRegion ? `${region.title} · ${activeHotelInRegion.name}` : region.title}
    />
  )
}

// ─── Shared selector + carousel scaffolding ──────────────────────────────────
// One layout for both flat and regioned. Generic over the carousel item type.

type SelectorAndCarouselProps<T> = {
  data:                  ImmerseDestinationData
  cards:                 ImmerseHotelOption[]
  activeIdx:             number
  onCardClick:           (i: number) => void
  detailHotel:           ImmerseHotelOption
  onLightbox:            (i: number) => void
  lightboxIdx:           number | null
  setLightboxIdx:        (i: number | null) => void
  carouselItems:         T[]
  activeCarouselIdx:     number
  prevCarouselIdx:       number | null
  onCarouselChange:      (i: number) => void
  renderCarouselItem:    (item: T, key: string, fadeIn: boolean) => React.ReactNode
  activeRoomGallery?:    string[]
  activeRoomImageSrc?:   string
  activeRoomBasis?:      string
  roomLightboxIdx:       number | null
  setRoomLightboxIdx:    (i: number | null) => void
  lightboxLabel:         string
  roomLightboxLabel:     string
}

function SelectorAndCarousel<T>({
  data,
  cards,
  activeIdx,
  onCardClick,
  detailHotel,
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
            animation: 'immerseFadeIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
          }}
          key={activeIdx}
        >
          <HotelDetailPanel
            hotel={detailHotel}
            activeRoom={activeCarouselIdx}
            isMobile={isMobile}
            onRoomChange={onCarouselChange}
            onLightbox={setLightboxIdx}
          />
        </div>
      </ImmerseSectionWrap>

      <style>{`
        @keyframes immerseGoldBreatheSolid {
          0%   { opacity: 0.11; filter: brightness(0.84) saturate(1); }
          12%  { opacity: 0.11; filter: brightness(0.84) saturate(1); }

          30%  { opacity: 0.22; filter: brightness(0.94) saturate(1.04); }
          44%  { opacity: 0.44; filter: brightness(1.00) saturate(1.08); }

          68%  { opacity: 0.44; filter: brightness(1.00) saturate(1.08); }

          84%  { opacity: 0.22; filter: brightness(0.92) saturate(1.03); }
          100% { opacity: 0.11; filter: brightness(0.84) saturate(1); }
        }
        @keyframes immerseFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes immerseKenBurns {
          0%   { transform: scale(1) translate(0%, 0%); }
          100% { transform: scale(1.035) translate(-0.8%, -0.5%); }
        }
        @keyframes immerseDotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(216,181,106,0); }
          50%      { box-shadow: 0 0 0 4px rgba(216,181,106,0.18); }
        }
        @keyframes immerseGoldBorderPulse {
          0%, 100% { border-color: rgba(216,181,106,0.30); }
          50%      { border-color: rgba(216,181,106,0.70); }
        }
        @keyframes immerseGoldScan {
          0%   { width: 0%; opacity: 1; }
          72%  { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        @keyframes immerseBorderFadeIn {
          from { border-top-color: transparent; }
          to   { border-top-color: rgba(216,181,106,0.12); }
        }
        @keyframes immerseBorderFadeInAlt {
          from { border-top-color: transparent; }
          to   { border-top-color: rgba(216,181,106,0.08); }
        }
        @keyframes immerseEyebrowSettle {
          from { letter-spacing: 0.06em; opacity: 0.4; }
          to   { letter-spacing: 0.22em; opacity: 1; }
        }
        @keyframes immerseRuleShimmer {
          0%   { background-position: -200% center; opacity: 0.4; }
          60%  { background-position: 200% center; opacity: 1; }
          100% { background-position: 200% center; opacity: 1; }
        }
        @keyframes immerseDotDim {
          0%   { opacity: 1; }
          30%  { opacity: 0.12; }
          100% { opacity: 0.38; }
        }
      `}</style>

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
              {activeCarouselIdx > 0 && (
                <button
                  onClick={() => onCarouselChange(activeCarouselIdx - 1)}
                  style={{
                    position: 'absolute',
                    left: isMobile ? 6 : -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: isMobile ? 'rgba(10,10,10,0.55)' : 'none',
                    border: 'none',
                    borderRadius: isMobile ? 999 : 0,
                    color: ID.muted,
                    fontSize: 22,
                    cursor: 'pointer',
                    opacity: 0.72,
                    padding: isMobile ? '10px 12px' : '8px 6px',
                    lineHeight: 1,
                    transition: 'opacity 0.2s ease',
                    zIndex: 2,
                  }}
                >‹</button>
              )}
              {activeCarouselIdx < total - 1 && (
                <button
                  onClick={() => onCarouselChange(activeCarouselIdx + 1)}
                  style={{
                    position: 'absolute',
                    right: isMobile ? 6 : -20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: isMobile ? 'rgba(10,10,10,0.55)' : 'none',
                    border: 'none',
                    borderRadius: isMobile ? 999 : 0,
                    color: ID.muted,
                    fontSize: 22,
                    cursor: 'pointer',
                    opacity: 0.72,
                    padding: isMobile ? '10px 12px' : '8px 6px',
                    lineHeight: 1,
                    transition: 'opacity 0.2s ease',
                    zIndex: 2,
                  }}
                >›</button>
              )}
            </div>

            {total > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                {carouselItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onCarouselChange(i)}
                    style={{
                      width: i === activeCarouselIdx ? 22 : 7,
                      height: 7,
                      borderRadius: 999,
                      background: i === activeCarouselIdx ? ID.gold : ID.lineSoft,
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'width 0.3s ease, background 0.3s ease',
                      animation: i === activeCarouselIdx
                        ? 'immerseDotPulse 2.4s ease-in-out infinite'
                        : i === prevCarouselIdx
                          ? 'immerseDotDim 0.45s ease-out both'
                          : undefined,
                    }}
                  />
                ))}
              </div>
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

function HotelDetailPanel({ hotel, onLightbox }: {
  hotel: ImmerseHotelOption
  activeRoom: number
  isMobile: boolean
  onRoomChange: (i: number) => void
  onLightbox: (i: number) => void
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

  return (
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
    </div>
  )
}

// ─── Room category ────────────────────────────────────────────────────────────

function RoomCategory({ room, fadeIn = false, onHeroClick }: { room: ImmerseRoomOption; hotel: ImmerseHotelOption; fadeIn?: boolean; onHeroClick?: () => void }) {
  const isMobile              = useImmerseMobile()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const isActive = !isMobile && hovered
  const scale    = pressed ? 0.99 : 1

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
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 18,
        alignItems: 'stretch',
        animation: fadeIn ? 'immerseFadeIn 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined,
        minWidth: 0,
        transform: `scale(${scale})`,
        transition: 'transform 0.18s ease',
      }}
    >
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
                {!room.taxInclusive && (
                  <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    + tax
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
                {!room.taxInclusive && (
                  <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    + tax
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
    </div>
  )
}

// ─── Content card grid (dining + activities) ──────────────────────────────────

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

  // S23: resolve closer values — trip override (data.pricingCloser.X) →
  // PRICING_CLOSER_DEFAULT.X. Closer is a single is_total row appended at the
  // bottom of the data.pricingRows map. Never lives in
  // travel_immerse_destination_pricing_rows.
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
              {/* S23: canonical closer row — frontend default, per-trip overlay */}
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

// ─── Pricing row ──────────────────────────────────────────────────────────────

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