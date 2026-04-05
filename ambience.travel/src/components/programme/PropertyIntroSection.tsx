/* PropertyIntroSection.tsx
 * Full-viewport dark intro for the trip guide page.
 * Mirrors IntroSection.tsx from the landing exactly:
 * — same dark background, grid texture, float positions, timing
 * — same fade-in/hold/fade-out cycle (4.4s total)
 * — same alternating left/right anchor positions
 * Instead of TravelCard widgets, cycles through property photos.
 */

import { useEffect, useState } from 'react'
import AmbienceLogo from '../AmbienceLogo'
import { DARK } from '../../lib/landingTypes'
import { WIDGET } from '../../lib/landingColors'

// ── Float positions — 8 anchors, alternating left/right ──────────────────────
// Identical to IntroSection.tsx ALL_POSITIONS

const ALL_POSITIONS = [
  { top: '12%', left: 'clamp(16px, 3vw, 48px)',              tx: '0',     ty: '0'    }, // left  top
  { top: '10%', left: 'calc(100% - clamp(16px, 3vw, 48px))', tx: '-100%', ty: '0'    }, // right top
  { top: '50%', left: 'clamp(16px, 3vw, 48px)',              tx: '0',     ty: '-50%' }, // left  mid
  { top: '45%', left: 'calc(100% - clamp(16px, 3vw, 48px))', tx: '-100%', ty: '-50%' }, // right mid
  { top: '72%', left: 'clamp(16px, 3vw, 48px)',              tx: '0',     ty: '-50%' }, // left  low
  { top: '68%', left: 'calc(100% - clamp(16px, 3vw, 48px))', tx: '-100%', ty: '-50%' }, // right low
  { top: '30%', left: 'clamp(16px, 3vw, 48px)',              tx: '0',     ty: '-50%' }, // left  upper-mid
  { top: '28%', left: 'calc(100% - clamp(16px, 3vw, 48px))', tx: '-100%', ty: '-50%' }, // right upper-mid
]

// ── Timing — identical to IntroSection ───────────────────────────────────────
const FADE_IN_MS  = 500
const FADE_OUT_MS = 4000
const NEXT_MS     = 4400

// ── Floating photo — one image at a time, alternates sides ───────────────────

function FloatingPhoto({ photos, isMobile }: { photos: { src: string; caption: string; subCaption: string }[]; isMobile: boolean }) {
  const [index,  setIndex]  = useState(0)
  const [phase,  setPhase]  = useState<'in' | 'hold' | 'out'>('in')
  const [posIdx, setPosIdx] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), FADE_IN_MS)
    const t2 = setTimeout(() => setPhase('out'),  FADE_OUT_MS)
    const t3 = setTimeout(() => {
      setIndex(i => (i + 1) % photos.length)
      setPosIdx(p => (p + 1) % ALL_POSITIONS.length)
      setPhase('in')
    }, NEXT_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [index, photos.length])

  const photo   = photos[index]
  const opacity = phase === 'hold' ? 1 : 0
  const scale   = phase === 'hold' ? 1 : phase === 'in' ? 0.95 : 1.01
  const blur    = phase === 'out'  ? 2 : 0
  const pos     = ALL_POSITIONS[posIdx]

  if (isMobile) {
    return (
      <div
        style={{
          position:        'absolute',
          top:             16,
          left:            '50%',
          transform:       `translateX(-50%) scale(${0.72 * scale})`,
          transformOrigin: 'top center',
          opacity:         opacity * 0.86,
          width:           'min(280px, 88vw)',
          pointerEvents:   'none',
          transition:      'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        <Photo src={photo.src} caption={photo.caption} subCaption={photo.subCaption} />
      </div>
    )
  }

  return (
    <div
      style={{
        position:   'absolute',
        top:        pos.top,
        left:       pos.left,
        transform:  `translate(${pos.tx}, ${pos.ty})`,
        transition: 'top 1s ease, left 1s ease, transform 1s ease',
        opacity:    0.86,
        maxWidth:   320,
      }}
    >
      <div
        style={{
          opacity,
          transform:  `scale(${scale})`,
          filter:     blur ? `blur(${blur}px)` : 'none',
          transition: 'opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease',
          boxShadow:  '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          borderRadius: 16,
        }}
      >
        <Photo src={photo.src} caption={photo.caption} subCaption={photo.subCaption} />
      </div>
    </div>
  )
}

function Photo({ src, caption, subCaption }: { src: string; caption: string; subCaption: string }) {
  return (
    <div style={{ position: 'relative', width: 320, borderRadius: 16, overflow: 'hidden' }}>
      <div
        style={{
          width:              '100%',
          height:             220,
          backgroundColor:    WIDGET.bgDeep,
          backgroundImage:    `url(${src})`,
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
        }}
      />
      <div
        style={{
          padding:   '10px 14px',
          background: WIDGET.bgInset,
          borderTop: `1px solid ${WIDGET.borderMid}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: WIDGET.text, letterSpacing: '0.02em', marginBottom: 3 }}>
          {caption}
        </div>
        <div style={{ fontSize: 9, color: WIDGET.textMid, letterSpacing: '0.04em' }}>
          {subCaption}
        </div>
      </div>
    </div>
  )
}

// ── PropertyIntroSection ──────────────────────────────────────────────────────

type PropertyIntroSectionProps = {
  propertyName: string
  location:     string
  tagline:      string
  photos:       { src: string; caption: string; subCaption: string }[]
  heroVis:      boolean
  checkIn?:     string
  checkOut?:    string
}

export default function PropertyIntroSection({
  propertyName,
  location,
  tagline,
  photos,
  heroVis,
  checkIn,
  checkOut,
}: PropertyIntroSectionProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    heroVis ? 1 : 0,
    transform:  heroVis ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
  })

  return (
    <section
      style={{
        minHeight:      '100vh',
        background:     '#1A1A18',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        position:       'relative',
        overflow:       'hidden',
        borderBottom:   `1px solid ${WIDGET.borderMid}`,
      }}
    >
      {/* Grid texture — identical to IntroSection */}
      <div
        style={{
          position:        'absolute',
          inset:           0,
          opacity:         0.08,
          pointerEvents:   'none',
          backgroundImage: 'linear-gradient(rgba(250,248,246,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(250,248,246,0.08) 1px,transparent 1px)',
          backgroundSize:  '56px 56px',
        }}
      />

      {/* Floating photos */}
      {photos.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <FloatingPhoto photos={photos} isMobile={isMobile} />
        </div>
      )}

      {/* Centre identity */}
      <div
        style={{
          position:       'relative',
          zIndex:         2,
          textAlign:      'center',
          padding:        'clamp(160px,20vw,0px) clamp(20px,5vw,48px) 0',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
        }}
      >
        {/* Emblem */}
        <div style={{ ...fade(0), marginBottom: 28 }}>
          <img
            src='/emblem.png'
            alt='ambience.travel emblem'
            style={{
              width:        72,
              height:       72,
              borderRadius: '50%',
              boxShadow:    '0 0 0 1px rgba(201,184,142,0.35), 0 0 48px rgba(201,184,142,0.22)',
            }}
          />
        </div>

        {/* Logo */}
        <div style={{ ...fade(100), marginBottom: 28 }}>
          <AmbienceLogo isDark={true} product='travel' height='clamp(88px,4vw,88px)' />
        </div>

        {/* Property name + location — mirrors dual tagline pattern */}
        <div style={{ ...fade(220), marginBottom: 28 }}>
          <p
            style={{
              fontSize:      'clamp(28px,3.5vw,48px)',
              color:         DARK.heading,
              letterSpacing: '-0.02em',
              marginBottom:  8,
              lineHeight:    1.15,
              fontWeight:    700,
            }}
          >
            {propertyName}
          </p>
          <p
            style={{
              fontSize:      'clamp(18px,2vw,28px)',
              color:         DARK.subheading,
              letterSpacing: '-0.02em',
              lineHeight:    1.15,
              fontWeight:    700,
            }}
          >
            {location}
          </p>
        </div>

        {/* Tagline */}
        <p
          style={{
            ...fade(300),
            fontSize:   'clamp(14px,1.4vw,17px)',
            color:      DARK.descriptor,
            lineHeight: 1.8,
            maxWidth:   520,
            margin:     '0 auto 48px',
          }}
        >
          {tagline}
        </p>

        {/* Date pills — always shown, TBA fallback when no dates */}
        <div style={{
          ...fade(350),
          display:        'flex',
          gap:            10,
          justifyContent: 'center',
          flexWrap:       'wrap',
          marginBottom:   32,
        }}>
          <div style={{
            padding:      '7px 18px',
            borderRadius: 100,
            border:       `1px solid ${WIDGET.borderMid}`,
            background:   WIDGET.bgInset,
            fontSize:     11,
            color:        '#C9B88E',
            letterSpacing:'0.04em',
          }}>
            {checkIn
              ? `→ ${new Date(checkIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : '→ Check-in TBA'}
          </div>
          <div style={{
            padding:      '7px 18px',
            borderRadius: 100,
            border:       `1px solid ${WIDGET.borderMid}`,
            background:   WIDGET.bgInset,
            fontSize:     11,
            color:        WIDGET.textMid,
            letterSpacing:'0.04em',
          }}>
            {checkOut
              ? `${new Date(checkOut).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} →`
              : 'Check-out TBA →'}
          </div>
        </div>

        {/* Scroll indicator — identical to IntroSection */}
        <div style={{ ...fade(400), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: WIDGET.textFaint }}>
            scroll
          </span>
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${WIDGET.textFaint}, transparent)` }} />
        </div>
      </div>
    </section>
  )
}