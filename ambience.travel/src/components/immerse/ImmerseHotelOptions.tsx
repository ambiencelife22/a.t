// ImmerseHotelOptions.tsx — hotel selector + per-hotel detail + room/hotel carousel
// Owns: ImmerseHotelOptions (export), FlatHotelOptions, RegionedHotelOptions,
//   HotelWithRooms, SelectorAndCarousel scaffolding, HotelButton, HotelDetailPanel,
//   LightboxOverlay, buildRoomSlides, ConnectedPairSlide
//
// Last updated: S53C — Michelin Keys. HotelDetailPanel renders the hotel's
//   michelinKeys (1–3) under the hotel name via the shared RecognitionMark
//   (kind="keys"), matching the dining-guide accolade idiom. The value comes
//   from the canon hotel (travel_accom_hotels.michelin_keys) via the hotels
//   query, so it shows on every proposal featuring that hotel.
// Prior: S53C — connecting-room pairs. Rooms are grouped into "slides":
//   a slide is either a single room or a connected pair (two rooms sharing a
//   travel_accom_room_connections link, surfaced as room.connectedRoomId). A
//   pair renders as ONE carousel slide: both RoomCategory panels stacked under a
//   shared "Connecting Suites" header, with a combined total when both rooms
//   share a rate cadence (sum is only valid within one cadence). Mission: the
//   pair IS one offering, so it is presented as one decision, not two slides.
// Prior: S42 Add 3 — Resort Map download link renders centered above the
//   room carousel, sourced from detailHotel.resortMapSrc.

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ID, useImmerseMobile, ImmerseSectionWrap, ImmerseEyebrow, ImmersePanel } from './ImmerseComponents'
import { useVisible as useImmerseVisible, fadeUp as immerseFadeUp } from '../../utils/utilsAnimations'
import { C } from '../../types/typesLanding'
import { NavRow, desktopGutterArrowStyle, desktopFlowArrowStyle } from './ImmerseCarouselNav'
import { RoomCategory } from './ImmerseRoomCategory'
import { RecognitionMark } from '../guides/RecognitionKey'
import type { ImmerseDestinationData, ImmerseHotelOption, ImmerseRegionGroup, ImmerseRoomOption } from '../../types/typesImmerse'

// ─── Room slide model (S53C) ──────────────────────────────────────────────────
// A carousel slide is either a single room or a connected pair. Pairs are built
// from room.connectedRoomId (catalog id of the partner). The first room of a
// matched pair becomes the pair slide; the partner is absorbed (not a separate
// slide). Order is otherwise preserved.

type RoomSlide =
  | { kind: 'single'; room: ImmerseRoomOption }
  | { kind: 'pair';   rooms: [ImmerseRoomOption, ImmerseRoomOption]; note?: string }

function buildRoomSlides(rooms: ImmerseRoomOption[]): RoomSlide[] {
  // Identity is the overlay row (overlayId). The connection is a PER-OFFER fact:
  // connectedOverlayId points at the partner OFFER (overlay row), not the canon
  // room. So the same canon room can be offered standalone (connectedOverlayId
  // null) AND in a pair (two overlay rows pointing at each other).
  const keyOf = (r: ImmerseRoomOption): string => r.overlayId ?? r.roomId ?? ''

  const consumed = new Set<string>()
  const slides: RoomSlide[] = []

  for (const room of rooms) {
    const myKey = keyOf(room)
    if (myKey && consumed.has(myKey)) continue

    // Pair only when THIS offer points at a partner offer, the partner exists,
    // is unconsumed, and points back at us (mutual). Standalone offers have a
    // null connectedOverlayId and never pair.
    const partner = room.connectedOverlayId
      ? rooms.find(r =>
          keyOf(r) !== myKey
          && !consumed.has(keyOf(r))
          && r.overlayId === room.connectedOverlayId
          && r.connectedOverlayId === room.overlayId)
      : undefined

    if (partner) {
      consumed.add(myKey)
      consumed.add(keyOf(partner))
      slides.push({
        kind:  'pair',
        rooms: [room, partner],
        note:  room.connectingNote ?? partner.connectingNote,
      })
      continue
    }

    if (myKey) consumed.add(myKey)
    slides.push({ kind: 'single', room })
  }

  return slides
}

// S53C — numeric rate detection (mirrors RoomCategory) for combined total.
function rateIsNumeric(rate: string | undefined): boolean {
  if (!rate) return false
  return /^([$€£¥]|EURO|USD|GBP|JPY|CHF|AED|SAR)?\s*[$€£¥]?\s*\d/i.test(rate.trim())
}

// S53C — the displayed rate of a room (ambience preferred, else public).
function displayedRate(room: ImmerseRoomOption): string | undefined {
  return room.ambienceNightlyRate ?? room.publicNightlyRate ?? undefined
}

// S53C — combined total for a pair. Only valid when both rooms share a cadence
// and both rates are numeric in the same currency. Returns null when a safe
// sum cannot be formed (renderer then omits the total).
function combinedPairTotal(a: ImmerseRoomOption, b: ImmerseRoomOption): string | null {
  const ra = displayedRate(a)
  const rb = displayedRate(b)
  if (!ra || !rb) return null
  if (!rateIsNumeric(ra) || !rateIsNumeric(rb)) return null
  if ((a.rateCadence ?? null) !== (b.rateCadence ?? null)) return null

  // Parse "<prefix> <number>" — keep the prefix from the first room, sum digits.
  const prefixMatch = ra.match(/^([^\d]*)/)
  const prefix      = prefixMatch ? prefixMatch[1].trim() : ''
  const numA = Number(ra.replace(/[^\d.]/g, ''))
  const numB = Number(rb.replace(/[^\d.]/g, ''))
  if (!isFinite(numA) || !isFinite(numB) || numA <= 0 || numB <= 0) return null

  const total = numA + numB
  const formatted = total.toLocaleString('en-US')
  return prefix ? `${prefix} ${formatted}` : formatted
}

// S53C — gallery for a slide. For a pair, merge both suites' galleries
// (suite A then suite B), deduped; hero = suite A's image; label names the pair.
function slideGallery(slide: RoomSlide | undefined): {
  images: string[]
  heroSrc: string | undefined
  label: string
} {
  if (!slide) return { images: [], heroSrc: undefined, label: '' }

  if (slide.kind === 'single') {
    const r = slide.room
    return {
      images:  r.roomGallery ?? [],
      heroSrc: r.roomImageSrc,
      label:   r.levelLabel,
    }
  }

  const [a, b] = slide.rooms
  const merged = [
    a.roomImageSrc,
    ...(a.roomGallery ?? []),
    b.roomImageSrc,
    ...(b.roomGallery ?? []),
  ].filter((s): s is string => Boolean(s))
  const deduped = Array.from(new Set(merged))
  return {
    images:  deduped,
    heroSrc: a.roomImageSrc,
    label:   'Connecting Suites',
  }
}

// ─── Hotel options ────────────────────────────────────────────────────────────

export function ImmerseHotelOptions({ data }: { data: ImmerseDestinationData }) {
  if (data.hotels.kind === 'flat') {
    return <FlatHotelOptions data={data} hotels={data.hotels.hotels} />
  }
  return <RegionedHotelOptions data={data} regions={data.hotels.regions} />
}

// ─── Connected pair slide (S53C) ──────────────────────────────────────────────
// Renders a connecting pair as ONE card matching RoomCategory's styling: a single
// content panel (connecting header + combined total + each suite's name/size/
// rate/benefits) beside a single hero image. Both suites' info lives together in
// one card — not two stacked cards.

function PairSuiteBlock({ room, isMobile }: { room: ImmerseRoomOption; isMobile: boolean }) {
  const rate        = room.ambienceNightlyRate ?? room.publicNightlyRate ?? undefined
  const isAmbience  = Boolean(room.ambienceNightlyRate)
  const rateTax     = room.taxTreatment ?? room.rateSuffix
  const showTax     = !room.taxInclusive && Boolean(rateTax)

  const sqft = room.sqftMin ? (room.sqftMax && room.sqftMax !== room.sqftMin ? `${room.sqftMin.toLocaleString()}–${room.sqftMax.toLocaleString()} sq ft` : `${room.sqftMin.toLocaleString()} sq ft`) : ''
  const sqm  = room.sqmMin  ? (room.sqmMax  && room.sqmMax  !== room.sqmMin  ? `${room.sqmMin.toLocaleString()}–${room.sqmMax.toLocaleString()} sqm`     : `${room.sqmMin.toLocaleString()} sqm`)     : ''
  const sqLabel = [sqft, sqm].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: isMobile ? 24 : 30, lineHeight: 1.0, letterSpacing: '-0.02em', fontWeight: 400, fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif', color: ID.text, marginBottom: 12 }}>
          {room.levelLabel}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {sqLabel && (
            <div style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.dim, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {sqLabel}
            </div>
          )}
          {rate && (
            <div style={{
              padding: '8px 14px', borderRadius: 999,
              border: isAmbience ? `1px solid rgba(216,181,106,0.45)` : `1px solid ${ID.line}`,
              background: isAmbience ? 'rgba(216,181,106,0.10)' : ID.panel2,
              color: isAmbience ? ID.gold : ID.muted,
              fontSize: isAmbience ? 13 : 11, letterSpacing: '0.06em', fontWeight: isAmbience ? 800 : 500,
              display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {isAmbience && <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Ambience</span>}
                <span>{rate}</span>
                {room.rateCadence && <span style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{room.rateCadence}</span>}
              </div>
              {showTax && <div style={{ fontSize: 9, color: ID.dim, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{rateTax}</div>}
            </div>
          )}
        </div>
      </div>

      {room.roomBenefits.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 10 }}>
          {room.roomBenefits.map(b => (
            <div key={b} style={{ padding: '12px 14px', border: `1px solid ${ID.line}`, borderRadius: ID.radiusMd, background: ID.panel2, color: ID.muted, fontSize: 13, lineHeight: 1.55 }}>
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConnectedPairSlide({ rooms, note, fadeIn, onHeroClick }: {
  rooms:       [ImmerseRoomOption, ImmerseRoomOption]
  note?:       string
  hotel:       ImmerseHotelOption
  fadeIn:      boolean
  onHeroClick: (roomIndexInPair: number) => void
}) {
  const isMobile = useImmerseMobile()
  const [a, b]   = rooms
  const total    = combinedPairTotal(a, b)
  const cadence  = a.rateCadence ?? b.rateCadence ?? undefined

  const contentPanel = (
    <ImmersePanel
      style={{
        padding: isMobile ? 22 : 32,
        display: 'flex', flexDirection: 'column', gap: 20,
        background: ID.panel, minWidth: 0,
        border: `1px solid ${ID.line}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(216,181,106,0.08)',
      }}
    >
      {/* Connecting header + combined total */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 10, paddingBottom: 16, borderBottom: `1px solid ${ID.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' style={{ flexShrink: 0 }}>
            <path d='M6 8h4M5 5.5a2.5 2.5 0 000 5h1M11 5.5a2.5 2.5 0 010 5h-1' stroke={ID.gold} strokeWidth='1.3' strokeLinecap='round' />
          </svg>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.gold, fontWeight: 700 }}>
              {a.tierLabel ? `${a.tierLabel} · Connecting Suites` : 'Connecting Suites'}
            </div>
            {note && <div style={{ fontSize: 12, color: ID.muted, marginTop: 2, lineHeight: 1.4 }}>{note}</div>}
          </div>
        </div>
        {total && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 2, padding: '8px 14px', borderRadius: 14, border: `1px solid rgba(216,181,106,0.45)`, background: 'rgba(216,181,106,0.10)', color: ID.gold }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Combined</span>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em' }}>{total}</span>
              {cadence && <span style={{ fontSize: 10, color: ID.dim, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{cadence}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Both suites' info together in this one card */}
      <PairSuiteBlock room={a} isMobile={isMobile} />
      <div style={{ height: 1, background: ID.line }} />
      <PairSuiteBlock room={b} isMobile={isMobile} />
    </ImmersePanel>
  )

  const heroPanel = (
    <div
      onClick={() => onHeroClick(0)}
      style={{
        minHeight: isMobile ? 260 : 480, overflow: 'hidden',
        border: `1px solid ${ID.line}`, borderRadius: ID.radiusXl,
        boxShadow: '0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(216,181,106,0.08)',
        minWidth: 0, position: 'relative', cursor: 'pointer',
      }}
    >
      <img src={a.roomImageSrc} alt={a.roomImageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(3,3,3,0.38) 100%)' }} />
    </div>
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: 18, alignItems: 'stretch', minWidth: 0,
      animation: fadeIn ? 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined,
    }}>
      {contentPanel}
      {heroPanel}
    </div>
  )
}

// ─── Flat ─────────────────────────────────────────────────────────────────────

function FlatHotelOptions({ data, hotels }: { data: ImmerseDestinationData; hotels: ImmerseHotelOption[] }) {
  const [activeHotel, setActiveHotel] = useState(0)
  const [activeSlide, setActiveSlide] = useState(0)
  const [prevSlide, setPrevSlide]     = useState<number | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [roomLightboxIdx, setRoomLightboxIdx] = useState<number | null>(null)

  function goHotel(idx: number) { setActiveHotel(idx); setActiveSlide(0) }

  if (hotels.length === 0) return null
  const hotel = hotels[activeHotel]
  if (!hotel) return null

  // S53C — build slides (singles + connected pairs) from this hotel's rooms.
  const slides = buildRoomSlides(hotel.rooms)

  function goSlide(idx: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, idx))
    setPrevSlide(activeSlide)
    setActiveSlide(clamped)
    setTimeout(() => setPrevSlide(null), 450)
  }

  // The active slide drives the gallery/lightbox below. For a pair, both
  // suites' photos are merged (see slideGallery).
  const activeSlideData = slides[activeSlide]
  const slideGal        = slideGallery(activeSlideData)

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
      carouselItems={slides}
      activeCarouselIdx={activeSlide}
      prevCarouselIdx={prevSlide}
      onCarouselChange={goSlide}
      renderCarouselItem={(slide, key, fadeIn) => (
        slide.kind === 'pair' ? (
          <ConnectedPairSlide
            key={key}
            rooms={slide.rooms}
            note={slide.note}
            hotel={hotel}
            fadeIn={fadeIn}
            onHeroClick={() => setRoomLightboxIdx(0)}
          />
        ) : (
          <RoomCategory
            key={key}
            room={slide.room}
            hotel={hotel}
            fadeIn={fadeIn}
            onHeroClick={() => setRoomLightboxIdx(0)}
            carouselArrowsAndDots={
              slides.length > 1 ? (
                <NavRow isMobile={true} total={slides.length} activeIdx={activeSlide} prevIdx={prevSlide} onChange={goSlide} preserveScrollPosition />
              ) : null
            }
          />
        )
      )}
      activeRoomGallery={slideGal.images}
      activeRoomImageSrc={slideGal.heroSrc}
      activeRoomBasis={slideGal.label}
      roomLightboxIdx={roomLightboxIdx}
      setRoomLightboxIdx={setRoomLightboxIdx}
      lightboxLabel={hotel.name}
      roomLightboxLabel={slideGal.label ? `${hotel.name} · ${slideGal.label}` : hotel.name}
      detailHotelArrowsAndDots={null}
    />
  )
}

// ─── Regioned ─────────────────────────────────────────────────────────────────

function RegionedHotelOptions({ data, regions }: { data: ImmerseDestinationData; regions: ImmerseRegionGroup[] }) {
  const [activeRegion, setActiveRegion] = useState(0)
  const [activeHotel, setActiveHotel]   = useState(0)
  const [prevHotel, setPrevHotel]       = useState<number | null>(null)
  const [lightboxIdx, setLightboxIdx]   = useState<number | null>(null)

  function goRegion(idx: number) { setActiveRegion(idx); setActiveHotel(0) }

  if (regions.length === 0) return null
  const region = regions[activeRegion]
  if (!region) return null

  const regionCards: ImmerseHotelOption[] = regions.map(r => ({
    id: r.regionId, storageSlug: r.slug, rank: r.rank, rankLabel: r.rankLabel,
    name: r.title, bullets: r.bullets, imageSrc: r.heroImageSrc ?? '',
    imageAlt: r.heroImageAlt ?? r.title, stayLabel: r.stayLabel,
    rooms: [], gallery: r.regionGallery ?? [],
  }))

  const detailRegion = regionCards[activeRegion]
  if (!detailRegion) return null

  function goHotel(idx: number) {
    const clamped = Math.max(0, Math.min(region.hotels.length - 1, idx))
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
              <NavRow isMobile={true} total={region.hotels.length} activeIdx={activeHotel} prevIdx={prevHotel} onChange={goHotel} />
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
  hotel:               ImmerseHotelOption
  fadeIn:              boolean
  regionTitle:         string
  hotelArrowsAndDots:  React.ReactNode
  hotelDesktopArrows?: { onPrev?: () => void; onNext?: () => void }
}) {
  const isMobile    = useImmerseMobile()
  const [activeSlide, setActiveSlide] = useState(0)
  const [prevSlide, setPrevSlide]     = useState<number | null>(null)
  const [hotelLightboxIdx, setHotelLightboxIdx] = useState<number | null>(null)
  const [roomLightboxIdx, setRoomLightboxIdx]   = useState<number | null>(null)
  const [dragStart, setDragStart]   = useState<number | null>(null)
  const carouselRef                 = useRef<HTMLDivElement>(null)

  // S53C — slides (singles + pairs) for this region hotel's rooms.
  const slides             = buildRoomSlides(hotel.rooms)
  const total              = slides.length
  const gallery            = hotel.gallery ?? []
  const lightboxImages     = [hotel.imageSrc, ...gallery.filter(s => s !== hotel.imageSrc)]
  const activeSlideData    = slides[activeSlide]
  const slideGal           = slideGallery(activeSlideData)
  const galleryHeroSrc     = slideGal.heroSrc
  const galleryLabel       = slideGal.label
  const displayRoomGallery = slideGal.images.filter(s => s !== galleryHeroSrc)
  const roomLightboxImages = galleryHeroSrc ? [galleryHeroSrc, ...displayRoomGallery] : slideGal.images

  function goSlide(idx: number) {
    const clamped = Math.max(0, Math.min(total - 1, idx))
    setPrevSlide(activeSlide); setActiveSlide(clamped)
    setTimeout(() => setPrevSlide(null), 450)
  }

  useEffect(() => { setActiveSlide(0); setPrevSlide(null) }, [hotel.id])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    let startX = 0
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchMove  = (e: TouchEvent) => { if (Math.abs(startX - e.touches[0].clientX) > 10) e.preventDefault() }
    const onTouchEnd   = (e: TouchEvent) => {
      const d = startX - e.changedTouches[0].clientX
      if (d > 40)  goSlide(activeSlide + 1)
      if (d < -40) goSlide(activeSlide - 1)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [activeSlide, total])

  const roomLightboxLabel = galleryLabel ? `${hotel.name} · ${galleryLabel}` : hotel.name

  return (
    <div style={{ display: 'grid', gap: 36, animation: fadeIn ? 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined, minWidth: 0, width: '100%' }}>
      <HotelDetailPanel hotel={hotel} activeRoom={activeSlide} isMobile={isMobile} onRoomChange={goSlide} onLightbox={setHotelLightboxIdx} arrowsAndDots={hotelArrowsAndDots} hotelDesktopArrows={hotelDesktopArrows} />

      {total > 0 && activeSlideData && (
        <div style={{ width: '100%', minWidth: 0 }}>
          <div ref={carouselRef} style={{ position: 'relative', userSelect: 'none', minWidth: 0 }}
            onMouseDown={e => setDragStart(e.clientX)}
            onMouseUp={e => { if (dragStart !== null) { const d = dragStart - e.clientX; if (d > 40) goSlide(activeSlide + 1); if (d < -40) goSlide(activeSlide - 1); setDragStart(null) } }}
            onMouseLeave={() => setDragStart(null)}
          >
            {activeSlideData.kind === 'pair' ? (
              <ConnectedPairSlide
                key={`${hotel.id}-${activeSlide}`}
                rooms={activeSlideData.rooms}
                note={activeSlideData.note}
                hotel={hotel}
                fadeIn
                onHeroClick={() => setRoomLightboxIdx(0)}
              />
            ) : (
              <RoomCategory key={`${hotel.id}-${activeSlide}`} room={activeSlideData.room} hotel={hotel} fadeIn onHeroClick={() => setRoomLightboxIdx(0)}
                carouselArrowsAndDots={total > 1 ? <NavRow isMobile={true} total={total} activeIdx={activeSlide} prevIdx={prevSlide} onChange={goSlide} preserveScrollPosition /> : null}
              />
            )}
          </div>
          {!isMobile && total > 1 && (
            <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
              <button onClick={() => activeSlide > 0 && goSlide(activeSlide - 1)} disabled={activeSlide === 0} style={desktopFlowArrowStyle(activeSlide === 0)} aria-label='Previous room'>‹</button>
              <button onClick={() => activeSlide < total - 1 && goSlide(activeSlide + 1)} disabled={activeSlide === total - 1} style={desktopFlowArrowStyle(activeSlide === total - 1)} aria-label='Next room'>›</button>
            </div>
          )}
          {galleryHeroSrc && displayRoomGallery.length >= 1 && (
            <div style={{ marginTop: 40 }} key={`room-gallery-${hotel.id}-${activeSlide}`}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 12 }}>Gallery · {roomLightboxImages.length} photos</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, width: '100%', minWidth: 0 }}>
                {displayRoomGallery.map((src, i) => (
                  <div key={i} onClick={() => setRoomLightboxIdx(i + 1)} style={{ width: '100%', height: isMobile ? 118 : 160, borderRadius: ID.radiusMd, overflow: 'hidden', border: `1px solid ${ID.line}`, cursor: 'pointer', minWidth: 0, boxSizing: 'border-box', animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 200}ms both`, position: 'relative', transition: 'border-color 0.3s ease, transform 0.3s ease' }}>
                    <img src={src} alt={`${galleryLabel} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hotelLightboxIdx !== null && lightboxImages.length > 0 && (
        <LightboxOverlay images={lightboxImages} index={hotelLightboxIdx} hotelName={`${regionTitle} · ${hotel.name}`} onClose={() => setHotelLightboxIdx(null)} onPrev={() => setHotelLightboxIdx(hotelLightboxIdx > 0 ? hotelLightboxIdx - 1 : hotelLightboxIdx)} onNext={() => setHotelLightboxIdx(hotelLightboxIdx < lightboxImages.length - 1 ? hotelLightboxIdx + 1 : hotelLightboxIdx)} />
      )}
      {roomLightboxIdx !== null && roomLightboxImages.length > 0 && (
        <LightboxOverlay images={roomLightboxImages} index={roomLightboxIdx} hotelName={roomLightboxLabel} onClose={() => setRoomLightboxIdx(null)} onPrev={() => setRoomLightboxIdx(roomLightboxIdx > 0 ? roomLightboxIdx - 1 : roomLightboxIdx)} onNext={() => setRoomLightboxIdx(roomLightboxIdx < roomLightboxImages.length - 1 ? roomLightboxIdx + 1 : roomLightboxIdx)} />
      )}
    </div>
  )
}

// ─── Resort map link (shared) ─────────────────────────────────────────────────

function ResortMapLink({ src }: { src: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
      <a
        href={src}
        target='_blank'
        rel='noopener noreferrer'
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.muted, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textDecoration: 'none', transition: 'border-color 0.2s ease, color 0.2s ease' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(216,181,106,0.45)'; e.currentTarget.style.color = ID.gold }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = ID.line; e.currentTarget.style.color = ID.muted }}
      >
        <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/>
          <polyline points='7 10 12 15 17 10'/>
          <line x1='12' y1='15' x2='12' y2='3'/>
        </svg>
        Resort Map
      </a>
    </div>
  )
}

// ─── Shared selector + carousel scaffolding ──────────────────────────────────

type SelectorAndCarouselProps<T> = {
  data:                     ImmerseDestinationData
  cards:                    ImmerseHotelOption[]
  activeIdx:                number
  onCardClick:              (i: number) => void
  detailHotel:              ImmerseHotelOption
  detailHotelArrowsAndDots: React.ReactNode
  onLightbox:               (i: number) => void
  lightboxIdx:              number | null
  setLightboxIdx:           (i: number | null) => void
  carouselItems:            T[]
  activeCarouselIdx:        number
  prevCarouselIdx:          number | null
  onCarouselChange:         (i: number) => void
  renderCarouselItem:       (item: T, key: string, fadeIn: boolean) => React.ReactNode
  activeRoomGallery?:       string[]
  activeRoomImageSrc?:      string
  activeRoomBasis?:         string
  roomLightboxIdx:          number | null
  setRoomLightboxIdx:       (i: number | null) => void
  lightboxLabel:            string
  roomLightboxLabel:        string
  gutterArrowsAroundHero?:  boolean
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

  const total              = carouselItems.length
  const gallery            = detailHotel.gallery ?? []
  const lightboxImages     = [detailHotel.imageSrc, ...gallery.filter(src => src !== detailHotel.imageSrc)]
  const roomGallery        = activeRoomGallery ?? []
  const displayRoomGallery = roomGallery.filter((s: string) => s !== activeRoomImageSrc)
  const roomLightboxImages = activeRoomImageSrc ? [activeRoomImageSrc, ...displayRoomGallery] : roomGallery

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    let startX = 0
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchMove  = (e: TouchEvent) => { if (Math.abs(startX - e.touches[0].clientX) > 10) e.preventDefault() }
    const onTouchEnd   = (e: TouchEvent) => {
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
        style={{ borderRadius: '30px 30px 30px 30px', background: ID.bg, position: 'relative', zIndex: 2, marginTop: -24, overflow: 'hidden', animation: visible ? 'immerseBorderFadeIn 0.8s ease 0.1s both' : undefined, boxShadow: '0 8px 32px rgba(0,0,0,0.32)' }}
      >
        <div style={{ marginBottom: 20, ...immerseFadeUp(visible, 0) }}>
          <ImmerseEyebrow style={visible ? { animation: 'immerseEyebrowSettle 0.7s cubic-bezier(0.16,1,0.3,1) both' } : { opacity: 0 }}>
            {data.hotelsEyebrow}
          </ImmerseEyebrow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${cards.length}, minmax(0, 1fr))`, gap: 10, width: '100%', minWidth: 0, boxSizing: 'border-box', ...immerseFadeUp(visible, 60) }}>
          {cards.map((c, i) => <HotelButton key={c.id} hotel={c} active={i === activeIdx} isMobile={isMobile} onClick={() => onCardClick(i)} />)}
        </div>

        <div style={{ marginTop: 24, width: '100%', minWidth: 0, animation: 'immerseFadeOnly 0.4s cubic-bezier(0.16,1,0.3,1) both' }} key={activeIdx}>
          <HotelDetailPanel hotel={detailHotel} activeRoom={activeCarouselIdx} isMobile={isMobile} onRoomChange={onCarouselChange} onLightbox={setLightboxIdx} arrowsAndDots={detailHotelArrowsAndDots} />
        </div>
      </ImmerseSectionWrap>

      <section
        ref={ref2 as React.RefObject<HTMLElement>}
        style={{ padding: '58px 0', borderTop: '1px solid rgba(216,181,106,0.12)', borderBottom: '1px solid rgba(216,181,106,0.08)', marginTop: -36, paddingTop: 94, position: 'relative', zIndex: 1, overflow: 'hidden', transition: 'margin-top 0.55s cubic-bezier(0.16,1,0.3,1)', background: '#060606' }}
      >
        {visible2 && <div style={{ position: 'absolute', top: 0, left: 0, height: 1, width: '100%', background: 'rgba(216,181,106,0.55)', animation: 'immerseGoldScan 1.1s cubic-bezier(0.16,1,0.3,1) both', pointerEvents: 'none', zIndex: 2 }} />}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundColor: C.gold, mixBlendMode: 'screen', animation: 'immerseGoldBreatheSolid 14s ease-in-out infinite' }} />

        <div style={{ position: 'relative', zIndex: 1, width: isMobile ? 'calc(100% - 24px)' : 'min(1220px, calc(100% - 36px))', margin: '0 auto' }}>
          <div style={{ ...immerseFadeUp(visible2, 0) }}>

            {/* Resort map — centered above room carousel */}
            {detailHotel.resortMapSrc && <ResortMapLink src={detailHotel.resortMapSrc} />}

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
              {carouselItems[activeCarouselIdx] && renderCarouselItem(carouselItems[activeCarouselIdx], `${activeIdx}-${activeCarouselIdx}`, true)}
              {!isMobile && gutterArrowsAroundHero && activeCarouselIdx > 0 && <button onClick={() => onCarouselChange(activeCarouselIdx - 1)} style={desktopGutterArrowStyle('left')}>‹</button>}
              {!isMobile && gutterArrowsAroundHero && activeCarouselIdx < total - 1 && <button onClick={() => onCarouselChange(activeCarouselIdx + 1)} style={desktopGutterArrowStyle('right')}>›</button>}
            </div>

            {!isMobile && !gutterArrowsAroundHero && total > 1 && (
              <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
                <button onClick={() => activeCarouselIdx > 0 && onCarouselChange(activeCarouselIdx - 1)} disabled={activeCarouselIdx === 0} style={desktopFlowArrowStyle(activeCarouselIdx === 0)} aria-label='Previous room'>‹</button>
                <button onClick={() => activeCarouselIdx < total - 1 && onCarouselChange(activeCarouselIdx + 1)} disabled={activeCarouselIdx === total - 1} style={desktopFlowArrowStyle(activeCarouselIdx === total - 1)} aria-label='Next room'>›</button>
              </div>
            )}

            {!isMobile && total > 1 && <NavRow isMobile={false} total={total} activeIdx={activeCarouselIdx} prevIdx={prevCarouselIdx} onChange={onCarouselChange} />}

            {activeRoomImageSrc && displayRoomGallery.length >= 1 && (
              <div style={{ marginTop: 40 }} key={`room-gallery-${activeIdx}-${activeCarouselIdx}`}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 12 }}>
                  Gallery · {roomLightboxImages.length} photos
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, width: '100%', minWidth: 0 }}>
                  {displayRoomGallery.map((src: string, i: number) => (
                    <div key={i} onClick={() => setRoomLightboxIdx(i + 1)} style={{ width: '100%', height: isMobile ? 118 : 160, borderRadius: ID.radiusMd, overflow: 'hidden', border: `1px solid ${ID.line}`, cursor: 'pointer', minWidth: 0, boxSizing: 'border-box', animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 200}ms both`, position: 'relative', transition: 'border-color 0.3s ease, transform 0.3s ease' }}>
                      <img src={src} alt={`${activeRoomBasis ?? ''} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </section>

      {lightboxIdx !== null && lightboxImages.length > 0 && (
        <LightboxOverlay images={lightboxImages} index={lightboxIdx} hotelName={lightboxLabel} onClose={() => setLightboxIdx(null)} onPrev={() => setLightboxIdx(lightboxIdx > 0 ? lightboxIdx - 1 : lightboxIdx)} onNext={() => setLightboxIdx(lightboxIdx < lightboxImages.length - 1 ? lightboxIdx + 1 : lightboxIdx)} />
      )}
      {roomLightboxIdx !== null && roomLightboxImages.length > 0 && (
        <LightboxOverlay images={roomLightboxImages} index={roomLightboxIdx} hotelName={roomLightboxLabel} onClose={() => setRoomLightboxIdx(null)} onPrev={() => setRoomLightboxIdx(roomLightboxIdx > 0 ? roomLightboxIdx - 1 : roomLightboxIdx)} onNext={() => setRoomLightboxIdx(roomLightboxIdx < roomLightboxImages.length - 1 ? roomLightboxIdx + 1 : roomLightboxIdx)} />
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
        width: '100%', minWidth: 0, padding: isMobile ? '14px 16px' : '16px 20px',
        borderRadius: ID.radiusMd,
        border: `1px solid ${active ? ID.gold : hovered ? 'rgba(216,181,106,0.30)' : ID.line}`,
        background: active ? 'rgba(216,181,106,0.08)' : 'transparent',
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.25s ease, background 0.25s ease, transform 0.15s ease, box-shadow 0.25s ease',
        boxSizing: 'border-box', transform: pressed ? 'scale(0.98)' : 'scale(1)',
        boxShadow: active ? '0 0 0 1px rgba(216,181,106,0.18), 0 4px 20px rgba(216,181,106,0.08)' : 'none',
        animation: active ? 'immerseGoldBorderPulse 3s ease-in-out infinite' : undefined,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: active ? ID.gold : ID.dim, fontWeight: 700, marginBottom: 6 }}>{hotel.rankLabel}</div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: active ? ID.text : ID.muted, lineHeight: 1.1 }}>{hotel.name}</div>
      <div style={{ fontSize: 11, color: active ? ID.dim : ID.lineSoft, marginTop: 4, letterSpacing: '0.08em' }}>{hotel.stayLabel}</div>
    </button>
  )
}

// ─── Hotel detail panel ───────────────────────────────────────────────────────

function HotelDetailPanel({ hotel, onLightbox, arrowsAndDots, hotelDesktopArrows }: {
  hotel:               ImmerseHotelOption
  activeRoom:          number
  isMobile:            boolean
  onRoomChange:        (i: number) => void
  onLightbox:          (i: number) => void
  arrowsAndDots?:      React.ReactNode
  hotelDesktopArrows?: { onPrev?: () => void; onNext?: () => void }
}) {
  const isMobile       = useImmerseMobile()
  const gallery        = hotel.gallery ?? []
  const displayGallery = gallery.filter((src: string) => src !== hotel.imageSrc)
  const lightboxImages = [hotel.imageSrc, ...gallery.filter((src: string) => src !== hotel.imageSrc)]

  return (
    <div style={{ display: 'grid', gap: 24, width: '100%', minWidth: 0 }}>
      <div onClick={() => onLightbox(0)} style={{ position: 'relative', borderRadius: ID.radiusXl, overflow: 'hidden', height: isMobile ? 220 : 420, width: '100%', minWidth: 0, cursor: 'pointer' }}>
        <img src={hotel.imageSrc} alt={hotel.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transformOrigin: 'center center', animation: 'immerseKenBurns 14s ease-in-out infinite alternate' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', background: 'radial-gradient(ellipse at center, transparent 38%, rgba(3,3,3,0.52) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '24px 16px 16px' : '64px 36px 28px', background: 'linear-gradient(0deg, rgba(3,3,3,0.72) 0%, rgba(3,3,3,0) 100%)' }}>
          <div style={{ fontSize: isMobile ? 28 : 'clamp(44px,5vw,72px)', lineHeight: isMobile ? 1.02 : 0.95, letterSpacing: '-0.03em', fontWeight: 400, fontFamily: '"Cormorant Garamond", "Cormorant", "Times New Roman", serif', color: ID.text }}>
            {hotel.name}
          </div>
          {hotel.michelinKeys ? (
            <div style={{ marginTop: 10, display: 'flex' }}>
              <RecognitionMark kind='keys' keyCount={hotel.michelinKeys} />
            </div>
          ) : null}
        </div>
      </div>

      {isMobile && arrowsAndDots}

      <div style={{ position: 'relative', width: '100%', paddingLeft: !isMobile && hotelDesktopArrows ? 80 : 0, paddingRight: !isMobile && hotelDesktopArrows ? 80 : 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
          {hotel.bullets.map((b, i) => (
            <div key={b} style={{ padding: isMobile ? '7px 12px' : '8px 14px', borderRadius: 999, border: `1px solid ${ID.line}`, background: ID.panel2, color: ID.muted, fontSize: isMobile ? 11 : 12, letterSpacing: '0.04em', animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60 + 200}ms both` }}>
              {b}
            </div>
          ))}
        </div>
        {!isMobile && hotelDesktopArrows?.onPrev && <button onClick={hotelDesktopArrows.onPrev} style={{ ...desktopGutterArrowStyle('left'), left: 0 }} aria-label='Previous hotel'>‹</button>}
        {!isMobile && hotelDesktopArrows?.onNext && <button onClick={hotelDesktopArrows.onNext} style={{ ...desktopGutterArrowStyle('right'), right: 0 }} aria-label='Next hotel'>›</button>}
      </div>

      {gallery.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: ID.dim, fontWeight: 700, marginBottom: 10 }}>Gallery · {lightboxImages.length} photos</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, width: '100%' }}>
            {displayGallery.map((src, i) => (
              <div key={i} onClick={() => onLightbox(i + 1)}
                style={{ width: '100%', height: isMobile ? 118 : 160, borderRadius: ID.radiusMd, overflow: 'hidden', border: `1px solid ${ID.line}`, cursor: 'pointer', minWidth: 0, boxSizing: 'border-box', animation: `immerseFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 400}ms both`, position: 'relative', transition: 'border-color 0.3s ease, transform 0.3s ease' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(216,181,106,0.45)'; e.currentTarget.style.transform = 'scale(1.01)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ID.line; e.currentTarget.style.transform = 'scale(1)' }}
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
  images: string[]; index: number; hotelName: string
  onClose: () => void; onPrev: () => void; onNext: () => void
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(3,3,3,0.94)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'immerseFadeIn 0.25s ease both' }}>
      <button onClick={onClose} style={{ position: 'fixed', top: 24, right: 28, background: 'none', border: 'none', color: 'rgba(245,242,236,0.5)', fontSize: 28, cursor: 'pointer', zIndex: 1000 }}>×</button>
      <div style={{ position: 'fixed', top: 28, left: '50%', transform: 'translateX(-50%)', color: ID.dim, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, zIndex: 1000 }}>
        {hotelName} · {index + 1} / {images.length}
      </div>
      {index > 0 && <button onClick={e => { e.stopPropagation(); onPrev() }} style={{ position: 'fixed', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(245,242,236,0.36)', fontSize: 42, cursor: 'pointer', zIndex: 1000 }}>‹</button>}
      {index < images.length - 1 && <button onClick={e => { e.stopPropagation(); onNext() }} style={{ position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(245,242,236,0.36)', fontSize: 42, cursor: 'pointer', zIndex: 1000 }}>›</button>}
      <img key={index} src={images[index]} alt={`${hotelName} image ${index + 1}`} onClick={e => e.stopPropagation()} style={{ maxWidth: 'calc(100vw - 120px)', maxHeight: 'calc(100vh - 120px)', objectFit: 'contain', borderRadius: ID.radiusLg, boxShadow: '0 32px 80px rgba(0,0,0,0.64)', animation: 'immerseFadeIn 0.3s ease both', display: 'block' }} />
    </div>,
    document.body,
  )
}